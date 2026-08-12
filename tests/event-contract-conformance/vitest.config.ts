import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'happy-dom',
    include: ['./*.test.ts'],
    testTimeout: 30000,
  },
});
