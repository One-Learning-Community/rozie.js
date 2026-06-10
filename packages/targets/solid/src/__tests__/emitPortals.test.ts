/**
 * emitPortals — Solid-target unit coverage (quick-260521-spv).
 *
 * Drives `emitPortals.ts` past the `portals.length === 0` early return:
 * the portal-emitting body (`buildSlotMethod`, `setAttrLine`, closure +
 * onCleanup block) is exercised here directly.
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

describe('emitPortals — Solid', () => {
  it('no portal slots → early return with empty fields', () => {
    const ir = buildMinimalIR({ slots: [] });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(false);
    expect(result.setupLines).toBe('');
    expect(result.needsSolidWebRender).toBe(false);
  });

  it('one portal slot → happy path (PortalList example)', () => {
    const ir = lowerExample('PortalList');
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.setupLines).toContain('portalDisposers');
    expect(result.setupLines).toContain('onCleanup');
    expect(result.setupLines).toContain('render(() =>');
    expect(result.setupLines).toContain('item:');
    expect(result.needsSolidWebRender).toBe(true);
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

  it('portalParamNames present vs absent → scopeType branch', () => {
    const withParams = emitPortals(
      buildMinimalIR({ slots: [portalSlot('item', ['item'])] }),
    );
    expect(withParams.setupLines).toContain('{ item: unknown }');

    const noParams = emitPortals(buildMinimalIR({ slots: [portalSlot('item')] }));
    expect(noParams.setupLines).toContain('scope: unknown');
  });

  // ── Phase 33 / REQ-20, REQ-22 — reactive portal branch ───────────────────
  it('reactive portal slot → createSignal(equals:false) + setScope + { update, dispose }', () => {
    const ir = buildMinimalIR({ slots: [reactivePortalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir);
    expect(result.setupLines).toContain('interface ReactivePortalHandle');
    expect(result.setupLines).toContain('nodeView: (container');
    expect(result.setupLines).toContain('ReactivePortalHandle => {');
    // REQ-20: signal seeded with { equals: false }.
    expect(result.setupLines).toContain('createSignal<unknown>(scope, { equals: false })');
    // REQ-26: the consumer slot receives the scope SIGNAL ACCESSOR (`scopeSig`),
    // NOT its current value (`scopeSig()`). The reactive consumer fill reads
    // `_rozieScope().<param>` inside the render computation so each read re-tracks
    // on setScopeSig → in-place re-render (no remount). Passing the value would
    // statically capture the consumer's destructured params (the foreign-slot
    // accessor limitation the fix removes).
    expect(result.setupLines).toContain('render(() => slot(scopeSig as unknown as (() => ');
    expect(result.setupLines).not.toContain('slot(scopeSig()');
    expect(result.setupLines).toContain('setScopeSig(s)');
    expect(result.setupLines).toContain('dispose: (): void => {');
    // emitScript must add createSignal to the solid-js import.
    expect(result.needsCreateSignal).toBe(true);
  });

  it('non-reactive portal slot → mount-once () => void body verbatim; needsCreateSignal false', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir);
    expect(result.setupLines).not.toContain('ReactivePortalHandle');
    expect(result.setupLines).not.toContain('createSignal');
    expect(result.setupLines).toContain('): (() => void) => {');
    expect(result.setupLines).toContain('const dispose = render(() => slot(scope), container);');
    expect(result.setupLines).toContain('return () => {');
    expect(result.needsCreateSignal).toBe(false);
  });

  // ── Phase 37 — $portals.default (DEFAULT portal slot) ─────────────────────
  it('DEFAULT portal slot → closure key `default`, sources _props.children', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('', ['id', 'label'])] });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.setupLines).toContain('default: (container');
    expect(result.setupLines).not.toContain("'': (container");
    // Solid sources its built-in children prop for the default slot.
    expect(result.setupLines).toContain("const slot = _props.children ?? _props.slots?.['default'];");
    expect(result.setupLines).toContain('if (slot == null) return () => {};');
    expect(result.setupLines).toContain("typeof slot === 'function'");
  });

  it('GATE: a NAMED portal slot is byte-unaffected by the default-portal feature', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('item', ['item'])] });
    const result = emitPortals(ir);
    expect(result.setupLines).toContain('item: (container');
    expect(result.setupLines).toContain("const slot = _props.itemSlot ?? _props.slots?.['item'];");
    expect(result.setupLines).not.toContain('default: (container');
  });
});
