/**
 * emitPortals — Svelte-target unit coverage (quick-260521-spv).
 *
 * Drives `emitPortals.ts` past the `portals.length === 0` early return:
 * the portal-emitting body (`buildSlotMethod`, `setAttrLine`, closure +
 * $effect block, extraImports) is exercised here directly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, PropDecl, SlotDecl } from '../../../../core/src/ir/types.js';
import { emitPortals } from '../emit/emitPortals.js';

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

function buildMinimalIR(overrides: Partial<IRComponent> = {}): IRComponent {
  return {
    type: 'IRComponent',
    name: 'Wrapper',
    props: [],
    state: [],
    computed: [],
    refs: [],
    emits: [],
    slots: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      portalRules: [],
      engineRules: [],
      sourceLoc: { start: 0, end: 0 },
    },
    components: [],
    setupBody: { type: 'SetupBody', scriptProgram: t.file(t.program([])), annotations: [] },
    template: null,
    sourceLoc: { start: 0, end: 0 },
    ...overrides,
  };
}

function boolProp(name: string): PropDecl {
  return {
    type: 'PropDecl',
    name,
    typeAnnotation: { kind: 'literal', value: 'boolean' },
    defaultValue: null,
    isModel: false,
    required: false,
    sourceLoc: { start: 0, end: 0 },
  };
}

function portalSlot(name: string, portalParamNames?: string[]): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'always',
    nestedSlots: [],
    isPortal: true,
    ...(portalParamNames !== undefined ? { portalParamNames } : {}),
    sourceLoc: { start: 0, end: 0 },
  };
}

function reactivePortalSlot(name: string, portalParamNames?: string[]): SlotDecl {
  return { ...portalSlot(name, portalParamNames), isReactive: true };
}

describe('emitPortals — Svelte', () => {
  it('no portal slots → early return with empty fields', () => {
    const ir = buildMinimalIR({ slots: [] });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(false);
    expect(result.setupLines).toBe('');
    expect(result.extraImports).toBe('');
  });

  it('one portal slot → happy path (PortalList example)', () => {
    const ir = lowerExample('PortalList');
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.setupLines).toContain('portalInstances');
    expect(result.setupLines).toContain('mount(PortalHost');
    expect(result.setupLines).toContain('$effect');
    expect(result.setupLines).toContain('item:');
    expect(result.extraImports).toContain("from 'svelte'");
    expect(result.extraImports).toContain('PortalHost.svelte');
  });

  it('multiple portal slots → both names in joined output', () => {
    const ir = buildMinimalIR({
      slots: [portalSlot('header', ['h']), portalSlot('footer', ['f'])],
    });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.setupLines).toContain('header:');
    expect(result.setupLines).toContain('footer:');
  });

  it('scopeHash empty vs non-empty → setAttrLine both arms', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('item', ['item'])] });
    const empty = emitPortals(ir, '');
    expect(empty.setupLines).not.toContain('container.setAttribute');

    const scoped = emitPortals(ir, 'abc123');
    expect(scoped.setupLines).toContain('container.setAttribute(');
    expect(scoped.setupLines).toContain('abc123');
  });

  it('portal-slot name colliding with a declared prop → collision-gated `Slot` suffix on the guard + snippet read only', () => {
    // Regression (Phase 28): FullCalendar declares BOTH a boolean prop
    // `nowIndicator` AND a portal-slot `nowIndicator`. The props destructure
    // binds `nowIndicator` and the slot's `$derived` merge would re-declare it
    // → hard Svelte "Identifier 'nowIndicator' has already been declared". The
    // merge identifier is suffixed to `nowIndicatorSlot`; the `$portals` closure
    // KEY stays the bare `nowIndicator` (script `$portals.nowIndicator(...)`
    // lookup contract), but the guard + `snippet:` READS target the suffixed
    // merge.
    const ir = buildMinimalIR({
      props: [boolProp('nowIndicator')],
      slots: [portalSlot('nowIndicator', ['arg'])],
    });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    // Closure key = bare slot name (script lookup contract).
    expect(result.setupLines).toContain('nowIndicator: (container');
    // Guard + snippet reads = disambiguated.
    expect(result.setupLines).toContain('if (!nowIndicatorSlot) return () => {};');
    expect(result.setupLines).toContain('snippet: nowIndicatorSlot');
    // The bare `if (!nowIndicator)` guard (which would read the boolean prop)
    // MUST NOT appear.
    expect(result.setupLines).not.toContain('if (!nowIndicator) return () => {};');
    expect(result.setupLines).not.toContain('snippet: nowIndicator,');
  });

  it('portal-slot name NOT colliding with any prop → bare guard + snippet read (byte-identical, no suffix)', () => {
    const ir = buildMinimalIR({
      props: [boolProp('editable')],
      slots: [portalSlot('eventContent', ['arg'])],
    });
    const result = emitPortals(ir);
    expect(result.setupLines).toContain('if (!eventContent) return () => {};');
    expect(result.setupLines).toContain('snippet: eventContent,');
    expect(result.setupLines).not.toContain('eventContentSlot');
  });

  it('portalParamNames present vs absent → scopeType branch', () => {
    const withParams = emitPortals(
      buildMinimalIR({ slots: [portalSlot('item', ['item'])] }),
    );
    expect(withParams.setupLines).toContain('{ item: unknown }');

    const noParams = emitPortals(buildMinimalIR({ slots: [portalSlot('item')] }));
    expect(noParams.setupLines).toContain('scope: unknown');
  });

  // ── Phase 33 / REQ-19, REQ-22 — reactive portal branch ───────────────────
  it('reactive portal slot → mount(PortalHostReactive) + initialScope + inst.update', () => {
    const ir = buildMinimalIR({ slots: [reactivePortalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir);
    expect(result.setupLines).toContain('interface ReactivePortalHandle');
    expect(result.setupLines).toContain('nodeView: (container');
    expect(result.setupLines).toContain('ReactivePortalHandle => {');
    // REQ-19: reactive variant + initialScope (NOT scope) + inst.update handle.
    expect(result.setupLines).toContain('mount(PortalHostReactive, {');
    expect(result.setupLines).toContain('initialScope: scope');
    expect(result.setupLines).not.toContain('snippet: nodeView, scope');
    expect(result.setupLines).toContain('.update(s)');
    expect(result.setupLines).toContain('dispose: (): void => {');
    // Import is the reactive variant; the mount-once PortalHost is NOT imported
    // when only a reactive slot is present.
    expect(result.extraImports).toContain("PortalHostReactive.svelte");
    expect(result.extraImports).not.toContain("import PortalHost from");
  });

  it('non-reactive portal slot → mount-once () => void body + PortalHost import verbatim', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir);
    expect(result.setupLines).not.toContain('ReactivePortalHandle');
    expect(result.setupLines).not.toContain('PortalHostReactive');
    expect(result.setupLines).not.toContain('initialScope');
    expect(result.setupLines).toContain('): (() => void) => {');
    expect(result.setupLines).toContain('mount(PortalHost, {');
    expect(result.setupLines).toContain('props: { snippet: nodeView, scope }');
    expect(result.extraImports).toContain("import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';");
    expect(result.extraImports).not.toContain('PortalHostReactive');
  });
});
