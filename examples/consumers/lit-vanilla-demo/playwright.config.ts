import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 06.4 Plan 03 — Lit vanilla-demo Playwright config.
 *
 * webServer runs `vite build && vite preview` so the multi-page bundle is
 * served from dist/. Port 4177 distinct from other demos (vue 4173 /
 * react 4174 / svelte 4175 / angular 4176 / solid 4178). Lit demo uses
 * 4177 to fit the canonical demo-port ordering.
 *
 * Mirrors solid-vite/playwright.config.ts shape but uses build+preview
 * instead of dev — the vanilla demo's source-map chain is exercised
 * once at build time; we don't need vite-dev's HMR.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4177',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    port: 4177,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
