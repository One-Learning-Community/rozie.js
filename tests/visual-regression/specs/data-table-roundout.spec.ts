import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 50 LOCKED GATE — the TanStack round-out (expandable rows + grouping/aggregation
 * + faceted filtering) DOM/behavioral matrix. Screenshot-free, mirrors
 * data-table-grid.spec.ts (Phase 49) and data-table-virtual.spec.ts (Phase 53): the
 * TARGETS ×6 matrix, the `runnerFor` build-gate (an unbuilt target leg surfaces as a
 * build-gated `test.fixme` placeholder — KNOWN_FAILING stays EMPTY, NO permanent fixme),
 * and the `getRootNode().activeElement` Lit-shadow active-element read.
 *
 * Drives three behavioral demo fixtures (the host appends the 'Demo' suffix):
 *   - ?example=DataTableExpand → examples/demos/DataTableExpandDemo.rozie  (reqs 1-3)
 *   - ?example=DataTableGroup  → examples/demos/DataTableGroupDemo.rozie   (reqs 4-7)
 *   - ?example=DataTableFacet  → examples/demos/DataTableFacetDemo.rozie   (reqs 8-9)
 *
 * WAVE-0 STATUS (Plan 50-01): the expandable/groupable/faceted/getSubRows/aggregationFn
 * props, the #detail/#groupBar/#filter slots, the expanded/grouping model slices, the
 * *-change events, and the new $expose verbs the assertions below exercise DO NOT EXIST in
 * DataTable.rozie/Column.rozie until Plans 50-02..04 land. Today the fixtures render the
 * read-only flat table on all six (the new surface passes through inert). These assertions
 * are written NOW as REAL behavioral checks (interface-first) and run as soon as each leaf
 * builds; each later wave (50-02 expand, 50-03 group, 50-04 facet) turns its block green per
 * target. No `describe.skip`, no permanent `test.fixme` beyond the runnerFor build-gate
 * placeholder.
 *
 *   reqs 1-3 — EXPAND (DataTableExpand): the expander toggles a row on click / Enter /
 *     Space (aria-expanded flips); TWO rows open at once; the #detail panel renders custom
 *     content under the expanded row; getSubRows renders depth-indented child rows that
 *     themselves expand; the toggleRowExpanded/expandAll/collapseAll/getExpandedRows
 *     $expose verbs drive/read the expanded set; expanded-change fires once per change.
 *   reqs 4-7 — GROUP+AGG (DataTableGroup): grouping by two columns produces nested
 *     collapsible group-header rows with counts; collapsing a parent hides its subtree;
 *     aggregationFn='sum' shows the correct group total; the custom range aggregationFn
 *     shows its value; binding/mutating the grouping model regroups; the #groupBar slot
 *     receives the grouping state + groupable columns + apply/clear helpers and a
 *     consumer-built bar drives grouping; NO built-in [draggable] / drag handle renders;
 *     applyGrouping/clearGrouping + grouping-change carry the ordered key list.
 *   reqs 8-9 — FACET (DataTableFacet): the exposed unique-value list matches the data's
 *     distinct values; the exposed min/max equals the data's range; a consumer-built
 *     category checkbox list + numeric range slider built PURELY from the exposed
 *     values/slot props filter the table; the getFacetedUniqueValues/getFacetedMinMaxValues
 *     verbs read the facet data; NO built-in facet control renders.
 *
 * PER-TARGET activeElement READ (mirrors data-table-grid.spec.ts): any focus / keyboard
 * check reads the focused element through Lit's shadow root uniformly via
 * `root.getRootNode().activeElement` — in the 5 light-DOM targets getRootNode() is
 * `document`; inside Lit's open shadow root it is the shadow root whose activeElement is the
 * focused inner control (NOT what the host document.activeElement would return).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// KNOWN_FAILING stays EMPTY (the P49/P53 precedent). An un-built target leg surfaces as a
// build-gated `runnerFor` placeholder, NOT a permanent fixme. Each round-out wave (50-02..04)
// turns its block into a real passing assertion per target as the surface lands.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

/**
 * Read aria-expanded off the focused element through Lit's shadow root uniformly. Used by
 * the keyboard-activation checks (Enter/Space on the focused expander). Returns null when
 * nothing is focused or the focused element carries no aria-expanded.
 */
async function focusedAriaExpanded(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    // Walk to the DEEPEST focused element across nested OPEN shadow roots. The 5 light-DOM
    // targets keep the focused control directly under `document.activeElement`; Lit double-nests
    // it (demo host → DataTable host → the expander <button>), and `document.activeElement` only
    // ever returns the OUTERMOST shadow host. Descend `activeElement → shadowRoot.activeElement`
    // until a leaf so the read pierces Lit's shadow uniformly — the same recursive-descent the
    // passing data-table-grid.spec.ts uses to reach the focused grid cell.
    let active: Element | null = document.activeElement;
    while (
      active &&
      (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot &&
      (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot!.activeElement
    ) {
      active = (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot!.activeElement;
    }
    if (!active) return null;
    const exp = active.closest('[aria-expanded]');
    return exp ? exp.getAttribute('aria-expanded') : null;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// EXPAND (reqs 1-3) — DataTableExpandDemo: #detail slot + getSubRows nested rows.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-roundout expand [${target}]: expander toggle (click/Enter/Space); multi-expand; #detail panel; getSubRows depth; expose verbs; expanded-change`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableExpand&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const detailTable = mount.getByTestId('detail-table');
    const subrowTable = mount.getByTestId('subrow-table');
    const detailTbl = detailTable.locator('table');
    await expect(detailTbl).toBeVisible({ timeout: 15_000 });
    await expect(subrowTable.locator('table')).toBeVisible({ timeout: 15_000 });

    const changeCount = page.getByTestId('expanded-change-count');
    const expandedReadout = page.getByTestId('expanded-readout');

    // ── REQ-1 — the auto-injected expander column toggles a row on CLICK; aria-expanded flips.
    const expander0 = detailTable.locator('[data-expander]').first();
    await expect(expander0).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => expander0.getAttribute('aria-expanded'), { timeout: 10_000 })
      .toBe('false');
    await expander0.click();
    await expect
      .poll(async () => expander0.getAttribute('aria-expanded'), { timeout: 10_000 })
      .toBe('true');

    // ── REQ-2 (pattern a) — the #detail scoped slot renders custom panel content under the
    //    expanded row, receiving { row } (the React render-prop edge).
    await expect(detailTable.getByTestId('detail-panel').first()).toBeVisible({ timeout: 10_000 });
    await expect(detailTable.getByTestId('detail-panel').first()).toContainText('Alpha');

    // ── REQ-1 — MULTI-EXPAND: a SECOND row opens while the first stays open.
    const expander1 = detailTable.locator('[data-expander]').nth(1);
    await expander1.click();
    await expect
      .poll(async () => detailTable.getByTestId('detail-panel').count(), { timeout: 10_000 })
      .toBe(2);
    await expect
      .poll(async () => expander0.getAttribute('aria-expanded'), { timeout: 10_000 })
      .toBe('true');

    // ── REQ-3 — expanded-change fired once per toggle (two toggles → count >= 2; React
    //    multi-emit dedup means EXACTLY one emit per change, never more).
    await expect
      .poll(async () => Number(await changeCount.textContent()), { timeout: 10_000 })
      .toBe(2);

    // ── REQ-1 — keyboard activation: Enter on a focused expander toggles it; Space too.
    //    Collapse row 0 first via the handle, then re-open it with the keyboard.
    await page.getByTestId('call-collapse-all').click();
    await expect
      .poll(async () => detailTable.getByTestId('detail-panel').count(), { timeout: 10_000 })
      .toBe(0);
    await expander0.focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => focusedAriaExpanded(page), { timeout: 10_000 })
      .toBe('true');
    await page.keyboard.press('Space');
    await expect
      .poll(async () => focusedAriaExpanded(page), { timeout: 10_000 })
      .toBe('false');

    // ── REQ-3 — $expose verbs: expandAll opens every top-level row; getExpandedRows reads
    //    the count; toggleRowExpanded(2) targets a specific row.
    await page.getByTestId('call-expand-all').click();
    await expect
      .poll(async () => detailTable.getByTestId('detail-panel').count(), { timeout: 10_000 })
      .toBe(4);
    await page.getByTestId('call-get-expanded').click();
    await expect
      .poll(async () => page.getByTestId('expanded-rows-readout').textContent(), { timeout: 10_000 })
      .toBe('4');
    await page.getByTestId('call-collapse-all').click();
    await expect
      .poll(async () => detailTable.getByTestId('detail-panel').count(), { timeout: 10_000 })
      .toBe(0);
    await page.getByTestId('call-toggle-row').click(); // toggleRowExpanded(2) → row id 2 (Beta)
    await expect
      .poll(async () => detailTable.getByTestId('detail-panel').count(), { timeout: 10_000 })
      .toBe(1);
    await expect
      .poll(async () => detailTable.getByTestId('detail-panel').first().textContent(), { timeout: 10_000 })
      .toContain('Beta');
    // The expanded-change readout reflects the toggled key set.
    await expect
      .poll(async () => expandedReadout.textContent(), { timeout: 10_000 })
      .not.toBe('');

    // ── REQ-2 (pattern b) — getSubRows: expanding a parent reveals depth-indented child
    //    rows (data-depth="1") that themselves render the same columns.
    const subExpander0 = subrowTable.locator('[data-expander]').first();
    await expect(subExpander0).toBeVisible({ timeout: 10_000 });
    await subExpander0.click();
    await expect
      .poll(async () => subrowTable.locator('[data-depth="1"]').count(), { timeout: 10_000 })
      .toBeGreaterThan(0);
    // The first child row renders the same columns (its Name cell content present).
    await expect(
      subrowTable.locator('[data-depth="1"]').first(),
    ).toContainText('Frontend');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// GROUP + AGGREGATION (reqs 4-7) — DataTableGroupDemo: nested grouping, aggregation,
// headless #groupBar (no drag), grouping API + event.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-roundout group [${target}]: nested group-header rows; collapse subtree; aggregationFn sum + custom; #groupBar (no drag); applyGrouping/clearGrouping + grouping-change`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGroup&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const groupTable = mount.getByTestId('group-table');
    await expect(groupTable.locator('table')).toBeVisible({ timeout: 15_000 });

    const groupingReadout = page.getByTestId('grouping-readout');
    const changeCount = page.getByTestId('grouping-change-count');

    // ── REQ-6 — the headless #groupBar slot receives the grouping state + groupable columns
    //    + apply/clear helpers; the component renders NO built-in drag affordance.
    const groupBar = groupTable.getByTestId('group-bar');
    await expect(groupBar).toBeVisible({ timeout: 10_000 });
    // groupable columns count exposed to the consumer bar (region/category at minimum).
    await expect
      .poll(async () => Number(await groupTable.getByTestId('group-bar-columns').textContent()), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);
    // NO built-in drag affordance: nothing inside the group table is [draggable="true"] nor a
    // .rdt-group-drag-handle (the component is headless per req-6).
    await expect(groupTable.locator('[draggable="true"]')).toHaveCount(0);
    await expect(groupTable.locator('.rdt-group-drag-handle')).toHaveCount(0);

    // ── REQ-4 / REQ-6 — the consumer-built bar drives grouping: clicking "apply" groups by
    //    region → category, producing nested group-header rows.
    await groupTable.getByTestId('group-bar-apply').click();
    await expect
      .poll(async () => groupTable.locator('[data-group-header]').count(), { timeout: 10_000 })
      .toBeGreaterThan(0);
    // The #groupBar slot reflects the live grouping state.
    await expect
      .poll(async () => groupTable.getByTestId('group-bar-state').textContent(), { timeout: 10_000 })
      .toBe('region,category');

    // ── REQ-7 — grouping-change fired with the ordered key list.
    await expect
      .poll(async () => groupingReadout.textContent(), { timeout: 10_000 })
      .toBe('region,category');
    await expect
      .poll(async () => Number(await changeCount.textContent()), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);

    // ── REQ-5 — aggregation: the built-in aggregationFn='sum' shows the correct group total
    //    in the group-header (North total units 8+2=10; the first region header rolls up its
    //    leaves). The custom range aggregationFn (max-min) shows its computed value. We assert
    //    a known sum is present in some group-header aggregate cell.
    const aggCells = groupTable.locator('[data-agg-cell]');
    await expect
      .poll(async () => aggCells.count(), { timeout: 10_000 })
      .toBeGreaterThan(0);
    // North/Hardware units sum = 3+5 = 8 — present in an aggregate cell once nested.
    await expect
      .poll(
        async () => {
          const texts = await aggCells.allTextContents();
          return texts.some((t) => t.includes('8'));
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    // The custom range fn (North/Hardware score range 41..67 = 26) is present.
    await expect
      .poll(
        async () => {
          const texts = await aggCells.allTextContents();
          return texts.some((t) => t.includes('26'));
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    // ── REQ-4 — collapsing a parent group-header hides its subtree (the leaf data rows
    //    disappear from the DOM / their visible count drops).
    const firstGroupHeader = groupTable.locator('[data-group-header]').first();
    const leafCountBefore = await groupTable.locator('[data-group-leaf]').count();
    await firstGroupHeader.locator('[data-expander]').first().click();
    await expect
      .poll(async () => groupTable.locator('[data-group-leaf]').count(), { timeout: 10_000 })
      .toBeLessThan(leafCountBefore);

    // ── REQ-7 — clearGrouping via the handle returns to the ungrouped (flat) table; the
    //    group-header rows disappear and grouping-change carries the empty list.
    await page.getByTestId('call-clear-grouping').click();
    await expect
      .poll(async () => groupTable.locator('[data-group-header]').count(), { timeout: 10_000 })
      .toBe(0);
    await expect
      .poll(async () => groupingReadout.textContent(), { timeout: 10_000 })
      .toBe('');

    // ── REQ-7 — applyGrouping via the handle re-groups (the API twin of the consumer bar).
    await page.getByTestId('call-apply-grouping').click();
    await expect
      .poll(async () => groupTable.locator('[data-group-header]').count(), { timeout: 10_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => groupingReadout.textContent(), { timeout: 10_000 })
      .toBe('region,category');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// FACET (reqs 8-9) — DataTableFacetDemo: headless faceted exposure, consumer-built
// category checkbox facet + numeric range slider.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-roundout facet [${target}]: exposed unique values match distinct data; min/max equals range; consumer-built checkbox + range filter; no built-in facet control`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableFacet&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const facetTable = mount.getByTestId('facet-table');
    await expect(facetTable.locator('table')).toBeVisible({ timeout: 15_000 });

    // ── REQ-9 — NO built-in facet control: the component itself ships no dropdown/range; the
    //    only facet UI is the consumer-built #filter slot content (category-facet checkboxes +
    //    price-facet range). Assert the consumer-built facets are present (the slot received
    //    the exposed values).
    const categoryFacet = facetTable.getByTestId('category-facet');
    const priceFacet = facetTable.getByTestId('price-facet');
    await expect(categoryFacet).toBeVisible({ timeout: 10_000 });
    await expect(priceFacet).toBeVisible({ timeout: 10_000 });
    // No component-shipped facet control class renders.
    await expect(facetTable.locator('.rdt-builtin-facet')).toHaveCount(0);

    // ── REQ-8 — the exposed unique-value list matches the data's DISTINCT category values
    //    (Hardware, Software, Service → 3 checkboxes built purely from uniqueValues).
    await expect
      .poll(async () => categoryFacet.locator('input[type="checkbox"]').count(), { timeout: 10_000 })
      .toBe(3);
    await expect(categoryFacet.getByTestId('facet-cat-Hardware')).toHaveCount(1);
    await expect(categoryFacet.getByTestId('facet-cat-Software')).toHaveCount(1);
    await expect(categoryFacet.getByTestId('facet-cat-Service')).toHaveCount(1);

    // ── REQ-8 — the exposed min/max equals the data's range (price 10..90), reflected in the
    //    consumer range slider's min/max attributes built purely from minMax.
    const range = priceFacet.getByTestId('facet-price-range');
    await expect(range).toHaveAttribute('min', '10');
    await expect(range).toHaveAttribute('max', '90');

    // ── REQ-8 — the $expose verbs read the same facet data back through the handle.
    await page.getByTestId('call-get-unique').click();
    await expect
      .poll(async () => page.getByTestId('unique-count-readout').textContent(), { timeout: 10_000 })
      .toBe('3');
    await page.getByTestId('call-get-minmax').click();
    await expect
      .poll(async () => page.getByTestId('minmax-readout').textContent(), { timeout: 10_000 })
      .toBe('10,90');

    // ── REQ-9 — the consumer-built CATEGORY checkbox facet FILTERS the table: checking only
    //    "Hardware" narrows the visible body rows to the Hardware rows (2 of 5).
    const bodyRows = facetTable.locator('tbody tr');
    const totalRows = await bodyRows.count();
    await categoryFacet.getByTestId('facet-cat-Hardware').check();
    await expect
      .poll(async () => bodyRows.count(), { timeout: 10_000 })
      .toBeLessThan(totalRows);
    await expect
      .poll(async () => bodyRows.count(), { timeout: 10_000 })
      .toBe(2);
    // Un-check restores the full set.
    await categoryFacet.getByTestId('facet-cat-Hardware').uncheck();
    await expect
      .poll(async () => bodyRows.count(), { timeout: 10_000 })
      .toBe(totalRows);

    // ── REQ-9 — the consumer-built numeric RANGE slider FILTERS the table: dragging the max
    //    down to 50 drops the rows priced above 50 (Beta=90, Epsilon=70 → 3 of 5 remain).
    await range.fill('50');
    await expect
      .poll(async () => page.getByTestId('facet-price-value').textContent(), { timeout: 10_000 })
      .toBe('50');
    await expect
      .poll(async () => bodyRows.count(), { timeout: 10_000 })
      .toBe(3);
  });
}
