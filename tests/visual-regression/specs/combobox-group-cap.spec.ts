import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Combobox per-group cap behavioral smoke (combobox-group-cap) — proves the
 * new opt-in `groupCap` prop caps each native section to its first `groupCap`
 * options, adding a keyboard-reachable "+N more" row that expands that
 * section IN PLACE when activated (never writing the value model or firing
 * `change`), while the flat activeIndex/aria-activedescendant keyboard model
 * (ArrowDown/Enter) walks the more-row and, once expanded, the newly-revealed
 * options, on all 6 targets.
 *
 * `examples/demos/ComboboxGroupCapDemo.rozie` seeds a 6-option list — 4
 * "Fruit" options (Apple, Banana, Cherry, Date) then 2 "Vegetable" options
 * (Carrot, Potato) — with `:groups="[...]" :group-cap="2"`, a two-way
 * `r-model:value` (live `readout-value`), and
 * `idBase="demo-combobox-group-cap"`.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only —
 * no `toHaveScreenshot`. Mirrors combobox-groups.spec.ts (Lit shadow-piercing
 * role locators).
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
  runner(`combobox-group-cap [${target}]: focus opens Fruit capped to 2 options + a "2 more" row, Veg (at cap) shows no more-row, ArrowDown roves onto the more-row, Enter expands Fruit in place with no value change, and a real selection still commits`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxGroupCap&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const value = page.getByTestId('readout-value');
    await expect(value).toHaveText('');

    // ---- 1. focus opens the popup → Fruit capped to 2 options + a more-row,
    //         Veg (2 options, at the cap) has no more-row. ----
    await input.focus();
    const groups = page.locator('[role="group"]');
    await expect(groups).toHaveCount(2);

    const fruitGroup = groups.nth(0);
    const vegGroup = groups.nth(1);
    await expect(fruitGroup).toHaveAttribute('aria-label', 'Fruit');
    await expect(vegGroup).toHaveAttribute('aria-label', 'Vegetable');

    const fruitOptions = fruitGroup.locator('[role="option"]:not(.rozie-combobox-more)');
    await expect
      .poll(async () => fruitOptions.count(), { timeout: 15_000 })
      .toBe(2);
    await expect(fruitOptions.nth(0)).toContainText('Apple');
    await expect(fruitOptions.nth(1)).toContainText('Banana');

    const moreRow = fruitGroup.locator('.rozie-combobox-more');
    await expect(moreRow).toHaveCount(1);
    await expect(moreRow).toContainText('2 more');

    const vegOptions = vegGroup.locator('[role="option"]');
    await expect(vegOptions).toHaveCount(2);
    await expect(vegGroup.locator('.rozie-combobox-more')).toHaveCount(0);

    // ---- 2. ArrowDown roves onto the more-row (Apple → Banana → more-row).
    //         aria-activedescendant always resolves to a RENDERED row id. ----
    await page.keyboard.press('ArrowDown'); // Apple
    await page.keyboard.press('ArrowDown'); // Banana
    await page.keyboard.press('ArrowDown'); // the "+2 more" row
    const moreRowId = await moreRow.getAttribute('id');
    expect(moreRowId).toBeTruthy();
    await expect(input).toHaveAttribute('aria-activedescendant', moreRowId!, {
      timeout: 10_000,
    });

    // ---- 3. Enter on the more-row expands Fruit in place — NO value change,
    //         all 4 Fruit options now render, the more-row is gone. ----
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => fruitGroup.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(4);
    await expect(fruitGroup.locator('.rozie-combobox-more')).toHaveCount(0);
    await expect(value).toHaveText('');

    // ---- 4. A real selection still round-trips the value + closes the popup
    //         (closeOnSelect default true). ----
    const dateOption = fruitGroup.locator('[role="option"]', { hasText: 'Date' });
    await dateOption.click();
    await expect
      .poll(async () => (await value.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('date');
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(0);
  });
}
