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
} | null> {
  return page.evaluate(() => {
    const find = (window as unknown as { __findWithinGridTableBoth: (s: string) => Element | null }).__findWithinGridTableBoth;
    const tbody = find('tbody[class*="rdt-tbody"]') as HTMLElement | null;
    if (!tbody) return null;
    const trs = Array.from(tbody.querySelectorAll('tr[data-index]')) as HTMLElement[];
    const renderedSum = trs.reduce((acc, tr) => acc + tr.getBoundingClientRect().height, 0);
    let lastRenderedIndex = -1;
    for (const tr of trs) {
      const idx = parseInt(tr.getAttribute('data-index') || '-1', 10);
      if (idx > lastRenderedIndex) lastRenderedIndex = idx;
    }
    return {
      tbodyHeight: tbody.getBoundingClientRect().height,
      renderedSum,
      renderedCount: trs.length,
      lastRenderedIndex,
    };
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

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-15 — estimateSize() returns a running mean of measured rows, not the flat seed.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-auto-measure [${target}]: D-15 the unrendered tail's contribution reflects the running mean, not the flat 40px seed`, async ({
    page,
  }) => {
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
    await gotoDemo(page, target);
    const stats = await autoMeasureStats(page);
    expect(stats).not.toBeNull();
    // A never-rendered row's contribution to the first-paint total is STILL exactly
    // estimateRowHeight (40px) — D-17 says the prop is unchanged in type/name/default and
    // remains the explicit seed regardless of autoMeasure. Currently PASSES (D-17 is a
    // docs-only reframing, no behavior change) — the regression guard for future plans.
    const naiveCeiling = stats!.renderedSum + (ROW_COUNT - stats!.renderedCount) * ESTIMATE_ROW_HEIGHT;
    expect(Math.abs(stats!.tbodyHeight - naiveCeiling)).toBeLessThan(50);
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
