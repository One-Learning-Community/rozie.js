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
    // Inside the buffer window a second letter EXTENDS the buffer: "b" + "o" matches
    // nothing, so the highlight stays on Banana ("o" alone would be Oat).
    await page.keyboard.type('o');
    await page.waitForTimeout(100);
    expect(await activeText()).toBe('Banana');
    // Once the buffer has reset, the same letter starts a fresh one and jumps to Oat.
    // No fixed sleep: retype it until it lands (every key press restarts the buffer's
    // 600ms timer, so the retries are spaced wider than that).
    await expect
      .poll(async () => { await page.keyboard.type('o'); await page.waitForTimeout(50); return activeText(); }, { intervals: [700], timeout: 15_000 })
      .toBe('Oat');
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

  runner(`select-groups [${target}]: without a groupHeading slot each group shows its label; the leading ungrouped block has no heading and no name`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    await page.getByTestId('mode-plain').click();
    await expect(page.getByTestId('readout-mode')).toHaveText('plain');
    const trigger = page.locator('[role="combobox"]').first();
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    const groups = page.locator('[role="group"]');
    await expect(groups).toHaveCount(4);
    // Default heading text: the listed groups' labels, then the unlisted group's id.
    await expect(page.locator('.rozie-select-group-heading')).toHaveText(['Vegetables', 'Fruit', 'grain']);
    await expect(page.getByTestId('heading')).toHaveCount(0); // the demo's custom heading is not in play
    // The leading block is the ungrouped one: no heading inside it, no accessible name.
    await expect(groups.nth(0).locator('[role="option"]')).toHaveText(['Water']);
    await expect(groups.nth(0).locator('.rozie-select-group-heading')).toHaveCount(0);
    expect(await groups.nth(0).getAttribute('aria-label')).toBeNull();
    // …while every named block carries its label (so the null above is not vacuous).
    await expect(groups.nth(1)).toHaveAttribute('aria-label', 'Vegetables');
    await expect(groups.nth(2)).toHaveAttribute('aria-label', 'Fruit');
    await expect(groups.nth(3)).toHaveAttribute('aria-label', 'grain');
    await expect(groups.nth(1).locator('.rozie-select-group-heading')).toHaveCount(1);
  });

  runner(`select-groups [${target}]: pointer hover highlights a grouped option by its visual index, and a click picks it`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    const trigger = page.locator('[role="combobox"]').first();
    await trigger.click();
    const banana = page.locator('[role="option"]', { hasText: 'Banana' });
    await expect(banana).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/); // Water, by default
    await banana.hover();
    // Banana is third in source order and FIFTH in visual order.
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-4$/);
    await expect(banana).toHaveClass(/is-active/);
    await expect(page.locator('[role="option"].is-active')).toHaveCount(1);
    // Hovering a disabled option still moves the highlight; clicking it picks nothing.
    const leek = page.locator('[role="option"]', { hasText: 'Leek' });
    await leek.hover();
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-2$/);
    // (`force`: Playwright does not click an aria-disabled element on its own.)
    await leek.click({ force: true });
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // A press inside the popup that picks nothing — a disabled option, a group heading —
    // leaves focus on the trigger, so the keyboard keeps working.
    await page.locator('.rozie-select-group-heading').first().click();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await leek.hover();
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-2$/);
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-3$/); // Apple
    await banana.click();
    await expect(page.getByTestId('readout-value')).toHaveText('banana');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('Banana');
    // Reopened: the highlight starts on the selected option's visual index.
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-4$/);
    await expect(banana).toHaveAttribute('aria-selected', 'true');
  });

  runner(`select-groups [${target}]: multiple with groups — picks toggle membership across groups and show as chips`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    await page.getByTestId('mode-multi').click();
    await expect(page.getByTestId('readout-mode')).toHaveText('multi');
    const trigger = page.locator('[role="combobox"]').first();
    await trigger.click();
    await expect(page.locator('[role="listbox"]')).toHaveAttribute('aria-multiselectable', 'true');
    await expect(page.locator('[role="group"]')).toHaveCount(4);
    const opt = (label: string) => page.locator('[role="option"]', { hasText: label });
    await opt('Banana').click();
    await opt('Carrot').click();
    await expect(page.getByTestId('readout-multi')).toHaveText('banana,carrot');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true'); // stays open
    await expect(opt('Banana')).toHaveAttribute('aria-selected', 'true');
    await expect(opt('Carrot')).toHaveAttribute('aria-selected', 'true');
    await expect(opt('Apple')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('.rozie-select-chip__label')).toHaveText(['Banana', 'Carrot']);
    // Picking with the pointer left focus on the trigger: no focus() call before the keys.
    await expect(trigger).toBeFocused();
    // Keyboard commit on the visual order: Home -> Water (ungrouped), Space picks it.
    await page.keyboard.press('Home');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('readout-multi')).toHaveText('banana,carrot,water');
    // Picking a selected option again takes it out.
    await opt('Banana').click();
    await expect(page.getByTestId('readout-multi')).toHaveText('carrot,water');
    await expect(opt('Banana')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('.rozie-select-chip__label')).toHaveText(['Carrot', 'Water']);
  });

  runner(`select-groups [${target}]: hideEmpty with groups — the popup hides when the options go away and returns with them`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    await page.getByTestId('mode-hide').click();
    await expect(page.getByTestId('readout-mode')).toHaveText('hide');
    const trigger = page.locator('[role="combobox"]').first();
    const list = page.locator('[role="listbox"]');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect(page.locator('[role="group"]')).toHaveCount(4);
    // Keys, not clicks: the popup has to stay open while the options change.
    await page.getByTestId('empty').focus();
    await page.keyboard.press('e');
    await expect(list).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.rozie-select-empty')).toHaveCount(0); // nothing instead of the empty state
    await expect(trigger).not.toHaveAttribute('aria-activedescendant', /.+/);
    await page.keyboard.press('r');
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[role="group"]')).toHaveCount(4);
    await expect(page.locator('[role="option"]')).toHaveText(['Water', 'Carrot', 'Leek', 'Apple', 'Banana', 'Oat']);
    // The list is live again: the keyboard walks it from the trigger.
    await trigger.focus();
    await page.keyboard.press('End');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-5$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-value')).toHaveText('oat');
  });

  runner(`select-groups [${target}]: a group whose id is "_ungrouped" does not collide with the ungrouped block; a numeric option group matches its listed id`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.goto(`/?example=SelectGroups&target=${target}`);
    await page.getByTestId('mode-clash').click();
    await expect(page.getByTestId('readout-mode')).toHaveText('clash');
    const trigger = page.locator('[role="combobox"]').first();
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    const groups = page.locator('[role="group"]');
    await expect(groups).toHaveCount(3);
    await expect(groups.nth(0).locator('[role="option"]')).toHaveText(['Water']);
    expect(await groups.nth(0).getAttribute('aria-label')).toBeNull();
    await expect(groups.nth(1)).toHaveAttribute('aria-label', 'Odd');
    await expect(groups.nth(1).locator('[role="option"]')).toHaveText(['Kiwi']);
    await expect(groups.nth(2)).toHaveAttribute('aria-label', 'Numbered'); // group: 7 found under id '7'
    await expect(groups.nth(2).locator('[role="option"]')).toHaveText(['Seven-up']);
    await expect(page.locator('.rozie-select-group-heading')).toHaveText(['Odd', 'Numbered']);
    // Each block is its own node: closing and reopening keeps the three apart.
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    await expect(groups).toHaveCount(3);
    await expect(page.locator('[role="option"]')).toHaveText(['Water', 'Kiwi', 'Seven-up']);
    expect(errors.filter((e) => /key|duplicate/i.test(e))).toEqual([]);
  });
}
