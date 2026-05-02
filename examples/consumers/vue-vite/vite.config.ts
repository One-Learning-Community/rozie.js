import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// NOTE: @rozie/unplugin wiring deferred to Plan 06 (P5).
// Plan 01 (P0) creates the skeleton; Plan 06 adds Rozie({ target: 'vue' })
// BEFORE vue() in the plugins array per D-25 enforce: 'pre' chain order.
export default defineConfig({
  plugins: [vue()],
  build: {
    sourcemap: true, // DX-01 requirement
  },
});
