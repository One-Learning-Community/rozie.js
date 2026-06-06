/*
 * Phase 7 Plan 02 — Solid cell entry.
 *
 * `import.meta.glob` gives Vite a static import map for all 8 reference
 * `.rozie` files; `@rozie/unplugin` (target: solid) + `vite-plugin-solid`
 * compile each to a Solid component. The runtime mount is Solid's `render`.
 */
import { createComponent, type Component } from 'solid-js';
import { render } from 'solid-js/web';
import {
  parseQuery,
  mountWrapper,
  DEFAULT_PROPS,
  toUncontrolledProps,
  appendExternalCallerButton,
} from './main';

// Two glob roots — see entry.vue.ts for rationale; demos/ wins over root.
const baseModules = import.meta.glob('../../../examples/{Counter,SearchInput,Dropdown,TodoList,Modal,TreeNode,Card,CardHeader,ModalConsumer,WrapperModal,PortalList,PortalListStyled,ThemedButton,ThemedButtonManual,ThemedButtonListenersManual,ThemedButtonAllManual,ThemedButtonConsumer,ROnProbe,PartCard,PartCardConsumer,ExposeProbe,RHtml}.rozie');
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
  const mod = (await loader()) as { default: (props: unknown) => unknown };

  // Phase 21 D-07 — ExposeProbe external-caller harness. Solid's $expose emit is
  // a callback `ref` prop invoked once after mount with the handle. Pass a
  // capturing `ref` callback to grab it, then wire a "reset via handle" button
  // that calls handle.reset().
  if (example === 'ExposeProbe') {
    let handle: { reset: () => void; focus: () => void } | undefined;
    const exposeProps: Record<string, unknown> = {
      ref: (h: { reset: () => void; focus: () => void }) => {
        handle = h;
      },
    };
    render(
      () =>
        createComponent(
          mod.default as unknown as Component<Record<string, unknown>>,
          exposeProps,
        ) as Node,
      mountWrapper(),
    );
    appendExternalCallerButton(() => handle?.reset());
    return;
  }

  // Solid's `render(fn, target)` evaluates `fn` inside a reactive root and
  // mounts the returned JSX. `createComponent(C, props)` is Solid's runtime
  // helper for instantiating a component with props (the JSX equivalent
  // is `<C {...props} />`); using it directly avoids needing a JSX file.
  // Demo wrappers hardcode state inline; props skipped to keep the
  // wrapper's prop-less signature happy.
  //
  // `toUncontrolledProps` remaps `model: true` props to the `default<Key>`
  // seed prop so the component owns its state — without it, Solid's strict
  // `createControllableSignal` freezes the value (the host wires no listener)
  // and every interaction in the compare.html 6-up is inert. See main.ts.
  render(
    () =>
      createComponent(
        mod.default as (p: Record<string, unknown>) => unknown,
        isDemo
          ? {}
          : toUncontrolledProps(
              example,
              DEFAULT_PROPS[example] as Record<string, unknown>,
            ),
      ) as Node,
    mountWrapper(),
  );
}

void main();
