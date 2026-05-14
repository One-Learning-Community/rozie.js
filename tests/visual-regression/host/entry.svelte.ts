/*
 * Phase 7 Plan 02 — Svelte cell entry.
 *
 * `import.meta.glob` gives Vite a static import map for all 8 reference
 * `.rozie` files; `@rozie/unplugin` (target: svelte) + `@sveltejs/vite-plugin-svelte`
 * compile each to a Svelte 5 component. The runtime mount is the Svelte 5
 * `mount()` API.
 */
import { mount } from 'svelte';
import { parseQuery, mountWrapper } from './main';

const modules = import.meta.glob('../../../examples/*.rozie');

async function main(): Promise<void> {
  const { example } = parseQuery();
  const key = `../../../examples/${example}.rozie`;
  const loader = modules[key];
  if (!loader) throw new Error(`visual-regression host: no module for ${key}`);
  const mod = (await loader()) as { default: Parameters<typeof mount>[0] };
  mount(mod.default, { target: mountWrapper() });
}

void main();
