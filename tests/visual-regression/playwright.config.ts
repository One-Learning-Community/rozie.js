import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 7 Plan 02 — visual-regression Playwright config (D-10 / D-12).
 *
 * Reference topology (D-10): Vue is the visual reference target. The baseline
 * PNGs in `__screenshots__/` are keyed by EXAMPLE ONLY — `snapshotPathTemplate`
 * deliberately omits `{projectName}`/`{arg}`-suffixing so every target's
 * screenshot of `Counter` diffs against the SAME `Counter.png` Vue baseline. A
 * target that "renders wrong but consistently" still gets caught.
 *
 * Deterministic rendering (D-12 / RESEARCH Pitfall 2): `deviceScaleFactor: 1`
 * and a fixed `viewport` pin the raster; `maxDiffPixels: 2` is the ≤2px
 * tolerance; `animations: 'disabled'` freezes transitions at the assertion
 * layer (host/reset.css also kills them at the CSS layer).
 *
 * Port 4180 — demos occupy 4173 (vue) / 4174 (react) / 4175 (svelte) /
 * 4176 (angular) / 4177 (lit-vanilla). `--strictPort` fails fast on collision.
 *
 * Per D-12 the pinned Playwright container is the authoritative screenshot
 * environment; local runs are advisory. CI runs this inside
 * mcr.microsoft.com/playwright:v1.60.0-jammy (see .github/workflows/visual-regression.yml).
 */
export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 2,
      animations: 'disabled',
    },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4180',
    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    port: 4180,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
