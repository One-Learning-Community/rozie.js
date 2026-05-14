import { test, expect } from '@playwright/test';

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
 * Per D-11 there are ZERO per-cell visual exemptions — every (example × target)
 * cell is asserted with no `test.skip` / `test.fixme`. An exemption is only ever
 * added later through the D-06 batch-review gate in Plan 07-05.
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
] as const;
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const example of EXAMPLES) {
  for (const target of TARGETS) {
    test(`${example} · ${target}`, async ({ page }) => {
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
