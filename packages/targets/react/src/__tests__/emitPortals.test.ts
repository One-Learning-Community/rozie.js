/**
 * emitPortals — React-target unit coverage (quick-260521-spv).
 *
 * Drives `emitPortals.ts` past the `portals.length === 0` early return:
 * the portal-emitting body (`buildSlotMethod`, `setAttrLine`, `pascalCase`,
 * `rendererRefLines`, closure/dispose blocks) is exercised here directly.
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
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

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

function newCollectors() {
  return {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
}

describe('emitPortals — React', () => {
  it('no portal slots → early return with empty fields', () => {
    const ir = buildMinimalIR({ slots: [] });
    const result = emitPortals(ir, newCollectors());
    expect(result.hasPortals).toBe(false);
    expect(result.refDeclLine).toBe('');
    expect(result.rendererRefLines).toBe('');
    expect(result.closureBlock).toBe('');
    expect(result.bulkDisposeBlock).toBe('');
    expect(result.portalSlotNames).toEqual(new Set());
  });

  it('one portal slot → happy path (PortalList example)', () => {
    const ir = lowerExample('PortalList');
    const result = emitPortals(ir, newCollectors());
    expect(result.hasPortals).toBe(true);
    expect(result.refDeclLine).toContain('portalRoots');
    expect(result.rendererRefLines).toContain('_renderItemRef');
    expect(result.rendererRefLines).toContain('props.renderItem');
    expect(result.closureBlock).toContain('item:');
    expect(result.closureBlock).toContain('createRoot');
    expect(result.closureBlock).toContain('flushSync');
    expect(result.bulkDisposeBlock).toContain('.unmount()');
    expect(result.portalSlotNames).toEqual(new Set(['item']));
  });

  it('multiple portal slots → both names in joined output', () => {
    const ir = buildMinimalIR({
      slots: [portalSlot('header', ['h']), portalSlot('footer', ['f'])],
    });
    const result = emitPortals(ir, newCollectors());
    expect(result.hasPortals).toBe(true);
    expect(result.closureBlock).toContain('header:');
    expect(result.closureBlock).toContain('footer:');
    expect(result.rendererRefLines).toContain('_renderHeaderRef');
    expect(result.rendererRefLines).toContain('_renderFooterRef');
    expect(result.portalSlotNames).toEqual(new Set(['header', 'footer']));
  });

  it('scopeHash empty vs non-empty → setAttrLine both arms', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('item', ['item'])] });
    const empty = emitPortals(ir, newCollectors(), '');
    expect(empty.closureBlock).not.toContain('container.setAttribute');

    const scoped = emitPortals(ir, newCollectors(), 'abc123');
    expect(scoped.closureBlock).toContain('container.setAttribute(');
    expect(scoped.closureBlock).toContain('abc123');
  });

  it('portalParamNames present vs absent → scopeType branch', () => {
    const withParams = emitPortals(
      buildMinimalIR({ slots: [portalSlot('item', ['item'])] }),
      newCollectors(),
    );
    expect(withParams.closureBlock).toContain('{ item: unknown }');

    const noParams = emitPortals(
      buildMinimalIR({ slots: [portalSlot('item')] }),
      newCollectors(),
    );
    expect(noParams.closureBlock).toContain('scope: unknown');
  });

  it('pascalCase separator branch — slot name with a dash', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('my-cell', ['x'])] });
    const result = emitPortals(ir, newCollectors());
    expect(result.rendererRefLines).toContain('_renderMyCellRef');
  });

  // ── Phase 33 / REQ-22 — reactive portal branch ───────────────────────────
  it('reactive portal slot → returns { update, dispose } + ReactivePortalHandle', () => {
    const ir = buildMinimalIR({ slots: [reactivePortalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir, newCollectors());
    expect(result.hasPortals).toBe(true);
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
    expect(result.closureBlock).toContain('flushSync(() => root.render(slot(s)))');
    expect(result.closureBlock).toContain(
      'update: (s: { node: unknown; selected: unknown }): void => renderScope(s)',
    );
    expect(result.closureBlock).toContain('dispose: (): void => {');
    // The root is RETAINED (created once), re-rendered on update.
    expect(result.closureBlock).toContain('const root = createRoot(container);');
  });

  it('non-reactive portal slot → mount-once () => void body verbatim (byte-identical regression guard)', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir, newCollectors());
    // The mount-once shape is untouched by the reactive opt-in.
    expect(result.closureBlock).not.toContain('ReactivePortalHandle');
    expect(result.closureBlock).not.toContain('renderScope');
    expect(result.closureBlock).toContain('): (() => void) => {');
    expect(result.closureBlock).toContain('if (typeof slot !== \'function\') return () => {};');
    expect(result.closureBlock).toContain('flushSync(() => root.render(slot(scope)));');
    expect(result.closureBlock).toContain('return () => {');
  });
});
