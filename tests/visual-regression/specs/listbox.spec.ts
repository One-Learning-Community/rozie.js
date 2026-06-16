import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Listbox behavioral smoke — pure-Rozie WAI-ARIA listbox / combobox (`Listbox`).
 *
 * `Listbox` is the FIRST @rozie-ui component with NO third-party vanilla engine:
 * every behaviour — roving virtual focus (`aria-activedescendant`), keyboard
 * navigation, type-ahead, single/multi select — is authored in Rozie itself. So
 * this spec is the proof the NATIVE author-side primitives ($computed,
 * parameterized @keydown modifiers, $refs focus, two-way r-model, scoped slots)
 * produce identical behaviour across all 6 targets.
 * `examples/demos/ListboxBehaviorDemo.rozie` drives a fixed 5-option array,
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
  runner(`listbox [${target}]: mounts, opens via keyboard, options render, Enter commits two-way value, model-write reflects selection`, async ({
    page,
  }) => {
    await page.goto(`/?example=ListboxBehavior&target=${target}`);
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
}

// ---------------------------------------------------------------------------
// Combobox mode — the type-to-filter path ($computed-derived `visibleOptions`
// filter + the search event + two-way value), proven across all 6 targets.
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`listbox-combobox [${target}]: typing filters options, search event fires, Enter commits the filtered match`, async ({
    page,
  }) => {
    await page.goto(`/?example=ListboxCombobox&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const value = page.getByTestId('readout-value');
    const query = page.getByTestId('readout-query');
    await expect(value).toHaveText('');
    await expect(query).toHaveText('');

    // Type "ch" → opens + filters to the single label containing it (Cherry),
    // and each keystroke fires the `search` event (echoed into readout-query).
    await input.focus();
    await input.pressSequentially('ch', { delay: 30 });
    await expect
      .poll(async () => (await query.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('ch');
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('Cherry');

    // The first match is auto-highlighted on filter — Enter commits it.
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await value.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('cherry');
    // closeOnSelect → the popup closed.
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(0);
  });
}
