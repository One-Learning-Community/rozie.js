# Features & design choices

Rozie tries to be the syntax a Vue developer would design if they wanted React, Svelte, Angular, Solid, and Lit output without losing the SFC ergonomics. A few of those choices are worth calling out, because they translate into meaningful code-saving over hand-rolled cross-framework wrappers.

## Parameterized event modifiers

Every `@event` in a `<template>` (and every key in a `<listeners>` block) supports a chainable modifier suffix. Unlike Vue, modifiers can take arguments — `.debounce(300)`, `.throttle(100)`, `.outside($refs.a, $refs.b)` — and they compose:

```rozie
<template>
  <input 
    @input.debounce(300)="onSearch" 
    @keydown.enter="onSearch" 
    @keydown.escape="clear" 
  />
</template>

<listeners>
{
  // The modifier grammar handles chains of mixed args and bare modifiers:
  "window:resize.throttle(100).passive": { handler: reposition }
}
</listeners>

```

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

## `<listeners>` block with reactive `when`

Document-level and window-level listeners belong outside the markup, so Rozie gives them their own block. Each entry is a key (`scope:event.modifier(...).modifier`), an optional `when` predicate, and a handler:

```rozie
<listeners>
{
  "document:click.outside($refs.triggerEl, $refs.panelEl)": {
    when:    "$props.open && $props.closeOnOutsideClick",
    handler: close,
  },
  "document:keydown.escape": {
    when:    "$props.open && $props.closeOnEscape",
    handler: close,
  },
  "window:resize.throttle(100).passive": {
    when:    "$props.open",
    handler: reposition,
  },
}
</listeners>
```

The `when` predicate is reactive — when it flips false, the listener is removed; when it flips true again, it's re-attached. No `addEventListener` / `removeEventListener` boilerplate, no missed teardown on unmount. This single block in `Dropdown.rozie` collapses roughly 30 lines of per-framework wiring that would otherwise be written once per target.

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

Inside the component you just write `$props.value = newValue` — Rozie rewrites the assignment to the target's emit-or-setter form.

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

It's the right tool when `$onMount` is too early. A common case: an element gated by `r-if` is undefined at mount time, but the consumer toggles the gate later — `$watch` fires after the transition, when the ref is finally populated.

Each target compiles this to its native effect primitive:

| Target | Expansion |
| --- | --- |
| Vue | `watch(() => open.value, () => { /* cb */ })` |
| React | `useEffect(() => { /* cb */ }, [open, /* closure refs */])` — getter deps + callback closure refs unioned to satisfy `react-hooks/exhaustive-deps` |
| Svelte 5 | `$effect(() => { (() => open)(); (() => { /* cb */ })(); })` — getter IIFE inside `$effect` registers the subscription via reactive read tracking |
| Angular | `effect(() => { (() => this.open())(); (() => { /* cb */ })(); })` |
| Solid | `createEffect(() => { (() => props.open)(); (() => { /* cb */ })(); })` |
| Lit | `effect(() => { (() => this.open)(); (() => { /* cb */ })(); })` from `@lit-labs/preact-signals`; the unsubscribe handle is pushed onto the disconnect-cleanup drain |

Single-getter form only — array-of-getters, `oldValue` callback parameter, and `flush` / `immediate` options are not in scope. Malformed calls emit a soft `ROZ109` diagnostic and are skipped rather than crashing the compiler.

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
