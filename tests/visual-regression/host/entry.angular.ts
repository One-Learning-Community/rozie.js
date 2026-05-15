/*
 * Phase 7 Plan 02 — Angular cell entry.
 *
 * `import.meta.glob` gives Vite a static import map for all 8 reference
 * `.rozie` files; `@rozie/unplugin` (target: angular) + `@analogjs/vite-plugin-angular`
 * AOT-compile each to a standalone component class.
 *
 * Because the cell is selected at runtime by URL query, the standalone
 * component is mounted dynamically: `createApplication()` boots a bare Angular
 * platform, then `createComponent()` instantiates the imported standalone class
 * into the chrome-reset wrapper. This avoids needing a build-time `imports: [...]`
 * array (the component to mount is not known until the query is parsed).
 */
import 'zone.js';
import { createApplication } from '@angular/platform-browser';
import { createComponent, type Type } from '@angular/core';
import { parseQuery, mountWrapper, DEFAULT_PROPS } from './main';

// Two glob roots — see entry.vue.ts for rationale; demos/ wins over root.
const baseModules = import.meta.glob('../../../examples/*.rozie');
const demoModules = import.meta.glob('../../../examples/demos/*.rozie');

/**
 * Read the component's own selector tag off its compiled `ɵcmp` definition.
 *
 * D-VR-02: `createComponent({ hostElement })` does NOT project a standalone
 * component's template into an arbitrary host element whose tag does not match
 * the component's `selector`. Mounting into the bare `<div data-testid>` left
 * the cell empty (silent no-render). The fix is to create a child element
 * whose tag IS the component's selector (`<rozie-counter>` etc.) and mount the
 * component into THAT — then run a full `ApplicationRef.tick()` so change
 * detection paints the initial render.
 */
function selectorTag(componentType: Type<unknown>): string {
  const cmp = (componentType as unknown as { ɵcmp?: { selectors?: unknown[][] } })
    .ɵcmp;
  const first = cmp?.selectors?.[0]?.[0];
  return typeof first === 'string' && first.length > 0 ? first : 'div';
}

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
  const mod = (await loader()) as { default: Type<unknown> };

  const appRef = await createApplication();
  const wrapper = mountWrapper();

  // D-VR-02: mount into a selector-matching host element, not the bare wrapper.
  const hostEl = document.createElement(selectorTag(mod.default));
  wrapper.appendChild(hostEl);

  const componentRef = createComponent(mod.default, {
    environmentInjector: appRef.injector,
    hostElement: hostEl,
  });
  // Apply DEFAULT_PROPS via Angular's setInput API (Angular 14.1+ standalone).
  // Skip for demo wrappers — they hardcode their state inline (e.g.
  // `<Dropdown :open="true">…</Dropdown>` in demos/Dropdown.rozie). Inputs
  // not declared on the component are silently ignored to keep the rig
  // tolerant of minor signature drift.
  if (!isDemo) {
    const props = DEFAULT_PROPS[example] as Record<string, unknown>;
    for (const [name, value] of Object.entries(props)) {
      try {
        componentRef.setInput(name, value);
      } catch {
        // Input not declared on this component — skip silently.
      }
    }
  }
  appRef.attachView(componentRef.hostView);
  // Full application tick — `detectChanges()` alone did not paint the initial
  // standalone-component render in the bare `createApplication()` platform.
  appRef.tick();
}

void main();
