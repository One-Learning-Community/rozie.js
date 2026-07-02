// Vitest config for @rozie/runtime-keynav-core.
// `node` environment (not happy-dom/jsdom) — the state machine is pure logic
// driven by duck-typed event/host shapes, never a real DOM (SPEC §8, Task 2).
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
  },
});
