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
import { emitScript } from '../emit/emitScript.js';
import { emitVue } from '../emitVue.js';

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

  it('Test 6: a `ref="foo"` + `$data.foo` does NOT emit ROZ420 (lowers to the distinct `fooRef`)', () => {
    // Spike-012 R4-A — a Vue ref lowers to the SUFFIXED binding `<name>Ref`
    // (`$refs.foo` → `fooRef`), so `ref="foo"` + a `$data.foo` do not collide in
    // emitted output (`foo` = ref(), `fooRef` = the template ref). The historical
    // check tested the RAW name and falsely errored on this valid, working shape.
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
    expect(diagnostics.find((d) => d.code === 'ROZ420')).toBeUndefined();
  });

  it('Test 6-collision: a `ref="foo"` whose lowered `fooRef` binding DOES collide with `$data.fooRef` emits ROZ420', () => {
    // A ref "foo" lowers to `fooRef`; a `$data.fooRef` state ALSO emits a top-level
    // `fooRef` → a genuine emitted-output collision that must still fail loud.
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
          name: 'fooRef',
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
    expect(collisionDiag!.message).toMatch(/fooRef/);
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
          required: false,
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

// ---------------------------------------------------------------------------
// Quick task 260521-qsh — broad branch-coverage deepening for the Vue
// rewriteRozieIdentifiers. The example-fixture-driven tests above cover the
// happy paths; the synthetic-IR describe blocks below drive the remaining
// branches: refLowersToNonNull (all four arms), OptionalMemberExpression
// sigil twins, the $slots / $portals / $snapshot / $el handlers, the
// bare-computed-name parent-position skip ladder, and the TS type-position
// guard. Mirrors the synthetic-IR test style landed by 260521-tdt in the
// svelte target's rewriteScript.test.ts.
// ---------------------------------------------------------------------------

function buildIR(overrides: Partial<IRComponent> = {}): IRComponent {
  return {
    type: 'IRComponent',
    name: 'TestComponent',
    props: [],
    state: [],
    computed: [],
    refs: [],
    emits: [],
    slots: [],
    lifecycle: [],
    listeners: [],
    ...overrides,
  } as IRComponent;
}

function mkProp(name: string, isModel: boolean): IRComponent['props'][number] {
  return {
    type: 'PropDecl',
    name,
    typeAnnotation: { kind: 'identifier', name: 'String' },
    defaultValue: null,
    isModel,
    required: false,
    sourceLoc: { start: 0, end: 0 },
  } as IRComponent['props'][number];
}
function mkState(name: string): IRComponent['state'][number] {
  return {
    type: 'StateDecl',
    name,
    initializer: t.numericLiteral(0),
    sourceLoc: { start: 0, end: 0 },
  } as IRComponent['state'][number];
}
function mkRef(name: string): RefDecl {
  return { type: 'RefDecl', name, elementTag: 'div', sourceLoc: { start: 0, end: 0 } };
}
function mkComputed(name: string): IRComponent['computed'][number] {
  return {
    type: 'ComputedDecl',
    name,
    body: t.numericLiteral(1),
    deps: [],
    sourceLoc: { start: 0, end: 0 },
  } as IRComponent['computed'][number];
}
function mkSlot(name: string, isPortal = false): IRComponent['slots'][number] {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'always',
    nestedSlots: [],
    ...(isPortal ? { isPortal: true, portalParamNames: [] } : {}),
    sourceLoc: { start: 0, end: 0 },
  } as IRComponent['slots'][number];
}

/** Parse a script body, rewrite, generate. Returns code + diagnostics + result. */
function rewrite(
  src: string,
  ir: IRComponent,
  plugins: ('typescript' | 'jsx')[] = [],
): { code: string; diagnostics: Diagnostic[]; slotsUsed: boolean; usesDeepClone: boolean } {
  const program = babelParse(src, { sourceType: 'module', plugins });
  const diagnostics: Diagnostic[] = [];
  const result = rewriteRozieIdentifiers(program, ir, diagnostics);
  return {
    code: generate(program).code,
    diagnostics,
    slotsUsed: result.slotsUsed,
    usesDeepClone: result.usesDeepClone,
  };
}

describe('rewriteRozieIdentifiers — MemberExpression sigil rewrites (synthetic IR)', () => {
  it('$props.X (model) → X.value', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('const a = $props.value;', ir).code).toContain('value.value');
  });

  it('$props.X (non-model) → props.X', () => {
    const ir = buildIR({ props: [mkProp('step', false)] });
    expect(rewrite('const a = $props.step;', ir).code).toContain('props.step');
  });

  it('$props.X (unknown prop name) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('known', true)] });
    expect(rewrite('const a = $props.mystery;', ir).code).toContain('$props.mystery');
  });

  it('$data.X → X.value', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('const a = $data.count;', ir).code).toContain('count.value');
  });

  it('$data.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [mkState('known')] });
    expect(rewrite('const a = $data.unknown;', ir).code).toContain('$data.unknown');
  });

  it('computed-member access ($props["x"]) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('x', true)] });
    expect(rewrite("const a = $props['x'];", ir).code).toContain("$props['x']");
  });

  it('a non-sigil object name passes through', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('const a = whatever.value;', ir).code).toContain('whatever.value');
  });

  it('member expression whose object is not an identifier passes through', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('const a = makeIt().count;', ir).code).toContain('makeIt().count');
  });
});

describe('rewriteRozieIdentifiers — refLowersToNonNull (synthetic IR)', () => {
  it('bare $refs.X read → XRef.value (no non-null assertion)', () => {
    const ir = buildIR({ refs: [mkRef('panelEl')] });
    const { code } = rewrite('const el = $refs.panelEl;', ir);
    expect(code).toContain('panelElRef.value');
    expect(code).not.toContain('panelElRef.value!');
  });

  it('$refs.X as object of a non-optional member → XRef.value! ', () => {
    const ir = buildIR({ refs: [mkRef('dialogEl')] });
    expect(rewrite('$refs.dialogEl.focus();', ir).code).toContain(
      'dialogElRef.value!.focus()',
    );
  });

  it('$refs.X invoked directly as a call callee → XRef.value!', () => {
    const ir = buildIR({ refs: [mkRef('cleanup')] });
    expect(rewrite('$refs.cleanup();', ir).code).toContain('cleanupRef.value!()');
  });

  it('$refs.X as a function-call argument → XRef.value!', () => {
    const ir = buildIR({ refs: [mkRef('inputEl')] });
    expect(rewrite('flatpickr($refs.inputEl);', ir).code).toContain(
      'inputElRef.value!',
    );
  });

  it('$refs.X nested inside an object literal passed to a constructor → XRef.value!', () => {
    const ir = buildIR({ refs: [mkRef('editorEl')] });
    expect(rewrite('new Editor({ element: $refs.editorEl });', ir).code).toContain(
      'editorElRef.value!',
    );
  });

  it('$refs.X nested inside an array literal passed to a call → XRef.value!', () => {
    const ir = buildIR({ refs: [mkRef('hostEl')] });
    expect(rewrite('mountAll([$refs.hostEl]);', ir).code).toContain(
      'hostElRef.value!',
    );
  });

  it('$refs.X?.method() (author opted into optionality) stays optional → XRef.value', () => {
    const ir = buildIR({ refs: [mkRef('dialogEl')] });
    const { code } = rewrite('$refs.dialogEl?.focus();', ir);
    expect(code).toContain('dialogElRef.value');
    expect(code).not.toContain('dialogElRef.value!');
  });

  it('$refs.X (unknown ref name) is left untouched', () => {
    const ir = buildIR({ refs: [mkRef('known')] });
    expect(rewrite('const a = $refs.unknown;', ir).code).toContain('$refs.unknown');
  });
});

describe('rewriteRozieIdentifiers — $slots / $portals / $snapshot handlers', () => {
  it('$slots.X → slots.X and sets slotsUsed', () => {
    const ir = buildIR({ slots: [mkSlot('header')] });
    const { code, slotsUsed } = rewrite('if ($slots.header) doThing();', ir);
    expect(code).toContain('slots.header');
    expect(slotsUsed).toBe(true);
  });

  it('$slots.X for an unknown slot name leaves slotsUsed false', () => {
    const ir = buildIR({ slots: [mkSlot('header')] });
    const { code, slotsUsed } = rewrite('if ($slots.footer) doThing();', ir);
    expect(code).toContain('$slots.footer');
    expect(slotsUsed).toBe(false);
  });

  it('$portals.X (matching portal slot) → portals.X', () => {
    const ir = buildIR({ slots: [mkSlot('item', true)] });
    expect(rewrite('$portals.item(node, scope);', ir).code).toContain(
      'portals.item(node, scope)',
    );
  });

  it('$portals.X with no matching portal slot is left untouched', () => {
    const ir = buildIR({ slots: [mkSlot('item', true)] });
    expect(rewrite('$portals.other(node);', ir).code).toContain(
      '$portals.other(node)',
    );
  });

  it('$snapshot(x) → x (identity lowering)', () => {
    const ir = buildIR();
    expect(rewrite('const c = $snapshot(payload);', ir).code).toContain(
      'const c = payload',
    );
    expect(rewrite('const c = $snapshot(payload);', ir).code).not.toContain(
      '$snapshot',
    );
  });

  it('$snapshot with non-single args is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$snapshot(a, b);', ir).code).toContain('$snapshot(a, b)');
  });

  it('$snapshot with a spread (non-expression) argument is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('const c = $snapshot(...x);', ir).code).toContain(
      '$snapshot(...x)',
    );
  });

  it('a call whose callee is not an identifier passes through', () => {
    const ir = buildIR();
    expect(rewrite('obj.method();', ir).code).toContain('obj.method()');
  });

  // Phase 45-07 (WR-02/WR-06) — $clone(x) → rozieDeepClone(x) on Vue + the
  // runtime-vue import signal (usesDeepClone). The recursive de-proxy walk now
  // lives in the @rozie/runtime-vue helper (no top-level toRaw), bringing Vue to
  // parity with Svelte's `$state.snapshot` on nested INDEPENDENT reactive proxies.
  it('$clone(x) → rozieDeepClone(x) and sets usesDeepClone', () => {
    const ir = buildIR();
    const { code, usesDeepClone } = rewrite('const c = $clone(payload);', ir);
    expect(code).toContain('rozieDeepClone(payload)');
    expect(code).not.toContain('$clone');
    expect(code).not.toContain('toRaw');
    expect(usesDeepClone).toBe(true);
  });

  it('$clone($data.x) still lowers the argument reactive read (no path.skip)', () => {
    const ir = buildIR({ state: [mkState('graph')] });
    const { code } = rewrite('const c = $clone($data.graph);', ir);
    // rozieDeepClone wraps the rewritten Vue value form (graph.value), not the raw $data read.
    expect(code).toContain('rozieDeepClone(graph.value)');
    expect(code).not.toContain('$data.graph');
  });

  it('$clone with non-single args is left untouched and leaves usesDeepClone false', () => {
    const ir = buildIR();
    const { code, usesDeepClone } = rewrite('$clone(a, b);', ir);
    expect(code).toContain('$clone(a, b)');
    expect(usesDeepClone).toBe(false);
  });

  it('$clone with a spread (non-expression) argument is left untouched', () => {
    const ir = buildIR();
    const { code, usesDeepClone } = rewrite('const c = $clone(...x);', ir);
    expect(code).toContain('$clone(...x)');
    expect(usesDeepClone).toBe(false);
  });
});

describe('rewriteRozieIdentifiers — OptionalMemberExpression sigil branches', () => {
  it('$props?.X (model) → X?.value (optional chain preserved)', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('const a = $props?.value;', ir).code).toContain('value?.value');
  });

  it('$props?.X (non-model) → props.X', () => {
    const ir = buildIR({ props: [mkProp('step', false)] });
    expect(rewrite('const a = $props?.step;', ir).code).toContain('props');
  });

  it('$props?.X (unknown prop name) is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('const a = $props?.mystery;', ir).code).toContain(
      '$props?.mystery',
    );
  });

  it('$data?.X → X.value', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('const a = $data?.count;', ir).code).toContain('count');
  });

  it('$data?.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [mkState('known')] });
    expect(rewrite('const a = $data?.unknown;', ir).code).toContain(
      '$data?.unknown',
    );
  });

  it('$refs?.X (bare read) → XRef?.value (optional chain preserved)', () => {
    const ir = buildIR({ refs: [mkRef('panelEl')] });
    expect(rewrite('const el = $refs?.panelEl;', ir).code).toContain(
      'panelElRef?.value',
    );
  });

  it('$refs?.X flowing into a constructor argument → XRef.value!', () => {
    const ir = buildIR({ refs: [mkRef('inputEl')] });
    expect(rewrite('flatpickr($refs?.inputEl);', ir).code).toContain(
      'inputElRef.value!',
    );
  });

  it('$slots?.X → slots.X (sets slotsUsed)', () => {
    const ir = buildIR({ slots: [mkSlot('header')] });
    const { code, slotsUsed } = rewrite('const a = $slots?.header;', ir);
    expect(code).toContain('slots');
    expect(slotsUsed).toBe(true);
  });

  it('computed OptionalMember ($props?.[x]) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('x', true)] });
    expect(rewrite('const a = $props?.[k];', ir).code).toContain('$props?.[k]');
  });

  it('non-sigil OptionalMember object name is left untouched', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('const a = whatever?.value;', ir).code).toContain(
      'whatever?.value',
    );
  });

  it('OptionalMember whose object is not an identifier passes through', () => {
    const ir = buildIR();
    expect(rewrite('const a = makeIt()?.value;', ir).code).toContain(
      'makeIt()?.value',
    );
  });
});

describe('rewriteRozieIdentifiers — bare computed-name parent-position skip ladder', () => {
  it('bare $computed read → name.value', () => {
    const ir = buildIR({ computed: [mkComputed('canIncrement')] });
    expect(rewrite('if (canIncrement) doThing();', ir).code).toContain(
      'canIncrement.value',
    );
  });

  it('computed name in a VariableDeclarator id position is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    // `const total = ...` — `total` here is the declarator id, not a read.
    expect(rewrite('const total = 1;', ir).code).toContain('const total = 1');
  });

  it('computed name as a non-computed member property is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    expect(rewrite('const a = obj.total;', ir).code).toContain('obj.total');
  });

  it('computed name as a non-computed object-property shorthand key is left alone', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    // For v1 the shorthand `{ total }` is intentionally left unchanged.
    expect(rewrite('const o = { total };', ir).code).toContain('total');
  });

  it('computed name in a FunctionDeclaration id position is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    expect(rewrite('function total() {}', ir).code).toContain('function total()');
  });

  it('computed name in a function-parameter position is param-renamed by the deconflict pass, never `.value`-wrapped', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    // Phase 57: a param named after a `$computed` whose body reads it bare
    // (`(total) => total`) IS a genuine bare-ref shadow — the deconflict pass
    // renames the PARAM to `total$local`. The skip ladder's invariant is
    // preserved: the param identifier is NEVER `.value`-wrapped.
    const { code } = rewrite('const f = (total) => total;', ir);
    expect(code).toContain('total$local =>');
    expect(code).not.toContain('total.value');
  });

  it('computed name in an import specifier is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    const { code } = rewrite("import { total } from 'x';", ir);
    expect(code).toContain("import { total }");
  });

  it('computed name in an export specifier is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    const { code } = rewrite('const total = 1; export { total };', ir);
    expect(code).toContain('export { total }');
  });

  it('computed name used as a LabeledStatement label is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    // The label identifier sits in `LabeledStatement.label` — the
    // `isLabeledStatement(parent) && parent.label === node` guard skips it.
    const { code } = rewrite('total: { doThing(); }', ir);
    expect(code).toContain('total:');
  });

  it('a non-computed bare identifier is left untouched', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    expect(rewrite('if (somethingElse) doThing();', ir).code).toContain(
      'somethingElse',
    );
  });

  it('an already-wrapped `name.value` member is NOT double-wrapped', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    // A pre-existing `total.value` reference must not become `total.value.value`.
    const { code } = rewrite('const a = total.value;', ir);
    expect(code).not.toContain('total.value.value');
  });
});

describe('rewriteRozieIdentifiers — $el free read', () => {
  it('$el free read lowers via $refs.__rozieRoot → __rozieRootRef.value', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('const root = $el;', ir).code).toContain('__rozieRootRef.value');
  });

  it('$el as a VariableDeclarator id is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('let $el = computeIt();', ir).code).toContain('let $el =');
  });

  it('$el as a non-computed member property name is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('const v = obj.$el;', ir).code).toContain('obj.$el');
  });

  it('$el as a non-computed ObjectProperty key is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('const o = { $el: 1 };', ir).code).toContain('$el: 1');
  });

  it('$el occupying a function-parameter position is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('function handle($el) { doThing(); }', ir).code).toContain(
      'function handle($el)',
    );
  });

  it('$el free read inside a function body (NOT a param) DOES lower', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    // `() => $el` — `$el`'s parentPath is the arrow function but it is not in
    // `params`, so the `params.includes` guard's false arm falls through and
    // the free read lowers via $refs.__rozieRoot.
    expect(rewrite('const f = () => $el;', ir).code).toContain(
      '__rozieRootRef.value',
    );
  });

  it('$el inside a type position is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    const { code } = rewrite('let x: $el;', ir, ['typescript']);
    expect(code).toContain('$el');
  });
});

describe('rewriteRozieIdentifiers — TS type-position skip', () => {
  it('$data.X inside a `typeof` member-expression type query is left intact', () => {
    const ir = buildIR({ state: [mkState('foo')] });
    const { code } = rewrite('let x: typeof $data.foo;', ir, ['typescript']);
    expect(code).toContain('typeof $data.foo');
  });

  it('a computed-name identifier inside a type annotation is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('Total')] });
    // `let x: Total;` — `Total` is a type reference; isInTypePosition guards it.
    const { code } = rewrite('let x: Total;', ir, ['typescript']);
    expect(code).toContain(': Total');
    expect(code).not.toContain('Total.value');
  });
});

// Phase 45-07 (WR-02/WR-06) — emit-level proof that a `.rozie` using $clone
// lowers to `rozieDeepClone(x)` (emitScript flag usesDeepClone) and that emitVue
// threads `import { rozieDeepClone } from '@rozie/runtime-vue'` through the
// runtime-vue ScriptInjection dedupe path. No `toRaw` is emitted anymore.
describe('emitScript / emitVue — $clone rozieDeepClone wiring', () => {
  function lowerSource(src: string): IRComponent {
    const parsed = parse(src, { filename: 'CloneEmit.rozie' });
    if (!parsed.ast) throw new Error('parse returned null');
    const lowered = lowerToIR(parsed.ast, {
      modifierRegistry: createDefaultRegistry(),
    });
    if (!lowered.ir) throw new Error('lowerToIR returned null');
    return lowered.ir;
  }

  const SRC = `<rozie name="CloneEmit">
<data>
{ graph: { n: 0 }, cloned: null }
</data>
<script>
$onMount(() => {
  $data.cloned = $clone($data.graph)
})
</script>
<template>
<div r-if="$data.cloned">cloned</div>
</template>
</rozie>`;

  it('emitScript lowers $clone to rozieDeepClone and sets usesDeepClone (no toRaw)', () => {
    const { script, usesDeepClone } = emitScript(lowerSource(SRC));
    expect(script).toContain('rozieDeepClone(graph.value)');
    expect(script).not.toContain('structuredClone');
    expect(script).not.toContain('toRaw');
    expect(usesDeepClone).toBe(true);
  });

  it('emitVue threads `rozieDeepClone` in the `@rozie/runtime-vue` import line', () => {
    const { code } = emitVue(lowerSource(SRC), { filename: 'CloneEmit.rozie' });
    expect(code).toContain('rozieDeepClone(graph.value)');
    const runtimeImport = code
      .split('\n')
      .find((l) => l.includes("from '@rozie/runtime-vue'"));
    expect(runtimeImport).toBeDefined();
    expect(runtimeImport).toContain('rozieDeepClone');
    // No `toRaw` leaks into any `from 'vue'` line.
    const vueImport = code.split('\n').find((l) => l.includes("from 'vue'"));
    if (vueImport) expect(vueImport).not.toContain('toRaw');
  });

  it('a .rozie NOT using $clone emits no rozieDeepClone import and leaves usesDeepClone false', () => {
    const noClone = SRC.replace('$clone($data.graph)', '$data.graph');
    const { script, usesDeepClone } = emitScript(lowerSource(noClone));
    expect(usesDeepClone).toBe(false);
    expect(script).not.toContain('rozieDeepClone');
    const { code } = emitVue(lowerSource(noClone), { filename: 'CloneEmit.rozie' });
    expect(code).not.toContain('rozieDeepClone');
  });
});
