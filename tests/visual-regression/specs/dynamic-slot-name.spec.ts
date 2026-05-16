import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 07.2 Plan 04 Task 3 — Dynamic slot-name runtime swap (R5 acceptance).
 *
 * Verifies the runtime behavior of R5 dynamic-name dispatch end-to-end across
 * all 6 targets: the consumer's `<template #[$data.slotName]>` projection
 * targets the producer slot whose name matches `slotName` at runtime, and
 * mutating `slotName` swaps which producer slot the fill body lands in.
 *
 * Topology:
 *   1. Consumer (the `consumer-dynamic-name` slot-matrix fixture) declares:
 *        <data>{ slotName: 'a' }</data>
 *        <template #[$data.slotName]>Dynamic fill</template>
 *      consumed inside a `<Producer>` that declares 2 named slots
 *      (`<slot name="a">A default</slot>`, `<slot name="b">B default</slot>`).
 *   2. Initial render: slotName === 'a' → the body "Dynamic fill" projects
 *      into slot "a"; slot "b" renders its defaultContent "B default".
 *   3. Runtime toggle (programmatic via the host page's exposed setter or
 *      query-param-driven reload): slotName ← 'b' → the body now projects
 *      into slot "b"; slot "a" renders "A default".
 *
 * What we assert (when the spec is unblocked):
 *   - Pre-toggle: slot "a" container contains "Dynamic fill"; slot "b"
 *     container contains "B default".
 *   - Post-toggle: slot "a" container contains "A default"; slot "b"
 *     container contains "Dynamic fill".
 *   - The swap is observed across all 6 targets (one Playwright iteration
 *     per target column — matches the matrix.spec.ts iteration shape).
 *
 * BLOCKED (Wave 2 — marked .fixme):
 *   This spec depends on a built `dist/<target>/host/dynamic-slot-name.html`
 *   route mounting the `consumer-dynamic-name` fixture's emitted output PLUS
 *   the producer-side acceptance of the `slots` / `snippets` / `templates`
 *   input prop (the documented React render-prop divergence + Angular
 *   templates-input divergence). Plan 07.2-04 ships the consumer-side emit
 *   shapes; Plan 07.2-06 wires:
 *
 *     (a) Host route per target mounting the consumer-dynamic-name fixture
 *     (b) Producer-side acceptance of the dynamic-name prop (slots /
 *         snippets / templates) — currently consumer-only emit
 *     (c) Regen of Linux-rendered baseline PNGs via the pinned Playwright
 *         Docker image (per memory `feedback_vr_linux_baselines`)
 *     (d) Removal of the `.fixme` gate below
 *
 * The spec is committed as `.fixme` so the Wave 2 work surfaces it as a
 * known-pending check rather than silently dropping the R5 runtime
 * verification. The slot-matrix snapshot suite (this plan's Task 3) is the
 * static byte-equal verification of the emitter shapes; this Playwright
 * spec is the runtime behavioural verification of the dispatch.
 *
 * Lit + Vue dispatch is already runtime-functional (Lit via shadow-DOM
 * native projection of `slot="${expr}"`, Vue via its compiler-sfc native
 * `<template #[expr]>` support) — those two targets do NOT need producer-
 * side prop acceptance to swap correctly. React/Solid/Svelte/Angular
 * dispatch requires the producer-side prop wiring noted above.
 */

const hostBuilt = existsSync(
  resolve(__dirname, '../dist/vue/host/dynamic-slot-name.html'),
);

// Wave-2 boundary: .fixme until Plan 07.2-06 wires the consumer-dynamic-name
// fixture into the visual-regression host build AND lands producer-side
// acceptance of the slots/snippets/templates input props.
const runner = hostBuilt ? test : test.fixme;

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  runner(`dynamic-slot-name [${target}]: runtime toggle of slotName swaps the projected fill`, async ({
    page,
  }) => {
    await page.goto(`/${target}/host/dynamic-slot-name.html`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Pre-toggle assertions: body should be in slot "a", default in slot "b".
    const slotA = mount.locator('[data-rozie-slot-name="a"]').first();
    const slotB = mount.locator('[data-rozie-slot-name="b"]').first();
    await expect(slotA).toContainText('Dynamic fill');
    await expect(slotB).toContainText('B default');

    // Programmatic toggle of slotName from 'a' to 'b'. The host page
    // exposes a button or input element that mutates the consumer's
    // reactive `slotName` data field. Each target's host page wires it
    // identically per its idiom (Vue ref().value=, React useState setter,
    // Svelte $state proxy assignment, Solid signal setter, Lit signal
    // setter, Angular signal()).
    await page.getByTestId('toggle-slot-name').click();

    // Post-toggle assertions: body should be in slot "b", default in "a".
    await expect(slotA).toContainText('A default');
    await expect(slotB).toContainText('Dynamic fill');
  });
}
