import { defineConfig, devices } from '@playwright/test';

/**
 * Plan 04-06: webServer runs `pnpm build && pnpm preview` so the source-maps
 * Playwright e2e test (DX-01) can read the published dist/assets/*.map files
 * to verify the source-map chain composition (mirrors vue-vite-demo's e2e
 * source-maps strategy from Phase 3 Plan 03-06).
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
