import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// Vue dual-packaging spike (cropper-vue): compile the raw SFC to a drop-in
// dist/index.mjs. Vue cannot use tsdown (it does not compile SFCs), so we use
// Vite lib mode + @vitejs/plugin-vue. vite-plugin-css-injected-by-js bundles the
// SFC `<style scoped>` CSS INTO the JS (injected at import time) so consumers need
// no separate CSS import. vue + cropperjs are externalized (runtime peers).
export default defineConfig({
  plugins: [vue(), cssInjectedByJsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: ['vue', 'cropperjs', /^vue\//],
    },
  },
});
