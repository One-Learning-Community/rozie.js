// `@angular/common`'s `BrowserTestingModule` pulls in `PlatformLocation`,
// which ships from `@angular/common` as a PARTIAL-Ivy declaration
// (`ɵɵngDeclareFactory`) — a library artifact meant to be processed by the
// Angular Linker during a real app build. This harness's Vite pipeline
// (vitest.config.ts) only runs ngtsc AOT over THIS package's own `.ts`
// files, not third-party `node_modules` partial-Ivy libraries, so
// `PlatformLocation` still needs a JIT fallback to resolve at TestBed-init
// time — exactly per the framework's own error message ("manually provide
// the compiler with `import '@angular/compiler'` before bootstrapping").
// This does NOT reintroduce JIT for the FIXTURE components this phase
// exists to prove AOT for: `ɵɵngDeclareFactory` JIT-compiles only classes
// that lack a full-Ivy `ɵcmp`/`ɵfac`, and every fixture compiled by this
// package's own ngtsc Program already has one.
import '@angular/compiler';

// AnalogJS's documented Vitest+Angular wiring (analogjs.org "Testing with
// Vitest"). This is the FIRST use of this entry point in the repo (D-07b) —
// it loads zone.js (+ zone.js/testing, zone.js/plugins/sync-test,
// zone.js/plugins/proxy in the correct order) and monkey-patches Vitest's
// global describe/it/beforeEach/afterEach so every test body runs inside a
// Zone-aware ProxyZone, which is what lets TestBed's change-detection
// scheduling behave the same way it does for a real bootstrapped app.
//
// Because the patch reassigns properties on `globalThis` rather than the
// `vitest` module's exported bindings, test files in this package rely on
// the AMBIENT globals (`describe`, `it`, `expect`, ...) — see
// `test.globals: true` in vitest.config.ts and `"types":
// ["vitest/globals", "node"]` in tsconfig.spec.json — and must NOT
// `import { describe, it } from 'vitest'` explicitly, which would bypass
// this patch entirely.
import '@analogjs/vite-plugin-angular/setup-vitest';
