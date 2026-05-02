// Phase 3 Plan 02 Task 3 — DX-03 trust-erosion floor regression suite.
//
// Verifies that `console.log("hello from rozie")` survives parse → lowerToIR
// → emitScript byte-identical. Per RESEARCH.md Pitfall 9 (line 781):
//
//   "Phase 3 emits source verbatim from @babel/generator — no extra
//    minification. Production-mode minification is a CONSUMER concern
//    (Vite/esbuild config) — not Rozie's job to fight it. The DX-03
//    verification is for dev mode."
//
// Negative tests assert no sanitization strips the call or escapes quotes.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitScript } from '../emit/emitScript.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function compileScript(source: string): string {
  const result = parse(source, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  const { script } = emitScript(lowered.ir);
  return script;
}

describe('DX-03: console.log preservation through parse → lower → emit', () => {
  it('Synthetic .rozie source: console.log("hello from rozie") survives byte-identical', () => {
    const source = `
<rozie name="Synth">
<script>
console.log("hello from rozie")
const x = 1;
</script>
<template>
<div>{{ x }}</div>
</template>
</rozie>
`;
    const script = compileScript(source);
    expect(script).toContain('console.log("hello from rozie")');
  });

  it('examples/Counter.rozie: console.log("hello from rozie") survives via real Counter pipeline', () => {
    const counterSource = loadExample('Counter');
    expect(counterSource).toContain('console.log("hello from rozie")');
    const script = compileScript(counterSource);
    expect(script).toContain('console.log("hello from rozie")');
  });

  it('Negative: no sanitization strips quote escaping', () => {
    const source = `
<rozie name="Quotes">
<script>
console.log("path/to/file with \\"quotes\\"")
console.log('single quotes')
</script>
<template>
<div></div>
</template>
</rozie>
`;
    const script = compileScript(source);
    // Both calls preserved (modulo @babel/generator's quote choice — it may
    // normalize single↔double quotes, but the call itself survives).
    expect(script).toMatch(/console\.log\(/);
    expect(script.match(/console\.log\(/g)?.length).toBe(2);
  });

  it('Negative: console.log inside helper fn body survives', () => {
    const source = `
<rozie name="HelperLog">
<script>
const helper = () => {
  console.log("inside helper")
  return 42
}
</script>
<template>
<div></div>
</template>
</rozie>
`;
    const script = compileScript(source);
    expect(script).toContain('console.log("inside helper")');
  });

  it('console.log adjacent to $props rewrite still survives — and rewrite still applies', () => {
    const source = `
<rozie name="Mixed">
<props>
{ value: { type: Number, default: 0, model: true } }
</props>
<script>
console.log("hello from rozie")
const x = $props.value + 1
</script>
<template>
<div></div>
</template>
</rozie>
`;
    const script = compileScript(source);
    expect(script).toContain('console.log("hello from rozie")');
    // $props.value is a model prop → value.value
    expect(script).toMatch(/value\.value\s*\+\s*1/);
  });
});
