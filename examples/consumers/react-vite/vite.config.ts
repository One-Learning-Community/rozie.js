import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Rozie from '@rozie/unplugin/vite';

// Phase 4 Plan 06 — Rozie wired BEFORE react() per D-58 (enforce: 'pre' is also
// declared inside the plugin object, but plugins[] order is the conventional
// signal). The path-virtual chain (D-58 / Plan 04-05 Wave 0 spike):
// Rozie's resolveId rewrites `Foo.rozie` → `<abs>/Foo.rozie.tsx`; load returns
// the compiled .tsx source; @vitejs/plugin-react picks it up via its default
// transform pipeline. Sibling .module.css / .global.css virtual ids are
// handled by Rozie's load hook before Vite's CSS-Modules pipeline applies
// hashing.
//
// `@rozie/unplugin` ships compiled JS to dist/ (tsdown). Run `pnpm --filter
// @rozie/unplugin run build` once before `vite build` / `vite dev` so the
// dist/ output exists. Phase 6 will add this to the workspace's pre-build
// turbo task pipeline.
export default defineConfig({
  plugins: [
    Rozie({ target: 'react' }),
    react(),
  ],
  build: {
    sourcemap: true, // DX-01 requirement — stack traces resolve to .rozie
  },
  server: {
    port: 5173,
  },
});
