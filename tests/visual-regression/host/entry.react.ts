/*
 * Phase 7 Plan 02 — React cell entry.
 *
 * `import.meta.glob` gives Vite a static import map for all 8 reference
 * `.rozie` files; `@rozie/unplugin` (target: react) + `@vitejs/plugin-react`
 * compile each to a `.tsx` component. The runtime mount is `createRoot`.
 *
 * NOTE: deliberately NOT wrapped in `<StrictMode>` — the visual-regression
 * host renders the production-shaped output for pixel comparison; StrictMode
 * double-invoke coverage is QA-03's separate dev-mode stress harness.
 */
import { createElement, createRef, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { parseQuery, mountWrapper, DEFAULT_PROPS, toUncontrolledProps } from './main';

// Two glob roots: `examples/*.rozie` is the canonical reference set;
// `examples/demos/*.rozie` provides per-example wrappers that override the
// canonical for visual-regression purposes (e.g. demos/Dropdown.rozie fills
// the default panel slot so the screenshot captures menu items instead of
// an empty 1×18 box). When both globs match, the demos/ entry wins.
const baseModules = import.meta.glob('../../../examples/{Counter,SearchInput,Dropdown,TodoList,Modal,TreeNode,Card,CardHeader,ModalConsumer,WrapperModal,PortalList,PortalListStyled,FullCalendar,LineChart,CodeMirror,ThemedButton,ThemedButtonManual,ThemedButtonListenersManual,ThemedButtonAllManual,ThemedButtonConsumer,ROnProbe,PartCard,PartCardConsumer,ExposeProbe}.rozie');
const demoModules = import.meta.glob('../../../examples/demos/*.rozie');

// Phase 21 D-07 — the external-caller harness button label/testid is shared by
// the per-target entry shims and the expose-probe.spec assertion. React renders
// the button inside its own tree (see the ExposeProbe block below) rather than
// appending to mountWrapper(), because createRoot clears non-React container
// children on commit.
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
  const mod = (await loader()) as {
    default: Parameters<typeof createElement>[0];
  };

  // Phase 21 D-07 — ExposeProbe external-caller harness. ExposeProbe is a
  // forwardRef component; pass a ref to grab the imperative handle, then wire a
  // "reset via handle" button that calls handle.reset() so the spec can click
  // it and assert the input clears.
  //
  // The button MUST render INSIDE the React tree (a Fragment), NOT be appended
  // to mountWrapper() after `.render()`: React 18's createRoot commits
  // asynchronously and clears non-React children of its container on commit, so
  // a post-render `appendChild` button is wiped before the screenshot/spec sees
  // it. Rendering it in the Fragment makes React own it (survives commit) and
  // produces the same DOM order (component, then button) as the other 5 targets,
  // keeping the shared ExposeProbe.png baseline valid. The onClick closure reads
  // handleRef.current at click time, by which point the forwardRef handle is set.
  if (example === 'ExposeProbe') {
    const handleRef = createRef<{ reset: () => void; focus: () => void }>();
    createRoot(mountWrapper()).render(
      createElement(
        Fragment,
        null,
        createElement(mod.default, { ref: handleRef }),
        createElement(
          'button',
          {
            'data-testid': RESET_BTN_TESTID,
            onClick: () => handleRef.current?.reset(),
          },
          'reset via handle',
        ),
      ),
    );
    return;
  }

  // `createElement(component, props)` — passing DEFAULT_PROPS[example]
  // drives the component into a visible state for the screenshot. See
  // DEFAULT_PROPS in main.ts. Demo wrappers hardcode their state inline
  // (e.g. `<Dropdown :open="true">…</Dropdown>` in demos/DropdownDemo.rozie),
  // so DEFAULT_PROPS is skipped — passing them would trip React's "unknown
  // prop on a component" warning since the wrapper has no matching props.
  //
  // `toUncontrolledProps` remaps `model: true` props to React's `default<Key>`
  // seed prop so the component owns its state — without it, React's strict
  // `useControllableState` freezes the value (the host wires no listener) and
  // every interaction in the compare.html 6-up is inert. See main.ts.
  createRoot(mountWrapper()).render(
    createElement(
      mod.default,
      isDemo
        ? null
        : toUncontrolledProps(
            example,
            DEFAULT_PROPS[example] as Record<string, unknown>,
          ),
    ),
  );
}

void main();
