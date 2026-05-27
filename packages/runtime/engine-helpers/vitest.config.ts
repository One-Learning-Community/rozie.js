// Vitest config for @rozie/runtime-engine-helpers.
// happy-dom env so DOM globals (HTMLElement, document) are available for
// useSortableJS tests that mount a fake SortableJS over real DOM nodes.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
  },
});
