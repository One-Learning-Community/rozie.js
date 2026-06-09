// Phase 36 Plan 04 (R9 / R11 / R12) — Angular cross-component context emit.
//
// Asserts the `$provide(key, value)` / `const x = $inject(key, fallback?)`
// sigils lower to Angular hierarchical DI:
//
//   $provide('theme', { ... })
//     → @Component({ providers: [{ provide: rozieToken('theme'),
//          useFactory: () => ({ ... }) }] })   (NEVER viewProviders)
//   const theme = $inject('theme')
//     → theme = inject(rozieToken('theme'));   (class field)
//
// Plus three hard rules:
//   - `providers`, NOT `viewProviders` (REQ-31 — projected ng-content blind)
//   - a CVA model prop + $provide emit ONE merged `providers:` array (Pitfall 2)
//   - the inline `rozieToken` helper is globalThis-backed (`globalThis.__rozieCtx`)
//     so two separately-compiled modules resolve the identical InjectionToken (R11)
//   - R12 / D-5 empty-case byte-identity: no $provide/$inject → zero context text.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitAngular } from '../src/emitAngular.js';

function lower(src: string, filename: string): IRComponent {
  const parsed = parse(src, { filename });
  if (!parsed.ast) {
    throw new Error(`parse() failed: ${JSON.stringify(parsed.diagnostics)}`);
  }
  const lowered = lowerToIR(parsed.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() failed: ${JSON.stringify(lowered.diagnostics)}`);
  }
  return lowered.ir;
}

function compile(src: string, filename: string): { code: string; diagnostics: unknown[] } {
  const ir = lower(src, filename);
  const { code, diagnostics } = emitAngular(ir, { filename, source: src });
  return { code, diagnostics };
}

const PROVIDER_SRC = `<rozie name="ThemeProvider">
<script>
const NEXT = { red: 'green', green: 'blue', blue: 'red' };
$provide('theme', { get color() { return color() }, cycle: () => color.set(NEXT[color()]) });
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
<button @click="$data.count++">{{ $data.count }}</button>
</template>
</rozie>`;

// CVA + $provide: a single `model: true` prop (auto-CVA) AND a `$provide`.
// Proves the MERGE — exactly ONE `providers:` key carrying BOTH entries.
const CVA_PLUS_PROVIDE_SRC = `<rozie name="CvaProvider">
<props>
{ value: { type: String, default: '', model: true } }
</props>
<script>
$provide('theme', { color: 'red' });
</script>
<template>
<input :value="$props.value" />
</template>
</rozie>`;

describe('Angular emit — cross-component context ($provide / $inject)', () => {
  it('provider: $provide → providers:[{ provide: rozieToken("theme"), useFactory }] (NOT viewProviders)', () => {
    const { code, diagnostics } = compile(PROVIDER_SRC, 'ThemeProvider.rozie');
    expect(diagnostics).toHaveLength(0);
    expect(code).toContain('providers: [');
    expect(code).toContain("provide: rozieToken('theme'),");
    // Phase 36 fix — a provided value that reads the component instance (the
    // rewrite turns the state read into `this.color()`) is emitted with a
    // host-capturing `useFactory` that injects the component via forwardRef and
    // rewrites the value's `this` to the captured `__rozieCtxHost`. The bare
    // `useFactory: () => (<value>)` form (which left `this` rebinding inside the
    // getter -> infinite recursion / no `this` in the static factory) is gone
    // for `this`-referencing values; `forwardRef` is imported.
    expect(code).toContain('useFactory: () => {');
    expect(code).toContain('const __rozieCtxHost = inject(forwardRef(() => ThemeProvider));');
    expect(code).toMatch(/import \{[^}]*\bforwardRef\b[^}]*\} from '@angular\/core';/);
    // The value's `this` is rewritten to the captured `__rozieCtxHost`, so a
    // nested getter never reads the object literal (which would recurse on the
    // same-named getter -> Maximum call stack). The provided object still
    // carries the `get color()` accessor (the D-3 live-ref pattern).
    expect(code).toContain('get color()');
    expect(code).not.toContain('return this.color()');
    // REQ-31 — NEVER viewProviders for the context token.
    expect(code).not.toContain('viewProviders');
    // The author-side directive must not leak as an undefined runtime ref.
    expect(code).not.toContain('$provide');
  });

  it('provider: inline rozieToken helper is globalThis-backed (R11)', () => {
    const { code } = compile(PROVIDER_SRC, 'ThemeProvider.rozie');
    expect(code).toContain('function rozieToken(key: string): InjectionToken<unknown>');
    expect(code).toContain('globalThis as Record<string, unknown>).__rozieCtx ??= new Map()');
    expect(code).toContain("new InjectionToken<unknown>('rozie:' + key)");
    // InjectionToken imported from @angular/core.
    expect(code).toMatch(/import \{[^}]*\bInjectionToken\b[^}]*\} from '@angular\/core';/);
  });

  it('consumer: const theme = $inject("theme") → theme = inject(rozieToken("theme")) class field', () => {
    const { code, diagnostics } = compile(CONSUMER_SRC, 'ThemeButton.rozie');
    expect(diagnostics).toHaveLength(0);
    expect(code).toContain("theme = inject(rozieToken('theme'));");
    expect(code).toMatch(/import \{[^}]*\binject\b[^}]*\} from '@angular\/core';/);
    expect(code).not.toContain('$inject');
    // Consumer needs the token helper too (cross-file identity, R11).
    expect(code).toContain('function rozieToken(');
  });

  it('consumer with fallback: $inject("theme", fb) → inject(rozieToken("theme"), { optional: true }) ?? fb', () => {
    const { code } = compile(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie');
    expect(code).toContain("inject(rozieToken('theme'), { optional: true }) ??");
    expect(code).toContain("color: 'gray'");
  });

  it('Pitfall 2 — CVA model prop + $provide emit exactly ONE merged providers: key', () => {
    const { code, diagnostics } = compile(CVA_PLUS_PROVIDE_SRC, 'CvaProvider.rozie');
    // No ERROR-severity diagnostics (the benign ROZ126 "no boolean disabled
    // prop" info is expected for a single-model CVA and is not from $provide).
    expect(
      (diagnostics as { severity?: string }[]).filter((d) => d.severity === 'error'),
    ).toHaveLength(0);
    // Both entries present in the SAME array.
    expect(code).toContain('provide: NG_VALUE_ACCESSOR,');
    expect(code).toContain("provide: rozieToken('theme'),");
    // Exactly ONE `providers:` key (strip comments first, then count).
    const providerKeys = code
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .filter((l) => /\bproviders:/.test(l));
    expect(providerKeys).toHaveLength(1);
    expect(code).not.toContain('viewProviders');
  });

  it('R12 / D-5 — a component with no $provide/$inject emits ZERO context text', () => {
    const ir = lower(NO_CONTEXT_SRC, 'Plain.rozie');
    expect(ir.provides).toHaveLength(0);
    expect(ir.injects).toHaveLength(0);
    const { code } = compile(NO_CONTEXT_SRC, 'Plain.rozie');
    expect(code).not.toContain('rozieToken');
    expect(code).not.toContain('InjectionToken');
    expect(code).not.toContain('providers:');
  });

  it('R12 / D-5 — no-context emit is byte-identical across two fresh emits (no nondeterminism)', () => {
    const a = compile(NO_CONTEXT_SRC, 'Plain.rozie').code;
    const b = compile(NO_CONTEXT_SRC, 'Plain.rozie').code;
    expect(a).toBe(b);
  });
});
