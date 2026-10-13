import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select value identity — object-valued options read back through the consumer's
 * reactive state, a consumer that keeps the old value, and a multi-select model that
 * holds a value twice. Driven against examples/demos/SelectIdentityDemo.rozie on all 6
 * targets.
 *
 * Behavioral assertions only (no screenshots). CSS / role locators pierce Lit's open
 * shadow roots.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  // ── B2 ────────────────────────────────────────────────────────────────────
  runner(`select-identity [${target}]: single-select — an object value picked in the popup shows its label and is the selected option`, async ({ page }) => {
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('one');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(wrap.locator('.rozie-select-placeholder')).toHaveText('Pick one');

    await trigger.click();
    await expect(options).toHaveText(['Box', 'Crate', 'Plain']);
    await options.nth(1).click();
    await expect(page.getByTestId('readout-one')).toHaveText('crate');
    await expect(page.getByTestId('readout-one-same')).toHaveText('true'); // the commit hands back the option's own object
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Crate');
    await expect(wrap.locator('.rozie-select-placeholder')).toHaveCount(0);

    // Reopened: exactly that option is selected, and the highlight starts on it.
    await trigger.click();
    await expect(options).toHaveCount(3);
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'false');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-1$/);

    // Another object, then a primitive: the selection moves, it does not accumulate.
    await options.nth(0).click();
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Box');
    await trigger.click();
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');
    await options.nth(2).click();
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Plain');
  });

  runner(`select-identity [${target}]: single-select — an object value written by the consumer shows as selected`, async ({ page }) => {
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('one');
    const trigger = wrap.locator('[role="combobox"]');
    await expect(wrap.locator('.rozie-select-placeholder')).toHaveText('Pick one');
    await page.getByTestId('set-crate').click();
    await expect(page.getByTestId('readout-one')).toHaveText('crate');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Crate');
    await trigger.click();
    const options = wrap.locator('[role="option"]');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
  });

  runner(`select-identity [${target}]: multi-select — object values show as chips and selected options; removing one removes exactly that one`, async ({ page }) => {
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('many');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    const labels = wrap.locator('.rozie-select-chip__label');
    await trigger.click();
    await options.nth(0).click(); // Box
    await options.nth(1).click(); // Crate
    await options.nth(2).click(); // Plain
    await expect(page.getByTestId('readout-many')).toHaveText('box,crate,plain');
    await expect(labels).toHaveText(['Box', 'Crate', 'Plain']);
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');

    // Picking a selected option again takes it out (it is not appended a second time).
    await options.nth(1).click();
    await expect(page.getByTestId('readout-many')).toHaveText('box,plain');
    await expect(labels).toHaveText(['Box', 'Plain']);
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await options.nth(1).click();
    await expect(page.getByTestId('readout-many')).toHaveText('box,plain,crate');
    await expect(labels).toHaveText(['Box', 'Plain', 'Crate']);
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Removing a chip removes exactly that value.
    const chips = wrap.locator('.rozie-select-chip');
    await expect(chips.nth(0).locator('.rozie-select-chip__remove')).toHaveAttribute('aria-label', 'Remove Box');
    await chips.nth(0).locator('.rozie-select-chip__remove').click();
    await expect(page.getByTestId('readout-many')).toHaveText('plain,crate');
    await expect(labels).toHaveText(['Plain', 'Crate']);
    // Backspace removes the last chip (an object value).
    await trigger.focus();
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('readout-many')).toHaveText('plain');
    await expect(labels).toHaveText(['Plain']);
  });

  // ── B3 ────────────────────────────────────────────────────────────────────
  runner(`select-identity [${target}]: a one-way binding whose consumer keeps the old value — the control shows the consumer's value`, async ({ page }) => {
    // EXPECTED FAILURE on Vue, Svelte and Angular — the repro for a known gap, not a
    // property of this demo. On those three the compiled Select holds `value` in the
    // framework's own two-way primitive (Vue `defineModel`, Svelte `$bindable`, Angular
    // `model()`), and each of them keeps a value the component wrote itself when the
    // parent binds one-way and never sends a different value: there is no "controlled"
    // mode to fall back to. React, Solid and Lit go through Rozie's controllable-state
    // helpers, which treat a supplied prop as controlled. Nothing in Select.rozie can
    // tell the two apart (its only handle is `$model.value`), so this needs the emitters.
    // Remove the marker when it is fixed: the test then fails as "expected to fail, but passed".
    test.fail(target === 'vue' || target === 'svelte' || target === 'angular', 'a one-way bound model prop keeps the value the component wrote (defineModel / $bindable / model() are uncontrolled without a two-way binding)');
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('refuse');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Apple');

    await trigger.click();
    await options.nth(1).click(); // Banana: refused
    await expect(page.getByTestId('readout-refuse-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-refuse')).toHaveText('apple');
    await page.waitForTimeout(250);
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Apple');
    await trigger.click();
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');

    await options.nth(2).click(); // Cherry: accepted
    await expect(page.getByTestId('readout-refuse')).toHaveText('cherry');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Cherry');
  });

  runner(`select-identity [${target}]: a two-way binding whose consumer writes the old value back in its change handler — the control shows the consumer's value`, async ({ page }) => {
    // EXPECTED FAILURE on Angular — the repro for a known gap. The parent's two-way
    // binding goes apple -> banana -> apple inside ONE handler; at the next change
    // detection the binding holds the value it last pushed down ('apple'), so Angular
    // does not write the input again and the Select's own `model()` stays on 'banana'.
    // The consumer-side remedy is to write the old value back a task later (the
    // SelectNativeDemo `guarded` select does). Nothing in Select.rozie can see the
    // parent's value, so this needs the Angular emitter. Remove the marker when fixed.
    test.fail(target === 'angular', 'a two-way binding written back to its previous value in the same handler is not pushed to the model() input again');
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('bounce');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Apple');

    await trigger.click();
    await options.nth(1).click(); // Banana: written back
    await expect(page.getByTestId('readout-bounce-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-bounce')).toHaveText('apple');
    await page.waitForTimeout(250);
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Apple');
    await trigger.click();
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');

    await options.nth(2).click(); // Cherry: accepted
    await expect(page.getByTestId('readout-bounce')).toHaveText('cherry');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Cherry');
    // …and a refusal after an accepted commit goes back to the accepted value.
    await trigger.click();
    await options.nth(1).click();
    await expect(page.getByTestId('readout-bounce-changes')).toHaveText('3');
    await expect(page.getByTestId('readout-bounce')).toHaveText('cherry');
    await page.waitForTimeout(250);
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Cherry');
  });

  // ── B4 ────────────────────────────────────────────────────────────────────
  runner(`select-identity [${target}]: multi-select — a value held twice shows one chip, and removing it removes every occurrence`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('dupes');
    const trigger = wrap.locator('[role="combobox"]');
    const labels = wrap.locator('.rozie-select-chip__label');
    await expect(page.getByTestId('readout-dupes')).toHaveText('apple,apple,banana'); // the model itself is the consumer's
    await expect(labels).toHaveText(['Apple', 'Banana']);
    // No duplicate-key complaint from the framework.
    expect(errors.filter((e) => /key|duplicate/i.test(e))).toEqual([]);

    await wrap.locator('.rozie-select-chip').nth(0).locator('.rozie-select-chip__remove').click();
    await expect(page.getByTestId('readout-dupes')).toHaveText('banana');
    await expect(page.getByTestId('readout-dupe-changes')).toHaveText('1');
    await expect(labels).toHaveText(['Banana']);

    // Picking a value that is held twice in the popup takes out every occurrence too.
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    await expect(labels).toHaveText(['Apple', 'Banana']);
    await trigger.click();
    const options = wrap.locator('[role="option"]');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await options.nth(0).click();
    await expect(page.getByTestId('readout-dupes')).toHaveText('banana');
    await expect(labels).toHaveText(['Banana']);
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Escape');

    // Backspace on a model ending in a duplicated value removes that value entirely.
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    await expect(labels).toHaveText(['Apple', 'Banana']);
    await wrap.locator('.rozie-select-chip').nth(1).locator('.rozie-select-chip__remove').click();
    await expect(page.getByTestId('readout-dupes')).toHaveText('apple,apple');
    await expect(labels).toHaveText(['Apple']);
    await trigger.focus();
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('readout-dupes')).toHaveText('');
    await expect(labels).toHaveCount(0);
  });
}
