# @rozie-ui/sortable-list-solid

Idiomatic **solid** `SortableList` — a cross-framework drag-and-drop list compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source via SortableJS. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/sortable-list-solid
```

Peer dependencies: `sortablejs ^1.15` + `solid-js`. Install them alongside this package.

## Usage

```tsx
import { createSignal } from 'solid-js';
import { SortableList } from '@rozie-ui/sortable-list-solid';

export function Demo() {
  const [items, setItems] = createSignal([
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ]);
  return (
    <SortableList items={items()} onItemsChange={setItems} itemKey="id">
      {({ item }) => <span>{item().label}</span>}
    </SortableList>
  );
}
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `items` | `Array` | `[]` | ✓ |  |
| `itemKey` | `String` | `null` |  |  |
| `handle` | `String` | `null` |  |  |
| `group` | `String` | `null` |  |  |
| `animation` | `Number` | `150` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
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

## Events

| Event | Description |
| --- | --- |
| `change` | Fired after the list order changes (same-list reorder commit). |
| `add` | Fired when an item is added from another list (cross-list destination commit). |
| `remove` | Fired when an item is moved out to another list (cross-list source commit; not fired in clone mode). |
| `start` | Fired when dragging starts. |
| `end` | Fired when dragging ends (source side). |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `getInstance` | Return the underlying SortableJS instance for direct API access (the raw-engine escape hatch — `save`, `closest`, etc. are one hop away). `null` before mount and after destroy. |
| `toArray` | Return the current order as an array of `data-id` strings (each row carries `data-id="<key>"`). `[]` before mount. |
| `sort` | Reorder the list by an array of `data-id` strings — `sort(order, useAnimation = true)`. |
| `option` | Read or set a live SortableJS option — `option(name)` gets, `option(name, value)` sets. The runtime escape hatch for options beyond the curated props. |

```tsx
import { SortableList, type SortableListHandle } from '@rozie-ui/sortable-list-solid';

let handle: SortableListHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<SortableList ref={(h) => (handle = h)} />;
const order = handle?.toArray();
```

## Slots

| Slot | Params |
| --- | --- |
| (default) | item, index |
