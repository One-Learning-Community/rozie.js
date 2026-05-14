// Phase 7 Plan 07-04 Task 3 (QA-04) — HMR state-preservation: Lit.
//
// The QA-04 contract: editing a `<style>` value in a `.rozie` source on disk
// while the Vite dev server runs triggers a hot update (NOT a full reload), the
// new style is applied, AND the component's mutated state survives.
//
// FINDING (D-SH-03, 07-DIVERGENCES.md): for the Lit target the QA-04 contract
// splits in two —
//   - STATE SURVIVAL across the HMR-triggering `<style>` edit HOLDS (verified:
//     the mutated counter value is still present, no full reload). This is the
//     primary `test` below — it passes.
//   - STYLE HOT-APPLY does NOT hold: `@rozie/unplugin`'s `handleHotUpdate`
//     invalidates only the top-level `Counter.rozie.ts` virtual module; the
//     edited shadow-DOM `<style>` is not re-applied to the live element. That
//     half is the `test.fixme` companion below — carried forward to Plan 07-05.
//
// Lit components render into a shadow root and self-register as custom
// elements — the `.counter` element and the Increment button live inside
// <rozie-counter>'s shadowRoot, so this spec pierces shadow DOM via
// page.evaluate().
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

// lit-vanilla-demo imports its own local copy: src/rozie/Counter.rozie.
const ROZIE_FILE = fileURLToPath(
  new URL('../../src/rozie/Counter.rozie', import.meta.url),
);

/** Read the computed `gap` of the shadow-rooted `.counter` element. */
async function counterGap(
  page: import('@playwright/test').Page,
): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.getElementById('counter');
    const inner = el?.shadowRoot?.querySelector('.counter');
    return inner ? getComputedStyle(inner).gap : null;
  });
}

/** Click the shadow-rooted Increment button once. */
async function clickIncrement(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.locator('#counter').evaluate((el: Element) => {
    const btn = (el as HTMLElement).shadowRoot?.querySelector(
      'button[aria-label="Increment"]',
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });
}

test('HMR preserves Counter state across a <style> edit (QA-04)', async ({
  page,
}) => {
  const original = await readFile(ROZIE_FILE, 'utf8');
  expect(original).toContain('gap: 0.5rem');

  try {
    // lit-vanilla-demo is a multi-page MPA — navigate to the Counter page.
    await page.goto('/src/pages/CounterPage.html');
    const counter = page.locator('#counter');
    await expect(counter).toHaveAttribute('value', '0');

    // gap: 0.5rem === 8px before the edit (shadow-rooted .counter).
    await expect.poll(() => counterGap(page), { timeout: 10_000 }).toBe('8px');

    // Mutate state via the UI — click the shadow-rooted Increment button three
    // times. Each click dispatches value-change → the host-side listener
    // updates #external (data-testid="parent-value").
    await clickIncrement(page);
    await clickIncrement(page);
    await clickIncrement(page);
    await expect(page.getByTestId('parent-value')).toHaveText('3');

    // Edit a <style> value on disk — in-place value swap, triggers HMR.
    await writeFile(ROZIE_FILE, original.replace('gap: 0.5rem', 'gap: 0.75rem'));

    // The edit triggers an HMR update for Counter.rozie.ts. Give it a generous
    // window to propagate (A4 flake mitigation), THEN assert the QA-04 CORE
    // CONTRACT: the mutated state survived — the counter value is still 3, the
    // module was hot-updated WITHOUT a full reload (a reload would reset the
    // host-side #external span and re-run the page module).
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

// D-SH-03 FIXED (Plan 07-05): the unplugin's handleHotUpdate now additively
// invalidates the Lit `<style>` sub-module (any `type=style` / `lang.css`
// child of the top-level virtual module) so the edited shadow-DOM <style> is
// re-applied to the live Lit element. Un-fixmed.
test(
  'HMR <style> edit hot-applies the new value (D-SH-03 — unplugin invalidates the lit style sub-module)',
  async ({ page }) => {
    const original = await readFile(ROZIE_FILE, 'utf8');
    expect(original).toContain('gap: 0.5rem');

    try {
      await page.goto('/src/pages/CounterPage.html');
      await expect(page.locator('#counter')).toHaveAttribute('value', '0');
      await expect
        .poll(() => counterGap(page), { timeout: 10_000 })
        .toBe('8px');

      await writeFile(
        ROZIE_FILE,
        original.replace('gap: 0.5rem', 'gap: 0.75rem'),
      );

      // EXPECTED once 07-05 lands the Lit style HMR fix.
      await expect
        .poll(() => counterGap(page), { timeout: 15_000 })
        .toBe('12px');
    } finally {
      await writeFile(ROZIE_FILE, original);
    }
  },
);
