import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select option groups — the `groups` prop, the `groupHeading` slot, and keyboard
 * navigation / type-ahead over the grouped (visual) order. Driven against
 * examples/demos/SelectGroupsDemo.rozie on all 6 targets.
 *
 * Behavioral assertions only (no screenshots). CSS / role locators pierce Lit's
 * open shadow roots. The highlight is read through `expect.poll`: Angular renders
 * a tick after the key event.
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

  runner(`select-groups [${target}]: options render in group order with headings; keyboard and type-ahead walk visual order`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    const trigger = page.locator('[role="combobox"]').first();
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    const labels = page.locator('[role="option"]');
    await expect(labels).toHaveText(['Water', 'Carrot', 'Leek', 'Apple', 'Banana', 'Oat']);
    await expect(page.getByTestId('heading')).toHaveText(['Vegetables', 'Fruit', 'grain']);
    await expect(page.locator('[role="group"]')).toHaveCount(4);
    await expect(page.locator('[role="group"]').nth(1)).toHaveAttribute('aria-label', 'Vegetables');
    const activeText = async () => {
      const id = await trigger.getAttribute('aria-activedescendant');
      return id ? (await page.locator(`[id="${id}"]`).textContent())?.trim() : null;
    };
    await expect.poll(activeText).toBe('Water');
    await page.keyboard.press('ArrowDown'); await expect.poll(activeText).toBe('Carrot');
    await page.keyboard.press('ArrowDown'); await expect.poll(activeText).toBe('Apple'); // skips disabled Leek
    // Type-ahead lands on the option's VISUAL index: Banana is third in source order
    // (index 2) and fifth in visual order (index 4).
    await page.keyboard.type('b');           await expect.poll(activeText).toBe('Banana');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-4$/);
    await page.waitForTimeout(700); // let the 600ms type-ahead buffer reset
    await page.keyboard.type('o');           await expect.poll(activeText).toBe('Oat');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-value')).toHaveText('oat');
  });

  runner(`select-groups [${target}]: list shrinking under the active option never leaves a dangling activedescendant`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    const trigger = page.locator('[role="combobox"]').first();
    await trigger.focus();
    await page.keyboard.press('End'); // active = Oat (last)
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-5$/);
    // Shrink through the key, not a click: a click outside the open popup dismisses it,
    // and the point here is the list shrinking while the popup stays open.
    await page.getByTestId('shrink').press('s');
    await expect(page.locator('[role="option"]')).toHaveCount(2);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The highlight is clamped to the first enabled option of the shrunk list. The two
    // options left are Apple (fruit) and Carrot (veg); in visual order Carrot comes first.
    await expect(page.locator('[role="option"]')).toHaveText(['Carrot', 'Apple']);
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    const id = await trigger.getAttribute('aria-activedescendant');
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator(`[id="${id}"]`)).toHaveText('Carrot');
  });

  runner(`select-groups [${target}]: with virtual on, groups are ignored — flat source order, navigation still works`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    await page.getByTestId('mode-virtual').click();
    await expect(page.getByTestId('readout-mode')).toHaveText('virtual');
    const trigger = page.locator('[role="combobox"]').first();
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[role="option"]')).toHaveText(['Apple', 'Carrot', 'Banana', 'Water', 'Leek', 'Oat']);
    await expect(page.locator('[role="group"]')).toHaveCount(0);
    const activeText = async () => {
      const id = await trigger.getAttribute('aria-activedescendant');
      return id ? (await page.locator(`[id="${id}"]`).textContent())?.trim() : null;
    };
    await expect.poll(activeText).toBe('Apple');
    await page.keyboard.press('ArrowDown'); await expect.poll(activeText).toBe('Carrot');
    await page.keyboard.press('ArrowDown'); await expect.poll(activeText).toBe('Banana');
    await page.keyboard.press('ArrowDown'); await expect.poll(activeText).toBe('Water');
    await page.keyboard.press('ArrowDown'); await expect.poll(activeText).toBe('Oat'); // skips disabled Leek
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-value')).toHaveText('oat');
  });

  runner(`select-groups [${target}]: without groups, options that carry a group render flat in source order`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    await page.getByTestId('mode-flat').click();
    await expect(page.getByTestId('readout-mode')).toHaveText('flat');
    const trigger = page.locator('[role="combobox"]').first();
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[role="option"]')).toHaveText(['Apple', 'Carrot', 'Banana', 'Water', 'Leek', 'Oat']);
    await expect(page.locator('[role="group"]')).toHaveCount(0);
    const activeText = async () => {
      const id = await trigger.getAttribute('aria-activedescendant');
      return id ? (await page.locator(`[id="${id}"]`).textContent())?.trim() : null;
    };
    await expect.poll(activeText).toBe('Apple');
    await page.keyboard.press('ArrowDown'); await expect.poll(activeText).toBe('Carrot');
    await page.keyboard.press('End');       await expect.poll(activeText).toBe('Oat');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-value')).toHaveText('oat');
  });
}
