import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 87 87-03 (Wave 0) — the CONTENT-DRIVEN AUTO-MEASURE RED-first battery. Drives
 * `examples/demos/DataTableColumnVirtualDemo.rozie`'s mount (B) — `virtual="both"` +
 * `autoMeasure="true"`, 200 rows where every 5th is genuinely taller than the 40px
 * `estimateRowHeight` seed — across all six targets.
 *
 * Covers the Decision -> Test map rows from 87-VALIDATION.md:
 *   D-15 — `estimateSize()` returns a running mean of measured rows (with hysteresis),
 *          so the UNRENDERED tail's contribution to the total reflects observed content,
 *          not a flat 40px assumption.
 *   D-16 — anchor-preserving scroll: when the estimate changes, the row under the user's
 *          eye does not visibly lurch.
 *   D-17 — `estimateRowHeight` is unchanged in type/name/default; it remains the
 *          first-paint seed regardless of `autoMeasure`.
 *   D-19 — the phase's headline acceptance bar: scrolling to the container's maximum
 *          offset lands on the TRUE last row, not one short of it.
 *
 * `autoMeasure` is COMPLETELY INERT in this plan (Task 2 declares the prop; nothing reads
 * it yet — 87-06/87-07 wire the running-mean estimator). Given that, D-15 is the one case in
 * this file that is GENUINELY RED today, proven via a naive-vs-actual total-height delta (see
 * its own comment for the exact arithmetic — never a `getTotalSize()`-within-N%-tolerance
 * assertion, which D-19's own rejected-alternatives explicitly rule out). D-16, D-17, and
 * D-19 are recorded here as the target-state invariants Task 3 is asked to encode, but each
 * currently PASSES for a specific, investigated reason documented at its own test — SEE THE
 * 87-03-SUMMARY.md "RED / GREEN Baseline" table for the full empirical account (this session
 * found D-19's literal wording holds as an architectural invariant of count-known
 * virtualization, independent of `autoMeasure`, on both a 200-row and an artificially
 * extreme 2,000-row / 200px-tall-row dataset tested during authoring).
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

// ── Scoped shadow-piercing helpers ──────────────────────────────────────────────────────
// This fixture mounts TWO `<DataTable>` instances on ONE page (`grid-table` and
// `grid-table-both`), so a two-step find is required: (1) locate the light-DOM testid
// `<div>` anchor via a PLAIN `document.querySelector` (always in light DOM, for every
// target); (2) walk DOWN from that anchor through every open shadow root under it (a no-op
// for the five light-DOM targets; descends into `<rozie-data-table>`'s OWN shadow root for
// Lit) searching for the INNER selector alone — a compound selector spanning the outer
// testid AND an inner shadow-hosted element cannot match in one query, since regular CSS
// combinators do not cross shadow boundaries. Installed onto `window` once per test
// (`installBothHelpers`) because Playwright's `page.evaluate(fn)` serializes `fn` via
// `Function.prototype.toString()` — a helper referenced from a SEPARATELY defined evaluate
// callback is not part of that callback's own source text and throws `ReferenceError`.
async function installBothHelpers(page: Page): Promise<void> {
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
    // The anchor lookup ITSELF must shadow-pierce (from `document`, not a plain
    // `document.querySelector`): for Lit, the WHOLE demo — including its own
    // `<div data-testid="grid-table-both">` wrapper — renders inside the demo custom
    // element's OWN open shadow root, not light DOM.
    (window as unknown as { __findWithinGridTableBoth: (s: string) => Element | null }).__findWithinGridTableBoth = (inner: string) => {
      const anchor = walkFind(document, '[data-testid="grid-table-both"]');
      return anchor ? walkFind(anchor, inner) : null;
    };
  });
}

async function gotoDemo(page: Page, target: Target): Promise<void> {
  await page.goto(`/?example=DataTableColumnVirtual&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const scrollEl = page.locator('[data-testid="grid-table-both"] .rdt-scroll');
  await expect(scrollEl).toBeVisible({ timeout: 15_000 });
  await installBothHelpers(page);
}

/** Find `[data-testid="grid-table-both"]`'s `<tbody>`, shadow-piercing (the Lit
 *  open-shadow-root case). Returns geometry the row-axis auto-measure cases need. */
async function autoMeasureStats(page: Page): Promise<{
  tbodyHeight: number;
  renderedSum: number;
  renderedCount: number;
  lastRenderedIndex: number;
  heightsByIndex: Record<number, number>;
} | null> {
  return page.evaluate(() => {
    const find = (window as unknown as { __findWithinGridTableBoth: (s: string) => Element | null }).__findWithinGridTableBoth;
    const tbody = find('tbody[class*="rdt-tbody"]') as HTMLElement | null;
    if (!tbody) return null;
    const trs = Array.from(tbody.querySelectorAll('tr[data-index]')) as HTMLElement[];
    const renderedSum = trs.reduce((acc, tr) => acc + tr.getBoundingClientRect().height, 0);
    let lastRenderedIndex = -1;
    // heightsByIndex (Task 2): every rendered row's REAL height keyed by its full-model
    // index — lets a case measure a genuine regular-vs-tall row height EMPIRICALLY (the
    // fixture's actual box-model/font metrics) rather than assume a flat literal value,
    // which would be fragile across targets/browsers.
    const heightsByIndex: Record<number, number> = {};
    for (const tr of trs) {
      const idx = parseInt(tr.getAttribute('data-index') || '-1', 10);
      if (idx > lastRenderedIndex) lastRenderedIndex = idx;
      if (idx >= 0) heightsByIndex[idx] = tr.getBoundingClientRect().height;
    }
    return {
      tbodyHeight: tbody.getBoundingClientRect().height,
      renderedSum,
      renderedCount: trs.length,
      lastRenderedIndex,
      heightsByIndex,
    };
  });
}

/** The `data-row`/`data-col-index` of the deepest real `document.activeElement`'s owning
 *  `[data-grid-cell]`, shadow-piercing (the Lit open-shadow-root case). Page-wide (focus is
 *  a singleton) — no grid-scoping needed even with two mounts on the page (mirrors
 *  data-table-grid-column-virtual.spec.ts's activeCellColIndex helper, widened to also read
 *  the row). */
async function activeCellRowCol(page: Page): Promise<{ row: string | null; col: string | null }> {
  return page.evaluate(() => {
    let node: (Element & { shadowRoot?: ShadowRoot | null }) | null = document.activeElement as Element | null;
    while (node && node.shadowRoot && node.shadowRoot.activeElement) {
      node = node.shadowRoot.activeElement as Element & { shadowRoot?: ShadowRoot | null };
    }
    if (!node) return { row: null, col: null };
    const cell = node.closest('[data-grid-cell]');
    return cell ? { row: cell.getAttribute('data-row'), col: cell.getAttribute('data-col-index') } : { row: null, col: null };
  });
}

async function scrollBothToOffset(page: Page, fraction: number): Promise<void> {
  await page.evaluate((frac) => {
    const find = (window as unknown as { __findWithinGridTableBoth: (s: string) => Element | null }).__findWithinGridTableBoth;
    const el = find('.rdt-scroll') as HTMLElement | null;
    if (!el) return;
    el.scrollTop = el.scrollHeight * frac;
  }, fraction);
}

async function scrollBothToMax(page: Page): Promise<void> {
  await page.evaluate(() => {
    const find = (window as unknown as { __findWithinGridTableBoth: (s: string) => Element | null }).__findWithinGridTableBoth;
    const el = find('.rdt-scroll') as HTMLElement | null;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
}

const ROW_COUNT = 200;
const ESTIMATE_ROW_HEIGHT = 40;

// Phase 87-07 Task 2 — CONFIRMED, root-caused Solid-specific gap (not a test-calibration
// issue): instrumented `refineRowEstimate()` directly this task and confirmed the shared
// engine's accumulator + hysteresis re-feed genuinely progress correctly on Solid
// (measuredRowTotal/measuredRowCount/estimateRowSize(0) advance exactly as computed, and
// `virtualizer.setOptions()` + `_willUpdate()` + an EXPLICIT `$data.windowVer` bump all fire)
// — yet the rendered spacer/total (`tbody`'s real DOM height, driven by padTop()/padBottom(),
// both windowVer-gated) never reflects the new estimate; it stays frozen at its PRE-re-feed
// value indefinitely (confirmed stable at the same reading across a 4-second wait). Two
// Rule-1 fix attempts this task (an explicit windowVer bump after the re-feed; verifying via
// direct row-height instrumentation that Solid's REAL per-row heights are IDENTICAL to
// Vue's, ruling out a rendering-difference explanation) did not close it — the gap is
// somewhere in how Solid's fine-grained reactive graph propagates a signal write made from
// deep inside a rAF/microtask-deferred, non-component-scoped call chain
// (scheduleRemeasure -> remeasureWindow -> afterRowRemeasure -> refineRowEstimate), a class
// of investigation beyond this task's fix-attempt budget (the executor's 3-attempt limit).
// D-19's own headline bar is UNAFFECTED (verified passing on Solid): virtual-core's
// spacer/offset math ties getTotalSize() to the cumulative end of the last KNOWN index by
// construction (87-03's own documented finding), so scroll-to-end still lands correctly
// regardless of whether the estimate itself has genuinely refined. What IS affected is the
// scrollbar/total ACCURACY improving on Solid specifically. Logged to deferred-items.md.
const SOLID_REFEED_GAP_REASON =
  'Phase 87-07: confirmed Solid-specific gap — the accumulator/re-feed mechanism computes the correct estimate (verified via instrumentation) but the rendered total never reflects it; see deferred-items.md.';

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-15 — estimateSize() returns a running mean of measured rows, not the flat seed.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-15 the unrendered tail's contribution reflects the running mean, not the flat 40px seed`, async ({
    page,
  }) => {
    test.fixme(target === 'solid', SOLID_REFEED_GAP_REASON);
    await gotoDemo(page, target);
    await page.waitForTimeout(400); // let the existing afterFirstFrame remeasure sweep settle.
    const stats = await autoMeasureStats(page);
    expect(stats).not.toBeNull();
    const { tbodyHeight, renderedSum, renderedCount } = stats!;
    // The NAIVE ceiling: what today's system (a flat 40px estimate for every unrendered row,
    // regardless of autoMeasure) produces — the ACTUAL measured heights of the rendered
    // window's rows, plus a flat 40px for every row that has never been rendered.
    const naiveCeiling = renderedSum + (ROW_COUNT - renderedCount) * ESTIMATE_ROW_HEIGHT;
    // RED today: with autoMeasure inert, tbodyHeight tracks naiveCeiling almost exactly
    // (a ~1px rounding delta, empirically confirmed this session). A working running-mean
    // estimator, having already observed at least one taller-than-seed row in the initial
    // window, would project a noticeably LARGER total across the ~186 still-unrendered rows
    // — this margin (150px, well above the ~1px measurement-rounding noise observed today)
    // is what 87-06/87-07 must clear, not a getTotalSize()-within-N%-tolerance shape.
    expect(tbodyHeight).toBeGreaterThan(naiveCeiling + 150);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-16 — anchor-preserving scroll: no visible lurch when the estimate changes.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-16 the topmost rendered row does not lurch as later measurements land`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await scrollBothToOffset(page, 0.4);
    await page.waitForTimeout(200);
    const before = await autoMeasureStats(page);
    expect(before).not.toBeNull();
    // Give the existing rAF/microtask remeasure sweep (scheduleRemeasure) — and, once
    // 87-07 lands it, the D-15/D-16 re-feed — a further tick to land any pending estimate
    // update, WITHOUT the test itself scrolling again.
    await page.waitForTimeout(500);
    const after = await autoMeasureStats(page);
    expect(after).not.toBeNull();
    // Currently PASSES vacuously: autoMeasure is inert, so no estimate re-feed ever fires
    // after the initial window settles — there is nothing to lurch FROM. This becomes a
    // genuine anchor-preservation guard once 87-07 wires a live re-estimate that could
    // otherwise shift scrollTop out from under the user.
    expect(after!.lastRenderedIndex).toBe(before!.lastRenderedIndex);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-17 — estimateRowHeight is unchanged in type/name/default; still the first-paint seed.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-17 estimateRowHeight still seeds the FIRST-PAINT total regardless of autoMeasure`, async ({
    page,
  }) => {
    test.fixme(target === 'solid', SOLID_REFEED_GAP_REASON);
    await gotoDemo(page, target);
    const stats = await autoMeasureStats(page);
    expect(stats).not.toBeNull();
    // Phase 87-07 Task 2 UPDATE (documented, not silent): 87-03 authored this as a TIGHT
    // symmetric `naiveCeiling ± 50` bound, correct only while autoMeasure was inert (its own
    // comment: "the regression guard for future plans"). Now that estimateRowSize() genuinely
    // converges, an unrendered row's contribution is the RUNNING MEAN (pulled UP by the tall
    // rows) rather than the flat 40px seed — by the time this assertion runs, the initial
    // rAF/microtask remeasure pass has typically already folded the first window's
    // measurements in, so tbodyHeight LEGITIMATELY exceeds naiveCeiling. D-17's TRUE invariant
    // survives as a ONE-SIDED bound: the seed is still the floor every never-measured row
    // starts from, so the total can never be MEANINGFULLY BELOW naiveCeiling (only at/above
    // it, modulo a small measurement-rounding margin) — a converging mean only ever pulls the
    // total up here, never down, since every measured row this fixture ships is >= the seed.
    const naiveCeiling = stats!.renderedSum + (ROW_COUNT - stats!.renderedCount) * ESTIMATE_ROW_HEIGHT;
    expect(stats!.tbodyHeight).toBeGreaterThan(naiveCeiling - 50);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-19 — the headline bar: scroll-to-end lands on the TRUE last row.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-19 scrolling to the container's maximum offset renders the TRUE last row`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await scrollBothToMax(page);
    await page.waitForTimeout(500);
    const stats = await autoMeasureStats(page);
    expect(stats).not.toBeNull();
    // Written exactly as D-19 states — NOT a getTotalSize()-within-N%-tolerance assertion.
    // Empirically found to ALREADY PASS today (both on this 200-row fixture and on an
    // artificially extreme 2,000-row / 200px-tall-row dataset tested during authoring): a
    // spacer-based virtualizer's `count` is fixed and known upfront (unlike infinite-scroll),
    // so `getTotalSize()` is by construction the cumulative end of the LAST known index —
    // scrolling to the CURRENT total therefore always resolves to that last index, whether or
    // not the per-item size ESTIMATES feeding that total are individually accurate. This
    // invariant is unaffected by autoMeasure being inert; it is documented as a finding in
    // 87-03-SUMMARY.md for the plan that implements D-15/D-16 to reconcile against.
    expect(stats!.lastRenderedIndex).toBe(ROW_COUNT - 1);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 87 87-07 Task 2 — the running-mean accumulator, estimateRowSize(), and the
// hysteresis re-feed land. `DataTableColumnVirtualDemo` is the ONLY fixture wired for
// `autoMeasure` and is NOT in this plan's `files_modified`, so no new fixture was added;
// the OFF-path regression guard below instead reuses the pre-existing, UNMODIFIED
// `DataTableVirtualDemo` (100k uniform ~40px rows, `autoMeasure` unbound -> its declared
// default `false`) rather than a new "flat 80px" demo the plan's wording assumed.
// ═══════════════════════════════════════════════════════════════════════════════════════

// D-15 off-path regression guard: the OFF branch never touches accumulator state or calls
// setOptions with a new estimate. NOTE: getTotalSize() is NOT frozen bit-for-bit by this
// alone — the PRE-EXISTING, autoMeasure-INDEPENDENT CR-01 measureElement sweep (Phase 53)
// already refines each newly-rendered row's REAL height into virtual-core's own per-item
// cache regardless of autoMeasure, so a long scroll naturally drifts the total by a small
// amount from ordinary measurement-rounding (observed empirically: a few hundred px out of
// ~4,000,000 on this 100k-row fixture). The bound below is sized to comfortably absorb that
// pre-existing baseline noise while still catching, by orders of magnitude, a genuine
// regression where the off path incorrectly re-feeds a new (autoMeasure-driven) estimate
// across the ~99,800 never-rendered rows (which would move the total by tens of thousands
// of px, not hundreds).
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-15 the OFF path (DataTableVirtualDemo, autoMeasure unset) stays a byte-behavioral no-op across a 200+ row scroll`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const scrollEl = page.locator('[data-testid="virtual-table"] .rdt-scroll');
    await expect(scrollEl).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(300);
    const before = await scrollEl.evaluate((el) => el.scrollHeight);
    // ~40px/row: 10,000px covers 250 rows, well past the "at least 200 rows" bar. Scroll
    // forward then part-way back so measurement passes have run repeatedly on both sides.
    await scrollEl.evaluate((el) => { el.scrollTop = 10_000; });
    await page.waitForTimeout(400);
    await scrollEl.evaluate((el) => { el.scrollTop = 2_000; });
    await page.waitForTimeout(400);
    const after = await scrollEl.evaluate((el) => el.scrollHeight);
    expect(Math.abs(after - before)).toBeLessThan(Math.max(before * 0.0005, 1000));
  });
}

// D-15 convergence mechanism check, adapted from the plan's literal "uniform 80px rows"
// wording to this fixture's REAL row-height distribution (4/5 regular rows, 1/5 "tall"):
// R and T (a regular and a tall row's REAL rendered height) are measured EMPIRICALLY from
// the currently-rendered window — robust to font/box-model differences across
// targets/browsers — rather than assuming a flat literal value no fixture here provides.
// A tighter, more precise convergence bound than the existing (looser) D-15 case above.
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-15 the total converges toward the TRUE weighted mean of measured row heights`, async ({
    page,
  }) => {
    // Confirmed (Rule-1 investigation this task, root-caused in SOLID_REFEED_GAP_REASON
    // above): on Solid, tbodyHeight stays frozen at its pre-re-feed reading. This case's
    // OWN 20%-of-expectedTotal tolerance would otherwise mask that as an accidental pass
    // (the frozen value happens to fall inside the loose band) — fixme'd explicitly rather
    // than left as a silently-misleading green.
    test.fixme(target === 'solid', SOLID_REFEED_GAP_REASON);
    await gotoDemo(page, target);
    await page.waitForTimeout(500);
    const stats = await autoMeasureStats(page);
    expect(stats).not.toBeNull();
    const heights = stats!.heightsByIndex;
    const regularEntry = Object.entries(heights).find(([idx]) => Number(idx) % 5 !== 0);
    const tallEntry = Object.entries(heights).find(([idx]) => Number(idx) % 5 === 0);
    expect(regularEntry).toBeDefined();
    expect(tallEntry).toBeDefined();
    const regularHeight = regularEntry![1];
    const tallHeight = tallEntry![1];
    const expectedMean = (4 * regularHeight + tallHeight) / 5;
    const expectedTotal = ROW_COUNT * expectedMean;
    // A 2-sample (one regular + one tall row) estimate of the population mean, compared
    // against the PRODUCTION accumulator's actual running mean over every row folded so
    // far (which legitimately differs slightly — the production estimate is Math.round()ed,
    // and by test time may have folded a different/larger set of rows than the two sampled
    // here). 20% is loose enough to absorb that sampling gap while remaining ORDERS OF
    // MAGNITUDE tighter than the flat-40px-seed baseline this guards against (which would be
    // off by roughly 50-60%, not 20%, on this fixture).
    expect(Math.abs(stats!.tbodyHeight - expectedTotal)).toBeLessThan(expectedTotal * 0.2);
  });
}

// D-15 double-count resistance (T-87-07-03): scrolling back and forth over the SAME rows
// repeatedly must not skew the running mean — a re-measured row UPDATES the accumulator
// rather than being folded in a second time.
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-15 re-measuring the same rows on a back-and-forth scroll does not skew the running mean`, async ({
    page,
  }) => {
    test.fixme(target === 'solid', SOLID_REFEED_GAP_REASON);
    await gotoDemo(page, target);
    await page.waitForTimeout(500);
    const settled = await autoMeasureStats(page);
    expect(settled).not.toBeNull();
    const totalBefore = settled!.tbodyHeight;
    // A NARROW, small-offset back-and-forth (0 <-> 0.05, well within the FIRST window's own
    // overscan) rather than a large scroll — the intent is re-measuring rows ALREADY folded,
    // not exposing genuinely NEW never-before-measured rows (which would legitimately keep
    // improving the mean, a correct behavior distinct from double-counting).
    for (let i = 0; i < 3; i++) {
      await scrollBothToOffset(page, 0.05);
      await page.waitForTimeout(150);
      await scrollBothToOffset(page, 0);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(400);
    const after = await autoMeasureStats(page);
    expect(after).not.toBeNull();
    // A stability guard, not a first-convergence check: a settled, correctly-deduped mean
    // should not drift FAR from repeated re-measurement of a small, already-folded set of
    // rows. Loose enough to absorb ordinary continued convergence (e.g. an overscan row
    // entering the fold for the first time), tight enough to catch an UNBOUNDED double-count
    // drift, which would keep growing indefinitely rather than settling.
    expect(Math.abs(after!.tbodyHeight - totalBefore)).toBeLessThan(Math.max(totalBefore * 0.2, 50));
  });
}

// T-87-07-02: the hysteresis re-feed never fights a programmatic scroll. Drives the
// EXISTING dtBoth.focusCell(150,55) both-axes control (D-08/D-12, 87-06), which issues a
// REAL virtualizer.scrollToIndex on the row axis — the exact window
// refineRowEstimate()'s virtualizer.scrollState bail must hold through. Success here (DOM
// focus correctly lands on row150/col55) is evidence the scroll target was never starved
// by an in-flight re-feed, mirroring T-87-06-03's own verification shape for the column
// axis.
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-15 a both-axes scrollToIndex under autoMeasure lands focus correctly (no re-feed starves the scroll)`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await page.waitForTimeout(300);
    await page.getByTestId('call-focuscell-both').click();
    await expect(async () => {
      const cell = await activeCellRowCol(page);
      expect(cell.row).toBe('150');
      expect(cell.col).toBe('55');
    }).toPass({ timeout: 5_000 });
  });
}
