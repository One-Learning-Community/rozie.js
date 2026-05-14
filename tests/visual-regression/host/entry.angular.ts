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
import { parseQuery, mountWrapper } from './main';

const modules = import.meta.glob('../../../examples/*.rozie');

async function main(): Promise<void> {
  const { example } = parseQuery();
  const key = `../../../examples/${example}.rozie`;
  const loader = modules[key];
  if (!loader) throw new Error(`visual-regression host: no module for ${key}`);
  const mod = (await loader()) as { default: Type<unknown> };

  const appRef = await createApplication();
  const wrapper = mountWrapper();
  const componentRef = createComponent(mod.default, {
    environmentInjector: appRef.injector,
    hostElement: wrapper,
  });
  appRef.attachView(componentRef.hostView);
  componentRef.changeDetectorRef.detectChanges();
}

void main();
