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
  // Phase 41 controlled-graph: the one-way `nodes`/`connections` props are GONE,
  // replaced by the single two-way `graph` model + the `validateTypes` toggle.
  // `controls` (Win 4, quick-260611-sqa) = the built-in zoom/fit overlay toggle
  // (Boolean, default ON; :controls="false" opts out).
  props: [
    'graph', 'validateTypes', 'zoom', 'pannable', 'zoomable', 'selectable',
    'readonly', 'minZoom', 'maxZoom', 'snapGrid', 'accumulateOnCtrl',
    'curvature', 'fitOnMount', 'controls', 'minimap', 'canConnect',
  ],
  // `graph` + `zoom` are both two-way (the bound graph is the source of truth +
  // write-back target; zoom is the viewport binding). Neither is a same-named emit
  // (the MapLibre zoom/pitch model-prop == emit-name collision lesson).
  models: ['graph', 'zoom'],
  // `selection-change` (Win 2, quick-260611-sqa) surfaces the selected node ids to the
  // consumer ({ ids }) on pick/unpick/deselect. ROZ127-clean (no prop/model/expose
  // collision): `selectable` is the prop, there is no `selection` model, so no
  // model-prop==emit clash (the MapLibre zoom/pitch lesson).
  emits: [
    'node-action', 'connection-created', 'connection-removed', 'node-picked',
    'node-moved', 'translated', 'context-menu', 'connection-rejected',
    'selection-change',
  ],
  // 'node' = the reactive multi-instance portal slot (the low-level render-by-type
  // escape hatch); '' = the default slot that hosts the Phase 41 declarative
  // <NodeType>/<Port> children. Both coexist.
  slots: ['', 'node'],
  // `deleteNode` (Win 1, quick-260611-sqa) = the PUBLIC controlled-graph cascading
  // delete (fresh-graph write-back), distinct from `removeNode` (engine-only escape
  // hatch). Also wired to the Delete/Backspace key.
  expose: [
    'getEditor', 'getArea', 'addNode', 'removeNode', 'deleteNode', 'addConnection',
    'removeConnection', 'clear', 'zoomToFit', 'zoomTo', 'setCenter', 'setViewport',
    'screenToFlowPosition', 'getNodes', 'getConnections', 'getTransform',
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

  it('props surface matches (16 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('model:true props match (graph + zoom)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface matches (9 emits)', () => {
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

  it('expose surface matches (16 verbs)', () => {
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

// Phase 41 controlled-graph children: the node-TYPE template <NodeType> + the typed
// directional port <Port output=/input=> (repurposed from the Phase-37 <FlowNode>/
// <Handle>). Both must compile to all 6 with ZERO error diagnostics (NO emitter
// change). Direction attrs are `input`/`output` (NOT `in`/`out` — `in` is a JS
// reserved word the Svelte $props() destructure rejects).
describe('NodeType.rozie + Port.rozie surface gate', () => {
  const NODE_TYPE_SRC = readFileSync(resolve(HERE, '..', 'src', 'NodeType.rozie'), 'utf8');
  const PORT_SRC = readFileSync(resolve(HERE, '..', 'src', 'Port.rozie'), 'utf8');

  it('NodeType has a single required `type` prop (no id/x/y) + provides rete:nodeType', () => {
    const { ast } = parse(NODE_TYPE_SRC, { filename: 'NodeType.rozie' });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(ir.name).toBe('NodeType');
    expect(ir.props.map((p: { name: string }) => p.name)).toEqual(['type']);
    expect(NODE_TYPE_SRC).toContain("$provide('rete:nodeType'");
    expect(NODE_TYPE_SRC).toContain('registerType');
  });

  it('Port derives side/key from output=/input= + addPort against rete:nodeType', () => {
    const { ast } = parse(PORT_SRC, { filename: 'Port.rozie' });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(ir.name).toBe('Port');
    expect(sorted(ir.props.map((p: { name: string }) => p.name))).toEqual(
      sorted(['output', 'input', 'type', 'label', 'multiple']),
    );
    expect(PORT_SRC).toContain("$inject('rete:nodeType')");
    expect(PORT_SRC).toContain('addPort');
  });

  const CHILD_TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(CHILD_TARGETS)('compile NodeType(%s) emits zero error diagnostics', (target) => {
    const r = compile(NODE_TYPE_SRC, { target, filename: 'NodeType.rozie' });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
  it.each(CHILD_TARGETS)('compile Port(%s) emits zero error diagnostics', (target) => {
    const r = compile(PORT_SRC, { target, filename: 'Port.rozie' });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});
