// TypeScript shim for `.rozie` imports — informs tsc / Angular's strict
// templates that a `.rozie` import resolves to an Angular standalone
// component class. Mirrors examples/consumers/angular-analogjs/src/rozie-shim.d.ts.
declare module '*.rozie' {
  import type { Type } from '@angular/core';
  const component: Type<unknown>;
  export default component;
}
