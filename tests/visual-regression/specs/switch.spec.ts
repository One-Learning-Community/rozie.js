import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Switch behavioral smoke — pure-Rozie WAI-ARIA toggle (`Switch`).
 *
 * `Switch` is a pure-Rozie family (NO third-party engine): the PLATFORM is the
 * engine — a focusable `role="switch"` button, native click, and Space/Enter
 * keydown. Rozie owns the author-side API: the two-way boolean `modelValue`, the
 * toggle choreography, the ARIA wiring (`aria-checked`/`aria-disabled`), and the
 * disabled/readonly gates. This spec proves the controlled boolean primitive
 * behaves identically across all 6 targets.
 *
 * `examples/demos/SwitchBehaviorDemo.rozie` drives a Wi-Fi switch seeded OFF with
 * a two-way `r-model:modelValue` (live `readout-value` + `@change`-fed
 * `readout-change`), a `set-on` direct-model-write button (→ on), and a sibling
 * DISABLED switch (Airplane mode) the spec proves is inert.
 *
 * The `@change` readout exercises the Lit-consumer CustomEvent unwrap
 * (project_vr_direct_model_write_null_react_solid_lit): the child's
 * `$emit('change', { checked })` reaches the Lit consumer as a CustomEvent
 * (payload in `e.detail`) vs arg0 on the other 5 targets.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot` (the pixel cell is SwitchScreenshot in matrix.spec.ts).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`switch [${target}]: click + keyboard toggle, @change fires, disabled stays inert`, async ({
    page,
  }) => {
    await page.goto(`/?example=SwitchBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const value = page.getByTestId('readout-value');
    const change = page.getByTestId('readout-change');
    // role="switch" pierces Lit shadow; name = aria-label.
    const sw = page.getByRole('switch', { name: 'Wi-Fi' });
    const disabledSw = page.getByRole('switch', { name: 'Airplane mode' });

    // ---- 1. seeded off ----
    await expect(sw).toBeVisible({ timeout: 15_000 });
    await expect(value).toHaveText('off');
    await expect(sw).toHaveAttribute('aria-checked', 'false');

    // ---- 2. click toggles on; @change fires { checked: true } ----
    await sw.click();
    await expect(value).toHaveText('on', { timeout: 10_000 });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(change).toHaveText('true');

    // ---- 3. click toggles off; @change fires { checked: false } ----
    await sw.click();
    await expect(value).toHaveText('off', { timeout: 10_000 });
    await expect(change).toHaveText('false');

    // ---- 4. keyboard: Space toggles on ----
    await sw.focus();
    await sw.press(' ');
    await expect(value).toHaveText('on', { timeout: 10_000 });
    await expect(sw).toHaveAttribute('aria-checked', 'true');

    // ---- 5. keyboard: Enter toggles off ----
    await sw.press('Enter');
    await expect(value).toHaveText('off', { timeout: 10_000 });

    // ---- 6. set-on direct-model write (→ on) reflects ----
    await page.getByTestId('set-on').click();
    await expect(value).toHaveText('on', { timeout: 10_000 });
    await expect(sw).toHaveAttribute('aria-checked', 'true');

    // ---- 7. the disabled switch is inert: aria-disabled, and a forced click
    //         (bypassing pointer-events / disabled actionability) does NOT flip it ----
    await expect(disabledSw).toHaveAttribute('aria-checked', 'false');
    await expect(disabledSw).toHaveAttribute('aria-disabled', 'true');
    await disabledSw.click({ force: true });
    await expect(disabledSw).toHaveAttribute('aria-checked', 'false');
  });
}
