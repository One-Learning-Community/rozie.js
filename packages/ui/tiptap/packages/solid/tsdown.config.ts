import { defineConfig } from 'tsdown';
import { solidLeafConfig } from '../../../solid-leaf-build.mjs';

// Two builds (compiled JS + a `solid`-condition JSX build) — see packages/ui/solid-leaf-build.mjs.
export default defineConfig(solidLeafConfig({
  entry: ['src/index.ts'],
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
    '@tiptap/extension-character-count',
  ],
}));
