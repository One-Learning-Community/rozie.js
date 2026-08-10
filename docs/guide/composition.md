# Composition: slots, fallthrough, context, handles

How components compose: child registration, scoped slots, attribute and listener fallthrough, imperative handles, cross-component context, and typed imports.

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

`ThemeButton` can sit any number of unaware components deep — `<ThemeProvider><Panel><Toolbar><ThemeButton/></Toolbar></Panel></ThemeProvider>` — and still resolve `theme`. The middle components carry no `theme` prop. A click on the button cycles the color and the new value reaches the descendant reactively, in place. This exact trio — provider, unaware passthrough, deep consumer — is the [ThemeContext worked example](/examples/theme-context): full sources, all six compiled outputs, and the demo running live on the page.

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

One boundary to respect: **context does not cross a portal**. A subtree relocated with [`r-portal`](/guide/engine-wrappers#r-portal-container-expr-—-teleport-an-element-s-own-subtree) (or mounted through a [portal slot](/examples/portal-list)) cannot be assumed to still resolve a provider above its original position — notably on Lit, where context resolution rides the DOM ancestry via `context-request` events and a relocated subtree's ancestors are the portal target's, not the provider's. Keep `$inject` consumers in normal child position and portal only presentation subtrees.

### Provide a live reference, not a snapshot

This is the one author rule that governs whether context is reactive. **Provide a value that carries live references — a getter, a `$computed` accessor, or a signal — never a snapshotted primitive.** Every target's reactivity rides on the consumer reading through that live reference at the moment it renders. The getter form above is correct:

```rozie
$provide('theme', { get color() { return color }, cycle })   // ✓ reactive: reads `color` live
```

A bare primitive is **valid code but non-reactive on every target** — the descendant sees the value frozen at provide time:

```rozie
$provide('theme', color)   // ⚠ compiles, but the consumer never sees later changes
```

Both forms compile cleanly — a bare primitive is sometimes exactly what you want (a constant config object), so Rozie does not warn on it. But if you expect a `$inject` consumer to update when the source value changes, the provided value must expose a live accessor. This is the mirror image of [`$snapshot()`](/guide/engine-wrappers#snapshot-—-crossing-into-untyped-js), which deliberately freezes a value crossing into untyped JS; context wants the opposite.

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

## Typed `.rozie` imports

`import Counter from './Counter.rozie'` is fully typed: the props interface, the `on<Event>?` callbacks, and (when present) the `$expose` handle all flow through to your editor and `tsc`, via a generated `<Name>.d.rozie.ts` declaration sidecar written on every build. The full spec (per-framework setup, the `allowArbitraryExtensions` flag, named handle imports, the wildcard-shim migration, the gitignore policy, and the Angular no-sidecar exception) lives in [Install → Typed `.rozie` imports](/guide/install#typed-rozie-imports-per-framework-setup).
