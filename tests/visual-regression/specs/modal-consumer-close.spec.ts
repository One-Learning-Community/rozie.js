import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 07.2 Plan 06 Task 2 — ModalConsumer close-interaction smoke spec.
 * Plan 07.2-06.1 — debug-fix follow-up: rewrite selectors to be cross-target.
 *
 * Verifies the dogfood acceptance from ROADMAP Phase 07.2 Success Criterion 4:
 *   "Header/footer markup appears, default-slot body renders, scoped `close`
 *    callback closes the modal when invoked from inside a fill."
 *
 * Topology:
 *   1. Each per-target ModalConsumer host route mounts the compiled
 *      ModalConsumer.rozie at `[data-testid="rozie-mount"]`.
 *   2. ModalConsumer renders THREE modals (1: scoped header+footer fill; 2:
 *      dynamic-name fill; 3: re-projection via WrapperModal). On first paint
 *      all three are open: `<data>{ open: true }` for modals 1+2 (shared
 *      bind via `:open="$data.open"`); WrapperModal is hardcoded `:open="true"`.
 *   3. Clicking the consumer-fill `×` button fires the scoped `close()` callback.
 *      Because `open` is declared `model: true` on Modal, the auto-writable
 *      v-model / $bindable / model() runtimes (Vue/Svelte/Angular) flip the
 *      local open state, unmounting modals 1+2 (WrapperModal stays). The
 *      controllable runtimes (React/Solid/Lit) preserve the controlled value
 *      and the modal stays open — this is the documented v1 R-list divergence
 *      (parent must wire `onOpenChange` / `bind:open` explicitly).
 *
 * Selector strategy (cross-target):
 *   - `.modal-backdrop` is NOT cross-target safe:
 *       - React/Solid emit `styles["modal-backdrop"]` via CSS Modules → the
 *         class name is hashed at build time (`._modal-backdrop_abc123`)
 *       - Lit puts the backdrop element inside the Modal's shadow root, and
 *         a `page.locator('.modal-backdrop')` CSS query does NOT pierce
 *         shadow boundaries
 *     So the spec uses `page.getByRole('dialog')` which works across all 6:
 *       (a) every target's compiled Modal renders `<div role="dialog">` on
 *           the dialog panel (verified in tests/dist-parity/fixtures/Modal.*)
 *       (b) Playwright's `getByRole()` pierces shadow DOM by default
 *       (c) CSS Modules / scoped CSS don't touch the role attribute
 *   - The × close button is located by text in the first dialog. Both the
 *     consumer-added `<button class="close">×</button>` and Modal's built-in
 *     `<button class="close-btn" aria-label="Close">×</button>` render the
 *     same glyph; clicking either fires the scoped close callback. The first
 *     button-with-× in DOM order is the consumer's header-fill close (the
 *     header slot is rendered before the built-in close-btn in the producer).
 *
 * Post-click assertion split (per-target divergence):
 *   The 3 targets where `model: true` is auto-writable locally (Vue's
 *   `defineModel`, Svelte's `$bindable`, Angular's `model()`) close modals
 *   1+2 on click — dialog count goes 3 → 1 (WrapperModal stays). The 3
 *   controllable-state targets (React's `useControllableState`, Solid's
 *   `createControllableSignal`, Lit's `createLitControllableProperty`)
 *   require the consumer to explicitly wire `onOpenChange` / event handlers
 *   to propagate; absent that wiring, controlled mode is a no-op on writes
 *   and the modal stays open. ModalConsumer.rozie deliberately uses the
 *   simpler one-way `:open="$data.open"` form (no explicit two-way wiring)
 *   to surface this divergence — for those 3 targets the spec verifies the
 *   click is dispatched without error, but does NOT assert the modal closes.
 *
 * BLOCKED (gated by dist/ build):
 *   The spec depends on a built `dist/<target>/host/entry.<target>.html`
 *   that mounts the `ModalConsumer` example at `/?example=ModalConsumer&
 *   target=<target>`. When dist/ is absent the runner gates each cell with
 *   `test.fixme` so the harness reports them as known-pending rather than
 *   failing CI on the first spec run before the host build has completed.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// Targets where `model: true` on the producer compiles to an auto-writable
// local state primitive (defineModel / $bindable / model). For these the
// scoped close() callback flips the local state and modals 1+2 close on
// click — we assert dialog count goes 3 → 1 (WrapperModal stays open).
const TARGETS_WHERE_CLOSE_PROPAGATES = new Set<(typeof TARGETS)[number]>([
  'vue',
  'svelte',
  'angular',
]);

for (const target of TARGETS) {
  const distEntry = resolve(
    __dirname,
    `../dist/${target}/host/entry.${target}.html`,
  );
  const built = existsSync(distEntry);
  const runner = built ? test : test.fixme;

  runner(`ModalConsumer · ${target}: clicking close button in header fill fires the scoped close callback`, async ({
    page,
  }) => {
    await page.goto(`/?example=ModalConsumer&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Wait for all three dialogs to be present before the pre-click count.
    // `getByRole('dialog')` pierces shadow DOM (Lit) and is unaffected by CSS
    // Modules class hashing (React/Solid) — all 6 targets compile Modal's
    // dialog panel as `<div role="dialog" aria-modal="true">` (verified in
    // tests/dist-parity/fixtures/Modal.*). The matrix.spec ModalConsumer cell
    // also uses this same wait to capture the deterministic 3-dialog render.
    const dialogs = page.getByRole('dialog');
    await expect(dialogs).toHaveCount(3);

    // First dialog is Modal 1 (the one with the scoped #header fill that owns
    // the consumer's `×` close button). Find the first × button inside that
    // dialog and click it. Both the consumer's `<button class="close">×</button>`
    // and Modal's built-in `<button class="close-btn" aria-label="Close">×</button>`
    // render the same glyph; either click fires the scoped close() callback.
    // DOM order: consumer's header fill is rendered first (via the `<slot
    // name="header" :close="close">` slot), then Modal's built-in close-btn.
    const firstDialog = dialogs.first();
    const closeButton = firstDialog
      .locator('button')
      .filter({ hasText: '×' })
      .first();
    await closeButton.click();

    if (TARGETS_WHERE_CLOSE_PROPAGATES.has(target)) {
      // Vue/Svelte/Angular: model: true is auto-writable locally → modals 1+2
      // unmount → dialog count goes 3 → 1 (WrapperModal stays open).
      // Allow up to 1 second for the rerender to settle on slower CI hardware.
      await expect(dialogs).toHaveCount(1, { timeout: 1000 });
    } else {
      // React/Solid/Lit: controllable-state runtimes are no-ops on writes in
      // controlled mode (consumer didn't wire onOpenChange / event handlers).
      // Verify the click dispatched without throwing — the dialog count stays
      // at 3 (modal stays open). This is the documented v1 divergence for the
      // consumer-side `:open="$data.open"` one-way bind form.
      await expect(dialogs).toHaveCount(3);
    }
  });
}
