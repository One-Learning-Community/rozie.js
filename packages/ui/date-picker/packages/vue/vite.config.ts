import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// Vue dual-packaging: compile the raw SFC to a drop-in dist/index.mjs via Vite
// lib mode + @vitejs/plugin-vue. vite-plugin-css-injected-by-js inlines the SFC
// scoped style into the JS. The runtime peers are externalized.
export default defineConfig({
  plugins: [vue(), cssInjectedByJsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.mjs' },
    rollupOptions: { external: ['vue', /^vue\//] },
  },
});
