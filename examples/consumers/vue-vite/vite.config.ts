import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
// Phase 3 Plan 06 — Rozie wired BEFORE vue() per D-25 (enforce: 'pre' is also
// declared inside the plugin object, but plugins[] order is the conventional
// signal). The path-virtual chain (D-25 amendment / Plan 06 Wave 0 spike):
// Rozie's resolveId rewrites `Foo.rozie` → `<abs>/Foo.rozie.vue`; load returns
// the compiled Vue SFC source; vite-plugin-vue picks it up via its default
// `/\.vue$/` transformInclude.
//
// `@rozie/unplugin` ships compiled JS to dist/ (tsdown). Run `pnpm --filter
// @rozie/unplugin run build` once before `vite build` / `vite dev` so the
// dist/ output exists. Phase 6 will add this to the workspace's pre-build
// turbo task pipeline.
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  plugins: [
    Rozie({ target: 'vue' }),
    vue(),
  ],
  build: {
    sourcemap: true, // DX-01 requirement — stack traces resolve to .rozie
  },
  server: {
    port: 5173,
  },
});
