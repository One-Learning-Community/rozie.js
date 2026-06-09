import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Node-flow-editor behavioral smoke — Rete.js v2 (`FlowCanvas`).
 *
 * FlowCanvas is the framework-agnostic-engine archetype: the engine
 * (NodeEditor + AreaPlugin + ConnectionPlugin) owns the graph + all pointer
 * interaction, and a single VANILLA render pipe (no rete-react/vue/… plugin)
 * fills each engine node element with DOM, emits `render` socket signals (so the
 * ConnectionPlugin + the DOM socket-position watcher see the anchors), and draws
 * connection SVG paths. `examples/demos/FlowCanvasDemo.rozie` drives a
 * config-array `:nodes` / `:connections` graph, a two-way `r-model:zoom`, an
 * "add node" button (push onto `$data.nodes`), and fills the REACTIVE
 * multi-instance `node` portal slot with framework-native node chrome.
 *
 *   1. **Mount + vanilla render (all 6 targets) — the make-or-break.** The
 *      wrapper's host `.rozie-flow-canvas` appears and the vanilla render pipe
 *      fills the engine node elements: ≥3 `.rozie-flow-node` boxes render. This
 *      proves the custom render layer fired across the framework boundary (no
 *      framework render plugin involved).
 *
 *   2. **Connections (all 6 targets).** The `:connections` array draws SVG paths
 *      via `classicConnectionPath` + the socket-position watcher — ≥1
 *      `.rozie-flow-connection__path` renders. Proves socket render-signal
 *      emission reached the watcher and the path redraw ran.
 *
 *   3. **Reactive node portal slot.** Each node body is the consumer
 *      `<template #node>` fragment (`.rozie-demo-node`) mounted per node via the
 *      reactive multi-instance portal. Their presence proves the per-node portal
 *      mounted framework-native content.
 *
 *   4. **Config-array reconcile (add node).** Clicking "Add node" pushes onto
 *      `$data.nodes`; the wrapper `$watch` reconciles it into the live editor
 *      (no remount), the count readout climbs, and a new `.rozie-flow-node`
 *      appears — the reactive-add proof.
 *
 *   5. **Two-way zoom.** Clicking "Zoom in" mutates `$data.zoom`; the model write
 *      reconciles into the live area (`area.area.zoom`) and the bound readout
 *      reflects the new level — the two-way round-trip proof.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. The deterministic pixel baseline is the SEPARATE
 * `FlowCanvasScreenshot` matrix cell (`FlowCanvasScreenshotDemo`). Like
 * `maplibre-map.spec.ts`, this spec runs locally on macOS without a Docker
 * baseline.
 *
 * If this spec is red but the other engine specs (chart, tiptap, maplibre) are
 * green, the regression is in the FlowCanvas wrapper's vanilla render pipe (the
 * `area.addPipe` render handler, the socket render-signal emission, or the
 * `$watch` graph reconcilers) — not the broader engine-wrapper pattern.
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
  runner(`rete-flow [${target}]: graph mounts via vanilla render, connections draw, node portal + reconcile + two-way zoom`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvas&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount + vanilla render (the make-or-break) ----
    // The CSS locators pierce Lit's open shadow root.
    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    // ≥3 node boxes filled by the vanilla render pipe.
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3);

    // ---- 2. connections drawn ----
    await expect
      .poll(async () => page.locator('.rozie-flow-connection__path').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);

    // ---- 3. reactive node portal slot mounted consumer content ----
    await expect
      .poll(async () => page.locator('.rozie-demo-node').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(3);

    // ---- 4. config-array reconcile: add a node ----
    const countReadout = page.getByTestId('readout-count');
    await expect(countReadout).toHaveText('3');
    const before = await page.locator('.rozie-flow-node').count();
    await page.getByTestId('add-node').click();
    await expect(countReadout).toHaveText('4');
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(before);

    // ---- 5. two-way zoom round-trip ----
    const zoomReadout = page.getByTestId('readout-zoom');
    await expect(zoomReadout).toHaveText('1');
    await page.getByTestId('zoom-in').click();
    await expect(zoomReadout).not.toHaveText('1', { timeout: 5_000 });
  });
}
