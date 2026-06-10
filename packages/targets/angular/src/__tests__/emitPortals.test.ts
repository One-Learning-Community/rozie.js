/**
 * emitPortals — Angular-target unit coverage (quick-260521-spv).
 *
 * Drives `emitPortals.ts` past the `portals.length === 0` early return:
 * the portal-emitting body (`buildSlotMethod`, `setAttrLine`, fieldDecls,
 * closure + destroyRegister blocks) is exercised here directly.
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

describe('emitPortals — Angular', () => {
  it('no portal slots → early return with empty fields', () => {
    const ir = buildMinimalIR({ slots: [] });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(false);
    expect(result.templateAppend).toBe('');
    expect(result.fieldDecls).toEqual([]);
    expect(result.closureBlock).toBe('');
    expect(result.destroyRegister).toBe('');
    expect(result.needsDestroyRefField).toBe(false);
    expect(result.angularImports).toEqual([]);
  });

  it('one portal slot → happy path (PortalList example)', () => {
    const ir = lowerExample('PortalList');
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.templateAppend).toContain('rozie_portalAnchor');
    expect(result.fieldDecls.some((l) => l.includes("contentChild('item'"))).toBe(true);
    expect(result.fieldDecls.some((l) => l.includes('_itemTpl'))).toBe(true);
    expect(result.fieldDecls.some((l) => l.includes('_portalAnchor'))).toBe(true);
    expect(result.fieldDecls.some((l) => l.includes('_portalViews'))).toBe(true);
    expect(result.closureBlock).toContain('createEmbeddedView');
    expect(result.closureBlock).toContain('item:');
    expect(result.destroyRegister).toContain('onDestroy');
    expect(result.needsDestroyRefField).toBe(true);
    expect(result.angularImports).toContain('TemplateRef');
    expect(result.angularImports).toContain('ViewContainerRef');
    expect(result.angularImports).toContain('contentChild');
    expect(result.angularImports).toContain('viewChild');
    expect(result.angularImports).toContain('DestroyRef');
  });

  it('multiple portal slots → both names in joined output', () => {
    const ir = buildMinimalIR({
      slots: [portalSlot('header', ['h']), portalSlot('footer', ['f'])],
    });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.closureBlock).toContain('header:');
    expect(result.closureBlock).toContain('footer:');
    expect(result.fieldDecls.some((l) => l.includes('_headerTpl'))).toBe(true);
    expect(result.fieldDecls.some((l) => l.includes('_footerTpl'))).toBe(true);
  });

  it('scopeHash empty vs non-empty → setAttrLine both arms', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('item', ['item'])] });
    const empty = emitPortals(ir, '');
    expect(empty.closureBlock).not.toContain('container.setAttribute');

    const scoped = emitPortals(ir, 'abc123');
    expect(scoped.closureBlock).toContain('container.setAttribute(');
    expect(scoped.closureBlock).toContain('abc123');
  });

  it('portalParamNames present vs absent → scopeType branch', () => {
    const withParams = emitPortals(
      buildMinimalIR({ slots: [portalSlot('item', ['item'])] }),
    );
    expect(withParams.closureBlock).toContain('{ item: unknown }');

    const noParams = emitPortals(buildMinimalIR({ slots: [portalSlot('item')] }));
    expect(noParams.closureBlock).toContain('scope: unknown');
  });

  // ── Phase 33 / REQ-21, REQ-22 — reactive portal branch ───────────────────
  it('reactive portal slot → Object.assign(view.context)+detectChanges + { update, dispose }', () => {
    const ir = buildMinimalIR({ slots: [reactivePortalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir);
    expect(result.closureBlock).toContain('interface ReactivePortalHandle');
    expect(result.closureBlock).toContain('nodeView: (container');
    expect(result.closureBlock).toContain('ReactivePortalHandle => {');
    // REQ-21: mutate context IN PLACE + detectChanges; NEVER recreate the view.
    expect(result.closureBlock).toContain('Object.assign(view.context as object, s as object)');
    expect(result.closureBlock).toContain('view.detectChanges()');
    expect(result.closureBlock).toContain('update: (s: unknown): void => {');
    expect(result.closureBlock).toContain('dispose: (): void => {');
    // create exactly once — the update path must not re-create the embedded view.
    const createCount = (result.closureBlock.match(/createEmbeddedView/g) ?? []).length;
    expect(createCount).toBe(1);
  });

  it('non-reactive portal slot → mount-once () => void body verbatim (byte-identical regression guard)', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('nodeView', ['node', 'selected'])] });
    const result = emitPortals(ir);
    expect(result.closureBlock).not.toContain('ReactivePortalHandle');
    expect(result.closureBlock).not.toContain('Object.assign(view.context');
    expect(result.closureBlock).toContain('): (() => void) => {');
    expect(result.closureBlock).toContain('view.destroy();');
    expect(result.closureBlock).toContain('return () => {');
  });

  // ── Phase 37 — $portals.default (DEFAULT portal slot) ─────────────────────
  it('DEFAULT portal slot → closure key `default`, queries the `defaultSlot` ref', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('', ['id', 'label'])] });
    const result = emitPortals(ir);
    expect(result.hasPortals).toBe(true);
    expect(result.closureBlock).toContain('default: (container');
    expect(result.closureBlock).not.toContain("'': (container");
    // Default slot queries the synthetic `defaultSlot` content-projection ref
    // into `_defaultTpl` (the same ref the non-portal default slot uses).
    expect(result.fieldDecls.some((l) => l.includes("contentChild('defaultSlot'"))).toBe(true);
    expect(result.fieldDecls.some((l) => l.includes('_defaultTpl'))).toBe(true);
    expect(result.closureBlock).toContain('this._defaultTpl()');
  });

  it('GATE: a NAMED portal slot is byte-unaffected by the default-portal feature', () => {
    const ir = buildMinimalIR({ slots: [portalSlot('item', ['item'])] });
    const result = emitPortals(ir);
    expect(result.closureBlock).toContain('item: (container');
    expect(result.fieldDecls.some((l) => l.includes("contentChild('item'"))).toBe(true);
    expect(result.fieldDecls.some((l) => l.includes('_itemTpl'))).toBe(true);
    expect(result.closureBlock).not.toContain('default: (container');
    expect(result.fieldDecls.some((l) => l.includes("contentChild('defaultSlot'"))).toBe(false);
  });
});
