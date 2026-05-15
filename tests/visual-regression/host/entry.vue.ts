/*
 * Phase 7 Plan 02 — Vue cell entry (D-10 reference target).
 *
 * Vue is the visual REFERENCE target: the baseline PNGs in `__screenshots__/`
 * are generated from these renders, and every other target diffs against them.
 *
 * `import.meta.glob` gives Vite a static import map for all 8 reference
 * `.rozie` files; `@rozie/unplugin` (target: vue) + `@vitejs/plugin-vue` compile
 * each to a Vue SFC. The runtime mount is plain `createApp`.
 */
import { createApp } from 'vue';
import { parseQuery, mountWrapper, DEFAULT_PROPS } from './main';

// Two glob roots: `examples/*.rozie` is the canonical reference set; the
// rig-specific `examples/demos/*.rozie` provides per-example wrappers that
// override the canonical for visual-regression purposes only (e.g. Dropdown
// needs default-slot content to render a non-empty panel — see
// examples/demos/Dropdown.rozie). When BOTH globs match, the demos/ entry
// wins. Globs are non-recursive by default so the two sets don't overlap.
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
  const mod = (await loader()) as { default: unknown };
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
