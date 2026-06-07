import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * WebGL map-engine behavioral smoke — MapLibre GL JS (Phase 35).
 *
 * MapLibre is the WebGL-canvas two-way-camera archetype: camera moves flow back
 * via the engine's `moveend`/`zoomend` events (echo-guarded by the
 * `rozieProgrammatic` eventData), and the wrapper reflects consumer-driven
 * writes into the live map through `$watch(() => $props.center/zoom)` → easeTo.
 * `examples/demos/MapLibreDemo.rozie` binds `r-model:center` + `r-model:zoom` to
 * `$data`, passes an OFFLINE style object (network-free — Docker/CI has NO
 * network, so the default demotiles URL would fail to load), renders a
 * navigation control, fills the REACTIVE multi-instance `marker` portal slot
 * (3 entries), and fills the MOUNT-ONCE `control` portal slot.
 *
 *   1. **Mount.** The map mounts (`new maplibregl.Map()` adds `.maplibregl-map`
 *      / `.maplibregl-canvas` to the wrapper's host div) — proves the
 *      $onMount → new Map() path picked up the offline style + camera props.
 *
 *   2. **Standard control (all 6 targets).** `:controls="['navigation']"` adds a
 *      `maplibregl.NavigationControl`, which renders a `.maplibregl-ctrl`. Its
 *      presence proves the controls reconcile fired.
 *
 *   3. **Reactive marker portal slot (all 6 targets).** `:markers` drives the
 *      REACTIVE multi-instance `marker` portal slot; each entry mounts the
 *      consumer `<template #marker>` fragment (`.rozie-demo-pin`) into a
 *      `maplibregl.Marker` element. The pins appearing proves the reactive
 *      multi-instance portal mounted framework-native content.
 *
 *   4. **Two-way camera.** Clicking the "Zoom in" button mutates `$data.zoom`;
 *      the model write reconciles into the live map (easeTo) and the camera
 *      echoes back, so the bound `.readout` text climbs — the two-way-camera
 *      round-trip proof.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. The deterministic pixel baseline is the SEPARATE
 * `MapLibreScreenshot` matrix cell (`MapLibreScreenshotDemo`). Like
 * `leaflet-map.spec.ts`, this spec runs locally on macOS without a Docker
 * baseline.
 *
 * If this spec is red but the other engine specs (chart, tiptap) are green, the
 * regression is in the MapLibre wrapper's engine-mount path (`new
 * maplibregl.Map()` on `$onMount`, the controls/marker reconcilers, or the
 * `$watch` camera reconciliation) — not the broader engine-wrapper pattern.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

for (const target of TARGETS) {
  // Build-availability gate — when the per-target VR sub-build did not produce
  // `dist/<target>/`, the cell registers with `test.fixme` (known-pending)
  // rather than erroring.
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`maplibre-map [${target}]: map mounts, control + marker portals render, two-way camera updates`, async ({
    page,
  }) => {
    await page.goto(`/?example=MapLibre&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount ----
    // `new maplibregl.Map()` adds `.maplibregl-map` to the wrapper's host div and
    // `.maplibregl-canvas` (the WebGL canvas) inside it once the engine boots —
    // the deterministic post-mount signal. The CSS locator pierces Lit's open
    // shadow root.
    const mapRoot = page.locator('.maplibregl-map').first();
    await expect(mapRoot).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.maplibregl-canvas').first()).toBeVisible({
      timeout: 15_000,
    });

    // ---- 2. standard navigation control (ALL 6 targets) ----
    // `:controls="['navigation']"` adds a NavigationControl → `.maplibregl-ctrl`.
    await expect(page.locator('.maplibregl-ctrl').first()).toBeVisible({
      timeout: 10_000,
    });

    // ---- 3. reactive marker portal slot (ALL 6 targets) ----
    // Each `:markers` entry mounts the `<template #marker>` fragment
    // (`.rozie-demo-pin`) into a maplibregl.Marker element. Poll for all 3.
    await expect
      .poll(async () => await page.locator('.rozie-demo-pin').count(), {
        timeout: 10_000,
        intervals: [200, 400, 800, 1600],
      })
      .toBe(3);

    // ---- 4. two-way camera round-trip ----
    // The readout shows the bound `$data.zoom` (seeded at 4). Clicking "Zoom in"
    // bumps `$data.zoom`; the model write reconciles into the live map (easeTo)
    // and the camera echoes back, so the bound readout text climbs above 4.
    const readout = mount.getByTestId('readout-zoom');
    await expect(readout).toHaveText('4', { timeout: 5_000 });
    await mount.getByTestId('zoom-in').click();
    await expect
      .poll(
        async () => Number((await readout.textContent())?.trim() ?? '0'),
        { timeout: 5_000, intervals: [200, 400, 800] },
      )
      .toBeGreaterThan(4);
  });
}
