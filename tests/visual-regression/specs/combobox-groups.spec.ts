import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Combobox native-groups behavioral smoke (combobox-native-groups) — proves the
 * new opt-in `groups` prop restructures the popup listbox into semantic
 * `role="group"` sections with `aria-label` headings, while the flat
 * activeIndex/aria-activedescendant keyboard model (ArrowDown/Enter) walks the
 * group-ordered sequence and never lands on a heading, on all 6 targets.
 *
 * `examples/demos/ComboboxGroupsDemo.rozie` seeds a 5-option list — 3 "Fruit"
 * options (Apple, Banana, Cherry) then 2 "Vegetable" options (Carrot, Potato)
 * — with `:groups="[{ id:'fruit', label:'Fruit' }, { id:'veg', label:'Vegetable' }]"`,
 * a two-way `r-model:value` (live `readout-value`), and `idBase="demo-combobox-groups"`.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Mirrors combobox.spec.ts (Lit shadow-piercing role locators).
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
  runner(`combobox-groups [${target}]: focus opens 2 role=group sections with aria-label headings, options render in group order, ArrowDown skips headings, Enter commits the active option`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxGroups&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const value = page.getByTestId('readout-value');
    await expect(value).toHaveText('');

    // ---- 1. focus opens the popup → all 5 options render across 2 groups ----
    await input.focus();
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 15_000,
      })
      .toBe(5);

    const groups = page.locator('[role="group"]');
    await expect(groups).toHaveCount(2);

    // ---- 2. each group has an aria-label matching its heading, in listed order ----
    await expect(groups.nth(0)).toHaveAttribute('aria-label', 'Fruit');
    await expect(groups.nth(1)).toHaveAttribute('aria-label', 'Vegetable');
    await expect(groups.nth(0)).toContainText('Fruit');
    await expect(groups.nth(1)).toContainText('Vegetable');

    // ---- 3. options render under the correct group, in section order ----
    const fruitOptions = groups.nth(0).locator('[role="option"]');
    await expect(fruitOptions).toHaveCount(3);
    await expect(fruitOptions.nth(0)).toContainText('Apple');
    await expect(fruitOptions.nth(1)).toContainText('Banana');
    await expect(fruitOptions.nth(2)).toContainText('Cherry');

    const vegOptions = groups.nth(1).locator('[role="option"]');
    await expect(vegOptions).toHaveCount(2);
    await expect(vegOptions.nth(0)).toContainText('Carrot');
    await expect(vegOptions.nth(1)).toContainText('Potato');

    // ---- 4. ArrowDown walks group-order (Apple → Banana → Cherry → Carrot →
    //         Potato), NEVER landing on a heading (headings are not [role="option"]).
    //         aria-activedescendant on the input always points at an option id —
    //         asserted via Playwright's auto-retrying `toHaveAttribute` (not a raw
    //         `getAttribute` read) since Angular's zone.js change detection can lag
    //         a keydown by a tick under rapid sequential presses.
    const expectedOrder = ['Apple', 'Banana', 'Cherry', 'Carrot', 'Potato'];
    const allOptions = page.locator('[role="option"]');
    for (let i = 0; i < expectedOrder.length; i++) {
      await page.keyboard.press('ArrowDown');
      const expectedId = `demo-combobox-groups-opt-${i}`;
      await expect(input).toHaveAttribute('aria-activedescendant', expectedId, {
        timeout: 10_000,
      });
      const activeEl = page.locator(`#${expectedId}`);
      await expect(activeEl).toHaveAttribute('role', 'option');
      await expect(activeEl).toContainText(expectedOrder[i]!);
    }
    // Sanity: the active-descendant id never resolves to a [role="group"] heading.
    await expect(allOptions).toHaveCount(5);

    // ---- 5. Enter commits the active option (Potato, the last ArrowDown landed
    //         there) → two-way value round-trip OUT; closeOnSelect unmounts the popup.
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await value.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('potato');
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(0);
  });
}
