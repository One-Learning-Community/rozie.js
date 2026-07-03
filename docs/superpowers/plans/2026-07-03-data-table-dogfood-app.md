# DataTable Super-Demo (`.rozie`, cross-target) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author one `examples/demos/DataTableSuperDemo.rozie` that wires every data-table feature together (grid + virtualization + editing + grouping + drop-ins + theming) with control toggles, state readouts, and an isolated imperative-handle panel — compiled to all six targets through the VR host so it can be hand-dogfooded per target (Vue first).

**Architecture:** A single `.rozie` demo that composes `<DataTable>`/`<Column>`/drop-ins from source via `<components>` (the proven pattern in the 34 existing `DataTable*Demo.rozie` files). Registered in the VR host (`tests/visual-regression/host/main.ts`), it renders per target at `?example=DataTableSuper&target=<t>` from the per-target sub-builds. Feature flags live in `<data>` and drive `<DataTable>` props/models; drop-ins fill headless slots dispatched by `columnId`. Verification per task: build the VR host + a Playwright smoke against `target=vue`; the final task validates all six.

**Tech Stack:** Rozie authoring (`.rozie`: `<components>`, `<data>`, `<template>`, `r-model`, `r-if`, `@click`, `$data`, `$refs`, `$onMount`), the VR host (Vite, 6 per-target sub-builds), `@rozie-ui/data-table` source, `@playwright/test` 1.60.

## Global Constraints

- Compose from **source** via `<components>` exactly like existing demos: `DataTable: '../../packages/ui/data-table/src/DataTable.rozie'`, `Column: '../../packages/ui/data-table/src/Column.rozie'`, and each drop-in `'../../packages/ui/data-table/src/<Name>.rozie'` (EditorText/EditorNumber/EditorSelect/EditorCheckbox/EditorDate/FilterText/FilterNumberRange/FilterSelect/GroupBar/DetailPanel). Never import compiled leaves here.
- **ROZ123:** `$refs` may be read ONLY in `$onMount`, event handlers, `$watch` callbacks, `<listeners>`, `r-model`, and plain function bodies — NEVER in `$computed`, `$watch` getters, or template-binding/`r-if`/`r-show`/`r-text`/`r-for`-iterable positions (crashes Solid, null on Lit). The imperative panel's verb calls happen in `@click` handlers only.
- **Isolation rule:** the imperative-handle panel and anything else whose cross-target support is unproven must be gated behind an `r-if` toggle (default off) so a target that can't compile/run it still renders the rest of the demo.
- Author idioms by mirroring existing demos — read `examples/demos/DataTableGridEmitDemo.rozie` (components/data/models), `examples/demos/DataTableEditDemo.rozie` and `DataTableDetailPanelDemo.rozie` (`#editor`/`#filter`/`#groupBar`/`#detail` slot idioms) before writing new slot markup.
- The demo is behavioral-only: register it in the host loader + `LIT_TAGS` + the third per-example map, but do NOT add it to `matrix.spec.ts` `EXAMPLES` (no pixel baseline, no CI pixel gate).
- Demo props in `.rozie` authoring are camelCase bindings (`:interactionMode`, `:selectionMode`, `:estimateRowHeight`, `:maxHeight`, `:stickyHeader`) and `r-model:<slice>` for two-way (`r-model:sorting`, `r-model:grouping`, `r-model:data`, etc.), mirroring the existing demos — NOT the Vue kebab consumer syntax.
- Test surface: `pnpm vr-preview` (or `pnpm vr-preview:build` to rebuild) → open `http://localhost:<port>/?example=DataTableSuper&target=<t>`.

---

### Task 1: Scaffold `DataTableSuperDemo.rozie` + register in the VR host

**Files:**
- Create: `examples/demos/DataTableSuperDemo.rozie`
- Modify: `tests/visual-regression/host/main.ts` (loader list ~L547 area; `LIT_TAGS` ~L1168; the third per-example map ~L1547)
- Test: `tests/visual-regression/specs/data-table-super.spec.ts`

**Interfaces:**
- Produces: an example keyed `DataTableSuper` → `examples/demos/DataTableSuperDemo.rozie`, Lit tag `rozie-data-table-super`, reachable at `?example=DataTableSuper&target=<t>`. Later tasks extend the same `.rozie`.

- [ ] **Step 1: Read the pattern anchors**

Read `examples/demos/DataTableGridEmitDemo.rozie` (top ~90 lines) for the `<components>` + `<data>` + `<template>` shape, and note the exact host-registration spots by reading `tests/visual-regression/host/main.ts` around lines 540–560, 1165–1175, and 1545–1550 for an existing `DataTableSort`/`DataTableGridEmit` entry.

- [ ] **Step 2: Create a minimal `DataTableSuperDemo.rozie`**

```html
<components>
{
  DataTable: '../../packages/ui/data-table/src/DataTable.rozie',
  Column: '../../packages/ui/data-table/src/Column.rozie',
}
</components>

<data>
{
  rows: [
    { id: 1, customer: 'Ada Lovelace', category: 'Software', amount: 120.5, units: 3, status: 'active', active: true, orderedAt: '2026-03-01' },
    { id: 2, customer: 'Alan Turing',  category: 'Hardware', amount: 88.0,  units: 7, status: 'pending', active: false, orderedAt: '2026-03-04' },
    { id: 3, customer: 'Grace Hopper', category: 'Services', amount: 240.0, units: 1, status: 'active', active: true, orderedAt: '2026-03-06' },
  ],
}
</data>

<template>
  <main data-testid="dt-super">
    <h1>DataTable — super demo</h1>
    <DataTable :data="$data.rows" :stickyHeader="true">
      <Column field="id" header="#" :sortable="true" />
      <Column field="customer" header="Customer" :sortable="true" />
      <Column field="category" header="Category" :sortable="true" />
      <Column field="amount" header="Amount" :sortable="true" />
    </DataTable>
  </main>
</template>
```

- [ ] **Step 3: Register in the VR host (3 spots)**

Add `'DataTableSuper'` to the host loader example list (near `'DataTableSort'`), `DataTableSuper: 'rozie-data-table-super'` to `LIT_TAGS`, and `DataTableSuper: {}` to the third per-example map (mirror the `DataTableSort: {}` entry). Do NOT touch `matrix.spec.ts`.

- [ ] **Step 4: Build the host + verify it renders in Vue**

Run: `pnpm vr-preview:build` then, in another shell, confirm the built cell exists:
`ls tests/visual-regression/dist/vue/host/entry.vue.html`
Expected: the file exists (the Vue sub-build compiled the demo). If the build errors on the new demo, read the compiler diagnostic and fix the `.rozie` before proceeding.

- [ ] **Step 5: Write the smoke**

`tests/visual-regression/specs/data-table-super.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('super demo renders a table in Vue', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await expect(page.getByTestId('dt-super')).toBeVisible();
  await expect(page.locator('table, [role="grid"], [role="table"]')).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
```

- [ ] **Step 6: Run the smoke**

Run: `pnpm --filter @rozie/visual-regression exec playwright test data-table-super --reporter=line`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add examples/demos/DataTableSuperDemo.rozie tests/visual-regression/host/main.ts tests/visual-regression/specs/data-table-super.spec.ts
git commit -m "feat(dogfood): scaffold DataTableSuperDemo.rozie + register in VR host"
```

---

### Task 2: Full column set + all two-way slices + state readout

**Files:**
- Modify: `examples/demos/DataTableSuperDemo.rozie`
- Modify: `tests/visual-regression/specs/data-table-super.spec.ts`

**Interfaces:**
- Produces: `$data` slices `sorting, globalFilter, columnFilters, rowSelection, pagination, grouping, expanded, columnVisibility, columnSizing, columnOrder, columnPinning` bound via `r-model:<slice>`; a `data-testid="readout"` panel with one `[data-slice="<k>"]` per slice; the eight-column set on the ~1,500-row dataset.

- [ ] **Step 1: Grow the dataset to ~1,500 rows via a factory**

In `<data>`, replace the 3 static rows with a generated set. Rozie `<data>` accepts function-valued defaults; use an IIFE-free factory field the template reads:

```js
  rows: (() => {
    const C = ['Ada Lovelace','Alan Turing','Grace Hopper','Katherine Johnson','Margaret Hamilton','Edsger Dijkstra','Barbara Liskov','Donald Knuth','Radia Perlman'];
    const K = ['Hardware','Software','Services','Support'];
    const S = ['active','pending','archived'];
    let seed = 42; const rnd = () => (seed = (seed*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = (a) => a[Math.floor(rnd()*a.length)];
    return Array.from({ length: 1500 }, (_, i) => ({
      id: i+1, customer: pick(C), category: pick(K),
      amount: Math.round(rnd()*50000)/100, units: 1+Math.floor(rnd()*40),
      status: pick(S), active: rnd() > 0.4,
      orderedAt: `2026-03-${String(1+Math.floor(rnd()*27)).padStart(2,'0')}`,
    }));
  })(),
```

> If the `<data>` object-literal parser rejects the IIFE, move the generator into a `<script>` block that assigns `$data.rows` in `$onMount`, seeding an empty `rows: []` in `<data>` and gating the table with `r-if="$data.rows.length"`. Prefer the `<data>` factory; fall back only on a parser error.

- [ ] **Step 2: Bind all slices + full columns**

Add all `r-model:<slice>` bindings to `<DataTable>` (`sorting`, `globalFilter`, `columnFilters`, `rowSelection`, `pagination`, `grouping`, `expanded`, `columnVisibility`, `columnSizing`, `columnOrder`, `columnPinning`) with matching `<data>` seed values (`sorting: []`, `pagination: { pageIndex: 0, pageSize: 20 }`, object slices `{}`, array slices `[]`). Add the full eight columns (`id, customer, category, amount, units, status, active, orderedAt`) with `:sortable`, `:filterable` on the filterable ones, and `groupable` on `customer`/`category`/`status`. Add `:selectionMode="'multiple'"`.

- [ ] **Step 3: Add the state readout panel**

Below the table, render a readout mirroring the existing demos' readout pattern (see `DataTableGridEmitDemo.rozie`'s activecell readout):

```html
    <aside data-testid="readout">
      <code data-slice="sorting">sorting: {{ JSON.stringify($data.sorting) }}</code>
      <code data-slice="grouping">grouping: {{ JSON.stringify($data.grouping) }}</code>
      <code data-slice="rowSelection">rowSelection: {{ JSON.stringify($data.rowSelection) }}</code>
      <code data-slice="expanded">expanded: {{ JSON.stringify($data.expanded) }}</code>
      <code data-slice="pagination">pagination: {{ JSON.stringify($data.pagination) }}</code>
      <code data-slice="columnFilters">columnFilters: {{ JSON.stringify($data.columnFilters) }}</code>
    </aside>
```

- [ ] **Step 4: Extend the smoke**

Add to `data-table-super.spec.ts`:

```ts
test('header click updates the sorting readout', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByRole('columnheader', { name: 'Customer' }).click();
  await expect(page.getByTestId('readout').locator('[data-slice="sorting"]')).toContainText('customer');
});
```

- [ ] **Step 5: Rebuild + run smokes**

Run: `pnpm vr-preview:build` then `pnpm --filter @rozie/visual-regression exec playwright test data-table-super --reporter=line`
Expected: both PASS. If the sort-header role/name differs, read the real DOM via `pnpm vr-preview` before adjusting the locator.

- [ ] **Step 6: Commit**

```bash
git add examples/demos/DataTableSuperDemo.rozie tests/visual-regression/specs/data-table-super.spec.ts
git commit -m "feat(dogfood): full column set, all two-way slices, live state readout"
```

---

### Task 3: Control panel — grid/virtual/selection/pagination toggles

**Files:**
- Modify: `examples/demos/DataTableSuperDemo.rozie`
- Modify: `tests/visual-regression/specs/data-table-super.spec.ts`

**Interfaces:**
- Produces: `$data` flags `gridMode`, `virtual`, `selectionMode`, `manualPagination` bound to control inputs (`data-testid="ctl-<flag>"`) and onto `<DataTable>` props: `:interactionMode="$data.gridMode ? 'grid' : 'table'"`, `:virtual`, `:maxHeight`, `:estimateRowHeight`, `:selectionMode`, `:manual`.

- [ ] **Step 1: Add flags to `<data>`**

`gridMode: false, virtual: false, selectionMode: 'multiple', manualPagination: false`.

- [ ] **Step 2: Add the control panel above the table**

```html
    <fieldset data-testid="controls">
      <label>mode
        <select data-testid="ctl-gridMode" r-model="$data.gridMode">
          <option :value="false">table</option>
          <option :value="true">grid</option>
        </select>
      </label>
      <label><input data-testid="ctl-virtual" type="checkbox" r-model="$data.virtual" /> virtualize</label>
      <label>selection
        <select data-testid="ctl-selectionMode" r-model="$data.selectionMode">
          <option value="none">none</option>
          <option value="single">single</option>
          <option value="multiple">multiple</option>
        </select>
      </label>
      <label><input data-testid="ctl-manual" type="checkbox" r-model="$data.manualPagination" /> manual pagination</label>
    </fieldset>
```

> If binding `<option :value="true/false">` mis-coerces to strings on some target, switch `gridMode` to a string `'table'|'grid'` model and bind `:interactionMode="$data.gridMode"` directly. Note it as DONE_WITH_CONCERNS if you hit it.

- [ ] **Step 3: Wire flags onto `<DataTable>`**

Add: `:interactionMode="$data.gridMode ? 'grid' : 'table'"`, `:virtual="$data.virtual"`, `:maxHeight="'440px'"`, `:estimateRowHeight="40"`, `:selectionMode="$data.selectionMode"`, `:manual="$data.manualPagination"`.

- [ ] **Step 4: Extend the smoke**

```ts
test('grid mode exposes role=grid', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-gridMode').selectOption('grid');
  await expect(page.locator('[role="grid"]')).toBeVisible();
});
test('virtualization windows the rows', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-virtual').check();
  await expect.poll(async () => page.locator('tbody tr').count()).toBeLessThan(100);
});
```

- [ ] **Step 5: Rebuild + run + commit**

Run: `pnpm vr-preview:build` then `pnpm --filter @rozie/visual-regression exec playwright test data-table-super --reporter=line` (expected PASS), then:
```bash
git add examples/demos/DataTableSuperDemo.rozie tests/visual-regression/specs/data-table-super.spec.ts
git commit -m "feat(dogfood): control panel — grid/table, virtualization, selection, manual pagination"
```

---

### Task 4: Editing + the five editor drop-ins (`#editor`)

**Files:**
- Modify: `examples/demos/DataTableSuperDemo.rozie` (add drop-ins to `<components>`; editable columns; `#editor` slot)
- Modify: `tests/visual-regression/specs/data-table-super.spec.ts`

**Interfaces:**
- Produces: `:editable="true" editor="custom"` on `customer/category/amount/active/orderedAt/status`; a `#editor` slot dispatched by `columnId` to `EditorText/Number/Select/Checkbox/Date`; a `@cellEditCommit` handler setting `$data.lastCommit`.

- [ ] **Step 1: Add editor drop-ins to `<components>`**

Add `EditorText`, `EditorNumber`, `EditorSelect`, `EditorCheckbox`, `EditorDate` (paths `'../../packages/ui/data-table/src/<Name>.rozie'`). Add `categoryOptions`/`statusOptions` arrays to `<data>` (`[{ value, label }]`).

- [ ] **Step 2: Mark columns editable + add the `#editor` slot**

Mirror `examples/demos/DataTableEditDemo.rozie`'s `#editor` slot. Add `:editable="true" editor="custom"` to the six columns, then:

```html
      <template #editor="{ columnId, column, row, value, commit, cancel }">
        <EditorSelect r-if="columnId === 'category'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" :options="$data.categoryOptions" />
        <EditorSelect r-else-if="columnId === 'status'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" :options="$data.statusOptions" />
        <EditorNumber r-else-if="columnId === 'amount'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" />
        <EditorCheckbox r-else-if="columnId === 'active'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" />
        <EditorDate r-else-if="columnId === 'orderedAt'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" />
        <EditorText r-else :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" />
      </template>
```

Add `@cellEditCommit="onCommit"` and a `<listeners>`/`<script>` `onCommit(p) { $data.lastCommit = p }` with `lastCommit: null` in `<data>` and a `[data-slice="lastCommit"]` readout line.

- [ ] **Step 2b: Verify the `r-else-if` chain compiles on all authored targets**

If the compiler rejects `r-else-if` in slot position, fall back to separate `r-if` blocks each testing `columnId`. Note which you used.

- [ ] **Step 3: Smoke**

```ts
test('editing a Customer cell fires cellEditCommit', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  const cell = page.locator('tbody tr').first().locator('td').nth(1);
  await cell.click();
  await page.keyboard.press('Enter');
  await cell.locator('input').fill('Zzz Edited');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('readout').locator('[data-slice="lastCommit"]')).toContainText('customer');
});
```

- [ ] **Step 4: Rebuild + run + commit**

`pnpm vr-preview:build` → run the spec (PASS; if Enter-to-edit differs, drive it in `pnpm vr-preview` and match the real keymap — F2 is the documented alternate — do not weaken the commit assertion), then:
```bash
git add examples/demos/DataTableSuperDemo.rozie tests/visual-regression/specs/data-table-super.spec.ts
git commit -m "feat(dogfood): inline editing wired to all five editor drop-ins"
```

---

### Task 5: Grouping + GroupBar, filters (text/faceted/range), expandable + DetailPanel

**Files:**
- Modify: `examples/demos/DataTableSuperDemo.rozie`
- Modify: `tests/visual-regression/specs/data-table-super.spec.ts`

**Interfaces:**
- Produces: `groupable expandable` on `<DataTable>`; `#groupBar`, `#filter` (dispatched by `columnId`), `#detail` slots filled by `GroupBar`/`FilterText`/`FilterSelect`/`FilterNumberRange`/`DetailPanel`.

- [ ] **Step 1: Add the five drop-ins to `<components>`**

`GroupBar`, `FilterText`, `FilterNumberRange`, `FilterSelect`, `DetailPanel`.

- [ ] **Step 2: Enable + add slots (mirror `DataTableDetailPanelDemo.rozie` + the docs demo)**

Add `:groupable="true" :expandable="true"` to `<DataTable>`, then the three slots:

```html
      <template #groupBar="{ grouping, groupableColumns, applyGrouping, clearGrouping }">
        <GroupBar :grouping="grouping" :groupableColumns="groupableColumns" :applyGrouping="applyGrouping" :clearGrouping="clearGrouping" />
      </template>
      <template #filter="{ columnId, uniqueValues, minMax, setFilter }">
        <FilterSelect r-if="columnId === 'category' || columnId === 'status'" :columnId="columnId" :setFilter="setFilter" :uniqueValues="uniqueValues" />
        <FilterNumberRange r-else-if="columnId === 'amount'" :columnId="columnId" :setFilter="setFilter" :minMax="minMax" />
        <FilterText r-else :columnId="columnId" :setFilter="setFilter" />
      </template>
      <template #detail="{ row }">
        <DetailPanel :row="row" />
      </template>
```

- [ ] **Step 3: Smoke (faceted filter + expand; grouping is covered via the handle in Task 6)**

```ts
test('faceted select filter narrows rows', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  const before = await page.locator('tbody tr').count();
  await page.getByTestId('dt-super').getByRole('combobox').first().selectOption({ index: 1 });
  await expect.poll(async () => page.locator('tbody tr').count()).toBeLessThanOrEqual(before);
});
test('expanding a row reveals its detail panel', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.locator('tbody tr').first().getByRole('button').first().click();
  await expect(page.getByTestId('readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
});
```

- [ ] **Step 4: Rebuild + run + commit**

`pnpm vr-preview:build` → run spec (PASS; verify selectors in `pnpm vr-preview` if a locator misses), then:
```bash
git add examples/demos/DataTableSuperDemo.rozie tests/visual-regression/specs/data-table-super.spec.ts
git commit -m "feat(dogfood): GroupBar + text/faceted/range filters + expandable DetailPanel"
```

---

### Task 6: Isolated imperative-handle panel (`$refs` in `@click` only)

**Files:**
- Modify: `examples/demos/DataTableSuperDemo.rozie`
- Modify: `tests/visual-regression/specs/data-table-super.spec.ts`

**Interfaces:**
- Produces: `r-ref="tbl"` on `<DataTable>`; a panel gated by `r-if="$data.showHandle"` (default `false`) with a button per `$expose` verb, each calling `$refs.tbl.<verb>(…)` in `@click`.

- [ ] **Step 1: Add the ref + the isolation toggle**

Add `r-ref="tbl"` to `<DataTable>` (mirror how existing demos attach a component ref). Add `showHandle: false` to `<data>` and a toggle: `<label><input data-testid="ctl-handle" type="checkbox" r-model="$data.showHandle" /> imperative panel</label>`.

- [ ] **Step 2: Add the gated panel**

```html
    <fieldset r-if="$data.showHandle" data-testid="handle">
      <button data-testid="verb-expandAll" @click="$refs.tbl.expandAll()">expandAll</button>
      <button data-testid="verb-collapseAll" @click="$refs.tbl.collapseAll()">collapseAll</button>
      <button data-testid="verb-toggleAllRows" @click="$refs.tbl.toggleAllRows(true)">toggleAllRows</button>
      <button data-testid="verb-clearSelection" @click="$refs.tbl.clearSelection()">clearSelection</button>
      <button data-testid="verb-clearSorting" @click="$refs.tbl.clearSorting()">clearSorting</button>
      <button data-testid="verb-applyGrouping" @click="$refs.tbl.applyGrouping(['category'])">applyGrouping(category)</button>
      <button data-testid="verb-clearGrouping" @click="$refs.tbl.clearGrouping()">clearGrouping</button>
      <button data-testid="verb-setPage" @click="$refs.tbl.setPage(2)">setPage(2)</button>
      <button data-testid="verb-resetColumnSizing" @click="$refs.tbl.resetColumnSizing()">resetColumnSizing</button>
      <button data-testid="verb-pinColumn" @click="$refs.tbl.pinColumn('customer','left')">pinColumn</button>
    </fieldset>
```

> These are side-effecting verbs whose result shows in the readout. Getter verbs are exercised by hand. If `$refs.tbl.<verb>` is undefined at click time on `target=vue`, the composed-child handle is not wired — report DONE_WITH_CONCERNS with the exact verb/target; do NOT delete the panel (its cross-target status is a dogfood deliverable).

- [ ] **Step 3: Smoke (vue only — the cross-target status is validated in Task 7)**

```ts
test('imperative expandAll populates expanded; applyGrouping writes grouping', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-handle').check();
  await page.getByTestId('verb-expandAll').click();
  await expect(page.getByTestId('readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
  await page.getByTestId('verb-applyGrouping').click();
  await expect(page.getByTestId('readout').locator('[data-slice="grouping"]')).toContainText('category');
});
```

- [ ] **Step 4: Rebuild + run + commit**

`pnpm vr-preview:build` → run spec (PASS on vue), then:
```bash
git add examples/demos/DataTableSuperDemo.rozie tests/visual-regression/specs/data-table-super.spec.ts
git commit -m "feat(dogfood): isolated imperative-handle panel (\$refs verbs in @click)"
```

---

### Task 7: Theme switcher (portable `<link>`/`sheet.disabled` swap)

**Files:**
- Modify: `examples/demos/DataTableSuperDemo.rozie`
- Modify: `tests/visual-regression/specs/data-table-super.spec.ts`

**Interfaces:**
- Produces: a `theme` model (`'base'|'shadcn'|'material'|'bootstrap'`, default `'base'`) that swaps the active data-table stylesheet at runtime via DOM, portably across targets.

- [ ] **Step 1: Provide the four theme sheets to the host as swappable stylesheets**

The theme CSS lives at `packages/ui/data-table/src/themes/{base,shadcn,material,bootstrap}.css`. In the demo `<script>`/`$onMount`, inject four `<link rel="stylesheet">` (or `<style>`) elements into `document.head`, one per theme, each with `id="rdt-theme-<name>"` and all but `base` set `disabled = true`. Resolve the four URLs by importing them as assets so Vite serves them; if a portable import is not available from inside `.rozie`, inject `<style>` elements whose text is imported from the theme files via the host build. Keep base active on mount.

> This is the portability-sensitive task. If asset-URL resolution from `.rozie` is not portable, the acceptable fallback is: the host wrapper (`tests/visual-regression/host/*`) exposes the four sheets on `window.__rdtThemes` and the demo reads that in `$onMount`. Prefer the self-contained `.rozie` approach; use the host-provided fallback only if the compiler blocks asset imports. Record which path you used.

- [ ] **Step 2: Add the picker + swap handler**

```html
    <label>theme
      <select data-testid="ctl-theme" r-model="$data.theme" @change="applyTheme($data.theme)">
        <option value="base">base</option>
        <option value="shadcn">shadcn</option>
        <option value="material">material</option>
        <option value="bootstrap">bootstrap</option>
      </select>
    </label>
```

`applyTheme(name)` (event handler — `$refs`/DOM access allowed): set `sheet.disabled` on each `rdt-theme-*` element so only `name` is enabled.

- [ ] **Step 3: Smoke**

```ts
test('switching theme changes the active data-table stylesheet', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  const activeHref = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('[id^="rdt-theme-"]')).find((s) => !(s as HTMLStyleElement & { disabled?: boolean }).disabled)?.id);
  const before = await activeHref();
  await page.getByTestId('ctl-theme').selectOption('material');
  await expect.poll(activeHref).not.toBe(before);
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
```

- [ ] **Step 4: Rebuild + run + commit**

`pnpm vr-preview:build` → run spec (PASS), then:
```bash
git add examples/demos/DataTableSuperDemo.rozie tests/visual-regression/specs/data-table-super.spec.ts tests/visual-regression/host
git commit -m "feat(dogfood): live theme switcher via portable stylesheet-disable swap"
```

---

### Task 8: Cross-target validation pass + drop stale `interactionMode` annotation

**Files:**
- Modify: `packages/ui/data-table/src/DataTable.rozie` (the `interactionMode` prop annotation, ~L394)
- Modify: (regenerated) the 6 data-table leaves via rebless
- Create: `docs/superpowers/plans/data-table-super-crosstarget-findings.md` (the dogfood findings log)

**Interfaces:**
- Consumes: the completed `DataTableSuperDemo.rozie`.
- Produces: a per-target findings table (what works / what breaks per target) + the annotation fix.

- [ ] **Step 1: Build all six sub-targets**

Run: `pnpm vr-preview:build`
Expected: all six per-target sub-builds succeed. A build error on one target is finding #1 — record the diagnostic, and if it's the imperative panel or theme swap, confirm the isolation toggle keeps the rest renderable.

- [ ] **Step 2: Smoke the render on every target**

Add a parametrized render check:

```ts
for (const t of ['vue','react','svelte','angular','solid','lit'] as const) {
  test(`super demo renders on ${t}`, async ({ page }) => {
    await page.goto(`/?example=DataTableSuper&target=${t}`);
    await expect(page.getByTestId('dt-super')).toBeVisible();
    await expect(page.locator('tbody tr, [role="row"]').first()).toBeVisible();
  });
}
```

Run: `pnpm --filter @rozie/visual-regression exec playwright test data-table-super --reporter=line`
Record every failure in the findings log with target + symptom (do not mask a failure by loosening the assertion).

- [ ] **Step 3: Write the findings log**

`docs/superpowers/plans/data-table-super-crosstarget-findings.md`: a table of feature × target with ✅/⚠️/❌ and a note per non-✅ cell, plus a "root-cause candidates" list (compiler gap vs demo-authoring vs genuinely-unsupported). This is the artifact Dan reviews.

- [ ] **Step 4: Drop the stale `interactionMode` deprecation annotation**

Run `grep -n "not implemented yet\|deprecated" packages/ui/data-table/src/DataTable.rozie`; edit the `interactionMode` prop so it documents `'table'` (default) and `'grid'` (WAI-ARIA grid nav, GA since Phase 63) with NO "not implemented"/`deprecated` text. Keep type + default unchanged.

- [ ] **Step 5: Rebless the leaves + re-verify**

Run:
```bash
pnpm --filter @rozie/core... build --force
pnpm --filter @rozie-ui/data-table build --force
pnpm --filter dist-parity bootstrap
```
Review `git diff` on the leaves — annotation/comment text only, no logic. Then rebuild the host and re-run the render smokes:
```bash
pnpm vr-preview:build
pnpm --filter @rozie/visual-regression exec playwright test data-table-super --reporter=line
grep -rn "not implemented yet" packages/ui/data-table/ || echo clean
```
Expected: `clean`; vue render smoke still PASS (other-target results recorded, not necessarily all green — that's the dogfood output).

- [ ] **Step 6: Commit**

```bash
git add examples/demos/DataTableSuperDemo.rozie tests/visual-regression packages/ui/data-table docs/superpowers/plans/data-table-super-crosstarget-findings.md
git commit -m "feat(dogfood): cross-target validation pass + drop stale interactionMode annotation; rebless leaves"
```

---

## Self-Review

**Spec coverage:** combined kitchen-sink in one `.rozie` (Tasks 1–6); theming (Task 7); cross-target validation, Vue-first (per-task smoke on `target=vue`, all-six in Task 8); state readout (Task 2); imperative handle isolated (Task 6); stale annotation + rebless (Task 8). The original spec's "real installed package" is intentionally superseded by source-composition per the user's cross-target directive — noted in the spec addendum. ✓

**Placeholder scan:** No "handle edge cases"/"similar to Task N". Each fallback (data-factory IIFE, `r-else-if` in slots, `<option :value>` coercion, theme asset-URL portability, composed-child handle wiring) names the exact trigger and the exact fallback — these are real cross-target unknowns this dogfood exists to surface, flagged as DONE_WITH_CONCERNS points, not vague gaps.

**Type/name consistency:** `$data` flag names (`gridMode`, `virtual`, `selectionMode`, `manualPagination`, `showHandle`, `theme`) match their `ctl-*` inputs and the `<DataTable>` prop bindings. Slice names match `r-model:<slice>`, the `[data-slice]` readout keys, and the smoke locators. Drop-in component names match the `.rozie` source filenames imported in `<components>`.

## Execution Handoff

Subagent-driven, per the active skill.
