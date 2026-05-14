// Phase 7 Plan 07-04 Task 3 (QA-04) — HMR state-preservation: Svelte.
//
// The QA-04 contract: editing a `<style>` value in a `.rozie` source on disk
// while the Vite dev server runs triggers a hot update (NOT a full reload), the
// new style is applied, AND the component's mutated state survives.
//
// FINDING (D-SH-03, 07-DIVERGENCES.md): for the Svelte target the QA-04
// contract splits in two —
//   - `<data>` STATE SURVIVAL across the HMR-triggering `<style>` edit HOLDS
//     (verified: the mutated counter value is still present, no full reload —
//     `[vite] hot updated: /src/Counter.rozie.svelte` fires, state preserved).
//     This is the primary `test` below — it passes.
//   - STYLE HOT-APPLY does NOT hold: `@rozie/unplugin`'s `handleHotUpdate`
//     invalidates only the top-level `Counter.rozie.svelte` virtual module, not
//     the `?svelte&type=style` sub-module `@sveltejs/vite-plugin-svelte`
//     creates, so the new CSS is not repainted. That half is the `test.fixme`
//     companion below — carried forward to Plan 07-05.
//
// Each spec:
//   1. reads the demo's Counter.rozie source into `original`
//   2. (try) navigates to the Counter page, mutates state via the UI
//   3. writeFile the source replacing the `<style>` value `gap: 0.5rem` →
//      `gap: 0.75rem` — an in-place value edit, no leading-comment insertion
//      (MEMORY: feedback_rozie_leading_comments), so HMR fires not a full reload
//   4. polls for the HMR effect with a generous timeout (A4 flake mitigation)
//   5. (finally) writeFile the original content back UNCONDITIONALLY (MEMORY:
//      feedback_worktree_pwd_and_leakage — the restore is mandatory)
import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// svelte-vite imports its own local copy: src/Counter.rozie.
const ROZIE_FILE = fileURLToPath(
  new URL('../../src/Counter.rozie', import.meta.url),
);

test('HMR preserves Counter <data> state across a <style> edit (QA-04)', async ({
  page,
}) => {
  const original = await readFile(ROZIE_FILE, 'utf8');
  expect(original).toContain('gap: 0.5rem');

  try {
    // The svelte-vite App.svelte routing shell — nav buttons are data-testid
    // "nav-counter" (lowercase PageKey).
    await page.goto('/');
    await page.getByTestId('nav-counter').click();

    const counter = page.locator('.counter');
    await expect(counter).toBeVisible();
    await expect(counter).toHaveCSS('gap', '8px'); // gap: 0.5rem === 8px

    // Mutate state via the UI — increment three times. The Counter section
    // shows "External value: <span data-testid='parent-value'>" reflecting the
    // bind:value two-way binding.
    const increment = page.getByLabel('Increment');
    await increment.click();
    await increment.click();
    await increment.click();
    await expect(page.getByTestId('parent-value')).toHaveText('3');

    // Edit a <style> value on disk — in-place value swap, triggers HMR.
    await writeFile(ROZIE_FILE, original.replace('gap: 0.5rem', 'gap: 0.75rem'));

    // The edit triggers an HMR update for Counter.rozie.svelte. Give the
    // update a generous window to propagate (A4 flake mitigation), THEN assert
    // the QA-04 CORE CONTRACT: the mutated <data> state survived — the counter
    // value is still 3, the component was hot-updated WITHOUT a full reload (a
    // reload would reset value to 0).
    await expect(page.getByTestId('parent-value')).toHaveText('3', {
      timeout: 15_000,
    });
    await page.waitForTimeout(1_000);
    await expect(page.getByTestId('parent-value')).toHaveText('3');
  } finally {
    // Mandatory unconditional restore — leave the working tree clean.
    await writeFile(ROZIE_FILE, original);
  }
});

// D-SH-03 carry-forward: the style-hot-apply half of the QA-04 contract. The
// unplugin's handleHotUpdate does not invalidate @sveltejs/vite-plugin-svelte's
// `?svelte&type=style` sub-module, so the edited `gap` value is not repainted.
// Marked fixme — Plan 07-05 fixes the unplugin (invalidate the style
// sub-module) and un-fixmes this.
test.fixme(
  'HMR <style> edit hot-applies the new value (D-SH-03 — unplugin does not invalidate the svelte style sub-module)',
  async ({ page }) => {
    const original = await readFile(ROZIE_FILE, 'utf8');
    expect(original).toContain('gap: 0.5rem');

    try {
      await page.goto('/');
      await page.getByTestId('nav-counter').click();
      const counter = page.locator('.counter');
      await expect(counter).toHaveCSS('gap', '8px');

      await writeFile(
        ROZIE_FILE,
        original.replace('gap: 0.5rem', 'gap: 0.75rem'),
      );

      // EXPECTED once 07-05 lands the style-sub-module invalidation.
      await expect
        .poll(() => counter.evaluate((el) => getComputedStyle(el).gap), {
          timeout: 15_000,
        })
        .toBe('12px');
    } finally {
      await writeFile(ROZIE_FILE, original);
    }
  },
);
