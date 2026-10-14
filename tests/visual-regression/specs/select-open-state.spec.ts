import { test, expect, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select open state under changes that reach it from OUTSIDE the control: a prop that
 * changes on its own, an outside click that coincides with such a change, and the
 * exposed handle called from an outside click. Driven against
 * examples/demos/SelectOpenStateDemo.rozie (and SelectGroupsDemo.rozie for the
 * click-that-also-shrinks case) on all 6 targets.
 *
 * Behavioral assertions only (no screenshots). CSS / role locators pierce Lit's open
 * shadow roots. Logs hold one letter per `open-change`: T = open, F = closed.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

/**
 * The exact log, still exact after a pause long enough for a late duplicate (a
 * deferred dismissal, a second watcher pass) to land.
 */
async function settled(page: Page, log: Locator, want: string) {
  await expect(log).toHaveText(want);
  await page.waitForTimeout(250);
  await expect(log).toHaveText(want);
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  // ── A1 ────────────────────────────────────────────────────────────────────
  runner(`select-open-state [${target}]: an outside click that also shrinks the option list closes the popup once, and it reopens`, async ({ page }) => {
    await page.goto(`/?example=SelectGroups&target=${target}`);
    const trigger = page.locator('[role="combobox"]').first();
    const list = page.locator('[role="listbox"]');
    const log = page.getByTestId('readout-log');
    await trigger.focus();
    await page.keyboard.press('End'); // open, active = Oat (last of six)
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-5$/);
    await settled(page, log, 'T');

    // ONE click: outside the popup (a dismissal) and on the button that cuts the
    // option list to two entries.
    await page.getByTestId('shrink').click();
    await expect(list).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-activedescendant', /.+/);
    await settled(page, log, 'TF');
    // Still closed and consistent after the pause.
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);

    // Reopening works, over the shrunk list.
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[role="option"]')).toHaveText(['Carrot', 'Apple']);
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled(page, log, 'TFT');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled(page, log, 'TFTF');
  });

  // ── A2: virtual — only the `options` prop changes ──────────────────────────
  runner(`select-open-state [${target}]: virtual — replacing the options array while OPEN re-renders the rows (longer, shorter, same length)`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('swap-select');
    const trigger = wrap.locator('[role="combobox"]');
    const options = wrap.locator('[role="option"]');
    const keys = page.getByTestId('swap-keys');
    await trigger.click();
    await expect(wrap.locator('[role="listbox"]')).toBeVisible();
    await expect(options).toHaveText(['Alpha 1', 'Alpha 2', 'Alpha 3', 'Alpha 4', 'Alpha 5'], { timeout: 15_000 });

    // Keys, not clicks: the popup has to stay open while the prop changes.
    await keys.focus();
    await page.keyboard.press('b'); // 5 -> 8
    await expect(page.getByTestId('readout-swap')).toHaveText('b');
    await expect(options).toHaveText(['Beta 1', 'Beta 2', 'Beta 3', 'Beta 4', 'Beta 5', 'Beta 6', 'Beta 7', 'Beta 8'], { timeout: 15_000 });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('c'); // 8 -> 2
    await expect(page.getByTestId('readout-swap')).toHaveText('c');
    await expect(options).toHaveText(['Gamma 1', 'Gamma 2'], { timeout: 15_000 });

    await page.keyboard.press('a'); // 2 -> 5
    await expect(options).toHaveText(['Alpha 1', 'Alpha 2', 'Alpha 3', 'Alpha 4', 'Alpha 5'], { timeout: 15_000 });
    await page.keyboard.press('d'); // 5 -> 5: a different array of the SAME length
    await expect(page.getByTestId('readout-swap')).toHaveText('d');
    await expect(options).toHaveText(['Delta 1', 'Delta 2', 'Delta 3', 'Delta 4', 'Delta 5'], { timeout: 15_000 });

    // The rows are live, not just painted: a pick commits the new option.
    await options.nth(2).click();
    await expect(trigger).toContainText('Delta 3');
  });

  runner(`select-open-state [${target}]: virtual — replacing the options array while CLOSED shows the new rows on open`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('swap-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const options = wrap.locator('[role="option"]');
    await expect(trigger).toBeVisible();
    await expect(list).toBeHidden();

    await page.getByTestId('swap-b').click(); // 5 -> 8, closed
    await expect(page.getByTestId('readout-swap')).toHaveText('b');
    await trigger.click();
    await expect(list).toBeVisible();
    await expect(options).toHaveText(['Beta 1', 'Beta 2', 'Beta 3', 'Beta 4', 'Beta 5', 'Beta 6', 'Beta 7', 'Beta 8'], { timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();

    await page.getByTestId('swap-c').click(); // 8 -> 2, closed
    await trigger.click();
    await expect(options).toHaveText(['Gamma 1', 'Gamma 2'], { timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();

    await page.getByTestId('swap-a').click();
    await page.getByTestId('swap-d').click(); // same length as A, closed
    await expect(page.getByTestId('readout-swap')).toHaveText('d');
    await trigger.click();
    await expect(options).toHaveText(['Delta 1', 'Delta 2', 'Delta 3', 'Delta 4', 'Delta 5'], { timeout: 15_000 });
  });

  // ── A2: hideEmpty — only the `options` prop changes ────────────────────────
  runner(`select-open-state [${target}]: hideEmpty — options arriving while internally open show the popup; emptying hides it; neither emits open-change`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('hide-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const log = page.getByTestId('readout-hide-log');
    const keys = page.getByTestId('fill-keys');

    // Open with nothing to show: internally open (one open-change), nothing rendered.
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await settled(page, log, 'T');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);

    // empty -> non-empty: the popup appears, without a second open-change.
    await keys.focus();
    await page.keyboard.press('f');
    await expect(list).toBeVisible();
    await expect(wrap.locator('[role="option"]')).toHaveText(['Apple', 'Banana', 'Cherry']);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await settled(page, log, 'T');

    // non-empty -> empty while visible: the popup hides, and nothing is emitted.
    await page.keyboard.press('e');
    await expect(list).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled(page, log, 'T');

    // …and it comes back when options return (still the same internal open state).
    await page.keyboard.press('f');
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await settled(page, log, 'T');

    // The popup that appeared this way is a normal one: Escape on the trigger closes it once.
    await trigger.focus();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await settled(page, log, 'TF');
  });

  // ── A3 ────────────────────────────────────────────────────────────────────
  runner(`select-open-state [${target}]: hideEmpty — an outside click while open-but-hidden closes the internal state`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('hide-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const log = page.getByTestId('readout-hide-log');

    await trigger.focus();
    await page.keyboard.press('ArrowDown'); // internally open, hidden
    await settled(page, log, 'T');
    await expect(list).toHaveCount(0);

    await page.mouse.click(700, 500); // empty page area, outside every control
    await settled(page, log, 'TF');

    // Options arriving now must NOT bring a popup: the select is closed, not hidden.
    // (Were it still internally open, this fill would show the list.)
    await page.getByTestId('fill-keys').focus();
    await page.keyboard.press('f');
    await page.waitForTimeout(250);
    await expect(list).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled(page, log, 'TF');

    // A following ArrowDown opens it: exactly one more open-change.
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled(page, log, 'TFT');
  });

  // ── A4 ────────────────────────────────────────────────────────────────────
  runner(`select-open-state [${target}]: the handle's open() and toggle(), called from a click outside the select, leave the popup open`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('api-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const log = page.getByTestId('readout-api-log');
    await expect(trigger).toBeVisible();

    await page.getByTestId('api-open').click();
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await settled(page, log, 'T');
    // Still open after the pause (the popover's own outside-click dismissal did not
    // take the click that opened it for a dismissal).
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape'); // seen by the popover at the document
    await expect(list).toHaveCount(0);
    await settled(page, log, 'TF');

    await page.getByTestId('api-toggle').click(); // toggle() from closed
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await settled(page, log, 'TFT');
    await expect(list).toBeVisible();

    // A real outside click still dismisses it, once.
    await page.mouse.click(700, 500);
    await expect(list).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled(page, log, 'TFTF');
  });

  runner(`select-open-state [${target}]: the handle's toggle(), called from a click outside while the popup is OPEN, leaves it closed`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('api-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const log = page.getByTestId('readout-api-log');
    await trigger.click();
    await expect(list).toBeVisible();
    await settled(page, log, 'T');

    // ONE click: an outside click (a dismissal) on the button that calls toggle().
    await page.getByTestId('api-toggle').click();
    await expect(list).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled(page, log, 'TF'); // closed once — not closed and reopened ('TFT'), not closed twice
    await expect(list).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // The next toggle() opens it again: the select is closed, not stuck.
    await page.getByTestId('api-toggle').click();
    await expect(list).toBeVisible();
    await settled(page, log, 'TFT');
  });

  // ── rapid close -> open ───────────────────────────────────────────────────
  runner(`select-open-state [${target}]: closing and opening again at once leaves the popup open, one open-change per transition`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('api-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const log = page.getByTestId('readout-api-log');
    // Two actions on the trigger in ONE task: no frame, no timer and no framework flush
    // can run between them. Escape is seen by the trigger's handler AND by the composed
    // popover at the document, exactly as a real key press is.
    //
    // On React the two are separated by one microtask turn, which is what always lies
    // between two real events: React commits a key's state change in a microtask, so two
    // dispatches with NOTHING between them hand the second handler the first one's
    // pre-change state — a situation no user input can produce (the second key then
    // commits the highlighted option instead of opening). Still no frame, no timer.
    const burst = (second: 'space' | 'arrow' | 'click') =>
      trigger.evaluate(async (el, [what, turn]) => {
        const key = (k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, composed: true }));
        key('Escape');
        if (turn) await Promise.resolve();
        if (what === 'space') key(' ');
        else if (what === 'arrow') key('ArrowDown');
        else (el as HTMLElement).click();
      }, [second, target === 'react'] as const);
    const open = async (want: string) => {
      await expect(list).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await settled(page, log, want);
      // Still open after the pause: nothing closed it a moment later.
      await expect(list).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    };

    await trigger.click();
    await open('T');
    await burst('space');
    await open('TFT');
    await burst('arrow');
    await open('TFTFT');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await burst('click');
    await open('TFTFTFT');
    // Real key presses back to back (no assertion in between).
    await trigger.focus();
    await page.keyboard.press('Escape');
    await page.keyboard.press(' ');
    await open('TFTFTFTFT');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    await open('TFTFTFTFTFT');
    // …and the popup that survived is a normal one: Escape closes it once.
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await settled(page, log, 'TFTFTFTFTFTF');
  });

  runner(`select-open-state [${target}]: open(), close(), open() through the handle in one tick ends open`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('api-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const log = page.getByTestId('readout-api-log');
    await expect(trigger).toBeVisible();
    await page.getByTestId('api-burst').focus();
    await page.keyboard.press('x');
    // The final state holds on all six.
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // EXPECTED FAILURE on React — the event sequence only. The three calls run in one
    // tick against ONE render's state: the shared close() reads `open` as it was when
    // the tick began (closed) and does nothing, and the second open() does not see the
    // first one's write and emits again — 'TT' instead of 'TFT'. Those functions are the
    // list spine's (and verbatim copies of it), which this branch may not change.
    test.fail(target === 'react', "three handle calls in one tick read one render's state: open-change is 'TT', not 'TFT'");
    await settled(page, log, 'TFT');
    await expect(list).toBeVisible();
    // From OPEN: open() is a no-op, close() closes, open() opens again.
    await page.keyboard.press('x');
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await settled(page, log, 'TFTFT');
  });
}
