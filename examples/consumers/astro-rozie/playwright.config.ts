import { defineConfig, devices } from '@playwright/test';

/**
 * Runtime hydration e2e for the multi-target Astro island matrix.
 *
 * webServer runs `pnpm build && pnpm preview` so the spec hits the real
 * production build served by `astro preview` — the same strategy as
 * examples/consumers/react-vite/playwright.config.ts.
 *
 * testMatch is restricted to `hydrate.spec.ts` so the vitest build smoke
 * (tests/build.test.ts — a `.test.ts`, not a `.spec.ts`) is never picked up by
 * Playwright, and vitest never picks up this `.spec.ts` (vitest's default
 * include is `**\/*.{test,spec}` but the package's test:smoke runs only
 * tests/build.test.ts via its own config-free `vitest run` — see note below).
 *
 * Port 4178 is unused by the other consumer demos (react-vite 4174,
 * vue-vite 4173, solid-vite 4177).
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /hydrate\.spec\.ts$/,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4178',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    port: 4178,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
