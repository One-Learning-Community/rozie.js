import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module", so __dirname is
// not defined here. Synthesize it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 7 Plan 02 — the 48-cell cross-target visual-regression matrix (EX-06,
 * COMP-05).
 *
 * EXAMPLES and TARGETS are copied verbatim from
 * tests/dist-parity/parity.test.ts (lines 62-79) — the canonical 8×6 matrix.
 *
 * Angular column: 07-ANGULAR-SPIKE.md's `Decision:` line is `ANGULAR IN`, so
 * all 6 targets stay — the matrix is the full 8 × 6 = 48 cells. (If the spike
 * had decided `ANGULAR DOCUMENTED-OUT (D-03)`, `'angular'` would be filtered
 * out of TARGETS and the matrix would be 40 cells — that gate is the D-03 scope
 * branch, NOT a D-11 visual exemption.)
 *
 * Reference topology (D-10): every target's screenshot of an example diffs
 * against the SAME per-example baseline PNG (the Vue render) — the screenshot
 * name is keyed by example only (`Counter.png`), never suffixed with the
 * target. The Vue run generates/updates the baseline; the other 5 targets
 * compare against it.
 *
 * Per D-11 there are ZERO per-cell *visual* exemptions for the five targets
 * that build — every (example × target) cell is asserted with no `test.skip` /
 * `test.fixme`. The single exception is the Angular column: `build-cells.mjs`
 * soft-fails the Angular sub-build on a known out-of-scope upstream Vite-version
 * breakage (see `scripts/build-cells.mjs` SOFT_FAIL_TARGETS and
 * `docs/parity.md` "Angular — visual-regression rig host cell"). When
 * `dist/angular/` is absent the 8 Angular cells are gated with `test.fixme` so
 * the harness reports them as known-pending instead of failing the CI job with
 * 8 opaque screenshot errors. The moment the Angular sub-build succeeds and
 * produces `dist/angular/`, the gate lifts automatically and the cells run.
 * This is NOT a D-11 visual exemption — it is a build-availability gate.
 */

const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  // Phase 07.2 Plan 06 — ModalConsumer dogfood example added to the 48-cell
  // matrix (now 54 cells = 9 × 6). Linux-rendered baseline ModalConsumer.png
  // is generated via the pinned Playwright Docker image per memory
  // `feedback_vr_linux_baselines`. Per D-10, all 6 targets diff against the
  // SAME shared baseline (collapsed from per-target baselines on 2026-05-17
  // post-Phase 07.3.2.1 F-07.3.2-11-A closure once empirical byte-identity
  // across all 6 targets was verified — MD5 0d5d3108053af5b7d264affcae82b43d).
  'ModalConsumer',
  // Spike 003 portal-slot primitive (added 2026-05-18). PortalListDemo fills
  // a `<template #item>` filler that mounts through `$portals.item` into the
  // inline vanilla-JS engine's row containers. Per D-10, all 6 targets diff
  // against the same shared `PortalList.png` baseline — any per-target
  // rendering drift in the portal-mount path will fail the matcher.
  'PortalList',
  // FullCalendar (added 2026-05-19) — real-third-party-engine portal-slot
  // coverage. FullCalendarDemo fills a `<template #event>` that mounts
  // through `$portals.event` into engine-owned event cells. Per D-10, all
  // 6 targets diff against the same shared `FullCalendar.png` baseline —
  // any per-target rendering drift in the real-engine portal-mount path
  // will fail the matcher. Baseline must be Linux-rendered via the pinned
  // Playwright Docker image per `feedback_vr_linux_baselines`; cells
  // gate on baseline presence below (downgrade to fixme until the .png
  // exists). Behavioral coverage is independently guaranteed by
  // `full-calendar.spec.ts` runtime smoke (no screenshot dependency).
  'FullCalendar',
] as const;
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// Baseline-availability gate (per-example). When __screenshots__/<Name>.png
// is missing, the cells for that example downgrade to test.fixme so the
// suite stays green until a Linux-Docker baseline regen lands the PNG.
// Mirrors the Angular column build-availability gate below.
function baselineExists(name: string): boolean {
  return existsSync(resolve(__dirname, `../__screenshots__/${name}.png`));
}

// Build-availability gate for the Angular column. `build-cells.mjs` soft-fails
// the Angular sub-build on a known out-of-scope upstream breakage, so
// `dist/angular/` may not exist. When it is absent the Angular cells are
// registered with `test.fixme` (known-pending) instead of `test`, keeping the
// CI job green while still surfacing the column as unimplemented. When the
// sub-build succeeds the gate lifts and the cells run normally.
const angularBuilt = existsSync(
  resolve(__dirname, '../dist/angular/host/entry.angular.html'),
);

// Phase 07.5 closure — PORTAL_LIT_GAP removed once consumer-side function-prop
// emit landed for portal slots. PortalList · lit renders against the SAME
// shared `PortalList.png` baseline as the other 5 targets (D-10 byte-identity).


// Per-example pre-screenshot settle conditions.
//
// Plan 07.2-06.1 debug-fix follow-up. ModalConsumer renders THREE modals (per
// the Plan 07.2-06 dogfood: scoped header+footer fill, dynamic-name fill,
// re-projection via WrapperModal). Without an explicit wait, the bounding box
// for `[data-testid="rozie-mount"]` is captured before all three modals
// have laid out, producing non-deterministic screenshot heights (one regen pass
// captured 309px with 1-2 modals visible, the verify pass rendered 517px with
// all 3). The fix is to wait for all three `<div role="dialog">` panels to
// be present before clipping the screenshot. `getByRole('dialog')` pierces
// shadow DOM (Lit) and is unaffected by CSS Modules class hashing (React/Solid)
// — all 6 targets emit `role="dialog"` on the dialog panel (verified in
// tests/dist-parity/fixtures/Modal.*).
async function settleExample(
  example: string,
  page: import('@playwright/test').Page,
): Promise<void> {
  if (example === 'ModalConsumer') {
    await expect(page.getByRole('dialog')).toHaveCount(3);
  }
}

for (const example of EXAMPLES) {
  const hasBaseline = baselineExists(example);
  for (const target of TARGETS) {
    // Cell fixme-gates on EITHER:
    //  - Angular column build availability (existing)
    //  - per-example baseline PNG presence (new — for examples added before
    //    their Linux-Docker baseline regen has landed)
    const runner =
      (target === 'angular' && !angularBuilt) || !hasBaseline ? test.fixme : test;
    runner(`${example} · ${target}`, async ({ page }) => {
      await page.goto(`/?example=${example}&target=${target}`);
      const component = page.getByTestId('rozie-mount');
      await expect(component).toBeVisible();
      await settleExample(example, page);
      // Baseline keyed by example only (D-10) — all 6 targets diff against
      // the same Vue-generated `${example}.png`. The earlier ModalConsumer
      // special case (per-target baselines for the 3-modal dogfood) was
      // collapsed on 2026-05-17 after Phase 07.3.2.1 closed F-07.3.2-11-A:
      // the 6 ModalConsumer-<target>.png baselines proved byte-identical
      // (MD5 0d5d3108053af5b7d264affcae82b43d), empirically disproving the
      // earlier worry that CSS Modules class hashing (React/Solid), Lit's
      // shadow-DOM-bounded custom elements, and Angular's view-encapsulation
      // attribute selectors would force per-target rendering divergence.
      // The shared-baseline pattern now ENFORCES cross-target byte-identity:
      // any future single-target drift fails the matcher rather than being
      // hidden behind a per-target baseline.
      await expect(component).toHaveScreenshot(`${example}.png`, {
        maxDiffPixels: 2,
        animations: 'disabled',
      });
    });
  }
}
