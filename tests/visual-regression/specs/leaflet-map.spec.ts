import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Non-portal engine-wrapper runtime smoke — Leaflet.
 *
 * `examples/LeafletMap.rozie` wraps the real `leaflet` engine (v1.9.x). The
 * wrapper boots `L.map($el)` on `$onMount`, adds an OpenStreetMap
 * `L.tileLayer`, and reconciles `center` / `zoom` prop changes into the live
 * map instance via `$watch` (no re-creation).
 *
 * WHY THIS SPEC IS BEHAVIORAL-ONLY (no pixel-screenshot assertion):
 *
 * LeafletMap renders LIVE network tiles from `tile.openstreetmap.org`. Tile
 * imagery is non-deterministic — OSM re-renders its raster tiles over time,
 * tile-server load varies which tiles arrive first, and the exact pixel
 * content depends on map data that changes independently of Rozie. A pixel
 * screenshot baseline would flake every CI run. Instead, this spec makes
 * STRUCTURAL assertions that prove the Leaflet engine integration works —
 * `.leaflet-container` on the map root, `.leaflet-tile` elements materializing
 * — without any baseline PNG dependency.
 *
 * This is why `matrix.spec.ts` deliberately EXCLUDES `LeafletMap` from its
 * screenshot-cell `EXAMPLES` list — the other 4 engine demos (SortableList,
 * Flatpickr, Uppy, TipTap) plus Table are deterministic screenshot cells;
 * LeafletMap is covered here instead.
 *
 * Per `feedback_vr_linux_baselines`: this spec makes only structural
 * assertions — no pixel-screenshot matcher at all. It runs locally on macOS
 * without any Docker baseline regen.
 *
 * If this spec is red but the other engine specs (full-calendar, line-chart)
 * are green, the regression is in the LeafletMap wrapper's engine-mount path
 * (`L.map($el)` on `$onMount`, tile-layer wiring, or the `$watch` view
 * reconciliation) — not the broader engine-wrapper authoring pattern.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  // Build-availability gate — copied from full-calendar.spec.ts. When the
  // per-target VR sub-build did not produce `dist/<target>/`, the cell is
  // registered with `test.fixme` (known-pending) rather than erroring.
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = built ? test : test.fixme;
  runner(`leaflet-map [${target}]: mounts engine + loads OSM tiles`, async ({
    page,
  }) => {
    // Collect page-level runtime errors before navigation. A clean engine
    // integration emits zero uncaught errors and zero console.error calls.
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Record OSM tile requests — a second, independent proof that the
    // tile-layer actually fired network requests for map imagery.
    const tileRequests: string[] = [];
    page.on('request', (req) => {
      if (/tile\.openstreetmap\.org/.test(req.url())) {
        tileRequests.push(req.url());
      }
    });

    await page.goto(`/?example=LeafletMap&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // The Leaflet engine mounted: `L.map()` adds `.leaflet-container` to the
    // wrapper's `<div class="rozie-leaflet-map">` host element. For Lit cells
    // the map root lives inside the producer's shadow DOM, but Playwright's
    // locator engine pierces shadow boundaries by default.
    const mapRoot = mount.locator('.leaflet-container');
    await expect(mapRoot).toBeVisible({ timeout: 10_000 });

    // Tile layer loaded: Leaflet adds `.leaflet-tile` elements as raster tiles
    // arrive. Network tiles may lag, so use a generous timeout. The DOM
    // assertion (rather than the request-count assertion) is the primary gate
    // because it proves the tiles actually attached to the map, not merely
    // that a request fired.
    const tiles = mount.locator('.leaflet-tile');
    await expect(tiles.first()).toBeVisible({ timeout: 15_000 });
    expect(await tiles.count()).toBeGreaterThan(0);

    // Secondary proof: at least one OSM tile request was issued. This guards
    // against a hypothetical `.leaflet-tile` placeholder appearing without an
    // actual tile-server fetch.
    expect(
      tileRequests.length,
      'LeafletMap should have requested at least one OSM tile',
    ).toBeGreaterThan(0);

    // No uncaught runtime errors and no console.error during the mount.
    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual(
      [],
    );
    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('; ')}`,
    ).toEqual([]);
  });
}
