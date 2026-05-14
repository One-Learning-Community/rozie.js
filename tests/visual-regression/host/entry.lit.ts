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
import { parseQuery, mountWrapper, LIT_TAGS } from './main';

const modules = import.meta.glob('../../../examples/*.rozie');

async function main(): Promise<void> {
  const { example } = parseQuery();
  const key = `../../../examples/${example}.rozie`;
  const loader = modules[key];
  if (!loader) throw new Error(`visual-regression host: no module for ${key}`);
  // Importing the module is what registers the custom element as a side effect.
  await loader();
  const tag = LIT_TAGS[example];
  await customElements.whenDefined(tag);
  const el = document.createElement(tag);
  mountWrapper().appendChild(el);
}

void main();
