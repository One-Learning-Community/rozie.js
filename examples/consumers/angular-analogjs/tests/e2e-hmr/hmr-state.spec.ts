// Phase 7 Plan 07-04 Task 3 (QA-04) — HMR state-preservation: Angular.
//
// The QA-04 contract: editing a `<style>` value in a `.rozie` source on disk
// while the Vite dev server runs triggers a hot update (NOT a full reload), the
// new style is applied, AND the component's mutated state survives.
//
// ANGULAR HOST-BUILD CAVEAT — TEST IS .skip:
// 07-ANGULAR-SPIKE.md Decision is `ANGULAR IN`, but D7-OOS-01 (deferred-items.md,
// logged by Plan 07-02) documents that on the macOS host
// `@analogjs/vite-plugin-angular@2.4.10` imports a Vite-7+ export while the
// workspace resolves Vite 6 — so the angular-analogjs DEV server cannot start on
// host. The visual-regression rig works around this only because it runs inside
// the pinned Playwright container, where a coherent install resolves and the
// dev server runs.
//
// This HMR spec is authored in full (so it is ready the moment the host
// toolchain mismatch is fixed) but marked `.skip` with this comment referencing
// the documented Angular build limitation. The angular HMR spec cannot run
// until D7-OOS-01 is resolved by the Angular leg (07-05). The
// playwright.hmr.config.ts is committed and ready alongside it.
import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// angular-analogjs imports its own local copy: src/Counter.rozie.
const ROZIE_FILE = fileURLToPath(
  new URL('../../src/Counter.rozie', import.meta.url),
);

test.skip('HMR preserves Counter state across a <style> edit (QA-04) — SKIPPED: D7-OOS-01 host dev-server build limitation', async ({
  page,
}) => {
  const original = await readFile(ROZIE_FILE, 'utf8');
  expect(original).toContain('gap: 0.5rem');

  try {
    // The angular-analogjs AppComponent routing shell — nav buttons are
    // data-testid "nav-counter" (lowercase PageKey); counter is the default.
    await page.goto('/');
    await page.getByTestId('nav-counter').click();

    const counter = page.locator('.counter');
    await expect(counter).toBeVisible();

    // gap: 0.5rem === 8px before the edit.
    await expect(counter).toHaveCSS('gap', '8px');

    // Mutate state via the UI — increment three times. The Counter Demo
    // section shows "External value: <span data-testid='parent-value'>"
    // reflecting the [(value)] two-way binding.
    const increment = page.getByLabel('Increment');
    await increment.click();
    await increment.click();
    await increment.click();
    await expect(page.getByTestId('parent-value')).toHaveText('3');

    // Edit a <style> value on disk — in-place value swap, triggers HMR.
    await writeFile(
      ROZIE_FILE,
      original.replace('gap: 0.5rem', 'gap: 0.75rem'),
    );

    // Poll for the style hot-apply with a generous timeout BEFORE asserting
    // state survival (A4 flake mitigation).
    await expect
      .poll(() => counter.evaluate((el) => getComputedStyle(el).gap), {
        timeout: 15_000,
      })
      .toBe('12px'); // gap: 0.75rem === 12px

    // THE QA-04 CONTRACT: the mutated state survived the hot update.
    await expect(page.getByTestId('parent-value')).toHaveText('3');
  } finally {
    // Mandatory unconditional restore — leave the working tree clean.
    await writeFile(ROZIE_FILE, original);
  }
});
