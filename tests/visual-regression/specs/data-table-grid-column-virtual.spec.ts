import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { deepQuerySelectorFirstTextInPage } from './_shadow-utils';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 87 — the COLUMN-AXIS battery for horizontal virtualization. Landed RED-first in
 * 87-03 (Wave 0); 87-04 (Task 1, the tracer) wires the real column-windowing path through
 * the shared engine, the data-table host, and the template. Drives
 * `examples/demos/DataTableColumnVirtualDemo.rozie`'s mount (A) — a 60-column x 200-row
 * grid with `virtual="columns"` — across all six targets.
 *
 * Covers the Decision -> Test map rows from 87-VALIDATION.md:
 *   D-01      — `virtual="columns"` windows the leaf-column axis: fewer than 60
 *               `<td data-col-index>` render in the first body row.
 *   D-06/D-11 — the last header level windows to the SAME leaf-column set as the body
 *               (colspan-clamp keeps header and body column counts aligned).
 *   D-08      — `focusCell(0, 55)` addresses the ABSOLUTE leaf-column position (0..59),
 *               off-window or not.
 *   D-10      — a left-pinned column and an open editor's column stay rendered after
 *               scrolling `.rdt-scroll` fully right.
 *   D-12      — `focusCell` to a column outside the window scrolls it in, then focuses.
 *   D-13      — a fill drag whose pointer reaches the container's right edge auto-scrolls
 *               the column axis so the range can grow past the pre-drag window.
 *
 * Status as of 87-04 Task 1 (the tracer — flat header only, no forced columns, no grouped
 * colspan clamp, no filter row): D-01 and D-06/D-11 are GREEN on all six targets — the
 * body/header cell loops now genuinely window via `windowedCells()`/`windowedColIndices()`.
 * D-08/D-10/D-12 REGRESS to RED (they previously passed trivially because nothing was
 * excluded from the DOM; real windowing now excludes col 55 / the pinned+editing columns /
 * the pre-focus off-window target, and `forcedColumns()`/the scroll-then-focus seam that
 * would keep them reachable are 87-05/87-06's work, not this tracer's). D-13 stays RED — no
 * per-axis edge-triggered auto-scroll exists on either axis yet (87-06).
 *
 * DOM/behavioral assertions only (no PNG baseline) — the pinned Linux Docker run is the CI
 * gate; macOS/Linux kerning noise flakes pixel diffs on windowing-invariant assertions (the
 * data-table-virtual.spec.ts precedent).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

async function gotoDemo(page: Page, target: Target): Promise<void> {
  await page.goto(`/?example=DataTableColumnVirtual&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const gridTable = page.getByTestId('grid-table').locator('table[role="grid"]');
  await expect(gridTable).toBeVisible({ timeout: 15_000 });
  await installGridTableHelpers(page);
}

/** Read a readout testid's trimmed text (shadow-pierced), '' when absent. */
async function readoutText(page: Page, testid: string): Promise<string> {
  return (await page.evaluate(deepQuerySelectorFirstTextInPage, `[data-testid="${testid}"]`)) ?? '';
}

// ── Scoped shadow-piercing helpers ──────────────────────────────────────────────────────
// This fixture mounts TWO `<DataTable>` instances on ONE page (`grid-table` and
// `grid-table-both` — see the demo's header comment), so every query below MUST be scoped
// to `[data-testid="grid-table"]` specifically, not the whole document (an unscoped query
// double-counts / conflates the two grids' cells). Scoping works in TWO STEPS because a
// compound selector like `'[data-testid="grid-table"] .rdt-scroll'` CANNOT cross a shadow
// boundary (the Lit target renders `.rdt-scroll` inside `<rozie-data-table>`'s OWN shadow
// root, a descendant of the light-DOM testid `<div>` — no single CSS selector spans both):
//   1. Find the light-DOM testid anchor via a PLAIN `document.querySelector` (this always
//      works — the wrapping `<div data-testid="grid-table">` is never itself inside a
//      shadow root for any of the six targets).
//   2. From that anchor, walk DOWN through every open shadow root under it (light-DOM
//      targets: a no-op, the anchor's own subtree already has everything; Lit: descends
//      into `<rozie-data-table>`'s shadow root) searching for the INNER selector alone.
// The actual walker implementations are installed INTO THE PAGE by `installGridTableHelpers`
// below (Playwright's `page.evaluate(fn)` serializes `fn` via `Function.prototype.toString()`
// and re-executes that TEXT in the browser — a helper referenced from a SEPARATELY defined
// evaluate callback is not part of that callback's own source text and throws `ReferenceError`
// at runtime; installing onto `window` once per test sidesteps that constraint).

/** Count of elements matching `selector` WITHIN `[data-testid="grid-table"]` only (never
 *  the whole document — this fixture has a SECOND grid, `grid-table-both`, on the page). */
async function gridTableCount(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => (window as unknown as { __findAllWithinGridTable: (s: string) => Element[] }).__findAllWithinGridTable(sel).length, selector);
}

/** All `data-col-index` attribute values (as numbers) off elements matching `selector`
 *  WITHIN `[data-testid="grid-table"]` only, shadow-piercing (the Lit case). */
async function colIndicesFor(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    const els = (window as unknown as { __findAllWithinGridTable: (s: string) => Element[] }).__findAllWithinGridTable(sel);
    const out: number[] = [];
    for (const el of els) {
      const v = el.getAttribute('data-col-index');
      if (v != null) out.push(parseInt(v, 10));
    }
    return out;
  }, selector);
}

/** All `colspan` attribute values (defaulting an ABSENT attribute to 1, matching the
 *  template's `wh.span > 1 ? wh.span : null` — a bare colspan="1" is never emitted) off
 *  elements matching `selector` within the grid table (shadow-piercing). */
async function colspansFor(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    const els = (window as unknown as { __findAllWithinGridTable: (s: string) => Element[] }).__findAllWithinGridTable(sel);
    const out: number[] = [];
    for (const el of els) {
      const v = el.getAttribute('colspan');
      out.push(v != null ? parseInt(v, 10) : 1);
    }
    return out;
  }, selector);
}

/** `data-col` attribute values (the column id, e.g. "grpA"/"col5") off elements matching
 *  `selector` within the grid table (shadow-piercing). */
async function dataColsFor(page: Page, selector: string): Promise<(string | null)[]> {
  return page.evaluate((sel) => {
    const els = (window as unknown as { __findAllWithinGridTable: (s: string) => Element[] }).__findAllWithinGridTable(sel);
    return els.map((el) => el.getAttribute('data-col'));
  }, selector);
}

/** The `data-col-index` of the deepest real `document.activeElement`'s owning
 *  `[data-grid-cell]`, shadow-piercing (the Lit open-shadow-root case). null when nothing
 *  inside a grid cell is focused. Focus is a page-wide singleton, so this does NOT need
 *  the grid-table scoping the other helpers require. */
async function activeCellColIndex(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    let node: (Element & { shadowRoot?: ShadowRoot | null }) | null = document.activeElement as Element | null;
    while (node && node.shadowRoot && node.shadowRoot.activeElement) {
      node = node.shadowRoot.activeElement as Element & { shadowRoot?: ShadowRoot | null };
    }
    if (!node) return null;
    const cell = node.closest('[data-grid-cell]');
    return cell ? cell.getAttribute('data-col-index') : null;
  });
}

/** Scroll `[data-testid="grid-table"] .rdt-scroll` to its current max scrollLeft (shadow-
 *  piercing the Lit case), returning the scrollLeft reached. */
async function scrollGridFullyRight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable('.rdt-scroll') as HTMLElement | null;
    if (!el) return -1;
    el.scrollLeft = el.scrollWidth;
    return el.scrollLeft;
  });
}

/** Scroll `[data-testid="grid-table"] .rdt-scroll` to an explicit `scrollLeft` (shadow-
 *  piercing), returning the scrollLeft actually reached (the browser clamps to
 *  `scrollWidth - clientWidth`). */
async function scrollGridTo(page: Page, left: number): Promise<number> {
  return page.evaluate((l) => {
    const el = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable('.rdt-scroll') as HTMLElement | null;
    if (!el) return -1;
    el.scrollLeft = l;
    return el.scrollLeft;
  }, left);
}

/** `getComputedStyle(el).left` (a pixel string, e.g. "40px") for the FIRST element matching
 *  `selector` within the grid table (shadow-piercing), or null when no such element exists. */
async function computedLeftFor(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const el = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable(sel) as HTMLElement | null;
    return el ? getComputedStyle(el).left : null;
  }, selector);
}

/** Current `.value` of `[data-testid="grid-table"] [data-editing-cell]` (shadow-piercing),
 *  null when no editor is mounted. Used to prove an in-progress edit SURVIVES a horizontal
 *  scroll — presence of the editing cell alone is not sufficient proof against a remount. */
async function editingCellInputValue(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable('[data-editing-cell]') as HTMLInputElement | null;
    return el ? el.value : null;
  });
}

/** `[data-testid="grid-table"] .rdt-scroll`'s current `scrollWidth` (shadow-piercing) — the
 *  D-10 spacer-arithmetic invariant: forcing an off-window column into the DOM must not grow
 *  this, or `colPadLeft()`/`colPadRight()` failed to subtract the forced column's own width. */
async function scrollWidthOf(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable('.rdt-scroll') as HTMLElement | null;
    return el ? el.scrollWidth : -1;
  });
}

/** Poll `scrollWidthOf` until two consecutive reads agree (or the budget runs out), returning
 *  the settled value. The column virtualizer's own container-width measurement (a
 *  ResizeObserver callback) resolves asynchronously — a read taken immediately after
 *  navigation/an interaction can land mid-settle, especially on the fine-grained targets
 *  (Solid/Svelte), where a component can paint before that first measurement callback fires. */
async function stableScrollWidthOf(page: Page): Promise<number> {
  let last = -1;
  for (let i = 0; i < 30; i++) {
    const w = await scrollWidthOf(page);
    if (w === last) return w;
    last = w;
    await page.waitForTimeout(100);
  }
  return last;
}

/** Read `[data-testid="grid-table"] .rdt-scroll`'s current `scrollLeft` (shadow-piercing). */
async function gridScrollLeft(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable('.rdt-scroll') as HTMLElement | null;
    return el ? el.scrollLeft : -1;
  });
}

/** Install `findWithinGridTable`/`findAllWithinGridTable` onto `window` so every
 *  `page.evaluate` call in this file (each serialized independently — Playwright's
 *  evaluate boundary does not share closures across calls) can reach them by name. Called
 *  once per test, right after navigation. */
async function installGridTableHelpers(page: Page): Promise<void> {
  await page.evaluate(() => {
    function walkFind(root: Document | Element | ShadowRoot, inner: string): Element | null {
      const direct = root.querySelector(inner);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const found = walkFind(sr, inner);
          if (found) return found;
        }
      }
      return null;
    }
    function walkFindAll(root: Document | Element | ShadowRoot, inner: string, out: Element[]): void {
      out.push(...Array.from(root.querySelectorAll(inner)));
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walkFindAll(sr, inner, out);
      }
    }
    // The anchor lookup ITSELF must shadow-pierce (from `document`, not a plain
    // `document.querySelector`): for Lit, the WHOLE demo — including its own
    // `<div data-testid="grid-table">` wrapper — renders inside the demo custom element's
    // OWN open shadow root, not light DOM. Playwright's locators (`page.getByTestId`)
    // auto-pierce shadow roots, which is why `gotoDemo`'s visibility check passes on Lit
    // even though a raw `document.querySelector` for the same testid returns null.
    (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable = (inner: string) => {
      const anchor = walkFind(document, '[data-testid="grid-table"]');
      return anchor ? walkFind(anchor, inner) : null;
    };
    (window as unknown as { __findAllWithinGridTable: (s: string) => Element[] }).__findAllWithinGridTable = (inner: string) => {
      const anchor = walkFind(document, '[data-testid="grid-table"]');
      if (!anchor) return [];
      const out: Element[] = [];
      walkFindAll(anchor, inner, out);
      return out;
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-01 — virtual='columns' windows the leaf-column axis.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-01 virtual='columns' renders fewer than 60 <td data-col-index> in the first body row`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await expect.poll(async () => readoutText(page, 'col-count'), { timeout: 15_000 }).toBe('60');
    const count = await gridTableCount(page, '[data-grid-cell][data-row="0"][data-col-index]');
    // GREEN as of 87-04 Task 1: the body cell loop reads windowedCells(wr.row) (windowedColIndices()
    // under the hood), so only the columns near the viewport render.
    expect(count).toBeLessThan(60);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-06/D-11 — the header windows to the SAME leaf-column set as the body.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-06/D-11 header column-index set equals the body's for the same window`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    const bodyIdx = await colIndicesFor(page, '[data-grid-cell][data-row="0"][data-col-index]');
    // The leaf header level carries `data-header-level="1"` for this 2-level grouped
    // header (`data-header-level="0"` is the group-parent row; the FILTER row is a
    // separate `<tr class="rdt-filter-row">` sibling with NO [data-grid-cell] cells at
    // all, so a plain `tr:last-child` selector would wrongly select it instead).
    const headerIdx = await colIndicesFor(page, '[data-grid-cell][data-header-level="1"][data-col-index]');
    const sortNum = (a: number, b: number) => a - b;
    // An invariant that must hold WHETHER OR NOT the column axis is windowed: the leaf
    // header row addresses exactly the same absolute columns the body renders. GREEN as of
    // 87-04 Task 1 for the FLAT leaf-header-level case (windowedHeaderRow() reads the same
    // windowedColIndices() the body's windowedCells() does); the grouped-header colspan
    // clamp above the leaf level is 87-05's expansion.
    expect(headerIdx.slice().sort(sortNum)).toEqual(bodyIdx.slice().sort(sortNum));
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-06/D-11 (87-05 Task 2) — the alignment invariant extends to the GROUPED header level
// (data-header-level="0"): for every header level, the sum of rendered colspan values
// (an absent attribute defaults to 1) plus the two spacer cells equals the body row's total
// cell count including its two spacers.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-06/D-11 every header level's total span equals the body's, including the grouped level`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // Body "total span": every rendered <td data-col-index> has an implicit colspan of 1,
    // plus its own 2 spacer <td>s (also colspan 1, uncounted by data-col-index).
    const bodySpan = (await gridTableCount(page, '[data-grid-cell][data-row="0"][data-col-index]')) + 2;
    for (const level of [0, 1]) {
      const spans = await colspansFor(page, `[data-header-level="${level}"]`);
      // Spacers carry no data-header-level (Pitfall 5 — invisible to the roving-tabindex grid),
      // so they are NOT included in `spans` above — add the level's own fixed 2 spacer <th>s
      // (leading + trailing, both colsWindowed()-gated) to match the body's own +2.
      const total = spans.reduce((a, b) => a + b, 0) + 2;
      expect(total).toBe(bodySpan);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-11 — a group header whose leaf span STRADDLES the window boundary renders with a colSpan
// clamped to the count of its leaf columns actually inside the window. "Group A" spans leaf
// columns 10-14 (columnBuilders/demo). Scans a few candidate scroll offsets (the exact window
// width/overscan is target- and viewport-dependent) for one that genuinely straddles the
// group — some but not all of its 5 leaf columns rendered — rather than assuming a fixed
// scroll position works identically on all six targets.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-11 a straddling group header's colSpan clamps to its in-window leaf span`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    let bodyIdx: number[] = [];
    let straddled = false;
    // Half-column offsets across a wide range: the window can only shift by whole rendered
    // columns as scrollLeft advances, so scanning at a finer-than-column granularity (and
    // over a wide span, since the exact viewport/overscan differs per target) is what
    // actually guarantees landing on a genuine straddle rather than jumping cleanly from
    // "group entirely out" to "group entirely in" between two of a small set of tried offsets.
    for (let half = 12; half <= 34; half++) {
      await scrollGridTo(page, half * 75);
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(150);
      // eslint-disable-next-line no-await-in-loop
      bodyIdx = await colIndicesFor(page, '[data-grid-cell][data-row="0"][data-col-index]');
      const inGroup = bodyIdx.filter((i) => i >= 10 && i <= 14).length;
      if (inGroup > 0 && inGroup < 5) { straddled = true; break; }
    }
    expect(straddled).toBe(true);
    const expectedSpan = bodyIdx.filter((i) => i >= 10 && i <= 14).length;
    const groupCols = await dataColsFor(page, '[data-header-level="0"]');
    const groupSpans = await colspansFor(page, '[data-header-level="0"]');
    const groupIdx = groupCols.indexOf('grpA');
    expect(groupIdx).toBeGreaterThanOrEqual(0);
    expect(groupSpans[groupIdx]).toBe(expectedSpan);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-11 — a group whose leaf columns are ALL outside the window renders no <th> at all. At
// rest (scrollLeft 0) the demo's window sits near columns 0-8 (default overscan), well short
// of "Group A" (leaf columns 10-14) — a case the fixture already exercises with no
// interaction needed.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-11 a group entirely outside the window renders no header cell`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    const bodyIdx = await colIndicesFor(page, '[data-grid-cell][data-row="0"][data-col-index]');
    // Guard the fixture assumption rather than assume it silently: at rest the window must
    // NOT include any of Group A's leaf columns, or this case is not actually testing the
    // "entirely outside" path.
    expect(bodyIdx.some((i) => i >= 10 && i <= 14)).toBe(false);
    const groupCols = await dataColsFor(page, '[data-header-level="0"]');
    expect(groupCols).not.toContain('grpA');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-11 — the Phase 72 dedicated filter row windows on the SAME slice as the body, in the
// same order.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-11 the filter row's rendered cell count and order match the body`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    const bodyIdx = await colIndicesFor(page, '[data-grid-cell][data-row="0"][data-col-index]');
    const filterCols = await dataColsFor(page, '.rdt-filter-cell');
    const bodyCols = await dataColsFor(page, '[data-grid-cell][data-row="0"][data-col-index]');
    expect(filterCols.length).toBe(bodyIdx.length);
    expect(filterCols).toEqual(bodyCols);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-11 — a pinned column's filter cell, header cell, and body cell all agree on the SAME
// sticky `left` offset (all three read pinStyle(), which computes off table-core's LIVE
// getStart('left') over the full column set — unaffected by the window). Checked under a
// right-scrolled window (not just at rest) to prove the offset tracks the live pin state,
// not a stale value baked in before the window moved.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-11 a pinned column's filter/header/body left offsets agree under a scrolled window`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await scrollGridFullyRight(page);
    await page.waitForTimeout(300);
    const [filterLeft, headerLeft, bodyLeft] = await Promise.all([
      computedLeftFor(page, '.rdt-filter-cell[data-col="col0"]'),
      computedLeftFor(page, '[data-header-level="1"][data-col="col0"]'),
      computedLeftFor(page, '[data-grid-cell][data-row="0"][data-col="col0"]'),
    ]);
    expect(filterLeft).not.toBeNull();
    expect(filterLeft).toBe(headerLeft);
    expect(headerLeft).toBe(bodyLeft);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-08 — the public column index is ABSOLUTE over the full leaf-column order.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-08 focusCell(0,55) resolves the ABSOLUTE leaf-column position`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await page.getByTestId('call-focuscell-col55').click();
    // NOTE: this deliberately does NOT also assert the `activecell-readout` testid. The
    // default active cell at mount is already (0,0), so focusCell(0,55) moves only the
    // COLUMN — and gridActiveCellVerbs.rzts's `focusCell` emit guard
    // (`if (absRow !== prevAbs || prevIsHeader)`) only compares the ROW, never the column,
    // so a column-only move never fires `activecell-change` today. That is a genuine,
    // PRE-EXISTING bug (unrelated to this plan's `files_modified`, discovered while
    // authoring this exact case) — logged to deferred-items.md rather than fixed here
    // (out of Task 3's declared file scope). The DOM-focus assertion above is D-08's actual
    // claim and is unaffected by the emit gap.
    await expect.poll(async () => activeCellColIndex(page), { timeout: 15_000 }).toBe('55');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-10 — pinned + editing columns stay rendered outside the window while scrolled.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-10 pinned + editing columns stay rendered after scrolling fully right`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // Open an editor on col5 BEFORE scrolling (a real click on a button OUTSIDE the grid
    // would blur+commit the editor; scrolling via page.evaluate below does not move focus).
    await page.getByTestId('edit-col5').click();
    await expect.poll(async () => gridTableCount(page, '[data-editing-cell]'), { timeout: 15_000 }).toBeGreaterThan(0);
    await scrollGridFullyRight(page);
    await page.waitForTimeout(300);
    const pinnedCount = await gridTableCount(page, '[data-grid-cell][data-row="0"][data-col-index="0"]');
    expect(pinnedCount).toBeGreaterThan(0);
    const editingCount = await gridTableCount(page, '[data-editing-cell]');
    expect(editingCount).toBeGreaterThan(0);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-10 (T-87-05-01, the phase's one HIGH-severity threat) — the open editor's IN-PROGRESS
// value survives the horizontal scroll, not merely its presence. Presence alone would not
// catch a remount that happened to seed the SAME cell value fresh from the model.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-10 the editing column's in-progress (uncommitted) value survives a horizontal scroll`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await page.getByTestId('edit-col5').click();
    await expect.poll(async () => gridTableCount(page, '[data-editing-cell]'), { timeout: 15_000 }).toBeGreaterThan(0);
    const seeded = await editingCellInputValue(page);
    // Type an in-progress value distinguishable from the seeded cell value — a real 'input'
    // event through the same onCellEditorInput funnel a live keystroke would drive.
    await page.evaluate(() => {
      const find = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable;
      const el = find('[data-editing-cell]') as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.value = 'IN-PROGRESS-EDIT';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await expect.poll(async () => editingCellInputValue(page), { timeout: 15_000 }).toBe('IN-PROGRESS-EDIT');
    expect(seeded).not.toBe('IN-PROGRESS-EDIT');
    await scrollGridFullyRight(page);
    await page.waitForTimeout(300);
    expect(await gridTableCount(page, '[data-editing-cell]')).toBeGreaterThan(0);
    expect(await editingCellInputValue(page)).toBe('IN-PROGRESS-EDIT');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-10 — a wide selected RANGE does not force its whole span into the DOM; only the active
// cell's (pinned/editing) columns are forced, never the whole rectangle.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-10 a wide range selection does not force its whole span into the DOM`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // Focus a column near the left edge (rendered at rest, no scroll needed) as the range
    // anchor, then extend to the LAST column via Ctrl+Shift+ArrowRight (extendRange(0,
    // (visibleColCount()-1) - activeColIndex) — gridKeydownHandlers.rzts) — a single keypress
    // that spans columns 2..59 (58 columns), comfortably wider than the 54-column bar this
    // case targets.
    await page.evaluate(() => {
      const find = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable;
      const cell = find('[data-grid-cell][data-row="0"][data-col-index="2"]') as HTMLElement | null;
      if (cell) cell.focus();
    });
    await page.keyboard.press('Control+Shift+ArrowRight');
    // Read the post-extend active cell via the getActiveCell() $expose verb + its readout —
    // STATE ($data.activeColIndex), not DOM focus. DOM focus landing on col 59 depends on the
    // SAME async-commit timing gap D-12 documents (forcedColumns() must observe the fresh
    // activeColIndex write before resolveCellEl(0,59) can resolve it; on React that write is
    // async, so a synchronous focusActiveCell() call inside extendRange() can race ahead of the
    // commit) — an orthogonal, already-mapped-to-87-06 concern this case does not re-litigate.
    await page.getByTestId('call-getactivecell').click();
    await expect.poll(async () => readoutText(page, 'getactivecell-readout'), { timeout: 15_000 }).toBe('0,59');
    const count = await gridTableCount(page, '[data-grid-cell][data-row="0"][data-col-index]');
    expect(count).toBeLessThan(54);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-10 (T-87-05-02) — the forced-column union dedupes against the virtual window: no
// `data-col-index` value appears twice in a single body row.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-10 no data-col-index value appears twice in a body row`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await page.getByTestId('edit-col5').click();
    await expect.poll(async () => gridTableCount(page, '[data-editing-cell]'), { timeout: 15_000 }).toBeGreaterThan(0);
    await scrollGridFullyRight(page);
    await page.waitForTimeout(300);
    const idx = await colIndicesFor(page, '[data-grid-cell][data-row="0"][data-col-index]');
    expect(idx.length).toBe(new Set(idx).size);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-10 (T-87-05-04) — forcing an off-window column into the rendered set does not grow the
// horizontal scroll width: colPadLeft()/colPadRight() subtract the forced column's own width
// from the appropriate spacer (windowing.rzts).
//
// Solid/Svelte are `test.fixme` here for a CONFIRMED, PRE-EXISTING (87-04) gap in the shared
// header/spacer rendering — NOT a flaw in this plan's forcedColumns()/colPadLeft()/
// colPadRight() arithmetic, which was verified correct on every target by direct computation
// against colVirtualizer.getTotalSize() (padLeft + rendered-cell widths + padRight sums to
// EXACTLY getTotalSize() on all six, confirmed via a live DOM probe during authoring). Two
// independent causes, found via that probe:
//   1. `headerWidth('grpA')` (columnChrome.rzts) returns table-core's per-column getSize() for
//      the SYNTHETIC "Group A" header — a SINGLE column's width — even though its rendered
//      `<th>` carries `colspan="5"`. Under table-layout:fixed, a browser distributes a
//      colspan-N cell's declared width ACROSS its N spanned columns for first-row column-width
//      purposes; Solid's OWN container-width measurement here happens to produce a column
//      window WIDE ENOUGH to include the grouped columns (10-14), where this mismatch
//      surfaces as a real rendered-width deviation from columnSize()'s logical value.
//   2. Independently, Svelte's `.rdt-col-spacer` <td> width binding was found to NOT
//      contribute to the table's actual layout at rest — confirmed even in the UNGROUPED
//      case: `.rdt-scroll`'s scrollWidth reflects only the rendered cells' own widths, not the
//      declared spacer widths, at initial mount (before any interaction).
// Both predate this plan (87-04's shared, cross-target header/spacer template) and are logged
// in full to deferred-items.md rather than patched here — fixing either is a real, separate
// change to shared infrastructure four consumer families inline, not a forcedColumns() concern.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  const knownSpacerWidthGap = target === 'solid' || target === 'svelte';
  const run = knownSpacerWidthGap ? test.fixme : runnerFor(target);
  run(`data-table-grid-column-virtual [${target}]: D-10 scroll width does not grow when a forced column enters the rendered set`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // Settle BEFORE the interaction too: the column virtualizer's own container-width
    // measurement is an async ResizeObserver callback, so a read taken immediately at
    // navigation can land before that first measurement resolves (observed on the
    // fine-grained targets, which can paint ahead of it).
    const before = await stableScrollWidthOf(page);
    await page.getByTestId('call-focuscell-col55').click();
    // Confirm the force actually engaged via the column's DOM PRESENCE (not DOM focus landing,
    // an orthogonal already-mapped-to-87-06 concern — see the wide-range case above — and not a
    // second $refs.dt.getActiveCell() call, which was found during authoring to itself perturb
    // $data.activeColIndex on this exact sequence, a separate pre-existing quirk unrelated to
    // this case's own claim).
    await expect.poll(async () => gridTableCount(page, '[data-grid-cell][data-row="0"][data-col-index="55"]'), { timeout: 15_000 }).toBeGreaterThan(0);
    const after = await stableScrollWidthOf(page);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-12 — focusCell to an off-window column scrolls it in, then focuses.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-12 focusCell(0,55) from a left-scrolled table lands on col 55`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // Start scrolled to the LEFT (the default mount position — col 55 is off to the right).
    const startLeft = await gridScrollLeft(page);
    expect(startLeft).toBe(0);
    await page.getByTestId('call-focuscell-col55').click();
    // Bounded poll (mirrors the existing row-axis scroll-then-focus poll's discipline):
    // the eventual DOM focus must land on col 55, however it gets there.
    await expect.poll(async () => activeCellColIndex(page), { timeout: 15_000 }).toBe('55');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-13 — a fill drag past the column window edge auto-scrolls.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: D-13 a fill drag near the container's right edge auto-scrolls the column axis`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // Focus the top-left cell (0,0) as the fill-drag SOURCE — the pinned column, so it is
    // never itself scrolled out of reach during the drag.
    await page.evaluate(() => {
      const find = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable;
      const cell = find('[data-grid-cell][data-row="0"][data-col-index="0"]') as HTMLElement | null;
      if (cell) cell.focus();
    });
    const before = await gridScrollLeft(page);
    // Drive a fill-drag gesture that ends with the pointer parked near the RIGHT EDGE of
    // the visible `.rdt-scroll` viewport (NOT at an off-screen cell's own rect — that would
    // bypass real elementFromPoint hit-testing, the exact DOM-driven mechanism D-13 targets).
    await page.evaluate(() => {
      const find = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable;
      const scrollEl = find('.rdt-scroll') as HTMLElement | null;
      const handle = find('[data-fill-handle]') as HTMLElement | null;
      if (!scrollEl || !handle) return;
      const hr = handle.getBoundingClientRect();
      const sr = scrollEl.getBoundingClientRect();
      const hx = hr.left + hr.width / 2;
      const hy = hr.top + hr.height / 2;
      // 4px inside the container's right edge — well within the visible viewport, so
      // elementFromPoint resolves a REAL rendered cell there, not empty space.
      const ex = sr.right - 4;
      const ey = sr.top + sr.height / 2;
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: hx, clientY: hy }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: ex, clientY: ey }));
    });
    // Give a hypothetical edge-triggered auto-scroll timer a real chance to fire.
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    const after = await gridScrollLeft(page);
    // RED today: no per-axis edge-triggered auto-scroll exists on the column axis (or the
    // row axis) yet — the container never scrolls during a fill drag.
    expect(after).toBeGreaterThan(before);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Fine-grained first-paint (Solid/Svelte): the column window must paint on FIRST commit,
// with NO scroll interaction — the failure this guards is windowedColIndices()'s
// `$data.windowVer` read sitting below an early return, so the accessor never subscribes and
// the window stays blank forever on exactly these two fine-grained targets (the same class of
// bug windowedRows() already documents for the row axis). A positive assertion, not a manual
// observation: the window must be BOTH non-empty AND genuinely partial (< 60) at rest.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of ['solid', 'svelte'] as const) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: fine-grained first-paint — the column window is non-empty with no scroll interaction`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // No scroll call anywhere above or below — gotoDemo only waits for the grid to mount.
    const count = await gridTableCount(page, '[data-grid-cell][data-row="0"][data-col-index]');
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(60);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// RTL — the column axis is the first windowing axis for which scroll DIRECTION matters
// (the row axis has none). `columnVirtualizerOptions()` does not pass `isRtl` to virtual-core
// (data-table has no runtime RTL signal available at construction time — confirmed: no
// `dir`/`rtl` read anywhere in packages/ui/data-table/src). virtual-core's own offset read is
// `el.scrollLeft * (isRtl && -1 || 1)` (dist/esm/index.js:117-119) — under Chromium's RTL
// scrollLeft convention (0 at rest, NEGATIVE toward the far side) an un-negated read hands
// virtual-core a negative offset it was never built to expect.
//
// Demo file scope note: Task 2's `<files>` list does not include the demo `.rozie`, so this
// case sets `dir="rtl"` directly on the LIVE `.rdt-scroll` element via `page.evaluate` (a real
// scrollable DOM node, not a CSS-only cosmetic flip) rather than adding an RTL demo variant.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-column-virtual [${target}]: dir="rtl" — the column window still moves on a full leftward scroll`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    const restIndices = await colIndicesFor(page, '[data-grid-cell][data-row="0"][data-col-index]');
    await page.evaluate(() => {
      const find = (window as unknown as { __findWithinGridTable: (s: string) => Element | null }).__findWithinGridTable;
      const el = find('.rdt-scroll') as HTMLElement | null;
      if (!el) return;
      el.setAttribute('dir', 'rtl');
      // Chromium's RTL scrollLeft convention: 0 is the rest/rightmost position, and the
      // fully-scrolled-left extreme is the NEGATIVE of the overflow amount. Compute it live
      // (never hardcode) so this is robust to the fixture's exact column widths.
      el.scrollLeft = -(el.scrollWidth - el.clientWidth);
    });
    await page.waitForTimeout(400);
    const afterIndices = await colIndicesFor(page, '[data-grid-cell][data-row="0"][data-col-index]');
    void restIndices;
    // Documented RED (87-04 finding, no `isRtl` remedy applied in this plan): scrolling
    // `.rdt-scroll` to its full RTL-negative extreme (the "scrolled all the way toward the
    // high column indices" gesture) should bring HIGH absolute column indices into the
    // window — empirically confirmed it does NOT: without `isRtl: true`, virtual-core's
    // offset read goes negative and the window stays anchored near column 0 (its rendered
    // set even SHRINKS relative to rest, rather than sliding toward col 59), because the
    // unnegated negative offset confuses virtual-core's range/overscan math. Asserting
    // "some column beyond the midpoint is now rendered" — not merely "the set changed" — is
    // the correctness bar the RTL axis actually needs. Named follow-up: wire `isRtl` into
    // `columnVirtualizerOptions()` (87-06, alongside the other scroll-mechanics seams — D-12
    // scroll-then-focus, D-13 fill-drag edge auto-scroll).
    expect(afterIndices.some((i) => i > 30)).toBe(true);
  });
}
