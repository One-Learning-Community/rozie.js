/**
 * Plan 15-03 Task 2 — Solid `ListenerSpreadIR` emitter (D-09 hybrid + R6
 * all-fire merge + D-19 $listeners exemption).
 *
 * Solid mirrors React: same JSX listener-prop convention (`onClick`,
 * `onMouseEnter`), so the emit shape is byte-equivalent modulo the runtime
 * import package (`@rozie/runtime-solid`).
 *
 * Six emit shapes covered:
 *   (1) literal-only no-merge
 *   (2) literal-with-merge R6 inline dispatcher
 *   (3) literal modifier-bearing → existing modifier-pipeline emit
 *   (4) dynamic no-merge → {...normalizeListeners(expr)}
 *   (5) dynamic with-merge → mergeListeners(...) runtime call
 *   (6) bare $listeners (D-19 exempt) → {...$listeners}
 *   (7) bare $listeners + @click (R6 + D-19) → mergeListeners(..., $listeners)
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../../emitSolid.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitSolid(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the JSX returned by the emitted component — paren-balanced text
 * between `return (` and the matching `);`.
 */
function extractJsx(emitted: string): string {
  const start = emitted.search(/return\s*\(/);
  if (start < 0) return emitted;
  const openIdx = emitted.indexOf('(', start);
  let depth = 1;
  let i = openIdx + 1;
  while (i < emitted.length && depth > 0) {
    const ch = emitted[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0) break;
    i++;
  }
  return emitted.slice(openIdx + 1, i).trim();
}

describe('emitTemplateAttribute (Solid) — ListenerSpreadIR (Plan 15-03)', () => {
  // Suppress auto-fallthrough for isolation; same rationale as React sibling.
  const PROLOGUE = '<rozie name="Test" inherit-listeners="false" inherit-attrs="false">';

  it('(1) literal-only no-merge: r-on="{ click: fn }" → onClick={fn}', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ click: fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();
    expect(jsx).toContain('onClick={fn}');
    expect(jsx).not.toContain('normalizeListeners');
    expect(jsx).not.toContain('mergeListeners');
  });

  it('(2) literal-with-merge: @click + r-on literal → R6 all-fire inline dispatcher', () => {
    const src = `${PROLOGUE}
<template>
  <button @click="f1" r-on="{ click: f2 }">go</button>
</template>
<script>
const f1 = () => undefined;
const f2 = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();
    expect(jsx).toContain('onClick=');
    expect(jsx).toContain('f1');
    expect(jsx).toContain('f2');
    expect(jsx).not.toContain('mergeListeners');
  });

  it('(3) literal modifier-bearing: r-on="{ \'click.stop\': fn }" → onClick with stopPropagation', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ 'click.stop': fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();
    expect(jsx).toContain('onClick=');
    expect(jsx).toContain('stopPropagation');
  });

  it('(4) dynamic no-merge: r-on="someObj" → {...normalizeListeners(someObj)}', () => {
    const src = `${PROLOGUE}
<data>
const someObj = {};
</data>
<template>
  <button r-on="someObj">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();
    expect(jsx).toContain('{...normalizeListeners(');
    expect(jsx).not.toContain('mergeListeners');
    expect(code).toContain("from '@rozie/runtime-solid'");
    expect(code).toMatch(/import\s*\{[^}]*\bnormalizeListeners\b/);
  });

  it('(5) dynamic with-merge: @click + r-on dynamic → mergeListeners(...) runtime call', () => {
    const src = `${PROLOGUE}
<data>
const someObj = {};
</data>
<template>
  <button @click="f1" r-on="someObj">go</button>
</template>
<script>
const f1 = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();
    expect(jsx).toContain('mergeListeners(');
    expect(jsx).toContain('normalizeListeners(someObj)');
    expect(jsx).toContain('onClick:');
    expect(code).toMatch(/import\s*\{[^}]*\bmergeListeners\b/);
    expect(code).toMatch(/import\s*\{[^}]*\bnormalizeListeners\b/);
  });

  it('(6) bare $listeners (D-19 exempt): r-on="$listeners" → {...$listeners}', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="$listeners">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();
    expect(jsx).toContain('{...$listeners}');
    expect(jsx).not.toContain('normalizeListeners');
    expect(jsx).not.toContain('mergeListeners');
  });

  it('(7) bare $listeners + @click (R6 + D-19): mergeListeners({ onClick: ... }, $listeners)', () => {
    const src = `${PROLOGUE}
<template>
  <button @click="f1" r-on="$listeners">go</button>
</template>
<script>
const f1 = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();
    expect(jsx).toContain('mergeListeners(');
    expect(jsx).toContain('$listeners');
    expect(jsx).toContain('onClick:');
    expect(jsx).not.toContain('normalizeListeners($listeners)');
  });
});
