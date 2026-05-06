// Phase 5 Plan 05-02b — SearchInput spec (debounce parity).
//
// SearchInput.rozie has:
//   <input @input.debounce(300)="onSearch" @keydown.enter="onSearch" @keydown.escape="clear" />
//
// Per RESEARCH.md A8/A9 RESOLVED, the Svelte emitter inlines `.debounce(300)`
// as an IIFE wrapper around onSearch — no @rozie/runtime-svelte helper.
//
// Behavior we assert:
//   1. Type 5 chars spaced 50ms apart → onSearch should NOT fire on every
//      keystroke (debounce window is 300ms).
//   2. Wait 350ms after the final keystroke → onSearch fires EXACTLY ONCE
//      with the final value, parent updates `Last query: …`.
//
// The Svelte emitter rewrites $props.placeholder / $data.query / $emit
// references; SearchInput's two-way r-model="$data.query" binds the input
// value to the local $state-backed `query`, then debounce watches the
// input's @input event.
import { test, expect } from '@playwright/test';

test('SearchInput debounces @input by 300ms (debounce parity)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-search-input').click();

  const input = page.locator('input[type="search"]');

  // Type "hello" with 50ms delay between keys (5 keys × 50ms = 250ms total —
  // less than the 300ms debounce window). No onSearch should have fired by
  // the time the last key lands.
  await input.click();
  await input.pressSequentially('hello', { delay: 50 });

  // The Last query span should NOT yet exist (onSearch never fired).
  // Wait a small amount short of the debounce window to verify quiescence.
  await page.waitForTimeout(100);
  await expect(page.getByTestId('last-query')).not.toBeVisible();

  // Now wait past the debounce window (350ms).
  await page.waitForTimeout(350);
  await expect(page.getByTestId('last-query')).toBeVisible();
  await expect(page.getByTestId('last-query')).toHaveText('Last query: hello');
});

test('SearchInput Enter fires onSearch immediately (no debounce wait on @keydown.enter)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-search-input').click();

  const input = page.locator('input[type="search"]');
  await input.click();
  await input.pressSequentially('hi', { delay: 10 });
  await input.press('Enter');

  // Enter triggers onSearch synchronously — no need to wait for debounce.
  await expect(page.getByTestId('last-query')).toBeVisible({ timeout: 200 });
  await expect(page.getByTestId('last-query')).toHaveText('Last query: hi');
});
