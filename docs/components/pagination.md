# Pagination — the cross-framework headless pager

`Pagination` is a headless, fully-accessible pagination control with no third-party engine behind it. It covers the whole windowed page-item model: numbers interleaved with ellipses, configurable sibling/boundary windowing, the prev/next bounds, roving keyboard navigation, the `<nav>` landmark with `aria-current="page"` on the active control, and the two-way page binding. The same component ships for React, Vue, Svelte, Angular, Solid, and Lit.

It is headless: the component computes the page-item model and exposes it through scoped slots, so you render each control however your design system wants, or accept the default, fully token-themed buttons. The current page *is* `modelValue` (the sole `model: true` prop, which drives an Angular `ControlValueAccessor`), so the pager binds to forms like any control.

Every visual value is a CSS custom property, so the pager re-skins to any design system, with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

<PublishedTargetsNotice family="pagination" :published="['solid']" />

## The `@rozie-ui/pagination` packages

`Pagination` is designed to ship as six pre-compiled, per-framework packages, but today only `@rozie-ui/pagination-solid` is on npm — the rest are still in dogfooding. Install the published one for real use; the other rows below link to their workspace README for review:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/pagination-react` | *not yet published (dogfooding)* | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pagination/packages/react/README.md) |
| `@rozie-ui/pagination-vue` | *not yet published (dogfooding)* | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pagination/packages/vue/README.md) |
| `@rozie-ui/pagination-svelte` | *not yet published (dogfooding)* | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pagination/packages/svelte/README.md) |
| `@rozie-ui/pagination-angular` | *not yet published (dogfooding)* | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pagination/packages/angular/README.md) |
| `@rozie-ui/pagination-solid` | `npm i @rozie-ui/pagination-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pagination/packages/solid/README.md) |
| `@rozie-ui/pagination-lit` | *not yet published (dogfooding)* | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pagination/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`).

## Quick start

Two-way bind the page and supply either `totalPages` or `total` + `pageSize`. The `@change` event carries the new page:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Pagination from '@rozie-ui/pagination-vue';

const page = ref(1);
</script>

<template>
  <Pagination v-model:modelValue="page" :total="195" :pageSize="10" @change="(e) => console.log(e.page)" />
</template>
```

## The page-item model

From `modelValue` + the count props, the component derives a windowed list of page items —
page numbers interleaved with `'ellipsis'` markers — using the MUI `usePagination`
semantics. `siblingCount` (default `1`) widens the window around the current page;
`boundaryCount` (default `1`) sets how many pages are pinned at each end:

| Current page (of 20) | Rendered items (sibling 1, boundary 1) |
| --- | --- |
| 1 | `1 2 3 4 5 … 20` |
| 10 | `1 … 9 10 11 … 20` |
| 20 | `1 … 16 17 18 19 20` |

The effective page count resolves from `totalPages` when given, else `ceil(total / pageSize)`,
and is always at least 1. A gap of exactly one page renders that single bridging page rather
than a one-page ellipsis. This branchy logic lives in `src/internal/paginationItems.ts` and is
unit-tested in isolation.

## Headless rendering

Every control is a scoped slot — render your own markup and the component keeps the model,
the bounds, the keyboard nav, and the ARIA wiring:

```vue
<Pagination v-model:modelValue="page" :totalPages="20" :siblingCount="2">
  <template #item="{ page, selected, goto }">
    <button :aria-current="selected ? 'page' : undefined" @click="goto">{{ page }}</button>
  </template>
  <template #ellipsis>⋯</template>
  <template #prevControl="{ disabled, goto }">
    <button :disabled="disabled" @click="goto">Prev</button>
  </template>
  <template #nextControl="{ disabled, goto }">
    <button :disabled="disabled" @click="goto">Next</button>
  </template>
</Pagination>
```

See the full prop / event / slot / handle surface on the [API reference](/components/pagination-api),
the [live demo](/components/pagination-demo), and how it compares to existing libraries on the
[comparison page](/components/pagination-comparison).
