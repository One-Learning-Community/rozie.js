// Phase 36 Plan 05 (R10 / R12) — Lit cross-component context emit.
//
// Asserts the `$provide(key, value)` / `const x = $inject(key, fallback?)`
// sigils lower to `@lit/context`'s ContextProvider/ContextConsumer controllers:
//
//   $provide('theme', { get color() {…}, cycle })
//     → const __rozieCtx_theme = createContext(Symbol.for('rozie:theme'));
//       private __rozieCtxProvider_theme = new ContextProvider(this, { … });
//       + reactive setValue effect (when the value reads $data/$computed signals)
//   const theme = $inject('theme')
//     → private __rozieCtxConsumer_theme = new ContextConsumer(this, { subscribe: true });
//       private get theme() { return this.__rozieCtxConsumer_theme.value; }   ← null-guard (REQ-30)
//
// Three hard rules:
//   - createContext(Symbol.for('rozie:'+key)) for native cross-file identity — NO registry (D-1)
//   - ContextConsumer(subscribe:true) + an emitted NULL-GUARD at the read site (REQ-30 — the
//     documented async edge; the value is undefined until the context-request round-trip resolves)
//   - R12 / D-5 empty-case byte-identity: no $provide/$inject → ZERO @lit/context text.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitLit } from '../emitLit.js';

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

function compile(src: string, filename: string): { code: string; diagnostics: unknown[] } {
  const ir = lower(src, filename);
  const registry = createDefaultRegistry();
  const { code, diagnostics } = emitLit(ir, { filename, source: src, modifierRegistry: registry });
  return { code, diagnostics };
}

// Reactive provider: the provided value reads $data via a live getter (D-3), so
// it must re-publish through a `setValue` effect on color change.
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

// Constant provided value (no signal reads) → ContextProvider with initialValue
// but NO setValue effect.
const CONSTANT_PROVIDER_SRC = `<rozie name="ConstProvider">
<script>
$provide('config', { mode: 'dark' });
</script>
<template>
<div><slot></slot></div>
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

describe('Lit emit — cross-component context ($provide / $inject)', () => {
  it('provider: $provide → createContext(Symbol.for) + ContextProvider, $provide stripped', () => {
    const { code, diagnostics } = compile(PROVIDER_SRC, 'ThemeProvider.rozie');
    expect((diagnostics as { severity?: string }[]).filter((d) => d.severity === 'error')).toHaveLength(0);
    // Module-scope createContext over the Symbol.for global-registry key (D-1).
    expect(code).toContain("const __rozieCtx_theme = createContext(Symbol.for('rozie:theme'));");
    // ContextProvider controller field with initialValue.
    expect(code).toContain('new ContextProvider(this, { context: __rozieCtx_theme, initialValue:');
    // @lit/context imports present.
    expect(code).toMatch(/import \{[^}]*\bcreateContext\b[^}]*\} from '@lit\/context';/);
    expect(code).toMatch(/import \{[^}]*\bContextProvider\b[^}]*\} from '@lit\/context';/);
    // The author-side directive must NOT leak as an undefined runtime ref.
    expect(code).not.toContain('$provide');
    // Phase 36 fix — the provided value is wrapped in a host-capturing arrow
    // IIFE and every `this` rewritten to the captured `__rozieCtxHost`, so a
    // nested getter reads the ELEMENT (not the object literal — which has no
    // `_color`, the bug that crashed with "reading value of undefined"). The
    // getter still carries the $data.color → _color.value signal rewrite.
    expect(code).toContain('((__rozieCtxHost) => (');
    expect(code).toContain('return __rozieCtxHost._color.value;');
    expect(code).toContain('))(this)');
  });

  it('provider reactivity (R10 / Pattern 5 / D-3): setValue hooked into effect() on $data dep', () => {
    const { code } = compile(PROVIDER_SRC, 'ThemeProvider.rozie');
    // The reactive bridge: an effect() that touches the signal and re-publishes.
    expect(code).toContain('this.__rozieCtxProvider_theme.setValue(');
    expect(code).toMatch(/this\._disconnectCleanups\.push\(effect\(\(\) => \{[^]*setValue/);
    // Touches the signal read so the effect subscribes to color changes.
    expect(code).toContain('void this._color.value;');
    // `effect` imported from @lit-labs/preact-signals.
    expect(code).toMatch(/import \{[^}]*\beffect\b[^}]*\} from '@lit-labs\/preact-signals';/);
  });

  it('constant provider: initialValue but NO setValue effect (no signal reads)', () => {
    const { code } = compile(CONSTANT_PROVIDER_SRC, 'ConstProvider.rozie');
    expect(code).toContain("const __rozieCtx_config = createContext(Symbol.for('rozie:config'));");
    expect(code).toContain('new ContextProvider(this, { context: __rozieCtx_config, initialValue:');
    // No reactive re-publish for a constant value.
    expect(code).not.toContain('.setValue(');
  });

  it('consumer: const theme = $inject("theme") → ContextConsumer + null-guarded getter (REQ-30)', () => {
    const { code, diagnostics } = compile(CONSUMER_SRC, 'ThemeButton.rozie');
    expect((diagnostics as { severity?: string }[]).filter((d) => d.severity === 'error')).toHaveLength(0);
    expect(code).toContain("const __rozieCtx_theme = createContext(Symbol.for('rozie:theme'));");
    expect(code).toContain('new ContextConsumer(this, { context: __rozieCtx_theme, subscribe: true });');
    expect(code).toMatch(/import \{[^}]*\bContextConsumer\b[^}]*\} from '@lit\/context';/);
    // REQ-30 null-guard: the read accessor returns `.value` (already T | undefined).
    expect(code).toContain('private get theme() { return this.__rozieCtxConsumer_theme.value; }');
    expect(code).not.toContain('$inject');
  });

  it('consumer with fallback: $inject("theme", fb) → null-guarded getter `.value ?? fb` (REQ-30)', () => {
    const { code } = compile(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie');
    expect(code).toContain('new ContextConsumer(this, { context: __rozieCtx_theme, subscribe: true });');
    // Fallback form of the null-guard.
    expect(code).toContain('this.__rozieCtxConsumer_theme.value ??');
    expect(code).toContain("color: 'gray'");
  });

  it('R12 / D-5 — a component with no $provide/$inject emits ZERO @lit/context text', () => {
    const ir = lower(NO_CONTEXT_SRC, 'Plain.rozie');
    expect(ir.provides).toHaveLength(0);
    expect(ir.injects).toHaveLength(0);
    const { code } = compile(NO_CONTEXT_SRC, 'Plain.rozie');
    expect(code).not.toContain('@lit/context');
    expect(code).not.toContain('createContext');
    expect(code).not.toContain('ContextProvider');
    expect(code).not.toContain('ContextConsumer');
    expect(code).not.toContain('__rozieCtx');
  });

  it('R12 / D-5 — no-context emit is byte-identical across two fresh emits (no nondeterminism)', () => {
    const a = compile(NO_CONTEXT_SRC, 'Plain.rozie').code;
    const b = compile(NO_CONTEXT_SRC, 'Plain.rozie').code;
    expect(a).toBe(b);
  });
});
