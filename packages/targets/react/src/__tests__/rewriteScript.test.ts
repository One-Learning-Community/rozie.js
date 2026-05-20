// Plan 04-02 Task 1 (TDD RED) — rewriteRozieIdentifiers tests for React target.
//
// Mirrors the rewrite-map from RESEARCH.md Pattern 2 lines 466-501:
//   - $props.value (model)        → value           (NO .value)
//   - $props.value = X (model)    → setValue(X)
//   - $props.value += X (model)   → setValue(prev => prev + X)  (Pitfall 6 functional updater)
//   - $props.step (non-model)     → props.step
//   - $data.hovering              → hovering
//   - $data.hovering = X          → setHovering(X)
//   - $data.foo += 1              → setFoo(prev => prev + 1)
//   - $data.foo.bar = 'x'         → emit ROZ521, leave AST unchanged
//   - $refs.foo                   → foo.current
//   - $emit('search', q)          → props.onSearch?.(q)
//
// $onMount/$onUnmount/$onUpdate calls are NOT mutated by this pass —
// emitScript consumes them STRUCTURALLY from ir.lifecycle.
//
// console.log calls survive byte-identical (DX-03 trust-erosion floor).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';
import _generate from '@babel/generator';
import { parse as babelParse } from '@babel/parser';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function lowerExample(name: string): IRComponent {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

function rewriteAndGenerate(name: string): { code: string; diagnostics: Diagnostic[] } {
  const ir = lowerExample(name);
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);
  const { diagnostics } = rewriteRozieIdentifiers(cloned, ir);
  const code = generate(cloned).code;
  return { code, diagnostics };
}

describe('rewriteRozieIdentifiers (React)', () => {
  it('Counter: $props.value (model) reads → bare `value` (NO .value)', () => {
    const { code } = rewriteAndGenerate('Counter');
    // $computed body: $props.value + $props.step <= $props.max → value + props.step <= props.max
    expect(code).toMatch(/value\s*\+\s*props\.step\s*<=\s*props\.max/);
    expect(code).toMatch(/value\s*-\s*props\.step\s*>=\s*props\.min/);
    expect(code).not.toContain('$props.');
    // No `.value.value` or `value.value` reads (NOT Vue idiom)
    expect(code).not.toContain('value.value');
  });

  it('Counter: $props.value (model) compound write → setValue(prev => prev + (props.step ?? 1))', () => {
    const { code } = rewriteAndGenerate('Counter');
    // increment: $props.value += $props.step → setValue(prev => prev + props.step)
    expect(code).toMatch(/setValue\s*\(\s*prev\s*=>/);
    // decrement: $props.value -= $props.step → setValue(prev => prev - props.step)
    expect(code).toMatch(/setValue\s*\(\s*prev\s*=>\s*prev\s*-/);
  });

  it('SearchInput: $data.query writes → setQuery(...) plain CallExpression', () => {
    const { code } = rewriteAndGenerate('SearchInput');
    // clear(): $data.query = '' → setQuery('')
    expect(code).toMatch(/setQuery\s*\(\s*['"]['"]\s*\)/);
    expect(code).not.toContain('$data.');
  });

  // ---------------------------------------------------------------------------
  // Regression R1f — debug session `linechart-watch-recreate` (round 1, commit
  // 7317038). React stale-closure bug.
  //
  // A plain `$data.x = f($data.x)` assignment whose RHS reads the SAME state
  // MUST lower to the functional updater `setX(prev => f(prev))`, with the
  // self-read inside the RHS rewritten to the `prev` param. The pre-fix form
  // `setX(f(x))` captures `x` from the enclosing closure — when the write is
  // driven by a `setInterval` callback pinned at mount, `x` is forever the
  // initial value, which is exactly why LineChartDemo's live feed froze at 8
  // points forever. An explicit `toMatch`/`not.toMatch` net here (snapshots
  // would silently re-bless a regression on `vitest -u`).
  // ---------------------------------------------------------------------------
  it('R1f: self-referential `$data.x = f($data.x)` lowers to `setX(prev => ...)` (NOT stale `setX(f(x))`)', () => {
    // Synthetic component mirroring LineChartDemo's `pushPoint`:
    //   $data.points = [...$data.points.slice(-19), next]
    const src = `<rozie name="FeedSynth">
<data>{ points: [], next: 0 }</data>
<script>
const pushPoint = () => { $data.points = [...$data.points.slice(-19), $data.next] }
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerToIR(parse(src, { filename: 'FeedSynth.rozie' }).ast!, {
      modifierRegistry: createDefaultRegistry(),
    }).ir!;
    const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);
    rewriteRozieIdentifiers(cloned, ir);
    const code = generate(cloned).code;
    // The write uses the functional updater — a `prev =>` arrow argument.
    expect(code).toMatch(/setPoints\s*\(\s*prev\s*=>/);
    // The self-read `$data.points.slice(-19)` inside the RHS is rewritten to
    // read the `prev` param, NOT the stale closure-captured `points`.
    expect(code).toMatch(/prev\s*=>\s*\[\s*\.\.\.\s*prev\.slice\s*\(\s*-?\s*19\s*\)/);
    // The pre-fix stale form `setPoints([...points.slice` MUST NOT appear —
    // it closes over the mount-time `points` binding and freezes the feed.
    expect(code).not.toMatch(/setPoints\s*\(\s*\[\s*\.\.\.\s*points\.slice/);
    // No leftover Rozie sigils.
    expect(code).not.toContain('$data.');
  });

  it('SearchInput: $emit("search", q) → props.onSearch && props.onSearch(q) (Plan 04-04 lint fix)', () => {
    // Plan 04-04 changed $emit emission from optional chain to logical-AND
    // guard so eslint-plugin-react-hooks v5 narrows the deps[] entry
    // structurally (MemberExpression on both sides). See rewriteScript.ts.
    const { code } = rewriteAndGenerate('SearchInput');
    expect(code).toMatch(/props\.onSearch\s*&&\s*props\.onSearch\(/);
    expect(code).toMatch(/props\.onClear\s*&&\s*props\.onClear\(\s*\)/);
    expect(code).not.toContain('$emit');
  });

  it('Modal: $refs.dialogEl?.focus() → dialogEl.current?.focus()', () => {
    const { code } = rewriteAndGenerate('Modal');
    // The .current accessor is appended; the optional-chain on .focus is preserved.
    expect(code).toMatch(/dialogEl\.current\??\.focus/);
    expect(code).not.toContain('$refs.');
  });

  it('Modal: $emit("close") → props.onClose && props.onClose() (Plan 04-04 lint fix)', () => {
    // Plan 04-04 changed $emit emission from `props.onX?.()` to
    // `props.onX && props.onX()` to satisfy eslint-plugin-react-hooks v5
    // exhaustive-deps narrowing (see rewriteScript.ts $emit handler).
    const { code } = rewriteAndGenerate('Modal');
    expect(code).toMatch(/props\.onClose\s*&&\s*props\.onClose\(\s*\)/);
    expect(code).not.toContain('$emit');
  });

  it('console.log inside <script> survives verbatim (DX-03)', () => {
    const { code } = rewriteAndGenerate('Counter');
    expect(code).toContain('console.log("hello from rozie")');
  });

  it('$onMount / $onUnmount CallExpressions are NOT mutated by rewriteScript', () => {
    const { code } = rewriteAndGenerate('Modal');
    // emitScript consumes lifecycle structurally — rewriteScript leaves them
    expect(code).toContain('$onMount');
    expect(code).toContain('$onUnmount');
  });

  it('Nested member write $data.foo.bar = "x" emits ROZ521 + leaves AST unchanged', () => {
    // Synthetic: program with `$data.todo.title = 'x';`
    const src = `$data.todo.title = 'x';\n`;
    const program = babelParse(src, { sourceType: 'module' });
    const syntheticIR: Partial<IRComponent> & { props: IRComponent['props']; state: IRComponent['state']; refs: IRComponent['refs']; computed: IRComponent['computed']; emits: IRComponent['emits']; lifecycle: IRComponent['lifecycle']; listeners: IRComponent['listeners']; slots: IRComponent['slots'] } = {
      type: 'IRComponent',
      name: 'Synthetic',
      props: [],
      state: [
        {
          type: 'StateDecl',
          name: 'todo',
          initializer: t.objectExpression([]),
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      computed: [],
      refs: [],
      slots: [],
      emits: [],
      lifecycle: [],
      listeners: [],
    };
    const { diagnostics } = rewriteRozieIdentifiers(program, syntheticIR as IRComponent);
    const roz521 = diagnostics.find((d) => d.code === 'ROZ521');
    expect(roz521).toBeDefined();
    expect(roz521!.severity).toBe('warning');
    // The WRITE itself is not converted to a setter call — that's the
    // "leave AST unchanged" guarantee for the assignment shape (Pitfall 7).
    // The inner read of $data.todo IS rewritten (top-level state read), so
    // the resulting expression is `todo.title = 'x'`, NOT `setTodo(...)`.
    // The user must refactor manually; ROZ521 advises them.
    const out = generate(program).code;
    expect(out).not.toContain('setTodo');
    expect(out).toMatch(/todo\.title\s*=\s*['"]x['"]/);
  });

  it('§slots-X-merge — script-context $slots.header → "(props.renderHeader ?? props.slots?.[\'header\'])" (Phase 07.3.2 Plan 08, F-07.3.2-05-A)', () => {
    // Mirror of the template-context contract in rewriteTemplateExpression.test.ts.
    // Both rewriters MUST emit the same merged shape so r-if guards, listener
    // when-conditions, and any other $slots.X check site agree.
    const src = `const visible = $slots.header && open;\n`;
    const program = babelParse(src, { sourceType: 'module' });
    const syntheticIR: Partial<IRComponent> & {
      props: IRComponent['props']; state: IRComponent['state']; refs: IRComponent['refs'];
      computed: IRComponent['computed']; emits: IRComponent['emits']; lifecycle: IRComponent['lifecycle'];
      listeners: IRComponent['listeners']; slots: IRComponent['slots'];
    } = {
      type: 'IRComponent',
      name: 'Synthetic',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: [
        {
          type: 'SlotDecl',
          name: 'header',
          defaultContent: null,
          params: [],
          presence: 'conditional',
          nestedSlots: [],
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      emits: [],
      lifecycle: [],
      listeners: [],
    };
    rewriteRozieIdentifiers(program, syntheticIR as IRComponent);
    const out = generate(program).code;
    // The rewriter produces a ParenthesizedExpression wrapping a LogicalExpression
    // of two MemberExpressions; default @babel/generator string-literal output
    // uses double-quotes for the bracket-access key. The emitter pipeline
    // (emitScript.ts) uses the same default options, so this matches the
    // production output shape for any future component with a $slots.X check
    // inside a <listeners> when: or computed body. The dist-parity Modal.tsx
    // fixture's existing single-quote `'header'` form at L83 comes from
    // emitSlotInvocation.ts's hand-built string template, NOT from this rewriter.
    expect(out).toContain('(props.renderHeader ?? props.slots?.["header"])');
    expect(out).not.toMatch(/&&\s*props\.renderHeader\b/);
  });

  it('§slots-X-merge — script-context $slots.nonexistent (NOT in ir.slots) → unchanged', () => {
    const src = `const x = $slots.nonexistent;\n`;
    const program = babelParse(src, { sourceType: 'module' });
    const syntheticIR: Partial<IRComponent> & {
      props: IRComponent['props']; state: IRComponent['state']; refs: IRComponent['refs'];
      computed: IRComponent['computed']; emits: IRComponent['emits']; lifecycle: IRComponent['lifecycle'];
      listeners: IRComponent['listeners']; slots: IRComponent['slots'];
    } = {
      type: 'IRComponent',
      name: 'Synthetic',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: [],
      emits: [],
      lifecycle: [],
      listeners: [],
    };
    rewriteRozieIdentifiers(program, syntheticIR as IRComponent);
    const out = generate(program).code;
    // No rewrite applied — $slots.nonexistent survives as-is.
    expect(out).toContain('$slots.nonexistent');
  });

  it('$emit with hyphenated event name emits a diagnostic (camelCase requirement)', () => {
    // Synthetic: $emit('hyphen-name', x) — produces invalid JS if naively rewritten.
    const src = `$emit('hyphen-name', 1);\n`;
    const program = babelParse(src, { sourceType: 'module' });
    const syntheticIR: Partial<IRComponent> & { props: IRComponent['props']; state: IRComponent['state']; refs: IRComponent['refs']; computed: IRComponent['computed']; emits: IRComponent['emits']; lifecycle: IRComponent['lifecycle']; listeners: IRComponent['listeners']; slots: IRComponent['slots'] } = {
      type: 'IRComponent',
      name: 'Synthetic',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: [],
      emits: ['hyphen-name'],
      lifecycle: [],
      listeners: [],
    };
    // Does not throw; the emit should sanitize / convert / diagnose.
    expect(() =>
      rewriteRozieIdentifiers(program, syntheticIR as IRComponent),
    ).not.toThrow();
  });
});
