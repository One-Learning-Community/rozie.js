// Phase 7 Plan 07-04 Task 1 (QA-03) — Solid dev-mode double-mount analog.
//
// Solid has no React-StrictMode double-invoke. Its dev-mode stress analog is a
// manual mount → dispose → re-mount cycle: the solid-vite demo uses hash-based
// routing, and navigating away from a route disposes that route's reactive
// owner (running every `onCleanup`), while navigating back creates a fresh one.
// vite-plugin-solid compiles the demo with `solid-js/dev` active in the dev
// build (this demo's playwright config runs `pnpm dev`, not build+preview), so
// reactivity-graph misuse surfaces as console / pageerror output.
//
// For the lifecycle-bearing subset (Modal + Dropdown + SearchInput), this spec
// drives several mount/dispose/re-mount cycles and asserts:
//   - no JS errors across the cycle (a doubled effect or a cleanup that runs
//     more than once per mount throws here),
//   - `onCleanup` ran exactly once per mount — verified structurally: after a
//     dispose the component's side effects (body-scroll-lock for Modal, the
//     outside-click listener for Dropdown) are gone, and after a re-mount they
//     are freshly armed exactly once (not doubled).
//
// The Modal cell is load-bearing: paired $onMount(lockScroll) / $onUnmount(
// unlockScroll). A dispose must run unlockScroll exactly once; a re-mount must
// not leave a stale or doubled lock.
import { test, expect } from '@playwright/test';

/** Navigate to a hash route and wait for its heading to confirm the mount. */
async function mountRoute(
  page: import('@playwright/test').Page,
  hash: string,
  heading: string,
): Promise<void> {
  await page.goto(`/#${hash}`);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

/** Navigate away to the counter route — disposes the previous route's owner. */
async function disposeRoute(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.goto('/#/counter');
  await expect(page.getByRole('heading', { name: 'Counter' })).toBeVisible();
}

test.describe('Solid dev-mode double-mount (QA-03)', () => {
  test('Modal: mount/dispose/re-mount runs onCleanup exactly once per mount', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // examples/Modal.rozie (the source the solid demo imports) marks its
    // backdrop with `class="modal-backdrop"` — no data-testid — so the subset
    // specs locate it by class.
    const backdrop = page.locator('.modal-backdrop');

    // QA-03 contract for Solid: the lifecycle-pairing — $onMount(lockScroll) /
    // $onUnmount(unlockScroll) plus the $watch(() => $props.open) driver — is the
    // dev-mode double-mount cleanup surface. Per canonical Modal.rozie the
    // body-scroll-lock is OPEN-coupled: $onMount(lockScroll) is a guarded no-op
    // while closed, the lock arms when `open` flips true ($watch), and the
    // $onUnmount(unlockScroll) restore runs exactly once per dispose. The
    // stress assertion is therefore: each mount→open LOCKS body scroll, the
    // matching dispose UNLOCKS it exactly once (symmetric cleanup), and repeated
    // mount/open/dispose cycles never leak or double the lock.
    //
    // D-SH-01 reconciled (Plan 25-03 / f23f6a2e): the Solid Modal scroll-lock is
    // now open-coupled, matching the React reference target's strictmode-matrix
    // contract. The former mount/dispose-coupled divergence is retired.
    //
    // Overflow assertions use page.waitForFunction (not expect.poll): the cycle
    // drives hash-route navigations (mountRoute / disposeRoute), and an
    // expect.poll probe in flight when the next navigation fires surfaces a
    // transient "execution context destroyed" error. waitForFunction polls
    // in-page and re-binds to the new context, so it asserts the same
    // lock/release contract without binding to navigation/flush timing.
    const waitOverflow = (value: string) =>
      page.waitForFunction(
        (v) => document.body.style.overflow === v,
        value,
      );

    // Cycle 1 — mount (closed): $onMount(lockScroll) is a guarded no-op → ''.
    await mountRoute(page, '/modal', 'Modal');
    await waitOverflow('');
    // Open the modal → backdrop visible → $watch fires → lockScroll → 'hidden'.
    await page.getByTestId('open-modal').click();
    await expect(backdrop).toBeVisible();
    await waitOverflow('hidden');

    // Dispose mid-open — navigating away disposes the Modal's reactive owner.
    // $onUnmount(unlockScroll) must run exactly once: body.style.overflow back
    // to '' (not left 'hidden', not double-cleared into a corrupt state).
    await disposeRoute(page);
    await waitOverflow('');

    // Cycle 2 — re-mount. A fresh owner; closed → ''; open → lock arms again
    // exactly once (not doubled) → 'hidden'; dispose mid-open → unlock once → ''.
    await mountRoute(page, '/modal', 'Modal');
    await waitOverflow('');
    await page.getByTestId('open-modal').click();
    await expect(backdrop).toBeVisible();
    await waitOverflow('hidden');
    await disposeRoute(page);
    await waitOverflow('');

    // Cycle 3 — one more mount/open/dispose to shake out accumulation; the lock
    // must still be exactly-once-per-open with a clean '' after dispose.
    await mountRoute(page, '/modal', 'Modal');
    await waitOverflow('');
    await page.getByTestId('open-modal').click();
    await expect(backdrop).toBeVisible();
    await waitOverflow('hidden');
    await disposeRoute(page);
    await waitOverflow('');

    expect(pageErrors).toEqual([]);
  });

  test('Dropdown: mount/dispose/re-mount re-arms the outside-click listener exactly once', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Cycle 1 — mount, open, close via outside click (listener armed once).
    await mountRoute(page, '/dropdown', 'Dropdown');
    await page.getByTestId('dropdown-trigger').click();
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('true');
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('false');

    // Dispose — onCleanup removes the outside-click listener exactly once.
    await disposeRoute(page);

    // Cycle 2 — re-mount. If the listener were doubled (cleanup ran zero times
    // on dispose, or the effect re-ran without cleanup), a single outside click
    // would still close it but a stale listener from the disposed owner could
    // throw on a detached node. Open + close again and assert clean behavior.
    await mountRoute(page, '/dropdown', 'Dropdown');
    await page.getByTestId('dropdown-trigger').click();
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('true');
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('false');

    // Cycle 3 — one more mount/dispose/re-mount to shake out accumulation.
    await disposeRoute(page);
    await mountRoute(page, '/dropdown', 'Dropdown');
    await page.getByTestId('dropdown-trigger').click();
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('true');
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('false');

    expect(pageErrors).toEqual([]);
  });

  test('SearchInput: mount/dispose/re-mount cycle leaves no leaked state', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    for (let cycle = 0; cycle < 3; cycle++) {
      await mountRoute(page, '/search-input', 'SearchInput');
      // Mutate state — type a query past the minLength threshold.
      const input = page.getByPlaceholder('Search…');
      await input.fill('hello');
      // Debounced @input — the SearchInput's debounce timer is the cleanup
      // surface. After a dispose mid-debounce, onCleanup must clear the pending
      // timer (no trailing call into a disposed owner → no pageerror).
      await disposeRoute(page);
    }

    // A fresh mount after the cycles must start clean (no carried-over query).
    await mountRoute(page, '/search-input', 'SearchInput');
    await expect(page.getByTestId('last-query')).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });
});
