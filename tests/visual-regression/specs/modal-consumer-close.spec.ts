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

// Phase 07.3 Plan 09 — consumer-side `r-model:open=` directive now propagates
// the scoped close()'s writeback in ALL six targets. The previously divergent
// 4 (svelte/react/solid/lit) used to fail because the consumer's
// `:open="$data.open"` compiled to a one-way bind and the producer-side
// controllable-state runtime no-op'd writes in controlled mode. With
// `r-model:open="$data.openN"` the per-target two-way emit (bind:open,
// onOpenChange, [(open)], v-model:open, @open-change) wires the writeback
// path, so the count-drop assertion is semantically meaningful everywhere.
const TARGETS_WHERE_CLOSE_PROPAGATES = new Set<(typeof TARGETS)[number]>([
  'vue',
  'react',
  'svelte',
  'angular',
  'solid',
  'lit',
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
}
