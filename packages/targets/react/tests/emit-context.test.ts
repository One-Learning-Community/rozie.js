// Phase 36 Plan 07 (R7 / R11 / R12) — React cross-component context emit.
//
// Asserts the `$provide(key, value)` / `const x = $inject(key, fallback?)`
// sigils lower to React Context backed by the globalThis-shared `rozieContext`
// registry from `@rozie/runtime-react`:
//
//   $provide('theme', { get color() {…}, cycle })
//     → const __ctx_theme = rozieContext('theme');           (component body)
//       return ( <__ctx_theme.Provider value={…}> … </__ctx_theme.Provider> );
//   const theme = $inject('theme')
//     → const theme = useContext(rozieContext('theme'));
//
// Plus the R12 / D-5 empty-case byte-identity gate, and the CRITICAL Pitfall 3
// case: a component that BOTH $provides AND $exposes must still close the
// forwardRef tail correctly.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitReact } from '../src/emitReact.js';

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

// Pitfall 3 — a component that BOTH $provides a context AND $exposes a method.
// The Provider wrap must NOT corrupt the forwardRef close-tail.
const PROVIDE_AND_EXPOSE_SRC = `<rozie name="ThemeStore">
<data>
{ color: 'red' }
</data>
<script>
function cycle() {
  $data.color = $data.color === 'red' ? 'green' : 'red';
}
function reset() {
  $data.color = 'red';
}
$provide('theme', { get color() { return $data.color; }, cycle });
$expose({ reset });
</script>
<template>
<div><slot></slot></div>
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

describe('React emit — cross-component context ($provide / $inject)', () => {
  it('provider: $provide → rozieContext + <C.Provider value={…}> wrap, $provide stripped', () => {
    const ir = lower(PROVIDER_SRC, 'ThemeProvider.rozie');
    expect(ir.provides.map((p) => p.key)).toEqual(['theme']);
    const { code, diagnostics } = emitReact(ir, { filename: 'ThemeProvider.rozie' });
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    // The context object is created via the globalThis-backed registry helper.
    // CR-01: the key is JSON-serialized (double-quoted) for escaping safety.
    expect(code).toContain('const __ctx_theme = rozieContext("theme");');
    // `rozieContext` collected into the `@rozie/runtime-react` import line.
    expect(code).toMatch(/import \{[^}]*\brozieContext\b[^}]*\} from '@rozie\/runtime-react';/);
    // The returned JSX is wrapped in the Provider subtree.
    expect(code).toContain('<__ctx_theme.Provider value={');
    expect(code).toContain('</__ctx_theme.Provider>');
    // The author-side directive must NOT leak as an undefined runtime ref.
    expect(code).not.toContain('$provide');
    // The provided getter picked up the $data.color → color/setColor rewrite.
    expect(code).toContain('color');
    // The provider has no $expose → plain function shape (no forwardRef).
    expect(code).not.toContain('forwardRef');
  });

  it('consumer: const theme = $inject("theme") → useContext(rozieContext("theme")), $inject stripped', () => {
    const ir = lower(CONSUMER_SRC, 'ThemeButton.rozie');
    expect(ir.injects.map((i) => ({ k: i.key, b: i.localBinding }))).toEqual([
      { k: 'theme', b: 'theme' },
    ]);
    const { code, diagnostics } = emitReact(ir, { filename: 'ThemeButton.rozie' });
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    expect(code).toContain('const theme = useContext(rozieContext("theme"));');
    expect(code).toMatch(/import \{[^}]*\buseContext\b[^}]*\} from 'react';/);
    expect(code).toMatch(/import \{[^}]*\brozieContext\b[^}]*\} from '@rozie\/runtime-react';/);
    expect(code).not.toContain('$inject');
  });

  it('consumer with fallback: $inject("theme", fb) → useContext(...) ?? fb', () => {
    const ir = lower(CONSUMER_FALLBACK_SRC, 'ThemeButtonFallback.rozie');
    const { code } = emitReact(ir, { filename: 'ThemeButtonFallback.rozie' });
    expect(code).toContain('const theme = useContext(rozieContext("theme")) ??');
    expect(code).toContain("color: 'gray'");
  });

  it('Pitfall 3 — $provide + $expose: Provider wrap leaves the forwardRef close-tail intact', () => {
    const ir = lower(PROVIDE_AND_EXPOSE_SRC, 'ThemeStore.rozie');
    expect(ir.provides.map((p) => p.key)).toEqual(['theme']);
    expect(ir.expose.map((e) => e.name)).toEqual(['reset']);
    const { code, diagnostics } = emitReact(ir, { filename: 'ThemeStore.rozie' });
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    // forwardRef framing present (because $expose).
    expect(code).toContain('forwardRef<ThemeStoreHandle, ThemeStoreProps>');
    expect(code).toContain('useImperativeHandle(ref, () => ({ reset }), [])');
    // The Provider wrap is INSIDE the returned JSX.
    expect(code).toContain('<__ctx_theme.Provider value={');
    expect(code).toContain('</__ctx_theme.Provider>');
    // CRITICAL: the forwardRef close-tail is intact and balanced.
    expect(code).toContain('\n  );\n});\n');
    expect(code).toContain('export default ThemeStore;');
    // The return-open line itself is byte-untouched (Provider wraps the payload,
    // not the `return (` line).
    expect(code).toContain('  return (\n');
    // Sanity: the wrap nests correctly — Provider open precedes its close.
    const openIdx = code.indexOf('<__ctx_theme.Provider value={');
    const closeIdx = code.indexOf('</__ctx_theme.Provider>');
    expect(openIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(openIdx);
  });

  it('multiple $provide keys → nested <C.Provider> tags, balanced close', () => {
    const ir = lower(MULTI_PROVIDE_SRC, 'MultiProvider.rozie');
    expect(ir.provides.map((p) => p.key)).toEqual(['theme', 'layout']);
    const { code } = emitReact(ir, { filename: 'MultiProvider.rozie' });
    expect(code).toContain('const __ctx_theme = rozieContext("theme");');
    expect(code).toContain('const __ctx_layout = rozieContext("layout");');
    // OUTERMOST key first in the open tags; reverse order on the close tags.
    const openTheme = code.indexOf('<__ctx_theme.Provider');
    const openLayout = code.indexOf('<__ctx_layout.Provider');
    const closeLayout = code.indexOf('</__ctx_layout.Provider>');
    const closeTheme = code.indexOf('</__ctx_theme.Provider>');
    // theme opens before layout (outer first); layout closes before theme.
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
    const provider = emitReact(lower(APOSTROPHE_PROVIDE, 'AposProvider.rozie'), {
      filename: 'AposProvider.rozie',
    }).code;
    const consumer = emitReact(lower(APOSTROPHE_CONSUME, 'AposConsumer.rozie'), {
      filename: 'AposConsumer.rozie',
    }).code;
    // The raw apostrophe is NEVER spliced into single-quoted source.
    expect(provider).not.toContain("rozieContext('it's')");
    // JSON.stringify escapes to a double-quoted literal with the apostrophe intact.
    expect(provider).toContain('rozieContext("it\'s")');
    expect(consumer).toContain('rozieContext("it\'s")');
    // Provider + consumer emit the SAME token string (cross-file identity holds).
    const tokenRe = /rozieContext\((".*?")\)/;
    const provTok = provider.match(tokenRe)?.[1];
    const consTok = consumer.match(tokenRe)?.[1];
    expect(provTok).toBeDefined();
    expect(provTok).toBe(consTok);
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
    const { code } = emitReact(lower(COLLIDE_SRC, 'CollideProvider.rozie'), {
      filename: 'CollideProvider.rozie',
    });
    // Both distinct tokens are present (JSON-serialized, double-quoted per CR-01).
    expect(code).toContain('rozieContext("a.b")');
    expect(code).toContain('rozieContext("a-b")');
    // The two context consts must NOT share a name (no duplicate declaration).
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
    const { code } = emitReact(ir, { filename: 'Plain.rozie' });
    expect(code).not.toContain('rozieContext');
    expect(code).not.toContain('useContext');
    expect(code).not.toContain('.Provider');
    // The react import line must not gain useContext.
    expect(code).not.toMatch(/import \{[^}]*\buseContext\b/);
  });

  it('R12 / D-5 — no-context emit is byte-identical across two fresh emits', () => {
    const a = emitReact(lower(NO_CONTEXT_SRC, 'Plain.rozie'), { filename: 'Plain.rozie' }).code;
    const b = emitReact(lower(NO_CONTEXT_SRC, 'Plain.rozie'), { filename: 'Plain.rozie' }).code;
    expect(a).toBe(b);
  });
});
