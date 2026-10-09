// Vitest config for @rozie-ui/tiptap.
//
// No `include` allowlist: vitest's default glob collects every *.test.* /
// *.spec.* file under this package, so a test added outside tests/ is still run.
//
// Test surfaces:
//   • tests/*.test.ts — compile()/lowerToIR surface gates and lazy-extension /
//     collision / sidecar contracts. Pure @rozie/core, no DOM.
//   • tests/image-upload*.behavior.test.ts — mount-and-drive behaviour proof
//     for the uploadImage paste/drop handlers. Each opts into the happy-dom DOM
//     environment via a per-file `// @vitest-environment happy-dom` docblock so
//     the rest of the suite keeps the fast, DOM-less default.
//
// WHY THE BEHAVIOUR TESTS COMPILE FROM SOURCE instead of importing the committed
// packages/vue/src/TipTap.vue leaf: a red test turns green from the
// src/TipTap.rozie edit alone, with no codegen run in between; and the compile
// call below is the very one scripts/codegen.mjs makes for the Vue leaf
// (`compile(source, { target: 'vue', filename: 'TipTap.rozie' })`), so the
// mounted module is exactly what the Vue leaf will contain.
//
// The virtual id must end in `.vue` (so @vitejs/plugin-vue transforms it) and
// sit under src/ (so the compiled module's bare `@tiptap/*` and `vue` imports
// resolve from this family package's node_modules).
//
// testTimeout: 30000 — compile() is a heavy module graph; under
// `turbo run test` parallel CPU starvation can exceed vitest's 5s default.
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { compile } from '@rozie/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VIRTUAL_SPECIFIER = 'virtual:tiptap-vue-from-source';
const VIRTUAL_ID = resolve(__dirname, 'src/TipTap.rozie.vue');
const SOURCE_PATH = resolve(__dirname, 'src/TipTap.rozie');

const tiptapVueFromSource = {
  name: 'tiptap-vue-from-source',
  enforce: 'pre' as const,
  resolveId(id: string) {
    if (id === VIRTUAL_SPECIFIER) return VIRTUAL_ID;
    return null;
  },
  load(id: string) {
    if (id !== VIRTUAL_ID) return null;
    const source = readFileSync(SOURCE_PATH, 'utf8');
    const result = compile(source, { target: 'vue', filename: 'TipTap.rozie' });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    if (errors.length) {
      throw new Error(
        'TipTap.rozie failed to compile to Vue:\n' +
          errors.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
      );
    }
    return result.code;
  },
};

export default defineConfig({
  plugins: [tiptapVueFromSource, vue()],
  test: {
    globals: false,
    environment: 'node',
    root: __dirname,
    testTimeout: 30000,
  },
});
