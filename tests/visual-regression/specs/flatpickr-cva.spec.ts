import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * SPIKE 005/006 — Angular CVA forms-integration behavioral probes.
 *
 * Spike code (not a standing gate). Angular-only — CVA is an Angular-specific
 * forms contract; there is no cross-target dimension here.
 *
 * Structural/behavioral assertions only (no screenshots) so the spec runs
 * locally on macOS without Docker baselines, per feedback_vr_linux_baselines.
 *
 * Spike 005 (baseline-gap):
 *   - [(ngModel)] / [formControl] on the raw generated component → NG01203.
 *   - [(date)] without forms directives → still works (control case).
 *
 * Spike 006 (cva-directive):
 *   - [(ngModel)] two-way works through the CVA wrapper directive.
 *   - Reactive FormControl: setValue / reset(null-coercion) / disable / touched.
 *   - No double-emission on programmatic writes (interaction-path hookup).
 *   - [formControl] + [(date)] coexistence without loops.
 *   - The "naive" effect-based hookup demonstrably echoes (anti-pattern control).
 */

const built = existsSync(
  resolve(__dirname, '../dist/angular/host/entry.angular.html'),
);
const runner = built ? test : test.fixme;

/** Direct entry URL (bypasses the dist/index.html ?example router). */
const probeUrl = (key: string) =>
  `/angular/host/entry.angular.html?cvaProbe=${key}&target=angular`;

interface ErrorCapture {
  pageErrors: string[];
  consoleErrors: string[];
  all(): string;
}

function captureErrors(page: Page): ErrorCapture {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return {
    pageErrors,
    consoleErrors,
    all: () => [...pageErrors, ...consoleErrors].join('\n---\n'),
  };
}

/** The flatpickr-managed visible input inside the probe mount. */
const fpInput = (page: Page) =>
  page.locator('[data-testid="rozie-mount"] input.flatpickr-input').first();

/* ════════════════════════════════════════════════════════════════════════
 * SPIKE 005 — baseline gap
 * ════════════════════════════════════════════════════════════════════════ */

// FINDING (run 1): in a PRODUCTION Angular build, the missing-CVA failure is
// NOT the documented dev-mode `NG01203: No value accessor for form control` —
// the ngDevMode guard is compiled out, and the forms runtime null-derefs:
//   `TypeError: Cannot read properties of null (reading 'writeValue')`
//   at _setUpStandalone / _setUpControl / NgModel.ngOnChanges
// i.e. today's failure mode for a prod consumer is completely unactionable.
const MISSING_CVA_ERROR = /value accessor|NG01203|null \(reading 'writeValue'\)/i;

runner('005-A baseline: [(ngModel)] without CVA fails (capture exact error)', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('BaselineNgModel'));
  // Give Angular bootstrap + the expected throw time to surface.
  await page.waitForTimeout(1500);
  // The defining assertion: the forms system rejected the binding.
  expect(errors.all()).toMatch(MISSING_CVA_ERROR);
  // Document the full error text in the report (visible via --reporter=list output).
  test.info().annotations.push({
    type: 'captured-error',
    description: errors.all().slice(0, 2000),
  });
});

runner('005-B baseline: [formControl] without CVA fails (capture exact error)', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('BaselineReactive'));
  await page.waitForTimeout(1500);
  expect(errors.all()).toMatch(MISSING_CVA_ERROR);
  test.info().annotations.push({
    type: 'captured-error',
    description: errors.all().slice(0, 2000),
  });
});

runner('005-C baseline: [(date)] without forms directives still works (control case)', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('BaselineDate'));
  const input = fpInput(page);
  await expect(input).toBeVisible();
  // Initial model value flows producer→view.
  await expect(input).toHaveValue('2026-06-02');
  // Pick a date: open the calendar, click a day → [(date)] updates the host signal.
  await input.click();
  await expect(page.locator('.flatpickr-calendar.open')).toBeVisible();
  await page
    .locator('.flatpickr-calendar.open .flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)', {
      hasText: '15',
    })
    .first()
    .click();
  await expect(page.getByTestId('baseline-date-value')).toHaveText('2026-06-15');
  // Zero errors — the current contract is intact without forms.
  expect(errors.all()).toBe('');
});

/* ════════════════════════════════════════════════════════════════════════
 * SPIKE 006 — CVA wrapper directive
 * ════════════════════════════════════════════════════════════════════════ */

runner('006-A cva: [(ngModel)] two-way works', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('NgModel'));
  const input = fpInput(page);
  await expect(input).toBeVisible();

  // model → view: the initial ngModel value reaches the flatpickr input.
  await expect(input).toHaveValue('2026-06-02');
  await expect(page.getByTestId('ngmodel-value')).toHaveText('2026-06-02');

  // model → view: programmatic model write propagates.
  // RUN-1 FINDING: this failed — the input stayed at the initial value while
  // the same path works for reactive [formControl] (006-B). Diagnostics below
  // isolate WHERE the ngModel async (resolvedPromise.then) chain breaks:
  //   - writeValueCalls: did NgModel ever call writeValue after the change?
  //   - ngmodel-fp-date: did writeValue's date.set() reach the model signal?
  //   - input value: did the $watch reconciler push it into flatpickr?
  await page.getByTestId('ngmodel-set').click();
  await page.waitForTimeout(1000); // allow NgModel's async model→view write
  const diag = {
    hostValue: await page.getByTestId('ngmodel-value').textContent(),
    writeValueCalls: await page.getByTestId('ngmodel-writevalue-calls').textContent(),
    fpDate: await page.getByTestId('ngmodel-fp-date').textContent(),
    inputValue: await fpInput(page).inputValue(),
    journal: await page.getByTestId('ngmodel-journal').textContent(),
  };
  test.info().annotations.push({
    type: 'ngmodel-model-to-view-diagnostics',
    description: JSON.stringify(diag),
  });
  await expect(input).toHaveValue('2026-07-04');

  // view → model: user picks a date in the calendar → ngModel updates.
  await input.click();
  await expect(page.locator('.flatpickr-calendar.open')).toBeVisible();
  await page
    .locator('.flatpickr-calendar.open .flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)', {
      hasText: '15',
    })
    .first()
    .click();
  await expect(page.getByTestId('ngmodel-value')).toHaveText('2026-07-15');

  expect(errors.all()).toBe('');
});

runner('006-B cva: reactive FormControl — setValue / no echo / touched / reset / disable', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('Reactive'));
  const input = fpInput(page);
  await expect(input).toBeVisible();

  // Initial: control value reached the view via writeValue.
  await expect(input).toHaveValue('2026-06-02');
  await expect(page.getByTestId('ctrl-value')).toHaveText('2026-06-02');
  await expect(page.getByTestId('ctrl-dirty')).toHaveText('false');
  await expect(page.getByTestId('ctrl-touched')).toHaveText('false');

  // ── Programmatic setValue: view updates, NO onChange echo, stays pristine.
  await page.getByTestId('ctrl-setvalue').click();
  await expect(input).toHaveValue('2026-07-04');
  await expect(page.getByTestId('cva-onchange-calls')).toHaveText('0');
  await expect(page.getByTestId('ctrl-dirty')).toHaveText('false');

  // ── User interaction: pick a date → control updates, exactly ONE onChange,
  //    control becomes dirty.
  await input.click();
  await expect(page.locator('.flatpickr-calendar.open')).toBeVisible();
  await page
    .locator('.flatpickr-calendar.open .flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)', {
      hasText: '15',
    })
    .first()
    .click();
  await expect(page.getByTestId('ctrl-value')).toHaveText('2026-07-15');
  await expect(page.getByTestId('cva-onchange-calls')).toHaveText('1');
  await expect(page.getByTestId('ctrl-dirty')).toHaveText('true');

  // ── Touched: interacting with the picker (focus left the input when the
  //    calendar/day was clicked) marks the control touched. Document the
  //    actual focusout count for the README (popup-click timing finding).
  const touched = await page.getByTestId('ctrl-touched').textContent();
  const onTouchedCalls = await page.getByTestId('cva-ontouched-calls').textContent();
  test.info().annotations.push({
    type: 'touched-after-popup-interaction',
    description: `ctrl.touched=${touched} onTouchedCalls=${onTouchedCalls}`,
  });
  // Clicking outside the input + popup definitively fires focusout → touched.
  await page.locator('h3').first().click();
  await expect(page.getByTestId('ctrl-touched')).toHaveText('true');

  // ── reset(): writeValue(null) → null-coercion to '' → flatpickr clears.
  await page.getByTestId('ctrl-reset').click();
  await expect(input).toHaveValue('');
  await expect(page.getByTestId('ctrl-value')).toHaveText('NULL');

  // ── disable()/enable(): setDisabledState reaches the engine input.
  await page.getByTestId('ctrl-disable').click();
  await expect(page.getByTestId('ctrl-disabled')).toHaveText('true');
  await expect(input).toBeDisabled();
  await page.getByTestId('ctrl-enable').click();
  await expect(input).toBeEnabled();

  expect(errors.all()).toBe('');
});

runner('006-C cva: [formControl] + [(date)] coexist without loops', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('Coexist'));
  const input = fpInput(page);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('2026-06-02');

  // Form-side programmatic write → BOTH the control and the [(date)] signal update.
  await page.getByTestId('coexist-setvalue').click();
  await expect(input).toHaveValue('2026-07-04');
  await expect(page.getByTestId('coexist-ctrl-value')).toHaveText('2026-07-04');
  await expect(page.getByTestId('coexist-date-value')).toHaveText('2026-07-04');
  // No echo into onChange from the programmatic write.
  await expect(page.getByTestId('coexist-onchange-calls')).toHaveText('0');

  // [(date)]-side programmatic write → view updates; the form control does NOT
  // see it as a view change (no onChange — it wasn't user interaction), so the
  // control value diverges. THIS IS A FINDING to document either way; assert
  // the observed behavior and annotate.
  await page.getByTestId('coexist-setdate').click();
  await expect(input).toHaveValue('2026-08-15');
  const ctrlAfterDateWrite = await page.getByTestId('coexist-ctrl-value').textContent();
  const onChangeAfterDateWrite = await page
    .getByTestId('coexist-onchange-calls')
    .textContent();
  test.info().annotations.push({
    type: 'date-write-vs-form-control',
    description: `after picked.set('2026-08-15'): ctrl.value=${ctrlAfterDateWrite} onChangeCalls=${onChangeAfterDateWrite}`,
  });

  // User interaction → both update + exactly one (more) onChange.
  await input.click();
  await expect(page.locator('.flatpickr-calendar.open')).toBeVisible();
  await page
    .locator('.flatpickr-calendar.open .flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)', {
      hasText: '20',
    })
    .first()
    .click();
  await expect(page.getByTestId('coexist-ctrl-value')).toHaveText('2026-08-20');
  await expect(page.getByTestId('coexist-date-value')).toHaveText('2026-08-20');

  expect(errors.all()).toBe('');
});

runner('006-D anti-pattern: naive effect-based hookup echoes programmatic writes', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('Echo'));
  const input = fpInput(page);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('2026-06-02');

  // The control starts pristine.
  await expect(page.getByTestId('echo-ctrl-dirty')).toHaveText('false');

  // Programmatic setValue through the NAIVE accessor: writeValue → date.set →
  // effect on the model signal fires → cvaOnChange echoes back into the form.
  await page.getByTestId('echo-setvalue').click();
  await expect(input).toHaveValue('2026-07-04');

  // Document the echo: onChangeCalls > 0 and/or control marked dirty by a
  // PROGRAMMATIC write — the bug the interaction-path hookup avoids.
  await page.waitForTimeout(500); // effects run post-CD; give it a beat
  const echoCalls = await page.getByTestId('echo-onchange-calls').textContent();
  const echoDirty = await page.getByTestId('echo-ctrl-dirty').textContent();
  test.info().annotations.push({
    type: 'echo-evidence',
    description: `after programmatic setValue: onChangeCalls=${echoCalls} ctrl.dirty=${echoDirty}`,
  });
  expect(Number(echoCalls)).toBeGreaterThan(0);

  expect(errors.pageErrors.join('')).toBe('');
});
