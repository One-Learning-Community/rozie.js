# Virtualization

Set `virtual` to opt into windowing: only the visible slice of rows and/or columns renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows/columns preserving total scroll size). The default `false` is byte-identical to a non-virtual table.

```rozie
<DataTable :data="$data.rows" virtual maxHeight="400px" :estimateRowHeight="40">
  <Column field="name" header="Name" />
  <Column field="email" header="Email" />
</DataTable>
```

## The `virtual` value grammar

`virtual` accepts:

- `false` (default, off) — byte-identical to a non-virtual table.
- `true` or `'rows'` — vertical row windowing. `true` is byte-behavior-identical to every existing consumer; this is unchanged from before this grammar widened.
- `'columns'` — horizontal column windowing: only the visible slice of leaf columns renders.
- `'both'` — both axes windowed at once.

An unrecognised string behaves as `false`.

Row windowing renders only the visible slice of rows inside the bounded `rdt-scroll` container, windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome, with correct `aria-rowcount` / `aria-rowindex`. Column windowing renders only the visible slice of leaf columns inside the same container, with `data-col-index` carrying the absolute (unwindowed) column position.

Windowing is built on the framework-agnostic `@tanstack/virtual-core` wired by hand — **no per-framework virtual adapter** — one `Virtualizer` instance per windowed axis, sharing the same scroll element. It is **tested to 100,000 rows** and to 60+ columns on all six targets by a DOM/behavioral VR matrix.

## Column windowing

`virtual='columns'` and `virtual='both'` window the leaf-column axis:

- **Pinned, active, and editing columns always render**, regardless of scroll position. A pinned column (`getIsPinned()`), the active cell's column, and a single-cell in-progress edit are unioned into the rendered slice so a horizontal scroll never unmounts an editor mid-keystroke or a pinned rail out of view. The fill-handle corner and a wide selected range are deliberately **not** forced — only the columns actually needed to keep the UI coherent.
- **Every header level windows on the same slice as the body, with a clamped colspan.** A group header's `colSpan` clamps to its in-window leaf span; a group entirely outside the window renders no header cell at all. The dedicated filter row windows the same way, keeping its cells aligned with the header and body.
- **Fill-drag gets edge auto-scroll on all four container edges.** Dragging a fill handle near the right or left edge of the scroll container auto-scrolls the column axis; near the top or bottom auto-scrolls the row axis (closing a pre-existing gap — a row-windowed table previously could not fill-drag past its own bottom or top edge either).
- **Off-window columns stay fully addressable by absolute index.** `focusCell` / `getActiveCell` / `activecell-change` all resolve against the absolute leaf-column position — the same guarantee row windowing already provides on the row axis — so column windowing never narrows what a consumer can drive or observe through the handle.

## The `table-layout: fixed` consequence

Turning on column windowing (`virtual='columns'` or `'both'`) applies `table-layout: fixed` to the table. This is a real, documented cost: **columns stop auto-fitting their content** the way an unwindowed table's columns do, because the horizontal spacer math needs every column's width to be predictable up front rather than resolved after layout.

Size columns explicitly via `:columnSizing`, a `<Column size>` attribute, or the built-in resize handle. `table-core`'s column-size oracle (`getSize()`, defaulting to 150px, with explicit sizes on the select/expander chrome columns) is authoritative for the windowed path.

This consequence applies **only** to the column-windowed path — a table with `virtual={false}`, `virtual={true}`, or `virtual='rows'` keeps its existing auto-fitting layout untouched.

## The bounded container width requirement

A column-windowed table needs a bounded width the same way a row-windowed table needs a bounded height (`maxHeight`) — the windowing engine measures the scroll container's own size to decide which columns are "visible." An unbounded container defeats the point of windowing (every column ends up rendered anyway), so in development mode `virtual='columns'`/`'both'` with no bounded width logs a console warning to flag the misconfiguration. There is no `maxWidth` prop or CSS token mirroring `maxHeight`: a block-level container already bounds horizontally at 100% of its parent in the common case, so size the table's parent element (or an ancestor) instead.

## Auto-measure

Set `autoMeasure` alongside row windowing (`virtual='rows'`/`true`/`'both'`) to make the row-height estimate **content-driven** instead of fixed:

```rozie
<DataTable :data="$data.rows" virtual autoMeasure maxHeight="400px">
  <Column field="name" header="Name" />
</DataTable>
```

- When `autoMeasure` is `false` (default), `estimateRowHeight` is the explicit, fixed estimate used for every row's size on every render, exactly as before this prop existed.
- When `autoMeasure` is `true`, the windowing engine feeds `estimateSize()` a **running mean of measured row heights** instead of the fixed seed. As more rows are scrolled into view and measured, the estimate for never-rendered rows converges toward the true average — so `getTotalSize()` (and the scrollbar it drives) converges toward the real content total on a large table with variable-height rows, instead of staying pinned at `rowCount × estimateRowHeight` forever.
- The re-feed is hysteresis-gated (only re-feeding the estimate when the mean has moved meaningfully) and anchor-preserving: when the estimate refines, the topmost currently-rendered row's own position is held steady so the visible content does not visibly lurch during the refinement.

**`estimateRowHeight` is unchanged and still required.** It is not deprecated, superseded, or legacy — it is still read on every first paint, since the very first render has zero measurements regardless of `autoMeasure`. When `autoMeasure` is `true`, later renders progressively replace this seed with the running-mean estimate; when `autoMeasure` is `false`, `estimateRowHeight` remains the explicit, permanent override for every render, exactly as it always has been.

## Known limitations

- **Svelte: the horizontal spacer's declared width does not yet drive the scroll container's actual scrollable width at rest.** On the Svelte leaf specifically, `.rdt-scroll`'s real `scrollWidth` can under-report the true column-count-derived total, which narrows how far a horizontal scroll (or a `dir="rtl"` scroll to its negative extreme) can reach before the last columns are on screen. The column-index math itself is unaffected — `focusCell` / `getActiveCell` / `activecell-change` still resolve correctly — only the DOM's own scrollable extent is short on this one target. Tracked; the other five targets are unaffected.
- **Grouped column headers: rendered width can diverge from a group's spanned leaf-column widths under `table-layout: fixed`.** When column windowing is on and a multi-level group header's leaf columns are within the current render window, the browser's fixed-layout column-width distribution can conflict with the group `<th>`'s own declared width on Solid, Svelte, and React — the group's spanned columns may render narrower than their configured size. The column SET and colspan clamping (D-11) are correct; this is a visual width-reconciliation gap specific to combining grouped headers with column windowing on those three targets. Vue, Angular, and Lit are unaffected. Tracked.

## Per-framework code

The per-target consumption snippet is the [virtualized rows snippet](/components/data-table-usage#virtualized-rows-windowing) on the usage page; the [live demo](/components/data-table-demo) runs the real Vue package over 50,000 windowed rows.

## See also

- [API reference](/components/data-table-api) — the `virtual` / `autoMeasure` / `estimateRowHeight` / `maxHeight` props.
- [Comparison](/components/data-table-comparison) — how this compares to the other five frameworks' virtualization stories.
