// Vitest config for @rozie-ui/sortable-list (meta-package).
// happy-dom env so DOM globals (HTMLElement, document) are available for the
// colocated useSortableJS test, which mounts a fake SortableJS over real DOM
// nodes. Mirrors the former engine-helpers package's vitest config so the
// moved test (src/internal/useSortableJS.test.ts) runs unchanged.
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
