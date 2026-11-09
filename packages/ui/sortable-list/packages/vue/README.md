# @rozie-ui/sortable-list-vue

Idiomatic **vue** `SortableList` — a cross-framework drag-and-drop list compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source via SortableJS. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/sortable-list-vue
```

Peer dependencies: `vue ^3.4`, `sortablejs ^1.15`. Install them alongside this package.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import SortableList from '@rozie-ui/sortable-list-vue';

const items = ref([
  { id: '1', label: 'Apple' },
  { id: '2', label: 'Banana' },
]);
</script>

<template>
  <SortableList v-model:items="items" item-key="id">
    <template #default="{ item }">
      <span>{{ item.label }}</span>
    </template>
  </SortableList>
</template>
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `items` | `Array` | `[]` | ✓ |  |
| `itemKey` | `String \| Function` | `null` |  |  |
| `handle` | `String` | `null` |  |  |
| `group` | `String` | `null` |  |  |
| `animation` | `Number` | `150` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `disableKeyboard` | `Boolean` | `false` |  |  |
| `keyboardTrigger` | `SortableKeyboardTrigger` | `"row"` |  |  |
| `options` | `Object` | `{}` |  |  |
| `labelFor` | `Function` | `null` |  |  |
| `ghostClass` | `String` | `null` |  |  |
| `chosenClass` | `String` | `null` |  |  |
| `dragClass` | `String` | `null` |  |  |
| `filter` | `String` | `null` |  |  |
| `easing` | `String` | `null` |  |  |
| `forceFallback` | `Boolean` | `false` |  |  |
| `swapThreshold` | `Number` | `1` |  |  |
| `cloneable` | `Boolean` | `false` |  |  |
| `listClass` | `String \| Array \| Object` | `""` |  |  |
| `itemClass` | `String \| Array \| Object \| Function` | `""` |  |  |
| `listLabel` | `String` | `null` |  |  |
| `orientation` | `SortableOrientation` | `"vertical"` |  |  |
| `pageStep` | `Number` | `5` |  |  |
| `keyboardInstructions` | `String` | `null` |  |  |
| `announcements` | `Announcements` | `null` |  |  |
| `itemStyle` | `String \| Object \| Function` | `null` |  |  |

## Events

| Event | Bind as | Description |
| --- | --- | --- |
| `reorder` | `@reorder` | Fired after a row moves within the list: a drag, or each keyboard move. Not fired for a drop back in place. |
| `add` | `@add` | Fired by the destination list when a row arrives from another list (a clone copy included). |
| `remove` | `@remove` | Fired by the source list when a row leaves it for another list. A clone source keeps its row and does not fire it; cancelling a keyboard clone copy fires it from the list the copy leaves. |
| `start` | `@start` | Fired when a drag starts or a row is lifted by keyboard, from the origin list. |
| `end` | `@end` | Fired once when a drag or keyboard lift ends, from the list the row ends up in, after the bound arrays are written. |

Each handler receives the payload. Every event, pointer or keyboard, carries the same payload: `{ interaction, item, el, from, to, oldIndex, newIndex, originalEvent? }`. `interaction` is `'pointer'` or `'keyboard'`; `item` is the row's data value; `el` is the row element (`null` when there is none); `from` / `to` are the list elements; `oldIndex` / `newIndex` count item rows only (`-1` on the side that has none, as in `add` / `remove`); `originalEvent` is the SortableJS event on pointer drags only. `end` fires once, after every list involved has written its array, from the list where the row ends up. A drop back in place writes nothing and fires no `reorder`.

The reordered array is written back through `v-model:items` (the `@update:items` event).

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `getInstance` | Return the underlying SortableJS instance for direct API access (the raw-engine escape hatch — `save`, `closest`, etc. are one hop away). `null` before mount and after destroy. |
| `toArray` | Return the current order as an array of `data-id` strings (each row carries `data-id="<key>"`). `[]` before mount. |
| `sort` | Reorder the list by an array of `data-id` strings — `sort(order, useAnimation = true)`. |
| `option` | Read or set a live SortableJS option — `option(name)` gets, `option(name, value)` sets. The runtime escape hatch for options beyond the curated props. |

```vue
<script setup>
import { ref } from 'vue';
const sl = ref();          // template ref
</script>

<template>
  <SortableList ref="sl" />
  <button @click="console.log(sl.toArray())">Log order</button>
</template>
```

## Slots

Rows render from `<template #default="{ item, index, instructionsId }">`. Fill `header` / `footer` with `<template #header>` / `<template #footer>`.

| Slot | Params |
| --- | --- |
| header |  |
| (default) | item, index, instructionsId |
| footer |  |
