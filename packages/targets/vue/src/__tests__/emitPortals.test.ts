/**
 * emitPortals — Vue-target unit coverage (quick-260521-spv).
 *
 * Drives `emitPortals.ts` past the `portals.length === 0` early return:
 * the portal-emitting body (`buildSlotMethod`, `setAttrLine`, closure +
 * onBeforeUnmount block) is exercised here directly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import { emitPortals } from '../emit/emitPortals.js';
import { VueImportCollector } from '../rewrite/collectVueImports.js';

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

describe('emitPortals — Vue', () => {
  it('no portal slots → early return with empty fields', () => {
    const ir = buildMinimalIR({ slots: [] });
    const result = emitPortals(ir, new VueImportCollector());
    expect(result.hasPortals).toBe(false);
    expect(result.setupLines).toBe('');
  });

  it('one portal slot → happy path (PortalList example)', () => {
    const ir = lowerExample('PortalList');
    const result = emitPortals(ir, new VueImportCollector());
    expect(result.hasPortals).toBe(true);
    expect(result.setupLines).toContain('portalContainers');
    expect(result.setupLines).toContain('const portals = {');
    expect(result.setupLines).toContain('onBeforeUnmount');
    expect(result.setupLines).toContain('h(Fragment');
    expect(result.setupLines).toContain('item:');
  });

  it('multiple portal slots → both names in joined output', () => {
    const ir = buildMinimalIR({
      slots: [portalSlot('header', ['h']), portalSlot('footer', ['f'])],
    });
    const result = emitPortals(ir, new VueImportCollector());
    expect(result.hasPortals).toBe(true);
    expect(result.setupLines).toContain('header:');
    expect(result.setupLines).toContain('footer:');
  });

  it('scopeHash empty vs non-empty → setAttrLine both arms', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('item', ['item'])] });
    const empty = emitPortals(ir, new VueImportCollector(), '');
    expect(empty.setupLines).not.toContain('container.setAttribute');

    const scoped = emitPortals(ir, new VueImportCollector(), 'abc123');
    expect(scoped.setupLines).toContain('container.setAttribute(');
    expect(scoped.setupLines).toContain('abc123');
  });

  it('portalParamNames present vs absent → scopeType branch', () => {
    const withParams = emitPortals(
      buildMinimalIR({ slots: [portalSlot('item', ['item'])] }),
      new VueImportCollector(),
    );
    expect(withParams.setupLines).toContain('{ item: unknown }');

    const noParams = emitPortals(
      buildMinimalIR({ slots: [portalSlot('item')] }),
      new VueImportCollector(),
    );
    expect(noParams.setupLines).toContain('scope: unknown');
  });

  // ── Phase 33 / REQ-22 — reactive portal branch ───────────────────────────
  it('reactive portal slot → returns { update, dispose } + ReactivePortalHandle', () => {
    const ir = buildMinimalIR({ slots: [reactivePortalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir, new VueImportCollector());
    expect(result.setupLines).toContain('interface ReactivePortalHandle');
    expect(result.setupLines).toContain('nodeView: (container');
    expect(result.setupLines).toContain('ReactivePortalHandle => {');
    expect(result.setupLines).toContain('const renderScope = (s: unknown): void =>');
    expect(result.setupLines).toContain('render(h(Fragment, null, slotFn(s)), container)');
    expect(result.setupLines).toContain('update: (s: unknown): void => renderScope(s)');
    expect(result.setupLines).toContain('dispose: (): void => {');
  });

  it('non-reactive portal slot → mount-once () => void body verbatim (byte-identical regression guard)', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir, new VueImportCollector());
    expect(result.setupLines).not.toContain('ReactivePortalHandle');
    expect(result.setupLines).not.toContain('renderScope');
    expect(result.setupLines).toContain('): (() => void) => {');
    expect(result.setupLines).toContain('const vnode = h(Fragment, null, slotFn(scope));');
    expect(result.setupLines).toContain('return () => {');
  });
});
