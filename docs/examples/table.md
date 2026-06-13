<script setup>
import TableDemo from '../../examples/demos/TableDemo.rozie';
</script>

# Table

A slot-driven UI-library table renderer. The producer exposes three named scoped slots: `header` (the full header row, scoped on `columns`), `cell` (a per-cell renderer scoped on `{ column, row, value, rowIndex }`), and `empty` (the no-data placeholder). It also exposes two switchable footer slots — `footerSummary` and `footerPagination` — that demonstrate Rozie's consumer-side **dynamic slot fills** via `<template #[expr]>`.

Producer slot outlets are static-name in Rozie — per-column customization is dispatched inside a single shared `cell` slot. The consumer's `#cell` template (see `TableDemo.rozie` below) uses Rozie's `r-match` / `r-case` / `r-default` switch construct on `column.key` to pick a per-column renderer — a `badge` span for `status`, a bold `<strong>` for `score`, and a plain span for everything else. The dynamic-slot showcase also lives on the consumer: a template-literal slot name (`` `footer${$data.footerMode}` ``) selects which static-name producer slot the consumer fills.

A naming nuance: footer slot names are camelCase (not kebab-case) so the producer can gate them with `r-if="$slots.footerSummary"`. Rozie's magic accessors require static dot keys; `$slots['footer-summary']` would be a computed access (ROZ106).

## Live demo

Click the **Toggle footer** button to swap the `<tfoot>` content between the summary slot (total score) and the pagination slot (page indicator). That's the dynamic slot fill working end-to-end — the same `<template #[expr]>` template node binds to a different producer outlet each click.

<div class="rozie-demo">
  <ClientOnly>
    <TableDemo />
  </ClientOnly>
</div>

## Source — Table.rozie

```rozie-src Table
```

## Compiled output

::: code-group

```rozie-out Table vue
```

```rozie-out Table react
```

```rozie-out Table svelte
```

```rozie-out Table angular
```

```rozie-out Table solid
```

```rozie-out Table lit
```

:::

## Demo source — TableDemo.rozie

```rozie-src TableDemo
```
