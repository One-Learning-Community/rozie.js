import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Plan 23-06 RE-TARGET — Angular CVA forms-integration behavioral e2e.
 *
 * Angular-only — CVA is an Angular-specific forms contract; there is no
 * cross-target dimension here. Structural/behavioral assertions only (no
 * screenshots) so the spec runs without Docker pixel baselines.
 *
 * The Angular emitter now auto-emits the ControlValueAccessor INSIDE the
 * generated `<rozie-flatpickr>` class (default-ON for single-model components).
 * These probes bind Angular forms directives DIRECTLY to the emitted component
 * — there is NO hand-written CVA directive in the harness anymore.
 *
 * 005 (INVERTED from the spike baseline-gap):
 *   - 005-A [(ngModel)] / 005-B [formControl] on the emitted component no longer
 *     crash (NG01203 / null writeValue) — the binding works and round-trips.
 *   - 005-C [(date)] without forms directives still works (control case).
 *
 * 006 (forms directives bound directly to the emitted CVA):
 *   - 006-A [(ngModel)] two-way works.
 *   - 006-B reactive FormControl battery: setValue / reset(null-coercion) /
 *     disable / enable / touched / ZERO-ECHO.
 *   - 006-C [formControl] + [(date)] coexistence (writes through [(date)] do NOT
 *     dirty the form control).
 *   - 006-D zero-echo guard: a programmatic setValue must NOT dirty the control
 *     (the emitter hooks onChange to interaction only, never to writeValue).
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
 * 005 (INVERTED) — forms directives no longer crash on the emitted CVA
 * ════════════════════════════════════════════════════════════════════════ */

// Any of these in page/console errors would mean the emitted CVA is missing.
const MISSING_CVA_ERROR = /value accessor|NG01203|null \(reading 'writeValue'\)/i;

runner('005-A inverted: [(ngModel)] on the emitted CVA does NOT crash + round-trips', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('BaselineNgModel'));
  const input = fpInput(page);
  await expect(input).toBeVisible();
  // The binding is accepted — no missing-value-accessor failure.
  expect(errors.all()).not.toMatch(MISSING_CVA_ERROR);
  // model → view: the initial ngModel value reaches the flatpickr input.
  await expect(input).toHaveValue('2026-06-02');
  await expect(page.getByTestId('baseline-ngmodel-value')).toHaveText('2026-06-02');
  expect(errors.all()).toBe('');
});

runner('005-B inverted: [formControl] on the emitted CVA does NOT crash + round-trips', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('BaselineReactive'));
  const input = fpInput(page);
  await expect(input).toBeVisible();
  expect(errors.all()).not.toMatch(MISSING_CVA_ERROR);
  // control → view: the initial FormControl value reaches the flatpickr input.
  await expect(input).toHaveValue('2026-06-02');
  await expect(page.getByTestId('baseline-reactive-value')).toHaveText('2026-06-02');
  expect(errors.all()).toBe('');
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
 * 006 — forms directives bound directly to the emitted CVA component
 * ════════════════════════════════════════════════════════════════════════ */

runner('006-A cva: [(ngModel)] two-way works directly on the emitted component', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('NgModel'));
  const input = fpInput(page);
  await expect(input).toBeVisible();

  // model → view: the initial ngModel value reaches the flatpickr input.
  await expect(input).toHaveValue('2026-06-02');
  await expect(page.getByTestId('ngmodel-value')).toHaveText('2026-06-02');

  // model → view: programmatic model write propagates (NgModel's async
  // resolvedPromise.then model→view path — needs the in-zone mount).
  await page.getByTestId('ngmodel-set').click();
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

runner('006-B cva: reactive FormControl — setValue / reset / disable / enable / touched / zero-echo', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('Reactive'));
  const input = fpInput(page);
  await expect(input).toBeVisible();

  // Initial: control value reached the view via writeValue; control is pristine.
  await expect(input).toHaveValue('2026-06-02');
  await expect(page.getByTestId('ctrl-value')).toHaveText('2026-06-02');
  await expect(page.getByTestId('ctrl-dirty')).toHaveText('false');
  await expect(page.getByTestId('ctrl-touched')).toHaveText('false');

  // ── Programmatic setValue: view updates, NO onChange echo, stays pristine.
  await page.getByTestId('ctrl-setvalue').click();
  await expect(input).toHaveValue('2026-07-04');
  await expect(page.getByTestId('ctrl-dirty')).toHaveText('false');

  // ── User interaction: pick a date → control updates and becomes dirty.
  await input.click();
  await expect(page.locator('.flatpickr-calendar.open')).toBeVisible();
  await page
    .locator('.flatpickr-calendar.open .flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)', {
      hasText: '15',
    })
    .first()
    .click();
  await expect(page.getByTestId('ctrl-value')).toHaveText('2026-07-15');
  await expect(page.getByTestId('ctrl-dirty')).toHaveText('true');

  // ── Touched: clicking outside the input + popup fires focusout → touched.
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
  await expect(page.getByTestId('coexist-ctrl-dirty')).toHaveText('false');

  // Form-side programmatic write → BOTH the control and the [(date)] signal update.
  await page.getByTestId('coexist-setvalue').click();
  await expect(input).toHaveValue('2026-07-04');
  await expect(page.getByTestId('coexist-ctrl-value')).toHaveText('2026-07-04');
  await expect(page.getByTestId('coexist-date-value')).toHaveText('2026-07-04');
  // No echo into onChange from the programmatic write — control stays pristine.
  await expect(page.getByTestId('coexist-ctrl-dirty')).toHaveText('false');

  // [(date)]-side programmatic write → view updates; writes through [(date)] do
  // NOT dirty the form control (it wasn't user interaction → no onChange).
  await page.getByTestId('coexist-setdate').click();
  await expect(input).toHaveValue('2026-08-15');
  await expect(page.getByTestId('coexist-date-value')).toHaveText('2026-08-15');
  await expect(page.getByTestId('coexist-ctrl-dirty')).toHaveText('false');

  // User interaction → both update + the control becomes dirty.
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

runner('006-D zero-echo guard: programmatic setValue must NOT dirty the control', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto(probeUrl('Echo'));
  const input = fpInput(page);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('2026-06-02');

  // The control starts pristine.
  await expect(page.getByTestId('echo-ctrl-dirty')).toHaveText('false');

  // Programmatic setValue through the emitted CVA: writeValue → date.set →
  // $watch reconciler pushes into flatpickr WITHOUT firing flatpickr's own
  // onChange — so onChange does NOT echo back into the form. The control must
  // update its value but stay PRISTINE (the bug the spike's naive effect-based
  // hookup demonstrated; the emitter's interaction-path hookup avoids it).
  await page.getByTestId('echo-setvalue').click();
  await expect(input).toHaveValue('2026-07-04');
  await expect(page.getByTestId('echo-ctrl-value')).toHaveText('2026-07-04');
  await expect(page.getByTestId('echo-ctrl-dirty')).toHaveText('false');

  expect(errors.all()).toBe('');
});
