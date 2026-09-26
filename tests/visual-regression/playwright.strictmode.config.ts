import { defineConfig, devices } from '@playwright/test';

/**
 * Quick 260926 — dedicated Playwright config for tiptap-strictmode.spec.ts.
 *
 * The main playwright.config.ts serves this package's `vite build` + `preview`
 * output (production-shaped, for pixel comparison) — React's StrictMode
 * double-invoke is dev-only and would be a complete no-op there. This config
 * instead runs the SAME vite.config.ts as a DEV server (`vite`, not `vite
 * build`) with `ROZIE_TARGET=react`, so `<StrictMode>` (opted into per-cell via
 * `&strict=1`, see entry.react.ts) genuinely double-invokes effects — the only
 * way to reproduce the async-construction double-Editor regression this one
 * spec guards.
 *
 * Separate port (4181) from the main config's preview server (4180) and from
 * the per-target dev ports documented in playwright.config.ts's header
 * (4173-4177), so both configs — and any of those other dev servers — can run
 * without colliding.
 */
export default defineConfig({
  testDir: './specs',
  testMatch: 'tiptap-strictmode.spec.ts',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4181',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'ROZIE_TARGET=react npx vite --port 4181 --strictPort',
    port: 4181,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
