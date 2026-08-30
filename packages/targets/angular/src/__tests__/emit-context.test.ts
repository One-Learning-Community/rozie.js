// Quick task 260830-fje — Angular cross-component context emit.
//
// The Angular counterpart to `packages/targets/lit/src/__tests__/emit-context.test.ts`.
// Angular's context emitter (`emit/emitContext.ts`) had NO dedicated coverage while Lit's
// had nine tests — an asymmetry that quick task 260830-cfi proved is load-bearing: a
// `redirectNestedThis` change silently deleted the reactive provider bridge on BOTH
// targets, and only Lit's test failed. The identical Angular breakage would have shipped.
//
// Angular lowers context very differently from Lit — there is no `createContext` /
// `ContextProvider` / `ContextConsumer`. It goes through the DI graph:
//
//   $provide('theme', { get color() { return $data.color }, cycle })
//     → providers: [{ provide: rozieToken('theme'),
//         useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => ThemeProvider));
//           return ({ get color() { return __rozieCtxHost.color() }, cycle: __rozieCtxHost.cycle }); } }]
//   const theme = $inject('theme')          → theme = inject(rozieToken('theme'));
//   const theme = $inject('theme', fb)      → theme = inject(rozieToken('theme'), { optional: true }) ?? fb;
//
// Three load-bearing rules, each guarded below:
//   - the provided value's `this` MUST resolve to the component via the `__rozieCtxHost`
//     capture, never to the object literal — a bare `this.color()` inside `get color()`
//     calls the getter itself (`RangeError: Maximum call stack size exceeded`)
//   - `rozieToken` is IMPORTED from `@rozie/runtime-angular`, never inlined: its registry
//     is keyed on `globalThis.__rozieCtx` so separately-bundled copies share token
//     identity (260819-qo8). Re-inlining it silently breaks cross-package DI.
//   - a component using neither sigil emits ZERO context text.
//
// Note on the two guards Lit carries that do NOT apply here. Lit mints member identifiers
// FROM the key (`__rozieCtx_theme`), so it needs CR-01 (apostrophe key) and WR-01 (two keys
// that sanitize alike). Angular never turns the key into an identifier — it stays a runtime
// string argument to `rozieToken(...)`, and consumer members are named after the AUTHOR's
// variable. Angular is structurally immune rather than accidentally correct; the last test
// pins that property so a future refactor cannot start deriving identifiers from keys.

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { parse as babelParse } from '@babel/parser';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

function lower(src: string, filename: string): IRComponent {
  const parsed = parse(src, { filename });
  if (!parsed.ast) {
    throw new Error(`parse() failed: ${JSON.stringify(parsed.diagnostics)}`);
  }
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() failed: ${JSON.stringify(lowered.diagnostics)}`);
  }
  return lowered.ir;
}

function compile(src: string, filename: string): string {
  const ir = lower(src, filename);
  return emitAngular(ir, { filename, source: src, modifierRegistry: createDefaultRegistry() })
    .code;
}

// Reactive provider: the value reads $data through a live getter, so the emitted factory
// must capture the component instance rather than let `this` rebind to the object literal.
const PROVIDER_SRC = `<rozie name="ThemeProvider">
<data>
{ color: 'red' }
</data>
<script>
function cycle() {
  $data.color = $data.color === 'red' ? 'green' : 'red';
}
$provide('theme', { get color() { return $data.color; }, cycle });
</script>
<template>
<div><slot></slot></div>
</template>
</rozie>`;

// Self-contained value — references nothing on the component.
const CONSTANT_PROVIDER_SRC = `<rozie name="ConstProvider">
<script>
$provide('config', { mode: 'dark' });
</script>
<template>
<div><slot></slot></div>
</template>
</rozie>`;

const CONSUMER_SRC = `<rozie name="ThemeButton">
<script>
const theme = $inject('theme');
</script>
<template>
<button @click="theme.cycle()">{{ theme.color }}</button>
</template>
</rozie>`;

const CONSUMER_FALLBACK_SRC = `<rozie name="ThemeButtonFallback">
<script>
const theme = $inject('theme', { color: 'gray', cycle() {} });
</script>
<template>
<button @click="theme.cycle()">{{ theme.color }}</button>
</template>
</rozie>`;

const NO_CONTEXT_SRC = `<rozie name="Plain">
<data>
{ count: 0 }
</data>
<template>
<div>{{ count }}</div>
</template>
</rozie>`;

describe('Angular emit — cross-component context ($provide / $inject)', () => {
  it('provider: $provide → providers[] with rozieToken + useFactory, $provide call stripped', () => {
    const code = compile(PROVIDER_SRC, 'ThemeProvider.rozie');
    expect(code).toContain("provide: rozieToken('theme')");
    expect(code).toContain('useFactory:');
    // The sigil is compiled away, never carried into the emitted body.
    expect(code).not.toContain('$provide(');
  });

  it('provider host-capture: the value reads __rozieCtxHost, never a rebound `this` (260830-cfi guard)', () => {
    const code = compile(PROVIDER_SRC, 'ThemeProvider.rozie');
    // `inject()` is legal inside useFactory; forwardRef defers the not-yet-declared class.
    expect(code).toContain('const __rozieCtxHost = inject(forwardRef(() => ThemeProvider));');
    expect(code).toMatch(/forwardRef[^\n]*from '@angular\/core'|from '@angular\/core'/);
    expect(code).toContain('__rozieCtxHost.color()');
    expect(code).toContain('cycle: __rozieCtxHost.cycle');
    // The bug this guards: inside `get color()`, a bare `this` is the OBJECT LITERAL, so
    // `this.color()` re-enters the getter — RangeError at runtime, and the projected
    // consumer resolves an exploding value. It must never reappear.
    expect(code).not.toMatch(/get color\(\)\s*\{\s*return this\.color\(\)/);
  });

  it('constant provider: bare arrow factory, no host capture and no forwardRef', () => {
    const code = compile(CONSTANT_PROVIDER_SRC, 'ConstProvider.rozie');
    expect(code).toContain("provide: rozieToken('config')");
    expect(code).toContain('useFactory: () => ({');
    // No component reference → no capture block, and forwardRef must not be pulled in.
    expect(code).not.toContain('__rozieCtxHost');
    expect(code).not.toContain('forwardRef');
  });

  it('consumer: const x = $inject(key) → inject(rozieToken(key))', () => {
    const code = compile(CONSUMER_SRC, 'ThemeButton.rozie');
    expect(code).toContain("theme = inject(rozieToken('theme'));");
    expect(code).not.toContain('$inject(');
  });

  it('consumer with fallback: $inject(key, fb) → inject(…, { optional: true }) ?? fb', () => {
    const code = compile(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie');
    expect(code).toContain("inject(rozieToken('theme'), { optional: true }) ??");
    expect(code).toContain("color: 'gray'");
  });

  it('rozieToken is imported from @rozie/runtime-angular, never inlined (260819-qo8 guard)', () => {
    for (const [src, file] of [
      [PROVIDER_SRC, 'ThemeProvider.rozie'],
      [CONSUMER_SRC, 'ThemeButton.rozie'],
    ] as const) {
      const code = compile(src, file);
      expect(code).toMatch(/import \{[^}]*\brozieToken\b[^}]*\} from '@rozie\/runtime-angular';/);
      // Inlining it would give each bundled copy its own registry and silently break
      // cross-package DI — `inject(...)` resolving undefined through the passthrough.
      expect(code).not.toContain('new InjectionToken');
      expect(code).not.toMatch(/function rozieToken\s*\(/);
    }
  });

  it('a component with no $provide/$inject emits zero context text', () => {
    const code = compile(NO_CONTEXT_SRC, 'Plain.rozie');
    expect(code).not.toContain('rozieToken');
    expect(code).not.toContain('__rozieCtxHost');
    expect(code).not.toContain('useFactory');
    expect(code).not.toContain('providers:');
  });

  it('context emit is deterministic — two fresh emits are byte-identical', () => {
    expect(compile(PROVIDER_SRC, 'ThemeProvider.rozie')).toBe(
      compile(PROVIDER_SRC, 'ThemeProvider.rozie'),
    );
    expect(compile(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie')).toBe(
      compile(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie'),
    );
  });

  it('the key is a runtime string, never an identifier — so odd/aliasing keys are safe', () => {
    // Lit needs CR-01/WR-01 because it mints `__rozieCtx_<key>` members. Angular passes the
    // key straight to rozieToken(), so neither hazard exists. Pinned so a future refactor
    // cannot quietly start deriving identifiers from keys.
    const apostrophe = compile(
      `<rozie name="AposProv">
<script>
$provide("it's", { a: 1 });
</script>
<template><div><slot></slot></div></template>
</rozie>`,
      'AposProv.rozie',
    );
    expect(apostrophe).toContain('rozieToken("it\'s")');
    expect(() =>
      babelParse(apostrophe, { sourceType: 'module', plugins: ['typescript', 'decorators-legacy'] }),
    ).not.toThrow();

    // Two keys that would sanitize to the same identifier keep distinct members, because
    // the members are named after the AUTHOR's bindings.
    const alike = compile(
      `<rozie name="AlikeCons">
<script>
const a = $inject('my-key');
const b = $inject('my.key');
</script>
<template><div>{{ a }}{{ b }}</div></template>
</rozie>`,
      'AlikeCons.rozie',
    );
    expect(alike).toContain("a = inject(rozieToken('my-key'));");
    expect(alike).toContain("b = inject(rozieToken('my.key'));");
  });
});
