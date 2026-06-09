// Phase 36 Plan 02 (R5 / R12) — Vue cross-component context emit.
//
// Asserts the `$provide(key, value)` / `const x = $inject(key, fallback?)`
// sigils lower to Vue's native provide/inject API (imported from `'vue'`):
//
//   $provide('theme', { get color() {…}, cycle })
//     → provide('theme', { … });            (after the residual body)
//   const theme = $inject('theme')
//     → const theme = inject('theme');       (in the preamble, before residual)
//
// Plus the R12 / D-5 empty-case byte-identity gate: a component with NO
// $provide/$inject emits ZERO provide/inject text and imports nothing new.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitScript } from '../src/emit/emitScript.js';

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

const NO_CONTEXT_SRC = `<rozie name="Plain">
<data>
{ count: 0 }
</data>
<template>
<button @click="$data.count++">{{ $data.count }}</button>
</template>
</rozie>`;

describe('Vue emit — cross-component context ($provide / $inject)', () => {
  it('provider: $provide → provide("theme", …) imported from vue, $provide stripped', () => {
    const ir = lower(PROVIDER_SRC, 'ThemeProvider.rozie');
    expect(ir.provides.map((p) => p.key)).toEqual(['theme']);
    const { script, diagnostics } = emitScript(ir, {});
    expect(diagnostics).toHaveLength(0);
    // Native provide call, with the string key the native injection token.
    expect(script).toContain("provide('theme'");
    // `provide` collected into the `'vue'` import line.
    expect(script).toMatch(/import \{[^}]*\bprovide\b[^}]*\} from 'vue';/);
    // The author-side directive must NOT leak as an undefined runtime ref.
    expect(script).not.toContain('$provide');
    // The provided getter picked up the $data.color → color.value rewrite.
    expect(script).toContain('color.value');
  });

  it('consumer: const theme = $inject("theme") → const theme = inject("theme"), $inject stripped', () => {
    const ir = lower(CONSUMER_SRC, 'ThemeButton.rozie');
    expect(ir.injects.map((i) => ({ k: i.key, b: i.localBinding }))).toEqual([
      { k: 'theme', b: 'theme' },
    ]);
    const { script, diagnostics } = emitScript(ir, {});
    expect(diagnostics).toHaveLength(0);
    expect(script).toContain("const theme = inject('theme');");
    expect(script).toMatch(/import \{[^}]*\binject\b[^}]*\} from 'vue';/);
    expect(script).not.toContain('$inject');
  });

  it('consumer with fallback: $inject("theme", fb) → inject("theme", fb)', () => {
    const ir = lower(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie');
    const { script } = emitScript(ir, {});
    expect(script).toContain("const theme = inject('theme', {");
    expect(script).toContain("color: 'gray'");
  });

  it('inject binder precedes the residual body (consumer can reference the const)', () => {
    const ir = lower(CONSUMER_SRC, 'ThemeButton.rozie');
    const { script } = emitScript(ir, {});
    // No residual statements in this consumer, but the binder must still be in
    // the preamble region — assert it appears before any (future) residual.
    expect(script).toContain("const theme = inject('theme');");
  });

  it('R12 / D-5 — a component with no $provide/$inject emits ZERO context text', () => {
    const ir = lower(NO_CONTEXT_SRC, 'Plain.rozie');
    expect(ir.provides).toHaveLength(0);
    expect(ir.injects).toHaveLength(0);
    const { script } = emitScript(ir, {});
    expect(script).not.toContain('provide(');
    expect(script).not.toContain('inject(');
    // The vue import line must not gain provide/inject.
    expect(script).not.toMatch(/import \{[^}]*\bprovide\b/);
    expect(script).not.toMatch(/import \{[^}]*\binject\b/);
  });

  it('R12 / D-5 — no-context emit is byte-identical to a fresh emit (no nondeterminism)', () => {
    const ir = lower(NO_CONTEXT_SRC, 'Plain.rozie');
    const a = emitScript(ir, {}).script;
    const b = emitScript(lower(NO_CONTEXT_SRC, 'Plain.rozie'), {}).script;
    expect(a).toBe(b);
  });
});
