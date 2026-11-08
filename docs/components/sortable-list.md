# SortableList — the cross-framework drag-and-drop component

`SortableList` is a data-bound port of [SortableJS](https://sortablejs.github.io/Sortable/). It ships as React, Vue, Svelte, Angular, Solid, and Lit components, with a feature set that every standalone library on the [Sortable libraries comparison](/components/sortable-comparison) matrix either skips or implements partially.

This page covers the API reference, live demos, and the recipes for the long tail of what you'd want a drag-and-drop list to do. The [comparison page](/components/sortable-comparison) sets it against the per-framework alternatives.

The full source for `SortableList.rozie` lives in [the canonical example page](/examples/sortable-list).

## The `@rozie-ui/sortable-list` packages

`SortableList` ships as six pre-compiled, per-framework packages. Install the one for your framework; there is no build step and no Rozie toolchain to add. Most builds also pull in a small [tree-shaken `@rozie/runtime-*` helper package](/guide/output-and-runtime):

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/sortable-list-react` | `npm i @rozie-ui/sortable-list-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/react/README.md) |
| `@rozie-ui/sortable-list-vue` | `npm i @rozie-ui/sortable-list-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/vue/README.md) |
| `@rozie-ui/sortable-list-svelte` | `npm i @rozie-ui/sortable-list-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/svelte/README.md) |
| `@rozie-ui/sortable-list-angular` | `npm i @rozie-ui/sortable-list-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/angular/README.md) |
| `@rozie-ui/sortable-list-solid` | `npm i @rozie-ui/sortable-list-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/solid/README.md) |
| `@rozie-ui/sortable-list-lit` | `npm i @rozie-ui/sortable-list-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/packages/lit/README.md) |

Each package carries `sortablejs ^1.15` plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit`). This page documents the API surface shared by all six packages; the [comparison page](/components/sortable-comparison) covers how it stacks up against the per-framework libraries, and the [example page](/examples/sortable-list) shows the per-target compiled output side by side.

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

`r-model:items` is Rozie's [two-way bind on an array](/guide/props-and-two-way#model-true-→-idiomatic-two-way-binding-everywhere) — the consumer hands SortableList an array, SortableList writes the reordered array back, and the framework reconciler picks up the change without any `onChange → setState` wiring.

To see what each target's emitted code looks like, visit the [SortableList example page](/examples/sortable-list) — it ships the live source plus the per-target compiled output.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `items` | `Array` | `[]` | yes (via `r-model`) | The bound items array. `model: true` — reorders write back through the two-way path. |
| `itemKey` | `String \| Function` | `null` | yes | Property name OR a `(item, index) => key` function for the per-row key. With neither, id-less object items get a stable synthetic key via an internal WeakMap; primitive items fall back to index — pass a function for reorderable duplicate primitives. Improves keyed-reconciler behavior on Vue / Svelte / React. |
| `handle` | `String` | `null` | yes | CSS selector identifying the per-row drag handle. A plain `.grip` works on every target — authored class names render literally everywhere (React included). [`$classSelector('grip')`](/guide/engine-wrappers#classselector-—-handing-a-class-name-to-a-vanilla-js-engine) is an optional, typo-checked way to author it. |
| `group` | `String \| Object` | `null` | yes | SortableJS group name (cross-list drag) or full object form. Use `cloneable: true` to flip a string group into clone-mode. Lists sharing a group also exchange rows by keyboard (Shift+arrow while lifted) — see [Moving between lists by keyboard](#moving-between-lists-by-keyboard). |
| `animation` | `Number` | `150` | yes | Animation duration in ms. `0` disables. |
| `disabled` | `Boolean` | `false` | yes | Temporarily disable drag without unmounting. Also suppresses keyboard reordering — a disabled list is not sortable by any input, so rows lose their tabindex and the keydown handler no-ops. |
| `disableKeyboard` | `Boolean` | `false` | yes | Opt out of keyboard reordering (Space lift / Arrow move / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no tabindex) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`. |
| `keyboardTrigger` | `String` | `"row"` | yes | Which element drives keyboard reordering. `'row'` (default): rows are tab stops and the keys on the focused row drive reordering. `'handle'`: rows are NOT tab stops, and only keys pressed inside the element matched by `handle` (inside that row) drive the same Space/Enter lift-drop, Arrow move and Escape cancel flow; handled keys call preventDefault so a handle `<button>`'s click does not fire. The consumer owns the handle markup (recommended: a `<button>` with its own aria-label such as "Reorder Hero banner") and the component adds no tabindex or role to slot content. `'handle'` without `handle` turns keyboard reordering off and logs a console warning. `disabled`/`disableKeyboard` still apply. Any value other than `'handle'` behaves as `'row'`. See [Handle-only keyboard reordering](#handle-only-keyboard-reordering). |
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
| `listLabel` | `String` | `null` | yes | The list's human name, such as `"Top sidebar"`. Sets `aria-label` on the list container (`role="list"`) and names the list in keyboard announcements. Pass the same words as the zone's visible heading. |
| `orientation` | `String` | `"vertical"` | yes | Which arrow keys move a lifted row within the list: `'vertical'` (default) uses ↑/↓, `'horizontal'` uses ←/→. A horizontal list's default spoken instructions say "Use the left and right arrow keys to move". |
| `pageStep` | `Number` | `5` | yes | How many positions Page Up / Page Down move a lifted row. The move stops at the first or last position when fewer rows remain. |
| `keyboardInstructions` | `String` | `null` | yes | Replaces the spoken keyboard instructions, read via `aria-describedby` when a row (row mode) or handle (handle mode, through the `instructionsId` slot prop) gets focus. See [Keyboard accessibility](#keyboard-accessibility). |
| `itemStyle` | `String \| Object \| Function` | `null` | yes | Per-row inline style on the item wrapper. Accepts a CSS string, a flat style object (`Record<string, string \| number>`), or a `(item, index) => string \| object` function. Lands on the `.rozie-sortable-item` wrapper — the direct child of the list container — so it can drive CSS-grid placement (`grid-column` / `align-self`) when `listClass` sets `display: grid`. Normalized per target (React/Solid `parseInlineStyle`, Lit/Svelte `rozieStyle`, Vue/Angular native); `null` / empty drops the attribute. |

### Events

| Event | Payload | Fires when |
| --- | --- | --- |
| `change` | `{ oldIndex, newIndex, item, interaction }` | Same-list reorder commit (each keyboard move, too) |
| `add` | `{ newIndex, item, interaction }` | Cross-list destination commit (item arrives) |
| `remove` | `{ oldIndex, item, interaction }` | Cross-list source commit (item leaves; NOT fired in clone mode) |
| `start` | `SortableEvent` (pointer) / keyboard payload | Drag starts, or a row is lifted by keyboard |
| `end` | `SortableEvent` (pointer) / keyboard payload | Drag ends (source side), or a keyboard lift is dropped or cancelled |

Every payload carries `interaction: 'pointer' | 'keyboard'`. Pointer `start` / `end` hand over SortableJS's own event object with `interaction` added to it. Keyboard `start` / `end` hand over `{ interaction: 'keyboard', item, data, from, to, oldIndex, newIndex }`, where `item` is the row element (as in SortableJS), `data` is the item value, and `from` / `to` are the list elements. Keyboard `start` fires once on lift; `end` fires once on drop or cancel, from the list the row ends up in. Hops between lists emit only `remove` (source) and `add` (destination). `end` also fires, with `item: null`, when a lift is lost because the consumer removed the lifted item from the bound array mid-lift.

### Slots

#### Default (scoped) slot

The default slot renders each row and receives `{ item, index }`:

```rozie
<template #default="{ item, index }">
  <span>{{ index + 1 }}. {{ item.label }}</span>
</template>
```

To rename a slot param to a more readable local name in nested-template contexts, use the slot-param rename form `{ item: column }` — see [scoped slot params](/guide/composition#slots-with-scoped-params).

#### `#header` / `#footer` slots

`#header` and `#footer` render inside the SortableJS container, as non-draggable siblings of the item rows (`#header` first, `#footer` last). That container is the `role="list"` element, so header and footer content is read as part of the list. Use them for an "Add item" row, a running total, an empty-state message, or any chrome that should sit with the list but not participate in the drag order.

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

The four verb names don't collide with any prop or event name (`option` is a distinct identifier from the `options` prop), so Rozie's rule that an `$expose` verb may not share a name with a prop or emit passes with no renames.

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

`$classSelector` lowers to the bare literal selector (`".grip"`) — see [the dedicated `$classSelector` doc](/guide/engine-wrappers#classselector-—-handing-a-class-name-to-a-vanilla-js-engine). It isn't required for correctness (React keeps authored class names literal too, so a plain `".grip"` already matches); it's a compile-time typo-check so the engine can't reference a class you never declared.

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

`SortableList` ships with keyboard-driven reorder out of the box. Tab to a row and press Space (or Enter) to lift it. While it is lifted:

- ArrowUp / ArrowDown move it one position (ArrowLeft / ArrowRight with `orientation="horizontal"`).
- Home / End move it to the first / last position.
- Page Up / Page Down move it by `pageStep` positions (default 5), stopping at the ends.
- Shift plus the same arrow keys hop it to the previous or next list in the same `group` (see [Moving between lists by keyboard](#moving-between-lists-by-keyboard)).
- Space (or Enter) drops it.
- Escape cancels: the row goes back to the list and position it was lifted from. A clone copy is removed.

These keys act only while a row is lifted, so they never take keys away from fields inside a row. The aria-live announcer reads "Lifted X", "Moved X to position N", "Dropped X at position N", and "Cancelled. X returned to position N".

The list container carries `role="list"` and `aria-label` from `listLabel`. (`role="list"` takes no `aria-orientation`, so a horizontal list says which keys to use in its instructions instead.) `#header` and `#footer` content renders inside that `role="list"` element. Spoken instructions sit in a hidden element that each tabbable row references with `aria-describedby`: "Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel." With `orientation="horizontal"` the second sentence reads "Use the left and right arrow keys to move, Home and End to jump, and Escape to cancel." Pass `keyboardInstructions` to say it in your own words (for example "widget" instead of "row").

After every keyboard move, focus returns to the moved row (or its handle in handle mode) on all six frameworks. The component looks the row up by key, so it finds it whether the framework kept the row element or re-created it.

To customize the aria-live label per row, pass `:labelFor="(item) => item.title"` — by default the announcer reads `item.label` (or `String(item)` if no `label` field).

#### Moving between lists by keyboard

Where lists share a `group`, a lifted row can hop between them. Hopping is on automatically wherever `group` is set; there is no opt-in prop. Give each list a `listLabel` that matches the visible heading of its zone, and set `itemKey` on every grouped list.

```rozie
<h3>Top sidebar</h3>
<SortableList r-model:items="$data.top" group="layout" itemKey="id" listLabel="Top sidebar" />

<h3>Main content</h3>
<SortableList r-model:items="$data.main" group="layout" itemKey="id" listLabel="Main content" />

<h3>Footer</h3>
<SortableList r-model:items="$data.footer" group="layout" itemKey="id" listLabel="Footer" />
```

| Key (row lifted) | Action |
| --- | --- |
| Arrow Up / Down (Left / Right when `orientation="horizontal"`) | Move one position within the list |
| Shift + the same arrows | Hop to the previous / next list |
| Home / End | First / last position |
| Page Up / Page Down | Move by `pageStep` (default 5, minimum 1), stopping at the ends |
| Space or Enter | Drop |
| Escape | Cancel: return to the origin list and position (a clone copy is removed) |

The keys work the same in row mode and handle mode. A forward hop lands at the top of the next list; a backward hop lands at the bottom of the previous one. An empty list takes the row at position 1.

A list is a hop target only when all of these hold:

- Its `put` accepts the source, by the same rules SortableJS uses for a mouse drag. With no `put`, only lists of the same group name accept it. `put: true` accepts a row from any group, and a group name or an array of names accepts those groups, so a list of a different group can be reached. Ungrouped lists are never reached. `options.group` takes precedence over the `group` prop, exactly as for mouse drags.
- The source's `pull` is not `false` (a `pull` name or array must include the target's group).
- Its keyboard is enabled (not `disabled`, not `disableKeyboard`).
- It is not inside the lifted row, and it is rendered: it has a layout box and no ancestor is `inert`, `hidden` or `aria-hidden="true"`. Other lists are skipped.
- Its `pull`/`put` are not functions. A function can only be evaluated against a live drag, so a pair with a function-valued `pull` or `put` is unreachable by keyboard. Use `false`, `true`, a name or an array if you need keyboard access.

"Next" and "previous" follow source order in the composed tree (across shadow roots on Lit), not visual position. When there is nowhere to go, the announcer says `No list after {list}` or `No list before {list}`.

Only one keyboard lift exists on a page at a time. Keys act on it from the lifted row (or its handle). Pressing Space or Enter on any other row, in the same group or another, drops the active lift and lifts that row; arrow keys on another row do nothing. One exception: right after a move, while focus is still returning to the lifted row, keys pressed on another row of the same group go to the lifted row, so a fast Space or Enter there only drops it. If a re-render drops focus to `<body>` mid-lift, the next keys still reach the lifted row; if you click somewhere else, keys are left alone.

A `cloneable` palette resolves to `put: true`, so with keyboard hops it accepts rows from every list of its group, and from other groups too: Shift+↑ could move a live widget into the palette. A palette should take nothing back. Give it the object form with `put: false` instead of `cloneable`:

```rozie
<SortableList
  r-model:items="$data.palette"
  itemKey="id"
  :options="{ group: { name: 'zones', pull: 'clone', put: false } }"
  listLabel="Palette"
/>
```

Announcements: `Moved {label} to {list}, position {n}`, `Dropped {label} in {list} at position {n}` (whenever the row hopped, even if it hopped back into its origin), and `Cancelled. {label} returned to {list}, position {n}` (`Cancelled. {label} returned to position {n}` when the row never left its list). If the origin list has gone, is hidden, or has its keyboard turned off, the cancel reads `Cancelled. {label} stays in {list}, position {n}` and the row stays where it is; if a clone copy is cancelled after its palette unmounted, `Cancelled. {label} removed from {list}`. `{list}` is `listLabel`, or else `list {i} of {n}`, counting the lists of the same group in hop order. Pass the zone's visible heading text as `listLabel` so spoken names match what sighted users see.

With a clone palette, repeated deposits of the same palette item share that item's key. Give the copy a fresh id in the destination's `end` handler, after the drop. Don't do it in `add`: a keyboard hop fires `add` while the row is still lifted, and re-keying an item while it is lifted ends the lift. (Swapping the lifted item for a new object with the same key is fine, and so is changing its key in place on the same object; the lift follows it.) When a lift ends because the consumer changed its data, the list says `Lift ended`, fires `end` with `item: null`, and moves focus to the nearest row if focus was lost (or to the list itself if it has no rows left).

#### Instructions

The hidden instructions text defaults to "Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel." (with `orientation="horizontal"`, "Use the left and right arrow keys to move"), and, when `group` is set, adds " Hold Shift with an arrow key to move to another list." Pass `keyboardInstructions` to replace it. In row mode each tabbable row references it with `aria-describedby`. In handle mode, bind the default slot's `instructionsId` to the handle button's `aria-describedby` (see the example below). On Lit, plain-HTML consumers cannot do this: an id reference does not cross a shadow root, so give the handle its own `aria-label` or description instead.

#### Handle-only keyboard reordering

Rows that contain inputs or other interactive content are awkward as keyboard targets: every row becomes a tab stop, and Space or Enter typed into a row's input is a conflict. Set `keyboardTrigger="handle"` to move keyboard reordering onto a handle button that you render inside each row.

```rozie
<SortableList
  r-model:items="$data.items"
  itemKey="id"
  keyboardTrigger="handle"
  :handle="$classSelector('grip')"
>
  <template #default="{ item, instructionsId }">
    <div class="row">
      <button type="button" class="grip" :aria-label="'Reorder ' + item.label" :aria-describedby="instructionsId">⋮⋮</button>
      <input placeholder="note" />
    </div>
  </template>
</SortableList>
```

The rules:

- Rows are not tab stops. Tab moves handle, then the row's input, then the next row's handle.
- Only keys pressed inside the handle count. It is the same Space/Enter lift and drop, ArrowUp/ArrowDown move and Escape cancel flow, with the same aria-live announcements. Typing into the row's input is left alone.
- Handled keys call `preventDefault`, so the handle button's own click does not fire.
- Focus returns to the moved row's handle after each move, on every framework.
- You own the handle markup and its accessible name. The component adds no `tabindex` or `role` to slot content.
- The default slot receives `instructionsId`, the id of the hidden instructions element. Bind it as the handle's `aria-describedby` so screen readers read the keys on focus. On Lit this works for Rozie consumers, whose slot content renders inside the list's shadow root; plain-HTML consumers of the Lit element can't reference an id across the shadow boundary.
- Without a `handle` selector, keyboard reordering is off (and the list is not a keyboard hop target) and a console warning is logged. There is no silent fallback to row mode.
- `disabled` and `disableKeyboard` still turn keyboard reordering off.

### Clone mode

A `cloneable: true` source list deposits a COPY of the dragged item onto the destination instead of moving the original. The source's bound array stays unchanged. The classic use case is a palette → canvas pattern (drag widget templates from a palette onto a design canvas).

`cloneable` sets `put: true`, so the palette also accepts rows dragged or keyboard-hopped into it. If the palette should take nothing back, pass the object form instead: `:options="{ group: { name: 'palette-canvas', pull: 'clone', put: false } }"` (see [Moving between lists by keyboard](#moving-between-lists-by-keyboard)).

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

A class-selector filter (`filter=".item-locked"`) also works now — authored class names render literally everywhere (React scopes via `[data-rozie-s-<hash>]`, it no longer hashes the class name), so SortableJS's literal-string match resolves. The `data-*` form is still recommended only because it's independent of styling. (`filter` has no `$classSelector`-style typo-check the way `handle` does — SortableJS doesn't expose a programmatic selector-rewrite path for this option — so a `data-*` selector keeps it simple.)

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

`listClass` merges extra classes onto the SortableJS container; `itemClass` merges them onto every row. They're the styling hook for bridging a CSS framework (`.list-group` / `.list-group-item`) or a flex/grid parent onto the component's own DOM without forking the wrapper. Both accept any shape a Vue class binding does — a **string**, a **`string[]`**, or a **`Record<string, boolean>`** object — normalized identically:

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

SortableJS physically moves DOM nodes on drop. Five of six target reconcilers cope with this natively (their diff-against-`parent.children` patch path tolerates the engine's mutations); Lit's `lit-html` `repeat` directive keys its parts cache by sentinel-comment node identity and needs an explicit reconcile signal. The wrapper handles this for you via the [`r-external` + `$reconcileAfterDomMutation()`](/guide/engine-wrappers#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own) pair — you don't need to wire these yourself unless you fork the wrapper.

### Class-name props are literal on every target

SortableJS reads `handle`, `filter`, `ghostClass`, `chosenClass`, and `dragClass` as literal strings. Authored class names render literally — React scopes styles via a `[data-rozie-s-<hash>]` attribute rather than hashing the class name (the same model as Vue's `<style scoped>`), so a literal `'.grip'` selector matches the rendered `class="grip"` and `classList.add('ghost-highlight')` lands on a class your `<style>` rule targets.

That means none of these props need a per-target workaround:

- **Selectors** (`handle`, `filter`): a plain `'.grip'` / `'.item-locked'` resolves on every target. On `handle` you can optionally author it as [`$classSelector('grip')`](/guide/engine-wrappers#classselector-—-handing-a-class-name-to-a-vanilla-js-engine) to get a compile-time typo-check; `filter` has no such helper, so a plain class or `data-*` selector is the way.
- **Class names to add** (`ghostClass`, `chosenClass`, `dragClass`): pass the bare class name; SortableJS attaches it to the live ghost/chosen/drag element and the matching `<style>` rule applies on every target. (No `:global { … }` opt-out is required — that was only relevant while React hashed class names, which it no longer does.)

### Lit shadow-DOM cross-component styling

A consumer trying to style child-component-rendered DOM via [`:deep(.rozie-sortable-list)`](/guide/styling#deep-—-reaching-into-child-components-from-scoped-styles) crosses a shadow-DOM boundary on Lit, so `:deep()` (an intra-scope reach) cannot reach the inner DOM there. The working cross-shadow pattern is [`::part()`](/guide/styling#part-—-cross-shadow-styling-for-lit-children): the `SortableList` producer exposes the element with the standard HTML `part="<name>"` attribute, and the consumer styles it with `SortableList::part(<name>)`.

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

On Lit this lowers to the confined cross-shadow rule `rozie-sortable-list[data-rozie-s-<hash>]::part(list)`, which pierces the child's shadow boundary and styles the element the producer tagged `part="list"`. The other five targets have no shadow boundary, so the `::part()` rule is dropped as a no-op there and they handle their own scoping natively (and `:deep(.rozie-sortable-list)` still works on those five via per-target lowering — React/Solid use `:global()`). See the [`::part()` vs `:deep()`](/guide/styling#part-vs-deep) distinction in the features guide for when to reach for each.

## Cross-references

- [`:deep()` — cross-component scoped CSS](/guide/styling#deep-—-reaching-into-child-components-from-scoped-styles)
- [`$classSelector()` — class-name-as-selector for vanilla-JS engines](/guide/engine-wrappers#classselector-—-handing-a-class-name-to-a-vanilla-js-engine)
- [`$restoreFocus()` — keep focus on a row across keyed-reconciler re-renders](/guide/engine-wrappers#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders)
- [`r-external` and `$reconcileAfterDomMutation()` — DOM the framework doesn't own](/guide/engine-wrappers#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own)
- [Sortable libraries comparison](/components/sortable-comparison) — feature matrix vs react-sortablejs, dnd-kit, Vue.Draggable, svelte-dnd-action, Angular CDK
- [`SortableList.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/src/SortableList.rozie) — the canonical wrapper (now colocated in the `@rozie-ui/sortable-list` package)
- [`useSortableJS()` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/src/internal/useSortableJS.ts) — the framework-agnostic SortableJS-vs-reconciler bridge (colocated + vendored into each leaf package's `src/internal/`)
