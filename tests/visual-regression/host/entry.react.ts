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
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { parseQuery, mountWrapper } from './main';

const modules = import.meta.glob('../../../examples/*.rozie');

async function main(): Promise<void> {
  const { example } = parseQuery();
  const key = `../../../examples/${example}.rozie`;
  const loader = modules[key];
  if (!loader) throw new Error(`visual-regression host: no module for ${key}`);
  const mod = (await loader()) as {
    default: Parameters<typeof createElement>[0];
  };
  createRoot(mountWrapper()).render(createElement(mod.default));
}

void main();
