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
 *   - reuseExistingServer: false — a clean dev server per run (a stale server
 *     could mask an HMR boundary bug)
 *   - port: the dev-server port. vue-vite's vite.config.ts uses dev port 5173,
 *     but react-vite also uses 5173 — to avoid a collision when the HMR suites
 *     run together this config pins an isolated HMR dev port (5183) via the
 *     `--port` flag.
 */
const HMR_PORT = 5183;

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
