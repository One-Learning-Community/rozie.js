// Plan 04-02 Task 2 — hoistModuleLet behavior tests.
//
// Spike outcome (04-02-SPIKE.md): Modal.rozie's `let savedBodyOverflow = ''`
// is reachable via `lockScroll`/`unlockScroll` (top-level helpers passed
// directly to $onMount/$onUnmount as Identifiers) — category (b) ONE-LEVEL
// HELPER → AUTO-HOIST.
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
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { hoistModuleLet } from '../rewrite/hoistModuleLet.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function lowerExample(name: string): IRComponent {
  const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

describe('hoistModuleLet', () => {
  it('Test 1 (happy path): Modal `let savedBodyOverflow = ""` auto-hoisted via lockScroll/unlockScroll → ROZ522 + .current rewrite', () => {
    const ir = lowerExample('Modal');
    const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

    const { hoisted, diagnostics } = hoistModuleLet(cloned, ir);

    expect(hoisted).toHaveLength(1);
    const inst = hoisted[0]!;
    expect(inst.name).toBe('savedBodyOverflow');
    // Initial expression is the empty string literal.
    expect(t.isStringLiteral(inst.initialExpr)).toBe(true);
    if (t.isStringLiteral(inst.initialExpr)) {
      expect(inst.initialExpr.value).toBe('');
    }

    // ROZ522 diagnostic emitted as advisory (severity warning).
    const roz522 = diagnostics.find((d) => d.code === 'ROZ522');
    expect(roz522).toBeDefined();
    expect(roz522!.severity).toBe('warning');

    // Module-let declaration removed from cloned Program top level.
    const stillHasLet = cloned.program.body.some(
      (s) =>
        t.isVariableDeclaration(s) &&
        s.kind === 'let' &&
        s.declarations.some(
          (d) => t.isIdentifier(d.id) && d.id.name === 'savedBodyOverflow',
        ),
    );
    expect(stillHasLet).toBe(false);

    // Inside lockScroll's body, references to `savedBodyOverflow` are now
    // `savedBodyOverflow.current`.
    const code = generate(cloned).code;
    expect(code).toContain('savedBodyOverflow.current');
    // The bare write `savedBodyOverflow = X` should now be `.current = X`
    expect(code).toMatch(/savedBodyOverflow\.current\s*=/);
    // The bare read should be `savedBodyOverflow.current`.
    expect(code).toMatch(/=\s*savedBodyOverflow\.current/);
  });

  it('Test 2 (false-positive guard): module-let NOT referenced from any lifecycle is left alone', () => {
    // Synthetic: program with a top-level `let X = 1` that no helper references.
    const src = `
let untouched = 1;
const helper = () => {
  return 42;
};
$onMount(helper);
`;
    const program = babelParse(src, { sourceType: 'module' });
    const syntheticIR: IRComponent = {
      type: 'IRComponent',
      name: 'Synth',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: [],
      emits: [],
      lifecycle: [
        {
          type: 'LifecycleHook',
          phase: 'mount',
          setup: t.identifier('helper'),
          setupDeps: [],
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      listeners: [],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: null,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    };
    const { hoisted, diagnostics } = hoistModuleLet(program, syntheticIR);
    expect(hoisted).toHaveLength(0);
    expect(diagnostics).toHaveLength(0);
    // The `let untouched` decl remains.
    const out = generate(program).code;
    expect(out).toContain('let untouched');
  });

  it('Test 3 (deeply-nested): when a let is referenced via 2-level helper indirection it is NOT auto-hoisted (conservative)', () => {
    // Synthetic: let X referenced inside `helperA`, `helperA` called from
    // `helperB`, and `helperB` is the lifecycle setup. Per the spike
    // pseudocode the conservative rule covers (a) and (b) only — deeper
    // chains fall through with no hoist + no diag (Plan 04-04 may add
    // ROZ523 promotion for this in a follow-up).
    const src = `
let nested = 0;
const helperA = () => { nested = 1; };
const helperB = () => { helperA(); };
$onMount(helperB);
`;
    const program = babelParse(src, { sourceType: 'module' });
    const syntheticIR: IRComponent = {
      type: 'IRComponent',
      name: 'Synth',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: [],
      emits: [],
      lifecycle: [
        {
          type: 'LifecycleHook',
          phase: 'mount',
          setup: t.identifier('helperB'),
          setupDeps: [],
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      listeners: [],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: null,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    };
    const { hoisted } = hoistModuleLet(program, syntheticIR);
    // Conservative — helperB references no let directly, helperA does but
    // helperA isn't a lifecycle setup. So `nested` stays untouched.
    expect(hoisted).toHaveLength(0);
    const out = generate(program).code;
    expect(out).toContain('let nested');
  });
});
