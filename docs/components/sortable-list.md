# SortableList — the cross-framework drag-and-drop component

`SortableList` is Rozie's data-bound port of [SortableJS](https://sortablejs.github.io/Sortable/) — the headline demo for Rozie's competitive wedge. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers, with a feature set that every standalone library on the [Sortable libraries comparison](/components/sortable-comparison) matrix either skips or implements partially.

This page is the **show-and-tell**: API reference, live demos, and the recipes that cover the long tail of what you'd want a drag-and-drop list to do. The [comparison page](/components/sortable-comparison) is the **sell**.

The full source for `SortableList.rozie` lives in [the canonical example page](/examples/sortable-list).

## The `@rozie-ui/sortable-list` packages

`SortableList` ships as the first `@rozie-ui` product: six pre-compiled, per-framework packages generated from a single `SortableList.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step, no `@rozie/*` runtime dependency:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/sortable-list-react` | `npm i @rozie-ui/sortable-list-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/react/README.md) |
| `@rozie-ui/sortable-list-vue` | `npm i @rozie-ui/sortable-list-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/vue/README.md) |
| `@rozie-ui/sortable-list-svelte` | `npm i @rozie-ui/sortable-list-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/svelte/README.md) |
| `@rozie-ui/sortable-list-angular` | `npm i @rozie-ui/sortable-list-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/angular/README.md) |
| `@rozie-ui/sortable-list-solid` | `npm i @rozie-ui/sortable-list-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/solid/README.md) |
| `@rozie-ui/sortable-list-lit` | `npm i @rozie-ui/sortable-list-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/lit/README.md) |

Each package carries `sortablejs ^1.15` plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit`). The per-leaf READMEs above and the **Props** table below are generated from the same IR parse of `SortableList.rozie`, so they cannot drift from the compiled output (the package's `codegen.mjs` asserts the structural columns of this page against `ir.props` on every run). This page documents the API surface shared by all six packages; the [comparison page](/components/sortable-comparison) frames the cross-framework wedge, and the [example page](/examples/sortable-list) shows the per-target compiled output side by side.

## Quick start

The minimal consumer is a `<components>` block, a bound array, and the default scoped slot:

```rozie
<components>
{
  SortableList: './SortableList.rozie',
}
</components>

<data>
{
  items: [
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
    { id: '3', label: 'Cherry' },
  ],
}
</data>

<template>
  <SortableList r-model:items="$data.items" itemKey="id" :handle="$classSelector('grip')">
    <template #default="{ item }">
      <div class="row">
        <span class="grip" aria-label="Drag handle">⋮⋮</span>
        <span>{{ item.label }}</span>
      </div>
    </template>
  </SortableList>
</template>

<style>
.grip { cursor: grab; }
</style>
```

`r-model:items` is Rozie's [two-way bind on an array](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere) — the consumer hands SortableList an array, SortableList writes the reordered array back, and the framework reconciler picks up the change without any `onChange → setState` wiring.

To see what each target's emitted code looks like, visit the [SortableList example page](/examples/sortable-list) — it ships the live source plus the per-target compiled output for all six targets.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `items` | `Array` | `[]` | yes (via `r-model`) | The bound items array. `model: true` — reorders write back through the two-way path. |
| `itemKey` | `String \| Function` | `null` | yes | Property name OR a `(item, index) => key` function for the per-row key. With neither, id-less object items get a stable synthetic key via an internal WeakMap; primitive items fall back to index — pass a function for reorderable duplicate primitives. Improves keyed-reconciler behavior on Vue / Svelte / React. |
| `handle` | `String` | `null` | yes | CSS selector identifying the per-row drag handle. A plain `.grip` works on every target — authored class names render literally everywhere (React included). [`$classSelector('grip')`](/guide/features#classselector-—-handing-a-class-name-to-a-vanilla-js-engine) is an optional, typo-checked way to author it. |
| `group` | `String \| Object` | `null` | yes | SortableJS group name (cross-list drag) or full object form. Use `cloneable: true` to flip a string group into clone-mode. |
| `animation` | `Number` | `150` | yes | Animation duration in ms. `0` disables. |
| `disabled` | `Boolean` | `false` | yes | Temporarily disable drag without unmounting. Also suppresses keyboard reordering — a disabled list is not sortable by any input, so rows lose their tabindex and the keydown handler no-ops. |
| `disableKeyboard` | `Boolean` | `false` | yes | Opt out of keyboard reordering (Space lift / Arrow move / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no tabindex) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`. |
| `ghostClass` | `String` | `null` | yes | Class name applied to the drop-placeholder element. See [Custom ghost / chosen / drag styling](#custom-ghost-chosen-drag-styling). |
| `chosenClass` | `String` | `null` | yes | Class name applied to the currently-chosen item. |
| `dragClass` | `String` | `null` | yes | Class name applied to the dragging element. |
| `filter` | `String` | `null` | yes | CSS selector that prevents drag initiation on matching rows. See [Filter — locked items](#filter-—-locked-items). |
| `easing` | `String` | `null` | yes | CSS easing function for the animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). |
| `forceFallback` | `Boolean` | `false` | **NO** | Force SortableJS's mouse-event drag path (over HTML5 DnD). Useful for touch testing and consistent cross-browser behavior. **Construction-time only** — see [Remount on construction-time-only changes](#remount-on-construction-time-only-changes). |
| `swapThreshold` | `Number` | `1` | yes | SortableJS swap-threshold (0..1). Lower = swap earlier. Reapplied live via `instance.option('swapThreshold', v)` — SortableJS reads it on every dragover, so no remount is needed. |
| `cloneable` | `Boolean` | `false` | yes | High-level prop that replaces a string `group` with SortableJS's `{ name, pull: 'clone', put: true }` object form. See [Clone mode](#clone-mode). Reapplied live — toggling `cloneable` (or changing `group`) recomputes the clone-mode shape and reapplies it via `instance.option('group', …)`, no remount. |
| `options` | `Object` | `{}` | partial | Verbatim SortableJS options pass-through for anything not covered by the named props above. The named props win on key conflict, but `options` lands AFTER them in the merge so consumers can override defaults; handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onClone`) are stripped — the helper owns those paths. |
| `labelFor` | `Function` | `null` | yes | Optional `(item, idx) => string` returning the screen-reader label for the aria-live announcer (keyboard-drag accessibility). |
| `listClass` | `String \| Array \| Object` | `""` | yes | Extra class(es) merged onto the list container (the SortableJS root). Accepts a string, an array, or an object (Vue-style class binding), normalized via the cross-target class normalizer. Bridges `.list-group`, a flex/grid parent, or `:nth-child` styling. |
| `itemClass` | `String \| Array \| Object \| Function` | `""` | yes | Extra class(es) merged onto every item row. Accepts a string, an array, an object (Vue-style class binding), or a `(item, index) => class` function for per-row classes, normalized via the cross-target class normalizer. Bridges `.list-group-item` and per-row layout/styling. |
| `itemStyle` | `String \| Object \| Function` | `null` | yes | Per-row inline style on the item wrapper. Accepts a CSS string, a flat style object (`Record<string, string \| number>`), or a `(item, index) => string \| object` function. Lands on the `.rozie-sortable-item` wrapper — the direct child of the list container — so it can drive CSS-grid placement (`grid-column` / `align-self`) when `listClass` sets `display: grid`. Normalized per target (React/Solid `parseInlineStyle`, Lit/Svelte `rozieStyle`, Vue/Angular native); `null` / empty drops the attribute. |

### Emits

| Event | Payload | Fires when |
| --- | --- | --- |
| `change` | `{ oldIndex, newIndex, item }` | Same-list reorder commit |
| `add` | `{ newIndex, item }` | Cross-list destination commit (item arrives) |
| `remove` | `{ oldIndex, item }` | Cross-list source commit (item leaves; NOT fired in clone mode) |
| `start` | `SortableEvent` | Drag starts |
| `end` | `SortableEvent` | Drag ends (source side) |

### Slots

#### Default (scoped) slot

The default slot renders each row and receives `{ item, index }`:

```rozie
<template #default="{ item, index }">
  <span>{{ index + 1 }}. {{ item.label }}</span>
</template>
```

To rename a slot param to a more readable local name in nested-template contexts, use the slot-param rename form `{ item: column }` — see [scoped slot params](/guide/features#slots-with-scoped-params).

#### `#header` / `#footer` slots

`#header` and `#footer` render inside the SortableJS container, as non-draggable siblings of the item rows (`#header` first, `#footer` last). Use them for an "Add item" row, a running total, an empty-state message, or any chrome that should sit with the list but not participate in the drag order.

```rozie
<SortableList r-model:items="$data.items" itemKey="id">
  <template #header>
    <div class="list-heading">Tasks ({{ $data.items.length }})</div>
  </template>
  <template #default="{ item }">
    <span>{{ item.label }}</span>
  </template>
  <template #footer>
    <button @click="addItem">+ Add item</button>
  </template>
</SortableList>
```

Header and footer are non-draggable: SortableJS is scoped to `.rozie-sortable-item` rows only (`draggable: '.rozie-sortable-item'`), so dropping onto or near the header/footer never reorders them and the DOM-restore index math stays item-relative.

### Imperative handle

Beyond props and the two-way `items` array, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getInstance` | Return the underlying SortableJS instance for direct API access — the raw-engine escape hatch (`save`, `closest`, … are one hop away). `null` before mount and after destroy. |
| `toArray` | Return the current order as an array of `data-id` strings. Each row carries `data-id="<key>"` (the same [`itemKey`](#api)-derived key as the reconciler), so the array reflects the live key order. `[]` before mount. |
| `sort` | Reorder the list by an array of `data-id` strings — `sort(order, useAnimation = true)`. |
| `option` | Read or set a live SortableJS option — `option(name)` gets, `option(name, value)` sets. The runtime escape hatch for any SortableJS option beyond the curated props (and the construction-time-only ones, within SortableJS's own limits). |

**React example:**

```tsx
import { useRef } from 'react';
import { SortableList, type SortableListHandle } from '@rozie-ui/sortable-list-react';

const sl = useRef<SortableListHandle>(null);
// <SortableList ref={sl} itemKey="id" ... />
const order = sl.current?.toArray();      // current key order
sl.current?.option('disabled', true);     // disable at runtime
const instance = sl.current?.getInstance(); // raw SortableJS instance
```

The four verb names are clear of all sixteen prop names and the five events (`option` is a distinct identifier from the `options` prop), so the `$expose` collision discipline (ROZ121) passes with no renames.

::: tip `toArray` / `sort` rely on `data-id`
Each rendered row carries `data-id="<key>"`, derived from [`itemKey`](#api) (falling back to the item value, then the index). Set `itemKey` for object lists so `toArray()` / `sort()` operate on stable keys rather than `"[object Object]"`.
:::

## Recipes

### Stable keys and the WeakMap default

`itemKey` controls the per-row key the framework reconciler tracks each item by across a reorder. It resolves in four tiers, top-down:

1. **Function** — `:itemKey="(item, index) => item.id"`. Use it for a computed/derived key, or to disambiguate reorderable **duplicate primitives** (`['a', 'a', 'b']`) where a value-based key would collide.
2. **Property name** — `itemKey="id"` reads `item.id`. The common case for object lists with a natural id.
3. **WeakMap synthetic id (the default for objects)** — with no `itemKey`, each object item is assigned a stable synthetic key the first time it's seen, held in an internal `WeakMap` keyed by **object identity**. The same object keeps the same key across reorders.
4. **Index (fallback for primitives)** — primitive items with no `itemKey` fall back to their position.

**Why the WeakMap default matters.** Before it, id-less object items were keyed by index. On a reorder the item *contents* move between positions but the index keys stay put, so the framework reconciles "row 0's data changed from A to B" instead of "A moved to row 1." Any per-row local state seeded at mount — an expanded/open flag, an uncontrolled input, a focus marker — then stays bound to the **position**, not the item, and visibly jumps to the wrong row after a drag. Keying by object identity keeps that mount-seeded state with its item.

You only need to set `itemKey` explicitly for object lists with a natural id (marginally cheaper than the WeakMap, and required for [`toArray()` / `sort()`](#imperative-handle) to report meaningful keys rather than `"[object Object]"`) or for reorderable duplicate primitives.

### Drag handle

The default behavior is "grab anywhere in the row." To require a specific drag handle element, pass `:handle="$classSelector('grip')"` and apply `class="grip"` to the handle element inside the slot:

```rozie
<SortableList r-model:items="$data.items" :handle="$classSelector('grip')">
  <template #default="{ item }">
    <div class="row">
      <span class="grip">⋮⋮</span>
      <span>{{ item.label }}</span>
    </div>
  </template>
</SortableList>
```

`$classSelector` lowers to the bare literal selector (`".grip"`) on all six targets — see [the dedicated `$classSelector` doc](/guide/features#classselector-—-handing-a-class-name-to-a-vanilla-js-engine). It isn't required for correctness (React keeps authored class names literal too, so a plain `".grip"` already matches); it's a compile-time typo-check so the engine can't reference a class you never declared.

The canonical example is [`SortableListDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListDemo.rozie).

### Cross-list drag

Two `<SortableList>` instances sharing a `group` name accept items between each other. Items leaving the source fire `remove`; items arriving at the destination fire `add`. Both bound arrays update independently.

```rozie
<SortableList r-model:items="$data.todoList" group="tasks" itemKey="id">
  <template #default="{ item }">{{ item.label }}</template>
</SortableList>

<SortableList r-model:items="$data.doneList" group="tasks" itemKey="id">
  <template #default="{ item }">{{ item.label }}</template>
</SortableList>
```

The canonical example is [`SortableListPairDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListPairDemo.rozie).

### Nested SortableList (Kanban)

A `<SortableList>` can host another `<SortableList>` (or a wrapper component that owns one) inside its slot. The outer list uses one group name (`'columns'`); the inner lists use a different one (`'cards'`) so column-reorder and card-reorder don't bleed into each other.

The canonical example is [`SortableListNestedDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListNestedDemo.rozie) — a three-column Kanban board with reorderable columns AND reorderable cards within and between columns.

### Keyboard accessibility

`SortableList` ships with keyboard-driven reorder out of the box. Tab to a row, Space to lift, ArrowUp/ArrowDown to move, Space (or Enter) to drop, Escape to cancel. The aria-live announcer reads "Lifted X", "Moved X to position N", "Dropped X at position N", "Cancelled lift of X".

The cross-target focus-restoration after a keyed reorder is handled via Rozie's [`$restoreFocus`](/guide/features#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders) sigil — Svelte / Solid / Lit re-create row DOM on reorder (focus drops to `<body>` natively); the sigil restores it. Vue / React / Angular preserve identity natively and the sigil is a no-op.

To customize the aria-live label per row, pass `:labelFor="(item) => item.title"` — by default the announcer reads `item.label` (or `String(item)` if no `label` field).

### Clone mode

A `cloneable: true` source list deposits a COPY of the dragged item onto the destination instead of moving the original. The source's bound array stays unchanged. The classic use case is a palette → canvas pattern (drag widget templates from a palette onto a design canvas).

```rozie
<!-- Palette: clones outbound -->
<SortableList
  r-model:items="$data.palette"
  group="palette-canvas"
  :cloneable="true"
>
  <template #default="{ item }">{{ item.label }}</template>
</SortableList>

<!-- Canvas: receives copies -->
<SortableList
  r-model:items="$data.canvas"
  group="palette-canvas"
>
  <template #default="{ item }">{{ item.label }}</template>
</SortableList>
```

Under the hood:

1. `cloneable: true` + a string `group` lowers to SortableJS's `{ name: 'palette-canvas', pull: 'clone', put: true }` object form.
2. The helper's `onClone` hook bridges the `__rozieItem` stash from the original DOM node to its clone so the destination's `onAdd` can recover the dragged item DATA.
3. `handleCommit`'s source-side branch short-circuits on `e.pullMode === 'clone'` — no splice, no DOM-restore, no `remove` change. The palette's items array is unchanged.
4. The destination's `onAdd` fires normally with `kind: 'add'` and the cloned item.

The canonical example is [`SortableListCloneDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListCloneDemo.rozie).

::: warning `cloneable: true` with `group: null` is a no-op
A clone-mode list with no group name has no peer that can join its cross-list flow — there's nothing to clone INTO. The wrapper leaves `group` untouched in that case (no lowering to the object form). Always pair `cloneable: true` with a `group` string.
:::

### Filter — locked items

`:filter="<selector>"` prevents drag initiation on matching rows. SortableJS checks the selector at `mousedown`/`touchstart` and aborts the drag if it matches.

A `data-*` attribute selector is the most robust choice — it's independent of styling and crosses every target's scoping / shadow-DOM transformation identically:

```rozie
<SortableList r-model:items="$data.items" filter="[data-locked]">
  <template #default="{ item }">
    <div class="row" :data-locked="item.locked ? 'true' : null">
      <span r-if="item.locked">🔒</span>
      <span>{{ item.label }}</span>
    </div>
  </template>
</SortableList>
```

A class-selector filter (`filter=".item-locked"`) also works on all six targets now — authored class names render literally everywhere (React scopes via `[data-rozie-s-<hash>]`, it no longer hashes the class name), so SortableJS's literal-string match resolves. The `data-*` form is still recommended only because it's independent of styling. (`filter` has no `$classSelector`-style typo-check the way `handle` does — SortableJS doesn't expose a programmatic selector-rewrite path for this option — so a `data-*` selector keeps it simple.)

The canonical example is [`SortableListFilterDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListFilterDemo.rozie).

### Custom ghost / chosen / drag styling

`ghostClass`, `chosenClass`, and `dragClass` are SortableJS-native class-name props. The helper forwards them via `instance.option(name, v)` on change, so toggling a preset at runtime takes effect without a remount.

```rozie
<SortableList
  r-model:items="$data.items"
  ghostClass="ghost-highlight"
  chosenClass="chosen-bold"
  dragClass="drag-tilt"
>
  …
</SortableList>

<style>
.ghost-highlight { background: #fff8b8; border-color: #d4be00; }
.chosen-bold     { box-shadow: 0 0 0 3px rgba(204, 0, 102, 0.6); }
.drag-tilt       { transform: rotate(2deg); }
</style>
```

SortableJS calls `el.classList.add('ghost-highlight')` with the literal name, and because authored class names render literally on every target — React included — the rule matches at runtime everywhere. No `:global { … }` opt-out or other per-target workaround is needed.

### Force fallback for touch and consistent behavior

`forceFallback: true` skips SortableJS's HTML5-DnD path entirely and uses the mouse-event fallback for every drag. Useful for:

- Touch devices where HTML5 DnD is patchy.
- Cross-browser test consistency (Playwright drives mouse events; HTML5 DnD events are flaky to drive synthetically).
- Custom drag previews — `dragClass` only takes effect in fallback mode.

This is a **construction-time-only** knob (SortableJS reads it once at `new Sortable(el, …)`). To toggle it at runtime, re-key the `<SortableList>`:

```rozie
<SortableList
  :key="$data.forceFallback ? 'fb' : 'native'"
  :forceFallback="$data.forceFallback"
  …
/>
```

### Disable temporarily

`:disabled="$data.disabled"` is reapplied via `instance.option('disabled', v)` on change — no remount, no DOM rebuild, drag is just blocked at the engine level until you toggle back.

### Animation tuning

`animation` (ms) and `easing` (CSS easing string) are runtime-updatable. Pair with an `<input type="range">` for a live tuner; the canonical example is [`SortableListShowcaseDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListShowcaseDemo.rozie), which exposes every prop in a control panel.

### List and item class hooks

`listClass` merges extra classes onto the SortableJS container; `itemClass` merges them onto every row. They're the styling hook for bridging a CSS framework (`.list-group` / `.list-group-item`) or a flex/grid parent onto the component's own DOM without forking the wrapper. Both accept any shape a Vue class binding does — a **string**, a **`string[]`**, or a **`Record<string, boolean>`** object — normalized identically across all six targets:

```rozie
<SortableList
  r-model:items="$data.items"
  listClass="list-group"
  :itemClass="['list-group-item', { compact: $data.dense }]"
>
  <template #default="{ item }">{{ item.label }}</template>
</SortableList>
```

A static `itemClass` / `itemStyle` is applied to every row uniformly, so its object form keys off component-level state (like `$data.dense` above), not per-item fields. For **per-row** class or style that depends on the item, pass a **function** — see below.

### Per-row class and style (function form)

`itemClass` and `itemStyle` each also accept an `(item, index) => …` function, evaluated per row at render time and applied to that row's `.rozie-sortable-item` wrapper:

- **`itemClass`** → returns a class value (string, array, or object) for the row.
- **`itemStyle`** → returns a CSS string or a flat style object (`Record<string, string | number>`) for the row.

```rozie
<SortableList
  r-model:items="$data.cells"
  listClass="grid-zone"
  :itemClass="(item) => ({ active: item.active, bordered: item.bordered })"
  :itemStyle="(item) => ({ gridColumn: `span ${item.span}`, alignSelf: item.align })"
>
  <template #default="{ item }">{{ item.label }}</template>
</SortableList>

<style>
.grid-zone { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
</style>
```

**Why this lands on the wrapper matters for CSS grid.** `itemStyle` is applied to `.rozie-sortable-item` — the *direct child* of the list container. CSS-grid placement (`grid-column`, `grid-row`, `align-self`) only applies to a direct grid child, so styling inner slot content does nothing; putting it on the wrapper is the only way to make each row a correctly-spanning grid cell.

Because evaluation happens during render, changing reactive state the function reads (a selection flag, a span value) re-applies the result on the next render — no manual refresh. A function returning `null`, an empty string, or an empty object adds no `class` / `style` artifact.

Each target normalizes the returned shape natively — React/Solid via `parseInlineStyle`, Lit/Svelte via `rozieStyle`, Vue/Angular via their built-in `:style` handling — so a returned **object** renders real CSS on every target (not `[object Object]`).

## Remount on construction-time-only changes

`forceFallback` is the one remaining knob SortableJS bakes into the instance at construction time — SortableJS exposes no `option()` path for it. To make it runtime-tunable from the consumer side, re-key the `<SortableList>` on its value:

```rozie
<SortableList
  :key="$data.forceFallback ? 'fb' : 'native'"
  :forceFallback="$data.forceFallback"
  …
/>
```

When it changes, the framework reconciler unmounts the old `<SortableList>` and mounts a fresh one. The bound `items` array survives across the remount (it's bound to the parent's `$data`), so the user-visible content is preserved — only the engine instance is rebuilt.

`swapThreshold` and `cloneable` no longer need this pattern; both are live-reconciled via `instance.option()` — see the [Props table](#props) above.

`SortableListShowcaseDemo` still folds `cloneable`/`swapThreshold` into its `:key` alongside `forceFallback` (a harmless superset re-key, exercised by the visual-regression pipeline) — even though only `forceFallback` requires it now.

## Gotchas

### Engine DOM mutation and the keyed reconciler

SortableJS physically moves DOM nodes on drop. Five of six target reconcilers cope with this natively (their diff-against-`parent.children` patch path tolerates the engine's mutations); Lit's `lit-html` `repeat` directive keys its parts cache by sentinel-comment node identity and needs an explicit reconcile signal. The wrapper handles this for you via the [`r-external` + `$reconcileAfterDomMutation()`](/guide/features#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own) pair — you don't need to wire these yourself unless you fork the wrapper.

### Class-name props are literal on every target

SortableJS reads `handle`, `filter`, `ghostClass`, `chosenClass`, and `dragClass` as literal strings. Authored class names render literally on all six targets — React scopes styles via a `[data-rozie-s-<hash>]` attribute rather than hashing the class name (the same model as Vue's `<style scoped>`), so a literal `'.grip'` selector matches the rendered `class="grip"` and `classList.add('ghost-highlight')` lands on a class your `<style>` rule targets.

That means none of these props need a per-target workaround:

- **Selectors** (`handle`, `filter`): a plain `'.grip'` / `'.item-locked'` resolves on every target. On `handle` you can optionally author it as [`$classSelector('grip')`](/guide/features#classselector-—-handing-a-class-name-to-a-vanilla-js-engine) to get a compile-time typo-check; `filter` has no such helper, so a plain class or `data-*` selector is the way.
- **Class names to add** (`ghostClass`, `chosenClass`, `dragClass`): pass the bare class name; SortableJS attaches it to the live ghost/chosen/drag element and the matching `<style>` rule applies on every target. (No `:global { … }` opt-out is required — that was only relevant while React hashed class names, which it no longer does.)

### Lit shadow-DOM cross-component styling

A consumer trying to style child-component-rendered DOM via [`:deep(.rozie-sortable-list)`](/guide/features#deep-—-reaching-into-child-components-from-scoped-styles) crosses a shadow-DOM boundary on Lit, so `:deep()` (an intra-scope reach) cannot reach the inner DOM there. The working cross-shadow pattern is [`::part()`](/guide/features#part-—-cross-shadow-styling-for-lit-children): the `SortableList` producer exposes the element with the standard HTML `part="<name>"` attribute, and the consumer styles it with `SortableList::part(<name>)`.

```rozie
<!-- Consumer styling the SortableList's exposed part across the Lit shadow boundary. -->
<style>
SortableList::part(list) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
</style>
```

On Lit this lowers to the confined cross-shadow rule `rozie-sortable-list[data-rozie-s-<hash>]::part(list)`, which pierces the child's shadow boundary and styles the element the producer tagged `part="list"`. The other five targets have no shadow boundary, so the `::part()` rule is dropped as a no-op there and they handle their own scoping natively (and `:deep(.rozie-sortable-list)` still works on those five via per-target lowering — React/Solid use `:global()`). See the [`::part()` vs `:deep()`](/guide/features#part-vs-deep) distinction in the features guide for when to reach for each.

## Cross-references

- [`:deep()` — cross-component scoped CSS](/guide/features#deep-—-reaching-into-child-components-from-scoped-styles)
- [`$classSelector()` — class-name-as-selector for vanilla-JS engines](/guide/features#classselector-—-handing-a-class-name-to-a-vanilla-js-engine)
- [`$restoreFocus()` — keep focus on a row across keyed-reconciler re-renders](/guide/features#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders)
- [`r-external` and `$reconcileAfterDomMutation()` — DOM the framework doesn't own](/guide/features#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own)
- [Sortable libraries comparison](/components/sortable-comparison) — feature matrix vs react-sortablejs, dnd-kit, Vue.Draggable, svelte-dnd-action, Angular CDK
- [`SortableList.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/src/SortableList.rozie) — the canonical wrapper (now colocated in the `@rozie-ui/sortable-list` package)
- [`useSortableJS()` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/src/internal/useSortableJS.ts) — the framework-agnostic SortableJS-vs-reconciler bridge (colocated + vendored into each leaf package's `src/internal/`)
