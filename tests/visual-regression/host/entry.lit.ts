/*
 * Phase 7 Plan 02 — Lit cell entry (framework-less).
 *
 * Lit components are plain ES modules that self-register a `<rozie-*>` custom
 * element via `customElements.define()` at module load — no host framework.
 * `@rozie/unplugin` (target: lit) compiles each `.rozie` to such a module;
 * `import.meta.glob` gives Vite the static import map.
 *
 * Mounting is just: import the module (triggers registration), create the
 * matching `<rozie-*>` element, append it to the chrome-reset wrapper. Modeled
 * on examples/consumers/lit-vanilla-demo's per-page HTML host.
 */
import {
  parseQuery,
  mountWrapper,
  LIT_TAGS,
  DEFAULT_PROPS,
  MODEL_PROPS,
  appendExternalCallerButton,
} from './main';

// Two glob roots — see entry.vue.ts for rationale; demos/ wins over root.
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
  // Importing the module is what registers the custom element as a side effect.
  // Demo wrappers also import their canonical sibling, so loading
  // demos/Dropdown.rozie registers BOTH <rozie-dropdown-demo> (the wrapper)
  // AND <rozie-dropdown> (the canonical, used inside the wrapper's template).
  await loader();
  // Demo wrappers MUST use `<rozie name="<Example>Demo">` so the tag is
  // predictable: canonical 'rozie-dropdown' + '-demo' = 'rozie-dropdown-demo'.
  const tag = isDemo ? `${LIT_TAGS[example]}-demo` : LIT_TAGS[example];
  await customElements.whenDefined(tag);
  const el = document.createElement(tag);
  // Lit reads props as DOM properties (Object.assign) for complex values;
  // primitives also work via attribute, but property assignment covers both.
  // Demo wrappers typically have no props themselves (state is hardcoded
  // inside the wrapper's template); DEFAULT_PROPS only matters when no demo
  // override is in play.
  if (!isDemo) {
    Object.assign(el, DEFAULT_PROPS[example] as Record<string, unknown>);
    // Model-prop writeback — makes the compare.html 6-up interactive.
    //
    // The emitted Lit model-prop setter routes through
    // `createLitControllableProperty.notifyPropertyWrite`, which flips the
    // component into CONTROLLED mode: the `Object.assign` seed above (a public
    // `.value=`/`.open=`/`.items=` property write) hands value ownership to the
    // parent. A controlled Lit component's own internal `write()` (e.g. Counter's
    // `increment`) then only DISPATCHES a `<prop>-change` event and never mutates
    // `read()` — so without a listener the component is frozen (Counter's `+` does
    // nothing). This mirrors React (`useControllableState`) / Solid, which the
    // React/Solid hosts fix by mounting uncontrolled via `toUncontrolledProps`.
    //
    // That remap does NOT work for Lit: the Lit emitter bakes `defaultValue` into
    // the controllable options and emits no `default<Key>` public prop, so a
    // `value`→`defaultValue` rewrite would drop the meaningful seeds (Dropdown
    // `open:true`, TodoList `items[]`, Modal `open:true`) and change the
    // screenshots. Instead the host acts as the controlling PARENT: echo every
    // `<prop>-change` back onto the property. The value round-trips through the
    // public setter (`notifyPropertyWrite`), updating the controlled latch so
    // `read()` reflects each interaction. The helper's one-shot round-trip
    // suppression token means this re-assignment never re-dispatches (no loop),
    // and first paint is unchanged (the seed value is identical), so
    // `matrix.spec.ts` screenshots are unaffected.
    for (const prop of MODEL_PROPS[example] ?? []) {
      el.addEventListener(`${prop}-change`, (e: Event) => {
        (el as unknown as Record<string, unknown>)[prop] = (
          e as CustomEvent
        ).detail;
      });
    }
  }
  mountWrapper().appendChild(el);

  // Phase 21 D-07 — ExposeProbe external-caller harness. The Lit element itself
  // IS the handle: the exposed reset()/focus() are public element methods (the
  // `document.querySelector('rozie-expose-probe')` query equivalent — here we
  // already hold `el`). A "reset via handle" button calls el.reset().
  if (example === 'ExposeProbe') {
    const handle = el as unknown as { reset: () => void; focus: () => void };
    appendExternalCallerButton(() => handle.reset());
  }

  // Lit components render into shadow DOM, so the host-level reset.css
  // cannot reach `.dropdown-panel` / `.modal-backdrop` inside them. After
  // the entire tree (including nested rozie-* children) reaches first-render
  // complete, inject the same position-static override into every shadow
  // root so position:fixed content contributes to the host's bounding box
  // for the Playwright screenshot clip.
  await waitForRenderComplete(el);
  applyShadowReset(el);
}

const SHADOW_RESET_CSS = `
  .dropdown-panel, .modal-backdrop { position: static !important; }
  .modal-backdrop { inset: auto !important; width: max-content; height: max-content; }
`;

interface MaybeLitElement extends Element {
  updateComplete?: Promise<unknown>;
}

async function waitForRenderComplete(root: Element): Promise<void> {
  const lit = root as MaybeLitElement;
  if (lit.updateComplete) await lit.updateComplete;
  if (!root.shadowRoot) return;
  for (const child of Array.from(root.shadowRoot.querySelectorAll('*'))) {
    await waitForRenderComplete(child);
  }
}

function applyShadowReset(root: Element): void {
  const shadow = root.shadowRoot;
  if (shadow) {
    const style = document.createElement('style');
    style.textContent = SHADOW_RESET_CSS;
    shadow.prepend(style);
    for (const child of Array.from(shadow.querySelectorAll('*'))) {
      applyShadowReset(child);
    }
  }
}

void main();
