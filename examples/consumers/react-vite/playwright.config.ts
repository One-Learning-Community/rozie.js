import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
  },
  // Plan 04-05 will wire `pnpm build && pnpm preview` similar to vue-vite-demo.
  // Wave 0 ships a minimal preview command; Plan 04-05 swaps to build+preview
  // once the unplugin React branch ships.
  webServer: {
    command: 'pnpm preview',
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
