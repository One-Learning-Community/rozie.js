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
    const burst = (second: 'space' | 'arrow' | 'click') =>
      trigger.evaluate((el, what) => {
        const key = (k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, composed: true }));
        key('Escape');
        if (what === 'space') key(' ');
        else if (what === 'arrow') key('ArrowDown');
        else (el as HTMLElement).click();
      }, second);
    let want = '';
    const open = async (add: string) => {
      want += add;
      await expect(list).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await settled(page, log, want);
      // Still open after the pause: nothing closed it a moment later.
      await expect(list).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    };

    await trigger.click();
    await open('T');
    // NOT on React. React commits a key's state change in a microtask, so two events
    // dispatched in one task hand the second handler the first one's pre-change state —
    // which no user input can produce — and with a microtask between them React has
    // already committed, which is just the sequential case the real keys below cover.
    // A close and an open inside ONE React event is the handle case further down.
    if (target !== 'react') {
      await burst('space');
      await open('FT');
      await burst('arrow');
      await open('FT');
      await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
      await burst('click');
      await open('FT');
    }
    // Real key presses back to back (no assertion in between), all six.
    await trigger.focus();
    await page.keyboard.press('Escape');
    await page.keyboard.press(' ');
    await open('FT');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    await open('FT');
    // …and the popup that survived is a normal one: Escape closes it once.
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await settled(page, log, want + 'F');
  });

  // ── the handle, several calls in one tick ─────────────────────────────────
  // On five targets every call acts on the state the call before it left. On React the
  // exposed verbs are closures over ONE render's state, so calls made in the same tick
  // all see the state the tick began with. That is how the compiler emits every exposed
  // verb of every component (see the report: "Compiler behaviours observed"); it is not
  // worked around in Select. The React branches below pin EXACTLY what React does today,
  // so a compiler fix shows up as a failure here, and nothing else on React is skipped.
  runner(`select-open-state [${target}]: open(), close(), open() through the handle in one tick`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('api-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const log = page.getByTestId('readout-api-log');
    await expect(trigger).toBeVisible();
    await page.getByTestId('api-burst').focus();

    // From CLOSED.
    await page.keyboard.press('x');
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    if (target === 'react') {
      // close() saw "closed" and did nothing; the second open() did not see the first.
      await settled(page, log, 'TT');
    } else {
      await settled(page, log, 'TFT');
    }
    await expect(list).toBeVisible();

    // From OPEN: open() is a no-op, close() closes, open() opens again.
    await page.keyboard.press('x');
    if (target === 'react') {
      // Both open() calls saw "open" and did nothing; only close() acted: it ends CLOSED.
      await expect(list).toHaveCount(0);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await settled(page, log, 'TTF');
      await expect(list).toHaveCount(0);
    } else {
      await expect(list).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await settled(page, log, 'TFTFT');
      await expect(list).toBeVisible();
    }
  });

  // ── a dismissal after a same-tick close + open ────────────────────────────
  for (const how of ['an outside click', 'Escape at the document'] as const) {
    runner(`select-open-state [${target}]: after close() and open() in one tick on a shown popup, ONE dismissal (${how}) closes it`, async ({ page }) => {
      await page.goto(`/?example=SelectOpenState&target=${target}`);
      const wrap = page.getByTestId('api-select');
      const trigger = wrap.locator('[role="combobox"]');
      const list = wrap.locator('[role="listbox"]');
      const log = page.getByTestId('readout-api-log');
      await trigger.click();
      await expect(list).toBeVisible();
      await settled(page, log, 'T');

      await page.getByTestId('api-burst').focus();
      await page.keyboard.press('y'); // close(); open() — on a key, so no outside click is involved
      if (target === 'react') {
        // React (see the note above the handle test): open() saw the tick's starting state,
        // "open", and did nothing — the select is simply closed, once.
        await expect(list).toHaveCount(0);
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await settled(page, log, 'TF');
        return;
      }
      await expect(list).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await settled(page, log, 'TFT');

      // ONE dismissal. Focus is on the demo button, so Escape reaches only the popover.
      if (how === 'an outside click') await page.mouse.click(700, 500);
      else await page.keyboard.press('Escape');
      await expect(list).toHaveCount(0);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await settled(page, log, 'TFTF');
      // Closed, and still closed: it did not hide and come back.
      await expect(list).toHaveCount(0);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  }

  runner(`select-open-state [${target}]: a pick and a key right after it reopen the select; ONE outside click then closes it`, async ({ page }) => {
    await page.goto(`/?example=SelectOpenState&target=${target}`);
    const wrap = page.getByTestId('api-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    const log = page.getByTestId('readout-api-log');
    await trigger.click();
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled(page, log, 'T');
    if (target === 'react') {
      // Real keys (two dispatched events in one task are not a real sequence on React).
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
    } else {
      // Enter (commits, closes) and ArrowDown (opens) in ONE task: the popup was shown,
      // is closed and opened again before any flush — on Angular this is what two fast
      // real keys do.
      await trigger.evaluate((el) => {
        const key = (k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, composed: true }));
        key('Enter');
        key('ArrowDown');
      });
    }
    await expect(trigger).toContainText('Apple');
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await settled(page, log, 'TFT');
    await page.mouse.click(700, 500);
    await expect(list).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled(page, log, 'TFTF');
    await expect(list).toHaveCount(0);
  });

  // An outside click on a button whose handler closes and reopens the select. The click
  // is also an outside click for the popup that was showing, and the composed popover
  // decides that dismissal ONE TASK LATER, reporting it only as "closed" — by then the
  // popup on screen is the one the handler opened, and nothing ties the report to the
  // earlier click. So the dismissal wins: the select ends closed, however the handler
  // ordered its calls. (To reopen from such a click, open it a task after the click.)
  for (const button of ['api-reopen', 'api-reopen-later'] as const) {
    runner(`select-open-state [${target}]: an outside click whose handler calls close() then open() (${button === 'api-reopen' ? 'at once' : 'a microtask later'}) ends closed`, async ({ page }) => {
      await page.goto(`/?example=SelectOpenState&target=${target}`);
      const wrap = page.getByTestId('api-select');
      const trigger = wrap.locator('[role="combobox"]');
      const list = wrap.locator('[role="listbox"]');
      const log = page.getByTestId('readout-api-log');
      await trigger.click();
      await expect(list).toBeVisible();
      await settled(page, log, 'T');
      await page.getByTestId(button).click();
      await expect(list).toHaveCount(0);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      // React, at once: open() saw "open" and did nothing, so there is one close only.
      await settled(page, log, target === 'react' && button === 'api-reopen' ? 'TF' : 'TFTF');
      await expect(list).toHaveCount(0);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      // Not stuck: it opens again.
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      await expect(list).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  }
}
