import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 7 Plan 07-04 Task 2 — HMR state-preservation Playwright config (QA-04).
 *
 * solid-vite's existing playwright.config.ts already runs the DEV server
 * (`pnpm dev`), but this dedicated HMR config keeps the HMR specs in their own
 * testDir and pins an isolated dev port + `reuseExistingServer: false` so a
 * clean dev server is started per run (a stale server could mask an HMR
 * boundary bug).
 *
 * Key differences from the existing config (RESEARCH Pitfall 5):
 *   - testDir: './tests/e2e-hmr' — separate from the behavioral specs in ./tests
 *   - reuseExistingServer: false — a clean dev server per run
 *   - port: solid-vite's vite.config.ts uses dev port 5176; this config pins an
 *     isolated HMR dev port (5187) via `--port` so the HMR suites can run
 *     together without colliding with the running demos.
 */
const HMR_PORT = 5187;

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
