// Phase 69 Plan 06 (D-04), residual (b).
//
// 69-01 generalized the engine-CSS capture-and-inject pass (_shared.js's
// stubUnresolvableImports + injectEngineCss) across all six harnesses,
// fixing a hard crash (not just unstyled render) on vue/svelte/angular for
// Cropper/Flatpickr/Leaflet. Per RESEARCH Pitfall 1, vue/svelte/angular were
// the previously-untested targets for these three engine-CSS families.
//
// ANGULAR IS DELIBERATELY EXCLUDED from this matrix. Cropper/Flatpickr/
// Leaflet demos are all COMPOSED bundles (entry .rozie + a sibling .rozie
// component), and deferred-items.md documents a pre-existing, unrelated
// NG0303 + `nativeElement` crash that hard-fails EVERY Angular composed-
// bundle demo today (root-caused as an Angular JIT `imports:` resolution
// issue, confirmed unrelated to the CSS-injection work this residual
// covers — see deferred-items.md's 69-01/69-03 entries). Asserting Angular
// here would encode that known-broken, out-of-scope case as expected-pass.
// MapLibre is likewise out of scope — its package is absent from every
// harness importmap (a separate, pre-existing WS1-era gap).
import { test, expect } from '@playwright/test';

test.setTimeout(90_000);

const DEMOS = ['bundle/CropperDemo', 'bundle/FlatpickrDemo', 'bundle/LeafletMapDemo'] as const;
const TARGETS = ['vue', 'svelte'] as const;

for (const demo of DEMOS) {
  for (const target of TARGETS) {
    test(`${demo} renders console-clean + non-blank on ${target} (residual b)`, async ({
      page,
    }) => {
      await page.goto('/');

      // Switch target first (default snippet still selected) so the
      // playground's own default-load compile noise and this target's
      // one-time cold esbuild-wasm init both settle BEFORE we start
      // listening for console errors — see svelte-portal.spec.ts for the
      // detailed rationale (same pattern, same false-positive source).
      await page.locator('#target').selectOption(target);
      await page.waitForTimeout(20_000);

      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(String(e)));

      await page.locator('#snippet').selectOption(demo);
      await expect(page.locator('#preview-status')).toHaveText('rendered', { timeout: 45_000 });

      const frame = page.frameLocator(`.preview-cell[data-target="${target}"] iframe`);
      const app = frame.locator('#app');
      await expect(app).not.toBeEmpty();
      const childCount = await app.locator('*').count();
      expect(childCount).toBeGreaterThan(0);

      expect(
        errors,
        `console/page errors for ${demo} on ${target}: ${errors.join('\n')}`,
      ).toEqual([]);
    });
  }
}
