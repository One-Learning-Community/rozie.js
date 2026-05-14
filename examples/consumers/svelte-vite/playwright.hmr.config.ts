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
 *   - port: svelte-vite's vite.config.ts uses dev port 5174; this config pins
 *     an isolated HMR dev port (5185) via `--port` so the HMR suites can run
 *     together without colliding with the running demos.
 */
const HMR_PORT = 5185;

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
