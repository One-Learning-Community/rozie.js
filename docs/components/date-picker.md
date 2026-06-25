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

## Range selection

Set `selectionMode="range"` to turn the same calendar into a date-range picker. In range mode the `value` is no longer an ISO string but a `{ start, end }` object (both ISO `YYYY-MM-DD` strings, `''` when empty) — the prop is polymorphic, `value: string | { start, end }`, so `selectionMode="single"` (the default) is byte-identical to the single-date picker above and stays fully backward-compatible.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import DatePicker from '@rozie-ui/date-picker-vue';

const range = ref({ start: '', end: '' });
</script>

<template>
  <DatePicker
    selectionMode="range"
    v-model:value="range"
    @rangeComplete="(e) => console.log('range:', e.value)"
  />
</template>
```

Selection is **direction-agnostic**: the first click drops an anchor, not a forced start. The second click completes the range, and the component applies min/max ordering at both the hover preview and the commit, so selecting backwards (later day first, then an earlier one) yields the same ordered `{ start, end }` as selecting forwards. As you move the pointer (or roving keyboard focus) between the two clicks, the days between the anchor and the hovered day render a live **preview band**; a third click restarts the selection from a new anchor.

A `rangeComplete` event fires once when the second endpoint lands (or a preset applies) — see the [API reference](/components/date-picker-api) for its payload and the per-target consumer-prop casing.

### Presets

Pass `presetRanges` to render a quick-pick rail beside the calendar. Each entry is `{ label, range }`, where `range` is either a literal `{ start, end }` **or** a `() => { start, end }` thunk resolved fresh on render (so "Last 7 days" stays relative to today). The consumer owns the date math and the i18n labels:

```vue
<script setup lang="ts">
const iso = (d: Date) => d.toISOString().slice(0, 10);
const presetRanges = [
  { label: 'Q1 2026', range: { start: '2026-01-01', end: '2026-03-31' } },
  { label: 'Last 7 days', range: () => ({ start: iso(new Date(Date.now() - 6 * 864e5)), end: iso(new Date()) }) },
];
</script>

<template>
  <DatePicker selectionMode="range" v-model:value="range" :presetRanges="presetRanges" />
</template>
```

Override the default rail entirely with the scoped `#presets` slot — it receives `{ presets, apply }`, so you can render your own buttons and call `apply(p.range)` to commit a preset:

```vue
<DatePicker selectionMode="range" v-model:value="range" :presetRanges="presetRanges">
  <template #presets="{ presets, apply }">
    <button v-for="p in presets" :key="p.label" @click="apply(p.range)">{{ p.label }}</button>
  </template>
</DatePicker>
```

> The object `value` and the function-form `presetRanges` must be passed as **properties**, never string attributes. On Vue/React/Svelte/Angular/Solid this is automatic; on Lit you must use a property binding (`.value=${obj}` / `r-model`, `.presetRanges=${[...]}`) — the same rule already in force for `disabledDates`. See the [API reference](/components/date-picker-api) for details.

See the full prop / event / slot / handle surface on the [API reference](/components/date-picker-api),
the [live demo](/components/date-picker-demo), and how it compares to existing libraries on the
[comparison page](/components/date-picker-comparison).
