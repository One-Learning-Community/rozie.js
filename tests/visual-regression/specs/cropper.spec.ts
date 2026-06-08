import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Image-cropper behavioral smoke — Cropper.js v1.
 *
 * Cropper.js is the imperative-engine + two-way-data archetype: the engine
 * attaches to an <img>, builds its `.cropper-*` crop UI, and fires a continuous
 * `crop` event carrying the crop box; the wrapper echoes that into the two-way
 * `data` model and applies consumer writes back via `setData` (round-trip
 * guarded). `examples/demos/CropperDemo.rozie` binds `r-model:data` to `$data`,
 * loads a network-free SVG data URL (Docker/CI has NO network), and drives the
 * `$expose` handle's `rotateBy(90)` from a button.
 *
 *   1. **Mount.** `new Cropper(img, opts)` builds `.cropper-container` inside the
 *      wrapper host — proves the $onMount → engine-construct path picked up the
 *      <img> (queried from the ref'd container) + the props.
 *
 *   2. **Crop box (all 6 targets).** `autoCrop` (default) renders a
 *      `.cropper-crop-box`. Its presence proves the engine laid out its crop UI.
 *
 *   3. **Two-way `data` round-trip (all 6 targets).** The width readout shows the
 *      bound `$data.box.width`, which climbs above 0 once the first `crop` event
 *      echoes the live box into `$model.data` (the two-way READ). Clicking "Shrink
 *      crop" mutates `$data.box.width` directly; the model write flows into the
 *      wrapper → `$watch` → `setData` → the `crop` echo, so the readout shrinks
 *      (the two-way WRITE). Driven via `$data` (not the `$expose` handle) so it is
 *      uniform across all 6 — an Angular child-component ref resolves to the host
 *      element, not the instance, so a handle-driven action would no-op there.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. The deterministic pixel baseline is the SEPARATE
 * `CropperScreenshot` matrix cell (`CropperScreenshotDemo`). Like
 * `maplibre-map.spec.ts`, this spec runs locally on macOS without a Docker
 * baseline.
 *
 * If this spec is red but the other engine specs (chart, maplibre) are green, the
 * regression is in the Cropper wrapper's engine-mount path (`new Cropper()` on
 * `$onMount`, the `crop`-event two-way echo, or the `$expose` handle) — not the
 * broader engine-wrapper pattern.
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
  runner(`cropper [${target}]: cropper mounts, crop box renders, shrink updates two-way data`, async ({
    page,
  }) => {
    await page.goto(`/?example=Cropper&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount ----
    // `new Cropper(img, opts)` builds `.cropper-container` once the engine boots.
    // The CSS locator pierces Lit's open shadow root.
    await expect(page.locator('.cropper-container').first()).toBeVisible({
      timeout: 15_000,
    });

    // ---- 2. crop box (ALL 6 targets) ----
    // `autoCrop` (default true) renders a `.cropper-crop-box`.
    await expect(page.locator('.cropper-crop-box').first()).toBeVisible({
      timeout: 10_000,
    });

    // ---- 3. two-way data round-trip ----
    // The width readout climbs above 0 once the first `crop` event echoes the
    // live box into `$model.data` (two-way READ).
    const readout = mount.getByTestId('readout-width');
    await expect
      .poll(
        async () => Number((await readout.textContent())?.trim() ?? '0'),
        { timeout: 10_000, intervals: [200, 400, 800, 1600] },
      )
      .toBeGreaterThan(0);
    const before = Number((await readout.textContent())?.trim() ?? '0');
    // Clicking "Shrink crop" mutates `$data.box.width`; the model write flows into
    // the wrapper → $watch → setData → the `crop` echo, so the readout shrinks
    // (two-way WRITE).
    await mount.getByTestId('shrink').click();
    await expect
      .poll(
        async () => Number((await readout.textContent())?.trim() ?? '0'),
        { timeout: 5_000, intervals: [200, 400, 800] },
      )
      .toBeLessThan(before);
  });
}
