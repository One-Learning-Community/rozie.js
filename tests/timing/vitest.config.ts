import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Phase 5 success criterion #4 — cross-target debounce parity.
//
// jsdom is required for Angular TestBed (happy-dom does not fully implement
// the APIs Angular's zoneless TestBed depends on); jsdom is also fine for
// Vue test-utils + @testing-library/react + Svelte 5 mount, so we use it
// uniformly across all 4 per-target tests.
//
// resolve.conditions: ['browser'] — Svelte 5's package.json has a `browser`
// export condition that points to the client-mount-capable index-client.js;
// without `browser` in conditions, the default export resolves to
// index-server.js where mount() throws lifecycle_function_unavailable.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    root: __dirname,
    testTimeout: 30000,
    server: {
      deps: {
        inline: ['svelte'],
      },
    },
  },
  resolve: {
    conditions: ['browser'],
  },
});
