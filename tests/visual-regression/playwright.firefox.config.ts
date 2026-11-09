import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Firefox runs of the SortableList keyboard-focus specs. Not part of CI or of
 * `playwright test` with the default config: run it by hand when keyboard
 * focus handling changes, e.g.
 *
 *   npx playwright test -c playwright.firefox.config.ts --workers=1
 *
 * Firefox can drop focus to <body> without a `blur` / `focusout` when a
 * focused element loses its `tabindex`, so the paths where SortableList takes
 * rows out of the tab order (keyboard turned off mid-lift, `disabled` on, a
 * holder list emptied by a hop) are checked here as well as in Chromium.
 * Behavioural assertions only; the specs take no screenshots.
 */
export default defineConfig({
  ...base,
  testMatch: [
    'sortable-keyboard-keys.spec.ts',
    'sortable-keyboard-cross-list.spec.ts',
    'sortable-keyboard-handle.spec.ts',
    'sortable-interactive-child.spec.ts',
  ],
  use: { ...base.use, ...devices['Desktop Firefox'], baseURL: 'http://localhost:4180', viewport: { width: 1280, height: 720 } },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
});
