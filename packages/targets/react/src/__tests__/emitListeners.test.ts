/**
 * Plan 04-04 Task 2 — emitListeners orchestrator + 4-class classifier
 * + renderDepArray utility tests.
 *
 * Verifies the marquee technical claim of the project (REACT-T-02 / D-61):
 * Listener.deps from Phase 2's ReactiveDepGraph spreads DIRECTLY into
 * useEffect deps[] arrays.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitListeners } from '../emit/emitListeners.js';
import { renderDepArray, renderSignalRef } from '../emit/renderDepArray.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { SignalRef } from '../../../../core/src/reactivity/signalRef.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

const STUB_IR: IRComponent = {
  type: 'IRComponent',
  name: 'Stub',
  props: [],
  state: [],
  computed: [],
  refs: [],
  slots: [],
  emits: [],
  lifecycle: [],
  watchers: [],
  listeners: [],
  setupBody: { type: 'SetupBody', scriptProgram: { type: 'File', program: { type: 'Program', body: [], directives: [], sourceType: 'module' } } as any, annotations: [] },
  template: null,
  styles: { type: 'StyleSection', sections: [], hasRootEscape: false, sourceLoc: { start: 0, end: 0 } } as any,
  sourceLoc: { start: 0, end: 0 },
};

describe('renderDepArray (Plan 04-04 Task 2)', () => {
  it('Test 1 — basic mixed deps alphabetized', () => {
    const ir: IRComponent = {
      ...STUB_IR,
      props: [{ type: 'PropDecl', name: 'open', typeAnnotation: { kind: 'literal', value: 'boolean' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } }],
      state: [{ type: 'StateDecl', name: 'count', initializer: { type: 'NumericLiteral', value: 0 } as any, sourceLoc: { start: 0, end: 0 } }],
    };
    const deps: SignalRef[] = [
      { scope: 'props', path: ['open'] },
      { scope: 'data', path: ['count'] },
    ];
    expect(renderDepArray(deps, ir)).toBe('[count, props.open]');
  });

  it('Test 2 — model:true prop reads bare local', () => {
    const ir: IRComponent = {
      ...STUB_IR,
      props: [{ type: 'PropDecl', name: 'value', typeAnnotation: { kind: 'literal', value: 'number' }, defaultValue: null, isModel: true, sourceLoc: { start: 0, end: 0 } }],
    };
    const deps: SignalRef[] = [{ scope: 'props', path: ['value'] }];
    expect(renderDepArray(deps, ir)).toBe('[value]');
  });

  it('Test 3 — slot named header → props.renderHeader', () => {
    const deps: SignalRef[] = [{ scope: 'slots', path: ['header'] }];
    expect(renderDepArray(deps, STUB_IR)).toBe('[props.renderHeader]');
  });

  it('Test 3b — default-slot sentinel "" → props.children', () => {
    expect(renderSignalRef({ scope: 'slots', path: [''] }, STUB_IR)).toBe('props.children');
  });

  it('Test 4 — closure dep emits identifier verbatim', () => {
    const deps: SignalRef[] = [{ scope: 'closure', identifier: 'helperFn' }];
    expect(renderDepArray(deps, STUB_IR)).toBe('[helperFn]');
  });

  it('Test 5 — empty deps emits []', () => {
    expect(renderDepArray([], STUB_IR)).toBe('[]');
  });

  it('Test 5b — duplicates dedupe', () => {
    const deps: SignalRef[] = [
      { scope: 'props', path: ['x'] },
      { scope: 'props', path: ['x'] },
    ];
    const ir: IRComponent = {
      ...STUB_IR,
      props: [{ type: 'PropDecl', name: 'x', typeAnnotation: { kind: 'literal', value: 'number' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } }],
    };
    expect(renderDepArray(deps, ir)).toBe('[props.x]');
  });
});

describe('emitListeners 4-class classification (Plan 04-04 Task 2)', () => {
  function emit(ir: IRComponent) {
    const collectors = {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    };
    const result = emitListeners(ir, collectors, createDefaultRegistry());
    return { ...result, collectors };
  }

  it('Class A (Modal escape) — useEffect with addEventListener + Escape inlineGuard + Listener.deps spread', () => {
    const ir = lowerInline(`
<rozie name="Modal">
<props>{ open: { type: Boolean, default: false, model: true }, closeOnEscape: { type: Boolean, default: true } }</props>
<script>
const close = () => { $props.open = false }
</script>
<listeners>
{
  "document:keydown.escape": { when: "$props.open && $props.closeOnEscape", handler: close },
}
</listeners>
</rozie>
`);
    const { code, collectors } = emit(ir);
    expect(code).toContain('useEffect');
    expect(code).toMatch(/document\.addEventListener\('keydown'/);
    expect(code).toMatch(/if \(e\.key !== 'Escape'\) return/);
    // Listener.deps spread directly — REACT-T-02 marquee claim.
    expect(code).toMatch(/\}, \[.*open.*\]\);$/m);
    expect(collectors.react.has('useEffect')).toBe(true);
  });

  it('Class B (Dropdown outside) — single useOutsideClick call, no useEffect at site', () => {
    const ir = lowerInline(`
<rozie name="Dropdown">
<props>{ open: { type: Boolean, default: false, model: true } }</props>
<script>
const close = () => { $props.open = false }
</script>
<template>
<div>
  <div ref="triggerEl"></div>
  <div ref="panelEl"></div>
</div>
</template>
<listeners>
{
  "document:click.outside($refs.triggerEl, $refs.panelEl)": { when: "$props.open", handler: close },
}
</listeners>
</rozie>
`);
    const { code, collectors } = emit(ir);
    expect(code).toMatch(/useOutsideClick\(\s*\[triggerEl, panelEl\],/);
    // No raw useEffect for the outside listener (helper manages its own).
    expect(code.match(/useEffect/g)?.length ?? 0).toBe(0);
    expect(collectors.runtime.has('useOutsideClick')).toBe(true);
  });

  it('Class C (Dropdown throttled resize) — wrapper const + useEffect referencing wrap name', () => {
    const ir = lowerInline(`
<rozie name="Dropdown">
<props>{ open: { type: Boolean, default: false, model: true } }</props>
<script>
const reposition = () => {}
</script>
<listeners>
{
  "window:resize.throttle(100).passive": { when: "$props.open", handler: reposition },
}
</listeners>
</rozie>
`);
    const { code, scriptInjections, collectors } = emit(ir);
    expect(scriptInjections.length).toBe(1);
    expect(scriptInjections[0]!).toMatch(/const _rozieThrottledLReposition = useThrottledCallback\(reposition,/);
    expect(scriptInjections[0]!).toMatch(/, 100\);$/);
    expect(code).toMatch(/window\.addEventListener\('resize', _rozieThrottledLReposition, \{ passive: true \}/);
    expect(collectors.runtime.has('useThrottledCallback')).toBe(true);
  });

  it('Class D (synthetic — pure inlineGuard, no listenerOption) — useEffect, no options-object', () => {
    const ir = lowerInline(`
<rozie name="X">
<script>
const onClick = () => {}
</script>
<listeners>
{
  "document:click.stop": { when: "true", handler: onClick },
}
</listeners>
</rozie>
`);
    const { code } = emit(ir);
    // Class D — addEventListener has NO options-object suffix.
    expect(code).toMatch(/document\.addEventListener\('click', _rozieHandler\);$/m);
    expect(code).toMatch(/e\.stopPropagation\(\);/);
  });

  it('does not emit code for template-event listeners (only <listeners> block entries)', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<button @click="doIt">click</button>
</template>
<script>
const doIt = () => {}
</script>
</rozie>
`);
    const { code } = emit(ir);
    expect(code).toBe('');
  });
});
