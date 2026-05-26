import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['./*.test.ts'],
    // Each spawn is sub-second on a warm cache. Generous 30s ceiling so a
    // first-run cold start (e.g., right after `pnpm install`) doesn't flake.
    testTimeout: 30000,
  },
});
