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

Each package carries `sortablejs ^1.15` plus its framework peers: `react` + `react-dom`, `vue`, `svelte`, `@angular/core` + `@angular/common` + `@angular/forms` (the component is a form control), `solid-js`, or `lit` + `@lit-labs/preact-signals` + `@preact/signals-core`. Each package's README has a framework-specific quick start. This page documents the API surface shared by all six packages; the [comparison page](/components/sortable-comparison) covers how it stacks up against the per-framework libraries, and the [example page](/examples/sortable-list) shows the per-target compiled output side by side.

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
| `handle` | `String` | `null` | yes | CSS selector identifying the per-row drag handle. A plain `.grip` works on every target — authored class names render literally everywhere (React included). [`$classSelector('grip')`](/guide/engine-wrappers#classselector-—-handing-a-class-name-to-a-vanilla-js-engine) is an optional, typo-checked way to author it. `options.handle` and `option('handle', v)` win over this prop, for the keyboard (`keyboardTrigger: 'handle'`) as for the mouse. |
| `group` | `String` | `null` | yes | SortableJS group name (cross-list drag). For the object form (`{ name, pull, put }`), pass `options.group`, which wins over `group` and `cloneable`. Use `cloneable: true` to flip a string group into clone-mode. Lists sharing a group also exchange rows by keyboard (Shift+arrow while lifted) — see [Moving between lists by keyboard](#moving-between-lists-by-keyboard). |
| `animation` | `Number` | `150` | yes | Animation duration in ms. `0` disables. Reapplied live via `instance.option('animation', v)`. `options.animation`, and a runtime `option('animation', v)`, win over this prop. |
| `disabled` | `Boolean` | `false` | yes | Temporarily disable drag without unmounting. Also suppresses keyboard reordering — a disabled list is not sortable by any input, so rows lose their tabindex and the keydown handler no-ops. Turning it on while a row is lifted ends the lift where the row is (`Lift ended`, and `end` fires). `options.disabled` and `option('disabled', v)` do the same. |
| `disableKeyboard` | `Boolean` | `false` | yes | Opt out of keyboard reordering (Space/Enter lift and drop, arrow / Home / End / Page Up / Page Down moves, Shift+arrow hop between lists, Escape cancel) while leaving pointer drag enabled. Rows drop out of the tab order (no tabindex) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`. Turning it on while a row is lifted ends the lift where the row is. |
| `keyboardTrigger` | `SortableKeyboardTrigger` | `"row"` | yes | Which element drives keyboard reordering. `'row'` (default): rows are tab stops and the keys on the focused row drive reordering. `'handle'`: rows are NOT tab stops, and only keys pressed inside the element matched by `handle` (inside that row) drive the same keys as row mode (lift, drop, every move key, Shift+arrow hop, Escape cancel); handled keys call preventDefault so a handle `<button>`'s click does not fire. The consumer owns the handle markup (recommended: a `<button>` with its own aria-label such as "Reorder Hero banner") and the component adds no tabindex or role to slot content. `'handle'` without `handle` turns keyboard reordering off and logs a console warning. `disabled`/`disableKeyboard` still apply. Typed `SortableKeyboardTrigger` (`'row' \| 'handle'`); at runtime any value other than `'handle'` behaves as `'row'`. See [Handle-only keyboard reordering](#handle-only-keyboard-reordering). |
| `ghostClass` | `String` | `null` | yes | Class name applied to the drop-placeholder element. See [Custom ghost / chosen / drag styling](#custom-ghost-chosen-drag-styling). |
| `chosenClass` | `String` | `null` | yes | Class name applied to the currently-chosen item. |
| `dragClass` | `String` | `null` | yes | Class name applied to the dragging element. |
| `filter` | `String` | `null` | yes | CSS selector that prevents drag initiation on matching rows, by mouse and by keyboard. See [Filter — locked items](#filter-—-locked-items). |
| `easing` | `String` | `null` | yes | CSS easing function for the animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). |
| `forceFallback` | `Boolean` | `false` | **NO** | Force SortableJS's mouse-event drag path (over HTML5 DnD). Useful for touch testing and consistent cross-browser behavior. **Construction-time only** — see [Remount on construction-time-only changes](#remount-on-construction-time-only-changes). |
| `swapThreshold` | `Number` | `1` | yes | SortableJS swap-threshold (0..1). Lower = swap earlier. Reapplied live via `instance.option('swapThreshold', v)` — SortableJS reads it on every dragover, so no remount is needed. |
| `cloneable` | `Boolean` | `false` | yes | High-level prop that replaces a string `group` with SortableJS's `{ name, pull: 'clone', put: false }` object form: the list deposits copies and takes nothing back, by mouse or keyboard. See [Clone mode](#clone-mode). Reapplied live — toggling `cloneable` (or changing `group`) recomputes the clone-mode shape and reapplies it via `instance.option('group', …)`, no remount. |
| `options` | `Object` | `{}` | yes | Verbatim SortableJS options pass-through for anything not covered by the named props above. The named props win on key conflict, but `options` lands AFTER them in the merge so consumers can override defaults; handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onClone`) are stripped — the helper owns those paths. When `options` changes, each key whose value changed is reapplied via `instance.option(key, v)`, no remount, so mouse and keyboard obey the same values. A key you drop goes back to its named prop (`sort` and `draggable` to the component default); any other dropped key keeps its last value until you set it. `forceFallback` is read only at construction. |
| `labelFor` | `Function` | `null` | yes | Optional `(item, idx) => string` returning the screen-reader label for the aria-live announcer (keyboard-drag accessibility). Without it the announcer reads `item.label`, else the row's text, else `String(item)` for a primitive, else `item {position}`. |
| `listClass` | `String \| Array \| Object` | `""` | yes | Extra class(es) merged onto the list container (the SortableJS root). Accepts a string, an array, or an object (Vue-style class binding), normalized via the cross-target class normalizer. Bridges `.list-group`, a flex/grid parent, or `:nth-child` styling. |
| `itemClass` | `String \| Array \| Object \| Function` | `""` | yes | Extra class(es) merged onto every item row. Accepts a string, an array, an object (Vue-style class binding), or a `(item, index) => class` function for per-row classes, normalized via the cross-target class normalizer. Bridges `.list-group-item` and per-row layout/styling. |
| `listLabel` | `String` | `null` | yes | The list's human name, such as `"Top sidebar"`. Sets `aria-label` on the list container (`role="list"`) and names the list in keyboard announcements. Pass the same words as the zone's visible heading. |
| `orientation` | `SortableOrientation` | `"vertical"` | yes | Which arrow keys move a lifted row within the list: `'vertical'` (default) uses ↑/↓, `'horizontal'` uses ←/→. A horizontal list's default spoken instructions say "Use the left and right arrow keys to move". Typed `SortableOrientation` (`'vertical' \| 'horizontal'`). |
| `pageStep` | `Number` | `5` | yes | How many positions Page Up / Page Down move a lifted row. The move stops at the first or last position when fewer rows remain. |
| `keyboardInstructions` | `String` | `null` | yes | Replaces the spoken keyboard instructions, read via `aria-describedby` when a row (row mode) or handle (handle mode, through the `instructionsId` slot prop) gets focus. See [Instructions](#instructions) for the default text. |
| `announcements` | `Announcements` | `null` | yes | Rewords or translates what the list says during keyboard reordering: an object of optional functions, one per message kind, each taking a context and returning the text (`null` or `''` says nothing). Kinds without a function keep the default. Typed `Announcements` (exported with `AnnouncementKind` and `AnnouncementContext`). See [Announcements](#announcements). |
| `itemStyle` | `String \| Object \| Function` | `null` | yes | Per-row inline style on the item wrapper. Accepts a CSS string, a flat style object (`Record<string, string \| number>`), or a `(item, index) => string \| object` function. Lands on the `.rozie-sortable-item` wrapper — the direct child of the list container — so it can drive CSS-grid placement (`grid-column` / `align-self`) when `listClass` sets `display: grid`. Normalized per target (React/Solid `parseInlineStyle`, Lit/Svelte `rozieStyle`, Vue/Angular native); `null` / empty drops the attribute. |

### Events

| Event | Payload | Fires when |
| --- | --- | --- |
| `reorder` | `SortablePayload` | Same-list reorder commit (each keyboard move, too). Not fired for a drop back in place. |
| `add` | `SortablePayload` (`oldIndex: -1`) | Cross-list destination commit (item arrives) |
| `remove` | `SortablePayload` (`newIndex: -1`) | Cross-list source commit (item leaves). A clone source keeps its row, so it doesn't fire it; cancelling a keyboard clone copy fires it from the list the copy leaves. |
| `start` | `SortablePayload` | A drag starts, or a row is lifted by keyboard. From the origin list. |
| `end` | `SortablePayload` | A drag or keyboard lift ends. Once, from the list the row ends up in, after every list has written its items. |

Every event, mouse or keyboard, carries the same payload:

```ts
interface SortablePayload {
  interaction: 'pointer' | 'keyboard';
  item: unknown;              // the item's data value (never an element)
  el: HTMLElement | null;     // the row element; null when there is none
  from: HTMLElement;          // the list element the row came from
  to: HTMLElement;            // the list element the row went to
  oldIndex: number;           // index in `from`; -1 for `add`
  newIndex: number;           // index in `to`; -1 for `remove` and a lost lift
  originalEvent?: unknown;    // mouse only: SortableJS's raw event
}
```

Indices count item rows only: `#header` / `#footer` content never shifts them. `el` is the row element when it exists; after a move into another list it can be the element that was moved, which that list replaces with its own row when it re-renders.

Each framework binds the events and the two-way `items` array its own way:

| Framework | Events | Payload | Two-way `items` |
| --- | --- | --- | --- |
| React | `onReorder`, `onAdd`, `onRemove`, `onStart`, `onEnd` | handler argument | `items` + `onItemsChange` (or `defaultItems`) |
| Vue | `@reorder`, `@add`, `@remove`, `@start`, `@end` | handler argument | `v-model:items` |
| Svelte | `onreorder`, `onadd`, `onremove`, `onstart`, `onend` | handler argument | `bind:items` |
| Angular | `(reorder)`, `(add)`, `(remove)`, `(start)`, `(end)` | `$event` | `[(items)]`, or `formControl` / `ngModel` |
| Solid | `onReorder`, `onAdd`, `onRemove`, `onStart`, `onEnd` | handler argument | `items` + `onItemsChange` |
| Lit | `reorder`, `add`, `remove`, `start`, `end` (`CustomEvent`s) | `e.detail` | `items` property + `items-change` event |

Order and source:

- `start` fires from the origin list.
- `reorder` / `add` / `remove` fire once the list that emits them has written its bound array. A move between lists, by mouse or keyboard, emits `add` from the destination and then `remove` from the source (a keyboard cancel that hands the row back does the same: `add` from the origin, then `remove` from the list it leaves).
- `end` fires once per drag or lift, from the list where the row ends up: the destination of a move between lists (a clone drop included), or the origin when the row is dropped back in place or outside any list. A mouse drop into a SortableJS list that is not a `SortableList` is refused (see below) and ends from the source as a drop in place. An unmounted list never emits: if the list the row ended up in unmounts before its pending `end` runs (for example, one your `add` handler removes), the origin list (the one that emitted `start`) emits that `end`, with `to` still the unmounted list's element, so `start` and `end` still pair; only when the origin has unmounted too is no `end` emitted. A keyboard lift whose list unmounts mid-lift ends the same way.
- `end` runs in a task scheduled after every list involved has written its bound array and emitted `reorder` / `add` / `remove` (a `setTimeout(0)` followed by one posted message), so the re-render those writes schedule, whether in a microtask, a timer or a posted message, has run first. For user input (mouse or keyboard) an `end` handler therefore sees the new order in its bound array on all six targets: `save(items)` works there. One exception: a React consumer that applies `onItemsChange` inside `startTransition` lets React defer that render past `end`, and may still read the old state there. If another drag or lift starts before a pending `end` has run, that `end` fires first, so every `end`, mouse or keyboard, comes before the next `start`. An `end` run early this way may still read the old order (see [Saving order](#saving-order)).
- Drags between a `SortableList` and a SortableJS list that is not a `SortableList` are refused in both directions, so a row never disappears. A row dropped in from such a list goes back where it came from and nothing is emitted (no `add`, no `end`). A row dropped from a `SortableList` into such a list goes back to its original position: nothing is written, no `remove` or `reorder` is emitted, and the source's `end` reports the drop in place (`to` is the source's list element, `newIndex` equals `oldIndex`). Use a `SortableList` on both sides.
- A mouse drop back where the row started writes nothing and fires no `reorder`; `start` and `end` still fire, with `oldIndex === newIndex`.
- Keyboard `start` fires once on lift and `end` once on drop or cancel. Each keyboard move emits its own `reorder` (within a list) or `add` + `remove` (a hop between lists). The first hop out of a clone source emits only `add`, since the source keeps its row; a copy hopped back into its own palette emits only `remove`.
- When a lift is lost because the consumer took the lifted item out of the bound array mid-lift, `end` still fires, with `item` set to the lifted value and `el: null`.

#### Saving order

`end` fires once, from the list the row ends up in, so on a move between lists the source fires `remove` and no `end`. A wrapper that saves each list from its own `end` handler (one per zone in a CMS, say) never saves the source after such a move, and if your backend stores each list's ordered ids, the item ends up saved in both lists. Either:

- save the source in its `remove` handler (it has written its array by then) and the destination in its `end` handler, or
- save every list the move touched from the destination's `end`, using `from` and `to` to tell which.

```rozie
<SortableList r-model:items="$data.top" group="zones" @remove="saveZone('top')" @end="saveZone('top')" />
```

```js
// Saves one zone's order; called from that zone's `remove` and `end`.
const saveZone = (zone) => api.saveZone(zone, $data[zone].map((w) => w.id))
```

If the destination unmounts before its `end` runs, the origin fires that `end` instead (`to` is the unmounted list's element, `el` is `null`); the destination's own handler never runs, so save the unmounted list from the code that removed it. A list that is only out of the page for a moment (moved in the DOM, or kept alive by Vue's `<KeepAlive>`) is still mounted and fires its own `end`.

One timing edge: an `end` forced to run early because a new drag or lift started within a few milliseconds of the drop (scripted input, mostly) runs before the framework re-rendered, so its handler may read the old order (React: the state of the last render). If that matters to you, work out the new order from the payload (`item`, `from`, `to`, `oldIndex`, `newIndex`) rather than from your state.

Lists nested inside rows (a grid widget's columns) are lists of their own: a drop into a column fires `end` from the column, not from the zone holding the grid row. The zone's own listeners don't hear the column's events, on any framework (Lit included: its events don't bubble).

### Slots

#### Default (scoped) slot

The default slot renders each row and receives `{ item, index, instructionsId }`:

```rozie
<template #default="{ item, index }">
  <span>{{ index + 1 }}. {{ item.label }}</span>
</template>
```

To rename a slot param to a more readable local name in nested-template contexts, use the slot-param rename form `{ item: column }` — see [scoped slot params](/guide/composition#slots-with-scoped-params).

From a framework package, fill it the framework's way:

| Framework | Rows | `header` / `footer` |
| --- | --- | --- |
| React | `children` function: `{({ item }) => …}` | `renderHeader` / `renderFooter` props |
| Vue | `<template #default="{ item }">` | `<template #header>` / `<template #footer>` |
| Svelte | `{#snippet children({ item })}` | `{#snippet header()}` / `{#snippet footer()}` |
| Angular | `<ng-template #defaultSlot let-item="item">` | `<ng-template #header>` / `<ng-template #footer>` |
| Solid | `children` function: `{({ item }) => …}` (`item` is the value, not an accessor) | `headerSlot` / `footerSlot` props |
| Lit | the `rozieSlots` property: ``el.rozieSlots = { default: ({ item }) => html`…` }`` | light-DOM children with `slot="header"` / `slot="footer"` |

On Lit, rows rendered through `rozieSlots.default` live inside the element's shadow root, so page CSS doesn't reach them; style them inside the template. (Rozie consumers compiled to Lit fill the slot their own way; the result is the same.)

#### `#header` / `#footer` slots

`#header` renders just before the list element and `#footer` just after it, inside the component's root. They are not part of the `role="list"` element (the SortableJS container), whose children are the item rows only. ARIA lets a list contain only list items, and screen readers count just the rows. Use them for a heading, a running total, an "Add item" button, or any chrome that should sit with the list but not take part in the drag order.

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

Header and footer are outside the drop area: a row dropped on them doesn't land in the list. To draw one box around header, rows and footer, wrap the component in your own element and style that: `listClass` styles the rows' container only. An empty list takes a mouse drop only within its own area, so give it a `min-height` through `listClass` (see [Cross-list drag](#cross-list-drag)).

### Imperative handle

Beyond props and the two-way `items` array, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getInstance` | Return the underlying SortableJS instance for direct API access — the raw-engine escape hatch (`save`, `closest`, … are one hop away). `null` before mount and after destroy. |
| `toArray` | Return the current order as an array of `data-id` strings. Each row carries `data-id="<key>"` (the same [`itemKey`](#api)-derived key as the reconciler), so the array reflects the live key order. `[]` before mount. |
| `sort` | Reorder the bound `items` by an array of `data-id` keys — `sort(order, useAnimation = true)`. The listed keys come first, in that order; every other row follows in its current order. The new array is written back through the two-way `items` binding and your framework re-renders the rows (SortableJS never moves them behind the model). No event fires, since the call is your own. With `useAnimation` and a non-zero `animation`, the rows slide into place. |
| `option` | Read or set a live SortableJS option — `option(name)` gets, `option(name, value)` sets. The runtime escape hatch for any SortableJS option beyond the curated props (and the construction-time-only ones, within SortableJS's own limits). `disabled`, `filter`, `draggable`, `sort`, `handle` and `group` set this way apply to the keyboard too, and a value set here wins over the matching prop and over `options` until `options` changes that key. A fresh function with the same content (an inline `filter`, or `group` with an inline `pull` / `put`, recreated on every React render) is not a change. |

**React example:**

```tsx
import { useRef } from 'react';
import { SortableList, type SortableListHandle } from '@rozie-ui/sortable-list-react';

const sl = useRef<SortableListHandle>(null);
// <SortableList ref={sl} itemKey="id" ... />
const order = sl.current?.toArray();      // current key order
sl.current?.sort(['c', 'a']);             // c, a, then the rest in order
sl.current?.option('disabled', true);     // disable at runtime (mouse and keyboard)
const instance = sl.current?.getInstance(); // raw SortableJS instance
```

The four verb names don't collide with any prop or event name (`option` is a distinct identifier from the `options` prop), so Rozie's rule that an `$expose` verb may not share a name with a prop or emit passes with no renames.

::: tip `toArray` / `sort` rely on `data-id`
Each rendered row carries `data-id="<key>"`, the same key the reconciler uses: from [`itemKey`](#api) when set; otherwise an object item gets an internal synthetic key (`__rk0`, `__rk1`, …) and a primitive item its index. Set `itemKey` so `toArray()` / `sort()` work with your own ids: synthetic keys mean nothing outside the component, and an index changes as rows move.
:::

## Recipes

### Stable keys and the WeakMap default

`itemKey` controls the per-row key the framework reconciler tracks each item by across a reorder. It resolves in four tiers, top-down:

1. **Function** — `:itemKey="(item, index) => item.id"`. Use it for a computed/derived key, or to disambiguate reorderable **duplicate primitives** (`['a', 'a', 'b']`) where a value-based key would collide.
2. **Property name** — `itemKey="id"` reads `item.id`. The common case for object lists with a natural id.
3. **WeakMap synthetic id (the default for objects)** — with no `itemKey`, each object item is assigned a stable synthetic key the first time it's seen, held in an internal `WeakMap` keyed by **object identity**. The same object keeps the same key across reorders.
4. **Index (fallback for primitives)** — primitive items with no `itemKey` fall back to their position.

**Why the WeakMap default matters.** Before it, id-less object items were keyed by index. On a reorder the item *contents* move between positions but the index keys stay put, so the framework reconciles "row 0's data changed from A to B" instead of "A moved to row 1." Any per-row local state seeded at mount — an expanded/open flag, an uncontrolled input, a focus marker — then stays bound to the **position**, not the item, and visibly jumps to the wrong row after a drag. Keying by object identity keeps that mount-seeded state with its item.

You only need to set `itemKey` explicitly for object lists with a natural id (marginally cheaper than the WeakMap, and required for [`toArray()` / `sort()`](#imperative-handle) to report your ids rather than synthetic `__rk<n>` keys) or for reorderable duplicate primitives.

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

An empty list needs height to receive a mouse drop: SortableJS finds the drop target by the pointer's position, and the list container has no height of its own once its last row has gone. Give it a `min-height` through `listClass` (for example a `.drop-zone { min-height: 3rem; }` class), or raise SortableJS's `emptyInsertThreshold` (the distance in px, default 5, at which an empty list takes the drop) through `options`. Keyboard hops reach an empty list regardless.

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

These keys act only while a row is lifted, so they never take keys away from fields inside a row. The aria-live announcer reads, for example, "Lifted Apple, position 1 of 5", "Moved Apple to position 2 of 5", "Dropped Apple at position 2 of 5" and "Cancelled. Apple returned to position 1 of 5". A key that would not move the row says why: "Apple is already first" or "Apple is already last". Every message can be reworded or translated; see [Announcements](#announcements).

The keyboard follows the same SortableJS rules as the mouse:

| Option | Keyboard behaviour |
| --- | --- |
| `filter` (prop or `options.filter`) | A row the filter matches can't be lifted. A key press counts as a press on the row itself, so a selector is matched against the row element and its slot root (the element your row template renders, when it covers the row), the elements a press on the row's body would hit. Any other control the filter matches (`filter: '.js-remove'`, `filter: 'input'`), whether nested in a wrapper or beside other content at the row's top level, blocks presses on that control only, as with the mouse, so the row still lifts. Only a lone wrapper (the row template's single element, with no text beside it) counts as covering the row. A function is called as SortableJS calls it, `filter({}, row, sortable)`, with a synthetic `{}` event; if it throws (for example by reading `evt.target`), the row is not filtered. Space or Enter on a filtered row does nothing and isn't prevented. |
| `options.draggable` | When set, only rows matching it can be lifted (a leading `>` is SortableJS's child syntax). |
| `disabled` (prop, `options.disabled` or `option('disabled', v)`) | Turns keyboard reordering off. Turning it on while a row is lifted ends the lift where the row is: the list says `Lift ended` and `end` fires. In row mode the rows leave the tab order, so if one of them had focus, focus moves to the list itself (never `<body>`). |
| `disableKeyboard` | Keyboard only: turns keyboard reordering off, ending a lift and moving focus the same way. |
| `options.sort: false` | No moves within the list: the arrow keys, Home, End, Page Up and Page Down move nothing, and each says `{label} can't be moved within {list}`. The default instructions leave out the move sentence. Hops to other lists still follow `pull` / `put`. |
| `group` `pull` / `put` | Decide which lists a row can hop to (see [Moving between lists by keyboard](#moving-between-lists-by-keyboard)). |

Two rules can't be evaluated without a live drag, so the keyboard doesn't apply them: `options.onMove` (it gets the drag's DOM event and the hovered element) and function-valued `pull` / `put`. A list whose `pull` or `put` is a function is never a keyboard hop target; an `onMove` veto applies to mouse drags only. Other rows can still be moved past a filtered row, as with the mouse. Options set at runtime through `option(name, value)` (for `disabled`, `filter`, `draggable` and `sort`) apply to the keyboard too. A change to the `options` prop object is reapplied to SortableJS key by key (no remount), so mouse and keyboard always follow the same values. Keys are compared by content, so an inline `options` object rebuilt on every render is not a change; a function inside it (`filter`, `group.pull` / `group.put`) that is new each render is passed on to SortableJS, so the newest closure runs, unless a runtime `option(name, value)` is set for that key.

The list container carries `role="list"` and `aria-label` from `listLabel`. (`role="list"` takes no `aria-orientation`, so a horizontal list says which keys to use in its instructions instead.) `#header` and `#footer` content renders outside that element, so its children are the rows only. Spoken instructions sit in a hidden element that each tabbable row references with `aria-describedby` (see [Instructions](#instructions) for the text). Pass `keyboardInstructions` to say it in your own words (for example "widget" instead of "row").

After every keyboard move, focus returns to the moved row (or its handle in handle mode) on all six frameworks. The component looks the row up by key, so it finds it whether the framework kept the row element or re-created it.

A focused row shows a 2px ring only for keyboard focus (`:focus-visible`), and the lifted row a 3px inset ring with a light tint. The ring is `#1a73e8` in every color scheme, so it has at least 3:1 contrast on light and dark rows alike (4.5:1 on white, 4.2:1 on `#121212`, 3.7:1 on `#1e1e1e`). If your rows use a background it doesn't contrast with (a mid-blue, say), set `--rozie-sortable-list-ring` to a color with 3:1 contrast against it. In handle mode the handle is your own element, so give it its own focus style.

To customize the aria-live label per row, pass `:labelFor="(item) => item.title"`. By default the announcer reads `item.label`; without a `label` field it reads the row's text (whitespace collapsed, without nested lists or hidden content), else `String(item)` for a primitive, else `item {position}`. Pass `labelFor` when the row's text is not a good name (a row full of controls, say).

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

A `cloneable` palette resolves to `put: false`, so it is never a hop target: Shift+arrow from a neighbouring list skips it (and says `No list before {list}` when there is nothing else), as a mouse drop onto it is refused.

Announcements: `Moved {label} to {list}, position {p} of {t}`, `Dropped {label} in {list} at position {p} of {t}` (whenever the row hopped, even if it hopped back into its origin), and `Cancelled. {label} returned to {list}, position {p} of {t}` (`Cancelled. {label} returned to position {p} of {t}` when the row never left its list). If the origin list has gone, is hidden, or has its keyboard turned off, the cancel reads `Cancelled. {label} stays in {list}, position {p} of {t}` and the row stays where it is; if a clone copy is cancelled after its palette unmounted, `Cancelled. {label} removed from {list}`. `{list}` is `listLabel`, or else `list {i} of {n}`, counting the lists of the same group in hop order. Pass the zone's visible heading text as `listLabel` so spoken names match what sighted users see. The full list, and how to change it, is under [Announcements](#announcements).

With a clone palette, repeated deposits of the same palette item share that item's key. Give the copy a fresh id in the destination's `end` handler (see [Clone mode](#clone-mode)); that works for mouse and keyboard drops alike. Don't do it in `add`: a keyboard hop fires `add` while the row is still lifted, and re-keying an item while it is lifted ends the lift. (Swapping the lifted item for a new object with the same key is fine, and so is changing its key in place on the same object; the lift follows it.) When a lift ends because the consumer changed its data, the list says `Lift ended`, fires `end` with the lifted value as `item` and `el: null`, and moves focus to the nearest row if focus was lost (or to the list itself if it has no rows left).

#### Instructions

The hidden instructions text defaults to:

> Press Space or Enter to pick up, and again to drop. Use the up and down arrow keys to move, Home and End to jump to the start or end, Page Up and Page Down to move several places, and Escape to cancel.

With `orientation="horizontal"` it says "the left and right arrow keys". A `sort: false` list can't move rows within itself, so its text is "Press Space or Enter to pick up, and again to drop. Press Escape to cancel." When another mounted list could take this list's rows (by the group rules SortableJS uses: the `group` prop, `options.group` or `option('group', v)`), " Hold Shift with an arrow key to move to another list." is added; the text updates as lists mount, unmount or change group. (Hidden lists, and lists with their keyboard off, still count.) Pass `keyboardInstructions` to replace all of it. In row mode each tabbable row references it with `aria-describedby`. In handle mode, bind the default slot's `instructionsId` to the handle button's `aria-describedby` (see the example below). On Lit this works for rows rendered through `rozieSlots.default` (and for Rozie consumers), which live inside the shadow root; light-DOM markup can't reference an id across the shadow root, so give such a handle its own `aria-label` or description instead.

#### Announcements

Everything the list says during keyboard reordering comes from one of the message kinds below. `{label}` is the row's label (`labelFor`, else `item.label`, else the row's text), `{p}` its 1-based position, `{t}` how many rows that list holds, and `{list}` the list's name (`listLabel`, or `list {i} of {n}`). The list holding the row speaks, in its own aria-live region.

| Kind | Context | Default |
| --- | --- | --- |
| `lifted` | `label`, `item`, `position`, `total`, `list` | `Lifted {label}, position {p} of {t}` |
| `moved` | `label`, `item`, `position`, `total`, `list` | `Moved {label} to position {p} of {t}` |
| `movedToList` | `label`, `item`, `position`, `total`, `list`, `fromList` | `Moved {label} to {list}, position {p} of {t}` |
| `dropped` | `label`, `item`, `position`, `total`, `list` | `Dropped {label} at position {p} of {t}` |
| `droppedInList` | `label`, `item`, `position`, `total`, `list` | `Dropped {label} in {list} at position {p} of {t}` |
| `atStart` | `label`, `item`, `position`, `total`, `list` | `{label} is already first` |
| `atEnd` | `label`, `item`, `position`, `total`, `list` | `{label} is already last` |
| `notSortable` | `label`, `item`, `list` | `{label} can't be moved within {list}` |
| `noListBefore` | `label`, `item`, `list` | `No list before {list}` |
| `noListAfter` | `label`, `item`, `list` | `No list after {list}` |
| `cancelledReturnedToList` | `label`, `item`, `position`, `total`, `list` | `Cancelled. {label} returned to {list}, position {p} of {t}` |
| `cancelledReturned` | `label`, `item`, `position`, `total`, `list` | `Cancelled. {label} returned to position {p} of {t}` |
| `cancelledStays` | `label`, `item`, `position`, `total`, `list` | `Cancelled. {label} stays in {list}, position {p} of {t}` |
| `cancelledRemoved` | `label`, `item`, `list` | `Cancelled. {label} removed from {list}` |
| `liftEnded` | `label`, `item`, `list` | `Lift ended` |

`atStart` and `atEnd` are said when an arrow key, Home, End, Page Up or Page Down would not move the row (in a sortable list). `notSortable` is said for those keys in a `sort: false` list. `droppedInList` and `cancelledReturnedToList` are used once the row has hopped to another list. `liftEnded` is said when the lift ends because the keyboard was turned off or the consumer's data took the row away. The same message twice in a row is still read out again.

Pass `announcements` to change any of them. Each key is an optional function that takes the context and returns the text; `null` or `''` says nothing, and kinds you leave out keep the default. Define the object in your script and bind it (Angular templates do not accept inline arrow functions). The type is exported from every package as `Announcements`, with `AnnouncementKind` and `AnnouncementContext`. To translate:

```rozie
<script>
const announcements = {
  lifted: ({ label, position, total }) => label + ' aufgenommen, Position ' + position + ' von ' + total,
  moved: ({ label, position, total }) => label + ' auf Position ' + position + ' von ' + total + ' verschoben',
  dropped: ({ label, position, total }) => label + ' auf Position ' + position + ' von ' + total + ' abgelegt',
  atStart: ({ label }) => label + ' ist bereits ganz oben',
  atEnd: ({ label }) => label + ' ist bereits ganz unten',
  cancelledReturned: ({ label, position, total }) => 'Abgebrochen. ' + label + ' zurück auf Position ' + position + ' von ' + total,
  liftEnded: () => 'Verschieben beendet',
}
</script>

<template>
<SortableList
  r-model:items="$data.tasks"
  itemKey="id"
  listLabel="Aufgaben"
  keyboardInstructions="Leertaste oder Enter zum Aufnehmen und erneut zum Ablegen. Pfeiltasten zum Verschieben, Escape zum Abbrechen."
  :announcements="announcements"
/>
</template>
```

In a TypeScript consumer, annotate it to get the context typed: `const announcements: Announcements = { … }` (React: `import { SortableList, type Announcements } from '@rozie-ui/sortable-list-react'`). Inline, <span v-pre>`announcements={{ moved: ({ label }) => … }}`</span> is typed from the prop.

The label is computed only when the text uses it, so `labelFor` is not called for a message that doesn't name the row. For `liftEnded` the row has left the list, so a `label` read there comes from the item and its last known index.

Instructions are one string, so pass `keyboardInstructions` alongside a translation (choose the wording for the list's orientation, `sort` and group yourself).

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
- The handle is the selector SortableJS runs with: the `handle` prop, or `options.handle` / `option('handle', v)`, which win over it.
- Only keys pressed inside the handle count. They are the same keys as row mode (Space/Enter lift and drop, the arrow keys, Home/End, Page Up/Page Down, Shift+arrow hop, Escape cancel), with the same aria-live announcements. Typing into the row's input is left alone.
- Handled keys call `preventDefault`, so the handle button's own click does not fire.
- Focus returns to the moved row's handle after each move, on every framework.
- You own the handle markup and its accessible name. The component adds no `tabindex` or `role` to slot content.
- The default slot receives `instructionsId`, the id of the hidden instructions element. Bind it as the handle's `aria-describedby` so screen readers read the keys on focus. It is `null` until the list has mounted (the id is assigned then, so server-rendered markup and the first browser render agree); `aria-describedby` bound to `null` renders no attribute. On Lit this works for rows rendered through `rozieSlots.default` (the Lit quick start) and for Rozie consumers, whose rows live inside the list's shadow root; markup placed in the element's light DOM can't reference an id across the shadow boundary.
- Without a `handle` selector, keyboard reordering is off (and the list is not a keyboard hop target) and a console warning is logged. There is no silent fallback to row mode.
- `disabled` and `disableKeyboard` still turn keyboard reordering off.

### Clone mode

A `cloneable: true` source list deposits a COPY of the dragged item onto the destination instead of moving the original. The source's bound array stays unchanged. The classic use case is a palette → canvas pattern (drag widget templates from a palette onto a design canvas).

`cloneable` sets `put: false`: the palette takes nothing back, so a row dragged or keyboard-hopped toward it stays where it was. To let a clone source also receive rows, pass the object form yourself, e.g. `:options="{ group: { name: 'palette-canvas', pull: 'clone', put: true } }"` (`options.group` wins over `group` and `cloneable`).

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
  @end="onCanvasEnd"
>
  <template #default="{ item }">{{ item.label }}</template>
</SortableList>
```

Every copy of a palette item is the same value, so two drops of one widget would give the canvas two rows with one key. Give the copy a fresh id in the canvas's `end` handler. `end` fires from the list the row lands in, after both lists have written their arrays, for mouse and keyboard drops, so the copy is already in `$data.canvas`:

```js
const onCanvasEnd = (e) => {
  if (e.from === e.to) return // a reorder within the canvas
  const i = $data.canvas.findIndex((w) => w.id === e.item.id)
  if (i < 0) return
  const next = [...$data.canvas]
  next[i] = { ...next[i], id: next[i].id + '-' + $data.nextDropId }
  $data.nextDropId = $data.nextDropId + 1
  $data.canvas = next
}
```

The copy is the one canvas row still carrying the palette item's id. Until you re-key it, the copy is the palette's own item object: replace it with a new object (as above), don't mutate it, or the change shows in the palette too. That holds in `add` / `reorder` handlers as well (writing a zone id or an order onto the dropped item there would also change the palette item). (On Lit the handler receives a `CustomEvent`; read the payload from its `detail`.) [`SortableListCloneDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListCloneDemo.rozie) uses this exact handler.

Don't re-key in `add` (a keyboard hop fires `add` while the row is still lifted; see [Moving between lists by keyboard](#moving-between-lists-by-keyboard)).

Under the hood:

1. `cloneable: true` + a string `group` lowers to SortableJS's `{ name: 'palette-canvas', pull: 'clone', put: false }` object form.
2. The helper's `onClone` hook bridges the `__rozieItem` stash from the original DOM node to its clone so the destination's `onAdd` can recover the dragged item DATA.
3. `handleCommit`'s source-side branch short-circuits on `e.pullMode === 'clone'` — no splice, no DOM-restore, no `remove` change. The palette's items array is unchanged.
4. The destination's `onAdd` fires normally with `kind: 'add'` and the cloned item, and the destination then emits `end`.

The canonical example is [`SortableListCloneDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListCloneDemo.rozie).

::: warning `cloneable: true` with `group: null` is a no-op
A clone-mode list with no group name has no peer that can join its cross-list flow — there's nothing to clone INTO. The wrapper leaves `group` untouched in that case (no lowering to the object form). Always pair `cloneable: true` with a `group` string.
:::

### Filter — locked items

`:filter="<selector>"` prevents drag initiation on matching rows. SortableJS checks the selector at `mousedown`/`touchstart` and aborts the drag if it matches. The keyboard honours it too: a matching row can't be lifted with Space or Enter (see [Keyboard accessibility](#keyboard-accessibility)).

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

`:disabled="$data.disabled"` is reapplied via `instance.option('disabled', v)` on change — no remount, no DOM rebuild. Mouse and keyboard reordering both stop until you toggle back. `options.disabled` and the imperative `option('disabled', true)` do the same.

### Animation tuning

`animation` (ms) and `easing` (CSS easing string) are runtime-updatable: each change is reapplied via `instance.option()`. Pair with an `<input type="range">` for a live tuner; the canonical example is [`SortableListShowcaseDemo`](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListShowcaseDemo.rozie), which exposes every prop in a control panel.

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

## Scope

`SortableList` is built on SortableJS and doesn't hide it. The `options` prop, `getInstance()` and `option()` are SortableJS pass-throughs: they take and return SortableJS's own option names and instance, and follow SortableJS's semantics and version. `options.onMove` applies to mouse drags only (it needs a live drag).

Not supported yet:

- **Drags between a `SortableList` and a SortableJS list that isn't one**, in either direction. The row goes back where it came from, and no `add`, `remove` or `reorder` is emitted.
- **Two-dimensional keyboard movement.** In a grid layout the arrow keys still move a row one place forward or back in list order (`orientation` picks which pair of arrow keys); there is no up/down-a-row movement across columns.
- **Right-to-left arrow mapping.** With `orientation="horizontal"`, ArrowLeft always moves toward the start of the list and ArrowRight toward the end, whatever the text direction.
- **Extra SortableJS plugins** mounted with `Sortable.mount` (MultiDrag, Swap, and the like). The component handles SortableJS's events and writes the bound arrays itself, so a plugin that changes what a drop does isn't supported.
- **A "move up / move down / move to list" button recipe** for pointer users who can't drag (WCAG 2.5.7). You can build one today with your own buttons that write the bound array; there is no ready-made recipe.
- **TypeScript generics** for the item type: `item` in events is typed `unknown` (the handlers take a `SortablePayload`, exported from every package) and `item` in slots `any`.

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
