import { defineConfig, devices } from '@playwright/test';

// Phase 5 Plan 05-01 Wave 0 — webServer runs `pnpm build && pnpm preview` so
// the source-maps Playwright e2e test (DX-01) can read published dist/assets/*.map
// files to verify the source-map chain composition. Mirrors vue-vite-demo's e2e
// strategy from Phase 3 Plan 03-06.
//
// Port 4174 distinct from vue-vite-demo (4173) and react-vite-demo (4174 — note
// react-vite already uses 4174; this svelte demo dev-server uses 5174 in
// vite.config.ts but `vite preview` defaults differ). To avoid collision in
// matrix CI runs, this preview uses 4175 explicitly.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'on-first-retry',
  },
  // Vite 8 (Rolldown) binds preview to IPv6 `[::1]` by default; pin server +
  // probe + baseURL to explicit IPv4 so ambiguous `localhost` can't desync them.
  webServer: {
    command: 'pnpm build && pnpm preview --port 4175 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
