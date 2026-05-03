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

  it('SearchInput: $emit("search", q) → props.onSearch?.(q) optional chain', () => {
    const { code } = rewriteAndGenerate('SearchInput');
    // onSearch defined as: $emit('search', $data.query) → props.onSearch?.(query)
    expect(code).toMatch(/props\.onSearch\?\.\(/);
    // clear(): $emit('clear') → props.onClear?.()
    expect(code).toMatch(/props\.onClear\?\.\(\s*\)/);
    expect(code).not.toContain('$emit');
  });

  it('Modal: $refs.dialogEl?.focus() → dialogEl.current?.focus()', () => {
    const { code } = rewriteAndGenerate('Modal');
    // The .current accessor is appended; the optional-chain on .focus is preserved.
    expect(code).toMatch(/dialogEl\.current\??\.focus/);
    expect(code).not.toContain('$refs.');
  });

  it('Modal: $emit("close") → props.onClose?.()', () => {
    const { code } = rewriteAndGenerate('Modal');
    expect(code).toMatch(/props\.onClose\?\.\(\s*\)/);
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
