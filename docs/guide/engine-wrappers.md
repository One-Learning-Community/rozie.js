# Engine-wrapper toolkit

The sigils and directives for wrapping vanilla-JS engines that render or mutate DOM the framework does not own.

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

## `$slotted.<name>` — resolve slotted elements across the Lit shadow boundary

A wrapped vanilla engine that queries the DOM for its own content (`container.querySelectorAll(selector)`, `container.children`, …) can't see slot-projected elements on Lit: native `<slot>` "flattening" is a rendering-composition concept, not a DOM-tree one, so slotted light-DOM nodes are never *descendants* of the shadow-root container the engine was handed. `$slotted.<name>` is the escape hatch — a member-shape sigil that returns the `Element[]` currently assigned to a named slot (`$slotted.default` for the unnamed slot).

```rozie
<template>
  <div ref="containerEl">
    <slot />
  </div>
</template>

<script>
import Engine from 'some-vanilla-engine'

let instance = null

$onMount(() => {
  // Hand the engine an explicit element list instead of a selector string —
  // works uniformly whether the elements are real descendants (five targets)
  // or projected across a shadow boundary (Lit).
  instance = new Engine({ items: $slotted.default })
  return () => instance?.destroy()
})

// Re-init when slotted content changes after mount — the ONLY target where
// this getter is anything but a constant is Lit (see the table below).
$watch(() => $slotted.default.length, () => instance?.reInit({ items: $slotted.default }))
</script>
```

**On React / Vue / Svelte / Solid / Angular, `$slotted.<name>` is a compile-time constant `[]`.** There's no shadow boundary on those targets — slot content is already a real descendant of the container an engine would query directly — so the sigil has nothing to resolve. This mirrors the 5-no-op / 1-real shape of [`$reconcileAfterDomMutation()`](#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own) above, whose one live target is also Lit.

**On Lit, the sigil is live and reactive**, backed by a `queryAssignedElements`-derived signal maintained by the existing slotchange machinery, pre-seeded in `connectedCallback()` so a mount-phase read resolves non-zero. Reading it is meaningful only after mount — the same discipline as [`$refs`](/guide/reactivity#refs-derived-from-ref): the underlying `<slot>` element doesn't exist in the shadow root until first render.

| Target | `$slotted.<name>` |
| --- | --- |
| React / Vue / Svelte / Solid / Angular | `[]` (compile-time constant) |
| Lit | the live, reactive `Element[]` assigned to that slot, resolved across the shadow boundary |

Use it exactly where you'd otherwise hand a vanilla engine a DOM-query-based option (`slides`, `items`, `children`) and want that option to resolve identically whether the consumer's content is config-driven or dropped in declaratively via the default slot — see [`Carousel`](/components/embla)'s `slides` option for the shipped example.

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

Authors targeting only React, Vue, or Angular can leave the sigil in place at zero cost — it lowers to `void 0`. The cross-target safety net is one of the closing pieces in the keyboard-accessibility story for `packages/ui/sortable-list/src/SortableList.rozie` and any future engine-wrapper that exposes keyboard reorder.

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
