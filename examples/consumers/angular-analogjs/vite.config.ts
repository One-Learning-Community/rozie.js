import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import Rozie from '@rozie/unplugin/vite';

// Phase 5 Plan 05-01 Wave 0 — Rozie wired BEFORE angular() per RESEARCH.md
// Pitfall 1 + D-72 amendment. unplugin v3 sets enforce:'pre' so Rozie's
// resolveId fires before Analog regardless of array position; the array
// order is the conventional signal.
//
// Path-virtual chain: Rozie's resolveId rewrites `Foo.rozie` →
// `<abs>/Foo.rozie.ts`; load returns the compiled Angular standalone
// component class with inline template; @analogjs/vite-plugin-angular
// picks it up via TS_EXT_REGEX = /\.[cm]?ts(?![a-z])/ matching .ts.
//
// Plan 05-04 wires the Angular branch into @rozie/unplugin and flips
// this demo from "expects ROZ700 missing-analogjs error" (when uninstalled)
// to "renders Counter/Dropdown/SearchInput/TodoList/Modal correctly."
//
// Vite 6+ floor: @analogjs/vite-plugin-angular@2.5.0 peerDeps require
// vite ^6 || ^7 || ^8 (RESEARCH.md OQ6).
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
