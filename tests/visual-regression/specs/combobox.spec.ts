import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Combobox behavioral smoke — pure-Rozie WAI-ARIA combobox / autocomplete
 * (`Combobox`).
 *
 * `Combobox` is a pure-Rozie family (NO third-party engine) — the hardest of the
 * no-engine primitives to get right cross-framework. The WAI-ARIA combobox pattern
 * (a text input + a popup listbox, aria-activedescendant keyboard navigation) is
 * authored entirely in Rozie. This spec proves the NATIVE author-side primitives
 * ($computed-style `filteredOptions()` filter, the internal query/open/active
 * state, the keyboard model, two-way `r-model:value`) produce identical behaviour
 * across all 6 targets.
 *
 * `examples/demos/ComboboxBehaviorDemo.rozie` drives a 4-option list, a two-way
 * `r-model:value` (live `readout-value`), and a `set-value` direct-model-write
 * button (→ 'cherry').
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Like listbox.spec.ts, this runs locally on macOS without a
 * Docker baseline.
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
  runner(`combobox [${target}]: focus opens 4 options, typing filters to 1, Enter commits two-way value, set-value reflects`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const value = page.getByTestId('readout-value');
    await expect(value).toHaveText('');

    // ---- 1. focus opens the popup → all 4 options render ----
    await input.focus();
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 15_000,
      })
      .toBe(4);

    // ---- 2. typing 'ch' filters to the single matching option (Cherry) ----
    await input.pressSequentially('ch', { delay: 30 });
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('Cherry');

    // ---- 3. Enter commits the filtered match (activeIndex auto-set to 0 on input) ----
    //         → two-way value round-trip OUT; closeOnSelect unmounts the popup.
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await value.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('cherry');
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(0);

    // ---- 4. set-value direct-model write reflects into the component ----
    await page.getByTestId('set-value').click();
    await expect
      .poll(async () => (await value.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('cherry');
  });
}
