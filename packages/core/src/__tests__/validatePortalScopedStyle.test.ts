// Phase 38 (portal-scoped-style Lit diagnostic) — core
// `validatePortalScopedStyle` test.
//
// A plain SCOPED `<style>` rule whose subject class/tag is used EXCLUSIVELY
// inside portal-slot fill content teleports into the wrapper's shadow root on
// Lit, where the consumer's `[data-rozie-s-*]` scope attribute is absent — so
// the scoped rule silently never applies. Correct on the 5 light-DOM targets,
// broken on Lit, invisible to every other gate. This pass turns that into a
// collected warning (ROZ088 STYLE_SCOPED_RULE_TARGETS_PORTAL_CONTENT), steering
// the author to the `:root { }` engine-DOM escape hatch (Phase 34).
//
// The pass runs AFTER `threadParamTypes` (compile.ts), because `filler.isPortal`
// is set only at threadParamTypes.ts:284 — NOT inside `lowerToIR` like the
// validateSlotPropCollision/validateClassSelector analogs. So:
//   - the live-validation pair drives `compile()` (which threads) with a
//     `filename` + `resolverRoot` so the demo's `<components>` import to the
//     FlowCanvas producer resolves and `isPortal` is populated; and
//   - the deterministic unit cases construct the IR DIRECTLY (with
//     `filler.isPortal` already set) and call the pass — no filesystem, no
//     threading-order flakiness.
//
// The POSITIVE case is asserted FIRST so a silent producer/threading failure
// can't make the negatives pass vacuously.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExpression } from '@babel/parser';
import { compile } from '../compile.js';
import { validatePortalScopedStyle } from '../ir/validatePortalScopedStyle.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type {
  IRComponent,
  TemplateElementIR,
  TemplateNode,
  AttributeBinding,
  SlotFillerDecl,
  StyleSection,
} from '../ir/types.js';
import type { StyleRule } from '../ast/blocks/StyleAST.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

const ROZ088 = RozieErrorCode.STYLE_SCOPED_RULE_TARGETS_PORTAL_CONTENT; // 'ROZ088'

const __dirname = dirname(fileURLToPath(import.meta.url));
// packages/core/src/__tests__ → repo root is four levels up.
const REPO_ROOT = resolve(__dirname, '../../../../');
const POS_PATH = resolve(REPO_ROOT, 'examples/demos/FlowCanvasDemo.rozie');
const NEG_PATH = resolve(
  REPO_ROOT,
  'examples/demos/FlowCanvasDeclarativeDemo.rozie',
);

const LOC = { start: 0, end: 0 };
let RULE_LOC_SEQ = 1000;

// ---------------------------------------------------------------------------
// IR construction helpers — narrow stubs exposing only the regions the pass
// reads (`ir.template`, `ir.styles.scopedRules`). A narrow cast keeps the
// fixtures honest without faking a whole component.
// ---------------------------------------------------------------------------

/** A `class="a b"` static AttributeBinding. */
function classAttr(value: string): AttributeBinding {
  return { kind: 'static', name: 'class', value, sourceLoc: LOC };
}

/** A `:class="{ 'x': y }"` object-binding AttributeBinding (keys = class names). */
function classObjAttr(objSrc: string): AttributeBinding {
  return {
    kind: 'binding',
    name: 'class',
    expression: parseExpression(objSrc),
    deps: [],
    sourceLoc: LOC,
  };
}

/** A plain HTML element node. */
function el(
  tagName: string,
  attributes: AttributeBinding[] = [],
  children: TemplateNode[] = [],
): TemplateElementIR {
  return {
    type: 'TemplateElement',
    tagName,
    attributes,
    events: [],
    listenerSpreads: [],
    children,
    sourceLoc: LOC,
    tagKind: 'html',
  };
}

/** A component element carrying slot fillers. */
function component(
  tagName: string,
  fillers: SlotFillerDecl[],
  children: TemplateNode[] = [],
): TemplateElementIR {
  return {
    type: 'TemplateElement',
    tagName,
    attributes: [],
    events: [],
    listenerSpreads: [],
    children,
    sourceLoc: LOC,
    tagKind: 'component',
    slotFillers: fillers,
  };
}

/** A slot filler. */
function filler(
  name: string,
  body: TemplateNode[],
  opts: { isPortal?: boolean; isDynamic?: boolean } = {},
): SlotFillerDecl {
  const f: SlotFillerDecl = {
    type: 'SlotFillerDecl',
    name,
    params: [],
    body,
    sourceLoc: LOC,
  };
  if (opts.isPortal !== undefined) f.isPortal = opts.isPortal;
  if (opts.isDynamic !== undefined) f.isDynamic = opts.isDynamic;
  return f;
}

/** A `StyleRule` with a recognisable per-call loc. */
function rule(selector: string, kind?: StyleRule['kind']): StyleRule {
  const start = RULE_LOC_SEQ++;
  const r: StyleRule = {
    selector,
    loc: { start, end: start + selector.length },
    isRootEscape: false,
  };
  if (kind) r.kind = kind;
  return r;
}

/** Build a stub `IRComponent` exposing only `template` + `styles.scopedRules`. */
function stubIR(
  template: TemplateNode | null,
  scopedRules: StyleRule[],
): IRComponent {
  const styles: Partial<StyleSection> = {
    type: 'StyleSection',
    scopedRules,
    rootRules: [],
    portalRules: [],
    engineRules: [],
    sourceLoc: LOC,
  };
  return { template, styles } as unknown as IRComponent;
}

/** Run the pass over a hand-built IR and return only ROZ088 diagnostics. */
function run(ir: IRComponent): Diagnostic[] {
  const diags: Diagnostic[] = [];
  validatePortalScopedStyle(ir, diags);
  return diags.filter((d) => d.code === ROZ088);
}

// ===========================================================================
// (A) POSITIVE — asserted FIRST (a silent threading failure can't make the
// negatives pass vacuously).
// ===========================================================================

describe('validatePortalScopedStyle [Phase 38] — direct IR (positive first)', () => {
  it('(A1) a scoped rule whose class appears EXCLUSIVELY in a portal fill → exactly one ROZ088', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler('node', [el('div', [classAttr('rozie-demo-node')])], {
          isPortal: true,
        }),
      ]),
      [rule('.rozie-demo-node')],
    );

    const warns = run(ir);
    expect(warns).toHaveLength(1);
    const d = warns[0]!;
    expect(d.severity).toBe('warning');
    // D-03: message names the offending selector AND the portal slot + child.
    expect(d.message).toContain('rozie-demo-node');
    expect(d.message).toContain('node'); // slot name
    expect(d.message).toContain('FlowNode'); // child component
    // Primary frame anchors at the offending <style> rule (D-03).
    expect(d.loc.start).toBeGreaterThan(0);
    // Hint steers toward the :root {} engine-DOM escape hatch.
    expect(d.hint).toBeDefined();
    expect(d.hint).toContain(':root');
  });

  it('(A2) a portal-exclusive TAG subject (`strong`) → flags', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler('body', [el('strong', [], [])], { isPortal: true }),
      ]),
      [rule('strong')],
    );
    expect(run(ir)).toHaveLength(1);
  });

  it('(A3) `$portals.default` (name==="") portal-exclusive class → flags', () => {
    const ir = stubIR(
      component('Host', [
        filler('', [el('div', [classAttr('teleported')])], { isPortal: true }),
      ]),
      [rule('.teleported')],
    );
    expect(run(ir)).toHaveLength(1);
  });

  it('(A4) object `:class` key used exclusively in a portal fill → flags', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler(
          'node',
          [el('div', [classObjAttr("{ 'is-selected': selected }")])],
          { isPortal: true },
        ),
      ]),
      [rule('.is-selected')],
    );
    expect(run(ir)).toHaveLength(1);
  });
});

// ===========================================================================
// (B) NEGATIVE set — each → 0 ROZ088.
// ===========================================================================

describe('validatePortalScopedStyle [Phase 38] — negatives (0 ROZ088)', () => {
  it('(B1) dual-use: the class also appears in NON-portal content → no warn (D-01)', () => {
    const ir = stubIR(
      el('div', [], [
        el('span', [classAttr('shared')]), // non-portal occurrence
        component('FlowNode', [
          filler('node', [el('div', [classAttr('shared')])], {
            isPortal: true,
          }),
        ]),
      ]),
      [rule('.shared')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B2) the fill is a NON-portal slot fill → no warn', () => {
    const ir = stubIR(
      component('Card', [
        filler('body', [el('div', [classAttr('card-inner')])], {
          isPortal: false,
        }),
      ]),
      [rule('.card-inner')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B3) dynamic `<template #[expr]>` fill → no warn (isDynamic never threads isPortal)', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler('node', [el('div', [classAttr('dyn-node')])], {
          isPortal: true,
          isDynamic: true,
        }),
      ]),
      [rule('.dyn-node')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B4) combinator selector (`.card strong`) → no warn (D-05)', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler(
          'node',
          [el('div', [classAttr('card')], [el('strong')])],
          { isPortal: true },
        ),
      ]),
      [rule('.card strong')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B5) attribute selector (`.card[data-x]`) → no warn (D-05)', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler('node', [el('div', [classAttr('card')])], { isPortal: true }),
      ]),
      [rule('.card[data-x]')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B6) id selector (`#card`) → no warn (D-05)', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler('node', [el('div', [classAttr('card')])], { isPortal: true }),
      ]),
      [rule('#card')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B7) pseudo selector (`.card:hover`) → no warn (D-05)', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler('node', [el('div', [classAttr('card')])], { isPortal: true }),
      ]),
      [rule('.card:hover')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B8) tag subject (`strong`) also used in NON-portal content → no warn', () => {
    const ir = stubIR(
      el('div', [], [
        el('strong'), // non-portal occurrence
        component('FlowNode', [
          filler('body', [el('strong')], { isPortal: true }),
        ]),
      ]),
      [rule('strong')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B9) a class-subject rule does NOT match a portal-exclusive TAG of the same name', () => {
    // `.card` selector vs a `<card>` tag in portal content — class≠tag.
    const ir = stubIR(
      component('FlowNode', [
        filler('node', [el('card')], { isPortal: true }),
      ]),
      [rule('.card')],
    );
    expect(run(ir)).toHaveLength(0);
  });

  it('(B10) null template → no warn (no throw)', () => {
    const ir = stubIR(null, [rule('.anything')]);
    expect(run(ir)).toHaveLength(0);
  });
});

// ===========================================================================
// (C) EDGE — per-rule dedup + compound subjects.
// ===========================================================================

describe('validatePortalScopedStyle [Phase 38] — edge cases', () => {
  it('(C1) a portal-exclusive class matching MULTIPLE fills → at most one ROZ088 per rule', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler('node', [el('div', [classAttr('chip')])], { isPortal: true }),
        filler('body', [el('span', [classAttr('chip')])], { isPortal: true }),
      ]),
      [rule('.chip')],
    );
    // Two portal fills both using `.chip`, ONE scoped rule → exactly one warn.
    expect(run(ir)).toHaveLength(1);
  });

  it('(C2) compound class selector (`.a.b`, combinator-free) flags when ANY token is portal-exclusive', () => {
    const ir = stubIR(
      component('FlowNode', [
        filler(
          'node',
          [
            el('div', [
              classAttr('node-box'),
              classObjAttr("{ 'is-selected': selected }"),
            ]),
          ],
          { isPortal: true },
        ),
      ]),
      [rule('.node-box.is-selected')],
    );
    expect(run(ir)).toHaveLength(1);
  });
});

// ===========================================================================
// (D) LIVE VALIDATION — the real positive/negative pair, driven through
// compile() so threading actually populates filler.isPortal.
// ===========================================================================

describe('validatePortalScopedStyle [Phase 38] — live validation through compile()', () => {
  it('(D1) POSITIVE: FlowCanvasDemo.rozie `.rozie-demo-node` flags, and only portal classes flag', () => {
    const pos = compile(readFileSync(POS_PATH, 'utf8'), {
      target: 'lit',
      filename: POS_PATH,
      resolverRoot: REPO_ROOT,
    });
    const warns = pos.diagnostics.filter((d) => d.code === ROZ088);
    expect(warns.length).toBeGreaterThanOrEqual(1);
    expect(warns.some((d) => d.message.includes('rozie-demo-node'))).toBe(true);
    // The non-portal classes (.flow-demo / .controls / .readout) must NOT flag.
    expect(
      warns.some((d) => /\b(flow-demo|controls|readout)\b/.test(d.message)),
    ).toBe(false);
  });

  it('(D2) NEGATIVE: FlowCanvasDeclarativeDemo.rozie (.demo-card in :root{}) → 0 ROZ088', () => {
    const neg = compile(readFileSync(NEG_PATH, 'utf8'), {
      target: 'lit',
      filename: NEG_PATH,
      resolverRoot: REPO_ROOT,
    });
    expect(neg.diagnostics.filter((d) => d.code === ROZ088)).toHaveLength(0);
  });
});
