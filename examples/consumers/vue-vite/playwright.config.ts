import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  // `pnpm build && pnpm preview --port 4173`:
  //   - `vite build` produces dist/ (production source maps verified by DX-01 e2e)
  //   - `vite preview` serves dist/ at 127.0.0.1:4173
  //   - reuseExistingServer in dev avoids re-build per test run
  // Vite 8 (Rolldown) binds preview to IPv6 `[::1]` by default; pin server +
  // probe + baseURL to explicit IPv4 so ambiguous `localhost` can't desync them.
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
