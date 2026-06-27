# @rozie-ui/listbox-lit

Idiomatic **lit** `Listbox` — a headless, fully-accessible (WAI-ARIA) select-only listbox (single + multi-select, type-ahead, full keyboard navigation) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. No third-party engine; every value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/listbox-lit
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/listbox-lit';

// <rozie-listbox> is a custom element. Bind `options`/`value` as properties and
// listen for the `value-change` event to receive the new selection.
const el = document.querySelector('rozie-listbox');
el.options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' },
  ];
el.addEventListener('value-change', (e) => {
  el.value = e.detail;
});
```

## Theming

Every visual value is a `--rozie-listbox-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/listbox-lit/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `options` | `Array` | `[]` |  |  |
| `value` | `unknown` | `null` | ✓ |  |
| `multiple` | `Boolean` | `false` |  |  |
| `inline` | `Boolean` | `false` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `placeholder` | `String` | `''` |  |  |
| `closeOnSelect` | `Boolean` | `true` |  |  |
| `optionLabel` | `Function` | `null` |  |  |
| `optionValue` | `Function` | `null` |  |  |
| `optionDisabled` | `Function` | `null` |  |  |
| `id` | `String` | `"rozie-listbox"` |  |  |
| `ariaLabel` | `String` | `null` |  |  |

## Events

| Event | Description |
| --- | --- |
| `open-change` | Fired whenever the popup opens or closes. Payload `{ open: boolean }`. |
| `change` | Fired after the selection changes. Payload `{ value, option }` — `value` is the new selected value (an array in multi-select), `option` is the toggled option (`null` when cleared). |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `open` | Open the popup (no-op when disabled or already open). |
| `close` | Close the popup. |
| `toggle` | Toggle the popup open/closed. |
| `clear` | Clear the selection (`null`, or `[]` in multi-select) and reset the combobox query. |
| `focusControl` | Move DOM focus to the control (the combobox input, or the select-only trigger button). |

```ts
// The custom element IS the handle — exposed methods are public element
// methods. (focusControl, not focus — focus is the native HTMLElement method.)
const el = document.querySelector('rozie-listbox');
el.open();
el.focusControl();
```

## Slots

| Slot | Params |
| --- | --- |
| selected | selected, value |
| option | option, index, active, selected, disabled |
| empty | query |
