import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * NumberField behavioral smoke — pure-Rozie WAI-ARIA numeric stepper (`NumberField`).
 *
 * `NumberField` is a pure-Rozie family (NO third-party engine): the PLATFORM is the
 * engine — a native `<input role="spinbutton">` + two stepper buttons, browser
 * focus, and `Intl.NumberFormat`. Rozie owns the author-side API: the two-way
 * `modelValue` (number | null), clamp/snap math, the keyboard choreography
 * (Arrow/Page/Home/End), and press-hold acceleration. This spec proves the
 * controlled numeric primitive behaves identically across all 6 targets.
 *
 * `examples/demos/NumberFieldBehaviorDemo.rozie` drives a field seeded at 5 with
 * min=0 / max=10 / step=1, a two-way `r-model:modelValue` (live `readout-value` +
 * `readout-change`), and a `set-qty` direct-model-write button (→ 8).
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot` (the pixel cell is NumberFieldScreenshot in matrix.spec.ts).
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
  runner(`number-field [${target}]: steppers + arrows change value, Home/End + clamp at bounds, set-qty writes`, async ({
    page,
  }) => {
    await page.goto(`/?example=NumberFieldBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const value = page.getByTestId('readout-value');
    const change = page.getByTestId('readout-change');
    // role="spinbutton" pierces Lit shadow.
    const input = page.locator('input[role="spinbutton"]').first();
    const inc = page.getByRole('button', { name: 'Increment' });
    const dec = page.getByRole('button', { name: 'Decrement' });

    // ---- 1. seeded at 5 ----
    await expect(input).toBeVisible({ timeout: 15_000 });
    await expect(value).toHaveText('5');

    // ---- 2. increment button: 5 → 6, change fires ----
    await inc.click();
    await expect(value).toHaveText('6', { timeout: 10_000 });
    await expect(change).toHaveText('6');

    // ---- 3. decrement button: 6 → 5 ----
    await dec.click();
    await expect(value).toHaveText('5', { timeout: 10_000 });

    // ---- 4. ArrowUp / ArrowDown on the spinbutton step by `step` ----
    await input.click();
    await input.press('ArrowUp');
    await expect(value).toHaveText('6', { timeout: 10_000 });
    await input.press('ArrowDown');
    await expect(value).toHaveText('5', { timeout: 10_000 });

    // ---- 5. End jumps to max (10); a further increment CLAMPS at 10 ----
    await input.press('End');
    await expect(value).toHaveText('10', { timeout: 10_000 });
    await inc.click();
    await expect(value).toHaveText('10');

    // ---- 6. Home jumps to min (0); a further decrement CLAMPS at 0 ----
    await input.press('Home');
    await expect(value).toHaveText('0', { timeout: 10_000 });
    await dec.click();
    await expect(value).toHaveText('0');

    // ---- 7. set-qty direct-model write (→ 8) reflects ----
    await page.getByTestId('set-qty').click();
    await expect(value).toHaveText('8', { timeout: 10_000 });
  });
}
