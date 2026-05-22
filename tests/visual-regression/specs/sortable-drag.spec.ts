import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * D-01 — SortableList drag-interaction regression spec (Phase 13).
 *
 * ── STATUS: SCAFFOLD (Plan 13-01, Wave 0) ────────────────────────────────────
 * This file is the SKELETON for the permanent, committed cross-target drag
 * regression gate mandated by Phase 13 decision D-01. Every test body is
 * `test.fixme` — the spec is COLLECTABLE by Playwright but does NOT yet gate.
 * Plan 13-05 un-fixmes the bodies, wires in the synthetic-drag helper, and
 * finalizes the assertions.
 *
 * ── WHAT IT WILL DO (Plan 13-05) ─────────────────────────────────────────────
 * `examples/demos/SortableListDemo.rozie` wraps `examples/SortableList.rozie`,
 * which boots a real SortableJS instance. SortableJS uses native HTML5 DnD in
 * Chromium. After Plan 13's `$classSelector` lands, the demo's drag handle is
 * `:handle="$classSelector('grip')"` — so React's CSS-Modules-hashed `.grip`
 * class resolves correctly and a drag can start on ALL six targets (closing
 * Bug 3 of the `sortablelist-drag-desync` debug session).
 *
 * The finalized spec, per target, will:
 *   1. boot the SortableList cell (`?example=SortableList&target=<t>`),
 *   2. drive a synthetic native-HTML5 reorder via `host/dragEvent.ts`
 *      (`synthesizeDrag` — see that file's SPIKE notes),
 *   3. assert the displayed `.rozie-sortable-item` label order matches the
 *      bound-state order in the demo's `<ol class="state-list">`.
 * The React cell additionally proves Bug 3 closed (the drag can start at all);
 * the Lit cell regression-guards the dual-copy bug; the React cell the
 * stale-closure bug — both already fixed in the debug session.
 *
 * ── CONVENTIONS (mirrors full-calendar.spec.ts) ──────────────────────────────
 *   - 6-target loop with the `existsSync(dist/<t>/host/entry.<t>.html)`
 *     build-availability gate + `test.fixme` fallback (so a soft-failing
 *     sub-build does not red the whole suite).
 *   - STRUCTURAL assertions only — `toHaveCount` / `toContainText`. NO
 *     `toHaveScreenshot` (per `feedback_vr_linux_baselines`: runs on macOS
 *     without Docker baseline regen).
 *   - Class locators that survive React CSS-Modules hashing — `.rozie-sortable-
 *     item` is wrapper-authored and stable cross-target (`matrix.spec.ts`
 *     already relies on it). Do NOT match `.grip` literally on React.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

/**
 * KNOWN_FAILING is empty. Retained (vs. removed) so a future regression can
 * temporarily re-fixme a single cell without altering the test-generation
 * shape — same rationale as `full-calendar.spec.ts`.
 */
const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

// SortableListDemo seeds 5 items via `$onMount(() => reset())`:
// Apple / Banana / Cherry / Date / Elderberry. `settleExample` in
// matrix.spec.ts already waits for exactly 5 `.rozie-sortable-item`.
const SEED_ITEM_COUNT = 5;

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner =
    !built || KNOWN_FAILING.has(target) ? test.fixme : test.fixme;
  // NOTE (Plan 13-05): the second `test.fixme` above is intentional for the
  // Wave 0 scaffold — EVERY body is fixme'd until Plan 13-05 finalizes the
  // synthetic-drag helper. Plan 13-05 changes it back to `test` so the
  // build-availability gate (`!built || KNOWN_FAILING`) selects fixme-vs-run
  // exactly as `full-calendar.spec.ts` does.

  runner(
    `sortable-drag [${target}]: synthetic reorder keeps bound $data in sync`,
    async ({ page }) => {
      await page.goto(`/?example=SortableList&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      // Settle: SortableListDemo seeds 5 rows. `.rozie-sortable-item` is the
      // wrapper-authored class — stable across all six targets (it survives
      // React's CSS-Modules hashing because the wrapper authors it directly).
      const items = mount.locator('.rozie-sortable-item');
      await expect(items).toHaveCount(SEED_ITEM_COUNT);

      // ── Plan 13-05 finalizes from here ──────────────────────────────────
      // 1. Capture the pre-drag label order.
      // 2. Drive a synthetic native-HTML5 reorder via `synthesizeDrag` from
      //    `../host/dragEvent.ts` — e.g. drag row 1 onto row 3.
      // 3. Assert the displayed `.rozie-sortable-item` order matches the
      //    bound-state order in the demo's `<ol class="state-list">` (which
      //    renders `$data.items`). React additionally proves the drag can
      //    START at all — `$classSelector('grip')` makes SortableJS's handle
      //    selector resolve against React's hashed DOM.
      //
      // Until Plan 13-05 wires the synthetic-drag helper and locks its event
      // set (Open Question 1 spike), this body stays fixme'd — the assertion
      // below is a placeholder marker, never reached while the test is fixme.
      expect(SEED_ITEM_COUNT).toBe(5);
    },
  );
}
