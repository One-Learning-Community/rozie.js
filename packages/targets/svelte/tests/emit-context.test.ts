// Phase 36 Plan 03 (R6 / R12) — Svelte cross-component context emit.
//
// Asserts the `$provide(key, value)` / `const x = $inject(key, fallback?)`
// sigils lower to Svelte's native setContext/getContext API (imported from
// `'svelte'`):
//
//   $provide('theme', { get color() {…}, cycle })
//     → setContext('theme', { … });            (init scope, after residual)
//   const theme = $inject('theme')
//     → const theme = getContext('theme');       (preamble — init scope)
//
// REQ-32 / Pitfall 5: both calls land in component INIT scope — never inside
// `onMount`/`$effect` — or Svelte throws "called outside component
// initialization".
//
// Plus the R12 / D-5 empty-case byte-identity gate: a component with NO
// $provide/$inject emits ZERO context text and imports nothing new.
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

describe('Svelte emit — cross-component context ($provide / $inject)', () => {
  it('provider: $provide → setContext("theme", …) from svelte, $provide stripped', () => {
    const ir = lower(PROVIDER_SRC, 'ThemeProvider.rozie');
    expect(ir.provides.map((p) => p.key)).toEqual(['theme']);
    const { scriptBlock, diagnostics } = emitScript(ir, {});
    expect(diagnostics).toHaveLength(0);
    // Native setContext call, with the string key the native context key.
    expect(scriptBlock).toContain("setContext('theme'");
    // `setContext` collected into the `'svelte'` value-import line.
    expect(scriptBlock).toMatch(/import \{[^}]*\bsetContext\b[^}]*\} from 'svelte';/);
    // The author-side directive must NOT leak as an undefined runtime ref.
    expect(scriptBlock).not.toContain('$provide');
    // The provided getter picked up the $data.color → color rewrite (bare let
    // read in Svelte — $state-backed, so the consumer reads reactive, D-3).
    expect(scriptBlock).toContain('return color');
  });

  it('REQ-32 — setContext lands in INIT scope, NOT inside onMount/$effect', () => {
    const ir = lower(PROVIDER_SRC, 'ThemeProvider.rozie');
    const { scriptBlock } = emitScript(ir, {});
    // The setContext line must NOT be nested inside any onMount(...) / $effect(...)
    // callback. Crude-but-effective: there is no onMount/$effect anywhere before
    // the setContext call in this fixture, so a bare top-level statement proves
    // init-scope placement.
    expect(scriptBlock).not.toMatch(/onMount\([^]*setContext/);
    expect(scriptBlock).not.toMatch(/\$effect\([^]*setContext/);
    // setContext is a top-level statement (line begins with `setContext(`).
    expect(scriptBlock).toMatch(/^setContext\('theme'/m);
  });

  it('consumer: const theme = $inject("theme") → const theme = getContext("theme"), $inject stripped', () => {
    const ir = lower(CONSUMER_SRC, 'ThemeButton.rozie');
    expect(ir.injects.map((i) => ({ k: i.key, b: i.localBinding }))).toEqual([
      { k: 'theme', b: 'theme' },
    ]);
    const { scriptBlock, diagnostics } = emitScript(ir, {});
    expect(diagnostics).toHaveLength(0);
    expect(scriptBlock).toContain("const theme = getContext('theme');");
    expect(scriptBlock).toMatch(/import \{[^}]*\bgetContext\b[^}]*\} from 'svelte';/);
    expect(scriptBlock).not.toContain('$inject');
    // getContext is a top-level (init-scope) const, not nested in a callback.
    expect(scriptBlock).toMatch(/^const theme = getContext\('theme'\);/m);
  });

  it('consumer with fallback: $inject("theme", fb) → getContext("theme") ?? fb', () => {
    const ir = lower(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie');
    const { scriptBlock } = emitScript(ir, {});
    expect(scriptBlock).toContain("const theme = getContext('theme') ?? {");
    expect(scriptBlock).toContain("color: 'gray'");
  });

  it('R12 / D-5 — a component with no $provide/$inject emits ZERO context text', () => {
    const ir = lower(NO_CONTEXT_SRC, 'Plain.rozie');
    expect(ir.provides).toHaveLength(0);
    expect(ir.injects).toHaveLength(0);
    const { scriptBlock } = emitScript(ir, {});
    expect(scriptBlock).not.toContain('setContext');
    expect(scriptBlock).not.toContain('getContext');
    // The svelte import line must not gain setContext/getContext.
    expect(scriptBlock).not.toMatch(/import \{[^}]*\bsetContext\b/);
    expect(scriptBlock).not.toMatch(/import \{[^}]*\bgetContext\b/);
  });

  it('R12 / D-5 — no-context emit is byte-identical to a fresh emit (no nondeterminism)', () => {
    const a = emitScript(lower(NO_CONTEXT_SRC, 'Plain.rozie'), {}).scriptBlock;
    const b = emitScript(lower(NO_CONTEXT_SRC, 'Plain.rozie'), {}).scriptBlock;
    expect(a).toBe(b);
  });
});
