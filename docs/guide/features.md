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

### One HTML rule survives: escape a literal `</script>`

Block bodies are real JS (or CSS), but the `.rozie` file itself is still HTML-shaped — and Rozie keeps HTML's one parsing rule about that: **a block ends at the first literal close sequence of its own tag**, even when that sequence sits inside a JS string or comment. This is exactly how `<script>` behaves in plain HTML, in `.vue` SFCs, and in `.svelte` files.

So this breaks — the string's `</script>` ends the block early:

```rozie
<script>
// ✗ ROZ005 — the string contains the block's own close sequence
const embedCode = '<script src="https://cdn.example.com/widget.js"></script>';
</script>
```

Rozie reports `ROZ005` with a code frame pointing at the offending sequence. The fix is the same escape HTML requires:

```rozie
<script>
// ✓ the escaped form is the identical JS string value
const embedCode = '<script src="https://cdn.example.com/widget.js"><\/script>';
</script>
```

`'<\/script>'` is byte-for-byte the same runtime string (`\/` is just `/` in JS), the block parses correctly, and the escape survives verbatim into the emitted Vue and Svelte SFCs — which need it for exactly the same reason.

The rule applies to every block uniformly: `</style>` inside `<style>`, `</props>` inside `<props>`, and so on. Other angle-bracket content — `<div>` in template literals, `a < b` comparisons, `Array<Item>` generics — is fine.

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

See the [Flatpickr forms recipe](/components/flatpickr#forms-drop-in) for a worked example against a real engine-wrapper component.

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

## `$provide(key, value)` / `$inject(key, fallback?)` → cross-component context everywhere

Compound components — `Tabs`/`Tab`, `Select`/`Option`, `Accordion`/`Item`, `Form`/`Field` — share a structural problem: a parent has to hand a value to a deep descendant through middle components that know nothing about it. Threading it down as props (prop-drilling) couples every passthrough to a contract it doesn't care about. Every framework already solves this with a context mechanism — Vue `provide`/`inject`, Svelte `setContext`/`getContext`, React/Solid `Context.Provider` + `useContext`, Angular DI `providers` + `inject`, Lit `@lit/context` — but each spells it differently. Rozie gives you one pair of sigils that lowers to each.

Declare the value once in the provider; read it anywhere below, through any unaware passthrough:

```rozie
<!-- ThemeProvider.rozie — publishes a value -->
<script>
let color = 'red'
const NEXT = { red: 'green', green: 'blue', blue: 'red' }
const cycle = () => { color = NEXT[color] }

// A getter keeps `color` a LIVE reference — see the rule below.
$provide('theme', { get color() { return color }, cycle })
</script>
<template><slot /></template>
```

```rozie
<!-- ThemeButton.rozie — a deep descendant, reached through any passthrough -->
<script>
const theme = $inject('theme')
</script>
<template>
  <button @click="theme.cycle()">{{ theme.color }}</button>
</template>
```

`ThemeButton` can sit any number of unaware components deep — `<ThemeProvider><Panel><Toolbar><ThemeButton/></Toolbar></Panel></ThemeProvider>` — and still resolve `theme`. The middle components carry no `theme` prop. A click on the button cycles the color and the new value reaches the descendant reactively, in place.

- **`$provide(key, value)`** — a top-level `<script>` **statement**. `key` must be a **string literal** (no runtime-computed keys — see ROZ129). `value` may be reactive: a `$data` field, a `$computed`, an object carrying accessors, or an engine handle. Multiple `$provide` calls are allowed for distinct keys.
- **`$inject(key, fallback?)`** — an **expression** that must bind a local `const` (`const theme = $inject('theme')` — see ROZ132). `key` is a string literal (ROZ130). It returns the nearest provided value and is usable in setup, template, and reactive contexts. With a `fallback`, the returned type is inferred from it; without one, v1 types the result as `any` (a typed `<context>` declaration block is a later phase).

Each target lowers the pair to its native context idiom. Components with no `$provide`/`$inject` emit byte-for-byte unchanged:

| Target | `$provide('k', v)` | `$inject('k', fallback)` |
| --- | --- | --- |
| Vue | `provide('k', v)` (imported from `vue`) | `inject('k', fallback)` |
| Svelte 5 | `setContext('k', v)` at init | `getContext('k')` |
| React | the returned JSX is wrapped in `<C.Provider value={v}>` where `C = rozieContext('k')` | `useContext(rozieContext('k'))` |
| Solid | the returned JSX is wrapped in `<C.Provider value={v}>` where `C = rozieContext('k')` | `useContext(rozieContext('k'))` |
| Angular | `@Component({ providers: [{ provide: rozieToken('k'), useFactory: () => v }] })` — `providers`, **not** `viewProviders`, so projected (`<ng-content>`) children resolve it | `inject(rozieToken('k'))` |
| Lit | `new ContextProvider(this, { context: C, initialValue: v })` + `setValue` on change, where `C = createContext(Symbol.for('rozie:k'))` | `new ContextConsumer(this, { context: C, subscribe: true })` |

The key identity is what lets a *separately-compiled* provider and consumer find each other. Vue and Svelte use the literal string key; Lit uses a process-global `Symbol.for('rozie:' + key)`. React, Solid, and Angular back their token in a `globalThis` registry keyed by your string — `rozieContext(key)` dedupes a single `Context` object, `rozieToken(key)` a single Angular `InjectionToken` — so two independently-built modules resolve the *same* token. `rozieContext` ships from `@rozie/runtime-react` and `@rozie/runtime-solid`; Angular emits a tiny inline `globalThis`-backed `rozieToken` helper (no extra peer dependency); Lit consumers add `@lit/context` as a peer dependency.

### Provide a live reference, not a snapshot

This is the one author rule that governs whether context is reactive. **Provide a value that carries live references — a getter, a `$computed` accessor, or a signal — never a snapshotted primitive.** Every target's reactivity rides on the consumer reading through that live reference at the moment it renders. The getter form above is correct:

```rozie
$provide('theme', { get color() { return color }, cycle })   // ✓ reactive: reads `color` live
```

A bare primitive is **valid code but non-reactive on every target** — the descendant sees the value frozen at provide time:

```rozie
$provide('theme', color)   // ⚠ compiles, but the consumer never sees later changes
```

Both forms compile cleanly — a bare primitive is sometimes exactly what you want (a constant config object), so Rozie does not warn on it. But if you expect a `$inject` consumer to update when the source value changes, the provided value must expose a live accessor. This is the mirror image of [`$snapshot()`](#snapshot-—-crossing-into-untyped-js), which deliberately freezes a value crossing into untyped JS; context wants the opposite.

### The Lit async edge — guard against `undefined` on first paint

Lit is the one documented parity divergence. `@lit/context`'s `ContextConsumer` is event-driven: the consumer fires a `context-request` event that bubbles up to the provider, and the provided value only arrives once that round-trip resolves. On the **first paint, before the element is connected and the request has resolved, the injected value can be `undefined`** — even when a provider exists higher up. The other five targets resolve context synchronously during setup and have no such window.

Author a read that tolerates the gap — optional chaining, an `r-if` guard, or a fallback:

```rozie
<template>
  <!-- ✓ survives the first-paint window on Lit; harmless no-op on the other five -->
  <button @click="theme?.cycle()">{{ theme?.color }}</button>
</template>
```

The compiled Lit consumer emits a null-guard for you, but template reads you write by hand should null-guard too. On the five synchronous targets this guard is a no-op; on Lit it is what keeps the first render from throwing.

### Diagnostics

Four compile-time diagnostics catch malformed `$provide`/`$inject` forms (each collected, not thrown — `compile()` reports them all rather than stopping at the first):

| Code | When |
| --- | --- |
| `ROZ129` `INVALID_PROVIDE_KEY` | `$provide`'s key is not a string literal (runtime-computed keys are forbidden) |
| `ROZ130` `INVALID_INJECT_KEY` | `$inject`'s key is not a string literal |
| `ROZ131` `PROVIDE_NOT_STATEMENT` | `$provide(...)` used in expression position — it must be a top-level `<script>` statement |
| `ROZ132` `INJECT_UNBOUND` | `$inject(...)` not bound to a `const x = $inject(...)` |

Both `$provide` and `$inject` are reserved identifiers — naming a `<data>` field or `r-for` loop variable after either is `ROZ202`. See the [Diagnostics reference](/reference/diagnostics) for the full code table.

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

## `$computed(() => ...)` — derived reactive values

`$computed(() => expr)` declares a value derived from other reactive state — re-evaluated automatically whenever a reactive read inside the getter changes. Each target compiles it to its native derived-reactivity primitive, and **you read it by its bare name** everywhere — in templates, interpolations, and `<script>`:

```rozie
<data>{ query: '', options: [] }</data>

<script>
const visibleOptions = $computed(() =>
  $data.options.filter((o) => o.label.includes($data.query))
)

const hasMatches = $computed(() => visibleOptions.length > 0)
</script>

<template>
  <ul>
    <li r-for="opt in visibleOptions" :key="opt.id">{{ opt.label }}</li>
  </ul>
  <p r-if="!hasMatches">No matches</p>
</template>
```

Note the bare reads — `visibleOptions`, never `visibleOptions()`. The emitter rewrites each bare reference to the per-target access form for you, so the same source reads correctly on all six:

| Target | Primitive | Bare read `visibleOptions` lowers to |
| --- | --- | --- |
| Vue | `computed()` → `Ref<T>` | `visibleOptions.value` |
| React | inlined `useMemo` value | the memoized value (value form) |
| Svelte 5 | `$derived` | the derived value (value form) |
| Angular | `computed()` signal | `this.visibleOptions()` |
| Solid | `createMemo` → **accessor function** | `visibleOptions()` |
| Lit | preact-signal | `this.visibleOptions.value` |

### Read it bare — don't alias the memo into a local

There is one target-divergence to know about, and it has a clean rule that sidesteps it entirely: **never alias a `$computed` into a local in `<script>` and then index or call the alias.** The emitter rewrites *bare reads* of a computed name, but it does **not** rewrite the right-hand side of an assignment — and on Solid a `$computed` is backed by a `createMemo` **accessor function**, not a value:

```rozie
<script>
// ❌ Target-divergent — the alias captures different things per target:
const o = visibleOptions
// On React/Vue/Svelte/Angular/Lit, `o` is the derived VALUE → `o.length` works.
// On Solid, `o` is the memo ACCESSOR FUNCTION → `o.length` is `undefined`
//   and `o.findIndex(...)` / `o[i]` are type errors (TS2339) — you'd have to
//   write `o()` on Solid and bare `o` on the other five. There is no single
//   source form that works on all six.
const first = o[0]
</script>
```

The same divergence bites if you pass a `$computed` name as a plain value into other code that indexes or iterates it. As long as you only read the computed **bare** (in a template, an interpolation, an `r-for` iterable, or a simple expression that the emitter rewrites), you never hit this — the access form is handled for you.

### When you need to alias and index — use a plain function

If you genuinely need a derived value that you alias into a local and then index, call, or pass around in handler/`<script>` logic, **don't reach for `$computed` — write a plain function and call it with `()` everywhere.** A normal function is uniform across all six targets (it's a function on every one of them), so `const o = currentOptions()` followed by `o.length` / `o.findIndex(...)` behaves identically:

```rozie
<data>{ query: '', options: [] }</data>

<script>
// ✅ A plain function — uniform on all six. Call it with () at every use site,
//    in <script> and in templates alike.
const currentOptions = () =>
  $data.options.filter((o) => o.label.includes($data.query))

const selectFirst = () => {
  const o = currentOptions()        // a value on every target
  if (o.length) select(o[0])        // indexes/iterates identically everywhere
}
</script>

<template>
  <li r-for="opt in currentOptions()" :key="opt.id">{{ opt.label }}</li>
</template>
```

The trade-off is that a plain function is **not** memoized — it re-runs at every read instead of caching until a dependency changes. For most derivations (filtering a list, computing a flag) that cost is negligible, and the gain is one access form that reads the same on all six targets. Reserve `$computed` for the values you read **bare** and never alias-then-index; reach for a plain function the moment you need to capture a derived value in a local and operate on it.

::: tip Rule of thumb
Read a `$computed` bare (template, interpolation, simple expression) and the access form is handled for you on all six targets. The moment you want to alias it into a local and index/call/iterate that local, switch to a plain function called with `()` — it's the clearer, target-uniform form.
:::

Reading `$refs` inside a `$computed` body is a compile error (`ROZ123`) for the same reason it is in a `$watch` getter — the computed evaluates eagerly, before the ref is populated. See [`$refs`](#refs-derived-from-ref) below.

## `$memo(fn, keyFn)` — a memoized plain function, uniform on all six

The plain-function escape hatch above (`## $computed` § "When you need to alias and index") trades memoization for a single, target-uniform access form — fine for a cheap filter, wasteful for an O(N) re-map called on every keystroke or scroll tick. `$memo(fn, keyFn)` gives you both: a plain function you call with `()` everywhere (uniform on all six, safe to alias/index/iterate), memoized against a **reference-keyed** cache so it only re-runs `fn` when `keyFn`'s inputs actually change identity:

```rozie
<props>{ items: { type: Array, default: () => [] } }</props>
<data>{ query: '' }</data>

<script>
const filtered = $memo(
  // fn — the expensive computation, run only on a cache MISS.
  () => $props.items.filter((item) => item.includes($data.query)),
  // keyFn — read EVERY reactive input fn depends on, unconditionally.
  () => [$props.items, $data.query],
)
</script>

<template>
  <li r-for="item in filtered()" :key="item">{{ item }}</li>
</template>
```

`$memo` must be bound to a **top-level `const`** with exactly **two arrow-function arguments** — `fn` (the computation) and `keyFn` (the cache key, returning an array). Anything else — a `let`-bound declaration, the wrong number of arguments, a call nested inside a function — is a compile error (`ROZ146`) rather than a silently-broken cache.

### The reference-key contract

On a call, `$memo` first evaluates `keyFn()` and compares the result **element-by-element by reference/value equality (`===`)** against the previous call's key. If every element matches, `fn` does **not** re-run — the previous return value is reused as-is (no re-map, no new object identities). On any mismatch, `fn()` runs and the new key + value are cached for next time.

::: warning keyFn must read every reactive input fn depends on
This is the one rule that makes `$memo` safe: **`keyFn` must read — unconditionally, every call — every piece of reactive state that `fn` reads.** `keyFn` is evaluated *before* the cache-hit check, on every single call, which is exactly what makes it the fine-grained reactive **subscription** surface on Solid/Svelte/Vue (a signal/rune/ref read only counts as a subscription if it actually executes). If `keyFn` under-reads relative to `fn` — skips a prop or data field `fn` depends on — the cache will return a stale value on a change `keyFn` never noticed, and on Solid/Svelte/Vue the memoized function will stop re-running at all for that input. Read every input `fn` touches, even ones `fn` only reads on a code path that IS taken this call — array/object references compare by identity, so passing `$props.items` (the array reference) rather than something derived from it is what makes an unmodified list a cache hit.
:::

`$memo` is deliberately **not** a `$computed`: a `$computed` re-subscribes to every reactive read inside its getter and re-runs on any of them changing (and on Vue re-trips the reactive Proxy traps on every dependent read) — the wrong shape when the goal is specifically to *avoid* re-running on unrelated reactive churn. `$memo`'s cache key is a plain value/reference comparison, not a reactive subscription, so only a real key mismatch triggers a re-run.

### Per-target lowering

`$memo` expands in the SHARED core compiler — before any per-target emission — into two ordinary declarations: a member-mutated cache object and the wrapper function you call. There is no per-target `$memo` runtime:

| Target | Lowering |
| --- | --- |
| React | The cache object is a top-level `const` that gets member-mutated on every miss — the **existing** fresh-instance-stabilization pass (the same one that fixes `const seen = new Set()` dedupe guards) detects this shape automatically and wraps it in `useMemo(() => ({...}), [])`, so the cache persists across renders. The wrapper stays a plain function, called `()` — the same idiom as `filteredOptions()` today. |
| Vue / Svelte / Solid / Angular / Lit | Setup runs once, so the cache const and the wrapper function are both ordinary top-level `const`s — no wrapping needed. |

Because the expansion is a pure core AST transform, a `.rozie` file with no `$memo` call compiles **byte-identically** whether or not the pass runs — `$memo` adds zero overhead and zero drift to every existing component.

Reach for `$memo` when a plain-function derivation is expensive (an O(N) filter/map over a large list, called from a hot path like windowed scrolling or keyboard navigation) and the inputs it depends on don't change every call. For a cheap derivation, the plain-function form above is simpler and the memoization overhead isn't worth it.

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

::: tip Need an independent copy, not an unwrap?
`$snapshot()` is an **unwrap**, not a copy — on the five non-Svelte targets it hands back the same value you passed in. To freeze the current state so a later mutation can't reach back into it (undo/redo history, scratch snapshots), reach for [`$clone()`](#clone-x-—-an-independent-deep-copy-of-reactive-state) below instead.
:::

## `$clone(x)` — an independent deep copy of reactive state

`$clone(x)` produces an **independent, deeply-copied** snapshot of a reactive value — safe to take on a `reactive()` / `$state` / signal-backed object on **every** target. It is the right primitive whenever you need to *freeze the current state* so that a later mutation of the live state doesn't reach back into the copy you stashed: undo/redo history stacks, cross-render scratch snapshots, "remember what this looked like before the drag."

```rozie
<data>{ graph: { nodes: [], connections: [] }, history: [] }</data>

<script>
const currentGraph = $computed(() => $data.graph)

// Before mutating the live graph (e.g. on drag-start), push a frozen,
// independent copy onto the undo stack. A later edit to $data.graph
// can't reach back and corrupt this history entry.
const pushUndo = () => {
  $data.history = [...$data.history, $clone(currentGraph())]
}

const undo = () => {
  const prev = $data.history.at(-1)
  if (prev) $data.graph = prev   // the frozen copy, untouched by edits since
}
</script>
```

### The footgun it closes

The naive way to take that snapshot is `structuredClone(x)` — and it works on React, Solid, Angular, and Lit, where reads return plain JS values. But a bare `structuredClone(<reactive value>)` **throws** (`DataCloneError: … could not be cloned`) on a Vue `reactive()` Proxy and a Svelte 5 `$state` Proxy. The result is a brutally **target-asymmetric** trap: your history stack fills correctly on four targets and is silently empty (or the component crashes) on Vue and Svelte only — the two targets a Vue-flavored author is least expecting to break.

`$clone` exists to erase that asymmetry. One author-side call lowers to the right deep-copy primitive on each target, so it produces an independent copy everywhere:

| Target | Expansion |
| --- | --- |
| Vue | `rozieDeepClone(x)` — from `@rozie/runtime-vue`; a recursive proxy-safe `structuredClone(deepToRaw(x))` that de-proxies **nested** `reactive()`/`ref` values, not just a top-level `reactive()` tree |
| Svelte 5 | `$state.snapshot(x)` — Svelte's native recursive de-proxy + deep clone |
| React | `structuredClone(x)` |
| Solid | `structuredClone(x)` |
| Angular | `structuredClone(x)` |
| Lit | `structuredClone(x)` |

Because the copy goes through the structured-clone algorithm (not lossy `JSON.parse(JSON.stringify(x))`), it preserves `Date`, `Map`, and `Set` rather than mangling them to ISO strings and `{}`. `$clone(null)` returns `null` on all six.

::: warning Why a single `toRaw` isn't enough on Vue
The Vue lowering deliberately uses a **recursive** de-proxy (`rozieDeepClone`), not `structuredClone(toRaw(x))`. A single top-level `toRaw` unwraps only the outermost `reactive()` tree — a *nested* independent reactive proxy or `ref` (e.g. an array of reactive items, or `$clone({ d: src.data })` where `src.data` is itself a live proxy) stays live, and `structuredClone` rejects it one level down. `rozieDeepClone` walks the whole structure (WeakMap-guarded against cycles) so Vue reaches true parity with Svelte's recursive `$state.snapshot`.

A Vue leaf that uses `$clone` therefore needs `@rozie/runtime-vue` in its package `dependencies` — it's the one extra peer the sigil pulls in on the Vue target.
:::

### `$clone` vs `$snapshot` — pick the right one

These two sigils look similar and are easy to confuse, but they answer different questions:

| | [`$snapshot(x)`](#snapshot-—-crossing-into-untyped-js) | `$clone(x)` |
| --- | --- | --- |
| **What it does** | **Unwraps** a reactive value to a plain one | Produces an **independent deep copy** |
| **On the 5 non-Svelte targets** | Identity passthrough — **same object back** | A real, separate copy every time |
| **Reach for it when** | Handing a value to library code that mutates property descriptors (Chart.js `Object.defineProperty`) | Freezing state for history/undo/scratch — you must keep a copy that later edits can't touch |
| **Independent copy guaranteed?** | No (only on Svelte) | Yes, on all six |

If you take a "snapshot" for an undo stack with `$snapshot()` and your target happens to be React/Vue/Solid/Angular/Lit, you've stashed a **live reference** — the next edit mutates your "history" in place. Use `$clone()` for anything you intend to keep frozen.

### Caveats — serializable state only

`$clone` rides the structured-clone algorithm, so it carries that algorithm's one hard limit: **a value containing a function or a DOM node throws** (`DataCloneError`). Clone serializable state — graph data, plain config, history snapshots — not live handles, callbacks, or element references. This throw is an author error surfaced loudly, not a silent corruption.

The ROZ135 steer (below) is intentionally **narrow**: it flags a *direct* `structuredClone($props/$data/$model.member)` and a single **one-hop** const alias (`const g = $data.graph; structuredClone(g)`). Two-hop chains, values passed through a parameter, and values returned from a call are **not** caught — so the absence of a warning is not a guarantee that a given `structuredClone` is safe. When in doubt on a reactive value, prefer `$clone`.

### Diagnostics

| Code | Severity | When |
| --- | --- | --- |
| `ROZ135` `STRUCTURED_CLONE_REACTIVE` | warning | A bare `structuredClone(<reactive member or one-hop alias>)` — steers you to `$clone(x)`, which is safe on Vue/Svelte where the raw call throws |
| `ROZ136` `CLONE_BAD_ARITY` | error | `$clone` called with anything but exactly one non-spread argument (`$clone()`, `$clone(a, b)`, `$clone(...x)`) — the per-target lowering hard-codes a single argument |

Naming a `<data>` field or `r-for` loop variable `$clone` collides with the reserved sigil (`ROZ202`). See the [Diagnostics reference](/reference/diagnostics) for the full code table.

## Safe non-primitive interpolation — objects render as portable JSON, never crash

Interpolate a non-primitive value — an array, a plain object, a reactive `$data` graph — and the six targets used to disagree wildly. Vue pretty-printed JSON (its native `toDisplayString`), Svelte and Angular showed comma-joined `[object Object]`, Solid and Lit showed space-joined `[object Object]`, and **React threw `Objects are not valid as a React child` and crashed the component.** Same source, six renderings, one hard crash.

Rozie closes that gap. A non-provably-primitive interpolation is wrapped in an internal `rozieDisplay` helper that mirrors Vue's `toDisplayString` semantics, so <span v-pre>`{{ $data.columns }}`</span> renders the **same portable JSON on all six targets** and React no longer crashes:

| Value | `rozieDisplay` result |
| --- | --- |
| `string` | as-is |
| `null` / `undefined` | `''` (empty string) |
| `Array` / plain `Object` | `JSON.stringify(value, null, 2)` |
| anything else (number, boolean, …) | `String(value)` |

The helper is **crash-safe**: a circular structure or a `BigInt`-bearing object (which would throw inside `JSON.stringify`) degrades to `String(value)` rather than re-introducing a render exception.

### Attribute position — a nullish bound value drops the attribute

The table above is the **text / interpolation** rule: in a text node or interpolated string, `null` / `undefined` become the empty string `''` (matching Vue's `toDisplayString`). In **attribute-binding position** the rule is different, because the web platform itself treats a missing attribute and an empty one differently (`[data-locked]` presence selectors, `hasAttribute('aria-busy')`, SortableJS's `filter: '[data-locked]'`).

A whole-value one-way attribute binding (`:data-locked="$data.locked ? 'true' : null"`, or a plain `:title="$data.note"` that is `null`) whose value is **nullish** now **drops the attribute entirely** — matching Vue's native `:attr` binding and the web platform — instead of rendering `attr=""`. Non-null values still stringify, so a value of `false` renders the literal `aria-expanded="false"` / `data-x="false"` (the drop predicate is `value == null` **only**, never `false`, so a11y-meaningful and presence-selector values survive). This is **not** a contradiction with the text rule above — text position and attribute position are different positions with different platform semantics.

The mechanics mirror `rozieDisplay`: the wrapped whole-value attribute branch routes through an internal `rozieAttr` helper (React / Solid / Svelte return `undefined` to omit the attribute, Lit returns its `nothing` sentinel, Angular's `[attr.x]="null"` removes it). Interpolated attribute **segments** (<span v-pre>`:title="note-{{ $data.id }}"`</span>) stay on the text rule — a nullish segment inside a composed string is still `''`, exactly as Vue interpolates. Vue needs no change; its native `:attr` binding already drops nullish.

### Only non-primitives are wrapped — primitives stay byte-identical

The wrap is **gated**, decided once at compile time. An interpolation the compiler can *prove* is primitive emits exactly as it did before — raw, zero overhead, byte-for-byte identical output. Provably-primitive cases include: a prop declared `String` / `Number` / `Boolean`, a `$data` field initialized to a primitive literal, `.length`, `typeof x`, comparisons (`a > b`, `a === b`), `!x`, `String(...)` / `Number(...)`, string concatenations, and logical chains whose operands are all primitive (`$props.a && $props.b`). When the compiler can't prove primitiveness (a bare method call, an untyped prop, a member of an untyped object), it wraps — the safe default, since a false *raw* is the crash and a false *wrap* is merely a stringified primitive.

**Boolean HTML attributes are never wrapped** on any target — `:disabled`, `:hidden`, `:open`, `:readonly`, etc. always emit raw, so a bound boolean value stays a boolean rather than becoming the always-truthy string `"false"`.

Per-target mechanics:

- **Vue** is untouched — its native `toDisplayString` already produces the same output, so wrapping would be redundant.
- **React, Solid, Svelte, Lit** import `rozieDisplay` from their Rozie runtime package only when a wrap actually fires.
- **Angular** can't call an imported free function (and its `json` pipe quotes strings), so it inlines the helper as a module-scope function plus a delegating component method — no runtime package required.

### Turning it off — `safeInterpolation`

The wrap is **on by default** and can be disabled globally or per component. Disabling reverts to the old raw per-target emit (re-exposing the `[object Object]` / React-crash behavior — your informed choice):

- **Globally** via the compiler option / plugin option: `compile(src, { safeInterpolation: false })`, `rozie({ safeInterpolation: false })` (unplugin), or the CLI flag `--no-safe-interpolation`.
- **Per component** via the SFC envelope attribute: `<rozie safe-interpolation="false">` (or `="true"` to force it on for one component when the global default is off).

Precedence is **envelope attribute › global option › default (on)** — a single component can opt out while the rest of the project keeps the wrap, or opt back in when the project default is off.

### Bare `$props` / `$data` / `$refs` / `$slots` is a compile error (ROZ978)

A *bare, whole-object* sigil — <span v-pre>`{{ $data }}`</span> or `$props` used alone, as opposed to a member access like <span v-pre>`{{ $data.columns }}`</span> — has no portable representation in v1 and leaked the literal identifier into emitted output (rendering on Vue, empty on Angular, runtime "not defined" on React/Solid/Lit, a hard build error on Svelte). Rozie now rejects it uniformly with **ROZ978** in any template, `<script>`, or `<listeners>` expression, and the hint points you at a specific member (which now renders as JSON automatically). This diagnostic is **always on** — it is independent of `safeInterpolation`. Member access is unaffected, and `$attrs` / `$listeners` (legitimate whole-object fallthrough) are explicitly exempt.

## `$classSelector()` — handing a class name to a vanilla-JS engine

`$classSelector('grip')` turns an authored class name into a CSS selector and **validates it against the component's `<style>` scope at compile time**. It is a convenience: a class that doesn't exist in the component's `<style>` is a compile error with a did-you-mean suggestion, so engine config like `handle: $classSelector('grip')` can't silently reference a class you never declared.

All six targets — React included — keep authored class names literal in the emitted DOM and isolate styles with a scoping attribute, so a class written `grip` renders as `class="grip"`. (React scopes via `[data-rozie-s-<hash>]`, the same model as Vue's `<style scoped>`; it no longer hashes class names.) That means a plain `el.querySelector('.grip')` already works on every target.

`$classSelector` therefore isn't required for correctness — it's a compile-time-checked way to author the same selector. The motivating case: a SortableJS wrapper that hands `handle: $classSelector('grip')` into `new Sortable(el, { handle })`. The class is verified to exist before the engine ever queries it, and `$classSelector('grip')` resolves to the literal `".grip"` selector that matches the rendered DOM on all six targets.

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
| React | `".grip"` — compile-time literal (classes stay literal in the DOM; React scopes via `[data-rozie-s-<hash>]`) |

::: warning Single class token only
The argument must be **one bare CSS class identifier** — `$classSelector('grip')`. It is validated at compile time: a non-string-literal argument, a class that has no rule in the component's own `<style>` scope, or a value containing whitespace, a leading `.` / `#`, or a combinator (`$classSelector('a b')`, `$classSelector('.grip')`, `$classSelector('a > b')`) is a compile error with a code-frame. Referencing an undeclared class also fails at compile time — catching the typo before it ships a selector that matches nothing — and the diagnostic suggests a near-match class name when one exists.

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

## `r-portal="<container-expr>"` — teleport an element's own subtree

Sometimes a modal overlay, a dropdown menu, or a tooltip needs to escape an ancestor's `overflow: hidden` / `transform` / `filter` / `contain` — any of which creates a clipping context or a new containing block that traps a `position: fixed` element. The fix on every framework is the same idea: render the subtree somewhere else in the DOM (usually `document.body`), while keeping it logically part of the same component.

`r-portal` is an element-level directive, distinct from the `<slot portal />` primitive (`$portals.NAME(...)`, used for mounting *slot-fill content* into an *engine-owned container* — see the [`PortalList` example](../examples/portal-list.md)). `r-portal` is the inverse: it relocates the element's **own rendered subtree**, declaratively, using each target's native teleport construct.

```rozie
<props>
{
  open: { type: Boolean, default: false },
  to:   { type: [Boolean, String], default: false },
}
</props>

<script>
function resolveTo(to) {
  if (!to) return null
  if (typeof document === 'undefined') return null
  if (to === true || to === 'body') return document.body
  return document.querySelector(to)
}
</script>

<template>
<div r-if="$props.open" r-portal="resolveTo($props.to)" class="overlay-backdrop">
  <div class="overlay-box">
    <slot />
  </div>
</div>
</template>
```

The container expression is evaluated fresh on every render. A **falsy** result (`null`, `undefined`, `false`) means "render in place" — the subtree stays exactly where it was authored, byte-behavior-identical to not having the directive at all. This is what makes an `appendTo`-style consumer prop safe to default OFF: existing consumers who never opt in see zero change.

`r-portal` composes with `r-if`/`r-for` on the SAME element — the conditional/loop governs *whether* the subtree renders at all; the portal governs *where* it renders once it does.

Per-target lowering:

| Target | Native construct | In-place fallback |
| --- | --- | --- |
| React | `createPortal(tree, container)` from `react-dom` | `container ? createPortal(tree, container) : tree` — a plain ternary |
| Vue | `<Teleport :to :disabled>` (emitter-only — authors cannot write `<Teleport>` directly; see below) | `:disabled="!(container)"` — Vue skips target resolution and mounts in place when disabled |
| Solid | `<Portal mount={container}>` from `solid-js/web`, gated by `<Show>` | `<Show when={container} fallback={tree}>` — falsy container never mounts `<Portal>` at all |
| Svelte | a `use:roziePortal={container}` action (`@rozie/runtime-svelte`) | the action's own `place()` step — falsy container is a no-op on initial attach, or restores the node's original anchor on transition |
| Angular | a per-element `effect()` field initializer + `viewChild()` ref (AOT-safe; no `import.meta.url`, no inline template arrow) | the effect's own placement logic restores the original DOM anchor on a falsy container |
| Lit | a `RoziePortalController` (`@rozie/runtime-lit`, a `ReactiveController`) driving a **cached** `@query(..., true)` ref | same anchor-capture-and-restore semantics; see the theming note below |

**Vue's `<Teleport>` is an author-side escape hatch that is otherwise rejected** (`ROZ926`) — writing `<Teleport>` directly in a `.rozie` template is a compile error, because Rozie deliberately does not expose framework-specific primitives to authors. `r-portal` is different: it's a Rozie-native directive that the **emitter** may lower to `<Teleport>` internally. ROZ926 gates author input, not emit output.

**A component-registered child (`<Foo r-portal="...">`) is not supported in v1** — only a plain/host element can carry `r-portal`. Put the directive on a wrapping `<div>` instead.

### Theming through the portal — the Lit hazard

Every target except Lit renders into ordinary DOM, so a relocated element still inherits any custom property (`--my-token`) set on `:root` or an ancestor. Lit is different: a Lit component renders into a **shadow root**, and its scoped `static styles` sheet is attached via `shadowRoot.adoptedStyleSheets` — physically confined to that shadow tree. Once `r-portal` relocates an element to `document.body` (light DOM, outside any shadow root), the shadow-scoped stylesheet no longer reaches it.

Rozie's Lit emitter closes this gap automatically: whenever a component has an `r-portal` element, its scoped CSS is **also** pushed through `injectGlobalStyles` (the same runtime helper `:root { }` rules already use) — the relocated element already carries the component's `[data-rozie-s-<hash>]` scope attribute (every plain element does, unconditionally), so the globally-injected rules match only that component's own elements, never a sibling consumer's shadow-internal ones.

The practical rule for consumers on every target: **set theming custom properties on `:root`** (or on the container you pass to `appendTo`-style props), not on a host-scoped ancestor — a host-scoped token does not reach a body-portalled subtree on any target, Lit included.

::: warning When NOT to reach for this
`r-portal` is for escaping a *real* clipping/stacking problem — a modal, dropdown, or tooltip trapped by an ancestor's `overflow`/`transform`/`filter`. It is not a general-purpose DOM-reparenting primitive. Default any consumer-facing "portal target" prop to OFF (render in place) so existing consumers see zero behavior change until they opt in.
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

### A slot name can't equal a prop name (ROZ127)

A `<slot name="X">` whose `X` matches a declared `<props>` key is a compile error (**ROZ127**). The names live in distinct namespaces internally (`$slots` vs `$props`), but on **Svelte 5** they collapse onto one — snippets and props both arrive through a single `$props()` bag, so a same-named slot and prop would resolve to the same member and the snippet would shadow the prop value. Rather than silently diverge on one of six targets, Rozie blocks it loudly and you rename the slot — typically by appending the wrapped engine's hook name (e.g. a `nowIndicator` boolean prop alongside a `nowIndicatorContent` slot). This is the slot-side sibling of the `$expose`/event name-collision rule (`ROZ121`).

## `:root { }` — the global escape hatch in scoped styles

`<style>` is scoped by default. The `:root { }` selector is the escape hatch, and it carries **two distinct capabilities** depending on what you put inside it:

1. **Flat custom-property declarations** (`:root { --var: … }`) → emitted globally as a top-level `:root` rule — for CSS variables, font definitions, or anything else that legitimately belongs on the document.
2. **Nested selector rules** (`:root { .selector { … } }`) → the inner rules are emitted **bare/unscoped** (without Rozie's `[data-rozie-s-*]` scope attribute) so they can reach **engine-rendered runtime DOM** — the **engine-DOM escape hatch** (Phase 34).

### Flat custom properties — the global document layer

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

### Nested selectors — the engine-DOM escape hatch

When you wrap a **selector rule** inside `:root { }` (rather than a flat custom property), Rozie emits that inner rule **bare and unscoped** — it does *not* get the component's `[data-rozie-s-<hash>]` scope attribute. This is the mechanism a wrapped vanilla-JS engine component needs to style the DOM the engine creates **at runtime**.

The problem it solves: when Rozie wraps an engine like CodeMirror, ProseMirror/TipTap, or flatpickr, that engine renders its own DOM nodes (`.cm-editor`/`.cm-scroller`, TipTap's `is-editor-empty` placeholder node, flatpickr's body-appended calendar). Those nodes are created by the engine *after* mount and **never carry Rozie's scope attribute** — so an ordinary scoped rule like `.cm-editor { … }` silently fails to match them on React/Solid/Lit (and is shadow-DOM-isolated on Lit). The nested-`:root` form lifts the rule out of scoping so it reaches engine DOM on **all six targets**, including through Lit's shadow boundary:

```rozie
<style>
/* Scoped to this component's own template elements. */
.editor-shell { border: 1px solid #d1d5db; border-radius: 8px; }

/* Engine-DOM escape hatch — these reach CodeMirror's runtime nodes,
   which never carry Rozie's [data-rozie-s-*] scope attribute. */
:root {
  .cm-editor { height: 100%; }
  .cm-scroller { font-family: ui-monospace, monospace; }
}
</style>
```

A real example from the TipTap wrapper styles the Placeholder extension's ghost text — the `is-editor-empty` node ProseMirror injects into an empty document:

```rozie
<style>
:root {
  .ProseMirror .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
    height: 0;
    float: left;
  }
}
</style>
```

Per-target emission of the nested rules mirrors the flat case but for selector rules rather than custom properties: React emits a `.global.css` sidecar, Vue an unscoped second `<style>` block, Svelte a `:global { … }` wrapper, Angular bare `::ng-deep`, Solid a `__rozieInjectStyle` head-inject, and Lit a **dual-sink** — the rules land in both `static styles` (for the shadow root) and `injectGlobalStyles` (for engine DOM that escapes the shadow boundary, e.g. a body-appended calendar).

This injection is intentionally **page-wide** — the rules go in as authored, with no anchoring or containment enforcement. If you want containment, scope the inner selectors under a wrapper class yourself (e.g. `:root { .my-editor .cm-editor { … } }`).

### `:global()` is forbidden (ROZ128)

You might reach for `:global(.cm-editor)` out of Vue/Svelte habit. **Don't** — it's a hard compile error (**ROZ128**). The `:global()` pseudo works natively *only* on Vue and Svelte (whose compilers understand it); on React, Solid, and Lit the browser sees an unknown pseudo and silently discards the entire rule. Rather than ship a selector that works on two of six targets and dies invisibly on three, Rozie blocks `:global()` in `<style>` selectors loudly and points you at the `:root { … }` engine-DOM escape hatch, which lowers to the same unscoped output on every target:

```rozie
<style>
/* ❌ ROZ128 — works on Vue/Svelte, silently dead on React/Solid/Lit. */
:global(.cm-editor) { height: 100%; }

/* ✅ Canonical — bare/unscoped on all six targets. */
:root {
  .cm-editor { height: 100%; }
}
</style>
```

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

- **React**: scope attribute appended to the outer compound only, with the deep-lifted part wrapped in `:global(...)` — `.board[data-rozie-s-<hash>] :global(.rozie-sortable-list) { … }`. (The `:global()` wrap is historical: it originally opted the lifted inner selector out of CSS Modules hashing. React now emits a plain `.css` file scoped purely by `[data-rozie-s-<hash>]` attributes, so the wrap is inert-but-kept — class names *inside* `:global()` are already literal in the DOM and match the producer-rendered class directly.)
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

## `r-keynav` — compiler-owned keyboard navigation

Keyboard list-navigation — Arrow/Home/End/typeahead, an active index, the `aria`/`id` wiring that goes with it, and roving focus or `aria-activedescendant` — is boilerplate every menu, listbox, combobox, toolbar, and tab strip in a component library rewrites by hand, once per framework. `r-keynav` replaces the active-state field, the entire `@keydown` switch, per-item `:id`/`@pointermove`, `:aria-activedescendant`, and the scroll-into-view `$watch` with **one directive on the nav root plus one marker on each item**. The compiler owns the plumbing; you own only what happens on commit.

This is the diff `r-keynav` deletes:

**Before — hand-rolled, ~40 lines:**

```rozie
<data>
{
  active: 0,
  chosen: '',
}
</data>

<script>
const RESULTS = [
  { id: 'r1', label: 'Apple' },
  { id: 'r2', label: 'Banana' },
  { id: 'r3', label: 'Cherry', disabled: true },
  { id: 'r4', label: 'Date' },
  { id: 'r5', label: 'Elderberry' },
]

let typeaheadBuffer = ''
let typeaheadTimer = null

const move = (delta) => {
  let next = $data.active
  do {
    next = (next + delta + RESULTS.length) % RESULTS.length
  } while (RESULTS[next].disabled)
  $data.active = next
}

const choose = (item) => {
  $data.chosen = item ? item.label : ''
}

const onKeydown = ($event) => {
  switch ($event.key) {
    case 'ArrowDown': $event.preventDefault(); move(1); break
    case 'ArrowUp': $event.preventDefault(); move(-1); break
    case 'Home': $data.active = 0; break
    case 'End': $data.active = RESULTS.length - 1; break
    case 'Enter': choose(RESULTS[$data.active]); break
    default:
      if ($event.key.length === 1) {
        clearTimeout(typeaheadTimer)
        typeaheadBuffer += $event.key.toLowerCase()
        const match = RESULTS.findIndex((r) => r.label.toLowerCase().startsWith(typeaheadBuffer))
        if (match !== -1) $data.active = match
        typeaheadTimer = setTimeout(() => { typeaheadBuffer = '' }, 500)
      }
  }
}

$watch(() => $data.active, () => {
  $refs.list.children[$data.active]?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
<input type="text" role="combobox" :aria-activedescendant="'opt-' + $data.active"
       @keydown="onKeydown($event)" />
<ul role="listbox" ref="list">
  <li r-for="(r, i) in RESULTS" :key="r.id" role="option"
      :id="'opt-' + i" :aria-disabled="!!r.disabled"
      @pointermove="$data.active = i">
    {{ r.label }}
  </li>
</ul>
</template>
```

**After — r-keynav, ~5 lines:**

```rozie
<template>
<input type="text" role="combobox" r-keynav:activedescendant.vertical="$data.active"
       :source="RESULTS" @keynav-commit="choose(RESULTS[$data.active])" />
<ul role="listbox">
  <li r-for="r in RESULTS" :key="r.id" role="option"
      r-keynav-item="{ label: r.label, disabled: r.disabled }">{{ r.label }}</li>
</ul>
</template>
```

The `active` field in `<data>` stays — you still own it — but the entire `@keydown` switch, the typeahead buffer, per-item `:id`/`@pointermove`, `:aria-activedescendant`, and the scroll `$watch` are gone.

### Surface

```
r-keynav:<focus-model>[.<modifier>…]="<active-index binding>"   (on the nav root)
r-keynav-item="{ label?, disabled? }"                            (on each item)
r-keynav-active-class="<class spec>"                             (optional, on the root)
@keynav-commit="…"                                               (Enter / click-on-active)
:source="<items array>"                                          (optional; else synthesized from co-located r-for)
```

**Two focus models** (the directive's argument):

- **`r-keynav:activedescendant`** — DOM focus **stays on the root control**; the active item is tracked virtually via `aria-activedescendant` pointing at its id. Use this for a listbox or a combobox with an `<input>`.
- **`r-keynav:tabindex`** — DOM focus **moves to the active item** (the WAI-ARIA "roving tabindex" pattern: `tabindex` toggles `0`/`-1`, `.focus()` runs on change). Use this for a menu, toolbar, radio-group, or tab strip.

**Modifiers** (the existing dotted-modifier grammar):

| Modifier | Values | Default | Effect |
| --- | --- | --- | --- |
| orientation | `.vertical` / `.horizontal` / `.both` | `.vertical` | which arrow axis navigates (`.both` = both arrow axes navigate) |
| `.loop` | flag | off (clamp) | wrap past the ends instead of clamping |
| `.typeahead` | flag | off | printable characters jump to a matching item by `label`; ~500ms buffer, resets after the pause |
| `.skipdisabled` | flag or `.skipdisabled(false)` | **on** | skip `disabled` items during navigation; pass the bare-boolean argument `.skipdisabled(false)` to include disabled items in navigation |

**The rest of the surface:**

- **`r-keynav-item="{ label?, disabled? }"`** — tags each rendered row. `label` feeds typeahead matching; `disabled` feeds `.skipdisabled`. The item's index comes from its enclosing `r-for`.
- **`:source="<items array>"`** — the data array the primitive navigates (not the rendered DOM — required because the list may be virtualized). **Sugar:** omit `:source` and the compiler synthesizes it from the co-located `r-for` producing the `r-keynav-item` elements — a static menu never has to mention a source at all.
- **`@keynav-commit="…"`** — fires on Enter or a click on an item, with the active index. `r-keynav` manages the active index and focus; **you** own selection semantics (single vs. multiple, toggle vs. replace) via this event — navigation and selection are deliberately separate concerns.
- **`r-keynav-active-class`** — optional; see [Active-item styling](#active-item-styling) below.

### Two examples

**Menu — tabindex model, items contained in one subtree:**

```rozie
<template>
<div role="menu" r-keynav:tabindex.vertical.loop="$data.active"
     :source="items" @keynav-commit="run(items[$data.active])">
  <button role="menuitem" r-for="it in items" :key="it.id"
          r-keynav-item="{ label: it.label, disabled: it.disabled }">
    {{ it.label }}
  </button>
</div>
</template>
```

**Combobox — activedescendant model, input and list in SEPARATE subtrees:**

```rozie
<data>
{
  active: 0,
  chosen: '',
}
</data>

<script>
const RESULTS = [
  { id: 'r1', label: 'Apple' },
  { id: 'r2', label: 'Banana' },
  { id: 'r3', label: 'Cherry', disabled: true },
  { id: 'r4', label: 'Date' },
  { id: 'r5', label: 'Elderberry' },
]

const choose = (item) => {
  $data.chosen = item ? item.label : ''
}

const onSearch = ($event) => {
  // re-filter RESULTS from $event.target.value, reset $data.active as needed
}
</script>

<template>
<input type="text" role="combobox" r-keynav:activedescendant.vertical="$data.active"
       :source="RESULTS" @keynav-commit="choose(RESULTS[$data.active])"
       @input="onSearch($event)" />
<ul role="listbox">
  <li role="option" r-for="r in RESULTS" :key="r.id"
      r-keynav-item="{ label: r.label, disabled: r.disabled }"
      :aria-disabled="!!r.disabled">{{ r.label }}</li>
</ul>
</template>
```

The combobox example is the proof that association is **shared reactive state** (`$data.active` + `:source`), not DOM nesting — the `<input>` root and the `<ul>` items live in separate subtrees and still track each other, because the compiler wires `aria-activedescendant` on the input to the active `<li>`'s id and stamps the same active marker onto each `<li>` through their shared state, not through parent/child structure. (The menu example above stays template-only — a static menu never needs a `<data>`/`<script>` block at all.)

### Keyboard map

| Key | Action |
| --- | --- |
| Arrow (per orientation) | move active ±1 (wrap if `.loop`, skip disabled if `.skipdisabled`) |
| Home / End | move to first / last enabled |
| Enter | fires `@keynav-commit` with the active index |
| printable characters | typeahead to a matching `label` (if `.typeahead`) — case-insensitive prefix match, ~500ms buffer reset |
| click on an item | sets active to it and fires `@keynav-commit` |

`Escape`, `Tab`, and open/close semantics stay with you — they belong to the surrounding widget (a popover, a dialog), not to navigation.

### Accessibility

`r-keynav` draws an explicit line between what the compiler wires for you and what stays yours to set.

**What the compiler sets for you:**

- tabindex model (`r-keynav:tabindex`): the roving `tabindex` `0`/`-1` toggle across items, plus `.focus()` on the active item whenever it changes.
- activedescendant model (`r-keynav:activedescendant`): `aria-activedescendant` on the nav root, plus a stable, unique `id` per item (so the root has something to point at).
- both models: `data-rozie-keynav-item="<index>"` on each item and `data-rozie-keynav-active` on the active item (the canonical styling/test hook — see [Active-item styling](#active-item-styling) below), a stable group id on the root, and the delegated keydown/pointermove wiring.

**What you still own:**

- semantic roles: `role="menu"`/`role="menuitem"`, `role="listbox"`/`role="option"`, `role="combobox"` — the primitive never guesses your widget's role.
- labelling: `aria-label` / `aria-labelledby` on the nav root.
- combobox trigger wiring: `aria-expanded` + `aria-controls` linking an input/button to its popup.
- `aria-disabled` on disabled items — `r-keynav-item="{ disabled }"` only feeds `.skipdisabled` navigation, it does **not** emit the `aria-disabled` attribute. Set it yourself, as both demos do: `:aria-disabled="!!r.disabled"`.
- open/close, `Escape`, and `Tab` semantics — as the Keyboard map notes above, these belong to the surrounding widget, not to navigation.

### Active-item styling

The compiler **always** stamps <span v-pre>`data-rozie-keynav-active`</span> on the active item — cheap, and it gives you one canonical hook for both default styling and VR/tests, with nothing to opt into:

```css
[data-rozie-keynav-active] { background: var(--rozie-accent); }
```

`r-keynav-active-class="…"` is **optional and additive** — it never replaces the `data-*` hook, it only *also* toggles author classes on the active item. It accepts the same shapes `:class` does (`'is-active'`, `['is-active', 'ring']`, `{ 'is-active': cond }`).

Two semantics are worth knowing by name before you reach for it:

1. **Evaluated once (static config), not a live per-render binding.** The controller normalizes the class spec at setup and toggles the token set on active-change — it does not re-evaluate on every render the way a template `:class` binding would. If the active item's styling needs to change *while* it stays active (a value that changes without the active index changing), bind off the always-present `[data-rozie-keynav-active]` attribute instead — that one *is* live, because it's a plain declarative binding the compiler emits per item, not an imperative toggle.
2. **The object form composes with activeness.** `r-keynav-active-class="{ 'is-active': cond }"` applies the `is-active` class only when the item **is active AND** `cond` holds — both conditions, not either. An item that is active but whose `cond` is falsy gets no class from this rule (though it still carries `[data-rozie-keynav-active]`, since that hook is unconditional).

### Diagnostics

Six compile-time diagnostics catch malformed `r-keynav` forms (each collected, not thrown):

| Code | When |
| --- | --- |
| `ROZ982` `KEYNAV_UNKNOWN_MODIFIER` | an unrecognized modifier (did-you-mean among `.vertical`/`.horizontal`/`.both`/`.loop`/`.typeahead`/`.skipdisabled`) |
| `ROZ983` `KEYNAV_NO_ITEMS` | an `r-keynav` root with no associated `r-keynav-item` in the component |
| `ROZ984` `KEYNAV_ORPHAN_ITEM` | an `r-keynav-item` with no `r-keynav` root in the component |
| `ROZ985` `KEYNAV_BAD_FOCUS_MODEL` | a missing or unrecognized focus-model argument (valid: `tabindex`, `activedescendant`) |
| `ROZ986` `KEYNAV_MULTIPLE_ROOTS` | more than one `r-keynav` root in one component (v1 is one group per component — named groups are a future extension) |
| `ROZ987` `KEYNAV_SOURCE_UNRESOLVED` | `:source` is neither provided nor synthesizable from a co-located `r-for` |

See the [Diagnostics reference](/reference/diagnostics) for the full code table.

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
