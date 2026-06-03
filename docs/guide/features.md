# Features & design choices

Rozie tries to be the syntax a Vue developer would design if they wanted React, Svelte, Angular, Solid, and Lit output without losing the SFC ergonomics. A few of those choices are worth calling out, because they translate into meaningful code-saving over hand-rolled cross-framework wrappers.

## Parameterized event modifiers

Every `@event` in a `<template>` (and every `@event` on a `<listener>` in a `<listeners>` block) supports a chainable modifier suffix. Unlike Vue, modifiers can take arguments — `.debounce(300)`, `.throttle(100)`, `.outside($refs.a,$refs.b)` — and they compose:

```rozie
<template>
  <input 
    @input.debounce(300)="onSearch" 
    @keydown.enter="onSearch" 
    @keydown.escape="clear" 
  />
</template>

<listeners>
  <!-- The modifier grammar handles chains of mixed args and bare modifiers: -->
  <listener :target="window" @resize.throttle(100).passive="reposition" />
</listeners>

```

> Modifier-arg lists on a `<listener>` `@event` must not contain internal whitespace — write `.outside($refs.a,$refs.b)`, not `.outside($refs.a, $refs.b)`. The attribute *name* (everything before `=`) ends at the first space, so a space inside the parens would truncate the modifier chain. (Inside a `<template>` attribute the same rule applies.)

The grammar is a small dedicated PEG (`packages/core/src/modifier-grammar/modifier-grammar.peggy`), so the syntax is fixed and predictable across every target. Built-ins:

| Modifier | What it does |
| --- | --- |
| `.stop` | `event.stopPropagation()` before the handler runs |
| `.prevent` | `event.preventDefault()` before the handler runs |
| `.self` | Handler fires only when `event.target === event.currentTarget` |
| `.capture` | Attach the listener in capture phase |
| `.passive` | Mark the listener `{ passive: true }` |
| `.once` | Remove the listener after the first call |
| `.debounce(ms)` | Coalesce calls; fire `ms` after the last one |
| `.throttle(ms)` | Fire at most once per `ms` window |
| `.outside($refs.a, ...)` | Fire only when the event target is outside every listed ref |
| `.enter` / `.escape` / `.tab` / `.space` / `.arrow{Up,Down,Left,Right}` / `.delete` | Key filters; the handler short-circuits unless the key matches |

Each one compiles to the per-target idiom: Vue's `@keydown.enter`/`watchEffect`-with-cleanup, React's `useEffect`-with-removeEventListener, Svelte's `$effect` teardown, Angular's `Renderer2.listen` + `DestroyRef`, Solid's `createEffect` + `onCleanup`, Lit's `firstUpdated` wiring + `disconnectedCallback` cleanup (with `.debounce`/`.throttle` hoisted to stable class fields). **You write the modifier; Rozie writes the rest.**

## `r-model` modifiers — `.lazy`, `.number`, `.trim`

`r-model` (the form-input two-way sugar) takes its own modifier chain, with the same Vue muscle memory:

```rozie
<template>
  <!-- commit on `change`, not on every keystroke -->
  <input type="text" r-model.lazy="$data.draft" />

  <!-- coerce to a number; strip whitespace first -->
  <input type="text" r-model.number.trim="$data.quantity" />
</template>
```

| Modifier | What it does |
| --- | --- |
| `.lazy` | Bind on the `change` event instead of `input` — state commits when the field is left, not per keystroke |
| `.number` | Coerce the value with a `looseToNumber`-equivalent: parse as a float, fall back to the raw string when the result is `NaN` |
| `.trim` | `String.prototype.trim()` the value before it is committed |

**Compose order is fixed and Vue-canonical** — value transforms always run `.trim` (whitespace strip) → custom transforms → `.number` (coercion, always terminal, because it produces a non-string). `r-model.number.trim` and `r-model.trim.number` emit byte-identical code, so writing them "in the wrong order" is never an error — it is silently canonicalized. `.lazy` is orthogonal (an event-binding swap, not a value transform).

The built-ins apply to the **form-input `r-model`** sugar only. A built-in on the consumer-side `r-model:propName` two-way form, an unknown modifier (`r-model.numbr` → did-you-mean `.number`), an event modifier misused on `r-model` (`r-model.stop`), or any modifier on a non-modifier directive (`r-show.foo`) are all **hard compile errors** (`ROZ960`–`ROZ963`) — replacing the old behavior where `<input r-model.number>` compiled silently to a dead `<input/>`.

**One documented parity edge case (React `.lazy`).** React has no true `change` event — `onChange` fires per keystroke — so `r-model.lazy` in React emits an **uncontrolled `defaultValue` + `onBlur`** input (`<input defaultValue={x} onBlur={…} />`), the idiomatic React deferred-commit pattern. The trade-off: programmatic writes to the bound state mid-edit are not reflected by the uncontrolled input. The other five targets just swap their event name (Vue `v-model.lazy`, Svelte `on:change`, Angular `(change)`, Solid `onChange`, Lit `@change`). This is consistent with Rozie's "high-percentage parity, not 100%" policy — see [`docs/compatibility.md`](../compatibility.md).

## Custom modifiers — the `registerModifier` extension API

The modifier system is open: a component-library author can register their own modifiers — for **events** and for **`r-model`** — using the same public API, and thread them through `compile()`. There is one `ModifierRegistry`, one `registerModifier(...)` authoring call, and one `compile({ modifierRegistry })` threading path.

```ts
import {
  ModifierRegistry,
  registerBuiltins,
  registerModifier,
  compile,
  type EventModifierImpl,
  type ModelModifierImpl,
} from '@rozie/core';

// An EVENT modifier — carries six per-target emission descriptors, because
// event wiring genuinely diverges per target. `resolve()` returns
// `{ entries, diagnostics }`.
const logClick: EventModifierImpl = {
  // `kind` is optional for event modifiers — absent ⇒ 'event'.
  name: 'log',
  arity: 'none',
  resolve() {
    return { entries: [{ kind: 'filter', modifier: 'log', args: [], sourceLoc: { start: 0, end: 0 } }], diagnostics: [] };
  },
  react() { return { kind: 'inlineGuard', code: 'console.log("clicked");' }; },
  vue()    { return { kind: 'inlineGuard', code: 'console.log("clicked");' }; },
  // …svelte / angular / solid / lit
};

// A MODEL modifier — target-agnostic. `kind: 'model'` is REQUIRED. `resolve()`
// returns ONE `{ descriptor, diagnostics }`; the descriptor's `valueTransform`
// is a code fragment with a `$v` placeholder each emitter substitutes with its
// own extracted-value access, and an optional `eventSwap: 'change'` flag.
const upper: ModelModifierImpl = {
  kind: 'model',
  name: 'upper',
  arity: 'none',
  resolve() {
    return { descriptor: { valueTransform: 'String($v).toUpperCase()' }, diagnostics: [] };
  },
};

// Build a registry, add the built-ins, then register your own.
const registry = new ModifierRegistry();
registerBuiltins(registry);
registerModifier(registry, logClick);
registerModifier(registry, upper);

// Thread it through compile() — the registry flows through lowering + emit.
const result = compile(source, { target: 'react', modifierRegistry: registry });
```

A model modifier declares **one descriptor**, not six per-target methods — `.trim` is `v.trim()` everywhere, `.number` is a `looseToNumber` coercion everywhere, a custom reformatter is one fragment everywhere. The flat shared namespace (an event and a model modifier cannot share a name) is what lets the compiler tell you precisely whether a misused modifier is an unknown name or an event modifier on `r-model`.

The `tests/plugins/phone` dogfood is a worked end-to-end example — a custom `.phone` US-phone-number reformatter (a `kind: 'model'` value-transform modifier) that compiles across all six targets using only `@rozie/core`'s public barrel.

## `<listeners>` block — declarative `<listener>` elements

Document-level and window-level listeners belong outside the markup, so Rozie gives them their own block. The `<listeners>` block is a *wiring* block of `<listener>` elements — one element per target-and-condition. Each `<listener>` carries:

- `:target` — where to attach. Currently `window` or `document` (see the `$refs` note below). Omit it and the listener attaches to the component's root element (`$el`).
- one or more `@event.modifier(args)` attributes — the events to subscribe to, with the same chainable modifier grammar that template `@event` handlers use.
- an optional `r-if` — the reactive *conditional attach/detach* predicate.

```rozie
<listeners>
  <listener :target="document" @click.outside($refs.triggerEl,$refs.panelEl)="close" r-if="$props.open && $props.closeOnOutsideClick" />
  <listener :target="document" @keydown.escape="close" r-if="$props.open && $props.closeOnEscape" />
  <listener :target="window" @resize.throttle(100).passive="reposition" r-if="$props.open" />
</listeners>
```

**Multiple `@event` per tag.** One `<listener>` is a target + a condition + the events on it. A tag with several `@event` attributes fans out to one subscription per event, all sharing that tag's `:target` and `r-if`:

```rozie
<listeners>
  <listener :target="window" @resize.throttle(100).passive="reposition" @scroll.passive="reposition" r-if="$props.open" />
</listeners>
```

**`r-if` is conditional attach, not conditional render.** On a `<listener>`, `r-if` means "subscribed while the condition holds." When it flips false the listener is removed; when it flips true again it is re-attached. This is distinct from `r-if` inside a `<template>`, which mounts/unmounts DOM. (It is also why `<listener>` only lives in `<listeners>` — a `<listener>` in a `<template>` is a compile error.) No `addEventListener` / `removeEventListener` boilerplate, no missed teardown on unmount. This single block in `Dropdown.rozie` collapses roughly 30 lines of per-framework wiring that would otherwise be written once per target.

::: tip `:target` today accepts `window` / `document`; `$refs` targets are planned
`:target` currently resolves only to `window`, `document`, or (omitted) the component root `$el`. Attaching a listener to a `$refs`-named element — e.g. `:target="$refs.panelEl"` — is **planned but not yet supported**. The hard part is *not* the syntax: it is the *conditional re-attach* problem. A `$refs` element can itself be `r-if`-gated (rendered only when some condition holds), so at the moment the listener wants to attach, the ref'd element may not be mounted yet — and when the element later mounts (or remounts), the subscription has to re-attach to the new node and tear down cleanly when it unmounts. Getting that lifecycle right across all six targets' reconcilers is the open design question. Until then, reach a specific element from a `window`/`document` listener via the event target, or wire it imperatively in `$onMount` through `$refs`.
:::

## `<components>` block, including self-recursion

Child components are declared explicitly in a `<components>` block. Same map shape as `<props>`, but the values are import paths:

```rozie
<components>
{
  CardHeader: './CardHeader.rozie',
  Counter:    './Counter.rozie',
}
</components>

<template>
  <article class="card">
    <CardHeader :title="$props.title" :on-close="$props.onClose" />
    <slot />
  </article>
</template>
```

Self-recursion works the same way — list the file itself, then use the tag inside its own template:

```rozie
<rozie name="TreeNode">

<components>
{
  TreeNode: './TreeNode.rozie',
}
</components>

<template>
<li>
  <span>{{ $props.node.label }}</span>
  <ul r-if="$props.node.children?.length">
    <li r-for="child in $props.node.children" :key="child.id">
      <TreeNode :node="child" />
    </li>
  </ul>
</li>
</template>
```

Each target gets the right import idiom: Vue's `defineOptions({ name })` + setup import, React's hoisted named function, Svelte's self-import-with-extension, Angular's `forwardRef(() => TreeNode)`, Solid's named function declaration, Lit's sibling custom-element import (the tag self-registers via `@customElement`).

## `r-match` / `r-case` / `r-default` — switch-style conditionals

A ladder of `r-if`/`r-else-if`/`r-else` that re-tests the same value on every rung gets noisy fast. `r-match` is the switch-flavored alternative: name the discriminant once on the host, then list `r-case` branches. Exactly one branch renders, selected by strict `===` equality:

```rozie
<template>
<template r-match="$data.bound">
  <span r-case="'max'" class="extremum">at the maximum</span>
  <span r-case="'mid'" class="middle">in the middle</span>
  <span r-default class="other">somewhere else</span>
</template>
</template>
```

`r-match` goes on a `<template>` (a non-rendering group) or on a real element (`<div r-match="...">` keeps the `<div>` as a wrapper). Each `r-case` — and the one optional `r-default` — is a direct child; a branch authored as `<template r-case>` emits all of its children with no wrapper. Under the hood the construct lowers to a plain `if`/`else-if`/`else` ladder on all six targets — Vue `v-if`/`v-else-if`/`v-else`, React/Solid a ternary chain, Svelte `{#if}`, Angular `@if`, Lit an inline ternary — so there is no new runtime, just less repetition in the source.

### Comma alternatives

A single `r-case` can carry several values separated by commas — it matches if the discriminant equals **any** of them:

```rozie
<span r-case="'max', 'min'" class="extremum">at an extremum</span>
```

This is a deliberate Rozie sub-grammar: a top-level comma expression in `r-case` is the alternatives list, the same way `r-for`'s `x in xs` is its own micro-syntax. It lowers to a `===`-OR chain — `bound === 'max' || bound === 'min'` — and never to `.includes()`, because `===`-OR is what keeps a discriminated-union discriminant narrowed for the consumer's TypeScript checker.

### Literal-`true` predicate mode

Sometimes the rungs aren't equality checks against one value — they're independent predicates. Set the discriminant to the literal `true` and `r-case` switches to bare-predicate mode: each `r-case` is its own condition, not a value compared against the discriminant:

```rozie
<template r-match="true">
  <strong r-case="$data.count > 10" class="high">plenty</strong>
  <span r-case="$data.count > 0" class="some">a few</span>
  <span r-default class="none">none</span>
</template>
```

Here `r-case="$data.count > 10"` lowers to the bare predicate `$data.count > 10`, not `true === (...)`. The visible <span v-pre>`r-match="true"`</span> is what makes the mode explicit — there is no bare/discriminant-less form of `r-match`. (Literal `false` is the negated-predicate mirror.)

### Branch-swap DOM identity

When the active branch changes and two branches happen to share a tag, Rozie inherits each target framework's native reconciliation behavior — the same DOM-identity semantics you'd get from a hand-written `v-if` / `{#if}` / `@if` ladder. Rozie v1 does **not** auto-key match branches: if you need a guaranteed-fresh DOM subtree on a branch swap (to reset uncontrolled inputs, restart a CSS transition, etc.), add an explicit `:key` exactly as you would with `r-if`. An `r-match.keyed` modifier is a possible future, non-breaking addition; it is not in v1.

### Error boundaries

A few malformed shapes are static compile errors with source-located code frames: an `r-match` with no value, a child of an `r-match` host that is neither `r-case` nor `r-default`, a valueless `r-case` (the diagnostic nudges you toward `r-default`), `r-case` and `r-for` on the same element, an `r-default` that isn't last, and more than one `r-default`. A literal `r-case` value that duplicates an earlier one is a warning, not an error — first occurrence wins, like a JavaScript `switch`.

## `<props>` and `<data>` accept real JS expressions

Most config-block DSLs stop at JSON5. Rozie's parser uses `@babel/parser.parseExpression`, so the values can be anything a JS expression can be — arrow factories, identifiers like `Number` / `Infinity` / `String`, spreads, anything:

```rozie
<props>
{
  value: { type: Number,  default: 0,  model: true },
  step:  { type: Number,  default: 1 },
  min:   { type: Number,  default: -Infinity },
  max:   { type: Number,  default: Infinity },
  items: { type: Array,   default: () => [] },
  config: { type: Object, default: () => ({ retries: 3, delay: 100 }) },
}
</props>
```

That `default: () => []` is real, not a string template — every target's emitter unwraps it into the framework's native default-prop mechanism (`withDefaults`, `?? ...`, `$bindable(...)`, `input<T>(...)`, a `@property` field initializer for Lit, etc.).

A prop's `type:` is just as flexible. It can be a builtin constructor token (`Number` / `String` / `Boolean` / `Array` / `Object` / `Function`), or a bare identifier naming a `type` alias or `interface` declared in the same component's `<script lang="ts">` block. Rozie passes that identifier through verbatim into each target's typed prop signature, so the consumer's type-checker sees the real type — not a widened `unknown`.

```rozie
<script lang="ts">
type Variant = 'a' | 'b'
</script>

<props>
{
  variant: { type: Variant, default: 'a' },
}
</props>
```

See `examples/typed/PropsCustomType.rozie` for a worked reference covering both a string-literal union alias and a custom `interface` flowing into prop-type position across all six targets.

## `required: true` → one prop contract, not six guesses

A `<props>` entry can declare `required: true`. It is the **sole** determinant of whether the prop is required — `default:` is orthogonal, mirroring Vue's Options-API model. Three states:

- **`required: true`, no `default:`** — the consumer **must** pass the prop. Every target emits a non-optional prop contract: React/Solid/Vue/Svelte a non-optional `name: T` field, Angular `input.required<T>()` / `model.required<T>()`, Lit a definite-assignment `name!: T` field.
- **`default: X`** (with or without `required:`) — the consumer **may** omit the prop; the default fills in. A `default:` always makes the prop optional regardless of any `required` value.
- **neither** — the consumer **may** omit the prop; its internal value is `T | undefined`.

```rozie
<script lang="ts">
interface Item { id: number; label: string }
</script>

<props>
{
  item:     { type: Item,    required: true },
  selected: { type: Boolean, required: true, model: true },
}
</props>
```

Before this, the IR had no `required` field and each target *guessed* optionality from `default:` presence — Angular/Lit treated a no-default prop as required, the others as optional. Same source, different per-target contract. `required` closes that gap: one `.rozie` source now produces one prop contract everywhere.

**`required: true` + `default:` is incoherent** — the default could never fire on a prop the consumer is forced to pass. Rozie drops the default and emits a `ROZ014` warning. Declare one or the other, never both.

One documented edge case: a Lit `model: true` + `required: true` prop. Lit model props are attribute-backed, and custom elements have no required-attribute concept, so the attribute-reflection backing keeps a fabricated initializer value internally even though the public field is emitted non-optional (`name!: T`). This residual is an accepted, documented Lit-ism under Rozie's "high-percentage parity" bar.

See `examples/typed/PropsRequired.rozie` for a worked reference: a required interface-typed prop dereferenced in-template (a member access that only type-checks if `required` genuinely threads through to a non-optional contract) plus a required two-way (`model: true`) prop, proven across all six per-target type-check / lint gates.

## `model: true` → idiomatic two-way binding everywhere

One flag in `<props>`. Six different two-way-binding expansions, each one the target's native pattern:

```rozie
<props>
{
  value: { type: Number,  default: 0,    model: true },
  open:  { type: Boolean, default: false, model: true },
}
</props>
```

| Target | Expansion |
| --- | --- |
| Vue | `const value = defineModel<number>('value', { default: 0 })` |
| React | `useControllableState({ value, defaultValue, onValueChange })` from `@rozie/runtime-react` |
| Svelte 5 | `let { value = $bindable(0) }: Props = $props()` |
| Angular | `value = model<number>(0)` |
| Solid | `createControllableSignal(_props, 'value', 0)` from `@rozie/runtime-solid` |
| Lit | `createLitControllableProperty({ host, eventName: 'value-change', defaultValue: 0 })` from `@rozie/runtime-lit` — a `value` property/attribute pair plus a `value-change` CustomEvent |

### Reading vs. writing a model prop: `$props.x` and `$model.x`

A `model: true` prop has two faces inside the component, just like React's `value` / `setValue` pair:

- **Read** the current value through `$props.x` — `{{ $props.open }}`, `if ($props.value > 0)`.
- **Write** the new value through the `$model.x` sigil — `$model.open = false`, `$model.value += step`, `$model.value++`.

Rozie rewrites the `$model.x` assignment to the target's native emit-or-setter form (Vue `emit('update:value', …)`, React `onValueChange`, Svelte `$bindable` write, Angular `valueChange.emit`, Solid controllable setter, Lit `value-change` CustomEvent). It's a write sigil, not a separate object — there's no `$model.x` *read*.

```rozie
<script>
const increment = () => { $model.value += $props.step }
const close     = () => { $model.open = false }
</script>
```

The mnemonic pairs with the consumer-side `r-model:value="…"` directive: `r-model:` on the outside, `$model.` on the inside.

**Writing a prop through `$props` is a compile error**, caught before the bug ships:

- `$props.x = …` where `x` is **not** `model: true` → **ROZ200** (`WRITE_TO_NON_MODEL_PROP`). Props are read-only inputs; mutating one is the single most common cross-framework component bug.
- `$props.x = …` where `x` **is** `model: true` → **ROZ204** (`WRITE_TO_MODEL_PROP_VIA_PROPS`), whose message points you at the fix: use `$model.x`.

### Angular: a single-model component is a real form control

When a component has **exactly one** `model: true` prop, the Angular emitter goes one step further than `model<T>()`: the generated class also implements `ControlValueAccessor` and registers the `NG_VALUE_ACCESSOR` provider. The component plugs straight into Angular's forms system — template-driven or reactive — with no wrapper directive and nothing to hand-write:

```html
<!-- Template-driven -->
<rozie-flatpickr [(ngModel)]="birthday" name="birthday" />

<!-- Reactive forms -->
<rozie-flatpickr [formControl]="birthday" />
<rozie-flatpickr formControlName="birthday" />
```

The generated accessor follows a fixed contract:

- **View→model, never an echo.** Only a real internal write — a `$model.x` assignment, an `r-model` input event, an engine callback — notifies the form control. A programmatic `writeValue` from the form updates the view but never echoes back through `registerOnChange`, so there is no value-echo loop.
- **`writeValue(null)` coerces to the prop's declared `default:`.** Resetting a form clears the component instead of crashing it. A `required: true` model prop with no default ignores the initial `null` write.
- **Touched on `(focusout)`.** The control is marked touched when focus leaves the component.
- **Disabled is a merge.** `setDisabledState` OR-merges with a declared **Boolean** `disabled` prop — either source disables the component. Without a Boolean `disabled` prop it's a no-op (info diagnostic **ROZ126**).
- **Two-way binding and the form control coexist.** `r-model:x="…"` and a forms directive can both bind the same component. Writes through the two-way binding update the view but do **not** dirty the form control — the same convention Angular Material follows.

Components with **zero or multiple** `model: true` props don't get an accessor — there is no single value for a form control to own (**ROZ125** explains this on multi-model components). Exposing an `$expose` method named `writeValue` / `registerOnChange` / `registerOnTouched` / `setDisabledState` on a CVA component is a compile error (**ROZ124**) — it would collide with the generated accessor.

This is on by default. To opt out, pass `angular: { cva: false }` to `@rozie/unplugin` or `compile()`, or `--no-cva` on the CLI — the emitted class is then byte-identical to the pre-CVA output. The other five targets are untouched either way; CVA is an Angular-only forms contract.

See the [Flatpickr forms recipe](/guide/flatpickr#forms-drop-in) for a worked example against a real engine-wrapper component.

## `$expose({ ... })` → a consumer-callable imperative handle everywhere

Some components have to offer imperative methods — a date picker's `clear()` / `open()`, an editor's `focus()` / `setContent()`, a map's `flyTo()`. Re-implementing "expose an imperative method" once per framework (`useImperativeHandle`, `defineExpose`, instance exports, public methods, ref-forwarding…) is exactly the per-framework wrapper work Rozie exists to delete.

Declare the handle once. List the in-scope `<script>` functions you want to expose:

```rozie
<script lang="ts">
let instance = null
$onMount(() => { instance = flatpickr($refs.inputEl, { /* … */ }); return () => instance?.destroy() })

function clear()      { instance?.clear() }
function open()       { instance?.open() }
function close()      { instance?.close() }
function setDate(d)   { instance?.setDate(d) }

$expose({ clear, open, close, setDate })
</script>
```

`$expose` exposes **only functions** — bare references to in-scope `<script>` function/arrow declarations (or inline arrows). To expose a *value*, expose a getter method: `$expose({ getValue: () => $data.x })`. Malformed forms are caught at compile time (ROZ115–ROZ120): a non-object argument, a spread, a computed key, a non-function value, a duplicate `$expose` call, or an `$expose` outside `<script>` top level each produce a distinct diagnostic. Exposing a method whose name collides with an emitted event — or, on class-based targets like Angular, a same-named declared prop — is also rejected (`ROZ121`): the event/prop and the method would share a class-member name, so rename the method (events and props keep their public consumer-facing names). An empty or whitespace-only `$emit` event name (`$emit('')`) is likewise rejected at compile time (`ROZ122`) — an empty name cannot be bound by consumers on any target.

Each target lowers the one declaration to its native handle idiom. When a component has no `$expose`, none of this is emitted — output is byte-for-byte unchanged (React, notably, is **not** wrapped in `forwardRef`):

| Target | Emitted handle |
| --- | --- |
| Vue | `defineExpose({ clear, open, close, setDate })` after the setup body |
| React | the component is wrapped in `forwardRef`, with `useImperativeHandle(ref, () => ({ clear, open, close, setDate }), [])`; a typed `FooHandle` interface ships in the emitted `.d.ts` |
| Svelte 5 | each exposed function becomes an instance `export function clear() { … }` |
| Angular | the exposed functions are guaranteed **public** methods on the `@Component` class |
| Solid | a callback `ref` prop — `props.ref?.({ clear, open, close, setDate })` invoked once after mount; the `ref` prop is typed `(h: FooHandle) => void` and kept out of the DOM spread |
| Lit | the exposed functions are guaranteed **public** methods on the `LitElement` subclass, callable on the element |

### Getting the handle from the consumer side

Producer-side only: a consumer grabs the handle with each framework's **native** ref mechanism (there is no `.rozie`-level "call a child's method" directive — you write the consumer in the consumer's own framework). Given a component compiled from `Flatpickr.rozie`:

| Target | How the consumer obtains and calls the handle |
| --- | --- |
| Vue | template ref — `<Flatpickr ref="fp" />`, then `fp.value.clear()` |
| React | `const fp = useRef<FlatpickrHandle>(null)`, `<Flatpickr ref={fp} />`, then `fp.current?.clear()` |
| Svelte 5 | `let fp; <Flatpickr bind:this={fp} />`, then `fp.clear()` |
| Angular | `@ViewChild(Flatpickr) fp!: Flatpickr` (or the `viewChild()` signal), then `this.fp.clear()` |
| Solid | callback ref — `<Flatpickr ref={(h) => (handle = h)} />`, then `handle.clear()` (the ref receives the handle object, not the DOM node) |
| Lit | the custom element **is** the handle — `document.querySelector('rozie-flatpickr').clear()`, or hold the element reference |

The handle methods are typed from your `<script>` function signatures: a `<script lang="ts">` function contributes its real signature to the synthesized `FooHandle`; an untyped function becomes `(...args: any[]) => any`.

## Typed `.rozie` imports — per-module declaration sidecars

`import Counter from './Counter.rozie'` is fully typed: the props interface, the `on<Event>?` callbacks, and (when present) the `$expose` handle all flow through to your editor and `tsc`. Rozie does this **without** a `.rozie`-aware TypeScript language plugin — it generates a per-module declaration sidecar.

When the unplugin builds your project, its `buildStart` hook writes a `<Name>.d.rozie.ts` sidecar next to each `<Name>.rozie` (e.g. `Counter.rozie` → `Counter.d.rozie.ts`). TypeScript resolves the `.rozie` import to that sidecar, so you get the component's real types. Generation is automatic on any `vite build` / `vite dev`; the standalone CLI (`rozie build` / `rozie watch`) emits the same sidecars for ahead-of-time pipelines. You never hand-write or edit a sidecar — it carries a `do-not-edit` source-hash header and is regenerated on every build.

Importing the handle type by name is the typed-import payoff for `$expose` components:

```ts
import Dropdown, { type DropdownHandle } from './Dropdown.rozie';
```

`DropdownHandle` is the synthesized interface for the methods the component exposed (see [Getting the handle from the consumer side](#getting-the-handle-from-the-consumer-side) above).

One tsconfig flag governs whether `tsc` honors the sidecar. **Vue's `vue-tsc` honors it under the `moduleResolution: bundler` default; the other sidecar targets' `tsc` requires `"allowArbitraryExtensions": true`** explicitly:

| Target | Typecheck tool | `allowArbitraryExtensions` |
| --- | --- | --- |
| Vue | `vue-tsc` | not needed (bundler default) |
| React / Solid / Lit | `tsc` | **required** |
| Svelte | `tsc` + `svelte-check` | **required** |
| Angular | `tsc` | **N/A — no sidecars** (the disk-cache `.rozie.ts` class is the typed surface) |

Without the flag (on the four non-Vue sidecar targets), `tsc` either emits `TS6263` or silently falls back to a broad `declare module '*.rozie'` wildcard that types every prop as `unknown` — a silent type-lie. The full per-framework setup, the wildcard-shim migration, the gitignore policy, and the Angular exception live in [Install → Typed `.rozie` imports](/guide/install#typed-rozie-imports-per-framework-setup).

**Angular is the exception**: a `.d.rozie.ts` next to a `.rozie` source would shadow the AOT-compiled `.rozie.ts` disk-cache in ngtsc's module resolution and silently break AOT (runtime `JIT compiler unavailable`), so Rozie never writes one there. Angular imports are typed by the disk-cache class itself — props are typed signal inputs, and `$expose` methods are typed public class methods reachable via `@ViewChild`. See [Install → The Angular exception](/guide/install#the-angular-exception-no-sidecars).

Each consumer demo in the repo is the byte-tested proof of its framework's setup: `examples/consumers/react-vite` (React, flag set, wildcard deleted), `vue-vite` (Vue, no flag, `@deprecated` cross-root fallback kept), `svelte-vite` / `lit-vanilla-demo` (flag set, wildcard deleted), `solid-vite` (flag set, `@deprecated` cross-root fallback kept), and `angular-analogjs` (no sidecars — disk-cache types + wildcard fresh-checkout fallback). The sidecar demos each ship a `typed-import.probe` that asserts a correct prop usage compiles and a wrong-typed prop is a genuine error.

## `$onMount` returning a teardown

`$onMount` is a hook; its return value, if a function, runs at unmount. The pattern is identical to React's `useEffect`, but `$onUnmount` is also available as a standalone hook for clarity. Multiple of either colocate with their logic:

```rozie
<script>
// Setup + teardown that belong together — one hook.
$onMount(() => {
  const ctrl = new AbortController()
  fetch('/api/init', { signal: ctrl.signal }).then(...)
  return () => ctrl.abort()
})

// Independent concerns — separate hooks, same component.
$onMount(lockScroll)
$onUnmount(unlockScroll)

$onMount(() => {
  $refs.dialogEl?.focus()
})
</script>
```

Source order is preserved per-target so the framework's lifecycle ordering is predictable.

## `$watch(() => getter, cb)` — react to value transitions

`$watch` is the primitive for "do something whenever this value changes." The getter is what the watcher subscribes to; the callback runs whenever a reactive read inside the getter flips:

```rozie
<script>
$watch(() => $props.open, () => {
  if ($props.open) reposition()
})
</script>
```

### Lazy by default — never fires with the initial value

`$watch(getter, cb)` is **lazy**: the callback runs **only when the watched value changes** after mount, and is **never** invoked with the initial value. This mirrors Vue's default `watch()`, and Rozie holds it uniform across all six targets — react, vue, svelte, angular, solid, and lit all skip the first run.

This is the right tool when `$onMount` is too early. A common case: an element gated by `r-if` is undefined at mount time, but the consumer toggles the gate later — `$watch` fires after the transition, when the ref is finally populated. Because the initial value is skipped, engine-wrapper reconcilers (`instance?.set(...)`) never fire against a not-yet-constructed engine at mount.

Each target compiles the lazy form to its native effect primitive, skipping the first callback invocation:

| Target | Expansion (lazy default) |
| --- | --- |
| Vue | `watch(() => open.value, () => { /* cb */ })` — Vue's native lazy `watch` |
| React | `useEffect(() => { if (_watch0First.current) { _watch0First.current = false; return; } /* cb */ }, [open, /* closure refs */])` — a `useRef(true)` first-run skip; the ref stays **out** of the dep array (refs are exempt from `react-hooks/exhaustive-deps`) |
| Svelte 5 | `$effect(() => { const __v = (() => open)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => { /* cb */ })(__v); }); })` — the first-run flag is read/written inside `untrack` so it does not self-subscribe |
| Angular | `effect(() => { const __v = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } /* cb */ }); })` |
| Solid | `createEffect(on(() => (() => props.open)(), (v) => untrack(() => (/* cb */)(v)), { defer: true }))` — Solid's idiomatic `on(..., { defer: true })` runs the getter to establish tracking but skips the first callback |
| Lit | props route → `if (this.hasUpdated && changedProperties.has('open')) { /* cb */ }` inside `updated()` (`hasUpdated` is `false` on the first cycle); effect route → `effect(...)` from `@lit-labs/preact-signals` with a class-field first-run flag inside `untracked`, handle pushed onto the disconnect-cleanup drain |

### `{ immediate: true }` — opt back into the eager initial fire

Pass `{ immediate: true }` as the third argument to restore an eager fire with the initial value at watcher-setup time (Vue's `{ immediate: true }` semantic):

```rozie
<script>
// Live feed defaults on — start the interval at mount, then re-evaluate
// every time the toggle flips.
$watch(() => $data.liveFeed, (on) => {
  if (on) start() else stop()
}, { immediate: true })
</script>
```

::: warning Ordering relative to `$onMount` is target-dependent
The `immediate` initial fire happens at watcher-setup time, which lands **before** `$onMount` on vue/angular and **after** it on react/svelte/solid/lit. Do **not** use `{ immediate: true }` for engine-instance reconciliation that depends on the engine already existing — that's exactly what the lazy default plus an `$onMount` build is for. Reserve `immediate` for self-contained side effects (timers, derived-state sync) that don't touch an engine handle.
:::

### Change detection is reference equality (`!==`)

The watcher fires when the getter's return value is `!==` its previous value. A getter that returns a **fresh object or array reference every run** therefore fires on **every** reactive tick:

```rozie
<script>
// ⚠️ returns a new object each evaluation → fires every tick
$watch(() => ({ ...$data.config }), cb)

// ✅ watch a stable reference, or a primitive derived from it
$watch(() => $data.config, cb)
</script>
```

This matches Vue's documented `watch` behavior — it's an author-controlled getter shape, not a compiler defect.

Single-getter form only — array-of-getters and the `oldValue` callback parameter are not in scope, and the only supported third-arg option is `{ immediate: true }`. Malformed calls emit a soft `ROZ109` diagnostic and are skipped rather than crashing the compiler.

## `$refs` derived from `ref="..."`

No separate `<refs>` block. Any element with `ref="name"` becomes available as `$refs.name` in both `<script>` and `<template>`. Whatever type the underlying framework gives you (DOM node, component instance), `$refs.name` exposes it directly:

```rozie
<script>
const reposition = () => {
  if (!$refs.panelEl || !$refs.triggerEl) return
  const rect = $refs.triggerEl.getBoundingClientRect()
  Object.assign($refs.panelEl.style, { top: `${rect.bottom}px`, left: `${rect.left}px` })
}

$onMount(() => {
  // Vanilla-JS library integration — direct DOM handle, no framework wrappers.
  // new Popper($refs.triggerEl, $refs.panelEl, { placement: 'bottom-start' })
})
</script>

<template>
  <button ref="triggerEl" @click="toggle">Open</button>
  <div r-if="$props.open" ref="panelEl" class="dropdown-panel"><slot /></div>
</template>
```

This is the integration story for component libraries that wrap vanilla-JS engines (focus-trap, popper, downshift-style state machines): one `$refs.x` access, idiomatic per-target ref handling on the emit side.

Because `$refs` are only populated after mount, reading them in an eagerly-evaluated position — inside a `$computed(...)` body or `$watch` getter, or in a template binding / `{{ }}` interpolation / `r-if` / `r-show` / `r-for` iterable expression — is a compile error (`ROZ123`); read `$refs` inside `$onMount` (or any callback that runs after mount) instead.

### Element-dependent config: the `$onMount` + `r-if` pattern

Some vanilla-JS engines take a DOM element in their *configuration* (not just as their mount target) — flatpickr's `rangePlugin` second input, a Popper anchor element, a focus-trap container. The config has to be built **after** the element exists, and whatever consumes it has to wait for it:

```rozie
<data>{ plugins: null }</data>

<script>
import rangePlugin from 'flatpickr/dist/plugins/rangePlugin'

// ❌ ROZ123 — $refs is not populated yet when a $computed first evaluates:
// const plugins = $computed(() => [rangePlugin({ input: $refs.endInput })])

// ✅ Build element-dependent config in $onMount, where $refs are live:
$onMount(() => {
  $data.plugins = [rangePlugin({ input: $refs.endInput })]
})
</script>

<template>
  <!-- r-if gates the consumer until the config exists -->
  <Flatpickr r-if="$data.plugins" :plugins="$data.plugins" mode="range" />
  <input ref="endInput" />
</template>
```

Prefer passing **elements** over selector strings to third-party libraries wherever their API allows it. Libraries that resolve selector strings internally (flatpickr's `rangePlugin` does `document.querySelector(...)`) cannot see inside shadow DOM — so a selector that works on five targets silently finds nothing on Lit, where your component's template renders into a shadow root. Passing the `$refs` element sidesteps the lookup entirely and behaves identically on all six targets.

## `$snapshot()` — crossing into untyped JS

`$snapshot(x)` is the escape hatch for handing a reactive value to a library that mutates the value's property descriptors. The canonical case is Chart.js's data config: Chart.js internally calls `Object.defineProperty(data, ...)` to install reactive getters, and Svelte 5's `$state` Proxy raises `state_descriptors_fixed` rather than allowing the mutation. The other five targets unwrap to plain values at read time and don't have this problem.

```rozie
<script>
import { Chart } from 'chart.js'

let instance = null

const buildConfig = () => ({
  type: $props.type,
  // Hand a non-reactive snapshot to the engine; Chart.js's internal
  // Object.defineProperty calls otherwise crash on Svelte 5's $state proxy.
  data: $snapshot($props.data),
})

$onMount(() => {
  instance = new Chart($refs.canvasEl, buildConfig())
  return () => instance?.destroy()
})

$watch(() => $props.data, (v) => {
  instance.data = $snapshot(v)
  instance.update()
})
</script>
```

Per-target lowering:

| Target | Expansion |
| --- | --- |
| Svelte 5 | `$state.snapshot(x)` — Svelte 5's native deep-clone primitive |
| Vue | `x` — identity passthrough (refs unwrap via `.value` at read time) |
| React | `x` — identity passthrough (props are plain JS values) |
| Solid | `x` — identity passthrough (signal reads return plain values) |
| Angular | `x` — identity passthrough (signal reads return plain values) |
| Lit | `x` — identity passthrough (`@property` accessors return plain values) |

::: warning Narrow use case
Reach for `$snapshot()` **only** when you're handing a reactive value to library code that mutates the value's property descriptors. Most engine wrappers (SortableJS, Leaflet, TipTap, FullCalendar) hand the library plain primitives or fresh objects built via `.map()` / spreads and never need it. If you're not sure, leave it out — the compile-time and runtime cost on the non-Svelte targets is zero, but on Svelte the snapshot is a deep clone, so blanket-snapshotting every `$props.X` read would burn CPU you don't need to burn.

If you skip it where you do need it, you'll see the Svelte runtime error [`state_descriptors_fixed`](https://svelte.dev/e/state_descriptors_fixed) the first time the library tries to mutate the value.
:::

## `$classSelector()` — handing a class name to a vanilla-JS engine

`$classSelector('grip')` turns an authored class name into a CSS selector that matches the class **as it actually renders at runtime** — on every target. It exists because one of the six targets renames your class names behind your back.

Five targets (Vue, Svelte, Solid, Angular, Lit) keep authored class names literal in the emitted DOM and isolate styles with a scoping attribute, so a class written `grip` renders as `class="grip"`. The React target is the exception: it runs class names through CSS Modules, so `class="grip"` is emitted as `className={styles.grip}` and renders as a hashed class like `_grip_17x98_26`.

That breaks any string that references a class as a *selector* passed to a third-party engine. The triggering case: a SortableJS wrapper that hands `handle: '.grip'` into `new Sortable(el, { handle })`. SortableJS queries `.grip`; React's DOM only has `_grip_17x98_26`, so the handle never matches and React cannot start a drag. The other five targets keep the literal `grip` class and work. `$classSelector` closes that gap — author once, get a correct selector on all six.

```rozie
<components>
{
  SortableList: './SortableList.rozie',
}
</components>

<template>
  <SortableList r-model:items="$data.items" :handle="$classSelector('grip')">
    <template #default="{ item }">
      <span class="grip" aria-label="Drag handle">⋮⋮</span>
      <span>{{ item.label }}</span>
    </template>
  </SortableList>
</template>

<style>
.grip { cursor: grab; }
</style>
```

It works anywhere an expression is valid — a `:prop` binding as above, the `<script>` block, or a `<listeners>` expression.

Per-target lowering:

| Target | Expansion |
| --- | --- |
| Vue | `".grip"` — compile-time literal (classes stay literal in the DOM) |
| Svelte 5 | `".grip"` — compile-time literal |
| Solid | `".grip"` — compile-time literal |
| Angular | `".grip"` — compile-time literal |
| Lit | `".grip"` — compile-time literal |
| React | `"." + styles.grip` — runtime expression (the CSS-Modules hash is only known at build time) |

::: warning Single class token only
The argument must be **one bare CSS class identifier** — `$classSelector('grip')`. It is validated at compile time: a non-string-literal argument, a class that has no rule in the component's own `<style>` scope, or a value containing whitespace, a leading `.` / `#`, or a combinator (`$classSelector('a b')`, `$classSelector('.grip')`, `$classSelector('a > b')`) is a compile error with a code-frame. Referencing an undeclared class also fails — React would otherwise silently emit `".undefined"` — and the diagnostic suggests a near-match class name when one exists.

Need a more specific selector — a descendant or compound selector? The escape hatch is to **declare a dedicated marker class** and `$classSelector` that. An even-empty CSS rule registers the class:

```rozie
<style>
/* a marker class — no visual style, just a stable selector target */
.drag-handle {}
</style>
```

`$classSelector('drag-handle')` then resolves correctly on all six targets. The empty rule survives to the emitted CSS but produces no visual style — it exists purely so the class is a declared, scoped, hashable token.
:::

## `r-external` and `$reconcileAfterDomMutation()` — DOM the framework doesn't own

Engine wrappers — SortableJS, TipTap, Leaflet, FullCalendar, Mapbox, Uppy, … — share an awkward property: the engine physically mutates the DOM (moves nodes, swaps subtrees, paints over a `<canvas>`) under the same `<div>` the framework thinks it controls. The two pictures of the DOM diverge, and the framework's keyed reconciler picks a fight with the engine's node moves on the next render.

Five of the six targets (Vue, React, Svelte, Solid, Angular) cope with this natively — their reconcilers diff against `parent.children` at patch time, so an `e.item.remove() + parent.insertBefore(e.item, …)` "revert the engine's move before writing the new model state" dance is enough. Lit is the exception: lit-html's `repeat` directive keys its parts cache by sentinel-comment node identity, not by a live DOM scan, and the engine's mutations move rendered elements relative to those sentinels in a way the in-source revert can't unwind. Two complementary mechanisms close that gap:

```rozie
<template>
  <div class="rozie-sortable-list" r-external>
    <div r-for="item in $props.items" :key="item.id">
      <slot :item="item" />
    </div>
  </div>
</template>

<script>
import SortableJS from 'sortablejs'

let instance = null

$onMount(() => {
  instance = new SortableJS($el, {
    onUpdate: (e) => {
      e.item.remove()
      $el.insertBefore(e.item, $el.children[e.oldIndex] ?? null)
      const next = [...$props.items]
      const [moved] = next.splice(e.oldIndex, 1)
      next.splice(e.newIndex, 0, moved)
      $model.items = next
      $reconcileAfterDomMutation()
    },
  })
  return () => instance?.destroy()
})
</script>
```

**`r-external`** is a template-side marker. It tells the compiler "third-party code may mutate the children of this element — when something asks to rebuild, rebuild the children but leave THIS element alone." The marker goes on the DOM container the engine binds to. Authors apply it once where the engine attaches; the rest of the template is unaffected.

**`$reconcileAfterDomMutation()`** is the script-side trigger. Call it once at the end of any handler that runs after the engine mutated the DOM (the canonical pattern is the SortableJS `onUpdate` handler, after `$model.items = next`). It tells the framework "the DOM I just touched is out of sync with what you think it is — rebuild now."

The pair is intentional separation: `r-external` is the **location** ("rebuild HERE"); the sigil is the **trigger** ("rebuild NOW"). Without the marker the sigil has nowhere to act; without the sigil the marker never fires.

Per-target lowering:

| Target | `r-external` emit effect | `$reconcileAfterDomMutation()` |
| --- | --- | --- |
| Vue / React / Svelte / Solid / Angular | none — marker stripped during lowering | `void 0` (no-op) |
| Lit | children wrapped in `keyed(this._rozieReconcileSeq ?? 0, …)`; the marked element itself stays outside the wrap | bumps `_rozieReconcileSeq`, calls `requestUpdate()` — `keyed` then disposes stale children and rebuilds with a fresh sentinel structure |

Authors targeting only one framework can leave the marker and sigil in place at zero cost — Lit-specific behavior is gated entirely on the marker's presence, and the other five targets emit byte-identically with or without it.

::: warning When NOT to reach for this
The marker and sigil are escape hatches, not a default. Use them only when a third-party engine actually mutates DOM your component owns. Calling the sigil on every state change on Lit forces a child-tree rebuild and defeats lit-html's keyed diffing; the marker by itself is cheap, but the pairing has a real per-call cost. If you're not integrating with an engine that touches the DOM, you don't need either.
:::

## `$restoreFocus(selector, idx)` — keep focus on a row across keyed-reconciler re-renders

When user source rewrites an array that drives an `r-for`, the framework's keyed reconciler decides what to do with the existing DOM. React, Vue, and Angular preserve identity for items whose key didn't change — focus survives the rewrite naturally. Svelte, Solid, and Lit's keyed reconcilers re-create the row DOM on reorder, dropping focus to `<body>`. That's a real accessibility gap for keyboard-driven reorder UIs — Space-lift / ArrowDown-move / Space-drop is unusable if focus disappears the moment you commit a move.

`$restoreFocus(selector, idx)` closes the gap. After any array write that moves a row, call the sigil with a CSS selector that matches the row elements and the new index the focus should land on:

```rozie
<script>
const onArrowDown = (oldIdx) => {
  const newIdx = oldIdx + 1
  const next = [...$props.items]
  const [moved] = next.splice(oldIdx, 1)
  next.splice(newIdx, 0, moved)
  $model.items = next
  $restoreFocus('[role="listitem"]', newIdx)
}
</script>
```

Per-target lowering:

| Target | Expansion |
| --- | --- |
| React / Vue / Angular | `void 0` — no-op; the keyed reconciler preserves DOM identity, focus survives the rewrite |
| Svelte / Solid / Lit | `queueMicrotask(() => root.querySelectorAll(selector)?.[idx]?.focus?.())` — runs after the framework's microtask reconciliation paint, locates the row at its new index, and re-focuses it |

The first argument is validated at compile time as a string-literal CSS selector — non-literal arguments or unparseable selectors are diagnostic errors with a code frame (ROZ975 / ROZ976). The second argument is any expression evaluating to a non-negative integer; the sigil falls through silently when the resolved element is missing (the row was deleted, the selector didn't match), so it's safe to call after writes that may or may not produce a focus target.

Authors targeting only React, Vue, or Angular can leave the sigil in place at zero cost — it lowers to `void 0`. The cross-target safety net is one of the closing pieces in the keyboard-accessibility story for `examples/SortableList.rozie` and any future engine-wrapper that exposes keyboard reorder.

## `r-bind` / `r-on` — object-spread directives and root-element fallthrough

Component-library wrappers usually want to forward "everything else" — every attribute the consumer set, every listener they bound — onto a real DOM element inside the component. That work today dominates the maintenance budget of cross-framework UI libraries: every wrapper hand-threads `id`, `aria-*`, `data-*`, styles, `class`, and event handlers through a different idiom in each target. Rozie collapses that into two object-spread directives plus two magic accessors.

```rozie
<rozie name="ThemedButton">

<template>
  <button class="btn">
    <slot />
  </button>
</template>

<style>
.btn { padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
</style>
```

A consumer writes:

```rozie
<ThemedButton id="primary" aria-label="Save" :class="'wide'" :disabled="busy"
              @click="save" @mouseenter="trackHover">
  Save
</ThemedButton>
```

Without any `r-bind` or `r-on` in the producer, the consumer's `id`, `aria-label`, `class`, `disabled`, `@click`, and `@mouseenter` all land on the wrapper's root `<button>`. **Attribute fallthrough** (`r-bind`) handles the props; **listener fallthrough** (`r-on`) handles the events. Both are on by default and orthogonal — toggling one does not affect the other.

### Object spread on any element

You don't have to rely on auto-fallthrough. Both directives accept any object expression and apply it to the element they're on:

```rozie
<template>
  <div r-bind="{ id: $props.panelId, role: 'dialog' }">
    <button r-on="{ click: open, mouseenter: prefetch }">Open</button>
  </div>
</template>
```

For a **literal** object whose keys are static event names, Rozie compiles to per-key native syntax — Vue `@click="open"`, React `onClick={open}`, Svelte `on:click={open}`, Angular `(click)="open($event)"`, Solid `onClick={open}`, Lit `@click=${open}` — at zero runtime cost. For a **dynamic** object — `r-on="someObj"` — Rozie routes through a per-target runtime helper (`normalizeListeners` on React/Solid/Vue, the `applyListeners` Svelte 5 action, an inline `Renderer2.listen()` loop on Angular, and the `rozieListeners` lit-html `AsyncDirective` on Lit) that diffs the listener cluster on each update and cleans up on unmount, so no listener ever leaks.

Modifier suffixes on literal `r-on` keys work just like inline `@event`:

```rozie
<button r-on="{ 'click.stop': close, 'input.debounce(300)': onInput }">…</button>
```

Multiple handlers for the same event on the same element — `@click="f1"` plus `r-on="{ click: f2 }"`, or two `r-on`s — **all fire in source order**. Listeners are accumulative. (Silently dropping a handler is worse than calling two; the last-wins behavior that applies to non-`class`/`style` attributes in `r-bind` does **not** apply to listeners.)

### `$attrs` and `$listeners` — the consumer-passed clusters

`$attrs` and `$listeners` are magic accessors that expose what the consumer passed but the component did not declare:

- `$attrs` — every attribute the consumer set that wasn't declared in `<props>`. Member access works (`$attrs.id`, `$attrs.class`).
- `$listeners` — every `@event` the consumer bound. Member access works (`$listeners.click?.(e)`).

Both are available in `<script>` and `<template>`, and both support `r-bind="$attrs"` / `r-on="$listeners"` to relocate the consumer-passed cluster onto a specific element by hand.

### `inherit-attrs="false"` / `inherit-listeners="false"` — opt out of auto-fallthrough

By default the consumer-passed clusters land on the component's single root element. To take manual control, flip the flag on the `<rozie>` opening tag and place the directive yourself:

```rozie
<rozie name="ThemedButtonAllManual" inherit-attrs="false" inherit-listeners="false">

<template>
  <span class="theme-wrap">
    <button class="btn" r-bind="$attrs" r-on="$listeners">
      <slot />
    </button>
  </span>
</template>
```

Here the consumer-passed attrs and listeners apply to the inner `<button>`, not the outer `<span>` wrapper. The two flags are **fully independent** — turn off attribute fallthrough while keeping listener fallthrough on, or vice versa, and toggling one does not affect the other. The four-corner matrix is proven across all six targets via the `examples/ThemedButton*.rozie` fixtures:

| Variant | `inherit-attrs` | `inherit-listeners` | Where the cluster lands |
| --- | --- | --- | --- |
| `ThemedButton` | default (`true`) | default (`true`) | Both auto-fall through to the root `<button>` |
| `ThemedButtonManual` | `false` | default (`true`) | Attrs via explicit `r-bind="$attrs"`; listeners still auto-fall through |
| `ThemedButtonListenersManual` | default (`true`) | `false` | Listeners via explicit `r-on="$listeners"`; attrs still auto-fall through |
| `ThemedButtonAllManual` | `false` | `false` | Both placed explicitly via `r-bind="$attrs"` and `r-on="$listeners"` |

A component with more than one root element and `inherit-attrs` / `inherit-listeners` not set to `false` is a compile error with a code frame (`ROZ970` for attrs, `ROZ973` for listeners) — the auto-fallthrough machinery has no unambiguous target. Reference `$attrs` or `$listeners` manually while leaving the flag on and you'll see a soft warning (`ROZ971` / `ROZ974`) nudging you toward the explicit opt-out, since double application is legal but usually a mistake.

### When does this matter?

Cross-framework wrappers around vanilla-JS engines — `flatpickr`, `Leaflet`, `Mapbox`, `TipTap`, `Chart.js`, `Sortable`, `FullCalendar`. Today you hand-write per-framework wrapper components, threading `id` / `aria-*` / `data-*` / styles / handlers / refs through a different idiom in each target. With Rozie you write the wrapper once: fallthrough handles the attribute and listener clusters, `$classSelector` handles class-name-as-selector strings (`handle: $classSelector('grip')`), `$refs` handles direct DOM access, and the same source ships React, Vue, Svelte, Angular, Solid, and Lit consumers.

## Slots with scoped params

Slot content can receive parameters from the component, and consumers can destructure them with `#name="{ … }"`. Fallback content is just children of the `<slot>` tag — same shape as Vue, same emit semantics as Svelte snippets / React render props / Angular `*ngTemplateOutlet`:

```rozie
<template>
<ul>
  <li r-for="item in $props.items" :key="item.id">
    <slot :item="item" :toggle="() => toggle(item.id)" :remove="() => remove(item.id)">
      <!-- Default row renderer if consumer doesn't supply one. -->
      <label>
        <input type="checkbox" :checked="item.done" @change="toggle(item.id)" />
        <span>{{ item.text }}</span>
      </label>
      <button @click="remove(item.id)" aria-label="Remove">×</button>
    </slot>
  </li>
</ul>
</template>
```

Consumers can rename the destructured params to match local naming — Vue's `<template #default="{ item: row }">` form works identically:

```rozie
<template>
  <SortableList r-model:items="$data.columns" itemKey="id">
    <template #default="{ item: column }">
      <KanbanColumn :cards="column.cards" :title="column.title" />
    </template>
  </SortableList>
</template>
```

The slot key on the producer (`item`) stays the binding point; `column` is the local name the consumer sees inside the fill body. Each target gets the right destructure shape — React, Vue, Svelte, and Solid emit JS-style `({ item: column }) =>` rename; Angular emits `<ng-template let-column="item">` (local var on the left, slot key on the right); Lit's shadow-DOM ctx accessor rewrites body references from the local binding (`column`) to the slot key (`item`).

::: tip Documented divergence
Rozie's compatibility bar is "high percentage" parity, not 100%. Slots are the area with the largest documented divergence — React consumers see a render-prop-flavored API (`children?: (ctx) => ReactNode`, `renderHeader?: (ctx) => ReactNode`) rather than children-as-JSX. This is called out in [`docs/guide/why.md`](/guide/why) and is accepted as a v1 trade-off.
:::

## `:root { }` — the global escape hatch in scoped styles

`<style>` is scoped by default. Anything inside a `:root { }` selector is emitted globally — useful for CSS variables, font definitions, or anything else that legitimately belongs on the document:

```rozie
<style>
/* Scoped — only applies to this component's elements. */
.dropdown { position: relative; display: inline-block; }
.dropdown-panel {
  z-index: var(--rozie-dropdown-z, 1000);
  background: white;
}

/* Unscoped — emitted as a top-level :root { } rule. */
:root {
  --rozie-dropdown-z: 1000;
}
</style>
```

Each target picks the right escape hatch: Vue gets a sibling unscoped `<style>` block, Svelte gets `:global(:root)`, Angular gets `::ng-deep :root`, React/Solid get a separate `.global.css` file imported next to the module CSS, and Lit — whose `static styles` are shadow-DOM-scoped by default — gets the `:root` rules injected into the document via an `injectGlobalStyles` runtime call.

## `:deep()` — reaching into child components from scoped styles

`:root` is the global escape hatch; `:deep()` is the **cross-component** one. Because `<style>` is scoped per component, a parent's selector like `.board > .rozie-sortable-list` can never match the child SortableList's rendered DOM — every component has its own scope attribute and the parent's selector goes looking for the parent's marker on the child's elements. `:deep(...)` lifts the inner selector out of the scope so it reaches the child's DOM directly:

```rozie
<template>
  <div class="board">
    <SortableList :items="$data.columns">…</SortableList>
  </div>
</template>

<style>
/* Reach into SortableList to lay its outer wrapper out as a grid of columns. */
.board :deep(.rozie-sortable-list) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
</style>
```

The outer compound (`.board`) stays scoped to this component; only what's inside `:deep(...)` is hoisted out. Combinators inside the parentheses (`.a > .b`) and comma-separated branches (`:deep(.a, .b)`) work the way Vue's `<style scoped>` handles them.

Each target picks the right translation:

- **React**: scope attribute appended to the outer compound only, AND the deep-lifted part wrapped in `:global(...)` so it survives CSS Modules — `.board[data-rozie-s-<hash>] :global(.rozie-sortable-list) { … }`. Without the `:global` wrap the inner class name would be module-hashed at build time and never match the producer-rendered class. (Class names *inside* `:global()` are left literal; the `:global` wrap is a CSS Modules convention, not a CSS spec pseudo, so it's invisible at runtime.)
- **Solid**: scope attribute appended to the outer compound only — `.board[data-rozie-s-<hash>] .rozie-sortable-list { … }`. Solid emits CSS via a runtime style-inject (no CSS Modules pipeline), so the inner class name survives literally and needs no extra wrap.
- **Vue**: `:deep()` is passed through verbatim. Vue 3.4+ `<style scoped>` understands the selector natively and applies its `[data-v-<hash>]` lowering downstream.
- **Svelte**: same compound-scope rewrite as React, wrapped in Svelte 5's `:global { … }` so Svelte's native scoper doesn't interfere.
- **Angular**: lowered to `::ng-deep` — `.board ::ng-deep .rozie-sortable-list { … }`. Angular's view encapsulation honors `::ng-deep` as the supported pierce mechanism (marked deprecated in the docs, but still the standard idiom for this exact case).
- **Lit**: the scope attribute is lifted exactly like React/Solid, so the selector works **within one shadow root**. It does **not** cross shadow-DOM boundaries — each Lit producer renders in its own shadow root, and shadow boundaries are opaque to outside CSS. Reaching *across* a Lit child's shadow boundary is [`::part()`](#part-—-cross-shadow-styling-for-lit-children) territory (see the next section); for influencing a Lit child's appearance without exposing a part, parent-side CSS variables remain a working alternative.

## `::part()` — cross-shadow styling for Lit children

`:deep()` reaches into a child's DOM **within one shadow root**. On Lit, where each component renders inside its *own* shadow root, `:deep()` stops at the child's shadow boundary — shadow boundaries are opaque to outside CSS. `::part()` is the W3C standards-track mechanism ([CSS Shadow Parts L1](https://www.w3.org/TR/css-shadow-parts-1/)) for the one thing `:deep()` cannot do on Lit: style an element **across** a child's shadow boundary. It is the only cross-shadow-piercing selector that is not on a deprecation track (`::shadow`, `/deep/`, `>>>` were removed; `::ng-deep` is deprecated).

It is a two-sided producer/consumer contract:

- **Producer** — tag the shadow element you want to expose with the standard HTML <span v-pre>`part="<name>"`</span> attribute. Part names are a **public API**: they are emitted **literally**, never scope-hashed.
- **Consumer** — style the exposed element with `<child-selector>::part(<name>)`. The part name on the consumer side must match the producer's `part=` name byte-for-byte.

```rozie
<!-- Producer: PartCard.rozie -->
<template>
  <div class="card-body" part="body">
    <slot/>
  </div>
</template>
```

```rozie
<!-- Consumer: PartCardConsumer.rozie -->
<template>
  <PartCard>Cross-shadow styled body content.</PartCard>
</template>

<style>
/* Reaches the child's part="body" element across the Lit shadow boundary. */
PartCard::part(body) {
  background: #fde68a;
  border: 2px solid #b45309;
}
</style>
```

### Cross-target translation

`::part()` only has meaning across a shadow boundary, so it is **load-bearing on Lit and a no-op everywhere else** — the other five targets have no shadow boundary, so a cross-shadow rule would be meaningless (and emitting it unscoped would leak broken global CSS). The rule is therefore dropped on those targets, and the child renders with its own producer styles only.

| Target | Consumer `::part()` rule | Producer `part="..."` attribute |
| --- | --- | --- |
| **Lit** | Emitted as the cross-shadow rule `<child-tag>[data-rozie-s-<hash>]::part(<name>)` — e.g. `rozie-part-card[data-rozie-s-7f4fb92a]::part(body)`. The scope attribute lands on the child-tag compound **before** `::part` so the rule is confined to *this* consumer's scoped child invocation; `::part` then pierces the child's one shadow boundary. The consumer's `static styles` already reach the child (it renders inside the consumer's shadow root), so no extra runtime is needed. | Emitted verbatim into the shadow template — addressable by the consumer's `::part(<name>)`. |
| **React** | Dropped (no-op). | Benign standard HTML attribute (`part="body"`). |
| **Solid** | Dropped (no-op). | Benign standard HTML attribute. |
| **Vue** | Dropped (no-op). | Benign standard HTML attribute. |
| **Svelte** | Dropped (no-op). | Benign standard HTML attribute. |
| **Angular** | Dropped (no-op). | Benign standard HTML attribute. |

### `::part()` vs `:deep()`

They solve different problems and are **not** interchangeable:

- `:deep()` is the **intra-scope** reach. It lifts the inner selector out of the parent's scope attribute so a parent styles a child's rendered DOM *within the same shadow root* — and it matches the child element **and its descendants** like any ordinary selector. On Lit it works inside one shadow root but cannot cross a shadow boundary. `:deep()` keeps its existing six-target behavior unchanged.
- `::part()` is the **only cross-shadow-boundary** reach. On Lit it pierces the child's shadow boundary to style the exposed part — but it matches **only** the element the producer tagged with `part=`, not that element's descendants (the part name is a flat, explicit, literal contract — there is no auto-derivation from class names). It is Lit-only-visible; the other five targets strip it.

In short: use `:deep()` to reach a child's DOM that lives in the same shadow tree; use `::part()` to reach across a Lit child's shadow boundary into an element the producer has explicitly exposed.

::: warning Give a `::part()` rule its own selector
Write a `::part()` selector as its own rule — do **not** combine it with non-`::part()` selectors in a single comma-separated list (e.g. `Child::part(body), .fallback { … }`). Because the five non-Lit targets drop any rule whose selector contains `::part()` as a whole, a sibling `.fallback` branch in the same rule would be dropped along with it on those targets. Splitting them into two rules keeps the non-`::part()` branch on every target.
:::

## `<style lang="scss">` — SCSS, compiled at build time

A `<style>` block opts into SCSS with `lang="scss"`. Rozie compiles it to plain CSS at build time — nesting, `$variables`, `@mixin`/`@include`, `&` parent-refs, `@if`/`@each`/`@for`, `@function`, `%placeholder`/`@extend`, `#{}` interpolation and the built-in `sass:` modules all resolve away before emit:

```rozie
<style lang="scss">
$divider: #ededed;

@mixin reset-list {
  list-style: none;
  margin: 0;
}

.list {
  border: 1px solid $divider;

  ul { @include reset-list; }
  li + li { border-top: 1px solid $divider; }
  &:hover { background: #f5f5f5; }
}
</style>
```

The compiled CSS flows through the **same scoping pass** as a plain `<style>`: it is scoped by default, and the `:root { }` global escape hatch above still works unchanged. SCSS here is a build-time preprocessing step, not a new runtime — because everything lowers to plain CSS before emit, all six targets receive byte-identical stylesheets.

`sass` (dart-sass) is an **optional peer dependency**. A plain-CSS component library never pulls it into its dependency tree; a library that uses `lang="scss"` declares it once (`pnpm add -D sass`). Compiling a `lang="scss"` component with `sass` absent is a compile error with a source-located code frame — not a silent fallback to raw SCSS. Invalid SCSS likewise surfaces as a diagnostic pointing inside the offending `<style>` block, never an uncaught throw.

v1 supports `lang="scss"` only. `lang="less"` is a deliberate deferral — the optional-peer model and the generic block-`lang=` substrate make it a clean later addition; today an unrecognized `lang` value is itself a compile error.

## Smaller wins

A grab-bag of little decisions that add up:

- **`r-*` instead of `v-*`**. Deliberately distinct from Vue so `.rozie` files are visually unambiguous. Same vocabulary (`r-if`, `r-else`, `r-for`, `r-model`, `r-show`), no aliasing confusion in mixed-framework codebases.
- **<span v-pre>`{{ }}`</span> allowed inside plain attribute values**. Vue forbids <span v-pre>`<a href="{{ url }}">`</span> and forces `:href="url"`. Rozie's template parser handles both forms, picking the cheaper emit path automatically.
- **Rich inline JS expressions in handlers**. `@click="$props.closeOnBackdrop && close()"` is fine; you're not limited to Vue's simple-expression form or method-name-only handlers.
- **Setup-once reactivity**. Closures in `<script>` run once at component setup, not per render. This matches Vue/Svelte/Solid expectations and means a counter like `let n = 0; const incr = () => n++` works the way a non-React developer would expect — no `useCallback`/dependency-array gymnastics in the source.
- **Per-statement source maps**. Errors thrown by emitted code map back to the original `.rozie` line, including statements inside `$computed`, `<listeners>` handlers, and embedded template expressions.
- **Optional TypeScript**. `.rozie` source can be plain JS; emitted output is `.tsx` / `.ts` / `.vue` / `.svelte` regardless, with prop types synthesized from `<props>` shapes.
- **Web components, same source**. The Lit target emits a standards-based custom element from the same `.rozie` file — a framework-agnostic consumer that drops into any HTML page, no build step required at the consumption site.
- **Auto kebab/camel-case prop conversion**. `:on-close="..."` in the template lines up with `onClose` in `<props>`. Angular's selector-form tags and Vue's kebab-template idiom both fall out for free.
- **HTML comments work everywhere**. `<!-- ... -->` inside `<template>` is preserved through the parse and stripped from emit so the comment doesn't leak into a Vue render function or a React `JSX` text node.

## Next

See [Examples](/examples/) for the full gallery — seven reference components, each with byte-verbatim output across all six targets, plus a feature index for jumping straight to whichever idiom you want to see in action.

Hit a `ROZxxx` code in your terminal? The [Diagnostics reference](/reference/diagnostics) lists every diagnostic code — generated from the compiler source, so it's always current — with its severity and cause.
