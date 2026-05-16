import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 07.2 Plan 06 Task 2 — ModalConsumer close-interaction smoke spec.
 *
 * Verifies the dogfood acceptance from ROADMAP Phase 07.2 Success Criterion 4:
 *   "Header/footer markup appears, default-slot body renders, scoped `close`
 *    callback closes the modal when invoked from inside a fill."
 *
 * Topology:
 *   1. Each per-target ModalConsumer host route mounts the compiled
 *      ModalConsumer.rozie at `[data-testid="rozie-mount"]`.
 *   2. ModalConsumer renders a Modal with `<template #header="{ close }">`
 *      fill containing a `×` button bound to the scoped `close` callback.
 *   3. The Modal starts `:open="true"` (per ModalConsumer.rozie's
 *      `<data>{ open: true }`) so the dialog is visible on first paint.
 *   4. Clicking the `×` button fires `close()`, which sets `$data.open = false`
 *      via Modal's two-way bind — the dialog unmounts (`r-if="$props.open"`).
 *
 * What we assert per target:
 *   - Pre-click: the modal backdrop element is present in DOM (open=true)
 *   - Post-click: the modal backdrop element is removed (open=false), proving
 *     the scoped `close` callback wired up through the slot fill correctly.
 *
 * BLOCKED (Wave 2 — marked .fixme until Plan 07.2-06 dist/ build lands):
 *   The spec depends on a built `dist/<target>/host/entry.<target>.html`
 *   that mounts the `ModalConsumer` example at `/?example=ModalConsumer&
 *   target=<target>`. Plan 07.2-06 Task 3 (the checkpoint) runs the
 *   `build-cells.mjs` orchestrator inside the pinned Playwright Docker image
 *   which generates these dist artefacts AND regens the Linux baseline PNGs.
 *
 *   When dist/ is absent the runner gates each cell with `test.fixme` so the
 *   harness reports them as known-pending rather than failing CI on the first
 *   spec run before the Docker baseline-regen has completed.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const distEntry = resolve(
    __dirname,
    `../dist/${target}/host/entry.${target}.html`,
  );
  const built = existsSync(distEntry);
  const runner = built ? test : test.fixme;

  runner(`ModalConsumer · ${target}: clicking close button in header fill closes the modal`, async ({
    page,
  }) => {
    await page.goto(`/?example=ModalConsumer&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // The first <Modal> in ModalConsumer.rozie is the one with the scoped
    // header fill that owns the `×` close button. Locate it by class —
    // `.modal-backdrop` is the root element of an open Modal (r-if="open"
    // wraps the whole tree). When `close()` fires, the backdrop is removed
    // from the DOM tree, so the locator's count goes from > 0 to 0.
    //
    // Multiple Modals are rendered (first/static, second/dynamic-name,
    // wrapper) — we click the close in the FIRST modal's header fill, which
    // closes ONLY the first modal (each <Modal> has its own `open` prop
    // bound to the same `$data.open` ref, so clicking close in any one
    // will set $data.open to false, closing all three at once. That's the
    // current dogfood semantic — a simplification for the smoke test).
    const backdropCountBefore = await page.locator('.modal-backdrop').count();
    expect(backdropCountBefore).toBeGreaterThan(0);

    // Click the × button in the first Modal's header fill. The button class
    // is `close` (per ModalConsumer.rozie's `<button class="close">`).
    // For Lit, the button is inside shadow DOM — Playwright's getByRole
    // pierces shadow boundaries by default, but to be safe we use a
    // shadow-piercing CSS selector via locator().
    const closeButton = mount.locator('.close, button:has-text("×")').first();
    await closeButton.click();

    // Modal is closed → backdrop element removed from DOM.
    // Allow up to 1 second for the rerender to settle on slower CI hardware.
    await expect(page.locator('.modal-backdrop')).toHaveCount(0, { timeout: 1000 });
  });
}
