import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 69 Plan 06 (D-04): local-only headless smoke asserting each
 * newly-live playground iframe (from 69-01..69-05) is console-clean +
 * non-blank. NOT wired into any `.github/workflows/*` CI job — user decision
 * 2026-07-01 keeps this local-only.
 *
 * Vite 8 (Rolldown) binds `vite preview` to IPv6 `[::1]` by default; pin the
 * webServer + readiness probe + baseURL to explicit IPv4 `127.0.0.1` (mirrors
 * `examples/consumers/react-vite/playwright.config.ts`) so the ambiguous
 * default host alias (IPv6-first on Node 18+/macOS) can't desync them. The
 * playground's own `preview` script also pins `--host 127.0.0.1` for the
 * same reason.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // Engine-CSS specs drive real engine libraries (Leaflet, Cropper,
  // Flatpickr) fetched from the esm.sh CDN at runtime — a single retry
  // absorbs transient CDN/network hiccups (e.g. Leaflet's default marker
  // icon assets occasionally 404 under concurrent-worker load) without
  // masking a genuine, reproducible regression.
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
