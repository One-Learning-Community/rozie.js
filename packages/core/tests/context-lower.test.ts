// Phase 36 Plan 36-01 Task 2 — canonical ThemeProvider/ThemeButton lowering.
//
// Asserts the canonical Spike-010 fixture trio (productized) extracts the
// correct keys and the inject local binding name through the full
// parse → collect → lowerToIR pipeline. The minimal-trio shape (a provider
// `$provide('theme', { get color(){…}, cycle })` and a consumer
// `const theme = $inject('theme')`) is the dist-parity byte fixture in a later
// wave; here we only prove the IR surface extracts correctly.
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../src/parse.js';
import { lowerToIR } from '../src/ir/lower.js';
import { createDefaultRegistry } from '../src/modifiers/registerBuiltins.js';

function parseAst(source: string, filename = 'ThemeFixture.rozie') {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

function lowerFor(source: string, filename?: string) {
  return lowerToIR(parseAst(source, filename), {
    modifierRegistry: createDefaultRegistry(),
  });
}

// Canonical ThemeProvider — provides a live-getter theme object + a cycle fn.
const THEME_PROVIDER = `<rozie name="ThemeProvider">
<data>{ index: 0, palette: ['red', 'green', 'blue'] }</data>
<script>
function cycle() { $data.index = ($data.index + 1) % 3 }
$provide('theme', { get color() { return $data.palette[$data.index] }, cycle })
</script>
<template><div><slot /></div></template>
</rozie>`;

// Canonical ThemeButton — injects the theme, shows color, click → cycle().
const THEME_BUTTON = `<rozie name="ThemeButton">
<script>
const theme = $inject('theme')
</script>
<template>
<button @click="theme.cycle()" :style="{ color: theme.color }">cycle</button>
</template>
</rozie>`;

describe('lowerContext — canonical ThemeProvider/ThemeButton', () => {
  it("ThemeProvider extracts key 'theme' with the getter-object value", () => {
    const { ir } = lowerFor(THEME_PROVIDER, 'ThemeProvider.rozie');
    expect(ir).not.toBeNull();
    expect(ir!.provides.length).toBe(1);
    const decl = ir!.provides[0]!;
    expect(decl.type).toBe('ProvideDecl');
    expect(decl.key).toBe('theme');
    // The value is the `{ get color(){…}, cycle }` object literal — carried
    // verbatim so per-target emit can wire reactivity (D-3 live refs).
    expect(t.isObjectExpression(decl.valueExpr)).toBe(true);
  });

  it("ThemeButton extracts key 'theme' + inject local binding name 'theme'", () => {
    const { ir } = lowerFor(THEME_BUTTON, 'ThemeButton.rozie');
    expect(ir!.injects.length).toBe(1);
    const decl = ir!.injects[0]!;
    expect(decl.type).toBe('InjectDecl');
    expect(decl.key).toBe('theme');
    expect(decl.localBinding).toBe('theme');
  });

  it('the inject local binding tracks the const NAME, not the key', () => {
    const src = `<rozie name="Renamed">
<script>
const myTheme = $inject('theme')
</script>
<template><span>{{ myTheme.color }}</span></template>
</rozie>`;
    const { ir } = lowerFor(src, 'Renamed.rozie');
    expect(ir!.injects[0]!.key).toBe('theme');
    expect(ir!.injects[0]!.localBinding).toBe('myTheme');
  });

  it('multiple $provide calls (distinct keys) all survive lowering in source order', () => {
    const src = `<rozie name="MultiProvider">
<data>{ a: 1, b: 2 }</data>
<script>
$provide('alpha', { get v() { return $data.a } })
$provide('beta', { get v() { return $data.b } })
</script>
<template><div><slot /></div></template>
</rozie>`;
    const { ir } = lowerFor(src, 'MultiProvider.rozie');
    expect(ir!.provides.map((p) => p.key)).toEqual(['alpha', 'beta']);
  });
});
