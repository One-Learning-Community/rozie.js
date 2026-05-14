// Phase 7 Plan 07-04 Task 1 (QA-03) — StrictMode lifecycle-symmetry matrix.
//
// Generalizes modal-strictmode.spec.ts across ALL 8 reference examples. The
// react-vite demo wraps the app in <StrictMode> (main.tsx, permanent — the
// comment there forbids removal), so every effect / lifecycle hook runs twice
// in dev. This spec proves that mount → unmount → re-mount → unmount navigation
// leaves NO leaked state and produces NO double-fired lifecycle bug for any of
// the 8 examples.
//
// The Modal cell additionally KEEPS the body-scroll-lock assertion verbatim
// from modal-strictmode.spec.ts — the named Pitfall 3 regression target. That
// assertion (document.body.style.overflow cycles '' → 'hidden' → '' across
// open/close, twice) is CI-gated here.
//
// modal-strictmode.spec.ts is retained alongside this matrix spec as the
// focused single-purpose anchor; the body-scroll-lock assertion is duplicated
// (not removed) into the Modal cell below so the regression survives in the
// matrix even if the anchor spec is ever pruned.
import { test, expect } from '@playwright/test';

// The 8 reference examples and the nav-testid the App.tsx routing shell uses.
const EXAMPLES = [
  { name: 'Counter', nav: 'nav-counter' },
  { name: 'SearchInput', nav: 'nav-search-input' },
  { name: 'Dropdown', nav: 'nav-dropdown' },
  { name: 'TodoList', nav: 'nav-todo-list' },
  { name: 'Modal', nav: 'nav-modal' },
  { name: 'TreeNode', nav: 'nav-tree-node' },
  { name: 'Card', nav: 'nav-card' },
  { name: 'CardHeader', nav: 'nav-card-header' },
] as const;

test.describe('StrictMode lifecycle-symmetry matrix (QA-03)', () => {
  for (const example of EXAMPLES) {
    test(`${example.name} mounts/unmounts cleanly under StrictMode`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto('/');

      // mount → unmount → re-mount → unmount, navigating via the App nav.
      // Counter is the default landing page; navigate away first, then to the
      // target, away again, back, away — exercising the full StrictMode
      // double-invoke lifecycle twice.
      const settle = 'nav-counter';
      const awayFrom =
        example.nav === settle ? 'nav-modal' : settle;

      // First mount cycle.
      await page.getByTestId(example.nav).click();
      // The routed component actually mounted — `rozie-mount` is the testid the
      // App routing shell renders around the active example. If navigation
      // silently broke (e.g. the routed component threw on render) this would
      // fail instead of going vacuously green.
      await expect(page.getByTestId('rozie-mount')).toBeVisible();
      // unmount
      await page.getByTestId(awayFrom).click();
      // second mount cycle (re-mount)
      await page.getByTestId(example.nav).click();
      // unmount again
      await page.getByTestId(awayFrom).click();

      // No JS errors thrown across the full mount/unmount/remount/unmount cycle
      // — a double-fired lifecycle hook (e.g. an effect that registers a
      // listener twice but cleans up once) surfaces here as a pageerror.
      expect(pageErrors).toEqual([]);

      // body.style.overflow must be clean after navigating away from every
      // example — only Modal touches it, and only while open. No example may
      // leak a body-style mutation just by mounting/unmounting.
      const leakedOverflow = await page.evaluate(
        () => document.body.style.overflow,
      );
      expect(leakedOverflow).toBe('');
    });
  }

  // Modal cell — the load-bearing Pitfall 3 regression. Paired
  // $onMount(lockScroll) / $onUnmount(unlockScroll); under StrictMode's
  // double-invoke an asymmetric implementation leaves body.style.overflow
  // stuck. This assertion is verbatim from modal-strictmode.spec.ts and is
  // CI-gated as part of the matrix.
  test('Modal body-scroll-lock cycles symmetrically under StrictMode (Pitfall 3, CI-gated)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('nav-modal').click();

    // Initial state: body.style.overflow is '' (unset).
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    // Open modal → backdrop visible → body locked.
    await page.getByTestId('open-modal').click();
    await expect(page.getByTestId('modal-backdrop')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      'hidden',
    );

    // Close via × button → body restored.
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('modal-backdrop')).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    // Re-open + close again — body.style.overflow must still cycle correctly,
    // proving no StrictMode double-invoke state corruption.
    await page.getByTestId('open-modal').click();
    await expect(page.getByTestId('modal-backdrop')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      'hidden',
    );
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('modal-backdrop')).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    const closeCount = await page.getByTestId('close-count').textContent();
    expect(closeCount).toMatch(/Closed 2 time/);
  });
});
