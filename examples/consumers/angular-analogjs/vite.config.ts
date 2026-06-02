import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import Rozie from '@rozie/unplugin/vite';

// Phase 5 Plan 05-04b — Rozie wired BEFORE angular() per RESEARCH.md
// Pitfall 1 + D-72 amendment. unplugin v3 sets enforce:'pre' so Rozie's
// resolveId fires before Analog regardless of array position; the array
// order is the conventional signal.
//
// Path-virtual chain: Rozie's resolveId rewrites `Foo.rozie` →
// `<abs>/Foo.rozie.ts`; load returns the compiled Angular standalone
// component class with inline template; @analogjs/vite-plugin-angular
// picks it up via TS_EXT_REGEX = /\.[cm]?ts(?![a-z])/ matching .ts.
//
// Vite 6+ floor: @analogjs/vite-plugin-angular@2.5.0 peerDeps require
// vite ^6 || ^7 || ^8 (RESEARCH.md OQ6 RESOLVED).
//
// HISTORICAL NOTE (stale "known limitation" removed 2026-06-02): an old
// Plan 05-04b comment here described AppComponent.ts failing AOT with
// "JIT compiler unavailable" as a deferred limitation. That limitation was
// FIXED long ago (the May 2026 dual-TS-version pin, see angular-matrix.yml) —
// the full app AOT-compiles and all 17 e2e tests pass. The stale comment
// misled the Phase 22 executor into dismissing a REAL regression (type-only
// .d.rozie.ts sidecars shadowing the disk-cache in ngtsc resolution — see
// packages/unplugin/src/emitSidecar.ts ANGULAR EXCEPTION). If this demo ever
// throws "JIT compiler unavailable" again, it is a real, new regression:
// check for stray *.d.rozie.ts files next to the .rozie sources first.
export default defineConfig({
  plugins: [
    Rozie({ target: 'angular' }),
    angular(),
  ],
  build: {
    sourcemap: true, // DX-01
  },
  server: {
    port: 5175, // distinct from svelte-vite (5174)
  },
});
