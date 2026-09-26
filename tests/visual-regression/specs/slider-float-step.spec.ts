import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Slider float-`step` rounding — `clampStep` (packages/ui/slider/src/Slider.rozie).
 *
 * `min=0`, `step=0.1`: three commits land on the third step. Exact math is
 * `0 + 3 * 0.1`; in IEEE-754 double precision that's `0.30000000000000004`,
 * not `0.3`. Pre-fix, `clampStep` wrote that raw float straight into the
 * model — this spec asserts the two-way `value` readout AND `aria-valuetext`
 * (via the demo's `formatValue={(v) => String(v)}`, which turns the float
 * artifact into a visible string) both report the CLEAN decimal `0.3`.
 *
 * `examples/demos/SliderFloatStepDemo.rozie` exposes an `increment()`-driving
 * button (`increment-1`, calling the `$expose` handle once per click) — a
 * deterministic, target-uniform commit path (vs. simulating a native pointer
 * drag or key sequence per target). The spec clicks it three times, polling
 * the readout between clicks (a model write is ASYNC on React-shaped targets,
 * so three back-to-back calls in one handler would all read the same stale
 * value instead of accumulating — ROZ138).
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Runs locally on macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>([]);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`slider [${target}]: three 0.1 steps from 0 land on a clean 0.3, not a float artifact`, async ({
    page,
  }) => {
    await page.goto(`/?example=SliderFloatStep&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const readout = page.getByTestId('readout-value');
    const increment = page.getByTestId('increment-1');

    // Click three times, waiting for EACH write to land before the next click —
    // a model write is async on React-shaped targets (ROZ138), so clicking
    // without waiting could fire all three against the same stale value.
    await increment.click();
    await expect.poll(async () => (await readout.textContent())?.trim() ?? '', { timeout: 10_000 }).toBe('0.1');
    await increment.click();
    await expect.poll(async () => (await readout.textContent())?.trim() ?? '', { timeout: 10_000 }).toBe('0.2');
    await increment.click();

    // ---- the two-way model value ----
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('0.3');

    // ---- aria-valuetext (via formatValue={(v) => String(v)}) ----
    const slider = page.getByRole('slider').first();
    await expect
      .poll(async () => slider.evaluate((el) => el.getAttribute('aria-valuetext')), {
        timeout: 10_000,
      })
      .toBe('0.3');
  });
}
