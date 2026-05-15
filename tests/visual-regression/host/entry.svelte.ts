/*
 * Phase 7 Plan 02 — Svelte cell entry.
 *
 * `import.meta.glob` gives Vite a static import map for all 8 reference
 * `.rozie` files; `@rozie/unplugin` (target: svelte) + `@sveltejs/vite-plugin-svelte`
 * compile each to a Svelte 5 component. The runtime mount is the Svelte 5
 * `mount()` API.
 */
import { mount } from 'svelte';
import { parseQuery, mountWrapper, DEFAULT_PROPS } from './main';

// Two glob roots — see entry.vue.ts for rationale; demos/ wins over root.
const baseModules = import.meta.glob('../../../examples/*.rozie');
const demoModules = import.meta.glob('../../../examples/demos/*.rozie');

async function main(): Promise<void> {
  const { example } = parseQuery();
  const demoKey = `../../../examples/demos/${example}Demo.rozie`;
  const baseKey = `../../../examples/${example}.rozie`;
  const isDemo = demoKey in demoModules;
  const loader = demoModules[demoKey] ?? baseModules[baseKey];
  if (!loader)
    throw new Error(
      `visual-regression host: no module for ${example} (checked ${demoKey} and ${baseKey})`,
    );
  const mod = (await loader()) as { default: Parameters<typeof mount>[0] };
  // Svelte 5's `mount(C, { target, props })` — DEFAULT_PROPS[example]
  // becomes the component's initial $props(). Demo wrappers hardcode their
  // state inline; props skipped to avoid noisy "unused export property"
  // warnings.
  mount(mod.default, {
    target: mountWrapper(),
    props: isDemo ? {} : (DEFAULT_PROPS[example] as Record<string, unknown>),
  });
}

void main();
