/*
 * Phase 7 Plan 02 — Vue cell entry (D-10 reference target).
 *
 * Vue is the visual REFERENCE target: the baseline PNGs in `__screenshots__/`
 * are generated from these renders, and every other target diffs against them.
 *
 * `import.meta.glob` gives Vite a static import map for the matrix-relevant
 * `.rozie` files; `@rozie/unplugin` (target: vue) + `@vitejs/plugin-vue` compile
 * each to a Vue SFC. The runtime mount is plain `createApp`.
 */
import { createApp, h, ref } from 'vue';
import {
  parseQuery,
  mountWrapper,
  DEFAULT_PROPS,
  appendExternalCallerButton,
} from './main';

// Two glob roots: an EXPLICIT brace-list of matrix-relevant canonical examples
// (mirrors the EXAMPLES set in main.ts, plus WrapperModal which ModalConsumer
// composes via its <components> block), and the rig-specific
// `examples/demos/*.rozie` set. The brace list is deliberate — a permissive
// `examples/*.rozie` would also pull in every engine-wrapper port
// (Flatpickr/LeafletMap/TipTap/Uppy/SortableList) and
// break the Vue sub-build whenever any of their emitted Vue SFCs has a TS-
// parser-rejected shape. Those wrappers participate in the cross-target
// compile gate (engine-examples.compile.test.ts) but NOT in the
// visual-regression matrix. When BOTH globs match (demos/ vs base), the
// demos/ entry wins per the loader below.
const baseModules = import.meta.glob('../../../examples/{Counter,SearchInput,Dropdown,TodoList,Modal,TreeNode,Card,CardHeader,ModalConsumer,WrapperModal,PortalList,PortalListStyled,ThemedButton,ThemedButtonManual,ThemedButtonListenersManual,ThemedButtonAllManual,ThemedButtonConsumer,ROnProbe,PartCard,PartCardConsumer,ExposeProbe,RHtml,AttrNullishDrop}.rozie');
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
  const mod = (await loader()) as { default: unknown };

  // Phase 21 D-07 — ExposeProbe external-caller harness. Render the component
  // through a render function so a template `ref` captures the instance, whose
  // `defineExpose({ reset, focus })` surface is exposed on `probeRef.value`.
  // A "reset via handle" button calls probeRef.value.reset().
  if (example === 'ExposeProbe') {
    const probeRef = ref<{ reset: () => void; focus: () => void } | null>(null);
    const app = createApp({
      render: () =>
        h(mod.default as Parameters<typeof h>[0], { ref: probeRef }),
    });
    app.config.compilerOptions.isCustomElement = (tag: string) =>
      tag.startsWith('rozie-');
    app.mount(mountWrapper());
    appendExternalCallerButton(() => probeRef.value?.reset());
    return;
  }

  // `createApp(rootComponent, rootProps)` — passing DEFAULT_PROPS[example]
  // drives each component into a visible state for the screenshot. Without
  // these, Modal/Dropdown stay closed (1×1 baseline), TreeNode/Card/
  // CardHeader render empty, etc. — see DEFAULT_PROPS in main.ts for the
  // chosen state per example. Demo wrappers hardcode their state inline
  // (e.g. `<Dropdown :open="true">…</Dropdown>` in demos/Dropdown.rozie),
  // so DEFAULT_PROPS is skipped when a demo override is in play.
  const app = createApp(
    mod.default as Parameters<typeof createApp>[0],
    isDemo ? {} : (DEFAULT_PROPS[example] as Record<string, unknown>),
  );
  app.config.compilerOptions.isCustomElement = (tag: string) =>
    tag.startsWith('rozie-');
  app.mount(mountWrapper());
}

void main();
