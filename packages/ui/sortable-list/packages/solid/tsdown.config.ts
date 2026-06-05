import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`SortableList`/
  // `Flatpickr`) and its `default`. Opt into rolldown 'named' export mode
  // explicitly so that mix is unambiguous (silences MIXED_EXPORTS; the default
  // lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: ['solid-js', '@rozie/runtime-solid', 'sortablejs'],
});
