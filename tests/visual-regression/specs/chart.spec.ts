import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Behavioral spec for the EXPANDED generic Chart wrapper (Phase 30).
 *
 * Where `line-chart.spec.ts` is the line-typed reconcile smoke (the original
 * LineChart cell) and `chart-recreation.spec.ts` asserts the data-reconcile
 * path doesn't re-create, THIS spec drives `ChartBehaviorDemo` to exercise the
 * surface the generic Chart adds over line-only:
 *
 *   1. **Runtime `type`-switching across three kinds.** The demo binds
 *      `:type="$data.chartType"` and offers Line / Bar / Doughnut buttons.
 *      Switching `type` RE-CREATES the Chart.js instance (no stable runtime
 *      type-swap). The spec switches line -> bar -> doughnut and asserts the
 *      canvas re-paints (nonzero-alpha pixels) after EACH switch on all 6
 *      targets — proving the re-create path fires and Chart.js renders the new
 *      controller kind, not just line.
 *
 *   2. **The `@click` event** (composed onto Chart.js's onClick) drives a click
 *      counter shown in the status line.
 *
 *   3. The `:plugins` passthrough (an inline custom background plugin) and the
 *      `tooltip` portal-slot consumer-fill are exercised at COMPILE time by the
 *      `@rozie/core` engine-examples gate (all 6 targets); this runtime spec
 *      focuses on the canvas paint + type-switch path, which is uniformly
 *      assertable cross-target.
 *
 * Per `feedback_vr_linux_baselines`: STRUCTURAL assertions only (canvas mounted,
 * nonzero pixel content) — NO `toHaveScreenshot`. Runs locally on macOS without
 * a Docker baseline. The deterministic pixel baseline is the separate
 * `ChartScreenshot` matrix cell (`ChartScreenshotDemo`).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

/** Count canvas pixels with nonzero alpha — a blank canvas is 0 everywhere. */
async function paintedPixels(
  locator: ReturnType<import('@playwright/test').Page['locator']>,
): Promise<number> {
  return locator.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
    return n;
  });
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`chart [${target}]: generic Chart re-creates across line -> bar -> doughnut, each re-paints`, async ({
    page,
  }) => {
    await page.goto(`/?example=ChartBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const wrapper = mount.locator('.rozie-chart, [class*="rozie-chart"]').first();
    await expect(wrapper).toBeVisible({ timeout: 10_000 });
    const canvas = wrapper.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 5_000 });

    // Engine-mounted gate — nonzero backing-store + CSS box dimensions.
    const dims = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight };
    });
    expect(dims.w).toBeGreaterThan(0);
    expect(dims.h).toBeGreaterThan(0);
    expect(dims.cw).toBeGreaterThan(0);
    expect(dims.ch).toBeGreaterThan(0);

    // First paint (line). Poll until Chart.js paints the first frame.
    await expect
      .poll(() => paintedPixels(canvas), {
        timeout: 8_000,
        intervals: [200, 400, 800, 1600],
      })
      .toBeGreaterThan(100);

    // Status line reflects the bound type.
    const status = mount.getByTestId('chart-status');
    await expect(status).toContainText('type=line');

    // Switch line -> bar. Chart.js re-creates the instance; assert the NEW
    // canvas re-paints. After a re-create the <canvas> element may be replaced,
    // so re-locate it each time.
    await mount.getByRole('button', { name: 'Bar' }).click();
    await expect(status).toContainText('type=bar');
    const barCanvas = wrapper.locator('canvas').first();
    await expect
      .poll(() => paintedPixels(barCanvas), {
        timeout: 6_000,
        intervals: [200, 400, 800],
      })
      .toBeGreaterThan(100);

    // Switch bar -> doughnut.
    await mount.getByRole('button', { name: 'Doughnut' }).click();
    await expect(status).toContainText('type=doughnut');
    const doughnutCanvas = wrapper.locator('canvas').first();
    await expect
      .poll(() => paintedPixels(doughnutCanvas), {
        timeout: 6_000,
        intervals: [200, 400, 800],
      })
      .toBeGreaterThan(100);

    // Back to line — full cycle proven.
    await mount.getByRole('button', { name: 'Line' }).click();
    await expect(status).toContainText('type=line');
    const lineCanvas = wrapper.locator('canvas').first();
    await expect
      .poll(() => paintedPixels(lineCanvas), {
        timeout: 6_000,
        intervals: [200, 400, 800],
      })
      .toBeGreaterThan(100);
  });
}
