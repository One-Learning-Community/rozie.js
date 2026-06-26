# @rozie-ui/listbox-vue

Idiomatic **vue** `Listbox` — a headless, fully-accessible (WAI-ARIA) listbox / combobox (single + multi-select, type-ahead, full keyboard navigation) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. No third-party engine; every value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/listbox-vue
```

Peer dependencies: `vue`. Install them alongside this package.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Listbox from '@rozie-ui/listbox-vue';

const value = ref<string | null>(null);
const options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' },
  ];
</script>

<template>
  <Listbox v-model:value="value" :options="options" combobox placeholder="Search fruit…">
    <template #option="{ option, active, selected }">
      <span :class="{ active, selected }">{{ option.label }}</span>
    </template>
  </Listbox>
</template>
```

## Theming

Every visual value is a `--rozie-listbox-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/listbox-vue/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `options` | `Array` | `[]` |  |  |
| `value` | `unknown` | `null` | ✓ |  |
| `multiple` | `Boolean` | `false` |  |  |
| `combobox` | `Boolean` | `false` |  |  |
| `inline` | `Boolean` | `false` |  |  |
| `filterable` | `Boolean` | `true` |  |  |
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
| `search` | Fired on every combobox keystroke with the current query. Payload `{ query: string }`. Use it to drive remote/async filtering (set `:filterable="false"` and replace `options` yourself). |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `open` | Open the popup (no-op when disabled or already open). |
| `close` | Close the popup. |
| `toggle` | Toggle the popup open/closed. |
| `clear` | Clear the selection (`null`, or `[]` in multi-select) and reset the combobox query. |
| `focusControl` | Move DOM focus to the control (the combobox input, or the select-only trigger button). |

```vue
<script setup>
import { ref } from 'vue';
const lb = ref();          // template ref
</script>

<template>
  <Listbox ref="lb" :options="options" />
  <button @click="lb.toggle()">Toggle</button>
</template>
```

## Slots

| Slot | Params |
| --- | --- |
| selected | selected, value |
| option | option, index, active, selected, disabled |
| empty | query |
