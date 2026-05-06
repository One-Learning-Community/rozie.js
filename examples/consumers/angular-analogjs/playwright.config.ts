import { defineConfig, devices } from '@playwright/test';

// Phase 5 Plan 05-01 Wave 0 — webServer runs `pnpm build && pnpm preview` so
// the source-maps Playwright e2e test (DX-01) can read published dist/assets/*.map
// files to verify the source-map chain composition. Mirrors react-vite-demo's
// e2e strategy from Phase 4 Plan 04-06.
//
// Port 4176 distinct from vue-vite-demo (4173), react-vite-demo (4174),
// svelte-vite-demo (4175). Server ports also distinct: 5173/5174/5175 across
// dev (vite.config.ts), preview ports use 4173-4176 to avoid collision in
// matrix CI runs.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4176',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4176 --strictPort',
    port: 4176,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
