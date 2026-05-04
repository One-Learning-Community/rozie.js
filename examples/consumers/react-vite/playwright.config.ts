import { defineConfig, devices } from '@playwright/test';

/**
 * Plan 04-06: webServer runs `pnpm build && pnpm preview` so the source-maps
 * Playwright e2e test (DX-01) can read the published dist/assets/*.map files
 * to verify the source-map chain composition (mirrors vue-vite-demo's e2e
 * source-maps strategy from Phase 3 Plan 03-06).
 *
 * D-59: VITE_USE_SWC=1 selects the @vitejs/plugin-react-swc config
 * (vite.config.swc.ts) instead of the canonical @vitejs/plugin-react config.
 * Used by the react-matrix.yml SWC matrix leg.
 */
const useSwc = process.env.VITE_USE_SWC === '1';
const buildCommand = useSwc
  ? 'pnpm build:swc && pnpm preview'
  : 'pnpm build && pnpm preview';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: buildCommand,
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
