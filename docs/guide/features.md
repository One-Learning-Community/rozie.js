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
