import { defineConfig } from 'vitest/config';

/**
 * Scope vitest (the `test:smoke` build smoke) to `*.test.ts` ONLY, so it never
 * picks up the Playwright runtime spec `tests/hydrate.spec.ts` (a `.spec.ts`,
 * which imports @playwright/test and would crash under vitest). Playwright in
 * turn matches only `hydrate.spec.ts` (see playwright.config.ts), so the two
 * runners never collide.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
