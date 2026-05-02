// Phase 3 Plan 02 Task 1 (TDD RED) — rewriteRozieIdentifiers tests.
//
// Implements RESEARCH.md Pattern 2 (lines 307-395) + Pitfall 4 (lines 720-728)
// + D-31 (model-prop split) + D-32 (per-decl ref) + DX-03 console preservation.
//
// `rewriteRozieIdentifiers(program, ir, diagnostics)` walks a CLONED Babel
// Program (callers MUST clone first via cloneScriptProgram). It rewrites:
//   - $props.value (model)        → value.value
//   - $props.step  (non-model)    → props.step
//   - $data.hovering              → hovering.value
//   - $refs.foo                   → fooRef.value     (per Pitfall 4)
//   - $emit('foo', x)             → emit('foo', x)
//   - bare reads of computed-name → name.value       (e.g. `if (canIncrement)` → `if (canIncrement.value)`)
//
// $onMount/$onUnmount/$onUpdate calls are NOT mutated by this pass — Task 2's
// emitScript consumes them STRUCTURALLY from ir.lifecycle and skips the matching
// statements in the residual-script-body emit.
//
// console.log calls survive byte-identical (no MemberExpression match against
// $-prefixed objects). DX-03 trust-erosion floor.
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
import type { IRComponent, RefDecl, StateDecl } from '../../../../core/src/ir/types.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';

// CJS interop normalization for @babel/generator default export.
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

function lowerExample(name: string): { ir: IRComponent } {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return { ir: lowered.ir };
}

function rewriteAndGenerate(name: string): { code: string; diagnostics: Diagnostic[] } {
  const { ir } = lowerExample(name);
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);
  const diagnostics: Diagnostic[] = [];
  rewriteRozieIdentifiers(cloned, ir, diagnostics);
  const code = generate(cloned).code;
  return { code, diagnostics };
}

describe('rewriteRozieIdentifiers', () => {
  it('Test 3: Counter $props.value + $props.step <= $props.max → value.value + props.step <= props.max', () => {
    const { code } = rewriteAndGenerate('Counter');
    // canIncrement body
    expect(code).toMatch(/value\.value\s*\+\s*props\.step\s*<=\s*props\.max/);
    // canDecrement body
    expect(code).toMatch(/value\.value\s*-\s*props\.step\s*>=\s*props\.min/);
    // No raw $props.* in output
    expect(code).not.toContain('$props.');
  });

  it('Test 4: Counter has no $data references in script (all reads/writes are in <template>)', () => {
    // Counter's <data>{hovering:false} reads/writes happen in the <template>
    // (via @mouseenter / @mouseleave / :class). The <script> never touches $data,
    // so we use a synthetic IR for this assertion via SearchInput which writes $data.query.
    const { code } = rewriteAndGenerate('SearchInput');
    // SearchInput: `$data.query = ''` and `$emit('search', $data.query)`
    expect(code).toMatch(/query\.value\s*=\s*''/);
    expect(code).not.toContain('$data.');
  });

  it('Test 5: SearchInput $emit(...) → emit(...)', () => {
    const { code } = rewriteAndGenerate('SearchInput');
    expect(code).toMatch(/emit\s*\(\s*['"]search['"]/);
    expect(code).toMatch(/emit\s*\(\s*['"]clear['"]/);
    expect(code).not.toContain('$emit');
  });

  it('Test 6: Template-ref name collision with <data>/<computed>/<props> emits ROZ420', () => {
    // Fabricate a synthetic IR where state name "foo" collides with a template ref "foo".
    const syntheticIR: Partial<IRComponent> & {
      props: IRComponent['props'];
      state: IRComponent['state'];
      computed: IRComponent['computed'];
      refs: IRComponent['refs'];
    } = {
      type: 'IRComponent',
      name: 'Synthetic',
      props: [],
      state: [
        {
          type: 'StateDecl',
          name: 'foo',
          initializer: t.numericLiteral(0),
          sourceLoc: { start: 0, end: 0 },
        } satisfies StateDecl,
      ],
      computed: [],
      refs: [
        {
          type: 'RefDecl',
          name: 'foo',
          elementTag: 'div',
          sourceLoc: { start: 10, end: 20 },
        } satisfies RefDecl,
      ],
      slots: [],
      emits: [],
      lifecycle: [],
      listeners: [],
    };
    const program = t.file(t.program([], [], 'module'));
    const diagnostics: Diagnostic[] = [];
    rewriteRozieIdentifiers(program, syntheticIR as IRComponent, diagnostics);
    const collisionDiag = diagnostics.find((d) => d.code === 'ROZ420');
    expect(collisionDiag).toBeDefined();
    expect(collisionDiag!.severity).toBe('error');
    expect(collisionDiag!.message).toMatch(/foo/);
  });

  it('Test 6b: $refs.dialogEl in Modal rewrites to dialogElRef.value', () => {
    const { code } = rewriteAndGenerate('Modal');
    // Modal: `$refs.dialogEl?.focus()` → `dialogElRef.value?.focus()`
    expect(code).toMatch(/dialogElRef\.value\??\.focus/);
    expect(code).not.toContain('$refs.');
  });

  it('Test 7: console.log in <script> survives byte-identical through clone+rewrite', () => {
    // Synthetic source: a console.log + $props.value rewrite mixed together.
    const src = `
const x = 1;
console.log("hello from rozie");
const y = $props.value + 2;
`;
    const program = babelParse(src, {
      sourceType: 'module',
      attachComment: true,
    });
    // Synthetic IR: value is a non-model prop (so $props.value → props.value).
    const syntheticIR: Partial<IRComponent> & {
      props: IRComponent['props'];
      state: IRComponent['state'];
      computed: IRComponent['computed'];
      refs: IRComponent['refs'];
    } = {
      type: 'IRComponent',
      name: 'Synth',
      props: [
        {
          type: 'PropDecl',
          name: 'value',
          typeAnnotation: { kind: 'identifier', name: 'Number' },
          defaultValue: null,
          isModel: false,
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      state: [],
      computed: [],
      refs: [],
      slots: [],
      emits: [],
      lifecycle: [],
      listeners: [],
    };
    const diagnostics: Diagnostic[] = [];
    rewriteRozieIdentifiers(program, syntheticIR as IRComponent, diagnostics);
    const out = generate(program).code;
    expect(out).toContain('console.log("hello from rozie")');
    expect(out).toMatch(/props\.value\s*\+\s*2/);
  });

  it('Test 8: $onMount/$onUnmount/$onUpdate CallExpressions are NOT mutated by this pass', () => {
    const { code } = rewriteAndGenerate('Modal');
    // Modal has $onMount(lockScroll), $onUnmount(unlockScroll), and $onMount(arrow).
    // These remain literal $onMount/$onUnmount in the rewritten clone — the pass
    // doesn't strip them. Task 2's emitScript consumes them STRUCTURALLY from
    // ir.lifecycle and emits onMounted/onBeforeUnmount instead.
    expect(code).toContain('$onMount');
    expect(code).toContain('$onUnmount');
  });

  it('Test 9 (additional): bare computed-name read inside script gets `.value` appended', () => {
    // Counter's `if (canIncrement)` should rewrite to `if (canIncrement.value)`
    // because `canIncrement` is a $computed, which lowers to `computed(()=>...)`
    // returning a Ref. Read-side requires .value in <script>.
    const { code } = rewriteAndGenerate('Counter');
    expect(code).toMatch(/if\s*\(\s*canIncrement\.value\s*\)/);
    expect(code).toMatch(/if\s*\(\s*canDecrement\.value\s*\)/);
  });

  it('Test 10 (additional): write to $props.value (model) rewrites to value.value = ...', () => {
    // Counter increment: `$props.value += $props.step` → `value.value += props.step`
    const { code } = rewriteAndGenerate('Counter');
    expect(code).toMatch(/value\.value\s*\+=\s*props\.step/);
    expect(code).toMatch(/value\.value\s*-=\s*props\.step/);
  });
});
