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
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('refuse');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Apple');

    await trigger.click();
    await options.nth(1).click(); // Banana: refused
    await expect(page.getByTestId('readout-refuse-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-refuse')).toHaveText('apple');

    // Everything above holds on all six: the page loaded, the initial value showed, the
    // pick reached the consumer and the consumer kept 'apple'. Only what follows is the gap.
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
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('bounce');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Apple');

    await trigger.click();
    await options.nth(1).click(); // Banana: written back
    await expect(page.getByTestId('readout-bounce-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-bounce')).toHaveText('apple');

    // Everything above holds on all six; only what follows is the gap.
    // EXPECTED FAILURE on Angular — the repro for a known gap. The parent's two-way
    // binding goes apple -> banana -> apple inside ONE handler; at the next change
    // detection the binding holds the value it last pushed down ('apple'), so Angular
    // does not write the input again and the Select's own `model()` stays on 'banana'.
    // The consumer-side remedy is to write the old value back a task later (the
    // SelectNativeDemo `guarded` select does). Nothing in Select.rozie can see the
    // parent's value, so this needs the Angular emitter. Remove the marker when fixed.
    test.fail(target === 'angular', 'a two-way binding written back to its previous value in the same handler is not pushed to the model() input again');
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

  // ── identity first ────────────────────────────────────────────────────────
  // Two options carry DIFFERENT objects with EQUAL contents. Where the consumer's state
  // hands the committed object back as-is (react, solid, lit, angular) the second twin is
  // the second twin. On vue and svelte the value comes back wrapped in a reactive proxy:
  // it is identical to NO option, so content decides and both twins match — a known
  // limit, stated in the `options` prop description, pinned here so a change is noticed.
  const PROXIED = target === 'vue' || target === 'svelte';

  runner(`select-identity [${target}]: two options with equal-content object values — picking the second selects ${PROXIED ? 'both twins (reactive-proxy limit)' : 'the second only'}`, async ({ page }) => {
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('twins');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await trigger.click();
    await expect(options).toHaveText(['First twin', 'Second twin', 'Other']);
    await options.nth(1).click();
    await expect(page.getByTestId('readout-twin-picked')).toHaveText('b'); // the commit is the second twin's own object, on all six
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(options).toHaveCount(3);
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'false');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    if (PROXIED) {
      await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
      await expect(wrap.locator('.rozie-select-selected')).toHaveText('First twin');
      await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    } else {
      await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
      await expect(wrap.locator('.rozie-select-selected')).toHaveText('Second twin');
      await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-1$/); // the highlight starts on it
    }
    // Picking the first twin moves the selection on every target.
    await options.nth(0).click();
    await expect(page.getByTestId('readout-twin-picked')).toHaveText('a');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('First twin');
  });

  runner(`select-identity [${target}]: multi-select over equal-content object values — ${PROXIED ? 'the twins toggle together (reactive-proxy limit)' : 'each twin is its own value'}`, async ({ page }) => {
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('twins-many');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    const labels = wrap.locator('.rozie-select-chip__label');
    const count = page.getByTestId('readout-twin-many');
    await trigger.click();
    await options.nth(1).click(); // Second twin
    await expect(count).toHaveText('1');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    if (PROXIED) {
      await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
      await expect(labels).toHaveText(['First twin']);
      // The first twin reads as selected, so picking it takes the value out.
      await options.nth(0).click();
      await expect(count).toHaveText('0');
      await expect(labels).toHaveCount(0);
    } else {
      await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
      await expect(labels).toHaveText(['Second twin']);
      await options.nth(0).click(); // First twin: added next to the second
      await expect(count).toHaveText('2');
      await expect(labels).toHaveText(['Second twin', 'First twin']);
      await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
      // Removing the SECOND twin's chip leaves the first.
      await page.keyboard.press('Escape');
      await wrap.locator('.rozie-select-chip').nth(0).locator('.rozie-select-chip__remove').click();
      await expect(count).toHaveText('1');
      await expect(labels).toHaveText(['First twin']);
      // Backspace removes the remaining one.
      await trigger.focus();
      await page.keyboard.press('Backspace');
      await expect(count).toHaveText('0');
    }
  });

  runner(`select-identity [${target}]: a NaN option value is the same value as NaN — picking it twice takes it out again`, async ({ page }) => {
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('nums');
    const options = wrap.locator('[role="option"]');
    const count = page.getByTestId('readout-nums');
    await wrap.locator('[role="combobox"]').click();
    await options.nth(0).click();
    await expect(count).toHaveText('1');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(wrap.locator('.rozie-select-chip__label')).toHaveText(['Not a number']);
    await options.nth(0).click();
    await expect(count).toHaveText('0');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
  });

  // ── windowed rows keyed uniquely ──────────────────────────────────────────
  runner(`select-identity [${target}]: a windowed list of object-valued options renders each row once, in order, through scrolling`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('virt-objects');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const options = wrap.locator('[role="option"]');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(list).toBeVisible();
    await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(3);
    // Every rendered row shows the label that belongs to its index, exactly once.
    const rows = () => options.evaluateAll((els) => els.map((e) => ({ index: Number(e.getAttribute('data-index')), text: (e.textContent || '').trim() })));
    const coherent = async () => {
      const r = await rows();
      const indices = r.map((x) => x.index);
      return r.length > 3 && new Set(indices).size === indices.length && r.every((x) => x.text === 'Thing ' + (x.index + 1)) && indices.every((v, i) => i === 0 || v === indices[i - 1]! + 1);
    };
    await expect.poll(coherent, { timeout: 15_000 }).toBe(true);
    expect((await rows())[0]!.index).toBe(0);
    // A row keeps its DOM node while it stays in the window: mark the node of option 12,
    // bring more options in, and the same node is still option 12. (With one shared key
    // for every row a keyed renderer rebuilds the rows on each change of the window.)
    const marked = wrap.locator('[role="option"][data-index="12"]');
    await list.evaluate((el) => { el.scrollTop = 150; });
    await expect(marked).toHaveCount(1, { timeout: 15_000 });
    await expect.poll(coherent, { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(300); // the window has settled
    await marked.evaluate((el) => { (el as HTMLElement & { __kept?: string }).__kept = 'yes'; });
    const lastBefore = Math.max(...(await rows()).map((x) => x.index));
    await list.evaluate((el) => { el.scrollTop = 330; });
    await expect.poll(async () => Math.max(...(await rows()).map((x) => x.index)), { timeout: 15_000 }).toBeGreaterThan(lastBefore);
    await expect.poll(coherent, { timeout: 15_000 }).toBe(true);
    await expect(marked).toHaveCount(1);
    expect(await marked.evaluate((el) => (el as HTMLElement & { __kept?: string }).__kept)).toBe('yes');
    // Scroll the window away and back: recycled rows still match their index.
    await list.evaluate((el) => { el.scrollTop = 700; });
    await expect.poll(async () => (await rows()).some((x) => x.index >= 30), { timeout: 15_000 }).toBe(true);
    await expect.poll(coherent, { timeout: 15_000 }).toBe(true);
    await list.evaluate((el) => { el.scrollTop = 0; });
    await expect.poll(async () => (await rows())[0]?.index, { timeout: 15_000 }).toBe(0);
    await expect.poll(coherent, { timeout: 15_000 }).toBe(true);
    // Rows are live: pick the third.
    await wrap.locator('[role="option"][data-index="2"]').click();
    await expect(page.getByTestId('readout-virt-picked')).toHaveText('Thing 3');
    await expect(trigger).toContainText('Thing 3');
    expect(errors.filter((e) => /key|duplicate/i.test(e))).toEqual([]);
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
