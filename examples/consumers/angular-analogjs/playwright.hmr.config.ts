import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 7 Plan 07-04 Task 2 — HMR state-preservation Playwright config (QA-04).
 *
 * Distinct from playwright.config.ts: that one runs `build && preview` (no HMR
 * exists in preview). The HMR specs need a live Vite DEV server so a `<style>`
 * edit on disk triggers a hot update — `webServer.command` runs `vite` (dev),
 * NOT `build && preview`.
 *
 * Key differences from the preview config (RESEARCH Pitfall 5):
 *   - testDir: './tests/e2e-hmr' — separate from the behavioral e2e specs
 *   - webServer.command runs the dev server (`pnpm dev` → `vite`)
 *   - reuseExistingServer: false — a clean dev server per run
 *   - port: angular-analogjs's vite.config.ts uses dev port 5175; this config
 *     pins an isolated HMR dev port (5186) via `--port` so the HMR suites can
 *     run together without colliding with the running demos.
 *
 * ANGULAR HOST-BUILD CAVEAT (07-ANGULAR-SPIKE.md Decision: ANGULAR IN; D7-OOS-01,
 * deferred-items.md): on the macOS host, `@analogjs/vite-plugin-angular@2.4.10`
 * imports a Vite-7+ export while the workspace resolves Vite 6, so the
 * angular-analogjs dev server cannot start on host. Inside the pinned
 * Playwright container a coherent install resolves and the dev server runs.
 * This config is committed and ready (Task 2 acceptance criterion: "the angular
 * HMR config exists even if the build is documented-out"); the angular HMR spec
 * (tests/e2e-hmr/hmr-state.spec.ts) is `.skip`-marked until the host toolchain
 * mismatch is resolved by the Angular leg (07-05).
 */
const HMR_PORT = 5186;

export default defineConfig({
  testDir: './tests/e2e-hmr',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${HMR_PORT}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm dev --port ${HMR_PORT} --strictPort`,
    port: HMR_PORT,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
