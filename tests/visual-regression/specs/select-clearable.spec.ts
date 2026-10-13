import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select `clearable` — clear button and Delete/Backspace clearing. Driven against
 * examples/demos/SelectClearableDemo.rozie on all 6 targets.
 *
 * Behavioral assertions only (no screenshots). CSS / role locators pierce Lit's
 * open shadow roots. Negative checks ("this key does nothing") are followed by a
 * positive action ordered after the key (ArrowDown opens the popup) before the
 * unchanged value is asserted, so they cannot pass vacuously.
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

  runner(`select-clearable [${target}]: clear button and Delete/Backspace clear the value; inert without the prop`, async ({ page }) => {
    await page.goto(`/?example=SelectClearable&target=${target}`);
    const root = page.getByTestId('clearable');
    const trigger = root.locator('[role="combobox"]');
    const clear = root.locator('.rozie-select-clear');
    await expect(clear).toHaveAttribute('aria-label', 'Reset');
    await clear.click();
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(page.getByTestId('readout-changes')).toHaveText('1');
    await expect(trigger).toBeFocused(); // click kept/returned focus on the trigger
    await expect(page.getByTestId('readout-payload')).toHaveText('{"value":null,"option":null}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false'); // click did not open
    await expect(clear).toHaveCount(0);                               // hidden with no value
    // keyboard path
    await trigger.focus();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); // pick Apple
    await expect(page.getByTestId('readout-value')).toHaveText('apple');
    await expect(page.getByTestId('readout-changes')).toHaveText('2'); // Enter pick
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(page.getByTestId('readout-changes')).toHaveText('3');
    await expect(page.getByTestId('readout-payload')).toHaveText('{"value":null,"option":null}');
    await expect(trigger).toBeFocused();
    // Backspace clears too (single-select)
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-value')).not.toHaveText('');
    await expect(page.getByTestId('readout-changes')).toHaveText('4'); // second pick
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(page.getByTestId('readout-changes')).toHaveText('5');
    await expect(page.getByTestId('readout-payload')).toHaveText('{"value":null,"option":null}');
    // not clearable: no button, Delete/Backspace do nothing
    const plain = page.getByTestId('plain');
    await expect(plain.locator('.rozie-select-clear')).toHaveCount(0);
    const plainTrigger = plain.locator('[role="combobox"]');
    await plainTrigger.focus();
    await page.keyboard.press('Delete'); await page.keyboard.press('Backspace');
    // Follow-up positive action ordered after the keys: ArrowDown opens the popup.
    await page.keyboard.press('ArrowDown');
    await expect(plainTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('readout-plain')).toHaveText('apple');
    await expect(page.getByTestId('readout-plain-changes')).toHaveText('0');
  });

  runner(`select-clearable [${target}]: clearing with the popup open keeps it open; disabled renders no button`, async ({ page }) => {
    await page.goto(`/?example=SelectClearable&target=${target}`);
    const root = page.getByTestId('clearable');
    const trigger = root.locator('[role="combobox"]');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await root.locator('.rozie-select-clear').click();
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true'); // stays open
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId('locked').locator('.rozie-select-clear')).toHaveCount(0);
  });

  runner(`select-clearable [${target}]: multiple - button clears all, Delete clears, Backspace does not`, async ({ page }) => {
    await page.goto(`/?example=SelectClearable&target=${target}`);
    const many = page.getByTestId('many');
    const trigger = many.locator('[role="combobox"]');
    await trigger.focus();
    await page.keyboard.press('Backspace');
    // Follow-up positive action ordered after Backspace: ArrowDown opens, Escape closes.
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('readout-many')).toHaveText('["apple","banana"]');
    await expect(page.getByTestId('readout-many-changes')).toHaveText('0');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('readout-many')).toHaveText('[]');
    await expect(page.getByTestId('readout-many-changes')).toHaveText('1');
    await expect(many.locator('.rozie-select-clear')).toHaveCount(0);
  });
}
