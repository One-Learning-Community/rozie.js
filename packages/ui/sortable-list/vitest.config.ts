// Vitest config for @rozie-ui/sortable-list (meta-package).
// happy-dom env so DOM globals (HTMLElement, document) are available for the
// colocated useSortableJS test, which mounts a fake SortableJS over real DOM
// nodes. Mirrors the former engine-helpers package's vitest config so the
// moved test (src/internal/useSortableJS.test.ts) runs unchanged.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { realpathSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// tests/ssr.test.ts renders the React leaf, whose runtime helper package
// (@rozie/runtime-react) resolves a different React than the leaf does: pin
// both to the leaf's React so hooks share one instance.
const leafModule = (name: string) => realpathSync(resolve(__dirname, 'packages/react/node_modules', name));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react$/, replacement: leafModule('react') },
      { find: /^react\/(.*)$/, replacement: leafModule('react') + '/$1' },
      { find: /^react-dom$/, replacement: leafModule('react-dom') },
      { find: /^react-dom\/(.*)$/, replacement: leafModule('react-dom') + '/$1' },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
  },
});
