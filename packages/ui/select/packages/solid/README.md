# @rozie-ui/select-solid

Idiomatic **solid** `Select` — a headless, fully-accessible (WAI-ARIA) select-only select (single + multi-select, type-ahead, full keyboard navigation) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. No third-party engine; every value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/select-solid
```

Peer dependencies: `solid-js`. Install them alongside this package.

**Required peers** — beyond the framework peer above, this package requires these non-optional peers to actually render:

- `@rozie-ui/popover-solid` `^0.2.0 || ^0.3.0` — required by `@rozie-ui/select-solid`
- `@floating-ui/dom` `^1.7.2` — required by `@rozie-ui/popover-solid`

Install the whole chain in one line:

```bash
npm i @rozie-ui/select-solid @rozie-ui/popover-solid @floating-ui/dom
```

Also installed: `@rozie/runtime-solid` — Rozie's small, tree-shaken runtime helper package (controllable state, keyboard navigation, event modifiers, and safe interpolation). It arrives as a regular dependency, so npm pulls it for you. Your bundler keeps only the helpers this component actually uses — typically a few hundred bytes to a few KB, minified and gzipped. [What's in it and what it costs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md).

## Usage

```tsx
import { createSignal } from 'solid-js';
import { Select } from '@rozie-ui/select-solid';

export function Demo() {
  const [value, setValue] = createSignal<string | null>(null);
  const options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' },
  ];
  return (
    <Select
      value={value()}
      onValueChange={setValue}
      options={options}
      placeholder="Pick a fruit…"
      // Custom option render via the optionSlot prop (Solid's scoped slots
      // are props, not children); the ctx fields are plain values, not
      // signal accessors. Sibling scoped slots follow the same pattern:
      // selectedSlot ({ selected, value }) and emptySlot ({ query }).
      optionSlot={({ option, selected }) => <span classList={{ selected }}>{option.label}</span>}
    />
  );
}
```

## Theming

Every visual value is a `--rozie-select-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```tsx
import '@rozie-ui/select-solid/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
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
| `idBase` | `String` | `''` |  |  |
| `hideEmpty` | `Boolean` | `false` |  |  |
| `selectOnTab` | `Boolean` | `false` |  |  |
| `clearable` | `Boolean` | `false` |  |  |
| `clearLabel` | `String` | `"Clear"` |  |  |
| `placement` | `String` | `"bottom-start"` |  |  |
| `offset` | `Number` | `4` |  |  |
| `disableFlip` | `Boolean` | `false` |  |  |
| `disableShift` | `Boolean` | `false` |  |  |
| `block` | `Boolean` | `false` |  |  |
| `groups` | `Array` | `[]` |  |  |
| `ariaLabel` | `String` | `null` |  |  |
| `virtual` | `Boolean` | `false` |  |  |
| `estimateRowHeight` | `Number` | `36` |  |  |
| `maxHeight` | `String` | `''` |  |  |

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

```tsx
import { Select, type SelectHandle } from '@rozie-ui/select-solid';

let handle: SelectHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Select ref={(h) => (handle = h)} options={options} />;
handle?.open();
```

## Slots

| Slot | Params |
| --- | --- |
| selected | selected, value |
| option | option, index, active, selected, disabled |
| empty | query |
| groupHeading | group |
