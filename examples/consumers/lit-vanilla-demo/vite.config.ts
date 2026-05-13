import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import Rozie from '@rozie/unplugin/vite';

// Phase 06.4 Plan 03 — Lit-target consumer demo.
//
// Lit has NO host Vite plugin (unlike vue-vite / react-vite / svelte-vite /
// angular-analogjs). Lit components are plain ES modules that self-register
// via `customElements.define()` at module load. Rozie's resolveId rewrites
// `Foo.rozie` → `<abs>/Foo.rozie.ts`; load returns the compiled Lit class.
// Vite's default `.ts` transform pipeline handles the rest.
//
// Vite ^6 required (Lit + lit-html HMR requires Vite 6+ per RESEARCH.md).
// Port 5177 / preview 4177 distinct from other demos
// (vue 5173 / react 5173 — note overlap was a Vue-only collision /
// svelte 5174 / angular 5175 / solid 5176).
//
// `@rozie/unplugin` ships compiled JS to dist/. Run `pnpm --filter
// @rozie/unplugin build` once before `vite dev` / `vite build`.
export default defineConfig({
  plugins: [Rozie({ target: 'lit' })],
  build: {
    sourcemap: true,
    rollupOptions: {
      // Per-page HTML inputs so vite build emits separate bundles for each
      // /pages/<Name>Page.html route. This mirrors a multi-page MPA setup.
      input: {
        index: resolve(__dirname, 'index.html'),
        counter: resolve(__dirname, 'src/pages/CounterPage.html'),
        searchInput: resolve(__dirname, 'src/pages/SearchInputPage.html'),
        dropdown: resolve(__dirname, 'src/pages/DropdownPage.html'),
        todoList: resolve(__dirname, 'src/pages/TodoListPage.html'),
        modal: resolve(__dirname, 'src/pages/ModalPage.html'),
        treeNode: resolve(__dirname, 'src/pages/TreeNodePage.html'),
        card: resolve(__dirname, 'src/pages/CardPage.html'),
        cardHeader: resolve(__dirname, 'src/pages/CardHeaderPage.html'),
      },
    },
  },
  server: {
    port: 5177,
  },
  preview: {
    port: 4177,
  },
});
