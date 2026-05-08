import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 06.3 P3 — Solid Vite demo Playwright config.
 *
 * webServer starts the dev server (not build+preview) for fast iteration.
 * SC #2 (parent-flip-mid-lifecycle Dropdown) runs against the live Vite
 * dev server so that vite-plugin-solid's Babel transform pipeline is exercised
 * in the same way it runs in production.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5176',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    port: 5176,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
