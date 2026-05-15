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
import { parseQuery, mountWrapper, LIT_TAGS, DEFAULT_PROPS } from './main';

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
  }
  mountWrapper().appendChild(el);
}

void main();
