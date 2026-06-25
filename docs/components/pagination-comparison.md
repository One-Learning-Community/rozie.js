---
title: Pagination — comparison
surface_hash: 93b6d215eb7e
---

# Pagination vs the per-framework libraries it replaces

A pager is one of those components every design system re-implements per framework. `@rozie-ui/pagination` is a **single accessible source** compiled to all six — so a component-library author maintains one file instead of one binding per framework.

## What it replaces

| Framework | Typical library | What you maintain today |
| --- | --- | --- |
| React | `@mui/material` Pagination, `react-paginate`, a hand-rolled `usePagination` | A React-only component + its own windowing logic + its own ARIA wiring |
| Vue | `el-pagination` (Element Plus), `vuetify` v-pagination | A Vue-only component, separate from the React one |
| Svelte | a hand-rolled component or `@skeletonlabs` paginator | Yet another reimplementation |
| Angular | `@angular/material` `MatPaginator`, `ngx-pagination` | An Angular-only directive/component |
| Solid | (few options — usually hand-rolled) | A bespoke component |
| Lit | (few options — usually hand-rolled) | A bespoke custom element |

With Rozie, the windowing algorithm, the bounds logic, the roving keyboard navigation, and the ARIA semantics are authored **once** and emit idiomatic output for each framework.

## How it differs

- **Headless by default.** Unlike most of the above (which ship opinionated chrome), `@rozie-ui/pagination` exposes the page-item model through scoped slots — you render the controls. The default token-themed buttons are a convenience, not a lock-in.
- **Controlled, single model.** The current page *is* `modelValue` — there is no internal page state to sync, and on Angular it is a real `ControlValueAccessor` (so `[(ngModel)]` / `[formControl]` work without a wrapper directive).
- **Count-source flexible.** Supply `totalPages` directly, or `total` + `pageSize` and let the component derive the page count.
- **MUI-parity windowing.** The page-item model matches the well-understood MUI `usePagination` semantics (constant-width window near a boundary; a one-page gap renders the bridging page rather than a one-page ellipsis), so the output is predictable for anyone migrating from MUI.
- **Token-themed, framework-agnostic skin.** Every visual value is a `--rozie-pagination-*` custom property, with ready-made shadcn/Material/Bootstrap bridges — the same skin across all six frameworks.

## What it deliberately does NOT do

- It does not fetch data or own a data source — it computes a page model and emits page changes; you wire it to your query.
- It does not render "items per page" selectors, "jump to page" inputs, or result-count labels — compose those around it (the headless slots make this trivial).
