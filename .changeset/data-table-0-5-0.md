---
"@rozie-ui/data-table-angular": minor
"@rozie-ui/data-table-lit": minor
"@rozie-ui/data-table-react": minor
"@rozie-ui/data-table-solid": minor
"@rozie-ui/data-table-svelte": minor
"@rozie-ui/data-table-vue": minor
---

Two behavior changes plus the documentation remediation pass.

**`pinned` is now a real initial pin seed.** A per-column `pinned` of `left`/`right` — from `<Column pinned>` or from the `columns` config array — was previously inert metadata. It is now applied once as the table's starting `columnPinning` state, so `getIsPinned()` reports it and the column joins the matching sticky rail. That also **reorders** the column, since table-core orders visible cells `[left-pinned, center, right-pinned]`. A consumer who has already expressed a pin owns the slice and the declaration is ignored; an interactive unpin is never re-applied.

**The four theme bridges now assign at `:root`.** `bootstrap`, `material`, and `shadcn` previously assigned their tokens only on the table's own classes. On the Lit target both `.rozie-data-table` and `.rozie-data-table-wrap` render inside the component's shadow root, where a document-level class selector can never match — so all four bridges were inert on Lit. Trade-off, stated rather than buried: two tables on one page can no longer take different bridges by ancestor class alone. Per-instance overrides still work on the five light-DOM targets via the class selectors, and on all six by setting the public tokens on any ancestor.

Also fixes a column resize that did nothing on React (stale mount-time `columnSizingInfo`), a column-window versioning bug that collapsed the column spacer, and a focus steal in the grid active-cell path. The published token surface is now documented accurately: 18 public `--rozie-data-table-*` tokens wired onto 82 internal `--rdt-*` tokens, with the 58 that have no public counterpart named explicitly rather than implied to be covered.

No type-shape change: the `.d.ts` delta is documentation comments only, with nothing removed.
