import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import Rozie from '@rozie/unplugin/vite';

// Phase 4 Plan 06 — SWC variant of vite.config.ts (D-59 leg of the React
// matrix). Identical wiring to the default config except the React transform
// plugin is @vitejs/plugin-react-swc instead of @vitejs/plugin-react. The
// react-matrix.yml workflow selects this file via `--config vite.config.swc.ts`
// so the SWC source-map composition path (D-59) is exercised in CI without
// `sed`-rewriting the canonical vite.config.ts.
export default defineConfig({
  plugins: [
    Rozie({ target: 'react' }),
    react(),
  ],
  // `@vitejs/plugin-react-swc` does NOT auto-dedupe React the way the Babel
  // `@vitejs/plugin-react` plugin does. In a pnpm workspace where one
  // package (e.g. `@rozie/runtime-react`) installs `react: ^18` as its
  // own devDep alongside the consumer demo's `react: ^19`, Vite resolves
  // `react` per-importer-subgraph and ends up bundling BOTH React versions.
  // At runtime, hooks called from the runtime package (built against React
  // 18) read from React 18's `ReactCurrentDispatcher`, which never gets
  // populated (the renderer is React 19), and crash with
  // `Cannot read properties of null (reading 'useRef')` at first render.
  // Forcing dedup makes every `import 'react'` in the bundle resolve to
  // the consumer demo's react@19. Mirrors what plugin-react does
  // automatically.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    sourcemap: true, // DX-01 requirement — stack traces resolve to .rozie
  },
  server: {
    port: 5173,
  },
});
