import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 07.2 Plan 06 Task 2 — ModalConsumer close-interaction smoke spec.
 * Plan 07.2-06.1 — debug-fix follow-up: rewrite selectors to be cross-target.
 * Phase 07.3 Plan 09 — un-fixme'd 4 cells (svelte/react/solid/lit) once the
 * consumer-side `r-model:propName=` directive landed across all 6 targets.
 * ModalConsumer.rozie now uses D-04 per-instance state ($data.open1/2/3) and
 * `r-model:open="$data.openN"` per Modal instance, so the scoped close()
 * propagates the writeback in every target.
 *
 * Verifies the dogfood acceptance from ROADMAP Phase 07.2 Success Criterion 4:
 *   "Header/footer markup appears, default-slot body renders, scoped `close`
 *    callback closes the modal when invoked from inside a fill."
 *
 * Topology:
 *   1. Each per-target ModalConsumer host route mounts the compiled
 *      ModalConsumer.rozie at `[data-testid="rozie-mount"]`.
 *   2. ModalConsumer renders THREE modals (1: scoped header+footer fill; 2:
 *      dynamic-name fill; 3: re-projection via WrapperModal). Per Phase
 *      07.3 D-04 each Modal owns its own state (`open1/open2/open3` in
 *      `<data>`) and binds via `r-model:open="$data.openN"`. On first paint
 *      all three are `true` so the matrix.spec ModalConsumer screenshot is
 *      unchanged (3 dialogs visible).
 *   3. Clicking the consumer-fill `×` button fires the scoped `close()`
 *      callback, which writes `false` to the bound `$data.openN`. With the
 *      r-model:open= consumer-side wiring (Phase 07.3) the writeback now
 *      propagates in ALL six targets — the clicked Modal unmounts and the
 *      dialog count goes 3 → 2. Modals 2 and 3 keep their own independent
 *      open state (`open2/open3`) so only the clicked one disappears.
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
 * BLOCKED (gated by dist/ build):
 *   The spec depends on a built `dist/<target>/host/entry.<target>.html`
 *   that mounts the `ModalConsumer` example at `/?example=ModalConsumer&
 *   target=<target>`. When dist/ is absent the runner gates each cell with
 *   `test.fixme` so the harness reports them as known-pending rather than
 *   failing CI on the first spec run before the host build has completed.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// Phase 07.3.1 closed Phase 07.3 deferred Blockers #2 (D-02: Svelte snippet-arg
// object shape + producer snippets-merge for dynamic names) and #3 (D-03: Lit
// late-binding wrap + scoped-slot ctx via dispatchEvent + slot= spread + light
// DOM _hasSlot pre-seed) — all 6 targets now propagate close events end-to-end.
const TARGETS_WHERE_CLOSE_PROPAGATES = new Set<(typeof TARGETS)[number]>([
  'vue',
  'react',
  'svelte', // Phase 07.3.1 Plans 02 + 06 — D-02 + D-SV-16
  'angular',
  'solid',
  'lit',    // Phase 07.3.1 Plans 03 + 05 + 07 + 08 — D-03 + D-LIT-15/17/18
]);

for (const target of TARGETS) {
  const distEntry = resolve(
    __dirname,
    `../dist/${target}/host/entry.${target}.html`,
  );
  const built = existsSync(distEntry);
  const propagates = TARGETS_WHERE_CLOSE_PROPAGATES.has(target);
  // Phase 07.3 Plan 09 — `propagates` is now true for all 6 targets (the
  // r-model:open= consumer-side directive wires the writeback path in every
  // target). The `!propagates` half of this gate is kept as defense-in-depth
  // in case a future regression silently breaks consumer-side two-way on
  // some target — flipping the set member back to exclude that target turns
  // the cell into a known-pending `.fixme` without code churn. The active
  // gate is `!built` (dist/ availability), which surfaces the spec as
  // known-pending only when the per-target host build hasn't yet produced
  // `dist/<target>/host/entry.<target>.html`.
  const runner = !built || !propagates ? test.fixme : test;

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

    // Find the first × button on the page. DOM order: Modal 1's consumer-fill
    // `<button class="close">×</button>` comes first (the header slot is
    // rendered before Modal's own built-in close-btn).
    //
    // CRITICAL — shadow DOM piercing: `page.getByRole()` pierces shadow DOM,
    // unlike chained CSS selectors. We locate the button at the page root.
    const closeButton = page.getByRole('button', { name: '×' }).first();
    await closeButton.click();

    // Phase 07.3 — each Modal instance owns its own per-instance state
    // ($data.open1/2/3) and engages the consumer-side two-way directive
    // (r-model:open). Clicking Modal 1's scoped close() now writes false
    // back through the target's two-way wiring (v-model:open / bind:open /
    // [(open)] / onOpenChange / @open-change), flipping ONLY $data.open1
    // to false. Modals 2 and 3 keep their own state. Dialog count: 3 → 2.
    // Default Playwright timeout (5 s) accommodates resource-constrained
    // CI runners (Linux Docker, GHA free tier) where post-click DOM
    // rerender can take longer than a 1 s override would tolerate.
    await expect(dialogs).toHaveCount(2);
  });

  // Phase 07.3.2 D-04 — Modal 2 dynamic-fill (SC#1-SC#3 acceptance) + Modal 3
  // WrapperModal re-projection (SC#4 acceptance). Both gate the producer-side
  // intake landed in Plans 01-04 (React/Solid/Angular `slots?:` / `templates?:`
  // map merge + React no-params named-slot `?.()` invocation root-cause fix).
  // These tests are orthogonal to the close-propagation gate above: they only
  // depend on `built` (the per-target Vite host bundle existing on disk),
  // NOT on `TARGETS_WHERE_CLOSE_PROPAGATES`. The 12 new cells (6 targets × 2
  // tests) gate the producer-side intake across the dogfood matrix.
  const dynRunner = !built ? test.fixme : test;
  dynRunner(`ModalConsumer · ${target}: Modal 2 dynamic-fill text "Dynamic header via slotName" is visible`, async ({
    page,
  }) => {
    await page.goto(`/?example=ModalConsumer&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    // All 3 dialogs are present on first paint ($data.open1/2/3 default true).
    // Wait for the deterministic 3-dialog render before asserting on the
    // dynamic-fill content (same getByRole('dialog') wait used by the close
    // test above; pierces shadow DOM for Lit, unaffected by CSS Modules
    // hashing for React/Solid).
    await expect(page.getByRole('dialog')).toHaveCount(3);
    // Modal 2 fills `#[$data.slotName]` (resolves to "header" at runtime, per
    // ModalConsumer.rozie:21) with `<span class="dynamic-fill">Dynamic header
    // via slotName</span>` (L47). Before Plans 01-04, React/Solid/Angular's
    // producer Modal had no `slots?:` / `templates?:` intake field, so the
    // dynamic-name slot bridge silently no-op'd — the span never rendered in
    // 3 of 6 targets. Vue/Svelte/Lit already worked (Vue/Lit native slot
    // resolution, Svelte fixed in commit 6060408 / D-SV-16).
    const dynamicFill = page.locator('.dynamic-fill');
    await expect(dynamicFill).toBeVisible();
    await expect(dynamicFill).toHaveText('Dynamic header via slotName');
  });

  const reprojRunner = !built ? test.fixme : test;
  reprojRunner(`ModalConsumer · ${target}: Modal 3 WrapperModal re-projects #brand to inner header and #actions to inner footer`, async ({
    page,
  }) => {
    await page.goto(`/?example=ModalConsumer&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(3);
    // Modal 3 uses WrapperModal which forwards `<template #brand>` into the
    // inner Modal's `#header` slot (WrapperModal.rozie:18-22) and
    // `<template #actions>` into `#footer` (L24-26). Re-projection works in
    // 5/6 targets natively (Vue/Svelte/Solid/Angular/Lit forward slot fills
    // through any number of wrapper layers). React failed silently because
    // its render-prop slot consumer experience requires explicit producer-side
    // invocation of the no-params named-slot function — fixed in Plan 04
    // (emitSlotInvocation.ts:279-303 now emits `?.()` form, composing with
    // Plan 01's `(props.renderBrand ?? props.slots?.['brand'])` merge).
    await expect(page.getByText('Re-projected brand')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wrapper action' })).toBeVisible();
  });
}
