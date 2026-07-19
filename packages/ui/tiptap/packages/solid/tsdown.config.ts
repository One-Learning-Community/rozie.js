import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`TipTap`) and its
  // `default` — opt into rolldown 'named' export mode (silences MIXED_EXPORTS).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: [
    'solid-js',
    'solid-js/web',
    '@rozie/runtime-solid',
    '@tiptap/core',
    '@tiptap/starter-kit',
    '@tiptap/extension-image',
  ],
});
