import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import Rozie from '@rozie/unplugin/vite';

// Phase 06.3 — Rozie wired BEFORE solidPlugin() per RESEARCH Pitfall 2.
// Both plugins use enforce: 'pre'; within that tier Vite respects declaration
// order. If solidPlugin() runs first it will try to Babel-parse `.rozie` and
// fail with `Unexpected token`. The path-virtual chain (D-25 / D-58 / D-139):
// Rozie's resolveId rewrites `Foo.rozie` → `<abs>/Foo.rozie.tsx`; load returns
// the compiled .tsx source; vite-plugin-solid picks it up via its default
// transform pipeline (matches `.tsx`).
//
// `@rozie/unplugin` ships compiled JS to dist/. Run `pnpm --filter
// @rozie/unplugin run build` once before `vite dev` / `vite build` so dist/ exists.

export default defineConfig({
  plugins: [
    Rozie({ target: 'solid' }),
    solidPlugin(),
  ],
  build: {
    sourcemap: true, // DX-04 — stack traces resolve to .rozie
  },
  server: {
    port: 5176,
  },
});
