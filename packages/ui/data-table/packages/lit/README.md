# @rozie-ui/data-table-lit

Idiomatic **lit** `DataTable` — a headless, fully-accessible (WAI-ARIA) data table (sorting, global + per-column filtering, pagination, row selection, column visibility / resize / reorder / pinning, sticky header) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The state engine is `@tanstack/table-core` — the SAME framework-agnostic core behind TanStack Table, wired to this framework's reactivity with NO per-framework adapter. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/data-table-lit
```

Peer dependencies: `lit + @lit/context + @lit-labs/preact-signals + @preact/signals-core + @tanstack/table-core + @tanstack/virtual-core + @rozie-ui/popover-lit`. Install them alongside this package.

## Usage

Columns may be declared as a `:columns` config array **or** as `<Column>` children (or both — an id-keyed last-write-wins union). Per-cell rendering is one parent `#cell` / `#colHeader` renderer on `<DataTable>`, dispatched by `columnId`, so it works the same with either column form.

### Columns as a config array

```ts
import '@rozie-ui/data-table-lit';

// <rozie-data-table> is a custom element. Set `data`/`columns` as properties
// and listen for the change events (`sort-change`, `filter-change`, …).
const el = document.querySelector('rozie-data-table');
el.data = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@analytical.engine',  status: 'active' },
    { id: 2, name: 'Alan Turing',    email: 'alan@bletchley.park',    status: 'active' },
    { id: 3, name: 'Grace Hopper',   email: 'grace@navy.mil',         status: 'away'   },
  ];
el.columns = [
    { field: 'name',   header: 'Name',   sortable: true, filterable: true },
    { field: 'email',  header: 'Email' },
    { field: 'status', header: 'Status', sortable: true },
  ];
el.addEventListener('sort-change', (e) => {
  console.log('sorting', e.detail);
});
```

### Declarative `<Column>` children + a custom cell

```ts
import { html, render } from 'lit';
import '@rozie-ui/data-table-lit';

const rows = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@analytical.engine',  status: 'active' },
    { id: 2, name: 'Alan Turing',    email: 'alan@bletchley.park',    status: 'active' },
    { id: 3, name: 'Grace Hopper',   email: 'grace@navy.mil',         status: 'away'   },
  ];

// Declare columns as <rozie-column> children and supply ONE cell renderer —
// a function returning a Lit template, dispatched by columnId.
render(html`
  <rozie-data-table
    .data=${rows}
    selection-mode="multiple"
    sticky-header
    .cell=${({ columnId, value }) =>
      columnId === 'status' ? html`<span class="badge">${value}</span>` : value}
  >
    <rozie-column field="name" header="Name" sortable filterable></rozie-column>
    <rozie-column field="email" header="Email"></rozie-column>
    <rozie-column field="status" header="Status" sortable></rozie-column>
  </rozie-data-table>
`, document.body);
```

### Virtualized rows (windowing)

```ts
import { html, render } from 'lit';
import '@rozie-ui/data-table-lit';

const rows = Array.from({ length: 10_000 }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    email: `user${i + 1}@example.com`,
    status: i % 2 ? 'active' : 'away',
  }));

// PROP form — the `max-height` attribute sizes the scroll container.
render(html`
  <rozie-data-table .data=${rows} virtual max-height="400px">
    <rozie-column field="name" header="Name"></rozie-column>
    <rozie-column field="email" header="Email"></rozie-column>
    <rozie-column field="status" header="Status"></rozie-column>
  </rozie-data-table>
`, document.body);

// TOKEN form — the same height via the CSS custom property (the prop wins when
// both are set; the token is the fallback). `estimate-row-height` tunes the seed:
//   <rozie-data-table .data=${rows} virtual estimate-row-height="48"
//     style="--rozie-data-table-max-height: 400px"> … </rozie-data-table>
```

### Editable cells (inline edit + validation)

```ts
import { html, render } from 'lit';
import '@rozie-ui/data-table-lit';

// The component OWNS edit state — set the `data` property + listen for commits.
let rows = [
    { id: 1, name: 'Alpha', qty: 3, status: 'active',   active: true,  score: 41 },
    { id: 2, name: 'Beta',  qty: 7, status: 'archived', active: false, score: 92 },
  ];
const statusOptions = [
    { value: 'active',   label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'pending',  label: 'Pending' },
  ];
const validateQty = (value: unknown) => Number(value) >= 0 || 'must be >= 0';

render(html`
  <rozie-data-table
    interaction-mode="grid"
    .data=${rows}
    @data-change=${(e: CustomEvent) => { rows = e.detail; }}
    @cell-edit-commit=${(e: CustomEvent) => console.log('cell commit', e.detail)}
    @row-edit-commit=${(e: CustomEvent) => console.log('row commit', e.detail)}
    .editor=${({ columnId, value, commit, cancel }) =>
      columnId === 'score'
        ? html`<span>
            <button @click=${() => commit(Number(value) - 1)}>−</button>
            <button @click=${() => commit(Number(value) + 1)}>+</button>
            <button @click=${() => cancel()}>esc</button>
          </span>`
        : null}
  >
    <rozie-column field="name" header="Name" editable editor="text"></rozie-column>
    <rozie-column field="qty" header="Qty" editable editor="number" .validate=${validateQty}></rozie-column>
    <rozie-column field="status" header="Status" editable editor="select" .editorOptions=${statusOptions}></rozie-column>
    <rozie-column field="active" header="Active" editable editor="checkbox"></rozie-column>
    <rozie-column field="score" header="Score" editable editor="custom"></rozie-column>
  </rozie-data-table>
`, document.body);
```

### Expandable rows (`#detail` slot + nested sub-rows)

```ts
import { html, render } from 'lit';
import '@rozie-ui/data-table-lit';

const rows = [
    { id: 1, name: 'Engineering', headcount: 12, children: [
      { id: 11, name: 'Frontend', headcount: 5 },
      { id: 12, name: 'Backend',  headcount: 7 },
    ] },
    { id: 2, name: 'Sales', headcount: 8 },
  ];

// expandable opts in; listen for `expand-change`; getSubRows yields depth-indented nested
// rows; the #detail scoped slot is the `.detail` property (a function returning a template).
render(html`
  <rozie-data-table
    .data=${rows}
    expandable
    .getSubRows=${(row: { children?: unknown[] }) => row.children}
    .detail=${({ row }) => html`<aside class="detail">More about ${row.name}</aside>`}
    @expand-change=${(e: CustomEvent) => console.log('expanded', e.detail)}
  >
    <rozie-column field="name" header="Name"></rozie-column>
    <rozie-column field="headcount" header="Headcount"></rozie-column>
  </rozie-data-table>
`, document.body);
```

### Grouping + aggregation (headless `#groupBar`)

```ts
import { html, render } from 'lit';
import '@rozie-ui/data-table-lit';

const rows = [
    { id: 1, region: 'North', category: 'Hardware', units: 3, score: 41 },
    { id: 2, region: 'North', category: 'Hardware', units: 5, score: 67 },
    { id: 3, region: 'North', category: 'Software', units: 2, score: 90 },
    { id: 4, region: 'South', category: 'Hardware', units: 7, score: 60 },
  ];
const scoreRange = (columnId: string, leafRows: { getValue: (id: string) => number }[]) => {
  const v = leafRows.map((r) => Number(r.getValue(columnId)));
  return v.length ? Math.max(...v) - Math.min(...v) : 0;
};

// groupable enables grouping; listen for `group-change`; #groupBar is the headless
// `.groupBar` property (NO built-in drag UI) — build the bar from its props.
render(html`
  <rozie-data-table
    .data=${rows}
    groupable
    @group-change=${(e: CustomEvent) => console.log('grouping', e.detail)}
    .groupBar=${({ grouping, groupableColumns, applyGrouping, clearGrouping }) => html`
      <div>
        <button @click=${() => applyGrouping(['region', 'category'])}>Group region → category</button>
        <button @click=${() => clearGrouping()}>Clear</button>
        <span>${grouping.join(' → ') || 'ungrouped'} (${groupableColumns.length} groupable)</span>
      </div>`}
  >
    <rozie-column field="region" header="Region"></rozie-column>
    <rozie-column field="category" header="Category"></rozie-column>
    <rozie-column field="units" header="Units" .aggregationFn=${'sum'}></rozie-column>
    <rozie-column field="score" header="Score" .aggregationFn=${scoreRange}></rozie-column>
  </rozie-data-table>
`, document.body);
```

### Faceted filtering exposure (headless `#filter`)

```ts
import { html, render } from 'lit';
import '@rozie-ui/data-table-lit';

const rows = [
    { id: 1, name: 'Alpha',   category: 'Hardware', price: 30 },
    { id: 2, name: 'Beta',    category: 'Software', price: 90 },
    { id: 3, name: 'Gamma',   category: 'Hardware', price: 10 },
    { id: 4, name: 'Delta',   category: 'Service',  price: 50 },
  ];

// Faceting is HEADLESS + read-only (NO event, NO built-in control). The #filter slot is the
// `.filter` property; it receives `uniqueValues` (keys, cross-filtered) + numeric `minMax`.
render(html`
  <rozie-data-table
    .data=${rows}
    .filter=${({ columnId, uniqueValues, minMax }) =>
      columnId === 'category'
        ? html`<fieldset>${uniqueValues.map((v) => html`<label><input type="checkbox" /> ${v}</label>`)}</fieldset>`
        : html`<input type="range" min=${minMax?.[0]} max=${minMax?.[1]} />`}
  >
    <rozie-column field="name" header="Name"></rozie-column>
    <rozie-column field="category" header="Category" filterable></rozie-column>
    <rozie-column field="price" header="Price" filterable></rozie-column>
  </rozie-data-table>
`, document.body);
```

### Drop-in editor components (`#editor`)

```ts
import { html, render } from 'lit';
// The single side-effect import registers <rozie-data-table> AND the drop-in editor
// custom elements (<rozie-editor-text>, <rozie-editor-number>, <rozie-editor-select>,
// <rozie-editor-checkbox>, <rozie-editor-date>). DataTable stays the headless default;
// the editors are additive.
import '@rozie-ui/data-table-lit';

let rows = [
    { id: 1, name: 'Alpha', qty: 3, status: 'active',   active: true,  score: 41 },
    { id: 2, name: 'Beta',  qty: 7, status: 'archived', active: false, score: 92 },
  ];
const statusOptions = [
    { value: 'active',   label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'pending',  label: 'Pending' },
  ];

// The #editor slot is the `.editor` property — a function returning a Lit template,
// dispatched by columnId. Pass the slot scope ({ columnId, column, row, value, commit,
// cancel }) as element properties; <rozie-editor-select> also takes `.options`.
render(html`
  <rozie-data-table
    interaction-mode="grid"
    .data=${rows}
    @data-change=${(e: CustomEvent) => { rows = e.detail; }}
    @cell-edit-commit=${(e: CustomEvent) => console.log('cell commit', e.detail)}
    .editor=${({ columnId, column, row, value, commit, cancel }) => {
      const p = { columnId, column, row, value, commit, cancel };
      switch (columnId) {
        case 'name':   return html`<rozie-editor-text .columnId=${p.columnId} .column=${p.column} .row=${p.row} .value=${p.value} .commit=${p.commit} .cancel=${p.cancel}></rozie-editor-text>`;
        case 'qty':    return html`<rozie-editor-number .columnId=${p.columnId} .column=${p.column} .row=${p.row} .value=${p.value} .commit=${p.commit} .cancel=${p.cancel}></rozie-editor-number>`;
        case 'status': return html`<rozie-editor-select .columnId=${p.columnId} .column=${p.column} .row=${p.row} .value=${p.value} .commit=${p.commit} .cancel=${p.cancel} .options=${statusOptions}></rozie-editor-select>`;
        case 'active': return html`<rozie-editor-checkbox .columnId=${p.columnId} .column=${p.column} .row=${p.row} .value=${p.value} .commit=${p.commit} .cancel=${p.cancel}></rozie-editor-checkbox>`;
        case 'score':  return html`<rozie-editor-date .columnId=${p.columnId} .column=${p.column} .row=${p.row} .value=${p.value} .commit=${p.commit} .cancel=${p.cancel}></rozie-editor-date>`;
        default:       return null;
      }
    }}
  >
    <rozie-column field="name" header="Name" editable editor="custom"></rozie-column>
    <rozie-column field="qty" header="Qty" editable editor="custom"></rozie-column>
    <rozie-column field="status" header="Status" editable editor="custom"></rozie-column>
    <rozie-column field="active" header="Active" editable editor="custom"></rozie-column>
    <rozie-column field="score" header="Score" editable editor="custom"></rozie-column>
  </rozie-data-table>
`, document.body);
```

### Drop-in filter components (`#filter`)

```ts
import { html, render } from 'lit';
// The single side-effect import registers <rozie-data-table> AND the drop-in filter
// custom elements (<rozie-filter-text>, <rozie-filter-number-range>,
// <rozie-filter-select>). DataTable stays the headless default; the filters are additive.
import '@rozie-ui/data-table-lit';

let rows = [
    { id: 1, name: 'Alpha',   category: 'Hardware', price: 30 },
    { id: 2, name: 'Beta',    category: 'Software', price: 90 },
    { id: 3, name: 'Gamma',   category: 'Hardware', price: 10 },
    { id: 4, name: 'Delta',   category: 'Service',  price: 50 },
  ];
let columnFilters: { id: string; value: unknown }[] = [];

// The #filter slot is the `.filter` property — a function returning a Lit template,
// dispatched by columnId. Pass the slot scope ({ columnId, column, value, setFilter,
// uniqueValues, minMax }) as element properties.
render(html`
  <rozie-data-table
    .data=${rows}
    .columnFilters=${columnFilters}
    @filter-change=${(e: CustomEvent) => { columnFilters = e.detail.columnFilters; }}
    .filter=${({ columnId, column, value, setFilter, uniqueValues, minMax }) => {
      const p = { columnId, column, value, setFilter, uniqueValues, minMax };
      switch (columnId) {
        case 'name':     return html`<rozie-filter-text .columnId=${p.columnId} .column=${p.column} .value=${p.value} .setFilter=${p.setFilter}></rozie-filter-text>`;
        case 'category': return html`<rozie-filter-select .columnId=${p.columnId} .column=${p.column} .value=${p.value} .setFilter=${p.setFilter} .uniqueValues=${p.uniqueValues}></rozie-filter-select>`;
        case 'price':    return html`<rozie-filter-number-range .columnId=${p.columnId} .column=${p.column} .value=${p.value} .setFilter=${p.setFilter} .minMax=${p.minMax}></rozie-filter-number-range>`;
        default:         return null;
      }
    }}
  >
    <rozie-column field="name" header="Name" filterable></rozie-column>
    <rozie-column field="category" header="Category" filterable></rozie-column>
    <rozie-column field="price" header="Price" filterable></rozie-column>
  </rozie-data-table>
`, document.body);
```

### Drop-in group bar + detail panel (`#groupBar` / `#detail`)

```ts
import { html, render } from 'lit';
// The single side-effect import registers <rozie-data-table> AND the drop-in
// <rozie-group-bar> + <rozie-detail-panel> custom elements. DataTable stays the headless
// default; both are additive.
import '@rozie-ui/data-table-lit';

const rows = [
    { id: 1, region: 'North', category: 'Hardware', units: 3, score: 41 },
    { id: 2, region: 'North', category: 'Hardware', units: 5, score: 67 },
    { id: 3, region: 'North', category: 'Software', units: 2, score: 90 },
    { id: 4, region: 'South', category: 'Hardware', units: 7, score: 60 },
  ];

// #groupBar is the `.groupBar` property; #detail is the `.detail` property — each a
// function returning a Lit template, dispatched at render time. Pass the slot scope
// through as element properties (GroupBar: the group-bar scope; DetailPanel: { row }).
render(html`
  <rozie-data-table
    .data=${rows}
    groupable
    expandable
    .groupBar=${({ grouping, groupableColumns, applyGrouping, clearGrouping }) =>
      html`<rozie-group-bar .grouping=${grouping} .groupableColumns=${groupableColumns} .applyGrouping=${applyGrouping} .clearGrouping=${clearGrouping}></rozie-group-bar>`}
    .detail=${({ row }) => html`<rozie-detail-panel .row=${row}></rozie-detail-panel>`}
  >
    <rozie-column field="region" header="Region"></rozie-column>
    <rozie-column field="category" header="Category"></rozie-column>
    <rozie-column field="units" header="Units" .aggregationFn=${'sum'}></rozie-column>
  </rozie-data-table>
`, document.body);
```

## Theming

Every visual value is a `--rozie-data-table-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package (import `base.css` first, then a bridge):

```ts
import '@rozie-ui/data-table-lit/themes/base.css';
import '@rozie-ui/data-table-lit/themes/shadcn.css';    // or material.css, bootstrap.css
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `data` | `Array` | `—` | ✓ | ✓ | The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher). |
| `columns` | `Array` | `[]` |  |  | Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union). |
| `selectionMode` | `String` | `"none"` |  |  | Row-selection mode: `'none'` \| `'single'` \| `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header. |
| `sorting` | `Array` | `[]` | ✓ |  | `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. Two-way: writes funnel a fresh value through the `sort-change` event regardless of binding. |
| `globalFilter` | `String` | `''` | ✓ |  | The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding. |
| `columnFilters` | `Array` | `[]` | ✓ |  | `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`. |
| `pagination` | `Object` | `{…}` | ✓ |  | `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`. |
| `manual` | `Boolean` | `false` |  |  | Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events (the consumer fetches each page). |
| `rowCount` | `Number` | `null` |  |  | Total server-side row count for `manual` pagination; lets the table compute page count when it doesn't hold the full dataset. |
| `pageCount` | `Number` | `null` |  |  | Explicit total page count for `manual` pagination; overrides rowCount-derived count. |
| `expandable` | `Boolean` | `false` |  |  | Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). Bind `:expandable="true"` (a bare attr only coerces on Vue+Lit). |
| `expanded` | `any` | `null` | ✓ |  | `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand. |
| `getSubRows` | `Function` | `null` |  |  | Table-level child-row accessor `(originalRow, index) => TData[] \| undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode. |
| `groupable` | `Boolean` | `false` |  |  | Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI). |
| `grouping` | `Array` | `null` | ✓ |  | `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding `r-model:grouping` (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array. |
| `rowSelection` | `Object` | `{}` | ✓ |  | `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding. |
| `columnVisibility` | `Object` | `{}` | ✓ |  | `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`. |
| `columnSizing` | `Object` | `{}` | ✓ |  | `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`. |
| `columnOrder` | `Array` | `[]` | ✓ |  | `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`. |
| `columnPinning` | `Object` | `{…}` | ✓ |  | `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`. |
| `stickyHeader` | `Boolean` | `false` |  |  | Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container. |
| `interactionMode` | `String` | `"table"` |  |  | `'table'` (default, row-oriented, byte-behaviorally identical to a plain accessible table) \| `'grid'` (GA since Phase 63) — lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)**: `role="grid"`, a roving single tab-stop, 2-D APG arrow-key cell navigation, range selection, and clipboard support. |
| `singleClickEdit` | `Boolean` | `false` |  |  | Grid mode only. When `true`, a plain click on an **editable** cell opens its editor immediately (single-click-to-edit) instead of just activating the cell. Default `false` keeps click-to-activate (double-click opens the editor). Shift+click (range selection) and clicks on non-editable cells are unaffected. |
| `undoable` | `Boolean` | `false` |  |  | Grid mode. When `true`, every committed data mutation (cell/row edit, paste, fill, cut, clear) becomes one undo step: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes. Default `false` records no history and Ctrl+Z/Y are inert. |
| `undoLimit` | `Number` | `100` |  |  | The maximum number of undo steps retained (oldest evicted past this depth). Only consulted when `undoable` is `true`. |
| `virtual` | `Boolean` | `false` |  |  | Opt-in vertical **row windowing**. When `true`, only the visible slice of rows renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Default `false` is byte-identical to a non-virtual table. |
| `estimateRowHeight` | `Number` | `40` |  |  | Estimated row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on. |
| `maxHeight` | `String` | `''` |  |  | A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback. |

## Events

| Event | Description |
| --- | --- |
| `sort-change` | Fired when the sort state changes (header click / shift-click multi-sort / a `sortColumn`/`clearSorting` call). Payload is the fresh `SortingState` array `[{ id, desc }]`. |
| `expand-change` | Fired (phase 50) when the expanded-row set changes (an expander chevron toggle — click / Enter / Space — or a `toggleRowExpanded`/`expandAll`/`collapseAll` call). Fires exactly once per change (the echo-guarded write funnel dedups the React multi-render re-entry, D-07) and REGARDLESS of whether `r-model:expanded` is bound. Payload is the fresh `ExpandedState` — a `{ [rowId]: true }` object, or the `true` literal after `expandAll` (Pitfall 2: it is passed through verbatim — never `Object.keys` it without a `=== true` guard). Named `expand-change` (not `expanded-change`): the model:true `expanded` prop owns the `onExpandedChange` callback on the React/Solid Props interface, so the event stems off a distinct name to avoid a duplicate-identifier collision (the house convention every slice follows). |
| `group-change` | Fired (phase 50) when the grouping state changes (a consumer-built `#groupBar` apply/clear, mutating the `grouping` model, or an `applyGrouping`/`clearGrouping` call). Fires exactly once per change (the echo-guarded write funnel dedups the React multi-render re-entry, D-07) and REGARDLESS of whether `r-model:grouping` is bound. Payload is the fresh `GroupingState` — an ORDERED `string[]` of column ids (e.g. `["region","category"]` for nested groups), or `[]` when cleared. Named `group-change` (not `grouping-change`): the model:true `grouping` prop owns the `onGroupingChange` callback on the React/Solid Props interface, so the event stems off a distinct name to avoid a duplicate-identifier collision (the house convention every slice follows — sorting→sort-change, expanded→expand-change). |
| `filter-change` | Fired when a filter changes. Payload is `{ globalFilter }` for the global search box or `{ columnFilters }` (the fresh `ColumnFiltersState` `[{ id, value }]`) for a per-column filter — both surface through this one event. |
| `page-change` | Fired when pagination changes (prev/next, a page-size change, or a `setPage`/`setRowsPerPage` call). Payload is the fresh `{ pageIndex, pageSize }` object. |
| `selection-change` | Fired when the row selection changes (a row/select-all checkbox toggle or a `toggleAllRows`/`clearSelection` call). Payload is the fresh `RowSelectionState` `{ [rowId]: true }` object. |
| `visibility-change` | Fired when a column is shown/hidden (the column-toggle menu or a `toggleColumnVisibility` call). Payload is the fresh `VisibilityState` `{ [colId]: boolean }` object. |
| `resize-change` | Fired live during a column resize drag (`columnResizeMode: "onChange"`). Payload is the fresh `ColumnSizingState` `{ [colId]: number }` object. |
| `reorder-change` | Fired when the column order changes (an `applyColumnOrder` call or a header reorder). Payload is the fresh `ColumnOrderState` `string[]`. |
| `pin-change` | Fired when a column is pinned/unpinned (the per-header pin buttons or a `pinColumn` call). Payload is the fresh `ColumnPinningState` `{ left: string[], right: string[] }` object. |
| `history-change` | Fired (260709-8ct, grid-wide undo/redo) when undo/redo AVAILABILITY changes — EDGE-triggered (only when `canUndo`/`canRedo` actually flip, not on every recorded edit) so a toolbar can enable/disable its buttons without polling. Only meaningful when `undoable` is `true`. Payload is `{ canUndo, canRedo }` booleans. No `history` model prop exists, so there is no model-prop==emit-name duplicate-identifier collision. |
| `activecell-change` | Fired (grid interaction mode only) whenever the active cell moves — by keyboard navigation or a `focusCell` call. One-way notification; payload is `{ rowIndex, colIndex }` integers over the visible model. Fires on every move including arrow keypresses (D-02). |
| `range-change` | Fired (Phase 51 req-7 / D-07) whenever the rectangular cell-range selection changes — extended by `Shift+Arrow` / `Shift+Click` from the single `extendRange`/`setRangeFocus` call sites (React multi-emit dedup, D-07). One-way notification (the range is NOT a `model:true` slice — the model:true count stays at 10, leaving the Angular multi-model-CVA condition untouched); it is a SEPARATE layer from the row-selection slice and the two never corrupt each other. Payload is `getSelectedRange()` → `{ anchor, focus }` where each corner is a `{ rowIndex, colIndex }` index pair over the visible model (integers only — no row data, no DOM node), or `null` when no range is set. |
| `cell-edit-commit` | Fired (Phase 51) when an editable cell commits a NEW, validated value — once per committed cell, from the single `commitEdit` call site (a rejected/invalid commit fires nothing — D-01). Pairs with the `r-model:data` write (one fresh-array replace per commit). Payload is `{ rowId, columnId, oldValue, newValue }`. `cancel`/`Escape` and a validation failure emit nothing. |
| `row-edit-commit` | Fired (Phase 51 req-6 / D-06) when a FULL-ROW edit commits — once per row save, from the single `commitRow` call site (React multi-emit dedup, D-07). A row enters full-row edit via `Shift+F2` or the `editRow` verb (every editable cell edits at once); one save validates every edited cell (D-01 — a single failure blocks the whole row and emits nothing) then writes the bound `r-model:data` ONCE (a single fresh-array row-object replace with all changes applied) and fires this event ONCE. `Escape` reverts the whole row as a unit and emits nothing. Payload is `{ rowId, changes }` where `changes` is `[{ columnId, oldValue, newValue }]` for ONLY the columns whose value actually changed. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `sortColumn` | Toggle (or set) the sort for a column — `sortColumn(colId, desc?)`. Drives table-core so `sort-change` fires with the fresh `SortingState`. |
| `clearSorting` | Clear all sorting — `clearSorting()`. Resets to the unsorted core row model and fires `sort-change`. |
| `toggleRowExpanded` | Toggle ONE row's expanded state (phase 50 req-3) — `toggleRowExpanded(rowId)` where `rowId` is the consumer's row `id` (the data field) OR the table-core row id (both resolve). Scans the core flat-row set so a collapsed parent is still resolvable. Drives table-core so `expand-change` fires with the fresh `ExpandedState`. Multi-expand: it does not collapse other open rows. |
| `expandAll` | Open every expandable row (phase 50 req-3) — `expandAll()`. Drives table-core (`toggleAllRowsExpanded(true)`) so `expand-change` fires; the payload may be the `true` expand-all literal (Pitfall 2). |
| `collapseAll` | Collapse every row (phase 50 req-3) — `collapseAll()`. Resets the expanded set to a blank state (`resetExpanded(true)` → `{}`) and fires `expand-change` with `{}`. |
| `getExpandedRows` | Return the original row data for the currently-expanded rows (phase 50 req-3) — `getExpandedRows()` → `unknown[]` (empty when nothing is expanded). The read-verb twin of the `expand-change` event. |
| `applyGrouping` | Set the full grouping — `applyGrouping(cols)` where `cols` is a fresh ORDERED `string[]` of column ids (multi-column → nested groups, e.g. `["region","category"]`). Drives table-core (`table.setGrouping`) so `group-change` fires with the fresh `GroupingState`. (Named `applyGrouping`, not `setGrouping`: a `set<ModelProp>` verb collides with React`s auto-generated `grouping` useState setter and an $expose verb is rename-protected — ROZ524; same `applyColumnOrder` precedent.) |
| `clearGrouping` | Clear all grouping — `clearGrouping()`. Resets to the ungrouped (flat) row model (`table.setGrouping([])`) and fires `group-change` with `[]`. |
| `getFacetedUniqueValues` | Return a column's CROSS-FILTERED distinct values (phase 50 reqs 8-9, D-03) — `getFacetedUniqueValues(colId)` → `unknown[]` of distinct values (KEYS ONLY — occurrence counts are deliberately NOT exposed). Resolves the column via `table.getColumn(colId)` and reads table-core's faceted unique-value map, returning `Array.from(map.keys())`. Cross-filtered: the values reflect rows passing all OTHER active column filters and update when an upstream filter changes. Empty array when the column/table is missing. Inert (the faceted models stay off-path) until this verb or the `#filter` slot reads a facet. |
| `getFacetedMinMaxValues` | Return a numeric column's CROSS-FILTERED `[min, max]` range (phase 50 reqs 8-9, D-03) — `getFacetedMinMaxValues(colId)` → `[number, number] | null`. Resolves the column via `table.getColumn(colId)` and reads table-core's faceted min/max. Cross-filtered (reflects rows passing all OTHER active column filters) and updates when an upstream filter changes. `null` when unavailable. The read twin handed to the `#filter` scoped slot so a consumer builds a numeric range slider purely from exposed values. |
| `getColumnDefs` | Return the resolved `ColumnDef[]` (the id-keyed LWW union of the `:columns` config array and the `<Column>` children) — `getColumnDefs()`. |
| `toggleAllRows` | Select or clear all (filtered) rows — `toggleAllRows(value)`. Drives table-core so `selection-change` fires with the fresh `RowSelectionState`. |
| `clearSelection` | Clear the row selection — `clearSelection()`. Fires `selection-change` with `{}`. |
| `getSelectedRows` | Return the original row data for the currently-selected rows — `getSelectedRows()` → `unknown[]` (empty when nothing is selected). |
| `setPage` | Go to a 0-based page index — `setPage(idx)`. Drives table-core so `page-change` fires with the fresh `{ pageIndex, pageSize }`. |
| `setRowsPerPage` | Set the page size — `setRowsPerPage(size)`. Fires `page-change` with the fresh pagination object. |
| `toggleColumnVisibility` | Show/hide a column — `toggleColumnVisibility(colId)`. Drives table-core so `visibility-change` fires with the fresh `VisibilityState`. |
| `applyColumnOrder` | Set the full column order — `applyColumnOrder(order)` where `order` is a fresh `string[]`. Fires `reorder-change`. (Named `applyColumnOrder`, not `setColumnOrder`: a `set<ModelProp>` verb collides with React`s auto-generated `columnOrder` setter and an $expose verb is rename-protected — ROZ524.) |
| `resetColumnSizing` | Reset all column widths to their defaults — `resetColumnSizing()`. Fires `resize-change`. |
| `pinColumn` | Pin a column to a side or unpin it — `pinColumn(colId, side)` where `side` is `'left'` | `'right'` | `false`. Fires `pin-change` with the fresh `ColumnPinningState`. |
| `focusCell` | Move + focus the active cell (grid interaction mode) — `focusCell(rowIndex, colIndex)`. `rowIndex` is the ABSOLUTE display-order position in `getPrePaginationRowModel().rows` (filter+sort+expand applied, BEFORE pagination/windowing), in BOTH paginated and virtual modes (C1): a paginated `focusCell(abs)` switches to `Math.floor(abs/pageSize)` then focuses; a virtual `focusCell(abs)` scrolls-then-focuses. Args coerced to integers + clamped to bounds. Fires `activecell-change` with the absolute `rowIndex`. (Named `focusCell`, not `focus`: a bare `focus` verb shadows the inherited `HTMLElement.focus` on Lit — ROZ137.) |
| `getActiveCell` | Return the current active-cell position — `getActiveCell()` → `{ rowIndex, colIndex, isHeader }`. For a body cell `rowIndex` is the ABSOLUTE display-order index (C1, matching `focusCell` / `activecell-change`) and `isHeader` is `false`; for a header-active cell `rowIndex` is `null` and `isHeader` is `true` (integers only — no row data, no DOM node). |
| `clearActiveCell` | Reset the roving active-cell position to the entry cell and exit interaction mode — `clearActiveCell()`. The next Tab-in re-enters at the entry cell (D-01). (Named `clearActiveCell`, not `clear`: distinct from the listbox `clear` selection verb.) |
| `getRowIndexRelativeToPage` | Convert an ABSOLUTE display-order row index (the `focusCell` / `getActiveCell` / `activecell-change` space, C1) to the PAGE-RELATIVE index — `getRowIndexRelativeToPage(absRow?)` → `number`. With no argument it converts the current active cell (`abs - pageIndex*pageSize`). In virtual mode (no pagination) it returns the absolute index unchanged. Mirrors MUI `getRowIndexRelativeToVisibleRows`. (Named `getRowIndexRelativeToPage`: collision-clean against the verb/event/prop and Lit ROZ137 reserved sets.) |
| `editCell` | Programmatically open the editor on a cell (Phase 51) — `editCell(rowIndex, colIndex)`, addressed by index over the visible model (args coerced to integers + clamped). No-op on a non-editable cell. (Named `editCell`, not `edit`: collision-clean against the verb/event/prop and Lit ROZ137 reserved sets.) |
| `commitEditing` | Programmatically commit the open editor (Phase 51) — `commitEditing()`. Runs the column validator; on success writes the bound `r-model:data` and fires one `cell-edit-commit`; on a validation failure keeps the editor open (D-01). No-op when no cell is editing. (Named `commitEditing`, not `commit`.) |
| `editRow` | Programmatically enter FULL-ROW edit on a body row (Phase 51 req-6 / D-06) — `editRow(rowIndex)`, addressed by index over the visible model (args coerced to integers + clamped). The API twin of the `Shift+F2` shortcut: every editable cell in the row enters edit at once. A later save commits the whole row in one `r-model:data` write + one `row-edit-commit`; `Escape` reverts the row as a unit. No-op on a row with no editable columns. (Named `editRow`, not `edit`/`editColumn`: collision-clean against the verb/event/prop and Lit ROZ137 reserved sets.) |
| `getSelectedRange` | Return the current rectangular cell-range selection (Phase 51 req-7 / D-07) — `getSelectedRange()` → `{ anchor, focus }` where each corner is a `{ rowIndex, colIndex }` index pair over the visible model (integers only — no row data, no DOM node, T-49-02), or `{ anchor: null, focus: null }` when no range is set. The range is extended by `Shift+Arrow` / `Shift+Click` and is ONE-WAY (this read verb + the `range-change` event), NOT a `model:true` slice (D-07). (Named `getSelectedRange`, not `getRange`/`getSelection`: collision-clean against `getSelectedRows`, the verb/event/prop, and the Lit ROZ137 reserved sets.) |
| `cut` | Cut the current cell-range selection (Phase 63 C3) — `cut()`. Copies the range to the clipboard as TSV (the same escaped serialization `Ctrl+C` produces) THEN clears the source cells through the bound `r-model:data` write-funnel in a single `writeData` (each cell coerced to its column empty — `null` on a numeric column, the empty string on text — under the editable + validator skip rule, firing one `cell-edit-commit` per cleared cell). The API twin of the `Ctrl/Cmd+X` shortcut. A no-op while a header cell is active (the B11 clipboard guard). (Named `cut`, the spreadsheet-standard verb: collision-clean against the verb/event/prop, the React auto-setter set, and the Lit ROZ137 reserved DOM members — `cut` is not on `HTMLElement`.) |
| `undo` | Undo the most recent data mutation (260709-8ct, grid-wide undo/redo) — `undo()`. Only meaningful when `undoable` is `true`. Pops the most recent pre-mutation snapshot, pushes the current data onto the redo stack, and replays the snapshot through the SAME `writeData` funnel every edit/paste/fill/cut/clear commits through — so the two-way `r-model:data` writeback keeps working with zero new code. Fires `history-change` once per call. A no-op when nothing is undoable (`canUndo()` is `false`). The API twin of the `Ctrl/Cmd+Z` shortcut. |
| `redo` | Redo the most recently undone data mutation (260709-8ct) — `redo()`. Symmetric to `undo()`: pops the redo stack, pushes the current data back onto the undo stack, replays through the same `writeData` seam, fires `history-change` once. A no-op when nothing is redoable (`canRedo()` is `false`). The API twin of the `Ctrl/Cmd+Y` / `Ctrl/Cmd+Shift+Z` shortcuts. |
| `canUndo` | Return whether an undo step is available (260709-8ct) — `canUndo()` → `boolean`. Reflects the undo stack depth; use alongside the `history-change` event to drive a toolbar button`s disabled state without polling. |
| `canRedo` | Return whether a redo step is available (260709-8ct) — `canRedo()` → `boolean`. Reflects the redo stack depth; cleared by any new edit after an undo (standard undo semantics). |
| `clearHistory` | Discard all undo/redo history (260709-8ct) — `clearHistory()`. Empties both stacks (`canUndo()`/`canRedo()` become `false`). Also called internally on an external data-reference swap (a dataset the component itself did not write), since undoing across a dataset boundary is incoherent. |

```ts
// The custom element IS the handle — exposed methods are public element
// methods.
const el = document.querySelector('rozie-data-table');
el.toggleAllRows(true);
const selected = el.getSelectedRows();
el.editRow(0);                       // full-row edit on row 0
const range = el.getSelectedRange();  // the active cell-range rectangle
el.expandAll();                      // collapseAll / toggleRowExpanded / getExpandedRows
el.applyGrouping(['region']);        // clearGrouping to reset
const cats = el.getFacetedUniqueValues('category'); // getFacetedMinMaxValues too
```

## Slots

All rendering slots live on the parent `<DataTable>` (a `<Column>` carries metadata only). The `cell` / `colHeader` slots are single renderers dispatched by `columnId` — switch on it to vary the render per column; a column the slot does not render shows the plain accessor value. (On React/Solid these are render-prop props — `renderCell` / `renderColHeader` / `cellSlot` / `colHeaderSlot`; on Lit they are the `.cell` / `.colHeader` properties — the documented cross-framework divergence.)

The `detail` (expandable rows), `groupBar` (grouping) and `filter` (faceted filtering) scoped slots follow the SAME render-prop convention: on React they are `renderDetail` / `renderGroupBar` / `renderFilter`; on Solid they are `detailSlot` / `groupBarSlot` / `filterSlot`; on Lit they are the `.detail` / `.groupBar` / `.filter` properties — the documented React render-prop edge (per the cross-framework compatibility bar). On Vue / Svelte / Angular they are ordinary named scoped slots (`#detail` / `#groupBar` / `#filter`). The `groupBar` and `filter` slots are HEADLESS — the component ships NO built-in group-bar / facet control, so the consumer builds the UI purely from the exposed slot props.

| Slot | Params |
| --- | --- |
| (default) |  |
| groupBar | grouping, groupableColumns, applyGrouping, clearGrouping |
| selectAll | checked, indeterminate, toggle |
| colHeader | columnId, column, label |
| filter | columnId, value, uniqueValues, minMax, setFilter |
| selectCell | row, checked, toggle |
| cell | columnId, column, row, value |
| editor | columnId, column, row, value, commit, cancel, autofocus |
| detail | row |
