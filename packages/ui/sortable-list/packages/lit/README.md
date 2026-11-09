# @rozie-ui/sortable-list-lit

Idiomatic **lit** `SortableList` — a cross-framework drag-and-drop list compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source via SortableJS. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/sortable-list-lit
```

Peer dependencies: `lit ^3.2`, `@lit-labs/preact-signals ^1.0.0`, `@preact/signals-core ^1.3.0`, `sortablejs ^1.15`. Install them alongside this package.

Also installed: `@rozie/runtime-lit` — Rozie's small, tree-shaken runtime helper package (controllable state, keyboard navigation, event modifiers, and safe interpolation). It arrives as a regular dependency, so npm pulls it for you. Your bundler keeps only the helpers this component actually uses — typically a few hundred bytes to a few KB, minified and gzipped. [What's in it and what it costs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md).

## Usage

```ts
import { html } from 'lit';
import '@rozie-ui/sortable-list-lit'; // registers <rozie-sortable-list>
import type { SortableList } from '@rozie-ui/sortable-list-lit';

// The page holds <rozie-sortable-list></rozie-sortable-list>.
const el = document.querySelector<SortableList>('rozie-sortable-list')!;
el.itemKey = 'id';
el.items = [
  { id: '1', label: 'Apple' },
  { id: '2', label: 'Banana' },
];
// Row content: `rozieSlots.default` maps each row's
// { item, index, instructionsId } to a lit template.
el.rozieSlots = {
  default: ({ item }) => html`<span>${item.label}</span>`,
};
// `items` is two-way: the reordered array arrives in `items-change`.
el.addEventListener('items-change', (e) => {
  el.items = (e as CustomEvent<unknown[]>).detail;
});
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

| Event | Listen for | Description |
| --- | --- | --- |
| `reorder` | `reorder` | Fired after a row moves within the list: a drag, or each keyboard move. Not fired for a drop back in place. |
| `add` | `add` | Fired by the destination list when a row arrives from another list (a clone copy included). |
| `remove` | `remove` | Fired by the source list when a row leaves it for another list. A clone source keeps its row and does not fire it; cancelling a keyboard clone copy fires it from the list the copy leaves. |
| `start` | `start` | Fired when a drag starts or a row is lifted by keyboard, from the origin list. |
| `end` | `end` | Fired once when a drag or keyboard lift ends, from the list the row ends up in, after the bound arrays are written. |

Each event is a `CustomEvent`; the payload is `e.detail`. Every event, pointer or keyboard, carries the same payload: `{ interaction, item, el, from, to, oldIndex, newIndex, originalEvent? }`. `interaction` is `'pointer'` or `'keyboard'`; `item` is the row's data value; `el` is the row element (`null` when there is none); `from` / `to` are the list elements; `oldIndex` / `newIndex` count item rows only (`-1` on the side that has none, as in `add` / `remove`); `originalEvent` is the SortableJS event on pointer drags only. `end` fires once, after every list involved has written its array, from the list where the row ends up. A drop back in place writes nothing and fires no `reorder`.

The reordered array arrives in the `items-change` event (`e.detail`); set it back on `items`.

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `getInstance` | Return the underlying SortableJS instance for direct API access (the raw-engine escape hatch — `save`, `closest`, etc. are one hop away). `null` before mount and after destroy. |
| `toArray` | Return the current order as an array of `data-id` strings (each row carries `data-id="<key>"`). `[]` before mount. |
| `sort` | Reorder the list by an array of `data-id` strings — `sort(order, useAnimation = true)`. |
| `option` | Read or set a live SortableJS option — `option(name)` gets, `option(name, value)` sets. The runtime escape hatch for options beyond the curated props. |

```ts
// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-sortable-list');
const order = el.toArray();
el.option('disabled', true);
```

## Slots

Rows render from `rozieSlots.default`: set the element's `rozieSlots` property to an object whose `default` is a function from `{ item, index, instructionsId }` to a lit template, called once per row. Its markup renders inside the element's shadow root, so page CSS does not reach it (style it inside the template), and a handle in it can use `instructionsId` for `aria-describedby`. Fill `header` / `footer` with light-DOM children carrying `slot="header"` / `slot="footer"`.

| Slot | Params |
| --- | --- |
| header |  |
| (default) | item, index, instructionsId |
| footer |  |
