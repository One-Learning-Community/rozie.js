import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * PDF viewer behavioral smoke — PDF.js (`pdfjs-dist` v6), the dynamic-import +
 * canvas-render + two-way-page archetype.
 *
 * `examples/demos/PdfViewerDemo.rozie` lazy-imports `pdfjs-dist` inside $onMount
 * (SSR-safe + code-split), points `GlobalWorkerOptions.workerSrc` at a
 * Vite-BUNDLED worker (Docker/CI has NO network), loads a network-free 3-page
 * base64 PDF data URL, and renders each page to a `<canvas>` with a selectable
 * `.textLayer` over it.
 *
 *   1. **Load.** `@load` fires with `{ numPages }` → the total readout shows 3.
 *      Proves the $onMount → `import('pdfjs-dist')` → `getDocument().promise`
 *      path booted with the bundled worker resolved.
 *
 *   2. **Canvas render.** The engine builds a `.rozie-pdf-page` holding a
 *      `<canvas>` — proves a page actually rasterized (the CSS locator pierces
 *      Lit's open shadow root).
 *
 *   3. **Text layer (selectable text).** `textLayer` (default on) renders the
 *      PDF.js `.textLayer` with absolutely-positioned `<span>`s over the canvas —
 *      the differentiator vs a dumb image. We assert a `.textLayer span` exists
 *      (its glyphs may fall back offline since standardFontDataUrl is a CDN — the
 *      span's PRESENCE is what proves the selectable layer rendered).
 *
 *   4. **Two-way `page` round-trip (all 6 targets).** The page readout shows the
 *      bound `$data.page` (starts at 1). Clicking "Next" mutates `$data.page`
 *      directly; the model write flows into the wrapper → `$watch($props.page)` →
 *      `$data.current` → `renderView()` + the `$model.page` echo, so the readout
 *      advances to 2. Driven via `$data` (not the `$expose` handle) so it is
 *      uniform across all 6 — an Angular child-component ref resolves to the host
 *      element, not the instance, so a handle-driven Next would no-op there.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. There is NO PDF screenshot cell: pdfjs renders to a
 * `<canvas>` (the chartjs/maplibre canvas-VR class, where cross-emit byte-
 * identity won't hold) and the worker/standard-font CDN can't load in Docker.
 * Like `maplibre-map.spec.ts` / `cropper.spec.ts`, this spec runs locally on
 * macOS without a Docker baseline.
 *
 * If this spec is red but the other engine specs (chart, maplibre, cropper) are
 * green, the regression is in the PdfViewer wrapper's mount path (the dynamic
 * `import('pdfjs-dist')` + worker config in $onMount, the getDocument →
 * renderView pipeline, or the two-way `page` echo) — not the broader
 * engine-wrapper pattern.
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
  runner(`pdf [${target}]: doc loads, canvas + text layer render, Next advances two-way page`, async ({
    page,
  }) => {
    await page.goto(`/?example=PdfViewer&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. load → numPages ----
    // `@load` echoes {numPages} into $data.total once getDocument resolves.
    const total = mount.getByTestId('total-readout');
    await expect
      .poll(
        async () => Number((await total.textContent())?.trim() ?? '0'),
        { timeout: 20_000, intervals: [200, 400, 800, 1600, 3200] },
      )
      .toBe(3);

    // ---- 2. canvas render ----
    // A page rasterized into a `.rozie-pdf-page > canvas`.
    await expect(
      page.locator('.rozie-pdf-page canvas').first(),
    ).toBeVisible({ timeout: 15_000 });

    // ---- 3. text layer (selectable text) ----
    // The selectable `.textLayer` spans render over the canvas.
    await expect(
      page.locator('.rozie-pdf .textLayer span').first(),
    ).toBeAttached({ timeout: 15_000 });

    // ---- 4. two-way `page` round-trip ----
    const readout = mount.getByTestId('page-readout');
    await expect(readout).toHaveText('1');
    await mount.getByTestId('next').click();
    await expect(readout).toHaveText('2', { timeout: 10_000 });
  });
}
