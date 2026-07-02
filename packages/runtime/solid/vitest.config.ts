// Vitest config for @rozie/runtime-solid.
// happy-dom env so DOM globals are available for createOutsideClick tests.
//
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname so snapshot
// path resolution is stable across `pnpm --filter @rozie/runtime-solid test`
// from repo root vs direct invocation in the package directory.
//
// Plan 71-07 (r-keynav) — `resolve.conditions: ['browser']` is REQUIRED for
// `createEffect`/`onMount` to actually run. `solid-js`'s package.json exports
// a separate `"node"` condition (`dist/server.js`, the SSR build) where
// `createEffect`/`onMount` are literal no-op stubs (`function onMount(fn)
// {}`) — Vitest resolves that condition by default since it runs in Node,
// even under `environment: 'happy-dom'`. Every OTHER test in this package
// (createOutsideClick, etc.) happened to never call `createEffect`/`onMount`
// directly, so this resolution gap was latent until `createKeynav.test.tsx`
// (the first real-DOM test exercising Solid's actual effect scheduler)
// surfaced it. `'browser'` selects `dist/solid.js` — the SAME build Vite
// bundles into production output — so tests now exercise the real reactivity
// path, not a silently-inert SSR stub.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    root: __dirname,
    snapshotFormat: { printBasicPrototype: false },
  },
});
