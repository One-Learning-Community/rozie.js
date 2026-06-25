import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/date-picker RANGE-mode behavioral spec — the NON-SNAPSHOT proof
 * (B-1 / T-62-08, snapshot-tests-cement-bugs).
 *
 * `examples/demos/DatePickerRangeBehaviorDemo.rozie` consumes the
 * `packages/ui/date-picker/src/DatePicker.rozie` family in `selectionMode="range"`,
 * seeded with a COMPLETED June-2025 range so the inner DatePicker pins its view to
 * June 2025 (viewAnchor() falls back to the range's `start` month). That makes the
 * day cells addressable by their stable `[data-day="2025-06-NN"]` ISO attribute
 * (every day <button> carries it). Re-clicking any June day re-anchors within June,
 * so this spec drives anchor / forward-preview / backward-preview / completed /
 * reverse-order / preset states without ever leaving the June grid.
 *
 * WHY BEHAVIORAL-ONLY (no toHaveScreenshot): a static PNG cannot prove that the
 * BACKWARD-preview band is present *because of* a backward hover (SC-3 "never
 * suppressed") — a hover-dependent pixel is also non-deterministic. This spec
 * asserts the DOM classes the range model stamps (`.is-in-preview`,
 * `.is-range-start`/`.is-range-end`/`.is-in-range`, preset `.is-active` /
 * `aria-pressed`), which is the actual proof. Per feedback_vr_linux_baselines a
 * structural-only spec runs locally without any Docker baseline.
 *
 * SELECTOR STABILITY ACROSS ALL SIX TARGETS: the range/preset state classes are
 * emitted via the conditional `:class="{ … }"` object (React `clsx`, Vue array,
 * Angular ngClass, Solid rozieClass, Svelte, Lit Object.entries) — they stay
 * LITERAL in the DOM (only the scoped-style hash `data-rozie-s-*` is rewritten, the
 * authored `is-*` tokens are not). `[data-day]` is a literal attribute. Playwright
 * css locators pierce the Lit shadow boundary by default, so `mount.locator(...)`
 * reaches the shadowed grid on Lit too.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// The seeded June-2025 view month (DatePickerRangeBehaviorDemo). All driven ISOs
// live in this month so they render in-grid and carry the range classes.
const day = (n: number) => `2025-06-${String(n).padStart(2, '0')}`;

for (const target of TARGETS) {
  // Build-availability gate (the leaflet-map.spec.ts precedent): when the
  // per-target VR sub-build did not produce `dist/<target>/`, register the cell
  // with test.fixme rather than erroring.
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = built ? test : test.fixme;

  runner(`date-picker-range-behavior [${target}]: preview + endpoints + preset`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerRangeBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // The June 2025 grid renders (the seeded range pins the view). Day cells are
    // addressable by [data-day]; the 15th of June must be present.
    const anchorCell = mount.locator(`[data-day="${day(12)}"]`);
    await expect(anchorCell).toBeVisible({ timeout: 10_000 });

    const cell = (n: number) => mount.locator(`[data-day="${day(n)}"]`);
    // Range-state class probes (count-based — robust to multi-class cells).
    const previewBand = mount.locator('.is-in-preview');
    const rangeStartCells = mount.locator('.is-range-start');
    const rangeEndCells = mount.locator('.is-range-end');
    const inRangeCells = mount.locator('.is-in-range');

    // The demo seeds a COMPLETE June range ({ start: Jun10, end: Jun15 }), so the
    // first click on any day RE-ANCHORS (commitRange restarts when the prior range
    // is complete). NOTE: a second click on the SAME anchor would COMPLETE a
    // zero-width range — so each preview phase below first lands a COMPLETE range,
    // then re-anchors with a single fresh click, then hovers (the hover never
    // commits; only a click does).

    // ---------------------------------------------------------------------
    // FORWARD PREVIEW. With the seeded range complete, click the anchor (Jun 12)
    // → re-anchors to { start: Jun12, end: '' }. Hover a LATER day (Jun 16): the
    // cells between (inclusive) light .is-in-preview, the anchor carries
    // .is-range-start.
    // ---------------------------------------------------------------------
    await cell(12).click();
    // After re-anchoring the model is { start: Jun12, end: '' } → anchor only.
    await expect(cell(12)).toHaveClass(/is-range-start/, { timeout: 10_000 });
    await cell(16).hover();
    // Jun 12..16 inclusive = 5 preview cells (anchor + interior + hovered).
    await expect(previewBand).toHaveCount(5, { timeout: 10_000 });
    // The anchor stays the range-start during preview.
    await expect(cell(12)).toHaveClass(/is-range-start/);
    // The interior days carry the preview band.
    await expect(cell(14)).toHaveClass(/is-in-preview/);
    // Complete the forward range so the next phase starts from a COMPLETE state
    // (a fresh single click then re-anchors cleanly rather than completing a
    // zero-width range on the open anchor).
    await cell(16).click();
    await expect(previewBand).toHaveCount(0, { timeout: 10_000 });

    // ---------------------------------------------------------------------
    // BACKWARD PREVIEW — the proof a static PNG cannot give (SC-3 "never
    // suppressed"). The range is now complete → click a FRESH anchor (Jun 12)
    // re-anchors to { start: Jun12, end: '' }; then hover an EARLIER day (Jun 8).
    // The band between Jun 8 and Jun 12 MUST be present and non-empty
    // (direction-agnostic preview).
    // ---------------------------------------------------------------------
    await cell(12).click();
    await expect(cell(12)).toHaveClass(/is-range-start/, { timeout: 10_000 });
    await cell(8).hover();
    // Jun 8..12 inclusive = 5 preview cells — explicitly assert the backward
    // band count > 0 (never suppressed) and the exact inclusive span.
    const backwardCount = await previewBand.count();
    expect(
      backwardCount,
      `backward preview band must be present (Jun 8..12), got ${backwardCount}`,
    ).toBeGreaterThan(0);
    await expect(previewBand).toHaveCount(5);
    await expect(cell(10)).toHaveClass(/is-in-preview/);
    // Complete the backward range (click Jun 8) so the next phase again starts
    // from a COMPLETE state and a fresh single click re-anchors cleanly.
    await cell(8).click();
    await expect(previewBand).toHaveCount(0, { timeout: 10_000 });

    // ---------------------------------------------------------------------
    // COMPLETED range, FORWARD click order (Jun 10 then Jun 14): the lower
    // endpoint is range-start, the higher is range-end, the interior is
    // in-range. The prior range is complete, so the first click re-anchors at
    // Jun 10; the second click completes + emits rangeComplete.
    // ---------------------------------------------------------------------
    await cell(10).click(); // re-anchor at Jun 10
    await cell(14).click(); // complete → { start: Jun10, end: Jun14 }
    await expect(cell(10)).toHaveClass(/is-range-start/, { timeout: 10_000 });
    await expect(cell(14)).toHaveClass(/is-range-end/);
    await expect(cell(12)).toHaveClass(/is-in-range/);
    // No leftover preview band once the range completes.
    await expect(previewBand).toHaveCount(0);
    // rangeComplete fired (the demo readout records start…end).
    await expect(page.getByTestId('readout-complete')).toHaveText(
      `${day(10)}…${day(14)}`,
      { timeout: 10_000 },
    );

    // ---------------------------------------------------------------------
    // DIRECTION-AGNOSTIC: drive the REVERSE click order (Jun 14 then Jun 10)
    // and assert the SAME endpoint classes — the lower day is still
    // range-start, the higher still range-end (min/max ordering at commit,
    // SC-3 at the DOM level).
    // ---------------------------------------------------------------------
    await cell(14).click(); // re-anchor at Jun 14
    await cell(10).click(); // complete with the earlier day second
    await expect(cell(10)).toHaveClass(/is-range-start/, { timeout: 10_000 });
    await expect(cell(14)).toHaveClass(/is-range-end/);
    await expect(cell(12)).toHaveClass(/is-in-range/);
    // Exactly one range-start and one range-end regardless of click direction.
    await expect(rangeStartCells).toHaveCount(1);
    await expect(rangeEndCells).toHaveCount(1);
    expect(await inRangeCells.count()).toBeGreaterThan(0);

    // ---------------------------------------------------------------------
    // PRESET-ACTIVE (SC-4). Click the preset button → it reads aria-pressed /
    // is-active and its (Jun 05..20) range renders matching range-start /
    // range-end in the visible grid.
    // ---------------------------------------------------------------------
    const presetBtn = mount.locator('.rozie-datepicker-preset').first();
    await expect(presetBtn).toBeVisible({ timeout: 10_000 });
    await presetBtn.click();
    await expect(presetBtn).toHaveClass(/is-active/, { timeout: 10_000 });
    await expect(presetBtn).toHaveAttribute('aria-pressed', 'true');
    // The applied preset { start: Jun05, end: Jun20 } lights the endpoints.
    await expect(cell(5)).toHaveClass(/is-range-start/);
    await expect(cell(20)).toHaveClass(/is-range-end/);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
}
