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
  // `feedback_vr_linux_baselines` (the matrix baseline is the Vue render at
  // /?example=ModalConsumer&target=vue; the other 5 targets diff against it).
  'ModalConsumer',
] as const;
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// Build-availability gate for the Angular column. `build-cells.mjs` soft-fails
// the Angular sub-build on a known out-of-scope upstream breakage, so
// `dist/angular/` may not exist. When it is absent the Angular cells are
// registered with `test.fixme` (known-pending) instead of `test`, keeping the
// CI job green while still surfacing the column as unimplemented. When the
// sub-build succeeds the gate lifts and the cells run normally.
const angularBuilt = existsSync(
  resolve(__dirname, '../dist/angular/host/entry.angular.html'),
);

for (const example of EXAMPLES) {
  for (const target of TARGETS) {
    const runner =
      target === 'angular' && !angularBuilt ? test.fixme : test;
    runner(`${example} · ${target}`, async ({ page }) => {
      await page.goto(`/?example=${example}&target=${target}`);
      const component = page.getByTestId('rozie-mount');
      await expect(component).toBeVisible();
      // Baseline keyed by example only (D-10) — all 6 targets diff against the
      // same Vue-generated `${example}.png`.
      await expect(component).toHaveScreenshot(`${example}.png`, {
        maxDiffPixels: 2,
        animations: 'disabled',
      });
    });
  }
}
