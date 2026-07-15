import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Toaster behavioral smoke — pure-Rozie toast / notification host (`Toaster`).
 *
 * `Toaster` is a pure-Rozie family (NO third-party engine): one self-contained
 * host that owns the queue as internal state and exposes an imperative
 * `show / dismiss / clear` handle the consumer drives via `ref`. This spec proves
 * the $expose imperative-handle path ($refs.toaster.show() resolves on all 6
 * targets), the fresh-array queue reconcile (no in-place mutation), and the
 * per-toast close button produce identical behaviour across all 6 targets.
 *
 * `examples/demos/ToasterBehaviorDemo.rozie` drives a `show-toast` button that
 * calls `$refs.toaster.show({...})` and bumps a `readout-count`. Toasts are sticky
 * (`:duration="0"`) so there is no auto-dismiss timing flakiness — the spec can
 * assert the rendered toast + close button deterministically.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Runs locally on macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// One target-specific bug in this brand-new family, surfaced (as intended) by
// wiring the VR cell. Gated with a documented root cause — NOT a broad skip — and
// tracked for an emitter follow-up. The other 5 targets drive cleanly.
//   - svelte: `$refs.toaster.show()` (calling a CHILD component's `$expose` handle
//     from the parent template script via a component `ref`) throws "a is not a
//     function" at runtime — the parent `$refs.<childRef>` does not resolve to the
//     exposed handle on Svelte (it works on vue/react/angular/solid/lit). No toast
//     is ever enqueued (readout-count stays 0).
// (FIXED — react: the id counter was a module-scope `let nextId` referenced only
//  inside the `show` $expose verb, which the React emitter's hoistModuleLet does
//  NOT persist to useRef → it reset to 0 every render → duplicate ids. Moved the
//  counter to reactive $data.seq (real useState that persists), so the 2nd toast
//  now gets a distinct id and dismiss removes exactly one. react now drives clean.)
const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>([]);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`toaster [${target}]: show() handle enqueues sticky toasts (role=status), close button dismisses one`, async ({
    page,
  }) => {
    await page.goto(`/?example=ToasterBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const count = page.getByTestId('readout-count');
    await expect(count).toHaveText('0');
    // Role/CSS locators pierce Lit's open shadow root.
    const toasts = page.locator('[role="status"]');
    await expect(toasts).toHaveCount(0);

    // ---- 1. show() handle enqueues the first toast (sticky → stays) ----
    await page.getByTestId('show-toast').click();
    await expect(toasts).toHaveCount(1, { timeout: 15_000 });
    await expect
      .poll(async () => (await count.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('1');

    // ---- 2. a second show() → two toasts (fresh-array reconcile, no mutation) ----
    await page.getByTestId('show-toast').click();
    await expect(toasts).toHaveCount(2, { timeout: 10_000 });
    await expect
      .poll(async () => (await count.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('2');

    // ---- 3. the per-toast close button (aria-label "Dismiss") removes one ----
    await page
      .locator('.rozie-toast-close')
      .first()
      .click();
    await expect(toasts).toHaveCount(1, { timeout: 10_000 });
  });
}

/**
 * Swipe-to-dismiss (TOAST-SWIPE) — pointer drag on a toast. The demo's
 * `Toaster` sits in its default `top-right` corner (dismiss direction =
 * right), so a `show-toast`-enqueued sticky toast is the drag target;
 * `.rozie-toast` locators pierce Lit's open shadow root the same as
 * `[role="status"]` above. `dismissed-reason` mirrors the LATEST `@dismissed`
 * payload's `reason`, and `toggle-disable-swipe` flips `disableSwipe`.
 *
 * Proven GREEN ×6 only in the ONE batched Linux Docker VR run (Task 7) — see
 * the plan's verification section; authored here so the assertions exist and
 * gate that run.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  runner(`toaster [${target}]: swipe past threshold dismisses with reason 'swipe'`, async ({
    page,
  }) => {
    await page.goto(`/?example=ToasterBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('show-toast').click();
    const toast = page.locator('.rozie-toast').first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
    const box = await toast.boundingBox();
    if (!box) throw new Error('toast bounding box unavailable');

    // top-right corner → dismiss direction is RIGHT. Drag well past 45% of
    // the toast's own width (a generous 80% to comfortably clear the
    // threshold regardless of synthetic-event timing).
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.5;
    const endX = startX + box.width * 0.8;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX + ((endX - startX) * i) / 10, startY, { steps: 2 });
    }
    await page.mouse.up();

    await expect(page.locator('[role="status"]')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('dismissed-reason')).toHaveText('swipe', { timeout: 10_000 });
  });

  runner(`toaster [${target}]: a short drag springs back (toast still present)`, async ({
    page,
  }) => {
    await page.goto(`/?example=ToasterBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('show-toast').click();
    const toast = page.locator('.rozie-toast').first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
    const box = await toast.boundingBox();
    if (!box) throw new Error('toast bounding box unavailable');

    // A short drag — well under the 45% threshold — must spring back.
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.5;
    const endX = startX + box.width * 0.1;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX + ((endX - startX) * i) / 5, startY, { steps: 2 });
    }
    await page.mouse.up();

    await expect(page.locator('[role="status"]')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.getByTestId('dismissed-reason')).not.toHaveText('swipe');
  });

  runner(`toaster [${target}]: a drag starting on the close button does not swipe`, async ({
    page,
  }) => {
    await page.goto(`/?example=ToasterBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('show-toast').click();
    const closeButton = page.locator('.rozie-toast-close').first();
    await expect(closeButton).toBeVisible({ timeout: 15_000 });
    const box = await closeButton.boundingBox();
    if (!box) throw new Error('close button bounding box unavailable');

    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.5;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX + i * 20, startY, { steps: 2 });
    }
    await page.mouse.up();

    // The toast is still present (no swipe fired from a close-button-origin
    // drag) — a plain click on the SAME button (from Task 2's suite) is the
    // only thing that dismisses it.
    await expect(page.locator('[role="status"]')).toHaveCount(1, { timeout: 5_000 });
  });

  runner(`toaster [${target}]: disableSwipe makes all three pointer handlers inert`, async ({
    page,
  }) => {
    await page.goto(`/?example=ToasterBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('toggle-disable-swipe').click();
    await page.getByTestId('show-toast').click();
    const toast = page.locator('.rozie-toast').first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
    const box = await toast.boundingBox();
    if (!box) throw new Error('toast bounding box unavailable');

    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.5;
    const endX = startX + box.width * 0.9;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX + ((endX - startX) * i) / 10, startY, { steps: 2 });
    }
    await page.mouse.up();

    // disableSwipe=true: even a full-width drag never dismisses.
    await expect(page.locator('[role="status"]')).toHaveCount(1, { timeout: 5_000 });
  });
}

/**
 * Stacked mode (TOAST-STACK) — the opt-in collapsed depth-driven grid
 * overlay. `toggle-stacked` flips the `stacked` prop on the SAME
 * `ToasterBehaviorDemo` instance; `.rozie-toast` locators are DOM-order (=
 * `$data.toasts` array order, oldest first — corner-independent), so
 * `.nth(0)` is the OLDEST (depth 3, hidden when collapsed) and `.nth(3)` is
 * the NEWEST (depth 0, always visible).
 *
 * Proven GREEN ×6 only in the ONE batched Linux Docker VR run (Task 7).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  runner(`toaster [${target}]: stacked collapses to a depth-driven overlay (depth>=3 hidden) and expands on hover`, async ({
    page,
  }) => {
    await page.goto(`/?example=ToasterBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('toggle-stacked').click();
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('show-toast').click();
    }
    await expect(page.locator('[role="status"]')).toHaveCount(4, { timeout: 15_000 });

    // Collapsed (not hovered): the oldest (depth 3) toast is hidden.
    const oldest = page.locator('.rozie-toast').nth(0);
    const newest = page.locator('.rozie-toast').nth(3);
    await expect(oldest).toHaveCSS('opacity', '0');
    await expect(newest).toHaveCSS('opacity', '1');

    // Hover the region → expands to the flex column: every toast visible.
    await page.locator('.rozie-toaster').first().hover();
    await expect(oldest).toHaveCSS('opacity', '1');

    // Move away → re-collapses.
    await page.mouse.move(10, 10);
    await expect(oldest).toHaveCSS('opacity', '0');
  });

  runner(`toaster [${target}]: stacked:false (default) renders the plain flex column at all times`, async ({
    page,
  }) => {
    await page.goto(`/?example=ToasterBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await page.getByTestId('show-toast').click();
    }
    await expect(page.locator('[role="status"]')).toHaveCount(4, { timeout: 15_000 });

    // stacked is OFF (default) — every toast is visible, none hidden by depth.
    const oldest = page.locator('.rozie-toast').nth(0);
    await expect(oldest).toHaveCSS('opacity', '1');
  });
}
