import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick task 260907-u14 — product-level six-target coverage for the `cell-<columnId>`,
 * `colHeader-<columnId>` and `filter-<columnId>` per-column slot families on the REAL
 * `<DataTable>`. Closes the top SECOND-TIER finding of the Phase 88 pre-release deep audit:
 * `editor-<columnId>` already has data-table-editor-family-focus.spec.ts; these three
 * families shipped in @rozie-ui/data-table 0.4.0 with ZERO product-level tests. The two
 * existing mechanism proofs (dynamic-slot-name.spec.ts, nested-slot-fallback.spec.ts) run
 * against minimal isolated demo pairs by design and structurally cannot catch a
 * data-table-specific integration failure.
 *
 * Fixture: examples/demos/DataTableSlotFamilyDemo.rozie mounts THREE independently
 * addressable `<DataTable>` instances (`[data-dt-instance]` — a helper resolving the first
 * `table` in the page would pick the wrong one for the 2nd/3rd instance):
 *   - `plain`    — non-windowed <tbody> branch, generic fills present (proves family > generic,
 *                  generic-where-no-family).
 *   - `windowed` — windowed <tbody> branch, generic fills present (same tiering, virtual body).
 *   - `bare`     — windowed <tbody> branch, NO generic fills at all (proves family > built-in,
 *                  built-in-where-neither).
 *
 * Every instance carries the SAME four columns: region (groupable), name (sortable +
 * filterable), status (filterable), units (aggregationFn=sum, NOT filterable — the
 * `filter-` gate probe). `plain` additionally sets selectionMode="multiple", auto-injecting
 * the `__rdt_select` chrome column — the chrome-exclusion probe (a declared `#cell-__rdt_select`
 * fill on that instance must render nothing).
 *
 * DOM-probe findings (Task 1, this session — do not re-derive):
 *   - This demo does NOT set `interactionMode="grid"` (unlike
 *     data-table-editor-family-focus.spec.ts's fixture), so `tableRole()` returns 'table', not
 *     'grid'. A `table[role="grid"]` selector (the editor-family spec's approach) matches
 *     NOTHING here — this spec resolves the table via `table.rozie-data-table` instead.
 *   - Both the windowed AND non-windowed HEADER `<th>` carry the full grid-cell attribute set
 *     (`data-grid-cell`, `data-row="__header"`, `:data-col`, `:data-col-index`) regardless of
 *     interactionMode — confirmed by direct source read (DataTable.rozie :1908-1919 windowed,
 *     :2456-2466 non-windowed). No positional fallback needed for headers.
 *   - Body `<td>` cells likewise always carry `data-grid-cell` + `:data-col` + `:data-row` +
 *     `:data-col-index` regardless of interactionMode (:2191-2199 windowed, :2692-2700
 *     non-windowed) — the `[data-grid-cell][data-row][data-col-index]`
 *     shape data-table-editor-family-focus.spec.ts assumes is present here too, keyed
 *     additionally on `data-col` (the column id), which this spec uses directly.
 *   - The FILTER row is the one asymmetry: the windowed filter `<th>` carries
 *     `:data-col="wh.header.column.id"` (:2101), but the NON-windowed filter `<th>` does NOT —
 *     it carries only `:key`/`:style` (:2631-2637), no `data-col` at all. This is a genuine,
 *     if harmless, inconsistency in the shipped 0.4.0 markup (filter cells are explicitly
 *     documented as outside the roving-tabindex grid, so nothing keys off `data-col` there in
 *     production). This spec resolves EVERY filter cell — windowed or not — by DOM-order index
 *     against the header row's leaf column order (`windowedHeadersFor()`/`hg.headers` and the
 *     filter row's `r-for` iterate the SAME leaf header list in the SAME order on both
 *     branches — confirmed by source read — and neither instance has column-windowing spacer
 *     `<th>`s, since `:virtual="true"` resolves to the 'rows' axis only, never 'columns'), never
 *     by `data-col`. This one strategy is correct and sufficient for all three instances
 *     uniformly, so no per-instance branching is needed.
 *
 * Case → DataTable.rozie site map (10 uncovered sites; `editor-` at :2321/:2829 is already
 * covered by data-table-editor-family-focus.spec.ts and is NOT touched here):
 *   Case 1 (plain, cell-):        leaf :2372, grouped :2253         (non-windowed body)
 *   Case 2 (plain, colHeader-):   sortable :1955, non-sortable :1973 (non-windowed header... —
 *                                 see note: `plain` is the non-windowed instance, so these are
 *                                 actually the :2519/:2538 non-windowed sites)
 *   Case 3 (plain, filter-):      :2643 (non-windowed filter row)
 *   Case 4 (plain, chrome):       structural — proves the __rdt_select short-circuit, all sites
 *   Case 5 (windowed, all 3):     colHeader :1955/:1973, filter :2109, cell :2253/:2372 (windowed)
 *   Case 6 (bare, family wins):   cell :2253/:2372, colHeader :1955, filter :2109 (windowed)
 *   Case 7 (bare, built-in):      cell :2372, colHeader :1973, filter :2109/built-in fallback
 *
 * No pixel-diff assertion of any kind is made in this file, and no PNG baseline directory is
 * created — every check below reads DOM structure and text content only. That discipline is
 * deliberate: a screenshot cannot distinguish "the correct tier resolved" from "a coincidentally
 * identical fallback render", which is exactly the ambiguity these DOM assertions exist to
 * remove (the same rationale nested-slot-fallback.spec.ts documents for the same reason).
 *
 * Wiring: examples/demos/DataTableSlotFamilyDemo.rozie (single self-contained demo, three
 * instances, not a producer/consumer pair) + tests/visual-regression/host/main.ts
 * EXAMPLES/LIT_TAGS/PROPS (`DataTableSlotFamily`) + the standard `runnerFor` per-target
 * build-availability gate (`dynamic-slot-name.spec.ts` / `data-table-editor-family-focus.spec.ts`
 * precedent).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// Empty known-failing set — every target must be genuinely green, not permanently fixme'd. A
// subset passing while another fails would be a real finding about shipped 0.4.0, not something
// to paper over here.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

interface HeaderCellInfo {
  testids: string[];
  hasSortBtn: boolean;
  text: string;
}

interface FilterCellInfo {
  testids: string[];
  builtinCount: number;
}

interface BodyCellInfo {
  testids: string[];
  hasExpander: boolean;
  groupCountText: string | null;
  text: string;
}

interface RowSnapshot {
  rowId: string | null;
  cells: Record<string, BodyCellInfo>;
}

interface SelectColumnBodyCell {
  testids: string[];
  hasCheckbox: boolean;
}

interface InstanceSnapshot {
  found: boolean;
  hasScrollWrapper: boolean;
  renderedRowCount: number;
  columnIds: string[];
  header: Record<string, HeaderCellInfo>;
  filter: Record<string, FilterCellInfo>;
  filterRowExists: boolean;
  groupHeaderRow: RowSnapshot | null;
  leafRow: RowSnapshot | null;
  selectColumnId: string | null;
  selectColumnBodyCells: SelectColumnBodyCell[];
}

const EMPTY_SNAPSHOT: InstanceSnapshot = {
  found: false,
  hasScrollWrapper: false,
  renderedRowCount: 0,
  columnIds: [],
  header: {},
  filter: {},
  filterRowExists: false,
  groupHeaderRow: null,
  leafRow: null,
  selectColumnId: null,
  selectColumnBodyCells: [],
};

/**
 * Reads a full structural snapshot of one `[data-dt-instance="<instance>"]` grid: header cell
 * markers per column, filter cell markers per column (resolved by DOM-order index — see the
 * header comment's probe-findings note on why filter `<th>` cannot be trusted to carry
 * `data-col`), the first group-header row's cells, the first leaf row's cells, and every
 * currently-rendered body cell for the auto-injected `__rdt_select` chrome column (Case 4).
 * `deepQueryAll` pierces open shadow roots (Lit) — a no-op multi-hop for the five light-DOM
 * targets. Inlined into the `page.evaluate` callback rather than imported: `page.evaluate(fn)`
 * serializes `fn` via `Function.prototype.toString()`, and a helper referenced from outside that
 * closure's own source text throws `ReferenceError` in the browser.
 */
async function getInstanceSnapshot(page: Page, instance: string): Promise<InstanceSnapshot> {
  return page.evaluate((instanceName: string): InstanceSnapshot => {
    function deepQueryAll(
      root: Element | Document | ShadowRoot | null,
      sel: string,
      out: Element[] = [],
    ): Element[] {
      if (!root) return out;
      const direct = root.querySelectorAll ? Array.from(root.querySelectorAll(sel)) : [];
      out.push(...(direct as Element[]));
      const all = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
      for (const el of all as Element[]) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) deepQueryAll(sr, sel, out);
      }
      return out;
    }

    const wrapper = deepQueryAll(document, `[data-dt-instance="${instanceName}"]`)[0];
    if (!wrapper) {
      return {
        found: false,
        hasScrollWrapper: false,
        renderedRowCount: 0,
        columnIds: [],
        header: {},
        filter: {},
        filterRowExists: false,
        groupHeaderRow: null,
        leafRow: null,
        selectColumnId: null,
        selectColumnBodyCells: [],
      };
    }
    const table = deepQueryAll(wrapper, 'table.rozie-data-table')[0] as HTMLTableElement | undefined;
    if (!table) {
      return {
        found: false,
        hasScrollWrapper: false,
        renderedRowCount: 0,
        columnIds: [],
        header: {},
        filter: {},
        filterRowExists: false,
        groupHeaderRow: null,
        leafRow: null,
        selectColumnId: null,
        selectColumnBodyCells: [],
      };
    }

    const hasScrollWrapper = deepQueryAll(wrapper, '.rdt-scroll').length > 0;
    const testidsOf = (el: Element): string[] =>
      deepQueryAll(el, '[data-testid]').map((n) => n.getAttribute('data-testid') || '');

    // Header row (leaf level): every grid-cell `<th>` in DOM order.
    const headerThs = deepQueryAll(table, '[data-grid-cell][data-row="__header"]') as HTMLElement[];
    const columnIds = headerThs.map((th) => th.getAttribute('data-col') || '');

    const header: Record<string, HeaderCellInfo> = {};
    headerThs.forEach((th) => {
      const colId = th.getAttribute('data-col') || '';
      // Scope the text read to `.rdt-header-label` — the whole `<th>` also contains the
      // Popover column-options menu (⋯ / Pin left / Pin right / Unpin / Hide column),
      // which is present in textContent even while visually closed and would corrupt an
      // exact-text comparison against just the label.
      const labelEl = th.querySelector('.rdt-header-label');
      header[colId] = {
        testids: testidsOf(th),
        hasSortBtn: !!th.querySelector('button.rdt-sort-btn'),
        text: ((labelEl ? labelEl.textContent : th.textContent) || '').trim(),
      };
    });

    // Filter row — zipped by DOM-order index against the header row's column order (see the
    // spec header comment: the non-windowed filter `<th>` carries no `data-col` at all).
    const filterRow = deepQueryAll(table, 'tr.rdt-filter-row')[0] || null;
    const filterRowExists = !!filterRow;
    const filterThs = filterRow ? (deepQueryAll(filterRow, 'th.rdt-filter-cell') as HTMLElement[]) : [];
    const filter: Record<string, FilterCellInfo> = {};
    filterThs.forEach((th, i) => {
      const colId = columnIds[i] || `__unmapped-${i}`;
      filter[colId] = {
        testids: testidsOf(th),
        builtinCount: deepQueryAll(th, 'input.rdt-col-filter').length,
      };
    });

    // Body rows — `.rdt-tr` excludes the `.rdt-spacer` (windowing pad) and `.rdt-detail-row`
    // rows, on both the windowed and non-windowed branch.
    const bodyRows = deepQueryAll(table, 'tbody tr.rdt-tr') as HTMLElement[];
    const groupHeaderTr = bodyRows.find((tr) => tr.hasAttribute('data-group-header')) || null;
    const leafTr = bodyRows.find((tr) => tr.hasAttribute('data-group-leaf')) || null;

    const rowSnapshot = (tr: HTMLElement | null): RowSnapshot | null => {
      if (!tr) return null;
      const cells = deepQueryAll(tr, '[data-grid-cell]') as HTMLElement[];
      const cellsOut: Record<string, BodyCellInfo> = {};
      cells.forEach((td) => {
        const colId = td.getAttribute('data-col') || '';
        const groupCount = td.querySelector('.rdt-group-count');
        cellsOut[colId] = {
          testids: testidsOf(td),
          hasExpander: !!td.querySelector('[data-expander]'),
          groupCountText: groupCount ? (groupCount.textContent || '').trim() : null,
          text: (td.textContent || '').trim(),
        };
      });
      return {
        rowId: tr.getAttribute('data-group-header') || tr.getAttribute('data-group-leaf') || tr.getAttribute('data-row'),
        cells: cellsOut,
      };
    };

    const selectColumnId = columnIds.find((id) => id === '__rdt_select') || null;
    const selectColumnBodyCells: SelectColumnBodyCell[] = [];
    if (selectColumnId) {
      bodyRows.forEach((tr) => {
        const td = deepQueryAll(tr, `[data-grid-cell][data-col="${selectColumnId}"]`)[0] as
          | HTMLElement
          | undefined;
        if (td) {
          selectColumnBodyCells.push({
            testids: testidsOf(td),
            hasCheckbox: !!td.querySelector('input[type="checkbox"]'),
          });
        }
      });
    }

    return {
      found: true,
      hasScrollWrapper,
      renderedRowCount: bodyRows.length,
      columnIds,
      header,
      filter,
      filterRowExists,
      groupHeaderRow: rowSnapshot(groupHeaderTr),
      leafRow: rowSnapshot(leafTr),
      selectColumnId,
      selectColumnBodyCells,
    };
  }, instance);
}

const GROUP_COUNT_RE = /^\(\d+\)$/;

for (const target of TARGETS) {
  runnerFor(target)(
    `data-table-slot-family [${target}] (1): plain cell- family beats generic, generic where no family, grouped branch preserved`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableSlotFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      // Leaf row: name (family fill) beats generic; status (no family fill) falls to generic.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).leafRow?.cells['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-cell-name']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).leafRow?.cells['status']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['gen-cell']);

      // First group-header row: region (grouped, family fill) still carries the group toggle
      // + member count — the family fill must not displace the grouped chrome.
      await expect
        .poll(
          async () => (await getInstanceSnapshot(page, 'plain')).groupHeaderRow?.cells['region'] ?? null,
          { timeout: 5_000 },
        )
        .not.toBeNull();
      const regionCell = (await getInstanceSnapshot(page, 'plain')).groupHeaderRow?.cells['region'];
      expect(regionCell?.testids).toEqual(['fam-cell-region']);
      expect(regionCell?.hasExpander).toBe(true);
      expect(regionCell?.groupCountText).toMatch(GROUP_COUNT_RE);

      // Same group-header row: name (not the grouping column) is AGGREGATED, not a
      // placeholder — corrected probe finding (see spec header comment): with a single
      // grouping column, table-core's cell.getIsPlaceholder() is `!cell.getIsGrouped() &&
      // column.getIsGrouped()`, which is false for a non-grouping column, so `name` never
      // takes the cellIsPlaceholder() short-circuit here. It falls to
      // cell.getIsAggregated() = true instead (the row has subRows and name isn't grouped),
      // which flows through the SAME `#cell-<id>` family dispatch as any leaf cell — the
      // family fill still wins, just rendering `cell.getValue()`'s aggregated (here:
      // undefined, since `name` declares no aggregationFn) value.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).groupHeaderRow?.cells['name']?.testids ?? null, {
          timeout: 5_000,
        })
        .toEqual(['fam-cell-name']);
    },
  );

  runnerFor(target)(
    `data-table-slot-family [${target}] (2): plain colHeader- family in both header sub-branches, generic where no family`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableSlotFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      // name: sortable column — family fill inside the button.rdt-sort-btn branch.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).header['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-colheader-name']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).header['name']?.hasSortBtn ?? false, {
          timeout: 5_000,
        })
        .toBe(true);

      // status: non-sortable column (default) — family fill in the plain-label branch.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).header['status']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-colheader-status']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).header['status']?.hasSortBtn ?? true, {
          timeout: 5_000,
        })
        .toBe(false);

      // units: no family fill — generic tier.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).header['units']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['gen-colheader']);
    },
  );

  runnerFor(target)(
    `data-table-slot-family [${target}] (3): plain filter- family replaces the built-in input, generic where no family, gate holds`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableSlotFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      // name: family fill relocates the built-in input entirely — zero input.rdt-col-filter.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).filter['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-filter-name']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).filter['name']?.builtinCount ?? -1, {
          timeout: 5_000,
        })
        .toBe(0);

      // status: no family fill — generic tier, still zero built-in input.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).filter['status']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['gen-filter']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).filter['status']?.builtinCount ?? -1, {
          timeout: 5_000,
        })
        .toBe(0);

      // units: not filterable at all — the filterable gate holds, empty filter cell.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).filter['units']?.testids ?? null, {
          timeout: 5_000,
        })
        .toEqual([]);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'plain')).filter['units']?.builtinCount ?? -1, {
          timeout: 5_000,
        })
        .toBe(0);
    },
  );

  runnerFor(target)(`data-table-slot-family [${target}] (4): plain chrome columns are inert`, async ({ page }) => {
    await page.goto(`/?example=DataTableSlotFamily&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // The select column must actually exist — otherwise every assertion below passes
    // vacuously.
    await expect
      .poll(async () => (await getInstanceSnapshot(page, 'plain')).selectColumnId, { timeout: 5_000 })
      .toBe('__rdt_select');
    await expect
      .poll(
        async () => {
          const cells = (await getInstanceSnapshot(page, 'plain')).selectColumnBodyCells;
          return cells.some((c) => c.hasCheckbox);
        },
        { timeout: 5_000 },
      )
      .toBe(true);

    // Despite the demo declaring a #cell-__rdt_select fill, the select column's header
    // carries no family/generic marker at all (isSelectColumn short-circuits before the
    // colHeader slot is ever reached).
    await expect
      .poll(async () => (await getInstanceSnapshot(page, 'plain')).header['__rdt_select']?.testids ?? null, {
        timeout: 5_000,
      })
      .toEqual([]);

    // Its filter cell (isSelectColumn short-circuits before columnIsFilterable too) is
    // likewise empty.
    await expect
      .poll(async () => (await getInstanceSnapshot(page, 'plain')).filter['__rdt_select']?.testids ?? null, {
        timeout: 5_000,
      })
      .toEqual([]);

    // Every currently-rendered body cell in the select column carries no fam-cell-chrome
    // (or any other) marker — the declared fill is genuinely inert everywhere.
    await expect
      .poll(
        async () => {
          const cells = (await getInstanceSnapshot(page, 'plain')).selectColumnBodyCells;
          return cells.every((c) => c.testids.length === 0);
        },
        { timeout: 5_000 },
      )
      .toBe(true);
  });

  runnerFor(target)(
    `data-table-slot-family [${target}] (5): windowed — all three seams resolve inside the virtual branch`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableSlotFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      // The instance really is windowed — rendered via the isWindowed() branch, not a
      // second copy of the non-windowed `plain` instance.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).hasScrollWrapper, { timeout: 5_000 })
        .toBe(true);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).renderedRowCount, { timeout: 5_000 })
        .toBeGreaterThan(0);

      // cell- : leaf + grouped, same as Case 1, against the windowed instance.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).leafRow?.cells['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-cell-name']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).leafRow?.cells['status']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['gen-cell']);
      await expect
        .poll(
          async () => (await getInstanceSnapshot(page, 'windowed')).groupHeaderRow?.cells['region'] ?? null,
          { timeout: 5_000 },
        )
        .not.toBeNull();
      const windowedRegion = (await getInstanceSnapshot(page, 'windowed')).groupHeaderRow?.cells['region'];
      expect(windowedRegion?.testids).toEqual(['fam-cell-region']);
      expect(windowedRegion?.hasExpander).toBe(true);
      expect(windowedRegion?.groupCountText).toMatch(GROUP_COUNT_RE);
      // name is AGGREGATED (not a placeholder) on this group-header row too — same
      // corrected-probe-finding rationale as Case 1.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).groupHeaderRow?.cells['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-cell-name']);

      // colHeader- : sortable + non-sortable branches, same as Case 2.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).header['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-colheader-name']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).header['name']?.hasSortBtn ?? false, {
          timeout: 5_000,
        })
        .toBe(true);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).header['status']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-colheader-status']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).header['status']?.hasSortBtn ?? true, {
          timeout: 5_000,
        })
        .toBe(false);

      // filter- : the relocation assertion, same as Case 3.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).filter['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-filter-name']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'windowed')).filter['name']?.builtinCount ?? -1, {
          timeout: 5_000,
        })
        .toBe(0);
    },
  );

  runnerFor(target)(
    `data-table-slot-family [${target}] (6): bare — family beats the built-in render across all three seams`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableSlotFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).leafRow?.cells['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-cell-name']);

      await expect
        .poll(
          async () => (await getInstanceSnapshot(page, 'bare')).groupHeaderRow?.cells['region'] ?? null,
          { timeout: 5_000 },
        )
        .not.toBeNull();
      const bareRegion = (await getInstanceSnapshot(page, 'bare')).groupHeaderRow?.cells['region'];
      expect(bareRegion?.testids).toEqual(['fam-cell-region']);
      expect(bareRegion?.hasExpander).toBe(true);
      expect(bareRegion?.groupCountText).toMatch(GROUP_COUNT_RE);

      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).header['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-colheader-name']);

      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).filter['name']?.testids ?? [], {
          timeout: 5_000,
        })
        .toEqual(['fam-filter-name']);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).filter['name']?.builtinCount ?? -1, {
          timeout: 5_000,
        })
        .toBe(0);
    },
  );

  runnerFor(target)(
    `data-table-slot-family [${target}] (7): bare — built-in fallback where neither family nor generic exists`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableSlotFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      // status: no family fill, no generic fill on this instance — built-in render.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).leafRow?.cells['status']?.testids ?? null, {
          timeout: 5_000,
        })
        .toEqual([]);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).leafRow?.cells['status']?.text ?? null, {
          timeout: 5_000,
        })
        // First leaf row in DOM order is 'Alpha' (region 'north', the first group), whose
        // seeded status is 'active' (DataTableSlotFamilyDemo.rozie's $data.rows[0]).
        .toBe('active');

      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).header['status']?.testids ?? null, {
          timeout: 5_000,
        })
        .toEqual([]);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).header['status']?.text ?? null, {
          timeout: 5_000,
        })
        .toBe('Status');

      // status's filter cell: exactly ONE built-in input.rdt-col-filter, no fam-/gen- markers.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).filter['status']?.testids ?? null, {
          timeout: 5_000,
        })
        .toEqual([]);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).filter['status']?.builtinCount ?? -1, {
          timeout: 5_000,
        })
        .toBe(1);

      // units: not filterable — nothing at all.
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).filter['units']?.testids ?? null, {
          timeout: 5_000,
        })
        .toEqual([]);
      await expect
        .poll(async () => (await getInstanceSnapshot(page, 'bare')).filter['units']?.builtinCount ?? -1, {
          timeout: 5_000,
        })
        .toBe(0);
    },
  );
}
