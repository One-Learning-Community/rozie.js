<script setup>
import TableDemo from '../../examples/demos/TableDemo.rozie';
</script>

# Table

A slot-driven UI-library table renderer. The producer exposes a `header` slot (the full header row, scoped on `columns`), a per-column dynamic-name `cell-${column.key}` slot family (D-01) for overriding specific columns, an `empty` slot (the no-data placeholder), and two switchable footer slots — `footerSummary` and `footerPagination` — that demonstrate Rozie's consumer-side **dynamic slot fills** via `<template #[expr]>`.

Rozie producers can now declare their own dynamic slot names: `cell-${column.key}` is a producer-side family (not a consumer-side computed fill), so consumers override the specific columns they care about with ordinary static named-fill syntax — `#cell-status`, `#cell-score` (see `TableDemo.rozie` below) — and any column with no dedicated fill falls through to the family's own fallback content, which is a generic shared `cell` slot nested inside it. The dynamic-slot showcase also lives on the consumer side: a template-literal slot name (`` `footer${$data.footerMode}` ``) selects which static-name producer slot the consumer fills.

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
