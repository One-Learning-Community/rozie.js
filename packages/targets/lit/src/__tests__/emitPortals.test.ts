/**
 * emitPortals — Lit-target unit coverage (quick-260521-spv).
 *
 * Drives `emitPortals.ts` past the `portals.length === 0` early return:
 * the portal-emitting body (`buildSlotMethod`, `setAttrLine`, closure +
 * disconnected block) is exercised here directly.
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

function reactivePortalSlot(name: string, portalParamNames?: string[]): SlotDecl {
  return { ...portalSlot(name, portalParamNames), isReactive: true };
}

describe('emitPortals — Lit', () => {
  it('no portal slots → early return with empty fields', () => {
    const ir = buildMinimalIR({ slots: [] });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(false);
    expect(result.fieldDecl).toBe('');
    expect(result.closureBlock).toBe('');
    expect(result.disconnectedBlock).toBe('');
  });

  it('one portal slot → happy path (PortalList example)', () => {
    const ir = lowerExample('PortalList');
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.fieldDecl).toContain('_portalContainers');
    expect(result.closureBlock).toContain('item:');
    expect(result.closureBlock).toContain('render(tpl(scope)');
    expect(result.disconnectedBlock).toContain('render(nothing');
  });

  it('multiple portal slots → both names in joined output', () => {
    const ir = buildMinimalIR({
      slots: [portalSlot('header', ['h']), portalSlot('footer', ['f'])],
    });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.closureBlock).toContain('header:');
    expect(result.closureBlock).toContain('footer:');
  });

  it('scopeHash empty vs non-empty → setAttrLine both arms', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('item', ['item'])] });
    const empty = emitPortals(ir, '');
    expect(empty.closureBlock).not.toContain('container.setAttribute');

    const scoped = emitPortals(ir, 'abc123');
    expect(scoped.closureBlock).toContain('container.setAttribute(');
    expect(scoped.closureBlock).toContain('abc123');
  });

  it('portal-slot name colliding with a declared prop → collision-gated `Slot` suffix on the `this.<member>` read only', () => {
    // Regression: FullCalendar declares BOTH a boolean prop `nowIndicator`
    // AND a portal-slot `nowIndicator`. The prop emits its own `@property
    // nowIndicator`; the slot bridge must NOT also emit `this.nowIndicator`
    // (which would resolve to the boolean prop) — it reads the disambiguated
    // `this.nowIndicatorSlot` member instead. The closure object KEY stays the
    // bare slot name so the script-side `$portals.nowIndicator(...)` →
    // `portals.nowIndicator(...)` lookup keeps working.
    const ir = buildMinimalIR({
      props: [boolProp('nowIndicator')],
      slots: [portalSlot('nowIndicator', ['arg'])],
    });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    // Closure key = bare slot name (script lookup contract).
    expect(result.closureBlock).toContain('nowIndicator: (container');
    // Member read = disambiguated.
    expect(result.closureBlock).toContain('const tpl = this.nowIndicatorSlot;');
    // The bare `this.nowIndicator` read (which would grab the boolean prop)
    // MUST NOT appear.
    expect(result.closureBlock).not.toContain('const tpl = this.nowIndicator;');
  });

  it('portal-slot name NOT colliding with any prop → bare member read (byte-identical, no suffix)', () => {
    const ir = buildMinimalIR({
      props: [boolProp('editable')],
      slots: [portalSlot('eventContent', ['arg'])],
    });
    const result = emitPortals(ir);
    expect(result.closureBlock).toContain('const tpl = this.eventContent;');
    expect(result.closureBlock).not.toContain('eventContentSlot');
  });

  it('portalParamNames present vs absent → scopeType branch', () => {
    const withParams = emitPortals(
      buildMinimalIR({ slots: [portalSlot('item', ['item'])] }),
    );
    expect(withParams.closureBlock).toContain('{ item: unknown }');

    const noParams = emitPortals(buildMinimalIR({ slots: [portalSlot('item')] }));
    expect(noParams.closureBlock).toContain('scope: unknown');
  });

  // ── Phase 33 / REQ-22 — reactive portal branch ───────────────────────────
  it('reactive portal slot → returns { update, dispose } + ReactivePortalHandle', () => {
    const ir = buildMinimalIR({ slots: [reactivePortalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir);
    expect(result.closureBlock).toContain('interface ReactivePortalHandle');
    expect(result.closureBlock).toContain('nodeView: (container');
    expect(result.closureBlock).toContain('ReactivePortalHandle => {');
    // renderScope/update type their param as the slot's scopeType (NOT bare
    // `unknown`) — the slot template fn is typed by its declared portal params,
    // so a bare `unknown` fails strict typecheck where the slot fn has a typed
    // param (Phase 33 dogfood: TipTap nodeView is the first typed-param reactive
    // portal). Mirrors the mount-once path's typed `scope`.
    expect(result.closureBlock).toContain(
      'const renderScope = (s: { node: unknown; selected: unknown }): void =>',
    );
    expect(result.closureBlock).toContain('render(tpl(s), container)');
    expect(result.closureBlock).toContain(
      'update: (s: { node: unknown; selected: unknown }): void => renderScope(s)',
    );
    expect(result.closureBlock).toContain('dispose: (): void => {');
  });

  it('non-reactive portal slot → mount-once () => void body verbatim (byte-identical regression guard)', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir);
    expect(result.closureBlock).not.toContain('ReactivePortalHandle');
    expect(result.closureBlock).not.toContain('renderScope');
    expect(result.closureBlock).toContain('): (() => void) => {');
    expect(result.closureBlock).toContain('render(tpl(scope), container);');
    expect(result.closureBlock).toContain('return () => {');
  });
});
