---
"@rozie-ui/data-table-react": minor
"@rozie-ui/data-table-vue": minor
"@rozie-ui/data-table-svelte": minor
"@rozie-ui/data-table-angular": minor
"@rozie-ui/data-table-solid": minor
"@rozie-ui/data-table-lit": minor
---

Adds a **per-column dynamic-name slot family** on each of data-table's four column-scoped slots — `cell`, `colHeader`, `filter`, and `editor`. Previously the only way to customize one column's rendering was the single catch-all `#cell` slot, branched by hand on the `columnId` scoped param; that branch does not compose, and the same story applied to `#colHeader`, `#filter`, and `#editor`. Now you can fill a specific column directly with an ordinary static named slot, e.g.:

```html
<DataTable :columns="columns">
  <template #cell-price="{ row, value }">
    <span class="price">{{ formatCurrency(value) }}</span>
  </template>
</DataTable>
```

replacing `cell-price` with `colHeader-price`, `filter-price`, or `editor-price` for the other three seams. On React, Solid, Svelte, Lit, and Vue the slot key is template-literal-typed with the same scoped-parameter typing the generic slot already had (`{ row, value }` for `cell`, not an untyped `(...args) => ReactNode`). Angular's `templates()` intake stays `Record<string, TemplateRef<unknown>>`, type-erased per key — see `docs/parity.md` for that divergence.

**Precedence is three-tier and structural, not a runtime presence check:** a family fill (`#cell-price`) wins over a generic fill (`#cell`), which wins over the built-in render. A column that only fills `#cell` behaves exactly as before for every other column; a column that fills neither renders the built-in cell.

**Both `filter-<id>` and `editor-<id>` are gated the same way their generic siblings already were:** a `filter-<id>` fill only applies to a column with `filterable: true`, and an `editor-<id>` fill only applies to a column with `editor: 'custom'` — filling `#editor-status` on a column that isn't `editor: 'custom'` is a no-op, matching today's `#editor` behavior. `cell-<id>` and `colHeader-<id>` are ungated (every column is eligible), matching their generic siblings.

**The built-in editor inputs now carry a `data-builtin-editor` marker attribute.** This is an internal implementation detail of the editor-owns-focus contract (the host needs to tell "this is my own editor" from "this is a consumer's drop-in editor" without a runtime slot-presence test) — it has no effect on a consumer's own markup or fills, and no prop or event surface changed.

**Emitted markup is no longer byte-identical to 0.3.2 on any of the six targets**, even for a consumer who never touches a family slot: the filter seam's built-in `<input>` moved from a sibling gated by a presence check into a slot fallback, the editor chain now nests inside a fourth branch, and the built-in editors gained the marker attribute above. Behavior for an existing consumer is unchanged — this is a structural refactor of how the same three tiers (family / generic / built-in) are expressed, verified by the full data-table behavioral suite and a dedicated six-target focus-contract spec, not by comparing generated source. See the "Per-column slot families" section on the data-table columns docs page for the full precedence and gating reference.

This release also folds in a separately-landed grouped-header width fix (`.changeset/data-table-grouped-header-width-fix.md`): under `table-layout: fixed`, a multi-level group header's `<th>` now correctly sums its spanned leaf columns' widths instead of reporting table-core's flat single-column default.
