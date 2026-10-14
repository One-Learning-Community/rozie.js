import { test, expect, type Locator, type Page } from '@playwright/test';
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
  // KNOWN GAP, pinned exactly (no blanket expected-failure): on the targets named in
  // each test the control keeps the value the component wrote itself. The compiled Select
  // holds `value` in the framework's own two-way primitive there (Vue `defineModel`,
  // Svelte `$bindable`, Angular `model()`), which has no "controlled" mode to fall back
  // to; React, Solid and Lit go through Rozie's controllable-state helpers. Nothing in
  // Select.rozie can tell the two apart (its only handle is `$model.value`), so closing
  // the gap needs the emitters — and when they close it, the pinned branch fails.
  runner(`select-identity [${target}]: a one-way binding whose consumer keeps the old value — the control shows the consumer's value`, async ({ page }) => {
    // The parent binds one-way and never sends a different value.
    const KEEPS_OWN_WRITE = target === 'vue' || target === 'svelte' || target === 'angular';
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('refuse');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Apple');

    await trigger.click();
    await options.nth(1).click(); // Banana: refused
    await expect(page.getByTestId('readout-refuse-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-refuse')).toHaveText('apple'); // the consumer kept 'apple', on all six
    await page.waitForTimeout(250);
    await expect(wrap.locator('.rozie-select-selected')).toHaveText(KEEPS_OWN_WRITE ? 'Banana' : 'Apple');
    await trigger.click();
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveAttribute('aria-selected', KEEPS_OWN_WRITE ? 'false' : 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', KEEPS_OWN_WRITE ? 'true' : 'false');

    // An accepted pick is shown on all six.
    await options.nth(2).click(); // Cherry: accepted
    await expect(page.getByTestId('readout-refuse-changes')).toHaveText('2');
    await expect(page.getByTestId('readout-refuse')).toHaveText('cherry');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Cherry');
    await trigger.click();
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');
  });

  runner(`select-identity [${target}]: a two-way binding whose consumer writes the old value back in its change handler — the control shows the consumer's value`, async ({ page }) => {
    // Angular only: the parent's value goes apple -> banana -> apple inside ONE handler;
    // at the next change detection the binding holds the value it last pushed down
    // ('apple'), so the input is not written again and the Select's `model()` stays on
    // 'banana'. (Consumer-side remedy: write the old value back a task later.)
    const KEEPS_OWN_WRITE = target === 'angular';
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('bounce');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Apple');

    await trigger.click();
    await options.nth(1).click(); // Banana: written back
    await expect(page.getByTestId('readout-bounce-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-bounce')).toHaveText('apple'); // on all six
    await page.waitForTimeout(250);
    await expect(wrap.locator('.rozie-select-selected')).toHaveText(KEEPS_OWN_WRITE ? 'Banana' : 'Apple');
    await trigger.click();
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveAttribute('aria-selected', KEEPS_OWN_WRITE ? 'false' : 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', KEEPS_OWN_WRITE ? 'true' : 'false');

    // An accepted pick is shown on all six.
    await options.nth(2).click(); // Cherry: accepted
    await expect(page.getByTestId('readout-bounce-changes')).toHaveText('2');
    await expect(page.getByTestId('readout-bounce')).toHaveText('cherry');
    await expect(wrap.locator('.rozie-select-selected')).toHaveText('Cherry');
    // …and a refusal after an accepted commit: the consumer is back on the accepted value.
    await trigger.click();
    await options.nth(1).click();
    await expect(page.getByTestId('readout-bounce-changes')).toHaveText('3');
    await expect(page.getByTestId('readout-bounce')).toHaveText('cherry');
    await page.waitForTimeout(250);
    await expect(wrap.locator('.rozie-select-selected')).toHaveText(KEEPS_OWN_WRITE ? 'Banana' : 'Cherry');
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
  });

  // ── windowed rows: selected state does not depend on the option OBJECT ─────
  // The four windowed selects are fed plain module-level arrays. The rows they render
  // come out of the Select's own reactive state, so on vue and svelte the row's option
  // is a proxy of the consumer's object, never identical to it.
  for (const kind of ['virt-prim', 'virt-objects'] as const) {
    runner(`select-identity [${target}]: windowed, plain option array (${kind === 'virt-prim' ? 'primitive' : 'object'} values) — the picked row is the selected row, and picking another moves it`, async ({ page }) => {
      await page.goto(`/?example=SelectIdentity&target=${target}`);
      const wrap = page.getByTestId(kind);
      const trigger = wrap.locator('[role="combobox"]');
      const row = (i: number) => wrap.locator(`[role="option"][data-index="${i}"]`);
      const selectedRows = () => wrap.locator('[role="option"][aria-selected="true"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-index'))));
      const word = kind === 'virt-prim' ? 'Item' : 'Thing';
      await trigger.click();
      await expect(row(2)).toBeVisible({ timeout: 15_000 });
      await row(2).click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toContainText(`${word} 3`);
      await trigger.click();
      await expect(row(2)).toBeVisible({ timeout: 15_000 });
      await expect(row(2)).toHaveAttribute('aria-selected', 'true');
      await expect(row(2)).toHaveClass(/is-selected/);
      await expect.poll(selectedRows).toEqual([2]);
      await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-2$/); // the highlight starts on it
      await row(4).click();
      await expect(trigger).toContainText(`${word} 5`);
      await trigger.click();
      await expect(row(4)).toBeVisible({ timeout: 15_000 });
      await expect.poll(selectedRows).toEqual([4]);
      await expect(row(2)).toHaveAttribute('aria-selected', 'false');
    });
  }

  for (const kind of ['virt-prim-many', 'virt-objects-many'] as const) {
    runner(`select-identity [${target}]: windowed multi-select, plain option array (${kind === 'virt-prim-many' ? 'primitive' : 'object'} values) — a second click on a selected row takes it out, with no duplicates`, async ({ page }) => {
      await page.goto(`/?example=SelectIdentity&target=${target}`);
      const wrap = page.getByTestId(kind);
      const trigger = wrap.locator('[role="combobox"]');
      const row = (i: number) => wrap.locator(`[role="option"][data-index="${i}"]`);
      const readout = page.getByTestId(kind === 'virt-prim-many' ? 'readout-virt-prim-many' : 'readout-virt-many');
      const v = (n: number) => (kind === 'virt-prim-many' ? `item-${n}` : String(n));
      const labels = wrap.locator('.rozie-select-chip__label');
      const word = kind === 'virt-prim-many' ? 'Item' : 'Thing';
      await trigger.click();
      await expect(row(1)).toBeVisible({ timeout: 15_000 });
      await row(1).click();
      await row(3).click();
      await expect(readout).toHaveText(`${v(2)},${v(4)}`);
      await expect(row(1)).toHaveAttribute('aria-selected', 'true');
      await expect(row(3)).toHaveAttribute('aria-selected', 'true');
      await expect(row(2)).toHaveAttribute('aria-selected', 'false');
      await expect(labels).toHaveText([`${word} 2`, `${word} 4`]);
      // A second click on a selected row deselects it — it is not appended again.
      await row(1).click();
      await expect(readout).toHaveText(v(4));
      await expect(row(1)).toHaveAttribute('aria-selected', 'false');
      await expect(labels).toHaveText([`${word} 4`]);
      await row(3).click();
      await expect(readout).toHaveText('');
      await expect(labels).toHaveCount(0);
      // …and again: on, on, off leaves exactly one.
      await row(0).click();
      await row(5).click();
      await row(0).click();
      await expect(readout).toHaveText(v(6));
    });
  }

  // ── the bound arrays changed IN PLACE ─────────────────────────────────────
  // Whatever makes the framework render again must show the truth. The demo hands its two
  // bound arrays to the page and the spec changes them there (a `.rozie` file may not:
  // ROZ207 — an in-place change is reported by the framework only on Vue and Svelte).
  //
  // What each target can see of a change made inside a bound array:
  //  - vue, svelte: everything (their state is deeply reactive).
  //  - react: after the demo renders again (`live-tick`), which renders the select again.
  //  - angular: after `live-tick` the template is checked again, so what the template
  //    computes is current; but no watcher and no post-render hook runs (an in-place
  //    change is not an input change, and the compiled `$onUpdate` never runs its body
  //    on Angular — see the report), so the windowed rows and the native element's
  //    checked option, which are kept by those, stay as they were.
  //  - lit: the select is not rendered again by its parent (same property values); it is
  //    by anything of its own — opening its popup refreshes it (refresh() below).
  //  - solid: nothing renders again; only a list mounted AFTER the change (the popup, on
  //    open) reads the arrays anew.
  // Assertions are skipped exactly where a target cannot see the change.
  const ON_SCREEN = target !== 'solid'; // the label, the chips
  const DEMO_RENDERS = target !== 'solid'; // the demo's own readouts
  const WINDOWED = target === 'vue' || target === 'svelte' || target === 'react' || target === 'lit';
  const NATIVE = target === 'vue' || target === 'svelte' || target === 'react';
  const refresh = async (wrap: Locator) => {
    if (target !== 'lit') return;
    await wrap.locator('[role="combobox"]').click();
    await expect(wrap.locator('[role="listbox"]')).toBeVisible();
    await wrap.page().keyboard.press('Escape');
    await expect(wrap.locator('[role="listbox"]')).toHaveCount(0);
  };
  type Hook = { model: unknown[]; options: unknown[] };
  const inPlace = async (page: Page, src: string) => {
    await page.evaluate((code) => {
      const h = (globalThis as unknown as { __selectIdentityDemo: Hook }).__selectIdentityDemo;
      new Function('h', code)(h);
    }, src);
    const tick = page.getByTestId('readout-live-tick');
    const before = Number(await tick.textContent());
    await page.getByTestId('live-tick').click();
    if (target !== 'solid') await expect(tick).toHaveText(String(before + 1));
  };
  const D = `{ label: 'D', value: 'd', group: 'g' }`;

  runner(`select-identity [${target}]: a model and an option list changed in place are shown as they are now`, async ({ page }) => {
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const many = page.getByTestId('live-many');
    const one = page.getByTestId('live-one');
    const labels = many.locator('.rozie-select-chip__label');
    const readout = page.getByTestId('readout-live-many');
    const opt = (wrap: typeof many, label: string) => wrap.locator('[role="option"]', { hasText: new RegExp(`^\\s*${label}\\s*$`) });
    const chips = async (want: string[]) => {
      if (!ON_SCREEN) return;
      await refresh(many);
      await expect(labels).toHaveText(want);
    };
    const readoutIs = async (want: string) => { if (DEMO_RENDERS) await expect(readout).toHaveText(want); };
    await expect(readout).toHaveText('a,b,d');
    await expect(labels).toHaveText(['A', 'B', 'd']); // 'd' matches no option yet: its raw value
    await expect(one.locator('.rozie-select-placeholder')).toHaveText('Nothing');

    // An option pushed for a value already in the model: both selects pick it up.
    await inPlace(page, `h.options.push(${D})`);
    if (DEMO_RENDERS) await expect(page.getByTestId('readout-live-opts')).toHaveText('4');
    await chips(['A', 'B', 'D']);
    if (ON_SCREEN) {
      await refresh(one);
      await expect(one.locator('.rozie-select-selected')).toHaveText('D');
    }
    await one.locator('[role="combobox"]').click();
    await expect(one.locator('[role="option"]')).toHaveText(['A', 'B', 'C', 'D']);
    await expect(opt(one, 'D')).toHaveAttribute('aria-selected', 'true');
    await expect(one.locator('[role="combobox"]')).toHaveAttribute('aria-activedescendant', /-opt-3$/);
    await page.keyboard.press('Escape');

    // One model element replaced in place: b -> c.
    await inPlace(page, `h.model[1] = 'c'`);
    await readoutIs('a,c,d');
    await chips(['A', 'C', 'D']);
    await many.locator('[role="combobox"]').click();
    await expect(opt(many, 'C')).toHaveAttribute('aria-selected', 'true');
    await expect(opt(many, 'B')).toHaveAttribute('aria-selected', 'false');
    await expect(opt(many, 'A')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');

    // The same element replaced through splice.
    await inPlace(page, `h.model.splice(1, 1, 'b')`);
    await readoutIs('a,b,d');
    await chips(['A', 'B', 'D']);

    // Reordered in place: labels follow their values.
    await inPlace(page, `h.model.reverse()`);
    await readoutIs('d,b,a');
    await chips(['D', 'B', 'A']);
    await inPlace(page, `h.model.sort()`);
    await readoutIs('a,b,d');
    await chips(['A', 'B', 'D']);
    await inPlace(page, `h.model.reverse()`);
    await chips(['D', 'B', 'A']);
    // Removing a chip removes ITS value (the chips are not on screen-current on Solid).
    if (ON_SCREEN) {
      await many.locator('.rozie-select-chip').nth(0).locator('.rozie-select-chip__remove').click();
      await expect(readout).toHaveText('b,a');
      await expect(labels).toHaveText(['B', 'A']);
    }
    // Picking a selected option takes out exactly that value.
    await many.locator('[role="combobox"]').click();
    await expect(opt(many, 'B')).toHaveAttribute('aria-selected', 'true');
    await opt(many, 'B').click();
    await expect(readout).toHaveText(ON_SCREEN ? 'a' : 'd,a'); // a commit is a new array: the demo shows it everywhere
    await expect(opt(many, 'B')).toHaveAttribute('aria-selected', 'false');
    await expect(opt(many, 'A')).toHaveAttribute('aria-selected', 'true');
  });

  // The grouped, native-picker and windowed branches must agree with the label, the chips
  // and the keyboard after the option list grew or shrank in place.
  runner(`select-identity [${target}]: grouped list — an option pushed or removed in place shows in the groups, selected and navigable`, async ({ page }) => {
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('live-grouped');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(wrap.locator('.rozie-select-placeholder')).toHaveText('Nothing'); // model 'd', no such option yet
    await inPlace(page, `h.options.push(${D})`);
    if (ON_SCREEN) {
      await refresh(wrap);
      await expect(wrap.locator('.rozie-select-selected')).toHaveText('D');
    }
    await trigger.click();
    await expect(wrap.locator('[role="group"]')).toHaveCount(1);
    await expect(options).toHaveText(['A', 'B', 'C', 'D']);
    await expect(options.nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-3$/); // the highlight starts on the selection
    await page.keyboard.press('Escape');
    await expect(wrap.locator('[role="listbox"]')).toHaveCount(0);

    await inPlace(page, `h.options.splice(0, 1)`); // A removed
    await trigger.click();
    await expect(options).toHaveText(['B', 'C', 'D']);
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-2$/);
    // The keyboard walks the same three rows.
    await page.keyboard.press('Home');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await expect(options.nth(0)).toHaveClass(/is-active/);
    await page.keyboard.press('End');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-2$/);
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(trigger).toContainText('B');
  });

  (NATIVE ? runner : test.skip)(`select-identity [${target}]: native picker — an option pushed or removed in place shows in the native element, checked`, async ({ page }) => {
    // Not on angular, lit, solid: see the list above the first in-place test. The native
    // element is on screen from the start, cannot be refreshed by opening a popup (it has
    // none), and its checked option is written after a render only where a post-render
    // hook runs.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = ((q: string) =>
        q === '(pointer: coarse)'
          ? ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => true } as unknown as MediaQueryList)
          : real(q)) as typeof window.matchMedia;
    });
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const native = page.getByTestId('live-native').locator('select.rozie-select-native');
    await expect(native.locator('option')).toHaveText(['Nothing', 'A', 'B', 'C']);
    await expect(native.locator('option:checked')).toHaveText('Nothing');
    await inPlace(page, `h.options.push(${D})`);
    await expect(native.locator('option')).toHaveText(['Nothing', 'A', 'B', 'C', 'D']);
    await expect(native.locator('option:checked')).toHaveText('D');
    await inPlace(page, `h.options.splice(0, 1)`);
    await expect(native.locator('option')).toHaveText(['Nothing', 'B', 'C', 'D']);
    await expect(native.locator('option:checked')).toHaveText('D');
    // The element is live: choosing B commits B.
    await native.selectOption({ label: 'B' });
    await expect(page.getByTestId('live-one').locator('.rozie-select-selected')).toHaveText('B');
  });

  (WINDOWED ? runner : test.skip)(`select-identity [${target}]: windowed list — an option pushed or removed in place shows as a row, selected and navigable`, async ({ page }) => {
    // Not on angular, solid: the rows are re-fed by a watcher or the post-render hook,
    // neither of which runs there for an in-place change (see the list above).
    await page.goto(`/?example=SelectIdentity&target=${target}`);
    const wrap = page.getByTestId('live-virtual');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    await expect(trigger).toBeVisible();
    await inPlace(page, `h.options.push(${D})`);
    await trigger.click();
    await expect(options).toHaveText(['A', 'B', 'C', 'D'], { timeout: 15_000 });
    await expect(options.nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-3$/);
    await page.keyboard.press('Escape');

    await inPlace(page, `h.options.splice(0, 1)`); // A removed
    await trigger.click();
    await expect(options).toHaveText(['B', 'C', 'D'], { timeout: 15_000 });
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');
    // The keyboard walks the same three rows: End does not run past the last one.
    await page.keyboard.press('Home');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await page.keyboard.press('End');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-2$/);
    await expect(wrap.locator('[role="option"][data-index="2"]')).toHaveClass(/is-active/);
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(trigger).toContainText('B');
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
