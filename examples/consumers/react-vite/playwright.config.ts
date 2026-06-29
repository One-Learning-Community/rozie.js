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
 *
 * Preact leg: VITE_USE_PREACT=1 selects vite.config.preact.ts, which builds the
 * same React emit with react/react-dom aliased to preact/compat. Used by the
 * react-matrix.yml preact-compat job to run this same e2e suite under
 * preact/compat. VITE_USE_PREACT wins over VITE_USE_SWC when both are set.
 */
const usePreact = process.env.VITE_USE_PREACT === '1';
const useSwc = process.env.VITE_USE_SWC === '1';
const buildCommand = usePreact
  ? 'pnpm build:preact && pnpm preview'
  : useSwc
    ? 'pnpm build:swc && pnpm preview'
    : 'pnpm build && pnpm preview';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: buildCommand,
    // Vite 8 (Rolldown) binds preview to IPv6 `[::1]` by default; pin the
    // server + readiness probe + baseURL to explicit IPv4 127.0.0.1 so the
    // ambiguous `localhost` (IPv6-first on Node 18+/macOS) can't desync them.
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
