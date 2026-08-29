// Phase 46 Plan 46-02 Task 2 — ROZ138 React stale-read validator (ITEM-4,
// D-03b/A3).
//
// Within ONE <script> function body, a read of `$data.x`/`$model.x`/`$props.x`
// that is dominated by (textually after) an earlier WRITE to the SAME key binds
// the PRE-write value on React (setState is async). The listbox combobox
// `onInput` — `$data.query = e.target.value; fireSearch($data.query)` — searched
// the stale query on React only; the other five targets assign synchronously.
// ROZ138 (warning) fires on the dominated read. Conservative SAME-BODY scan, no
// control-flow graph; false-positive-aware (A3). The validator NEVER throws on
// malformed input (D-08) and never mutates the AST.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import { runReactStaleReadValidator } from '../reactStaleReadValidator.js';
import type { RozieAST } from '../../../ast/types.js';

function parseOrThrow(source: string, filename = 'stale.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

function analyzeSource(source: string, filename = 'stale.rozie'): Diagnostic[] {
  return analyzeAST(parseOrThrow(source, filename)).diagnostics;
}

const roz138 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.REACT_STALE_READ);

describe('reactStaleReadValidator — ROZ138 (Phase 46 ITEM-4)', () => {
  it('fires on write-then-read of the same $data key in one function body', () => {
    const src = `<rozie name="X">
<data>{ query: '' }</data>
<script>
function onInput(e) {
  $data.query = e.target.value
  fireSearch($data.query)
}
function fireSearch(q) { return q }
</script>
<template><input @input="onInput" /></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
    expect(hits[0]!.code).toBe('ROZ138');
    expect(hits[0]!.message).toContain('query');
    expect(hits[0]!.message).toContain('React');
    expect(hits[0]!.loc.start).toBeGreaterThan(0);
  });

  it('fires on a $model write-then-read in one body', () => {
    const src = `<rozie name="X">
<props>{ value: { type: String, model: true } }</props>
<script>
function commit(v) {
  $model.value = v
  notify($props.value)
}
function notify(x) { return x }
</script>
<template><div></div></template>
</rozie>`;
    // The write is to $model.value; the read $props.value of the SAME key is
    // dominated by it (the $model/$props pair are the same reactive cell).
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('value');
  });

  it('does NOT fire on a read with NO preceding write to that key', () => {
    const src = `<rozie name="X">
<data>{ query: '' }</data>
<script>
function read() {
  return fireSearch($data.query)
}
function fireSearch(q) { return q }
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('does NOT fire when the write and read are DIFFERENT keys', () => {
    const src = `<rozie name="X">
<data>{ query: '', other: 0 }</data>
<script>
function onInput(e) {
  $data.query = e.target.value
  fireSearch($data.other)
}
function fireSearch(q) { return q }
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('does NOT fire when write and read are in SEPARATE function bodies', () => {
    const src = `<rozie name="X">
<data>{ query: '' }</data>
<script>
function setIt(e) { $data.query = e.target.value }
function readIt() { return fireSearch($data.query) }
function fireSearch(q) { return q }
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('does NOT fire on a read that comes BEFORE the write (not dominated)', () => {
    const src = `<rozie name="X">
<data>{ query: '' }</data>
<script>
function onInput(e) {
  const before = $data.query
  $data.query = e.target.value
}
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('never throws on a malformed AST (D-08)', () => {
    const ast = parseOrThrow(`<rozie name="X">
<data>{ query: '' }</data>
<script>
function onInput(e) {
  $data.query = e.target.value
  fireSearch($data.query)
}
</script>
<template><div></div></template>
</rozie>`);
    const diagnostics: Diagnostic[] = [];
    expect(() => runReactStaleReadValidator(ast, diagnostics)).not.toThrow();
  });

  it('flags an arrow-function body too (not just function declarations)', () => {
    const src = `<rozie name="X">
<data>{ query: '' }</data>
<script>
const onInput = (e) => {
  $data.query = e.target.value
  fireSearch($data.query)
}
function fireSearch(q) { return q }
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
  });

  // ── quick-260829-8w1: control-flow narrowing (A) abrupt-completion and
  // (B) branch exclusivity, plus two positive controls that must NEVER stop
  // firing (R5's guard against the rejected "enclosing block contains the
  // read" shortcut, which would also zero these but silently). See
  // .planning/notes/roz138-triage.md for the corpus this is modelled on.

  it('SUPPRESS-A: does NOT fire when the only preceding write is in a branch that returns before the read (SortableList shape)', () => {
    const src = `<rozie name="X">
<data>{ liftedIndex: null }</data>
<script>
function onRowKeyDown(index) {
  if (index === null) {
    $data.liftedIndex = index
    return
  }
  const at = $data.liftedIndex
}
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('SUPPRESS-B: does NOT fire when the write is in the .consequent and the read is in the .alternate of the same IfStatement', () => {
    const src = `<rozie name="X">
<data>{ x: 0 }</data>
<script>
function onEvent(cond) {
  if (cond) {
    $data.x = 1
  } else {
    const y = $data.x
  }
}
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('CONTROL-A: STILL fires on the genuine conditional-write shape — write inside a non-abrupt if, read after it (R5 guard)', () => {
    const src = `<rozie name="X">
<data>{ x: 0 }</data>
<script>
function onEvent(cond) {
  if (cond) {
    $data.x = 1
  }
  use($data.x)
}
function use(v) { return v }
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
  });

  it('CONTROL-B: STILL fires on a same-arm write-then-read (R5 guard)', () => {
    const src = `<rozie name="X">
<data>{ x: 0 }</data>
<script>
function onEvent(cond) {
  if (cond) {
    $data.x = 1
    use($data.x)
  }
}
function use(v) { return v }
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz138(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
  });
});
