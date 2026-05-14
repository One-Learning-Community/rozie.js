/*
 * Phase 7 Plan 02 — Solid cell entry.
 *
 * `import.meta.glob` gives Vite a static import map for all 8 reference
 * `.rozie` files; `@rozie/unplugin` (target: solid) + `vite-plugin-solid`
 * compile each to a Solid component. The runtime mount is Solid's `render`.
 */
import { render } from 'solid-js/web';
import { parseQuery, mountWrapper } from './main';

const modules = import.meta.glob('../../../examples/*.rozie');

async function main(): Promise<void> {
  const { example } = parseQuery();
  const key = `../../../examples/${example}.rozie`;
  const loader = modules[key];
  if (!loader) throw new Error(`visual-regression host: no module for ${key}`);
  const mod = (await loader()) as {
    default: Parameters<typeof render>[0];
  };
  render(mod.default, mountWrapper());
}

void main();
