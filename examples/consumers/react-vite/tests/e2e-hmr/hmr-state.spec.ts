// Phase 7 Plan 07-04 Task 3 (QA-04) — HMR state-preservation: React.
//
// The QA-04 contract: editing a `<style>` value in a `.rozie` source on disk
// while the Vite dev server runs triggers a hot update (NOT a full reload), the
// new style is applied, AND the component's mutated state survives.
//
// This spec:
//   1. reads the demo's Counter.rozie source into `original`
//   2. (try) navigates to the Counter page, mutates state via the UI
//      (increments the counter — the parent-tracked value is the observable
//      proxy for the Counter's internal controllable `<data>`-equivalent state)
//   3. writeFile the source replacing the `<style>` value `gap: 0.5rem` →
//      `gap: 0.75rem` — an in-place value edit, no leading-comment insertion
//      (MEMORY: feedback_rozie_leading_comments — leading comments shift parser
//      byte offsets), so HMR fires rather than a full reload
//   4. polls for the style hot-apply (A4 flake mitigation) THEN asserts the
//      mutated state survived
//   5. (finally) writeFile the original content back UNCONDITIONALLY — the
//      restore is mandatory or the working tree is left dirty (MEMORY:
//      feedback_worktree_pwd_and_leakage)
//
// React is one of the two targets where BOTH halves of the QA-04 contract hold
// (the other is Solid): the unplugin's `handleHotUpdate` invalidates React's
// `.module.css` / `.global.css` CSS sidecars, so the `<style>` edit hot-applies
// AND component state survives. For Vue / Svelte / Lit only the state-survival
// half holds — see D-SH-03 in 07-DIVERGENCES.md.
import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// react-vite imports its own local copy: src/Counter.rozie.
const ROZIE_FILE = fileURLToPath(
  new URL('../../src/Counter.rozie', import.meta.url),
);

test('HMR preserves Counter state across a <style> edit (QA-04)', async ({
  page,
}) => {
  const original = await readFile(ROZIE_FILE, 'utf8');
  // Guard: the edit target must exist verbatim, or the writeFile would be a
  // no-op and the test would silently assert nothing.
  expect(original).toContain('gap: 0.5rem');

  try {
    // Counter is the default landing page in the react-vite App routing shell.
    await page.goto('/');
    await page.getByTestId('nav-counter').click();

    // The React target emits the `.counter` class through CSS Modules, so the
    // rendered DOM class is hashed — locate the counter container via the
    // Increment button's parent (the button is a direct child of `.counter`),
    // which is stable across the CSS-Modules hash.
    const increment = page.getByLabel('Increment');
    await expect(increment).toBeVisible();
    const counter = increment.locator('..');

    // gap: 0.5rem === 8px before the edit.
    await expect
      .poll(() => counter.evaluate((el) => getComputedStyle(el).gap), {
        timeout: 10_000,
      })
      .toBe('8px');

    // Mutate state via the UI — increment three times. The parent-tracked
    // value span is the observable proxy for the Counter's internal
    // controllable state (useControllableState).
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
    // state survival (A4 — a slow HMR apply must not cause a false failure).
    await expect
      .poll(() => counter.evaluate((el) => getComputedStyle(el).gap), {
        timeout: 15_000,
      })
      .toBe('12px'); // gap: 0.75rem === 12px

    // THE QA-04 CONTRACT: the mutated state survived the hot update. The
    // counter value is still 3 — HMR applied the style without remounting the
    // component and resetting its state.
    await expect(page.getByTestId('parent-value')).toHaveText('3');
  } finally {
    // Mandatory unconditional restore — leave the working tree clean.
    await writeFile(ROZIE_FILE, original);
  }
});
