/**
 * surface.test.ts — the FlowCanvas.rozie surface gate as a vitest test (so it
 * runs under `turbo run test`).
 *
 * Re-asserts the SAME contract a standalone compile-check would:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots + portal-reactive
 *      flags / expose) matches the SPEC contract exactly.
 *   3. compile()×6 emits ZERO error-severity diagnostics + non-empty code
 *      (ROZ127 slot==prop, ROZ121 expose-verb==event, ROZ524 React model-setter,
 *      Lit reserved-lifecycle all surface here as compile() errors).
 *   4. NO model-prop == emit-name collision (Vue defineModel vs defineEmits,
 *      Angular ModelSignal vs OutputEmitterRef) — `zoom` is the only model and is
 *      deliberately NOT an emit (the MapLibre zoom/pitch lesson).
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'FlowCanvas.rozie');
const FILENAME = 'FlowCanvas.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'FlowCanvas',
  props: [
    'nodes', 'connections', 'zoom', 'pannable', 'zoomable', 'selectable',
    'readonly', 'minZoom', 'maxZoom', 'snapGrid', 'accumulateOnCtrl',
    'curvature', 'fitOnMount',
  ],
  models: ['zoom'],
  emits: [
    'node-action', 'connection-created', 'connection-removed', 'node-picked',
    'node-moved', 'translated', 'context-menu',
  ],
  slots: ['node'],
  expose: [
    'getEditor', 'getArea', 'addNode', 'removeNode', 'addConnection',
    'removeConnection', 'clear', 'zoomToFit', 'zoomTo', 'getNodes',
    'getConnections', 'getTransform',
  ],
} as const;

const sorted = (a: readonly string[]) => [...a].sort();

describe('FlowCanvas.rozie surface gate', () => {
  const { ast } = parse(source, { filename: FILENAME });
  const { ir, diagnostics: lowerDiags = [] } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
  });

  it('lowerToIR emits zero error diagnostics', () => {
    const errs = lowerDiags.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
  });

  it('component name matches', () => {
    expect(ir.name).toBe(EXPECT.name);
  });

  it('props surface matches (13 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('model:true props match (zoom only)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface matches (7 emits)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
  });

  it('slot surface matches (node)', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('node is a REACTIVE portal slot', () => {
    const node = ir.slots.find((s: { name: string }) => s.name === 'node') as
      | { isPortal?: boolean; isReactive?: boolean }
      | undefined;
    expect(node?.isPortal, 'node should be a portal slot').toBe(true);
    expect(node?.isReactive, 'node should be REACTIVE').toBe(true);
  });

  it('expose surface matches (12 verbs)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  it('no model-prop == emit-name collision (Vue/Angular two-way clash)', () => {
    const models = new Set<string>(EXPECT.models);
    const clash = ir.emits.filter((e: string) => models.has(e));
    expect(clash).toEqual([]);
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code', (target) => {
    const r = compile(source, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});
