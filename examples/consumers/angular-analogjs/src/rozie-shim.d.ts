// TypeScript shim for `.rozie` imports — informs tsc / Angular's strict
// templates that a `.rozie` import resolves to an Angular standalone
// component class.
//
// ANGULAR TYPED-IMPORT POSTURE (post-Phase-22 regression fix, 2026-06-02):
// Angular does NOT use `.d.rozie.ts` sidecars. The typed import surface is the
// disk-cache `<Name>.rozie.ts` that @rozie/unplugin's configResolved prebuild
// writes next to each `.rozie` source — a real, fully-typed standalone
// component class that both tsc AND ngtsc resolve via standard
// extension-appending (`./Counter.rozie` → `Counter.rozie.ts`).
//
// Why no sidecar: TS module resolution prefers an arbitrary-extension
// declaration file (`Counter.d.rozie.ts`) over the appended-extension
// implementation (`Counter.rozie.ts`) — regardless of
// `allowArbitraryExtensions`. ngtsc (inside @analogjs/vite-plugin-angular) uses
// that same resolution to validate standalone `imports: [...]` entries; a
// type-only `declare class` has no ɵcmp metadata, so ngtsc silently skips AOT
// for every class importing a `.rozie` module → runtime "JIT compiler
// unavailable" (the 2026-06-02 Angular + VR matrix regression). See
// packages/unplugin/src/emitSidecar.ts ANGULAR EXCEPTION.
//
// This wildcard is the FRESH-CHECKOUT FALLBACK only: before the demo's first
// build (no disk-cache on disk yet; sidecars are never written for Angular),
// `tsc --noEmit` still needs `.rozie` imports to resolve. Once the disk-cache
// exists, file resolution wins over the ambient wildcard and imports get the
// real class types.
//
// Known limitation (accepted): unlike the other 5 targets, Angular consumers
// have no named `<Name>Props` type export to import. A future ngtsc-valid
// sidecar (declaring `static ɵcmp: ɵɵComponentDeclaration<...>` the way
// compiled Angular libraries do) can restore it.
declare module '*.rozie' {
  import type { Type } from '@angular/core';
  const component: Type<unknown>;
  export default component;
}
