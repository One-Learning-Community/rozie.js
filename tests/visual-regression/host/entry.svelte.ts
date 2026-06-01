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
const baseModules = import.meta.glob('../../../examples/{Counter,SearchInput,Dropdown,TodoList,Modal,TreeNode,Card,CardHeader,ModalConsumer,WrapperModal,PortalList,PortalListStyled,FullCalendar,LineChart,CodeMirror,ThemedButton,ThemedButtonManual,ThemedButtonListenersManual,ThemedButtonAllManual,ThemedButtonConsumer,ROnProbe,PartCard,PartCardConsumer,ExposeProbe}.rozie');
const demoModules = import.meta.glob('../../../examples/demos/*.rozie');

// Phase 21 D-07 — the external-caller harness button label/testid (shared).
const RESET_BTN_TESTID = 'reset-via-handle';

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

  // Phase 21 D-07 — ExposeProbe external-caller harness. Svelte 5's `mount()`
  // returns the component instance exports — the `export function reset()` /
  // `export function focus()` the emitter generated for $expose. (The Svelte
  // `bind:this` equivalent at the rig level.) A "reset via handle" button
  // calls inst.reset().
  if (example === 'ExposeProbe') {
    const inst = mount(mod.default, {
      target: mountWrapper(),
    }) as unknown as { reset: () => void; focus: () => void };
    const btn = document.createElement('button');
    btn.textContent = 'reset via handle';
    btn.setAttribute('data-testid', RESET_BTN_TESTID);
    btn.addEventListener('click', () => inst.reset());
    mountWrapper().appendChild(btn);
    return;
  }

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
