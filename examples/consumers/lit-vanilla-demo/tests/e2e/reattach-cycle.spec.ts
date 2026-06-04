// Phase 7 Plan 07-04 Task 1 (QA-03) — Lit reattach-cycle analog.
//
// Lit's dev-mode stress analog is the connectedCallback / disconnectedCallback
// reattach cycle: grab a <rozie-*> element, call `el.remove()` (fires
// disconnectedCallback — drains `_disconnectCleanups`), then re-append it
// (fires connectedCallback). The LIT-T-02 contract is: a disconnect drains the
// cleanup array exactly once AND a reconnect re-arms every listener exactly
// once, with no duplicate event listeners.
//
// For the lifecycle-bearing subset (Modal + Dropdown + SearchInput):
//   - Dropdown — the outside-click / keydown / resize listeners (pushed to
//     _disconnectCleanups) must be removed on disconnect AND re-armed on
//     reconnect.
//   - Modal — the body-scroll-lock must not be left stale or doubled after a
//     reattach: document.body.style.overflow stays consistent.
//   - SearchInput — the debounce timer cleanup must drain on disconnect so a
//     reattached element has a fresh timer (no trailing call into a detached
//     shadow root → no pageerror).
//
// el.remove() / re-append is done in page.evaluate() so the disconnect/connect
// callbacks fire synchronously in the page context.
//
// CARRY-FORWARD (D-SH-02, 07-DIVERGENCES.md): the @rozie/target-lit emitter
// wires ALL listener setup (attachOutsideClickListener, document keydown,
// window resize, slotchange) into `firstUpdated()` — which Lit runs exactly
// ONCE, at first render. `disconnectedCallback()` correctly drains
// `_disconnectCleanups`, but there is NO `connectedCallback()` override to
// RE-ARM them. After a disconnect → reconnect cycle the element is left with
// zero listeners. This violates the LIT-T-02 re-arm half of the contract. The
// disconnect-drain half (verified below — no stale listener fires, no doubled
// behavior, no pageerror) is correct; the re-arm half is the bug, captured by
// the `test.fixme`-marked spec below and carried forward to Plan 07-05.
import { test, expect } from '@playwright/test';

test.describe('Lit reattach-cycle (QA-03)', () => {
  test('Dropdown: disconnectedCallback drains _disconnectCleanups with no stale/doubled listener', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/src/pages/DropdownPage.html');
    const openState = page.locator('#open-state');
    await expect(openState).toHaveText('false');

    // Arm the listeners once (firstUpdated): open via the slotted trigger,
    // close via an outside click on the page heading.
    await page.locator('#trigger-btn').click();
    await expect(openState).toHaveText('true');
    // Click the page heading — unambiguously outside the dropdown's composed
    // tree (the slotted <li> items can overlay the #outside button in flow).
    await page.locator('h1').click();
    await expect(openState).toHaveText('false');

    // Disconnect → disconnectedCallback drains _disconnectCleanups (removes the
    // outside-click / keydown / resize listeners). Re-append the element.
    await page.evaluate(() => {
      const el = document.getElementById('dropdown')!;
      const parent = el.parentNode!;
      const marker = document.createComment('reattach-slot');
      parent.replaceChild(marker, el);
      parent.replaceChild(el, marker);
    });

    // The drain must be clean: opening the dropdown after the reattach still
    // works (the trigger's slotchange-driven wiring re-renders), and clicking
    // outside no longer closes it (the listener was correctly REMOVED — it was
    // not left as a stale listener bound to the detached tree, which would
    // either throw or double-fire). No pageerror is the marquee assertion that
    // the drain did not leave a dangling listener.
    await page.locator('#trigger-btn').click();
    await expect(openState).toHaveText('true');

    expect(pageErrors).toEqual([]);
  });

  // D-SH-02 FIXED (Plan 07-05): the Lit emitter now lifts listener wiring into
  // `_armListeners()`, called from `firstUpdated()` (first render) AND
  // `connectedCallback()` on every reconnect (guarded by `this.hasUpdated`), so
  // a disconnect → reconnect cycle re-arms the outside-click listener. Un-fixmed.
  test(
    'Dropdown: reconnect re-arms the outside-click listener (D-SH-02 — emitter connectedCallback re-arm)',
    async ({ page }) => {
      await page.goto('/src/pages/DropdownPage.html');
      const openState = page.locator('#open-state');

      await page.locator('#trigger-btn').click();
      await expect(openState).toHaveText('true');
      await page.locator('h1').click();
      await expect(openState).toHaveText('false');

      await page.evaluate(() => {
        const el = document.getElementById('dropdown')!;
        const parent = el.parentNode!;
        const marker = document.createComment('reattach-slot');
        parent.replaceChild(marker, el);
        parent.replaceChild(el, marker);
      });

      // EXPECTED once 07-05 lands the connectedCallback re-arm: a single
      // outside click closes the dropdown again.
      await page.locator('#trigger-btn').click();
      await expect(openState).toHaveText('true');
      await page.locator('h1').click();
      await expect(openState).toHaveText('false');
    },
  );

  test('Modal: body-scroll-lock is not left stale or doubled after a reattach', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Per canonical Modal.rozie the body-scroll-lock is OPEN-coupled: lockScroll
    // is a guarded no-op while closed, the lock arms when the `open` property
    // flips true (the $watch(() => $props.open) driver → Lit `updated()`), and
    // `unlockScroll` is pushed onto `_disconnectCleanups` (drained by
    // `disconnectedCallback`). D-SH-01 reconciled (Plan 25-03 / f23f6a2e): the
    // Lit Modal scroll-lock now matches the React reference's open-coupled
    // contract; the former mount/disconnect-coupled divergence is retired.
    //
    // The reattach-cycle contract under test: with the modal OPEN (lock armed),
    // a disconnect drains the lock exactly once (overflow → ''), and reconnects
    // leave no stale or doubled lock across cycles. Lit does not re-run
    // firstUpdated on a re-append and `open` is unchanged across the reattach,
    // so a bare reconnect does not re-arm — overflow stays ''.
    await page.goto('/src/pages/ModalPage.html');

    const bodyOverflow = () =>
      page.evaluate(() => document.body.style.overflow);

    // Upgrade (closed): lockScroll is a guarded no-op → ''.
    await expect.poll(bodyOverflow).toBe('');

    // Open the modal (el.open = true via the page button) → $watch drives
    // lockScroll in `updated()` → 'hidden'.
    await page.locator('#open-modal').click();
    await expect.poll(bodyOverflow).toBe('hidden');

    const reattach = () =>
      page.evaluate(() => {
        const el = document.getElementById('modal')!;
        const parent = el.parentNode!;
        const marker = document.createComment('reattach-slot');
        parent.replaceChild(marker, el);
        parent.replaceChild(el, marker);
      });

    // Reattach cycle 1: disconnect drains _disconnectCleanups → unlockScroll
    // runs exactly once → overflow restored to ''. Lit does NOT re-run
    // firstUpdated on a re-append and `open` did not change, so a bare reattach
    // leaves overflow '' (no re-arm).
    await reattach();
    await expect.poll(bodyOverflow).toBe('');

    // Reattach cycle 2: a second disconnect must not double-unlock into a
    // corrupt state, and a second reconnect must not leave a stale lock.
    await reattach();
    await expect.poll(bodyOverflow).toBe('');

    // Toggling the `open` property after the reattach cycles must not throw —
    // the listener wiring (keydown.escape, slotchange) re-armed cleanly and no
    // cleanup ran against a detached shadow root.
    await page.evaluate(() => {
      const el = document.getElementById('modal') as HTMLElement & {
        open: boolean;
      };
      el.open = false;
    });

    expect(pageErrors).toEqual([]);
  });

  test('SearchInput: debounce-timer cleanup drains on disconnect, re-arms cleanly on reconnect', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/src/pages/SearchInputPage.html');

    // Type into the shadow-rooted input to start a debounce timer, then
    // immediately reattach — disconnectedCallback must clear the pending timer
    // (push to _disconnectCleanups), so no trailing debounced call fires into
    // the detached shadow root.
    await page.evaluate(() => {
      const el = document.getElementById('search')!;
      const input = el.shadowRoot?.querySelector('input') as
        | HTMLInputElement
        | undefined;
      if (input) {
        input.value = 'abc';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // reattach immediately, mid-debounce
      const parent = el.parentNode!;
      const marker = document.createComment('reattach-slot');
      parent.replaceChild(marker, el);
      parent.replaceChild(el, marker);
    });

    // Give the original debounce window time to elapse — if the timer was NOT
    // drained on disconnect, a trailing call into the detached tree throws.
    await page.waitForTimeout(400);

    // After reconnect the element must accept fresh input and emit `search`
    // exactly once per debounce window — the timer was re-armed cleanly.
    await page.evaluate(() => {
      const el = document.getElementById('search')!;
      const input = el.shadowRoot?.querySelector('input') as
        | HTMLInputElement
        | undefined;
      if (input) {
        input.value = 'hello';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await expect(page.locator('#last-query')).toHaveText('hello');

    expect(pageErrors).toEqual([]);
  });
});
