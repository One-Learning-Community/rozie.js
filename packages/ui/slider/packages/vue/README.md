# @rozie-ui/slider-vue

Idiomatic **vue** `Slider` — a headless, fully-accessible (WAI-ARIA) slider / range (single + dual-thumb range, drag + full keyboard navigation, vertical orientation, marks) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native `<input type="range">`; every value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/slider-vue
```

Peer dependencies: `vue`. Install them alongside this package.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Slider from '@rozie-ui/slider-vue';

const value = ref<number>(50);
const range = ref<[number, number]>([20, 80]);
</script>

<template>
  <Slider v-model:value="value" :min="0" :max="100" :step="1" aria-label="Volume" show-value />

  <!-- Range mode -->
  <Slider v-model:value="range" range :min="0" :max="100" aria-label="Price range" />
</template>
```

## Theming

Every visual value is a `--rozie-slider-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/slider-vue/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `value` | `unknown` | `null` | ✓ |  |
| `range` | `Boolean` | `false` |  |  |
| `min` | `Number` | `0` |  |  |
| `max` | `Number` | `100` |  |  |
| `step` | `Number` | `1` |  |  |
| `orientation` | `String` | `"horizontal"` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `marks` | `Array` | `[]` |  |  |
| `ariaLabel` | `String` | `null` |  |  |
| `pageStep` | `Number` | `null` |  |  |
| `formatValue` | `Function` | `null` |  |  |
| `showValue` | `Boolean` | `false` |  |  |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired after the value changes (drag, keyboard, or a programmatic `increment`/`decrement` step). Payload `{ value }` — a scalar number in single mode, a sorted `[lo, hi]` array in range mode. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the native range thumb) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the slider thumb (the native range input). NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended (D-05). |
| `increment` | Increase the (optionally specified) thumb by one `step`, clamped to `[min, max]`. In range mode pass `'lo'` or `'hi'` (default `'lo'`). |
| `decrement` | Decrease the (optionally specified) thumb by one `step`, clamped to `[min, max]`. In range mode pass `'lo'` or `'hi'` (default `'lo'`). |

```vue
<script setup>
import { ref } from 'vue';
const sl = ref();          // template ref
</script>

<template>
  <Slider ref="sl" v-model:value="value" />
  <button @click="sl.increment()">+</button>
</template>
```

## Slots

| Slot | Params |
| --- | --- |
| mark | value, label, position |
| bubble | value |
| bubble | value |
| bubble | value |
