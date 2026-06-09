// Phase 36 Plan 07 (R8 / R11 / R12) — Solid cross-component context emit.
//
// Asserts the `$provide(key, value)` / `const x = $inject(key, fallback?)`
// sigils lower to Solid Context backed by the globalThis-shared `rozieContext`
// registry from `@rozie/runtime-solid`:
//
//   $provide('theme', { get color() {…} })
//     → const __ctx_theme = rozieContext('theme');           (component body)
//       return ( <__ctx_theme.Provider value={…}> … </__ctx_theme.Provider> );
//   const theme = $inject('theme')
//     → const theme = useContext(rozieContext('theme'));
//
// Plus the R12 / D-5 empty-case byte-identity gate.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSolid } from '../emitSolid.js';

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

const MULTI_PROVIDE_SRC = `<rozie name="MultiProvider">
<data>
{ color: 'red', size: 'lg' }
</data>
<script>
$provide('theme', { get color() { return $data.color; } });
$provide('layout', { get size() { return $data.size; } });
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

describe('Solid emit — cross-component context ($provide / $inject)', () => {
  it('provider: $provide → rozieContext + <C.Provider value={…}> wrap, $provide stripped', () => {
    const ir = lower(PROVIDER_SRC, 'ThemeProvider.rozie');
    expect(ir.provides.map((p) => p.key)).toEqual(['theme']);
    const { code, diagnostics } = emitSolid(ir, { filename: 'ThemeProvider.rozie' });
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    // CR-01: the key is JSON-serialized (double-quoted) for escaping safety.
    expect(code).toContain('const __ctx_theme = rozieContext("theme");');
    expect(code).toMatch(/import \{[^}]*\brozieContext\b[^}]*\} from '@rozie\/runtime-solid';/);
    expect(code).toContain('<__ctx_theme.Provider value={');
    expect(code).toContain('</__ctx_theme.Provider>');
    expect(code).not.toContain('$provide');
    // The provided getter picked up the $data.color → color() signal rewrite.
    expect(code).toContain('color');
  });

  it('consumer: const theme = $inject("theme") → useContext(rozieContext("theme")), $inject stripped', () => {
    const ir = lower(CONSUMER_SRC, 'ThemeButton.rozie');
    expect(ir.injects.map((i) => ({ k: i.key, b: i.localBinding }))).toEqual([
      { k: 'theme', b: 'theme' },
    ]);
    const { code, diagnostics } = emitSolid(ir, { filename: 'ThemeButton.rozie' });
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    expect(code).toContain('const theme = useContext(rozieContext("theme"));');
    expect(code).toMatch(/import \{[^}]*\buseContext\b[^}]*\} from 'solid-js';/);
    expect(code).toMatch(/import \{[^}]*\brozieContext\b[^}]*\} from '@rozie\/runtime-solid';/);
    expect(code).not.toContain('$inject');
  });

  it('consumer with fallback: $inject("theme", fb) → useContext(...) ?? fb', () => {
    const ir = lower(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie');
    const { code } = emitSolid(ir, { filename: 'ThemeButtonFallback.rozie' });
    expect(code).toContain('const theme = useContext(rozieContext("theme")) ??');
    expect(code).toContain("color: 'gray'");
  });

  it('multiple $provide keys → nested <C.Provider> tags, balanced close', () => {
    const ir = lower(MULTI_PROVIDE_SRC, 'MultiProvider.rozie');
    expect(ir.provides.map((p) => p.key)).toEqual(['theme', 'layout']);
    const { code } = emitSolid(ir, { filename: 'MultiProvider.rozie' });
    expect(code).toContain('const __ctx_theme = rozieContext("theme");');
    expect(code).toContain('const __ctx_layout = rozieContext("layout");');
    const openTheme = code.indexOf('<__ctx_theme.Provider');
    const openLayout = code.indexOf('<__ctx_layout.Provider');
    const closeLayout = code.indexOf('</__ctx_layout.Provider>');
    const closeTheme = code.indexOf('</__ctx_theme.Provider>');
    expect(openTheme).toBeLessThan(openLayout);
    expect(closeLayout).toBeLessThan(closeTheme);
  });

  it("CR-01 — a key containing an apostrophe is JSON-escaped (valid source + matching provider/consumer token)", () => {
    const APOSTROPHE_PROVIDE = `<rozie name="AposProvider">
<data>
{ color: 'red' }
</data>
<script>
$provide("it's", { get color() { return $data.color; } });
</script>
<template>
<div><slot></slot></div>
</template>
</rozie>`;
    const APOSTROPHE_CONSUME = `<rozie name="AposConsumer">
<script>
const theme = $inject("it's");
</script>
<template>
<button>{{ theme.color }}</button>
</template>
</rozie>`;
    const provider = emitSolid(lower(APOSTROPHE_PROVIDE, 'AposProvider.rozie'), {
      filename: 'AposProvider.rozie',
    }).code;
    const consumer = emitSolid(lower(APOSTROPHE_CONSUME, 'AposConsumer.rozie'), {
      filename: 'AposConsumer.rozie',
    }).code;
    expect(provider).not.toContain("rozieContext('it's')");
    expect(provider).toContain('rozieContext("it\'s")');
    expect(consumer).toContain('rozieContext("it\'s")');
    const tokenRe = /rozieContext\((".*?")\)/;
    expect(provider.match(tokenRe)?.[1]).toBe(consumer.match(tokenRe)?.[1]);
  });

  it('WR-01 — two distinct keys that sanitize alike get distinct const identifiers', () => {
    const COLLIDE_SRC = `<rozie name="CollideProvider">
<data>
{ color: 'red' }
</data>
<script>
$provide('a.b', { get color() { return $data.color; } });
$provide('a-b', { get color() { return $data.color; } });
</script>
<template>
<div><slot></slot></div>
</template>
</rozie>`;
    const { code } = emitSolid(lower(COLLIDE_SRC, 'CollideProvider.rozie'), {
      filename: 'CollideProvider.rozie',
    });
    expect(code).toContain('rozieContext("a.b")');
    expect(code).toContain('rozieContext("a-b")');
    const declMatches = [...code.matchAll(/const (__ctx_[A-Za-z0-9_$]+) = rozieContext/g)].map(
      (m) => m[1],
    );
    expect(declMatches).toHaveLength(2);
    expect(new Set(declMatches).size).toBe(2);
  });

  it('R12 / D-5 — a component with no $provide/$inject emits ZERO context text', () => {
    const ir = lower(NO_CONTEXT_SRC, 'Plain.rozie');
    expect(ir.provides).toHaveLength(0);
    expect(ir.injects).toHaveLength(0);
    const { code } = emitSolid(ir, { filename: 'Plain.rozie' });
    expect(code).not.toContain('rozieContext');
    expect(code).not.toContain('useContext');
    expect(code).not.toContain('.Provider');
  });

  it('R12 / D-5 — no-context emit is byte-identical across two fresh emits', () => {
    const a = emitSolid(lower(NO_CONTEXT_SRC, 'Plain.rozie'), { filename: 'Plain.rozie' }).code;
    const b = emitSolid(lower(NO_CONTEXT_SRC, 'Plain.rozie'), { filename: 'Plain.rozie' }).code;
    expect(a).toBe(b);
  });
});
