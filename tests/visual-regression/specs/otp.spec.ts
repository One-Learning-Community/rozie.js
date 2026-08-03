import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepActiveElementProbeInPage } from './_shadow-utils';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * OTP behavioral smoke — pure-Rozie WAI-ARIA one-time-code input (`Otp`).
 *
 * `Otp` is a pure-Rozie family (NO third-party engine): the PLATFORM is the
 * engine — N native `<input>` cells, browser focus, and keyboard come for free.
 * Rozie owns the author-side API: the two-way `value` binding, the sanitize/
 * distribute logic, and the `@complete` emit when every cell is filled. This spec
 * proves the controlled segmented-input primitive (single `value` model →
 * `cells()` derived view, `commitValue` write funnel, `@complete`) produces
 * identical behaviour across all 6 targets.
 *
 * `examples/demos/OtpBehaviorDemo.rozie` drives a 6-cell numeric OTP, a two-way
 * `r-model:value` (live `readout-code`), a `set-code` direct-model-write button
 * (→ '123'), a `@complete` readout (`readout-complete`), and (260802-p7g
 * shore-up) `toggle-mask` / `toggle-disabled` buttons driving the previously-
 * VR-untestable `mask` / `disabled` static props.
 *
 * Three test titles cover the family:
 *   - `otp [t]` — the original smoke (render, type, set-code, @complete) plus
 *     (260802-p7g) an overwrite-a-filled-cell strengthening step.
 *   - `otp-keyboard [t]` (260802-p7g, NEW) — paste distribution, backspace
 *     navigation, arrow/Home/End focus movement.
 *   - `otp-modes [t]` (260802-p7g, NEW) — mask rendering, disabled state.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Like slider.spec.ts / listbox.spec.ts, this runs locally on
 * macOS without a Docker baseline.
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
  runner(`otp [${target}]: 6 cells render, typing reflects into value, set-code writes, completing fires @complete`, async ({
    page,
  }) => {
    await page.goto(`/?example=OtpBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // ---- 1. six native input cells render (the CSS locator pierces Lit shadow) ----
    const cells = page.locator('input');
    await expect(cells.first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => cells.count(), { timeout: 15_000 })
      .toBe(6);

    const code = page.getByTestId('readout-code');
    const complete = page.getByTestId('readout-complete');
    await expect(code).toHaveText('');
    await expect(complete).toHaveText('');

    // ---- 2. type a digit into the first cell → readout-code reflects it ----
    await cells.nth(0).fill('9');
    await expect
      .poll(async () => (await code.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('9');

    // ---- 3. set-code direct-model write (→ '123') reflects into cells + readout ----
    await page.getByTestId('set-code').click();
    await expect
      .poll(async () => (await code.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('123');
    await expect(cells.nth(0)).toHaveValue('1');
    await expect(cells.nth(1)).toHaveValue('2');
    await expect(cells.nth(2)).toHaveValue('3');

    // ---- 4. type the rest to reach length 6 → @complete fires with the full code ----
    await cells.nth(3).fill('4');
    await cells.nth(4).fill('5');
    await cells.nth(5).fill('6');
    await expect
      .poll(async () => (await code.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('123456');
    await expect
      .poll(async () => (await complete.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('123456');

    // ---- 5. overwriting a filled cell takes the LAST char typed ----
    // Locks onInput's documented "take the LAST char typed (handles
    // overwriting a filled cell)" branch (Otp.rozie L205-206), currently
    // untested. `.fill('7')` on an already-filled cell 0 ('1') replaces its
    // DOM value with '7'; onInput reads `e.target.value.slice(-1)` === '7'.
    await cells.nth(0).fill('7');
    await expect
      .poll(async () => (await code.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('723456');
  });
}

/**
 * otp-keyboard [t] (260802-p7g, NEW) — paste distribution, backspace
 * navigation, arrow-key focus movement. Every step asserts a behavior
 * `Otp.rozie`'s handlers document (`onPaste` L246-256, `onKeydown` L219-243)
 * but that the original single-title spec never exercised.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(
    `otp-keyboard [${target}]: paste distributes a full code, backspace walks back, arrows move focus`,
    async ({ page }) => {
      await page.goto(`/?example=OtpBehavior&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      const cells = page.locator('input');
      await expect(cells.first()).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(async () => cells.count(), { timeout: 15_000 })
        .toBe(6);

      const code = page.getByTestId('readout-code');
      const complete = page.getByTestId('readout-complete');

      // ---- 1. paste at cell 0 distributes a full code across all 6 cells ----
      // onPaste(i=0, e): chars = '987654'.split('').filter(allowChar) (all
      // digits, type="numeric") → arr = code().split('') = [] → arr[0..5] set
      // to the 6 chars → commitValue('987654') (Otp.rozie L246-253).
      await cells.nth(0).evaluate((el) => {
        const dt = new DataTransfer();
        dt.setData('text', '987654');
        el.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
        );
      });
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('987654');
      await expect(cells.nth(0)).toHaveValue('9');
      await expect(cells.nth(1)).toHaveValue('8');
      await expect(cells.nth(2)).toHaveValue('7');
      await expect(cells.nth(3)).toHaveValue('6');
      await expect(cells.nth(4)).toHaveValue('5');
      await expect(cells.nth(5)).toHaveValue('4');

      // ---- 2. a full-code paste ALSO fires @complete ----
      // A 6-char paste fills every cell, so commitValue's length check emits
      // 'complete' — a distinct code path into the emit (paste, not per-cell
      // input) that was previously untested.
      await expect
        .poll(async () => (await complete.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('987654');

      // ---- 3. backspace on a FILLED cell deletes IN PLACE, no focus move ----
      // cur = '987654', i = 3 (cur[3] = '6', truthy) →
      // commitValue(cur.slice(0,3) + cur.slice(4)) = '987' + '54' = '98754'
      // (Otp.rozie L222-225 — the non-empty branch never calls focusIndex).
      await cells.nth(3).press('Backspace');
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('98754');

      // ---- 4. backspace on an EMPTY cell deletes the PREVIOUS char AND
      // moves focus back ----
      // After step 3, code = '98754' (length 5, 5 cells filled 0..4) — cell
      // index 5 is the only empty cell (cells() reads v[5] === undefined →
      // ''). cur[5] is falsy → the i > 0 branch: commitValue(cur.slice(0,4) +
      // cur.slice(5)) = '9875' + '' = '9875', then focusIndex(4) (Otp.rozie
      // L226-228) → cell index 4 ('Digit 5 of 6').
      await cells.nth(5).press('Backspace');
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('9875');
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 5 of 6');

      // ---- 5. arrow-key movement — focus a middle cell first (deterministic,
      // independent of the backspace steps above) ----
      await cells.nth(2).focus();
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 3 of 6');

      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 4 of 6');

      await page.keyboard.press('ArrowLeft');
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 3 of 6');

      await page.keyboard.press('ArrowLeft');
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 2 of 6');

      // ---- optional: Home / End jump to the first / last cell ----
      await page.keyboard.press('Home');
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 1 of 6');

      await page.keyboard.press('End');
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 6 of 6');
    },
  );
}

/**
 * otp-modes [t] (260802-p7g, NEW) — mask rendering, disabled state. Both
 * props are static-only in the original fixture (cannot be driven from a
 * spec) — `OtpBehaviorDemo.rozie` now wires `:mask="$data.masked"` /
 * `:disabled="$data.isDisabled"` to two additive toggle buttons for exactly
 * this purpose.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(
    `otp-modes [${target}]: mask renders password cells, disabled blocks entry and flags the host`,
    async ({ page }) => {
      await page.goto(`/?example=OtpBehavior&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      const cells = page.locator('input');
      await expect(cells.first()).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(async () => cells.count(), { timeout: 15_000 })
        .toBe(6);

      // ---- 1. mask mode — cellType() flips 'text' → 'password' and back,
      // proving the :type binding is reactive, not just initially correct
      // (Otp.rozie L264) ----
      for (let i = 0; i < 6; i++) {
        await expect(cells.nth(i)).toHaveAttribute('type', 'text');
      }
      await page.getByTestId('toggle-mask').click();
      for (let i = 0; i < 6; i++) {
        await expect(cells.nth(i)).toHaveAttribute('type', 'password');
      }
      await page.getByTestId('toggle-mask').click();
      for (let i = 0; i < 6; i++) {
        await expect(cells.nth(i)).toHaveAttribute('type', 'text');
      }

      // ---- 2. disabled state — every cell disabled AND the container
      // carries .rozie-otp--disabled (an object :class binding, Otp.rozie
      // L296 — a genuine cross-target divergence surface). Do NOT try to
      // type into a disabled cell: Playwright's fill/press auto-wait for
      // enabled and would time out rather than assert anything — toBeDisabled
      // + the host class is the correct, non-flaky assertion. ----
      await page.getByTestId('toggle-disabled').click();
      for (let i = 0; i < 6; i++) {
        await expect(cells.nth(i)).toBeDisabled();
      }
      const group = page.locator('.rozie-otp');
      await expect(group).toHaveClass(/rozie-otp--disabled/);
    },
  );
}
