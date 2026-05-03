import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: @rozie/unplugin wiring deferred to Plan 04-05.
// Plan 04-01 (P0) creates the skeleton; Plan 04-05 adds Rozie({ target: 'react' })
// BEFORE react() in plugins[], with enforce: 'pre' (per D-58).
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true, // DX-01 requirement
  },
});
