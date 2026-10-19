import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Dialog behavioral smoke — pure-Rozie modal on the native `<dialog>` +
 * `showModal()` (`Dialog`).
 *
 * `Dialog` is a pure-Rozie family (NO third-party engine): the PLATFORM is the
 * engine. `showModal()` gives the top-layer render, the native `::backdrop`, a
 * real focus trap, and Esc-to-dismiss (the native `cancel` event) for free. Rozie
 * owns the author-side API: the two-way `open` binding, the open↔native reconcile
 * (onMount + lazy `$watch`), and the close policy. This spec proves the controlled
 * `open` model + the Escape `cancel` close path + the consumer-driven close
 * produce identical behaviour across all 6 targets.
 *
 * `examples/demos/DialogBehaviorDemo.rozie` drives a two-way `r-model:open`
 * (live `readout-open` via `String($data.open)` so the boolean renders uniformly
 * on all six — React/Solid drop a bare boolean child), a `@close` reason readout
 * (`readout-reason`), an `open-dialog` button, and a consumer `close-dialog`
 * button (writes `open = false`).
 *
 * NATIVE-DIALOG NOTE: the `cancel` event only fires on a `showModal()`'d dialog,
 * and Escape must be dispatched while focus is inside it. After opening, the UA
 * focuses the dialog; `page.keyboard.press('Escape')` then drives the native
 * cancel. If a single target legitimately can't be driven this way it is gated via
 * KNOWN_FAILING with a documented reason (the slider precedent) — never broadly
 * skipped.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Runs locally on macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// No gated targets: the @close reason DOES propagate on all six (the earlier
// react gating was a flaky-focus diagnosis, not a real bug — native <dialog> only
// fires `cancel` on Escape when focus is inside it, and the keypress could race
// the UA's post-showModal focus on react/solid intermittently). Hardened in step 3
// by focusing an element inside the dialog before Escape. All six drive cleanly.
const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>([]);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`dialog [${target}]: opens via model, body visible in top layer, Escape closes (cancel→reason), consumer close writes open=false`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const open = page.getByTestId('readout-open');
    const reason = page.getByTestId('readout-reason');
    // The body testid pierces Lit's shadow root; `<dialog>:not([open])` is
    // display:none natively, so the body is in the DOM but hidden until opened.
    const body = page.getByTestId('dialog-body');

    // ---- 1. initial: closed → body hidden + readout-open 'false' ----
    await expect
      .poll(async () => (await open.textContent())?.trim() ?? '', {
        timeout: 15_000,
      })
      .toBe('false');
    await expect(body).toBeHidden();

    // ---- 2. open via the two-way model → top-layer body visible + readout 'true' ----
    await page.getByTestId('open-dialog').click();
    await expect
      .poll(async () => (await open.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('true');
    await expect(body).toBeVisible({ timeout: 10_000 });

    // ---- 3. Escape → native cancel → dialog closes (body hidden + open false) ----
    // Focus an element inside the dialog so Escape reaches the native <dialog>.
    // We assert only that Escape CLOSES the dialog here — the `@close` REASON
    // payload is asserted in step 4 via the programmatic hide() handle, a pure-JS
    // path that avoids the inherently racy native-Escape→cancel→handler timing
    // (which intermittently dropped the reason readout on react/solid). The reason
    // IS emitted on Escape on all six; it's just not a deterministic thing to poll.
    await page.getByTestId('close-dialog').focus();
    await page.keyboard.press('Escape');
    await expect(body).toBeHidden({ timeout: 10_000 });
    await expect
      .poll(async () => (await open.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('false');

    // ---- 4. reopen → programmatic hide() handle → @close reason 'programmatic' ----
    // Drives the $expose hide() verb via $refs (deterministic ×6), proving the
    // @close reason emit reaches the parent and the imperative handle works.
    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('hide-dialog').click();
    await expect
      .poll(async () => (await reason.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('programmatic');
    await expect(body).toBeHidden({ timeout: 10_000 });

    // ---- 5. reopen, then consumer close button writes open=false → body hidden ----
    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('close-dialog').click();
    await expect(body).toBeHidden({ timeout: 10_000 });
    await expect
      .poll(async () => (await open.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('false');
  });

  // oinbox feedback (Dialog 0.1.3): a Dialog removed by an r-if / <Show> while
  // `open` is still true never saw `open` go false, so it kept the <html> scroll
  // lock and never returned focus (keyboard users landed on <body>). The
  // removable dialog also exercises `initialFocus` (a selector into slotted
  // content, which on Lit is light DOM the panel's querySelector cannot see).
  runner(`dialog [${target}]: initialFocus focuses the selected field; unmounted while open, it releases the scroll lock and returns focus`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const overflow = () => page.evaluate(() => document.documentElement.style.overflow);
    expect(await overflow()).toBe('');

    const opener = page.getByTestId('open-removable');
    await opener.click();
    const second = page.getByTestId('removable-second');
    await expect(second).toBeVisible({ timeout: 10_000 });
    await expect(second).toBeFocused({ timeout: 10_000 });
    await expect.poll(overflow, { timeout: 10_000 }).toBe('hidden');

    await page.getByTestId('remove-dialog').click();
    await expect(second).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(overflow, { timeout: 10_000 }).toBe('');
    await expect(opener).toBeFocused({ timeout: 10_000 });

    // The page is usable again: the other dialog still opens and locks.
    await page.getByTestId('open-dialog').click();
    await expect(page.getByTestId('dialog-body')).toBeVisible({ timeout: 10_000 });
    await expect.poll(overflow, { timeout: 10_000 }).toBe('hidden');
  });

  // ---- Surface coverage (quick 261018-vdu): every close path, every opt-out, ----
  // ---- the verbs, the a11y wiring, and the interplay with a nested Popover.   ----
  const text = async (loc: import('@playwright/test').Locator) => (await loc.textContent())?.trim() ?? '';
  const settle = (page: import('@playwright/test').Page) => page.waitForTimeout(350);

  runner(`dialog [${target}]: backdrop click closes with reason 'backdrop'; Escape closes with reason 'escape'; a click inside the panel does not close`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const body = page.getByTestId('dialog-body');
    const reason = page.getByTestId('readout-reason');
    const count = page.getByTestId('readout-close-count');

    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });

    // A click on the panel content is NOT a backdrop click.
    await body.click();
    await settle(page);
    await expect(body).toBeVisible();
    expect(await text(count)).toBe('0');

    // A click on the scrim (the <dialog> box itself) closes with 'backdrop'.
    await page.mouse.click(5, 5);
    await expect(body).toBeHidden({ timeout: 10_000 });
    await expect.poll(() => text(reason), { timeout: 10_000 }).toBe('backdrop');
    expect(await text(count)).toBe('1');

    // Escape (focus inside the modal) closes with 'escape'.
    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('close-dialog').focus();
    await page.keyboard.press('Escape');
    await expect(body).toBeHidden({ timeout: 10_000 });
    await expect.poll(() => text(reason), { timeout: 10_000 }).toBe('escape');
    expect(await text(count)).toBe('2');
  });

  runner(`dialog [${target}]: disableBackdropClose / disableEscapeClose keep the dialog open`, async ({ page }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const body = page.getByTestId('dialog-body');
    const reason = page.getByTestId('readout-reason');
    const count = page.getByTestId('readout-close-count');

    // disableBackdropClose: the scrim click is ignored, Escape still closes.
    await page.getByTestId('toggle-no-backdrop').click();
    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await page.mouse.click(5, 5);
    await settle(page);
    await expect(body).toBeVisible();
    expect(await text(count)).toBe('0');
    await page.getByTestId('close-dialog').focus();
    await page.keyboard.press('Escape');
    await expect(body).toBeHidden({ timeout: 10_000 });
    await expect.poll(() => text(reason), { timeout: 10_000 }).toBe('escape');

    // disableEscapeClose: Escape is ignored, the scrim click closes.
    await page.getByTestId('toggle-no-backdrop').click(); // back to default
    await page.getByTestId('toggle-no-escape').click();
    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('close-dialog').focus();
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(body).toBeVisible();
    expect(await text(count)).toBe('1');
    await page.mouse.click(5, 5);
    await expect(body).toBeHidden({ timeout: 10_000 });
    await expect.poll(() => text(reason), { timeout: 10_000 }).toBe('backdrop');
  });

  runner(`dialog [${target}]: disableScrollLock leaves <html> scrollable while open`, async ({ page }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const overflow = () => page.evaluate(() => document.documentElement.style.overflow);
    const body = page.getByTestId('dialog-body');

    await page.getByTestId('toggle-no-lock').click();
    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await settle(page);
    expect(await overflow()).toBe('');
    await page.getByTestId('close-dialog').click();
    await expect(body).toBeHidden({ timeout: 10_000 });

    await page.getByTestId('toggle-no-lock').click(); // back to the default (locking)
    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await expect.poll(overflow, { timeout: 10_000 }).toBe('hidden');
    await page.getByTestId('close-dialog').click();
    await expect.poll(overflow, { timeout: 10_000 }).toBe('');
  });

  // A press that STARTS inside the panel (selecting text, a drag) and is released
  // over the scrim produces a `click` whose target is the common ancestor — the
  // <dialog> itself. It must not be treated as a backdrop click.
  runner(`dialog [${target}]: a press that starts inside the panel and ends on the scrim does not close it`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const body = page.getByTestId('dialog-body');
    const count = page.getByTestId('readout-close-count');

    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    const box = await body.boundingBox();
    await page.mouse.move(box!.x + 5, box!.y + 5);
    await page.mouse.down();
    await page.mouse.move(5, 5, { steps: 6 });
    await page.mouse.up();
    await settle(page);
    await expect(body).toBeVisible();
    expect(await text(count)).toBe('0');

    // ...and a genuine scrim click afterwards still closes it.
    await page.mouse.click(5, 5);
    await expect(body).toBeHidden({ timeout: 10_000 });
    expect(await text(count)).toBe('1');
  });

  // A native close that does not go through the component's close funnel (a
  // <form method="dialog"> inside the panel) must bring the `open` model along,
  // report a `close`, and leave the dialog re-openable.
  runner(`dialog [${target}]: a native <form method="dialog"> close resyncs the open model and the dialog can reopen`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const body = page.getByTestId('dialog-body');
    const open = page.getByTestId('readout-open');
    const reason = page.getByTestId('readout-reason');
    const count = page.getByTestId('readout-close-count');

    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    if (target === 'lit') {
      // On Lit the <dialog> sits in the element's shadow root and the slotted <form> is
      // light DOM: a form closes its nearest ANCESTOR dialog in the DOM tree, so the
      // submit has no dialog to close (a platform limit). Close the native dialog directly
      // instead, which is the same unrouted native close.
      await page.locator('dialog[aria-label="Demo dialog"]').evaluate((d) => (d as HTMLDialogElement).close());
    } else {
      await page.getByTestId('form-close').click();
    }
    await expect(body).toBeHidden({ timeout: 10_000 });
    await expect.poll(() => text(open), { timeout: 10_000 }).toBe('false');
    await expect.poll(() => text(reason), { timeout: 10_000 }).toBe('programmatic');
    expect(await text(count)).toBe('1');

    await page.getByTestId('open-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => text(open), { timeout: 10_000 }).toBe('true');
  });

  runner(`dialog [${target}]: show() opens through the handle; hide() on a closed dialog is a no-op (no phantom close)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const body = page.getByTestId('dialog-body');
    const reason = page.getByTestId('readout-reason');
    const count = page.getByTestId('readout-close-count');

    await page.getByTestId('hide-closed').click();
    await settle(page);
    expect(await text(count)).toBe('0');
    expect(await text(reason)).toBe('');

    await page.getByTestId('show-dialog').click();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => text(page.getByTestId('readout-open')), { timeout: 10_000 }).toBe('true');
  });

  runner(`dialog [${target}]: ariaLabel / ariaLabelledby reach the <dialog> (and give it an accessible name); a null one is dropped`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // ariaLabel only: aria-label present, aria-labelledby absent.
    const labelled = page.locator('dialog[aria-label="Demo dialog"]');
    await expect(labelled).toHaveCount(1);
    await expect(labelled).not.toHaveAttribute('aria-labelledby', /.*/);

    // ariaLabelledby only: aria-labelledby present, aria-label absent.
    const titled = page.locator('dialog[aria-labelledby="titled-heading"]');
    await expect(titled).toHaveCount(1);
    await expect(titled).not.toHaveAttribute('aria-label', /.*/);

    // The accessible name comes out of the browser's own accessibility tree.
    await page.getByTestId('open-titled').click();
    await expect(page.getByTestId('titled-heading')).toBeVisible({ timeout: 10_000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Accessibility.enable');
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const names = nodes
      .filter((n: any) => n.role?.value === 'dialog' && !n.ignored)
      .map((n: any) => n.name?.value);
    expect(names).toContain('Titled dialog');
  });

  runner(`dialog [${target}]: initialFocus accepts an Element; focus returns to the opener on a normal close`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('open-focus-el').click();
    await expect(page.getByTestId('focus-target')).toBeFocused({ timeout: 10_000 });
    await page.getByTestId('close-focus').click();
    await expect(page.getByTestId('focus-target')).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId('open-focus-el')).toBeFocused({ timeout: 10_000 });

    const opener = page.getByTestId('open-dialog');
    await opener.click();
    await expect(page.getByTestId('dialog-body')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('close-dialog').click();
    await expect(page.getByTestId('dialog-body')).toBeHidden({ timeout: 10_000 });
    await expect(opener).toBeFocused({ timeout: 10_000 });
  });

  // Interplay: a Popover placed inside the modal. showModal() promotes the dialog to
  // the top layer; the popover panel lives in the dialog's subtree, so it must paint
  // above the scrim and receive pointer events (a trial click proves the hit target).
  runner(`dialog [${target}]: a Popover opened inside the modal is painted above the scrim and hit-testable`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await page.getByTestId('open-dialog').click();
    await expect(page.getByTestId('dialog-body')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('dlg-popover-anchor').click();
    const content = page.getByTestId('dlg-popover-content');
    await expect(content).toBeVisible({ timeout: 10_000 });
    await content.click({ trial: true, timeout: 5_000 });
    // The dialog is still open (the popover did not close it).
    await expect(page.getByTestId('dialog-body')).toBeVisible();
  });
}
