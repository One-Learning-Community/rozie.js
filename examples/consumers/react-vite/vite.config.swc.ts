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
  build: {
    sourcemap: true, // DX-01 requirement — stack traces resolve to .rozie
  },
  server: {
    port: 5173,
  },
});
