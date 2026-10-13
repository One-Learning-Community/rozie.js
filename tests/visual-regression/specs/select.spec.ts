import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select behavioral smoke — pure-Rozie WAI-ARIA select / combobox (`Select`).
 *
 * `Select` is the FIRST @rozie-ui component with NO third-party vanilla engine:
 * every behaviour — roving virtual focus (`aria-activedescendant`), keyboard
 * navigation, type-ahead, single/multi select — is authored in Rozie itself. So
 * this spec is the proof the NATIVE author-side primitives ($computed,
 * parameterized @keydown modifiers, $refs focus, two-way r-model, scoped slots)
 * produce identical behaviour across all 6 targets.
 * `examples/demos/SelectBehaviorDemo.rozie` drives a fixed 5-option array,
 * single-select, a two-way `r-model:value`, and a `set-value` direct-model-write
 * button.
 *
 *   1. **Mount + open + options render (all 6 targets).** The control
 *      (`[role="combobox"]`) mounts; ArrowDown opens the popup and renders 5
 *      `[role="option"]` — proving the $computed-derived list + r-if popup work
 *      (and, on Lit, that the open shadow root exposes the options).
 *
 *   2. **Keyboard navigation + commit (all 6 targets).** ArrowDown roves the
 *      virtual highlight; Enter commits the active option, which writes
 *      `$model.value` → the parent's bound `$data.value` → the live
 *      `readout-value` — the two-way round-trip OUT. Commit also closes the popup
 *      (closeOnSelect), so the options unmount.
 *
 *   3. **Two-way value WRITE path + selection reflection (all 6 targets).**
 *      Clicking `set-value` writes `$data.value` DIRECTLY; the readout reflects it
 *      and, on reopen, the matching option carries `aria-selected="true"` — the
 *      model write flowed INTO the component. Escape then closes the popup.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Like embla-carousel.spec.ts / rete-flow.spec.ts, this spec
 * runs locally on macOS without a Docker baseline.
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
  runner(`select [${target}]: mounts, opens via keyboard, options render, Enter commits two-way value, model-write reflects selection`, async ({
    page,
  }) => {
    await page.goto(`/?example=SelectBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount + open + options render (the make-or-break) ----
    // The CSS / role locators pierce Lit's open shadow root.
    const control = page.locator('[role="combobox"]').first();
    await expect(control).toBeVisible({ timeout: 15_000 });

    const readout = page.getByTestId('readout-value');
    await expect(readout).toHaveText('');

    // ArrowDown on the focused control opens the popup (virtual focus stays on
    // the control). DOM focus never leaves the control — that is the APG pattern.
    await control.focus();
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 15_000,
      })
      .toBe(5);
    // No selection committed yet — opening only highlights.
    await expect(readout).toHaveText('');

    // ---- 2. keyboard navigation + Enter commit (two-way round-trip OUT) ----
    // Open set active → option 0 (Apple). Two ArrowDowns → option 2 (Cherry).
    await page.keyboard.press('ArrowDown'); // active → 1 (Banana)
    await page.keyboard.press('ArrowDown'); // active → 2 (Cherry)
    await page.keyboard.press('Enter'); // commit Cherry → value 'cherry'
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('cherry');
    // closeOnSelect (single-select) → the popup closed, options unmounted.
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(0);

    // ---- 3. direct model write reflects into the component (all 6) ----
    // Writing $data.value directly flows into the wrapper's `value` prop; the
    // readout (bound to the same $data.value) reflects it immediately.
    await page.getByTestId('set-value').click();
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('elderberry');

    // Reopen — the option matching the model-written value carries
    // aria-selected="true" (the model write reached the component's render).
    await control.focus();
    await page.keyboard.press('ArrowDown');
    const selectedOption = page.locator('[role="option"][aria-selected="true"]');
    await expect(selectedOption).toHaveCount(1);
    await expect(selectedOption).toContainText('Elderberry');

    // ---- Escape closes the popup ----
    await page.keyboard.press('Escape');
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(0);
  });

  runner(`select [${target}]: hideEmpty shows no popup for an empty list; selectOnTab commits the active option`, async ({ page }) => {
    await page.goto(`/?example=SelectBehavior&target=${target}`);
    // --- hideEmpty + empty options ---
    const empty = page.getByTestId('empty-select').locator('[role="combobox"]');
    await empty.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await page.keyboard.type('z');
    await expect(empty).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('empty-select').locator('[role="listbox"]')).toHaveCount(0);
    // No aria-activedescendant while the popup is hidden; Escape/Enter are left to the host.
    await expect(empty).not.toHaveAttribute('aria-activedescendant', /.+/);
    await page.evaluate(() => {
      const w = window as unknown as { __prevented: Record<string, boolean> };
      w.__prevented = {};
      document.addEventListener('keydown', (e) => { w.__prevented[e.key] = e.defaultPrevented; });
    });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    const emptyPrevented = await page.evaluate(() => (window as unknown as { __prevented: Record<string, boolean> }).__prevented);
    expect(emptyPrevented.Escape).toBe(false);
    expect(emptyPrevented.Enter).toBe(false);
    await expect(empty).toHaveAttribute('aria-expanded', 'false');
    // Contrast: on a normal open select Escape IS default-prevented and closes it.
    const main = page.getByTestId('main-select').locator('[role="combobox"]');
    await main.focus();
    await page.keyboard.press('ArrowDown');
    await expect(main).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    const mainPrevented = await page.evaluate(() => (window as unknown as { __prevented: Record<string, boolean> }).__prevented);
    expect(mainPrevented.Escape).toBe(true);
    await expect(main).toHaveAttribute('aria-expanded', 'false');
    // --- all-disabled list never activates a row ---
    const dis = page.getByTestId('disabled-select').locator('[role="combobox"]');
    await dis.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-disabled')).toHaveText('');
    await page.keyboard.press('Escape');
    // --- selectOnTab ---
    const tab = page.getByTestId('tab-select').locator('[role="combobox"]');
    await tab.focus();
    await page.keyboard.press('ArrowDown'); // open, active = first enabled (Apple)
    await page.keyboard.press('ArrowDown'); // Banana
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('readout-tab')).toHaveText('banana');
    // --- without selectOnTab, Tab only closes: no commit ---
    const plain = page.getByTestId('main-select').locator('[role="combobox"]');
    const before = (await page.getByTestId('readout-value').textContent())?.trim() ?? '';
    await plain.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('readout-value')).toHaveText(before);
  });

  runner(`select [${target}]: div trigger keeps button semantics (click, Space, Enter, disabled)`, async ({ page }) => {
    await page.goto(`/?example=SelectBehavior&target=${target}`);
    const root = page.getByTestId('main-select');
    const trigger = root.locator('[role="combobox"]');
    await expect(trigger).toHaveJSProperty('tagName', 'DIV');
    await expect(trigger).toHaveAttribute('tabindex', '0');
    // click on the control's padding/arrow (not the trigger text) opens
    await root.locator('.rozie-select-arrow').click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    // Space opens, Enter commits
    await page.keyboard.press(' ');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-value')).not.toHaveText('');
    // disabled: not focusable, not openable
    const dis = page.getByTestId('off-select').locator('[role="combobox"]');
    await expect(dis).toHaveAttribute('aria-disabled', 'true');
    await expect(dis).toHaveAttribute('tabindex', '-1');
    await page.getByTestId('off-select').locator('.rozie-select-control').click({ force: true });
    await expect(dis).toHaveAttribute('aria-expanded', 'false');
  });

  runner(`select [${target}]: one click on the trigger text toggles exactly once`, async ({ page }) => {
    await page.goto(`/?example=SelectBehavior&target=${target}`);
    const trigger = page.getByTestId('main-select').locator('[role="combobox"]');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  runner(`select [${target}]: disabled select ignores DOM clicks and keys (no pointer events)`, async ({ page }) => {
    await page.goto(`/?example=SelectBehavior&target=${target}`);
    const off = page.getByTestId('off-select');
    const dis = off.locator('[role="combobox"]');
    const readout = page.getByTestId('readout-off');
    await expect(dis).toHaveAttribute('aria-disabled', 'true');
    // DOM-level clicks bypass pointer-events:none, so the host guard is what holds.
    await off.locator('.rozie-select-control').dispatchEvent('click');
    await expect(dis).toHaveAttribute('aria-expanded', 'false');
    await dis.dispatchEvent('click');
    await expect(dis).toHaveAttribute('aria-expanded', 'false');
    await expect(off.locator('[role="listbox"]')).toHaveCount(0);
    // A click must not steal focus either.
    await expect(dis).not.toBeFocused();
    // Keyboard: focus programmatically (tabindex=-1), then drive keys.
    await dis.evaluate((el) => (el as HTMLElement).focus());
    await expect(dis).toBeFocused();
    // A disabled select must not swallow keys: the spine would preventDefault ArrowDown/Space
    // (page scroll suppressed) even though open() itself no-ops, so the host guard is what
    // leaves them to the browser.
    for (const key of ['ArrowDown', ' ']) {
      const prevented = await dis.evaluate((el, k) => {
        const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        return ev.defaultPrevented;
      }, key);
      expect(prevented, `keydown ${JSON.stringify(key)} on a disabled select is not consumed`).toBe(false);
    }
    for (const key of ['ArrowDown', ' ', 'Enter', 'a']) {
      await page.keyboard.press(key);
      await expect(dis).toHaveAttribute('aria-expanded', 'false');
      await expect(off.locator('[role="listbox"]')).toHaveCount(0);
      await expect(readout).toHaveText('');
    }
  });

  runner(`select [${target}]: End and Home scroll a list taller than its popup to the highlighted option`, async ({ page }) => {
    await page.goto(`/?example=SelectBehavior&target=${target}`);
    const wrap = page.getByTestId('long-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    // Whether the option sits entirely inside the list's own visible box.
    const inView = (label: string) => async () => {
      const l = await list.boundingBox();
      const o = await wrap.locator('[role="option"]', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).boundingBox();
      return !!l && !!o && o.y >= l.y - 1 && o.y + o.height <= l.y + l.height + 1;
    };
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect(wrap.locator('[role="option"]')).toHaveCount(40);
    expect(await inView('Row 40')()).toBe(false); // the list really overflows

    await page.keyboard.press('End');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-39$/);
    await expect.poll(inView('Row 40')).toBe(true);
    await page.keyboard.press('Home');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await expect.poll(inView('Row 1')).toBe(true);
    // One arrow step from each edge wraps to the other and scrolls there as well.
    await page.keyboard.press('ArrowUp');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-39$/);
    await expect.poll(inView('Row 40')).toBe(true);
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await expect.poll(inView('Row 1')).toBe(true);
  });
}

// ---------------------------------------------------------------------------
// (P3/D-03: Select's editable combobox / type-to-filter mode was retired — that
// behavior now lives in the @rozie-ui/combobox family and is covered by
// combobox.spec.ts. The former `select-combobox` cell + demo were removed.)
// ---------------------------------------------------------------------------
