// Phase 4 success criterion 4: Modal under React.StrictMode preserves
// document.body.style.overflow correctness across mount → unmount → re-mount.
//
// REACT-T-06 + Pitfall 3 anchor. main.tsx wraps the app in <StrictMode> so
// every effect runs twice in dev. The Modal's lockScroll/unlockScroll lifecycle
// must produce a SYMMETRIC (mount, mount, unmount, unmount) trace where the
// final body.style.overflow is restored cleanly to '' (or whatever the page
// initially had — which the test asserts is '' since no other component sets it).
//
// The test:
//   1. Navigates to the modal page
//   2. Asserts body.style.overflow is '' before opening
//   3. Opens modal → asserts body.style.overflow is 'hidden'
//   4. Closes modal via × button → asserts body.style.overflow is restored to ''
//   5. Opens again, closes again → still '' (proves no state corruption from
//      StrictMode double-invocation)
import { test, expect } from '@playwright/test';

test('Modal under StrictMode preserves body.style.overflow across mount/unmount cycles (Phase 4 SC4 / REACT-T-06 / Pitfall 3)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-modal').click();

  // Initial state: body.style.overflow is '' (unset).
  const initialOverflow = await page.evaluate(() => document.body.style.overflow);
  expect(initialOverflow).toBe('');

  // NOTE: the overflow assertions below poll rather than read-once. React
  // flushes passive effects before a discrete-event update yields, but
  // preact/compat (the preact-compat matrix leg consumes this same suite)
  // defers them to after paint via rAF scheduling — an immediate read races
  // the effect. Polling asserts the same Pitfall-3 contract (lock applies,
  // releases, and cycles symmetrically — never left stuck) without binding
  // the test to renderer-specific effect-flush timing.
  const bodyOverflow = () => page.evaluate(() => document.body.style.overflow);

  // Open modal → backdrop visible → body locked.
  await page.getByTestId('open-modal').click();
  await expect(page.locator('.modal-backdrop')).toBeVisible();
  await expect.poll(bodyOverflow).toBe('hidden');

  // Close via × button.
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.modal-backdrop')).toBeHidden();
  await expect.poll(bodyOverflow).toBe('');

  // Re-open + close again — body.style.overflow must still cycle correctly.
  await page.getByTestId('open-modal').click();
  await expect(page.locator('.modal-backdrop')).toBeVisible();
  await expect.poll(bodyOverflow).toBe('hidden');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.modal-backdrop')).toBeHidden();
  await expect.poll(bodyOverflow).toBe('');

  // OQ4 anchor: Modal is parent-controlled (open prop) — works WITHOUT $expose.
  // If this test passes, OQ4 disposition is RESOLVED Phase 4.
  const closeCount = await page.getByTestId('close-count').textContent();
  expect(closeCount).toMatch(/Closed 2 time/);
});
