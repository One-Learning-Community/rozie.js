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
  // Pre-bundle every dependency the dev server will pull in BEFORE the first
  // navigation. Vite's esbuild dep-scanner crawls real source, but it does NOT
  // see into Rozie's virtual `.rozie.tsx` modules (resolveId/load synthesise
  // them after the scan), so deps reachable only through a `.rozie` import —
  // `sortablejs` (SortableList pages), `postcss` (pulled in transitively by
  // @rozie/runtime-solid's runtime CSS scoping), and the Solid runtime trio —
  // are discovered LATE, at request time. A late discovery makes Vite
  // re-optimize and force a FULL-PAGE RELOAD on the first route load. Under
  // Playwright that reload destroys the page's execution context mid-test
  // ("Execution context was destroyed … because of a navigation"). On the
  // cached/floor leg the `.vite/deps` cache already holds these so no
  // re-optimize fires and the flake hides; a cold cache plus a solid-js version
  // override (the 1.9 matrix leg) re-triggers it. Forcing optimization at
  // dev-server START — before any navigation — keeps the dev server stable
  // across solid-js version changes.
  //
  // `postcss` lives under the linked `@rozie/runtime-solid` workspace package,
  // not in this demo's own node_modules, so it is reached via that import path
  // rather than a bare specifier. `holdUntilCrawlEnd` makes Vite finish the
  // full module crawl before serving the first request, so even a dep the
  // static scan misses is folded into the SAME optimization pass instead of
  // triggering a second (reloading) one.
  optimizeDeps: {
    holdUntilCrawlEnd: true,
    include: [
      'solid-js',
      'solid-js/web',
      'solid-js/store',
      'sortablejs',
      '@rozie/runtime-solid > postcss',
    ],
  },
  build: {
    sourcemap: true, // DX-04 — stack traces resolve to .rozie
  },
  server: {
    port: 5176,
  },
});
