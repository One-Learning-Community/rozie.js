import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Rozie from '@rozie/unplugin/vite';

// Preact-compat verification leg (mirrors the D-59 vite.config.swc.ts sibling
// pattern). This is NOT a new Rozie compile target — it builds the EXACT SAME
// React emit produced by `Rozie({ target: 'react' })`, but with every `react`
// and `react-dom` import aliased to `preact/compat`. The goal is to prove (and
// keep proving in CI) that Rozie's React output + @rozie/runtime-react run
// correctly under preact/compat, which is how Preact users consume Rozie
// components.
//
// Selected by the react-matrix.yml `preact-compat` CI job via
// `vite build --config vite.config.preact.ts` (the demo's `build:preact`
// script), and exercised by the same Playwright e2e suite through
// VITE_USE_PREACT=1 (see playwright.config.ts).
//
// @vitejs/plugin-react is KEPT (the simpler of the two JSX options): its
// automatic-runtime output imports `react/jsx-runtime`, which the alias below
// redirects to `preact/jsx-runtime`.
//
// `@rozie/unplugin` ships compiled JS to dist/ (tsdown). Run `pnpm --filter
// @rozie/unplugin run build` once before `vite build` so the dist/ output
// exists.
export default defineConfig({
  plugins: [
    Rozie({ target: 'react' }),
    react(),
  ],
  resolve: {
    // Array form, MOST-SPECIFIC FIRST. Vite string finds match exactly OR as
    // a prefix followed by `/` — so the bare `react` entry would also match
    // `react/jsx-runtime` (though never `react-dom`; no `/` boundary).
    // Listing subpaths first ensures they hit their dedicated aliases instead
    // of falling through to the bare `react` / `react-dom` fallbacks.
    alias: [
      { find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
      { find: 'react/jsx-dev-runtime', replacement: 'preact/jsx-runtime' },
      { find: 'react-dom/client', replacement: 'preact/compat/client' },
      { find: 'react-dom', replacement: 'preact/compat' },
      { find: 'react', replacement: 'preact/compat' },
    ],
    // Collapse every `react` import in the demo AND its workspace deps
    // (@rozie/runtime-react etc.) onto a SINGLE preact/compat instance —
    // mirrors why vite.config.swc.ts dedupes react, except here all react
    // resolutions land on one preact.
    dedupe: ['preact', 'preact/compat'],
  },
  build: {
    sourcemap: true, // DX-01 parity with the sibling configs.
  },
  server: {
    port: 5173,
  },
});
