import { createApp } from 'vue';
import App from './App.vue';

// Phase 06.4 P3 — Vue must whitelist `rozie-*` tags as custom elements so its
// template compiler does NOT try to resolve them as Vue components. The same
// `isCustomElement` predicate is also wired in vite.config.ts so the
// production build's static template compilation respects it. (Vue exposes the
// option in two layers: `app.config.compilerOptions` for runtime SFC compile,
// and `@vitejs/plugin-vue.template.compilerOptions` for build-time compile.)
const app = createApp(App);
app.config.compilerOptions.isCustomElement = (tag: string) =>
  tag.startsWith('rozie-');
app.mount('#app');
