// Phase 7 Plan 07-04 Task 3 (QA-04) — HMR state-preservation: Solid.
//
// The QA-04 contract: editing a `<style>` value in a `.rozie` source on disk
// while the Vite dev server runs triggers a hot update (NOT a full reload), the
// new style is applied, AND the component's mutated state survives.
//
// This spec:
//   1. reads the demo's Counter.rozie source into `original`
//   2. (try) navigates to the Counter route, mutates state via the UI
//      (increments the counter)
//   3. writeFile the source replacing the `<style>` value `gap: 0.5rem` →
//      `gap: 0.75rem` — an in-place value edit, no leading-comment insertion
//      (MEMORY: feedback_rozie_leading_comments), so HMR fires rather than a
//      full reload
//   4. polls for the style hot-apply (A4 flake mitigation) THEN asserts the
//      mutated state survived
//   5. (finally) writeFile the original content back UNCONDITIONALLY (MEMORY:
//      feedback_worktree_pwd_and_leakage — the restore is mandatory)
//
// Solid is one of the two targets where BOTH halves of the QA-04 contract hold
// (the other is React): the Solid emitter renders the `<style>` block inline as
// a JSX `<style>` element in the component, so a component-module HMR carries
// the style change — the `<style>` edit hot-applies AND component state
// survives. For Vue / Svelte / Lit only the state-survival half holds — see
// D-SH-03 in 07-DIVERGENCES.md.
//
// NOTE: solid-vite imports the SHARED examples/Counter.rozie (not a local
// copy) — the same shared file vue-vite imports. The two HMR specs run
// sequentially (separate Playwright invocations) and each restores the file in
// `finally`, so the shared source is safe; `git diff --quiet examples/` after
// both runs is the cross-spec acceptance gate.
import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// solid-vite's CounterPage.tsx imports '../../../../Counter.rozie' — the
// shared examples/Counter.rozie at the repo root.
const ROZIE_FILE = fileURLToPath(
  new URL('../../../../Counter.rozie', import.meta.url),
);

test('HMR preserves Counter state across a <style> edit (QA-04)', async ({
  page,
}) => {
  const original = await readFile(ROZIE_FILE, 'utf8');
  expect(original).toContain('gap: 0.5rem');

  try {
    // The solid-vite App.tsx routing shell — hash-based routing.
    await page.goto('/#/counter');

    const counter = page.locator('.counter');
    await expect(counter).toBeVisible();

    // gap: 0.5rem === 8px before the edit.
    await expect(counter).toHaveCSS('gap', '8px');

    // Mutate state via the UI — increment three times. The CounterPage shows
    // "Parent-tracked value: <span data-testid='parent-value'>" reflecting the
    // onValueChange callback.
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
