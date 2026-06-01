import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 21 — $expose imperative-handle external-caller smoke (REQ-11).
 *
 * `examples/ExposeProbe.rozie` is a typed input that exposes an imperative
 * handle via `$expose({ reset, focus })`. Each target lowers this to its native
 * handle idiom:
 *   - React  → forwardRef + useImperativeHandle
 *   - Vue    → defineExpose({ reset, focus })
 *   - Svelte → `export function reset()/focus()` instance exports
 *   - Solid  → callback `ref` prop invoked once after mount
 *   - Angular→ public component-class methods
 *   - Lit    → public custom-element methods
 *
 * The VR rig (host/entry.<target>.ts) grabs the handle per-target via that
 * native mechanism (D-07) and renders a "reset via handle" button. This spec is
 * the EXTERNAL CALLER: it types a value into the input, clicks the rig's
 * "reset via handle" button (which calls handle.reset()), and asserts the input
 * clears — proving the exposed method is reachable and effective from OUTSIDE
 * the component via the native handle, on every target.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only (no
 * `toHaveScreenshot`). The pixel cell lives in matrix.spec.ts (baseline-gated to
 * the orchestrator's Linux-Docker render).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`expose-probe [${target}]: external caller drives handle.reset() to clear the input`, async ({
    page,
  }) => {
    await page.goto(`/?example=ExposeProbe&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // The probe renders a single text <input>. Playwright CSS locators pierce
    // shadow DOM, so this resolves the Lit shadow-rendered input as well.
    const input = mount.locator('input[type="text"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    // The rig's external-caller harness button (D-07). Present on all 6 targets.
    const resetBtn = page.locator('[data-testid="reset-via-handle"]');
    await expect(resetBtn).toBeVisible({ timeout: 10_000 });

    // Type a value into the input.
    await input.click();
    await input.fill('hello rozie');
    await expect(input).toHaveValue('hello rozie');

    // Click "reset via handle" → the rig calls the grabbed handle's reset(),
    // which (per ExposeProbe.rozie) sets `$data.value = ''`. Assert the input
    // clears — the observable effect of the exposed method invoked externally.
    await resetBtn.click();
    await expect(input).toHaveValue('', { timeout: 5_000 });
  });
}
