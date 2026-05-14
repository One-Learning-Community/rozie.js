/*
 * Phase 7 Plan 02 — Vue cell entry (D-10 reference target).
 *
 * Vue is the visual REFERENCE target: the baseline PNGs in `__screenshots__/`
 * are generated from these renders, and every other target diffs against them.
 *
 * `import.meta.glob` gives Vite a static import map for all 8 reference
 * `.rozie` files; `@rozie/unplugin` (target: vue) + `@vitejs/plugin-vue` compile
 * each to a Vue SFC. The runtime mount is plain `createApp`.
 */
import { createApp } from 'vue';
import { parseQuery, mountWrapper } from './main';

const modules = import.meta.glob('../../../examples/*.rozie');

async function main(): Promise<void> {
  const { example } = parseQuery();
  const key = `../../../examples/${example}.rozie`;
  const loader = modules[key];
  if (!loader) throw new Error(`visual-regression host: no module for ${key}`);
  const mod = (await loader()) as { default: unknown };
  const app = createApp(mod.default as Parameters<typeof createApp>[0]);
  app.config.compilerOptions.isCustomElement = (tag: string) =>
    tag.startsWith('rozie-');
  app.mount(mountWrapper());
}

void main();
