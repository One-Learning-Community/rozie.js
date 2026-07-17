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
import type { IRComponent, TemplateElementIR } from '../../../../core/src/ir/types.js';
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

    // ROZ522 diagnostic emitted as advisory (severity info).
    const roz522 = diagnostics.find((d) => d.code === 'ROZ522');
    expect(roz522).toBeDefined();
    expect(roz522!.severity).toBe('info');

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
      watchers: [],
      listeners: [],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: null,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    };
    const { hoisted, diagnostics } = hoistModuleLet(program, syntheticIR);
    expect(hoisted).toHaveLength(0);
    expect(diagnostics).toHaveLength(0);
    // The `let untouched` decl remains.
    const out = generate(program).code;
    expect(out).toContain('let untouched');
  });

  it('Test 4 (destructuring + shadowing): callback args that shadow a hoisted name via destructuring do NOT crash and do NOT incorrectly rewrite the inner local', () => {
    // Regression test (2026-05-17): TipTap.rozie shape — a vanilla-JS
    // engine that hands its event callback an object containing the
    // engine instance, which the wrapper destructures. The destructured
    // param shadows the wrapper's outer `let engine = null`, and the
    // rewriter used to (a) crash on the shorthand ObjectProperty inside
    // the ObjectPattern, then (b) once that was guarded, incorrectly
    // rewrite the body references to `engine.current` even though they
    // referred to the local destructured param.
    const src = `
let engine = null;
const setup = ($el) => {
  engine = new Engine($el, {
    onUpdate: ({ engine }) => {
      // \`engine\` here is the destructured param, NOT the module let.
      // Must stay bare; the outer module-let \`engine = ...\` write must
      // become \`engine.current = ...\`.
      const html = engine.getHTML();
      return html;
    },
  });
  return () => engine.destroy();
};
$onMount(setup);
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
          setup: t.identifier('setup'),
          setupDeps: [],
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      watchers: [],
      listeners: [],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: null,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    };
    // Must not throw on the shorthand-in-ObjectPattern.
    const { hoisted } = hoistModuleLet(program, syntheticIR);
    expect(hoisted).toHaveLength(1);
    expect(hoisted[0]!.name).toBe('engine');

    const out = generate(program).code;
    // Outer module-let write is rewritten.
    expect(out).toMatch(/engine\.current\s*=\s*new Engine/);
    // Outer module-let read in the cleanup return is rewritten.
    expect(out).toMatch(/engine\.current\.destroy\(\)/);
    // Destructured shorthand stays as a binding pattern (key only).
    // Babel may emit it across lines after the rewrite — match flexibly.
    expect(out).toMatch(/onUpdate:\s*\(\{\s*engine\s*\}\)\s*=>/);
    // Inside the callback, `engine.getHTML()` must NOT be rewritten — it
    // refers to the destructured local, not the module-let.
    expect(out).toMatch(/const html\s*=\s*engine\.getHTML\(\);/);
    expect(out).not.toMatch(/engine\.current\.getHTML/);
  });

  it('Test 5 (object-expression shorthand): `return { engine }` in value position is un-shorthanded and rewritten to `{ engine: engine.current }`', () => {
    // Companion case: when shorthand is used in VALUE position (an
    // ObjectExpression, not ObjectPattern), the rewriter must un-shorthand
    // and rewrite the value to preserve the reference semantics.
    const src = `
let engine = null;
const setup = ($el) => {
  engine = new Engine($el);
  return () => {
    const handle = { engine };
    handle.engine.destroy();
  };
};
$onMount(setup);
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
          setup: t.identifier('setup'),
          setupDeps: [],
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      watchers: [],
      listeners: [],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: null,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    };
    const { hoisted } = hoistModuleLet(program, syntheticIR);
    expect(hoisted).toHaveLength(1);
    const out = generate(program).code;
    // Value-position shorthand un-shorthanded and value rewritten.
    expect(out).toMatch(/\{\s*engine:\s*engine\.current\s*\}/);
  });

  it('Test 3 (deeply-nested): a let referenced via 2-level helper indirection IS auto-hoisted (Plan 04-04 transitive promotion)', () => {
    // Synthetic: let X referenced inside `helperA`, `helperA` called from
    // `helperB`, and `helperB` is the lifecycle setup. The pass now takes the
    // TRANSITIVE closure over the top-level helper call graph, so `nested`
    // (reached as $onMount → helperB → helperA → nested) hoists to `useRef`.
    // Before this promotion it stayed a per-render `let nested = 0` — reset to
    // 0 every render — which silently broke any closure that captured a later
    // render's copy (the live-read `$expose` undo-stack regression, 2026-06-18).
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
      watchers: [],
      listeners: [],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: null,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    };
    const { hoisted } = hoistModuleLet(program, syntheticIR);
    // Transitive: helperB calls helperA, which writes `nested` → the closure
    // reaches `nested`, so it hoists.
    expect(hoisted).toHaveLength(1);
    expect(hoisted[0]!.name).toBe('nested');
    const out = generate(program).code;
    // The `let nested = 0` declaration is removed (emitReact synthesises the
    // `useRef(0)`), and every reference is rewritten to `nested.current`.
    expect(out).not.toContain('let nested');
    expect(out).toMatch(/nested\.current\s*=\s*1/);
  });

  it('Test 6 (Phase 73 item #11-b, template-only reachability): a let mutated only inside a helper called from a TEMPLATE binding (never a hook/watcher/$expose) IS hoisted', () => {
    // Synthetic: sortable-list's real shape — `keyFor(item)` is called ONLY
    // from a `:key="keyFor(item)"` template binding (no lifecycle hook, no
    // watcher, no $expose verb references it). Before Phase 73 item #11-b
    // this fell through `classifyExpr` case (c) and stayed a per-render
    // `let __rowKeySeq = 0` — reset to 0 every React render.
    const src = `
let __rowKeySeq = 0;
const keyFor = (item) => {
  return '__rk' + __rowKeySeq++;
};
`;
    const program = babelParse(src, { sourceType: 'module' });
    const keyBinding = {
      kind: 'binding' as const,
      name: 'key',
      expression: t.callExpression(t.identifier('keyFor'), [t.identifier('item')]),
      deps: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const templateEl: TemplateElementIR = {
      type: 'TemplateElement',
      tagName: 'div',
      attributes: [keyBinding],
      events: [],
      listenerSpreads: [],
      children: [],
      sourceLoc: { start: 0, end: 0 },
      tagKind: 'html',
    };
    const syntheticIR: IRComponent = {
      type: 'IRComponent',
      name: 'Synth',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: [],
      emits: [],
      lifecycle: [],
      watchers: [],
      listeners: [],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: templateEl,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    } as IRComponent;
    const { hoisted } = hoistModuleLet(program, syntheticIR);
    expect(hoisted).toHaveLength(1);
    expect(hoisted[0]!.name).toBe('__rowKeySeq');
    const out = generate(program).code;
    expect(out).not.toContain('let __rowKeySeq');
    expect(out).toMatch(/__rowKeySeq\.current\+\+/);
  });

  it('Test 7 (false-positive guard): a let mutated only inside a helper NEVER reached from a hook, watcher, $expose, OR the template stays un-hoisted', () => {
    // Companion control for Test 6 — `keyFor` is declared but never CALLED
    // from anywhere reachable (no template, no hook). The let must be left
    // alone (conservative case (c), unchanged from pre-Phase-73 behavior).
    const src = `
let __rowKeySeq = 0;
const keyFor = (item) => {
  return '__rk' + __rowKeySeq++;
};
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
      lifecycle: [],
      watchers: [],
      listeners: [],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: null,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    } as IRComponent;
    const { hoisted } = hoistModuleLet(program, syntheticIR);
    expect(hoisted).toHaveLength(0);
    const out = generate(program).code;
    expect(out).toContain('let __rowKeySeq');
  });

  it('Test 8 (Quick 260717-8zb Task 3 Item 6): a let mutated only inside a helper called from a TEMPLATE @event HANDLER (never a hook/watcher/$expose/template-binding) IS hoisted', () => {
    // Synthetic: the toast/command-palette shape — `bump()` is called ONLY
    // from a `@click="bump()"` template EVENT handler (ir.listeners, NOT a
    // :key/:attr binding — Test 6 covers the binding shape). Before this fix
    // the reachability walker never scanned `ir.listeners`, so this fell
    // through classifyExpr case (c) and stayed a per-render `let counter = 0`
    // — reset to 0 on every React render (the toast pauseTimers/resumeTimers
    // + command-palette argsState claim).
    const src = `
let counter = 0;
const bump = () => {
  counter = counter + 1;
};
`;
    const program = babelParse(src, { sourceType: 'module' });
    const clickListener = {
      type: 'Listener' as const,
      target: { kind: 'self' as const, el: '$el' as const },
      event: 'click',
      modifierPipeline: [],
      when: null,
      handler: t.callExpression(t.identifier('bump'), []),
      deps: [],
      source: 'template-event' as const,
      sourceLoc: { start: 0, end: 0 },
    };
    const templateEl: TemplateElementIR = {
      type: 'TemplateElement',
      tagName: 'div',
      attributes: [],
      events: [clickListener],
      listenerSpreads: [],
      children: [],
      sourceLoc: { start: 0, end: 0 },
      tagKind: 'html',
    };
    const syntheticIR: IRComponent = {
      type: 'IRComponent',
      name: 'Synth',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: [],
      emits: [],
      lifecycle: [],
      watchers: [],
      listeners: [clickListener],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: templateEl,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    } as IRComponent;
    const { hoisted } = hoistModuleLet(program, syntheticIR);
    expect(hoisted).toHaveLength(1);
    expect(hoisted[0]!.name).toBe('counter');
    const out = generate(program).code;
    expect(out).not.toContain('let counter');
    expect(out).toMatch(/counter\.current\s*=\s*counter\.current\s*\+\s*1/);
  });

  it('Test 9 (false-positive guard): a let mutated only inside a helper called from a <listeners>-block handler is ALSO hoisted (same reachability root, different `source`)', () => {
    // The `source: 'listeners-block'` sibling of Test 8 — the fix scans
    // ir.listeners generally, not filtered to `template-event` only, so a
    // <listener> block handler gets the same reachability coverage.
    const src = `
let counter = 0;
const bump = () => {
  counter = counter + 1;
};
`;
    const program = babelParse(src, { sourceType: 'module' });
    const docListener = {
      type: 'Listener' as const,
      target: { kind: 'global' as const, name: 'document' as const },
      event: 'keydown',
      modifierPipeline: [],
      when: null,
      handler: t.callExpression(t.identifier('bump'), []),
      deps: [],
      source: 'listeners-block' as const,
      sourceLoc: { start: 0, end: 0 },
    };
    const syntheticIR: IRComponent = {
      type: 'IRComponent',
      name: 'Synth',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: [],
      emits: [],
      lifecycle: [],
      watchers: [],
      listeners: [docListener],
      setupBody: { type: 'SetupBody', scriptProgram: program, annotations: [] },
      template: null,
      styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      sourceLoc: { start: 0, end: 0 },
    } as IRComponent;
    const { hoisted } = hoistModuleLet(program, syntheticIR);
    expect(hoisted).toHaveLength(1);
    expect(hoisted[0]!.name).toBe('counter');
  });
});
