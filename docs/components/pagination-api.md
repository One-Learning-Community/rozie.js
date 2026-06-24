---
title: Pagination — API reference
---

# Pagination — API reference

The complete prop / event / slot / imperative-handle surface of `@rozie-ui/pagination`,
generated from the single `Pagination.rozie` source. The **Props** table below is a
build-time `rozie-props` fence — it is regenerated from the compiler IR on every docs
build, so it cannot drift from the shipped component. Each prop's prose lives in exactly
one place: the `<props>` `docs.description` in the source.

## Props

```rozie-props Pagination
```

## Events

| Event | Payload | Description |
| --- | --- | --- |
| `change` | `{ page }` | Fired whenever the current page changes (a page button, prev/next, or a programmatic `goto`/`next`/`prev`/`first`/`last`). `page` is the new clamped 1-based page. Not fired when the target equals the current page. |

The two-way model also fires the framework-native update event (`onModelValueChange` / `update:modelValue` / `bind:modelValue` / `(modelValueChange)` / `model-value-change`) carrying the new page directly.

## Slots

All slots are optional — omit them to get the default token-themed buttons.

| Slot | Scope params | Description |
| --- | --- | --- |
| `item` | `{ page, selected, goto }` | Render a single page button. `page` is the 1-based number, `selected` is `true` for the current page, `goto` navigates to it. |
| `ellipsis` | `{ index }` | Render the collapsed-gap marker (defaults to `…`). |
| `prevControl` | `{ disabled, goto, page }` | Render the "previous page" control. `disabled` is `true` at the first page, `goto` steps back, `page` is the target. |
| `nextControl` | `{ disabled, goto, page }` | Render the "next page" control. `disabled` is `true` at the last page, `goto` steps forward, `page` is the target. |

> On React the scoped slots are render-prop callbacks (e.g. an `item` render-prop) — the one documented cross-framework slot divergence.

## Imperative handle

Grab a handle via the framework-native ref mechanism (`useRef` → `PaginationHandle`, Vue/Svelte/Angular template refs, Solid ref callback, or the Lit custom element itself):

| Method | Description |
| --- | --- |
| `goto(page)` | Go to a specific 1-based page (clamped into `[1, totalPages]`). |
| `next()` | Advance one page (no-op at the last page). |
| `prev()` | Go back one page (no-op at the first page). |
| `first()` | Jump to page 1. |
| `last()` | Jump to the last page. |

## Theming

Every visual value is a `--rozie-pagination-*` CSS custom property. Import a ready-made
design-system bridge or set the tokens yourself at any ancestor scope:

```ts
import '@rozie-ui/pagination-react/themes/shadcn.css';   // or material.css, bootstrap.css, base.css
```
