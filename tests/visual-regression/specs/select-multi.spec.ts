import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select multi-select chips — selected values render as removable inline chips,
 * a `chip` slot, Backspace removing the last chip. Driven against
 * examples/demos/SelectMultiDemo.rozie on all 6 targets.
 *
 * Behavioral assertions only (no screenshots). CSS / role locators pierce Lit's
 * open shadow roots. Every negative check ("this does nothing") is followed by a
 * positive action ordered after it whose effect is visible, and a demo-side
 * `change` counter is compared, so none can pass vacuously.
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

  runner(`select-multi [${target}]: chips show selected values (including one missing from options), remove by button and Backspace`, async ({ page }) => {
    await page.goto(`/?example=SelectMulti&target=${target}`);
    const main = page.getByTestId('main');
    const trigger = main.locator('[role="combobox"]');
    const chips = main.locator('.rozie-select-chip');
    await expect(chips.locator('.rozie-select-chip__label')).toHaveText(['Banana', 'ghost']);
    await expect(main.locator('.rozie-select-placeholder')).toHaveCount(0);
    // add one from the popup; popup stays open (closeOnSelect false)
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await page.locator('[role="option"]', { hasText: 'Cherry' }).click();
    await expect(page.getByTestId('readout-value')).toHaveText('banana,ghost,cherry');
    await expect(page.getByTestId('readout-changes')).toHaveText('1');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // remove the stale value via its button; the click must not open the popup
    await expect(chips.nth(1).locator('.rozie-select-chip__remove')).toHaveAttribute('aria-label', 'Remove ghost');
    await chips.nth(1).locator('.rozie-select-chip__remove').click();
    await expect(page.getByTestId('readout-value')).toHaveText('banana,cherry');
    await expect(page.getByTestId('readout-changes')).toHaveText('2');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused(); // chip-remove click returns focus to the trigger
    // Backspace removes the last chip; Delete clears all
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('readout-value')).toHaveText('banana');
    await expect(page.getByTestId('readout-changes')).toHaveText('3');
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(page.getByTestId('readout-changes')).toHaveText('4');
    await expect(main.locator('.rozie-select-chip')).toHaveCount(0);
    await expect(main.locator('.rozie-select-placeholder')).toHaveText('Pick fruit');
    // nothing left: Backspace must not change anything. The follow-up ArrowDown
    // (ordered after the Backspace) proves the key was processed before asserting.
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(page.getByTestId('readout-changes')).toHaveText('4');
  });

  runner(`select-multi [${target}]: the change payload of a chip removal is { value: <new array>, option: null }`, async ({ page }) => {
    await page.goto(`/?example=SelectMulti&target=${target}`);
    const main = page.getByTestId('main');
    await main.locator('.rozie-select-chip').nth(1).locator('.rozie-select-chip__remove').click();
    await expect(page.getByTestId('readout-value')).toHaveText('banana');
    await expect(page.getByTestId('readout-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-payload')).toHaveText('{"value":["banana"],"option":null}');
    await main.locator('[role="combobox"]').focus();
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('readout-payload')).toHaveText('{"value":[],"option":null}');
    await expect(page.getByTestId('readout-changes')).toHaveText('2');
  });

  runner(`select-multi [${target}]: removing a chip with the popup open keeps it open and un-selects the option`, async ({ page }) => {
    await page.goto(`/?example=SelectMulti&target=${target}`);
    const main = page.getByTestId('main');
    const trigger = main.locator('[role="combobox"]');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const banana = page.locator('[role="option"]', { hasText: 'Banana' });
    await expect(banana).toHaveAttribute('aria-selected', 'true');
    await main.locator('.rozie-select-chip').first().locator('.rozie-select-chip__remove').click();
    await expect(page.getByTestId('readout-value')).toHaveText('ghost');
    await expect(banana).toHaveAttribute('aria-selected', 'false');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true'); // stays open
    await expect(trigger).toBeFocused();
    // Backspace with the popup OPEN must not remove a chip (it is popup-closed only).
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false'); // ordered after Backspace
    await expect(page.getByTestId('readout-value')).toHaveText('ghost');
    await expect(page.getByTestId('readout-changes')).toHaveText('1');
  });

  runner(`select-multi [${target}]: the chip slot renders custom content and its remove() removes that value`, async ({ page }) => {
    await page.goto(`/?example=SelectMulti&target=${target}`);
    const custom = page.getByTestId('custom');
    await expect(custom.locator('.custom-chip')).toHaveText(['Apple', 'Banana']);
    await expect(custom.locator('.rozie-select-chip__label')).toHaveCount(0); // default content replaced
    await expect(custom.locator('.rozie-select-chip__remove')).toHaveCount(0);
    await custom.locator('.custom-chip__x').first().click();
    await expect(page.getByTestId('readout-custom')).toHaveText('banana');
    await expect(custom.locator('.custom-chip')).toHaveText(['Banana']);
    await expect(custom.locator('[role="combobox"]')).toBeFocused(); // remove() returns focus
  });

  runner(`select-multi [${target}]: a disabled multiple renders chips with disabled remove buttons; nothing removes`, async ({ page }) => {
    await page.goto(`/?example=SelectMulti&target=${target}`);
    const locked = page.getByTestId('locked');
    await expect(locked.locator('.rozie-select-chip__label')).toHaveText(['Apple', 'Banana']);
    const removes = locked.locator('.rozie-select-chip__remove');
    await expect(removes).toHaveCount(2);
    await expect(removes.nth(0)).toBeDisabled();
    await expect(removes.nth(1)).toBeDisabled();
    await removes.first().click({ force: true });
    const lockedTrigger = locked.locator('[role="combobox"]');
    await lockedTrigger.focus();
    await page.keyboard.press('Backspace');
    // Follow-up positive action ordered after the attempts: a real removal on the
    // enabled select proves the page processed input; the locked readout is read after it.
    await page.getByTestId('main').locator('.rozie-select-chip').first().locator('.rozie-select-chip__remove').click();
    await expect(page.getByTestId('readout-value')).toHaveText('ghost');
    await expect(page.getByTestId('readout-locked')).toHaveText('apple,banana');
    await expect(page.getByTestId('readout-locked-changes')).toHaveText('0');
    await expect(locked.locator('.rozie-select-chip')).toHaveCount(2);
  });

  runner(`select-multi [${target}]: with chips wrapped to a second row the popup sits below the (taller) control`, async ({ page }) => {
    await page.goto(`/?example=SelectMulti&target=${target}`);
    const wrap = page.getByTestId('wrap');
    const trigger = wrap.locator('[role="combobox"]');
    const control = wrap.locator('.rozie-select-control');
    const chips = wrap.locator('.rozie-select-chip');
    await expect(chips).toHaveCount(4);
    const tops = await chips.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBeGreaterThan(1); // the row wrapped
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    const list = page.locator('[role="listbox"]');
    await expect(list).toBeVisible();
    const gap = async () => {
      const c = await control.boundingBox();
      const l = await list.boundingBox();
      return l!.y - (c!.y + c!.height);
    };
    expect(await gap()).toBeGreaterThanOrEqual(-0.5);
    // grow the control while open: add the remaining two options (popup stays open)
    const heightBefore = (await control.boundingBox())!.height;
    await page.locator('[role="option"]', { hasText: 'Echo' }).click();
    await page.locator('[role="option"]', { hasText: 'Foxtrot' }).click();
    await expect(page.getByTestId('readout-wrap')).toHaveText('alpha,bravo,charlie,delta,echo,foxtrot');
    await expect(chips).toHaveCount(6);
    await expect.poll(async () => (await control.boundingBox())!.height).toBeGreaterThan(heightBefore);
    await expect.poll(gap).toBeGreaterThanOrEqual(-0.5);
    // shrink it again by removing chips while open
    for (let i = 0; i < 4; i++) await chips.last().locator('.rozie-select-chip__remove').click();
    await expect(page.getByTestId('readout-wrap')).toHaveText('alpha,bravo');
    await expect.poll(gap).toBeGreaterThanOrEqual(-0.5);
    await expect(list).toBeVisible();
  });
}
