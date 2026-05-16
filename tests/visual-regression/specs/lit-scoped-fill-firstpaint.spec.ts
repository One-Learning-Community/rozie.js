import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 07.2 Plan 03 Task 2 — Lit scoped-fill first-paint smoke test.
 *
 * Verifies RESEARCH Assumption A5 (Lit `observeRozieSlotCtx` race-condition
 * concern): when a consumer renders a scoped slot-fill, the captured ctx
 * MUST be available on the first paint — no flicker, no `undefined` reference
 * in the body's `this._headerCtx?.close` access.
 *
 * Topology:
 *   1. Consumer component (rozie-lit-scoped-fill-consumer) mounts a producer
 *      that declares `<slot name="header" :close="close">`.
 *   2. Consumer fills the header slot via `<template #header="{ close }">
 *      <button @click="close">×</button></template>`.
 *   3. Consumer's `firstUpdated()` wires `observeRozieSlotCtx` on the
 *      producer's `<slot name="header">` to capture the ctx and stash it in
 *      `this._headerCtx`.
 *   4. The fill body's lit-html template references the ctx via
 *      `@click=${() => this._headerCtx?.close?.()}`.
 *
 * What we assert (when the spec is unblocked):
 *   - The header slot's rendered `<button>` text reads "×" (basic projection works)
 *   - Clicking the button fires the producer's `close` callback (ctx wiring works)
 *   - Visual diff against the per-target baseline shows no flicker / no
 *     "missing ctx" placeholder text
 *
 * BLOCKED (Wave 1 — marked .fixme):
 *   This spec depends on a built `dist/lit/` host that mounts a
 *   `consumer-scoped-fill` route. Wave 1 ships the consumer-scoped-fill
 *   slot-matrix fixture (Plan 07.2-03 Task 3) but does NOT wire it into the
 *   `tests/visual-regression/scripts/build-cells.mjs` host build — that
 *   dogfood-style wiring lands in Plan 07.2-06 alongside the
 *   `examples/ModalConsumer.rozie` integration and the ModalConsumer baseline
 *   regen.
 *
 *   The spec is committed as-`.fixme` so the Wave-2 work surfaces it as a
 *   known-pending check rather than silently dropping the RESEARCH A5
 *   verification. Plan 07.2-06 will:
 *     (a) build a `host/lit-scoped-fill-firstpaint.html` route mounting the
 *         consumer-scoped-fill fixture's emitted output
 *     (b) regen the baseline PNG via the pinned Playwright Docker image
 *         (per memory `feedback_vr_linux_baselines`)
 *     (c) remove the `.fixme` gate below
 *
 * If at any point during Wave 2 a race materializes (consumer-side `<button>`
 * rendered with `this._headerCtx` undefined → ctx-wiring observation lands
 * AFTER the first paint), the resolution path is to add a no-flicker guard
 * in the emitted fill body: `${this._headerCtx ? html`<button …/>` : nothing}`.
 * That fix is mechanically applicable in `emitSlotFiller.ts:wrapWithSlotAttribute`
 * (Plan 07.2-03 deliverable). The Wave-1 design choice is to ship the
 * straight-through wiring and verify empirically in Wave 2 — per the plan's
 * must_haves.truths line 8 ("…if a race is observed, document as a deferred
 * follow-up in 07.2-03-SUMMARY.md").
 */

const litHostBuilt = existsSync(
  resolve(__dirname, '../dist/lit/host/lit-scoped-fill-firstpaint.html'),
);

// Wave-1 boundary: .fixme until Plan 07.2-06 wires the consumer-scoped-fill
// fixture into the visual-regression host build.
const runner = litHostBuilt ? test : test.fixme;

runner('lit-scoped-fill: first-paint header ctx is wired (RESEARCH A5)', async ({
  page,
}) => {
  await page.goto('/lit-scoped-fill-firstpaint.html');
  const consumer = page.getByTestId('rozie-mount');
  await expect(consumer).toBeVisible();
  // Header projects through and renders the close button — the most
  // load-bearing first-paint assertion since a race would leave the body
  // text empty or the button missing.
  const closeBtn = consumer.locator('button[slot="header"]');
  await expect(closeBtn).toHaveText('×');
  // Visual diff confirms no flicker / no missing-ctx placeholder. Baseline
  // generated in the pinned Playwright Docker image (`docs/parity.md` →
  // `tests/visual-regression/Dockerfile`).
  await expect(consumer).toHaveScreenshot('lit-scoped-fill-firstpaint.png', {
    maxDiffPixels: 2,
    animations: 'disabled',
  });
});
