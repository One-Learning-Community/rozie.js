# Virtualization

Set `virtual` to opt into vertical **row windowing**: only the visible slice of rows renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. The default `false` is byte-identical to a non-virtual table.

```rozie
<DataTable :data="$data.rows" virtual maxHeight="400px" :estimateRowHeight="40">
  <Column field="name" header="Name" />
  <Column field="email" header="Email" />
</DataTable>
```

Three props tune the windowing engine (all consulted only when `virtual` is on):

- `virtual` — opt in. When `true`, only the visible slice renders inside the bounded scroll container.
- `estimateRowHeight` (default `40`) — the estimated row height (px) seeding the engine before `measureElement` refines actual heights (so variable-height rows are measured, with no cumulative drift).
- `maxHeight` — a CSS length string bounding the `rdt-scroll` container (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback.

Windowing is built on the framework-agnostic `@tanstack/virtual-core` wired by hand — **no per-framework virtual adapter** — and is **tested to 100,000 rows** on all six targets by a DOM/behavioral VR matrix. `aria-rowcount` / `aria-rowindex` map the full model, and sticky-header + pinned-column geometry is preserved.

## Per-framework code

The per-target consumption snippet is the [virtualized rows snippet](/components/data-table-usage#virtualized-rows-windowing) on the usage page; the [live demo](/components/data-table-demo) runs the real Vue package over 50,000 windowed rows.

## What's deferred

Vertical **row** windowing ships and is GA; the orthogonal pieces remain deferred — **horizontal/column virtualization** (a very wide column set still renders every column) and **content-driven auto-measurement beyond `measureElement`**. See the [comparison page](/components/data-table-comparison#what-rozie-defers) for the published support boundary.

## See also

- [API reference](/components/data-table-api) — the `virtual` / `estimateRowHeight` / `maxHeight` props.
- [Comparison](/components/data-table-comparison#what-rozie-defers) — the deferred orthogonal pieces.
