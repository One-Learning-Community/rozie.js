/**
 * Plan 15-03 Task 2 — React `ListenerSpreadIR` emitter (D-08 hybrid + R6
 * all-fire merge + D-19 $listeners exemption).
 *
 * The `r-on="<expr>"` directive lowers to a `ListenerSpreadIR` on
 * `TemplateElementIR.listenerSpreads`. The Phase 15 hybrid:
 *
 *   - LITERAL `r-on="{ click: fn }"` → per-key compile-time emit
 *     (`onClick={fn}`). Modifier-bearing keys (`r-on="{ 'click.stop': fn }"`)
 *     route through the existing per-target modifier-pipeline emit.
 *   - DYNAMIC `r-on="someObj"`  → `{...normalizeListeners(someObj)}` + the
 *     runtime import is collected.
 *   - bare `r-on="$listeners"`   → `{...$listeners}` D-19 exempt — no
 *     normalizeListeners wrap (consumer JSX already carries target-native
 *     keys).
 *
 * R6 all-fire source-order merge — when multiple handlers bind the SAME
 * event on the same element (`@click` + `r-on="{ click: f2 }"`, or two
 * `r-on` spreads): ALL fire in source order. Two compilation paths:
 *
 *   - All-literal (every source statically knowable): inline arrow
 *     dispatcher `onClick={($event) => { f1($event); f2($event); }}` at
 *     compile time, zero runtime cost.
 *   - Mixed or dynamic: single runtime `{...mergeListeners(...)}` call
 *     collapses all collisions into source-order dispatchers.
 *
 * Bare `$listeners` participates in the merge: `@click="f1" r-on="$listeners"`
 * emits `{...mergeListeners({ onClick: ($event) => { f1($event); } },
 * $listeners)}` — D-19 keeps $listeners unwrapped, R6 keeps both firing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../../emitReact.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../../..');

// SAFETY: the test-time TS `--noEmit` typecheck does not run on these
// inline-source fixtures, so we keep them syntactically minimal. The IR
// path uses the same parse → lowerToIR → emit pipeline production uses.

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitReact(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the JSX returned by the emitted component — paren-balanced text
 * between `return (` and the matching `);`. Lazy substring matching gives
 * wrong answers for nested `)` characters inside arrow dispatchers, so this
 * uses a proper paren-depth scan.
 */
function extractJsx(emitted: string): string {
  const start = emitted.search(/return\s*\(/);
  if (start < 0) return emitted;
  // Advance past `return ( `
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

describe('emitTemplateAttribute (React) — ListenerSpreadIR (Plan 15-03)', () => {
  // Suppress the synthesized auto-fallthrough so each test isolates the
  // explicit r-on behavior under test. The default `inherit-listeners=true`
  // appends an extra synthesized $listeners spread that would noise up
  // these focused snapshots — the auto-synth shape is covered by the
  // existing emitTemplate.test.ts fixtures (Counter, SearchInput, …).
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
    // Substantive assertions.
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
    // R6 all-fire: BOTH f1 and f2 reachable; inline dispatcher form; no
    // runtime mergeListeners (this is the all-literal compile-time path).
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
    // The modifier pipeline runs through the same per-target emit path used
    // by @click.stop — `stopPropagation()` must appear in the dispatcher body.
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
    expect(code).toContain("import { normalizeListeners } from '@rozie/runtime-react'");
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
    // The runtime imports MUST be collected.
    expect(code).toContain("mergeListeners");
    expect(code).toContain("normalizeListeners");
  });

  it('(6) bare $listeners (D-19 exempt): r-on="$listeners" → {...attrs}', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="$listeners">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();
    // D-19 exempt — no normalizeListeners wrap, no mergeListeners wrap.
    // Phase 15-06 — the bare `$listeners` Identifier is rewritten to
    // `attrs` at template-expression rewrite time (mirror of `$attrs` —
    // both resolve to the splitProps-style rest binding). The emitted
    // JSX spreads `attrs`, NOT `$listeners` literally. This closes the
    // react-typecheck TS2304 (Cannot find name '$listeners') failure.
    expect(jsx).toContain('{...attrs}');
    expect(jsx).not.toContain('$listeners');
    expect(jsx).not.toContain('normalizeListeners');
    expect(jsx).not.toContain('mergeListeners');
  });

  it('(7) bare $listeners + @click (R6 + D-19): mergeListeners({ onClick: ... }, attrs)', () => {
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
    // R6 + D-19 — mergeListeners runs; `$listeners` is rewritten to
    // `attrs` at template-expression rewrite time. The emitted JSX
    // merges `{ onClick: ... }` with `attrs` (NOT `$listeners`).
    expect(jsx).toContain('mergeListeners(');
    expect(jsx).toContain('attrs');
    expect(jsx).toContain('onClick:');
    expect(jsx).not.toContain('$listeners');
    expect(jsx).not.toContain('normalizeListeners(attrs)');
  });
});
