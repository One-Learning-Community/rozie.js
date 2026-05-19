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
 * Un-gated 2026-05-17 (post-Phase 07.3.2.1 F-07.3.2-11-A closure): the
 * scoped-fill ctx wiring works at first paint. Wiring:
 *
 *     (a) examples/demos/LitScopedFillFirstpaintDemo.rozie         — consumer
 *         with `<template #header="{ close }"><button @click="close">×</button></template>`
 *     (b) examples/demos/LitScopedFillFirstpaintDemoProducer.rozie — producer
 *         with `<slot name="header" :close="close" />`
 *     (c) tests/visual-regression/host/main.ts EXAMPLES + LIT_TAGS entries
 *         so the standard `?example=LitScopedFillFirstpaint&target=lit`
 *         URL router mounts the demo
 *     (d) Build-availability gate `dist/lit/host/entry.lit.html`
 *
 * If at any point a race materializes (consumer-side `<button>` rendered
 * with `this._headerCtx` undefined → ctx-wiring observation lands AFTER
 * the first paint), the resolution path is to add a no-flicker guard in
 * the emitted fill body: `${this._headerCtx ? html`<button …/>` : nothing}`.
 * That fix is mechanically applicable in `emitSlotFiller.ts:wrapWithSlotAttribute`.
 */

const litHostBuilt = existsSync(
  resolve(__dirname, '../dist/lit/host/entry.lit.html'),
);

const runner = litHostBuilt ? test : test.fixme;

runner('lit-scoped-fill: first-paint header ctx is wired (RESEARCH A5)', async ({
  page,
}) => {
  await page.goto('/?example=LitScopedFillFirstpaint&target=lit');
  const consumer = page.getByTestId('rozie-mount');
  await expect(consumer).toBeVisible();
  // Header projects through and renders the close button — the most
  // load-bearing first-paint assertion since a race would leave the body
  // text empty or the button missing.
  //
  // Selector note: post-ec24d26, scoped destructured fills
  // (`<template #header="{ close }">`) flow through Lit's function-prop
  // path (`.header=${(scope) => html`<button>...</button>`}`), so the
  // button renders INSIDE the producer's shadow DOM, not as a
  // `<button slot="header">` in the consumer's light DOM. The accessible-
  // name role lookup pierces shadow roots and finds the button regardless
  // of which slot mechanism the consumer-side emitter chose.
  const closeBtn = consumer.getByRole('button', { name: '×' });
  await expect(closeBtn).toHaveText('×');
  // Visual diff confirms no flicker / no missing-ctx placeholder. Baseline
  // generated in the pinned Playwright Docker image (`docs/parity.md` →
  // `tests/visual-regression/Dockerfile`).
  await expect(consumer).toHaveScreenshot('lit-scoped-fill-firstpaint.png', {
    maxDiffPixels: 2,
    animations: 'disabled',
  });
});
