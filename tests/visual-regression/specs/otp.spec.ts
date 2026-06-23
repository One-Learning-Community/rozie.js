import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * OTP behavioral smoke — pure-Rozie WAI-ARIA one-time-code input (`Otp`).
 *
 * `Otp` is a pure-Rozie family (NO third-party engine): the PLATFORM is the
 * engine — N native `<input>` cells, browser focus, and keyboard come for free.
 * Rozie owns the author-side API: the two-way `value` binding, the sanitize/
 * distribute logic, and the `@complete` emit when every cell is filled. This spec
 * proves the controlled segmented-input primitive (single `value` model →
 * `cells()` derived view, `commitValue` write funnel, `@complete`) produces
 * identical behaviour across all 6 targets.
 *
 * `examples/demos/OtpBehaviorDemo.rozie` drives a 6-cell numeric OTP, a two-way
 * `r-model:value` (live `readout-code`), a `set-code` direct-model-write button
 * (→ '123'), and a `@complete` readout (`readout-complete`).
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Like slider.spec.ts / listbox.spec.ts, this runs locally on
 * macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`otp [${target}]: 6 cells render, typing reflects into value, set-code writes, completing fires @complete`, async ({
    page,
  }) => {
    await page.goto(`/?example=OtpBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // ---- 1. six native input cells render (the CSS locator pierces Lit shadow) ----
    const cells = page.locator('input');
    await expect(cells.first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => cells.count(), { timeout: 15_000 })
      .toBe(6);

    const code = page.getByTestId('readout-code');
    const complete = page.getByTestId('readout-complete');
    await expect(code).toHaveText('');
    await expect(complete).toHaveText('');

    // ---- 2. type a digit into the first cell → readout-code reflects it ----
    await cells.nth(0).fill('9');
    await expect
      .poll(async () => (await code.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('9');

    // ---- 3. set-code direct-model write (→ '123') reflects into cells + readout ----
    await page.getByTestId('set-code').click();
    await expect
      .poll(async () => (await code.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('123');
    await expect(cells.nth(0)).toHaveValue('1');
    await expect(cells.nth(1)).toHaveValue('2');
    await expect(cells.nth(2)).toHaveValue('3');

    // ---- 4. type the rest to reach length 6 → @complete fires with the full code ----
    await cells.nth(3).fill('4');
    await cells.nth(4).fill('5');
    await cells.nth(5).fill('6');
    await expect
      .poll(async () => (await code.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('123456');
    await expect
      .poll(async () => (await complete.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('123456');
  });
}
