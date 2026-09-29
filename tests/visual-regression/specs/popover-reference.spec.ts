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
 *   - outside click dismisses.
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
  });
}
