import { test, expect, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Popover `reference` prop — behavioral + DOM-geometry proof (260929-lyc).
 *
 * `examples/demos/PopoverReferenceDemo.rozie` drives a `trigger="manual"` Popover
 * with an EMPTY anchor slot whose `reference` prop points first at an EXTERNAL
 * element the demo owns (`external-anchor`) and then at a Floating UI VIRTUAL
 * element (a zero-size point at viewport 640,420). The spec asserts:
 *
 *   - POP-REF-1: with placement bottom + offset 8 the panel top sits ~8px below
 *     the external element's bottom and is horizontally centered on it (the
 *     internal `.rozie-popover-anchor` wrapper plays no part);
 *   - POP-REF-2: repointing `reference` to the virtual element WHILE OPEN
 *     repositions the panel at that rect (autoUpdate restarted);
 *   - outside click dismisses;
 *   - POP-REF-3: while open with an Element reference, a click on that element is
 *     NOT an outside click, so the consumer's toggle on it CLOSES the panel
 *     (instead of dismiss-then-reopen); with a VIRTUAL reference only the anchor
 *     wrapper + panel are inside, so a click elsewhere dismisses;
 *   - POP-REF-4 (release-0.8.0 audit A1): a click on an opener OUTSIDE the panel
 *     and the anchor (`open-at-point`, virtual reference) opens the panel and the
 *     opening click does not self-dismiss it;
 *   - POP-REF-5 (audit A2): with the panel open on the first element, a click on
 *     a SECOND element using the move-or-toggle recipe MOVES the panel there.
 *     Popover decides the outside dismissal after the click's handlers ran,
 *     against the then-current reference (Angular used to close here while the
 *     parent still held `open = true`);
 *   - POP-REF-6 (audit B1): the panel id is `<idBase>-panel` (`ref-demo-panel`);
 *   - POP-REF-7 (audit B5): Escape with focus INSIDE the panel returns focus to
 *     the element focused when it opened (the external trigger);
 *   - POP-REF-8 (audit B5): a click into another input dismisses without
 *     pulling focus back to the trigger;
 *   - POP-REF-9 (audit B3): a placement change while open survives the next
 *     scroll-driven autoUpdate (React used to revert to the old closure);
 *   - POP-REF-10: `reference = null` while open falls back to the anchor
 *     wrapper without errors;
 *   - POP-REF-11 (audit B2): a referenced Element removed from the document
 *     closes the panel;
 *   - no uncaught page errors throughout.
 *
 * Per `feedback_vr_linux_baselines`: DOM-geometry/behavioral assertions only — no
 * `toHaveScreenshot`, so there are no PNG baselines.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
const OFFSET = 8;
const TOLERANCE = 2;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return box;
}

/** Panel geometry relative to a reference rect (placement bottom). */
function placementDelta(panel: Box, ref: { bottom: number; centerX: number }) {
  return {
    top: panel.y - (ref.bottom + OFFSET),
    centerX: panel.x + panel.width / 2 - ref.centerX,
  };
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`popover reference [${target}]: positions against an external element and a virtual element`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    await page.goto(`/?example=PopoverReference&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const value = page.getByTestId('readout-value');
    const external = page.getByTestId('external-anchor');
    // The r-if-gated floating panel is the open/closed signal (see popover.spec.ts
    // for why the class locator, not the slotted content testid).
    const panel = page.locator('.rozie-popover-floating');
    const heading = page.getByRole('heading', { name: 'Popover external reference' });

    // ---- 1. seeded closed ----
    await expect(external).toBeVisible({ timeout: 15_000 });
    await expect(value).toHaveText('closed');
    await expect(panel).toHaveCount(0);

    // ---- 2. external click sets the reference + opens ----
    await external.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(value).toHaveText('open');

    // ---- 3. POP-REF-1: positioned against the EXTERNAL element ----
    const extBox = await boxOf(external);
    const extRef = { bottom: extBox.y + extBox.height, centerX: extBox.x + extBox.width / 2 };
    await expect
      .poll(async () => {
        const d = placementDelta(await boxOf(panel), extRef);
        return Math.abs(d.top) <= TOLERANCE && Math.abs(d.centerX) <= TOLERANCE
          ? 'ok'
          : `top Δ ${d.top.toFixed(1)}, centerX Δ ${d.centerX.toFixed(1)}`;
      }, { timeout: 10_000 })
      .toBe('ok');

    // ---- 4. POP-REF-2: repoint to the VIRTUAL element while open (click is
    //         INSIDE the panel, so it does not dismiss) ----
    await page.getByTestId('move-to-point').click();
    await expect(panel).toBeVisible();
    const pointRef = { bottom: 420, centerX: 640 };
    await expect
      .poll(async () => {
        const d = placementDelta(await boxOf(panel), pointRef);
        return Math.abs(d.top) <= TOLERANCE && Math.abs(d.centerX) <= TOLERANCE
          ? 'ok'
          : `top Δ ${d.top.toFixed(1)}, centerX Δ ${d.centerX.toFixed(1)}`;
      }, { timeout: 10_000 })
      .toBe('ok');

    // ---- 5. outside click dismisses ----
    await heading.click();
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(value).toHaveText('closed');

    // ---- 6. POP-REF-3: consumer toggle on the referenced Element CLOSES ----
    await external.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await external.click();
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(value).toHaveText('closed');

    // ---- 7. a VIRTUAL reference adds no inside region: an outside click dismisses ----
    await external.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('move-to-point').click();
    await expect(panel).toBeVisible();
    await heading.click();
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(value).toHaveText('closed');

    // ---- 8. POP-REF-4: opening from OUTSIDE (virtual reference) stays open ----
    await page.getByTestId('open-at-point').click();
    await expect(value).toHaveText('open');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    // Give a late self-dismissal (deferred listener attach, effect flush) time to land.
    await page.waitForTimeout(300);
    await expect(panel).toBeVisible();
    await expect(value).toHaveText('open');
    await heading.click();
    await expect(panel).toHaveCount(0, { timeout: 10_000 });

    // ---- 9. POP-REF-5: open on the first element, click the second → panel MOVES ----
    await external.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    const second = page.getByTestId('external-anchor-2');
    await second.click();
    await page.waitForTimeout(300);
    await expect(value).toHaveText('open');
    await expect(panel).toBeVisible();
    const secBox = await boxOf(second);
    const secRef = { bottom: secBox.y + secBox.height, centerX: secBox.x + secBox.width / 2 };
    await expect
      .poll(async () => {
        const d = placementDelta(await boxOf(panel), secRef);
        return Math.abs(d.top) <= TOLERANCE && Math.abs(d.centerX) <= TOLERANCE
          ? 'ok'
          : `top Δ ${d.top.toFixed(1)}, centerX Δ ${d.centerX.toFixed(1)}`;
      }, { timeout: 10_000 })
      .toBe('ok');
    // ...and the second element now counts as inside: its toggle closes.
    await second.click();
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(value).toHaveText('closed');

    // ---- 10. POP-REF-6: per-instance panel id ----
    await external.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel).toHaveAttribute('id', 'ref-demo-panel');

    // ---- 11. POP-REF-7: Escape from inside the panel restores focus ----
    await page.getByTestId('move-to-point').focus();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(external).toBeFocused();

    // ---- 12. POP-REF-8: clicking into another input never steals focus back ----
    await external.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    const otherInput = page.getByTestId('other-input');
    await otherInput.click();
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(otherInput).toBeFocused();

    // ---- 13. POP-REF-9: placement change survives the next scroll update ----
    await external.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('place-top').click();
    const panelAboveExternal = async () => {
      const p = await boxOf(panel);
      const e = await boxOf(external);
      const gap = e.y - (p.y + p.height);
      return Math.abs(gap - OFFSET) <= TOLERANCE ? 'ok' : `gap ${gap.toFixed(1)}`;
    };
    await expect.poll(panelAboveExternal, { timeout: 10_000 }).toBe('ok');
    await page.evaluate(() => window.scrollBy(0, 40));
    await page.waitForTimeout(300);
    await expect.poll(panelAboveExternal, { timeout: 10_000 }).toBe('ok');

    // ---- 14. POP-REF-10: reference = null while open → the anchor wrapper ----
    await page.getByTestId('clear-reference').click();
    await expect(panel).toBeVisible();
    await expect(value).toHaveText('open');

    // ---- 15. POP-REF-11: a detached reference closes the panel ----
    await page.getByTestId('use-temp-target').click();
    await expect(panel).toBeVisible();
    await page.getByTestId('remove-temp-target').click();
    await expect(page.getByTestId('temp-target')).toHaveCount(0);
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(value).toHaveText('closed');

    expect(pageErrors).toEqual([]);
  });
}
