import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select `nativePicker` — on a coarse primary pointer an invisible native <select>
 * is laid over the control, so a tap opens the operating system's own picker.
 * Driven against examples/demos/SelectNativeDemo.rozie on all 6 targets.
 *
 * The Playwright project is desktop Chrome (fine pointer), so every test installs
 * COARSE_INIT: it overrides `matchMedia('(pointer: coarse)')` before any page script
 * runs and exposes `window.__setCoarse(bool)`, which flips `matches` and fires the
 * registered `change` listeners — the same two things the component reads.
 *
 * Behavioral assertions only (no screenshots). CSS / role locators pierce Lit's open
 * shadow roots. Negative checks are followed by an observable ordered after the
 * action (plus a demo-side counter that must not have moved), so none passes
 * vacuously. No `click({ force: true })`: what is clicked must really be on top.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

const COARSE_INIT = () => {
  let coarse = true;
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const real = window.matchMedia.bind(window);
  window.matchMedia = ((q: string) => {
    if (q !== '(pointer: coarse)') return real(q);
    return {
      get matches() { return coarse; }, media: q, onchange: null,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
      addListener: (fn: (e: { matches: boolean }) => void) => listeners.add(fn),
      removeListener: (fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  (window as unknown as { __setCoarse: (v: boolean) => void }).__setCoarse = (v) => {
    coarse = v; listeners.forEach((fn) => fn({ matches: v }));
  };
};

const setCoarse = (page: Page, v: boolean) =>
  page.evaluate((x) => (window as unknown as { __setCoarse: (b: boolean) => void }).__setCoarse(x), v);

/** Load the demo with the coarse override installed and prove it took effect. */
const openCoarse = async (page: Page, target: string) => {
  await page.addInitScript(COARSE_INIT);
  await page.goto(`/?example=SelectNative&target=${target}`);
  await expect(page.getByTestId('single').locator('[role="combobox"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);
  expect(await page.evaluate(() => typeof (window as unknown as { __setCoarse?: unknown }).__setCoarse)).toBe('function');
};

const BANANA_PAYLOAD = '{"value":"banana","option":{"label":"Banana","value":"banana","group":"fruit"}}';
const NATIVE = 'select.rozie-select-native';
const OPEN_LISTBOX = '[role="listbox"]:visible';

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  runner(`select-native [${target}]: coarse pointer uses the OS select; commits match the custom path`, async ({ page }) => {
    await openCoarse(page, target);
    const single = page.getByTestId('single');
    const native = single.locator(NATIVE);
    const trigger = single.locator('[role="combobox"]');
    await expect(native).toHaveCount(1);
    // accessibility: the native element is the control; the custom trigger steps aside
    await expect(native).toHaveAttribute('aria-label', 'Drink');
    await expect(trigger).toHaveAttribute('aria-hidden', 'true');
    await expect(trigger).toHaveAttribute('tabindex', '-1');
    await expect(native).not.toHaveAttribute('name', /.*/); // no form participation
    // the overlay styling is scoped to a root modifier class that only native-active selects carry
    await expect(single.locator('.rozie-select')).toHaveClass(/(^|\s)rozie-select--native(\s|$)/);
    await expect(page.getByTestId('off').locator('.rozie-select')).not.toHaveClass(/rozie-select--native/);
    await expect(page.getByTestId('multi').locator('.rozie-select')).not.toHaveClass(/rozie-select--native/);
    await expect(native).toHaveJSProperty('multiple', false);
    // grouped structure: ungrouped options first as direct children, then one <optgroup>
    await expect(native.locator(':scope > option')).toHaveText(['Pick', 'Water', 'Seven', 'Box']);
    await expect(native.locator('optgroup')).toHaveCount(1);
    await expect(native.locator('optgroup')).toHaveAttribute('label', 'Fruit');
    await expect(native.locator('optgroup > option')).toHaveText(['Apple', 'Banana']);
    await expect(native.locator('option[disabled]')).toHaveText(['Water']);
    // no value yet: the placeholder option is the checked one
    await expect(native).toHaveValue('');
    await expect(native.locator('option:checked')).toHaveText('Pick');
    // a real tap lands on the native element (it takes focus), never on the custom popup
    await single.locator('.rozie-select-control').click({ position: { x: 20, y: 10 } });
    await expect(native).toBeFocused();
    await page.keyboard.press('Escape'); // dismiss the browser's own dropdown
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(OPEN_LISTBOX)).toHaveCount(0);
    // commit through the native element
    await native.selectOption({ label: 'Banana' });
    await expect(page.getByTestId('readout-value')).toHaveText('banana');
    await expect(page.getByTestId('readout-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-payload')).toHaveText(BANANA_PAYLOAD);
    await expect(native).toHaveValue(/^\d+$/);
    await expect(native.locator('option:checked')).toHaveText('Banana');
    // the same commit through the custom popup (no nativePicker) carries the same payload
    const off = page.getByTestId('off');
    await expect(off.locator(NATIVE)).toHaveCount(0); // opt-in only
    const offTrigger = off.locator('[role="combobox"]');
    await expect(offTrigger).not.toHaveAttribute('aria-hidden', /.*/);
    await expect(offTrigger).toHaveAttribute('tabindex', '0');
    await offTrigger.click();
    await expect(offTrigger).toHaveAttribute('aria-expanded', 'true');
    await page.locator('[role="option"]:visible', { hasText: 'Banana' }).click();
    await expect(page.getByTestId('readout-off-payload')).toHaveText(BANANA_PAYLOAD);
    // non-string values survive the round trip: a number stays a number …
    await native.selectOption({ label: 'Seven' });
    await expect(page.getByTestId('readout-value')).toHaveText('7');
    await expect(page.getByTestId('readout-type')).toHaveText('number');
    await expect(page.getByTestId('readout-changes')).toHaveText('2');
    await expect(native.locator('option:checked')).toHaveText('Seven');
    // … and an object value comes back as the very same reference
    await native.selectOption({ label: 'Box' });
    await expect(page.getByTestId('readout-type')).toHaveText('object');
    await expect(page.getByTestId('readout-same')).toHaveText('true');
    await expect(page.getByTestId('readout-changes')).toHaveText('3');
    // a model change from outside is reflected by the native element
    await page.getByTestId('set-apple').click();
    await expect(page.getByTestId('readout-value')).toHaveText('apple');
    await expect(native.locator('option:checked')).toHaveText('Apple');
    await page.getByTestId('set-none').click();
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(native.locator('option:checked')).toHaveText('Pick');
    await expect(native).toHaveValue('');
    await page.getByTestId('set-apple').click();
    await expect(native.locator('option:checked')).toHaveText('Apple');
    await expect(page.getByTestId('readout-changes')).toHaveText('3'); // outside writes are not commits
    // the clear button stays tappable above the overlay (a real click) and clears
    await single.locator('.rozie-select-clear').click();
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(page.getByTestId('readout-changes')).toHaveText('4');
    await expect(page.getByTestId('readout-payload')).toHaveText('{"value":null,"option":null}');
    await expect(native.locator('option:checked')).toHaveText('Pick');
    await expect(native).toBeFocused(); // focus goes to the element that is the control now
    await expect(single.locator('.rozie-select-clear')).toHaveCount(0);
    // nothing above went through the custom popup of this select
    await expect(page.getByTestId('readout-opens')).toHaveText('0');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  runner(`select-native [${target}]: fine pointer keeps the custom popup; flipping to coarse while open hands over without losing the value`, async ({ page }) => {
    await openCoarse(page, target);
    const single = page.getByTestId('single');
    const trigger = single.locator('[role="combobox"]');
    await expect(single.locator(NATIVE)).toHaveCount(1);
    await setCoarse(page, false);
    // native inactive: no native element in the DOM, the trigger is the control again
    await expect(single.locator(NATIVE)).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute('aria-hidden', /.*/);
    await expect(trigger).toHaveAttribute('tabindex', '0');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-value')).not.toHaveText('');
    const picked = await page.getByTestId('readout-value').textContent();
    expect(picked).toBe('7'); // first enabled option in visual order (Water is disabled)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('readout-opens')).toHaveText('2'); // opened, closed by the commit
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('readout-opens')).toHaveText('3');
    await setCoarse(page, true);
    const native = single.locator(NATIVE);
    await expect(native).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(OPEN_LISTBOX)).toHaveCount(0);
    await expect(page.getByTestId('readout-value')).toHaveText(picked!);
    await expect(native.locator('option:checked')).toHaveText('Seven');
    // exactly ONE open-change {open:false} for the hand-over
    await expect(page.getByTestId('readout-opens')).toHaveText('4');
    await expect(page.getByTestId('readout-changes')).toHaveText('1');
    // and back: coarse -> fine with a value selected restores the custom trigger
    await native.selectOption({ label: 'Banana' });
    await expect(page.getByTestId('readout-value')).toHaveText('banana');
    await setCoarse(page, false);
    await expect(single.locator(NATIVE)).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute('aria-hidden', /.*/);
    await expect(trigger).toHaveAttribute('tabindex', '0');
    await expect(single.locator('.rozie-select-selected')).toHaveText('Banana');
    await expect(page.getByTestId('readout-value')).toHaveText('banana');
    // the custom popup works again, and the hand-back itself emitted no open-change
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('readout-opens')).toHaveText('5');
  });

  runner(`select-native [${target}]: multiple never uses the native picker; the custom popup and chips work as usual`, async ({ page }) => {
    await openCoarse(page, target);
    const multi = page.getByTestId('multi');
    const trigger = multi.locator('[role="combobox"]');
    // wait for the coarse state to have been applied (a single-select sibling went native)
    await expect(page.getByTestId('single').locator(NATIVE)).toHaveCount(1);
    await expect(multi.locator(NATIVE)).toHaveCount(0);
    await expect(multi.locator('select')).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute('aria-hidden', /.*/);
    await expect(trigger).toHaveAttribute('tabindex', '0');
    await expect(multi.locator('.rozie-select-chip__label')).toHaveText(['Apple']);
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.locator('[role="option"]:visible', { hasText: 'Banana' }).click();
    await expect(page.getByTestId('readout-multi')).toHaveText('apple,banana');
    await expect(page.getByTestId('readout-multi-changes')).toHaveText('1');
    await expect(multi.locator('.rozie-select-chip__label')).toHaveText(['Apple', 'Banana']);
    await multi.locator('.rozie-select-chip__remove').first().click();
    await expect(page.getByTestId('readout-multi')).toHaveText('banana');
    await expect(page.getByTestId('readout-multi-changes')).toHaveText('2');
    await expect(multi.locator('.rozie-select-chip__label')).toHaveText(['Banana']);
    await expect(multi.locator(NATIVE)).toHaveCount(0);
  });

  runner(`select-native [${target}]: the placeholder option clears only when clearable; otherwise it is disabled and a forced choice snaps back`, async ({ page }) => {
    await openCoarse(page, target);
    // NOT clearable, holding a value: the placeholder entry is disabled
    const plain = page.getByTestId('plain');
    const pNative = plain.locator(NATIVE);
    await expect(pNative.locator('option')).toHaveText(['Choose', 'Apple', 'Banana', 'Water', 'Seven']);
    await expect(pNative.locator('option:checked')).toHaveText('Banana');
    await expect(pNative.locator('option').first()).toBeDisabled();
    await expect(plain.locator('.rozie-select-clear')).toHaveCount(0);
    // safety net: a `change` that lands on the placeholder anyway (a disabled option cannot
    // be picked through selectOption, so the element is driven directly) changes nothing
    // and the element goes back to the real selection
    const forced = await pNative.evaluate((el: HTMLSelectElement) => {
      el.value = '';
      const seen = el.selectedOptions[0]?.textContent ?? null;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return seen;
    });
    expect(forced).toBe('Choose'); // the element really was on the placeholder
    await expect(pNative.locator('option:checked')).toHaveText('Banana');
    await expect(pNative).toHaveValue('1');
    // ordered after: a real commit is change #1, so the placeholder was not one
    await pNative.selectOption({ label: 'Apple' });
    await expect(page.getByTestId('readout-plain')).toHaveText('apple');
    await expect(page.getByTestId('readout-plain-changes')).toHaveText('1');
    await expect(pNative.locator('option:checked')).toHaveText('Apple');
    // NOT clearable with NO value: the placeholder is what is shown, and it is not disabled
    const dNative = page.getByTestId('dyn').locator(NATIVE);
    await expect(dNative.locator('option:checked')).toHaveText('Dyn');
    await expect(dNative.locator('option').first()).toBeEnabled();
    await dNative.selectOption({ label: 'Banana' });
    await expect(page.getByTestId('readout-dyn')).toHaveText('banana');
    await expect(dNative.locator('option').first()).toBeDisabled();
    // clearable: the placeholder stays enabled, and choosing it clears
    const single = page.getByTestId('single');
    const native = single.locator(NATIVE);
    await native.selectOption({ label: 'Apple' });
    await expect(page.getByTestId('readout-value')).toHaveText('apple');
    await expect(page.getByTestId('readout-changes')).toHaveText('1');
    await expect(native.locator('option').first()).toBeEnabled();
    await native.selectOption({ index: 0 });
    await expect(page.getByTestId('readout-value')).toHaveText('');
    await expect(page.getByTestId('readout-changes')).toHaveText('2');
    await expect(page.getByTestId('readout-payload')).toHaveText('{"value":null,"option":null}');
    await expect(native.locator('option:checked')).toHaveText('Pick');
    await expect(page.getByTestId('readout-opens')).toHaveText('0');
  });

  runner(`select-native [${target}]: a commit that is not accepted snaps the native element back`, async ({ page }) => {
    await openCoarse(page, target);
    const native = page.getByTestId('guarded').locator(NATIVE);
    await expect(native.locator('option:checked')).toHaveText('Apple');
    // (1) refused by the Select itself: a `change` landing on a DISABLED option (it cannot be
    // picked through selectOption, so the element is driven directly). The model does not
    // change, so no prop comes back and only the end-of-commit sync can restore the element.
    const forced = await native.evaluate((el: HTMLSelectElement) => {
      el.value = '2';
      const seen = el.selectedOptions[0]?.textContent ?? null;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return seen;
    });
    expect(forced).toBe('Water'); // the element really was on the refused option
    await expect(native.locator('option:checked')).toHaveText('Apple');
    await expect(native).toHaveValue('0');
    // (2) refused by the consumer, which writes the last accepted value back
    await native.selectOption({ label: 'Banana' });
    await expect(page.getByTestId('readout-rejected')).toHaveText('1'); // the write-back ran
    await expect(page.getByTestId('readout-guarded')).toHaveText('apple');
    await expect(native.locator('option:checked')).toHaveText('Apple');
    await expect(native).toHaveValue('0');
    await expect(page.getByTestId('readout-guarded-changes')).toHaveText('1'); // (1) was no commit
    // an accepted commit still goes through, and a second rejection snaps back to IT
    await native.selectOption({ label: 'Seven' });
    await expect(page.getByTestId('readout-guarded')).toHaveText('7');
    await expect(native.locator('option:checked')).toHaveText('Seven');
    await native.selectOption({ label: 'Banana' });
    await expect(page.getByTestId('readout-rejected')).toHaveText('2');
    await expect(page.getByTestId('readout-guarded')).toHaveText('7');
    await expect(native.locator('option:checked')).toHaveText('Seven');
    await expect(page.getByTestId('readout-guarded-changes')).toHaveText('3');
  });

  runner(`select-native [${target}]: an object-valued option shows as the selected one after it is committed`, async ({ page }) => {
    // EXPECTED FAILURE on Vue and Svelte — a known bug this test is the repro for, NOT a
    // property of the native picker: the consumer's reactive state hands the committed
    // object back wrapped in a proxy, and the spine's `isSelected` (listCore.rzts)
    // compares `valueOf(opt) === $props.value` by identity, so no option counts as
    // selected (the custom trigger shows the placeholder too). The commit itself returns
    // the same reference on all six (asserted below and in the first test). Remove this
    // marker when the proxy-identity bug is fixed: the test then fails as "expected to
    // fail, but passed".
    test.fail(target === 'vue' || target === 'svelte', 'object option values are not recognised as selected through a reactive proxy (isSelected identity compare)');
    await openCoarse(page, target);
    const native = page.getByTestId('single').locator(NATIVE);
    await native.selectOption({ label: 'Box' });
    await expect(page.getByTestId('readout-same')).toHaveText('true');
    await expect(page.getByTestId('readout-type')).toHaveText('object');
    await expect(native.locator('option:checked')).toHaveText('Box');
  });

  runner(`select-native [${target}]: swapping options or groups at runtime keeps the native element on the same logical option`, async ({ page }) => {
    await openCoarse(page, target);
    const native = page.getByTestId('dyn').locator(NATIVE);
    const looseTexts = native.locator(':scope > option');
    const groupLabels = () => native.locator('optgroup').evaluateAll((els) => els.map((e) => e.getAttribute('label')));
    await expect(looseTexts).toHaveText(['Dyn', 'Water']);
    await expect.poll(groupLabels).toEqual(['Fruit', 'veg']);
    await expect(native.locator('optgroup > option')).toHaveText(['Apple', 'Banana', 'Carrot']);
    await native.selectOption({ label: 'Banana' });
    await expect(page.getByTestId('readout-dyn')).toHaveText('banana');
    await expect(native.locator('option:checked')).toHaveText('Banana');
    // (b) groups swapped: the <optgroup>s follow, the selection is the same option
    await page.getByTestId('swap-groups').click();
    await expect.poll(groupLabels).toEqual(['Vegetables', 'Fruit']);
    await expect(native.locator('optgroup > option')).toHaveText(['Carrot', 'Apple', 'Banana']);
    await expect(native.locator('option:checked')).toHaveText('Banana');
    await expect(page.getByTestId('readout-dyn')).toHaveText('banana');
    // (a) options swapped (Banana moves to another index): still Banana
    await page.getByTestId('swap-options').click();
    await expect(native.locator('optgroup > option')).toHaveText(['Carrot', 'Banana', 'Date']);
    await expect(looseTexts).toHaveText(['Dyn', 'Water']);
    await expect(native.locator('option:checked')).toHaveText('Banana');
    await expect(page.getByTestId('readout-dyn')).toHaveText('banana');
    // back, pick Apple, then swap to the set that has no Apple: the placeholder shows,
    // the model is untouched and nothing was committed
    await page.getByTestId('swap-options').click();
    await expect(native.locator('optgroup > option')).toHaveText(['Carrot', 'Apple', 'Banana']);
    await expect(native.locator('option:checked')).toHaveText('Banana');
    await native.selectOption({ label: 'Apple' });
    await expect(page.getByTestId('readout-dyn')).toHaveText('apple');
    await expect(page.getByTestId('readout-dyn-changes')).toHaveText('2');
    await page.getByTestId('swap-options').click();
    await expect(native.locator('optgroup > option')).toHaveText(['Carrot', 'Banana', 'Date']);
    await expect(native.locator('option:checked')).toHaveText('Dyn');
    await expect(native).toHaveValue('');
    await expect(page.getByTestId('readout-dyn')).toHaveText('apple');
    // and it comes back with the option
    await page.getByTestId('swap-options').click();
    await expect(native.locator('optgroup > option')).toHaveText(['Carrot', 'Apple', 'Banana']);
    await expect(native.locator('option:checked')).toHaveText('Apple');
    await expect(page.getByTestId('readout-dyn-changes')).toHaveText('2');
    await expect(page.getByTestId('readout-dyn-opens')).toHaveText('0');
  });

  runner(`select-native [${target}]: nativePicker and virtual switched at runtime hand over in both directions`, async ({ page }) => {
    await openCoarse(page, target);
    const dyn = page.getByTestId('dyn');
    const native = dyn.locator(NATIVE);
    const trigger = dyn.locator('[role="combobox"]');
    await native.selectOption({ label: 'Banana' });
    await expect(page.getByTestId('readout-dyn')).toHaveText('banana');
    // (c) nativePicker off: the native element goes, the custom trigger shows the value
    await page.getByTestId('toggle-native').click();
    await expect(native).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute('aria-hidden', /.*/);
    await expect(trigger).toHaveAttribute('tabindex', '0');
    await expect(dyn.locator('.rozie-select-selected')).toHaveText('Banana');
    await expect(page.getByTestId('readout-dyn-opens')).toHaveText('0');
    // open the custom popup, then switch nativePicker on underneath it
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('readout-dyn-opens')).toHaveText('1');
    await page.evaluate(() => (globalThis as unknown as { __selectNativeDemo: { setNative: (on: boolean) => void } }).__selectNativeDemo.setNative(true));
    await expect(native).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(OPEN_LISTBOX)).toHaveCount(0);
    await expect(native.locator('option:checked')).toHaveText('Banana');
    await expect(page.getByTestId('readout-dyn')).toHaveText('banana');
    await expect(page.getByTestId('readout-dyn-opens')).toHaveText('2'); // exactly one {open:false}
    // (d) virtual on while native is active: the native element goes
    await page.getByTestId('toggle-virtual').click();
    await expect(native).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute('aria-hidden', /.*/);
    // … and comes back, on the same option, when virtual goes off again
    await page.getByTestId('toggle-virtual').click();
    await expect(native).toHaveCount(1);
    await expect(native.locator('option:checked')).toHaveText('Banana');
    await expect(page.getByTestId('readout-dyn')).toHaveText('banana');
    await expect(page.getByTestId('readout-dyn-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-dyn-opens')).toHaveText('2');
  });

  runner(`select-native [${target}]: keys and clicks never open the custom popup; virtual, inline and disabled opt out`, async ({ page }) => {
    await openCoarse(page, target);
    const single = page.getByTestId('single');
    const native = single.locator(NATIVE);
    const trigger = single.locator('[role="combobox"]');
    await expect(native).toHaveCount(1);
    // keys on the (programmatically focused) custom trigger do nothing
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.keyboard.press('b'); // type-ahead
    await page.keyboard.press('Enter');
    // clicks on the control land on the native element: start, middle and the arrow
    const control = single.locator('.rozie-select-control');
    const box = (await control.boundingBox())!;
    for (const x of [6, box.width / 2, box.width - 8]) {
      await control.click({ position: { x, y: box.height / 2 } });
      await expect(native).toBeFocused();
      await page.keyboard.press('Escape'); // dismiss the browser's own dropdown
    }
    // ordered after all of it: a native commit is change #1 and nothing ever opened
    await native.selectOption({ label: 'Apple' });
    await expect(page.getByTestId('readout-value')).toHaveText('apple');
    await expect(page.getByTestId('readout-changes')).toHaveText('1');
    await expect(page.getByTestId('readout-opens')).toHaveText('0');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(OPEN_LISTBOX)).toHaveCount(0);

    // `virtual` keeps the custom popup even on a coarse pointer
    const virt = page.getByTestId('virt');
    await expect(virt.locator(NATIVE)).toHaveCount(0);
    const vTrigger = virt.locator('[role="combobox"]');
    await expect(vTrigger).not.toHaveAttribute('aria-hidden', /.*/);
    await expect(vTrigger).toHaveAttribute('tabindex', '0');
    await vTrigger.click();
    await expect(vTrigger).toHaveAttribute('aria-expanded', 'true');
    await page.locator('[role="option"]:visible', { hasText: 'Banana' }).click();
    await expect(page.getByTestId('readout-virt')).toHaveText('banana');

    // `inline` likewise
    const inl = page.getByTestId('inl');
    await expect(inl.locator(NATIVE)).toHaveCount(0);
    const iTrigger = inl.locator('[role="combobox"]');
    await expect(iTrigger).not.toHaveAttribute('aria-hidden', /.*/);
    await iTrigger.click();
    await expect(iTrigger).toHaveAttribute('aria-expanded', 'true');
    await page.locator('[role="option"]:visible', { hasText: 'Apple' }).click();
    await expect(page.getByTestId('readout-inl')).toHaveText('apple');

    // `disabled` disables the native element (and it still shows the value)
    const locked = page.getByTestId('locked').locator(NATIVE);
    await expect(locked).toHaveCount(1);
    await expect(locked).toBeDisabled();
    await expect(locked.locator('option:checked')).toHaveText('Apple');
  });
}
