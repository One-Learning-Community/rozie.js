// Plan 02-02 Task 1 — live tests for unknownRefValidator (SEM-01).
//
// Emits ROZ100..ROZ106 when $props/$data/$refs/$slots references resolve to
// nothing in the BindingsTable, when lifecycle hooks appear inside nested
// functions (not Program top level), when async $onMount returns a function,
// or when $props['foo'] computed access is used.
//
// Also exercises analyzeAST(ast) coordinator: returns { bindings, diagnostics }
// and never throws (D-08).
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { analyzeAST } from '../../src/semantic/analyze.js';
import type { RozieAST } from '../../src/ast/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function analyzeSource(source: string, filename = 'test.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  const result = analyzeAST(ast);
  return { ast, parseDiags, ...result };
}

function filterByCode(diags: { code: string }[], code: string) {
  return diags.filter((d) => d.code === code);
}

function filterByCodeRange(diags: { code: string }[], lo: number, hi: number) {
  return diags.filter((d) => {
    const m = d.code.match(/^ROZ(\d{3})$/);
    if (!m) return false;
    const n = Number(m[1]);
    return n >= lo && n <= hi;
  });
}

describe('analyzeAST coordinator (Plan 02-02 Task 1)', () => {
  it('returns { bindings, diagnostics } shape', () => {
    const { ast } = analyzeSource(loadExample('Counter'));
    const result = analyzeAST(ast);
    expect(result.bindings).toBeDefined();
    expect(result.bindings.props).toBeInstanceOf(Map);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('does NOT throw on a malformed AST (empty wrapper) — D-08 collected-not-thrown', () => {
    const ast: RozieAST = {
      type: 'RozieAST',
      name: '',
      loc: { start: 0, end: 0 },
      props: null,
      data: null,
      script: null,
      listeners: null,
      template: null,
      style: null,
    };
    expect(() => analyzeAST(ast)).not.toThrow();
    const result = analyzeAST(ast);
    expect(result.bindings).toBeDefined();
    expect(result.diagnostics).toEqual([]);
  });

  it('all 5 reference examples produce zero ROZ100..ROZ199 diagnostics', () => {
    for (const name of ['Counter', 'Dropdown', 'Modal', 'SearchInput', 'TodoList']) {
      const { diagnostics } = analyzeSource(loadExample(name), `${name}.rozie`);
      const semDiags = filterByCodeRange(diagnostics, 100, 199);
      expect(
        semDiags,
        `${name}.rozie produced unexpected ROZ100..ROZ199 diagnostics: ${JSON.stringify(semDiags)}`,
      ).toEqual([]);
    }
  });
});

describe('unknownRefValidator — ROZ100..ROZ106', () => {
  it('Dropdown.rozie: zero ROZ100..ROZ199 (canonical positive)', () => {
    const { diagnostics } = analyzeSource(loadExample('Dropdown'), 'Dropdown.rozie');
    expect(filterByCodeRange(diagnostics, 100, 199)).toEqual([]);
  });

  it('emits ROZ100 for unknown $props.bogus reference in <script>', () => {
    const src = `<rozie name="X">
<props>{ value: { type: Number, default: 0 } }</props>
<script>
const x = $props.bogus + 1
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz100 = filterByCode(diagnostics, 'ROZ100');
    expect(roz100.length).toBe(1);
    expect(roz100[0]!.message).toContain('bogus');
    expect(roz100[0]!.loc.start).toBeGreaterThan(0);
    expect(roz100[0]!.loc.end).toBeGreaterThan(roz100[0]!.loc.start);
  });

  it('emits ROZ101 for unknown $data.bogus in <script>', () => {
    const src = `<rozie name="X">
<data>{ counter: 0 }</data>
<script>
const x = $data.bogus
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ101').length).toBe(1);
  });

  it('emits ROZ102 for unknown $refs.bogus in <script> (no template ref)', () => {
    const src = `<rozie name="X">
<script>
const x = $refs.bogus
</script>
<template><div ref="realRef"></div></template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz102 = filterByCode(diagnostics, 'ROZ102');
    expect(roz102.length).toBe(1);
    expect(roz102[0]!.message).toContain('bogus');
  });

  it('emits ROZ103 for unknown $slots.bogus reference', () => {
    const src = `<rozie name="X">
<template>
<div r-if="$slots.bogus">stuff</div>
<slot name="header"/>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz103 = filterByCode(diagnostics, 'ROZ103');
    expect(roz103.length).toBe(1);
    expect(roz103[0]!.message).toContain('bogus');
  });

  it('does NOT emit ROZ103 for default-slot ($slots[""]) references — empty-string slot is always valid', () => {
    const src = `<rozie name="X">
<template>
<div r-if="$slots['']">stuff</div>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    // Empty-string slot reference uses computed access ($slots[''] — ROZ106), but ROZ103 must NOT fire on member 'name'==''.
    expect(filterByCode(diagnostics, 'ROZ103').length).toBe(0);
  });

  it('emits ROZ104 for $onMount called inside a helper function (not Program top level)', () => {
    const src = `<rozie name="X">
<script>
function helper() {
  $onMount(() => { console.log('nested') })
}
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz104 = filterByCode(diagnostics, 'ROZ104');
    expect(roz104.length).toBe(1);
  });

  it('does NOT emit ROZ104 for $onMount at Program top level', () => {
    const src = `<rozie name="X">
<script>
$onMount(() => { console.log('top-level') })
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ104')).toEqual([]);
  });

  it('emits ROZ105 warning for $onMount(async () => { return cleanup })', () => {
    const src = `<rozie name="X">
<script>
$onMount(async () => {
  const cleanup = () => {}
  return cleanup
})
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz105 = filterByCode(diagnostics, 'ROZ105');
    expect(roz105.length).toBe(1);
    expect(roz105[0]!.severity).toBe('warning');
  });

  it('emits ROZ106 for computed access $props["foo"]', () => {
    const src = `<rozie name="X">
<props>{ foo: { type: String, default: '' } }</props>
<script>
const x = $props['foo']
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz106 = filterByCode(diagnostics, 'ROZ106');
    expect(roz106.length).toBe(1);
  });

  it('Counter.rozie: $props.value reads do NOT emit ROZ100 (value IS declared)', () => {
    const { diagnostics } = analyzeSource(loadExample('Counter'), 'Counter.rozie');
    expect(filterByCode(diagnostics, 'ROZ100')).toEqual([]);
  });

  it('does NOT emit ROZ100 when local identifier shadows magic name in script', () => {
    // $props is Rozie's magic; user code shouldn't shadow it, but the validator should
    // only flag MEMBER access on the magic accessors, not on identifier reads.
    const src = `<rozie name="X">
<props>{ value: { type: Number, default: 0 } }</props>
<script>
const value = $props.value
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ100')).toEqual([]);
  });

  it('emits ROZ100 when listener `when` references unknown prop', () => {
    // Dropdown's `when: "$props.open && $props.closeOnOutsideClick"` — synthetic case
    // where `closeOnOutsideClick` is renamed to a typo in <props>.
    const src = `<rozie name="X">
<props>{ open: { type: Boolean, default: false, model: true } }</props>
<script>
const close = () => { $props.open = false }
</script>
<listeners>
{
  "document:click": {
    when: "$props.open && $props.bogusPropName",
    handler: close,
  },
}
</listeners>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz100 = filterByCode(diagnostics, 'ROZ100');
    expect(roz100.length).toBeGreaterThanOrEqual(1);
    expect(roz100.some((d) => d.message.includes('bogusPropName'))).toBe(true);
  });

  it('emits ROZ100 when template binding references unknown prop', () => {
    const src = `<rozie name="X">
<props>{ value: { type: Number, default: 0 } }</props>
<template>
<div :class="$props.bogus">x</div>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const roz100 = filterByCode(diagnostics, 'ROZ100');
    expect(roz100.length).toBe(1);
    expect(roz100[0]!.message).toContain('bogus');
  });
});
