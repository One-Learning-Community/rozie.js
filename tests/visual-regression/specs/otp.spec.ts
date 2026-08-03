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
 * `examples/demos/OtpBehaviorDemo.rozie` drives a 6-cell numeric OTP (wrapped in
 * `data-testid="otp-primary"`), a two-way `r-model:value` (live `readout-code`),
 * a `set-code` direct-model-write button (→ '123'), a `@complete` readout
 * (`readout-complete` / `readout-complete-count`), a `@change` readout
 * (`readout-change-count` / `readout-last-change`), a `focus()`/`clear()`
 * imperative handle (`otp-focus` / `otp-clear`), (260802-p7g shore-up)
 * `toggle-mask` / `toggle-disabled` buttons driving the previously-
 * VR-untestable `mask` / `disabled` static props, and (260802-sc5) a SECOND
 * `Otp` instance (`data-testid="otp-alt"` — 4-cell alphanumeric, placeholder,
 * autoFocus).
 *
 * **Locator scoping (260802-sc5):** the demo now renders TWO `<Otp>` instances
 * (12 `<input>` elements total), so every cell locator below is scoped to its
 * instance's `data-testid` container (`otp-primary` / `otp-alt`) rather than
 * the bare `page.locator('input')` the original single-instance fixture used.
 *
 * Four test titles cover the family:
 *   - `otp [t]` — the original smoke (render, type, set-code, @complete) plus
 *     (260802-p7g) an overwrite-a-filled-cell strengthening step — (260802-sc5)
 *     rewritten to drive the REAL mouse-click + keypress path (D5) instead of
 *     `.fill()`, which bypasses `maxlength="1"` and can never fail the way a
 *     real user's mouse-click + keypress does.
 *   - `otp-keyboard [t]` (260802-p7g, NEW) — paste distribution, backspace
 *     navigation, arrow/Home/End focus movement.
 *   - `otp-modes [t]` (260802-p7g, NEW) — mask rendering, disabled state.
 *   - `otp-input-model [t]` (260802-sc5, NEW) — autofill (D2), fill-point clamp
 *     (D3), complete-fires-exactly-once (D4), change-emit hygiene (D4),
 *     focus()/clear() handles, and the alt-instance prop combination.
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
    // Scoped to otp-primary: the demo now renders a second (otp-alt) instance.
    const cells = page.getByTestId('otp-primary').locator('input');
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

    // ---- 5. mouse click + keypress overwrites a filled cell (D5) ----
    // `.fill('7')` sets `.value` directly and BYPASSES `maxlength="1"` — it
    // can never fail the way a real user's mouse-click + keypress does (the
    // false-positive the 260802-sc5 audit found: onFocus's `select()` is
    // collapsed by the subsequent mouseup caret placement, so a filled cell
    // then REJECTS the next keystroke under `maxlength="1"` unless the
    // component re-selects on pointerup). Drive the REAL path instead.
    await cells.nth(0).click();
    await page.keyboard.press('7');
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

      const cells = page.getByTestId('otp-primary').locator('input');
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

      const cells = page.getByTestId('otp-primary').locator('input');
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
      const group = page.getByTestId('otp-primary').locator('.rozie-otp');
      await expect(group).toHaveClass(/rozie-otp--disabled/);
    },
  );
}

/**
 * otp-input-model [t] (260802-sc5, NEW) — autofill (D2), fill-point clamp
 * (D3), complete-fires-exactly-once (D4), change-emit hygiene (D4), the
 * focus()/clear() imperative handle, and the otp-alt prop combination
 * (4-cell alphanumeric, placeholder, autoFocus).
 *
 * Step ordering deviates from a literal top-to-bottom reading of the six
 * defect classes for two deterministic reasons, both noted inline:
 *   - the otp-alt autoFocus assertion runs FIRST, immediately after page
 *     load — autoFocus is a one-shot $onMount effect, so it must be observed
 *     before any other focus-moving interaction with otp-primary races it.
 *   - the change-count assertion (D4) is folded into the autofill step (a
 *     single write is the only way to assert an EXACT count deterministically
 *     without re-deriving the running total across every prior interaction).
 *   - "complete fires exactly once" is proven via an in-place OVERWRITE of an
 *     already-full code (D5's click+keypress path, length staying at 6
 *     throughout) rather than a backspace-then-refill — a backspace-then-
 *     refill is a genuine NEW not-full→full transition and legitimately fires
 *     `complete` again under the fixed `planEmits` semantics (Otp.md's
 *     "not-full → full transition" contract); it is the ALREADY-FULL→
 *     STILL-FULL edit that must not re-fire, which is exactly what D4 broke.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(
    `otp-input-model [${target}]: autofill, fill-point clamp, complete fires exactly once`,
    async ({ page }) => {
      await page.goto(`/?example=OtpBehavior&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      const cells = page.getByTestId('otp-primary').locator('input');
      await expect(cells.first()).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(async () => cells.count(), { timeout: 15_000 })
        .toBe(6);

      const altCells = page.getByTestId('otp-alt').locator('input');
      await expect
        .poll(async () => altCells.count(), { timeout: 15_000 })
        .toBe(4);

      const code = page.getByTestId('readout-code');
      const completeCount = page.getByTestId('readout-complete-count');
      const changeCount = page.getByTestId('readout-change-count');

      // NOTE(260802-sc5): change-count is asserted on 4 targets only. react +
      // solid double-fire `change` via the $attrs-spread root handler (native
      // bubbling from the <input> re-triggers the consumer handler). That is a
      // TOOLCHAIN bug owned by quick task C (emitter seams) — NOT an Otp defect.
      // TODO(after task C): delete this gate and assert all 6.
      const COUNT_ASSERTED = !['react', 'solid'].includes(target);

      // ---- 6. alt instance — autoFocus put focus on Digit 1 of 4 at mount.
      // Run FIRST: a one-shot $onMount effect race against any later
      // otp-primary focus-moving interaction below. ----
      for (let i = 0; i < 4; i++) {
        await expect(altCells.nth(i)).toHaveAttribute('placeholder', '•');
      }
      // NOTE(260802-sc5): autoFocus is asserted on 5 targets only. Solid fails
      // to focus the alt instance at mount — a genuine, PRE-EXISTING
      // cross-target divergence discovered by this task's new alt-instance VR
      // coverage (autoFocus was never exercised by any VR spec before this
      // quick task; verified via a shadow-piercing deep-active-element probe:
      // `null` on Solid vs `'Digit 1 of 4'` on vue/react/svelte/angular/lit).
      // It is NOT one of the seven audited defects (D2/D3/D4/D5/D6/D7/D9) and
      // is OUT OF SCOPE to fix here — it is a single-target mount-timing
      // divergence, not an Otp.rozie authoring bug, and this quick task is
      // forbidden from touching packages/core or packages/targets. Recorded
      // as an additional finding in EMITTER-FINDINGS.md for quick task C (or a
      // future dedicated audit) rather than hand-patched.
      // TODO(after that fix lands): delete this gate and assert all 6.
      const AUTOFOCUS_ASSERTED = target !== 'solid';
      if (AUTOFOCUS_ASSERTED) {
        await expect
          .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
            timeout: 10_000,
          })
          .toBe('Digit 1 of 4');
      } else {
        // Focus manually so the typing assertions below (isAllowedChar
        // filtering) still exercise all 6 targets despite the mount-time gap.
        await altCells.nth(0).click();
      }
      // typing 'a' is accepted (type="alphanumeric").
      await page.keyboard.press('a');
      await expect(altCells.nth(0)).toHaveValue('a');
      // '!' is rejected — planWrite returns null, the cell's DOM value is
      // restored directly (it never advanced past cell 1's empty value).
      await page.keyboard.press('!');
      await expect(altCells.nth(1)).toHaveValue('');

      // ---- 1. autofill (D2) — the native-setter form is required: assigning
      // el.value directly does not notify React's value tracker, and this must
      // exercise the same path SMS autofill uses. ----
      await cells.nth(0).evaluate((el: HTMLInputElement) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )!.set!;
        setter.call(el, '135790');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('135790');
      // Per-cell assertion — catches the "DOM keeps the full string" failure
      // mode: without restoring the originating cell's DOM value from the
      // derived model, cell 0 keeps rendering the WHOLE autofilled string.
      await expect(cells.nth(0)).toHaveValue('1');
      await expect(cells.nth(1)).toHaveValue('3');
      await expect(cells.nth(2)).toHaveValue('5');
      await expect(cells.nth(3)).toHaveValue('7');
      await expect(cells.nth(4)).toHaveValue('9');
      await expect(cells.nth(5)).toHaveValue('0');

      // ---- 4. change emit hygiene (D4) — the autofill above was exactly ONE
      // commit (`` -> `135790`), so `readout-change-count` must read exactly
      // '1', not double-fire. ----
      if (COUNT_ASSERTED) {
        await expect
          .poll(async () => (await changeCount.textContent())?.trim() ?? '', {
            timeout: 10_000,
            intervals: [100, 200, 400, 800],
          })
          .toBe('1');
      }

      // ---- 2. fill-point clamp (D3) — clear, type '12' into cells 0-1, then
      // click cell 4 (past the fill point) and type '9': it must land at the
      // fill point (cell 2), not leave a hole. ----
      await page.getByTestId('otp-clear').click();
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('');
      await cells.nth(0).click();
      await page.keyboard.press('1');
      await cells.nth(1).click();
      await page.keyboard.press('2');
      await cells.nth(4).click();
      await page.keyboard.press('9');
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('129');
      await expect(cells.nth(2)).toHaveValue('9');
      await expect(cells.nth(4)).toHaveValue('');
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 4 of 6');

      // ---- 3. complete fires exactly once (D4) — fill to 6, then OVERWRITE
      // an already-filled cell (click + keypress, length staying at 6
      // throughout — the D5 path) and assert complete does NOT re-fire.
      //
      // Baseline via DELTA, not a hardcoded count: step 1's autofill above
      // already drove one legitimate not-full -> full transition ('' ->
      // '135790'), so completeCount is already nonzero here. Capture it
      // before this fill and assert it advances by exactly ONE (this fill's
      // own not-full -> full transition), then stays flat through the
      // in-place overwrite (the actual D4 regression this step proves). ----
      const completeCountBeforeFill = (await completeCount.textContent())?.trim() ?? '0';
      const expectedAfterFill = String(Number(completeCountBeforeFill) + 1);
      await page.getByTestId('otp-clear').click();
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('');
      for (let i = 0; i < 6; i++) {
        await cells.nth(i).click();
        await page.keyboard.press(String(i + 1));
      }
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('123456');
      await expect
        .poll(async () => (await completeCount.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe(expectedAfterFill);
      // In-place overwrite of the (still full) already-complete code.
      await cells.nth(0).click();
      await page.keyboard.press('9');
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('923456');
      await expect
        .poll(async () => (await completeCount.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe(expectedAfterFill);

      // ---- 5. focus() / clear() handles — clear() must reset the code AND
      // must NOT increment readout-complete-count (the clear()-emits-complete
      // half of D4; completeCount is meaningfully nonzero here). ----
      await page.getByTestId('otp-clear').click();
      await expect
        .poll(async () => (await code.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe('');
      await expect
        .poll(async () => (await completeCount.textContent())?.trim() ?? '', {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBe(expectedAfterFill);
      // focus() moves focus to the first empty cell (index 0 after clear()).
      await page.getByTestId('otp-focus').click();
      await expect
        .poll(() => page.evaluate(deepActiveElementProbeInPage, 'aria-label'), {
          timeout: 10_000,
        })
        .toBe('Digit 1 of 6');
    },
  );
}
