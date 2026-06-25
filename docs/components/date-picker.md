# DatePicker — the cross-framework headless calendar

`DatePicker` is Rozie's **headless, fully-accessible** single-date calendar — a `@rozie-ui` family with **no third-party engine** behind it. The whole month-grid model (6×7 weeks with leading/trailing spill), the prev/next month navigation, the `weekStartsOn` rotation, the `min` / `max` / `disabledDates` gating, the roving keyboard focus (`role="grid"` with arrow / Home / End / PageUp / PageDown / Enter / Space), the localized `Intl` month and weekday labels, and the two-way ISO-date binding are authored once in `DatePicker.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

It is **HEADLESS** in the sense that matters: the component owns the calendar logic and the ARIA wiring, and lets you override the month-nav header via a scoped slot — or accept the default, fully token-themed calendar. The selected date *is* `value` (the sole `model: true` prop → an Angular `ControlValueAccessor`), an ISO `YYYY-MM-DD` string, so the picker binds to forms like any control.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/date-picker` packages

`DatePicker` ships as six pre-compiled, per-framework packages generated from a single `DatePicker.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/date-picker-react` | `npm i @rozie-ui/date-picker-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/date-picker/packages/react/README.md) |
| `@rozie-ui/date-picker-vue` | `npm i @rozie-ui/date-picker-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/date-picker/packages/vue/README.md) |
| `@rozie-ui/date-picker-svelte` | `npm i @rozie-ui/date-picker-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/date-picker/packages/svelte/README.md) |
| `@rozie-ui/date-picker-angular` | `npm i @rozie-ui/date-picker-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/date-picker/packages/angular/README.md) |
| `@rozie-ui/date-picker-solid` | `npm i @rozie-ui/date-picker-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/date-picker/packages/solid/README.md) |
| `@rozie-ui/date-picker-lit` | `npm i @rozie-ui/date-picker-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/date-picker/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the docs-site [API reference](/components/date-picker-api) are generated from the same IR parse of `DatePicker.rozie`, so they cannot drift from the compiled output.

## Quick start

Two-way bind the value (an ISO `YYYY-MM-DD` string; `''` means no selection). The `@change` event carries the new ISO date:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import DatePicker from '@rozie-ui/date-picker-vue';

const date = ref('');
</script>

<template>
  <DatePicker v-model:value="date" min="2026-01-01" @change="(e) => console.log(e.value)" />
</template>
```

## The month-grid model

From `value` + the bounds props, the component builds a fixed 6×7 grid for the displayed month. Leading days spill in from the previous month and trailing days from the next, so every row is full and the layout never reflows. `weekStartsOn` (default `0` = Sunday) rotates both the weekday header and the columns. Days outside `[min, max]` or listed in `disabledDates` are rendered disabled — focusable for keyboard exploration but not selectable.

All date arithmetic runs on UTC midnight, so a calendar date is treated as an abstract civil date and never drifts a day across DST boundaries. This branchy logic lives in `src/internal/buildMonthGrid.ts` and is unit-tested in isolation.

## Keyboard

The grid follows the WAI-ARIA grid pattern:

| Key | Action |
| --- | --- |
| `←` / `→` | Move one day (crossing months at the edges) |
| `↑` / `↓` | Move one week |
| `Home` / `End` | Move to the start / end of the current week |
| `PageUp` / `PageDown` | Move to the previous / next month |
| `Enter` / `Space` | Select the focused day |

## Headless header

Override the month-nav header via the scoped `#header` slot — the component keeps the grid, the bounds, the keyboard nav, and the ARIA wiring:

```vue
<DatePicker v-model:value="date">
  <template #header="{ label, prev, next }">
    <div class="my-header">
      <button @click="prev">◀</button>
      <strong>{{ label }}</strong>
      <button @click="next">▶</button>
    </div>
  </template>
</DatePicker>
```

See the full prop / event / slot / handle surface on the [API reference](/components/date-picker-api),
the [live demo](/components/date-picker-demo), and how it compares to existing libraries on the
[comparison page](/components/date-picker-comparison).
