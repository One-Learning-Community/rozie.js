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
});
