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
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
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
// Named live-POSITIVE / live-NEGATIVE pair (re-anchored in the Wave-3 ROZ088 pilot).
// The live-NEGATIVE is FlowCanvasDemo: Phase 41 reworked it to the controlled-graph
// model and styles its portal `.rozie-demo-node` chrome via the `:root {}` escape
// hatch — so it is ROZ088-CLEAN (the latent Lit bug is fixed). The former live-negative
// FlowCanvasDeclarativeDemo was retired in Phase 41.
// The live-POSITIVE was PortalListDemo until the Wave-3 ROZ088 pilot fixed it the same
// way (moved its portal `.portal-list-demo__*` cosmetics into a `:root {}` block +
// `adopt-document-styles` on the PortalList wrapper) — so PortalListDemo is now ROZ088-
// CLEAN too (a D2-style negative). The live-POSITIVE is now PortalListStyledDemo — the
// PERMANENT ROZ088 canary (Wave-3 complete, 2026-06-14). It is deliberately NOT fixed:
// its `.row { display: contents }` rule is the subject of the 260520-bu7 cross-target
// @portal CSS-specificity fixture (it must stay a SCOPED rule to compete with the
// wrapper's `@portal item { div { display:flex } }`), and the demo already renders
// byte-identical on Lit (PortalListStyled.png 6/6 — no visible bug). It legitimately
// flags ROZ088 on its scoped portal-exclusive rules, making it the natural live-positive
// that proves the detector still fires. DO NOT "fix" it — that would defeat the fixture
// (decision: Dan, 2026-06-14).
const POS_PATH = resolve(REPO_ROOT, 'examples/demos/PortalListStyledDemo.rozie');
const NEG_PATH = resolve(REPO_ROOT, 'examples/demos/FlowCanvasDemo.rozie');

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

  // ---- WR-01 regression: comma/group TAG selector order-independence. ------
  // A `strong, em { }` group selector where the portal-exclusive tag (`strong`)
  // is listed FIRST must still flag. The pre-fix code kept only the LAST tag
  // sub-selector (`em`, NOT portal-exclusive) and silently never fired — an
  // order-dependent false negative. `subject.tags` now accumulates BOTH.
  // `em` is rendered in non-portal content so it is NOT portal-exclusive, which
  // is exactly the asymmetry that exposed the last-wins bug.
  it('(C3 / WR-01) comma TAG selector with the portal-exclusive tag listed FIRST (`strong, em`) → flags', () => {
    const ir = stubIR(
      el('div', [], [
        el('em'), // non-portal `em` → `em` is NOT portal-exclusive
        component('FlowNode', [
          // `strong` appears ONLY inside the portal fill → portal-exclusive.
          filler('body', [el('strong')], { isPortal: true }),
        ]),
      ]),
      [rule('strong, em')],
    );
    expect(run(ir)).toHaveLength(1);
  });

  it('(C4 / WR-01) reversed comma TAG selector (`em, strong`) still flags → order-independent', () => {
    const ir = stubIR(
      el('div', [], [
        el('em'), // non-portal `em` → `em` is NOT portal-exclusive
        component('FlowNode', [
          filler('body', [el('strong')], { isPortal: true }),
        ]),
      ]),
      [rule('em, strong')],
    );
    expect(run(ir)).toHaveLength(1);
  });
});

// ===========================================================================
// (D) LIVE VALIDATION — the real positive/negative pair, driven through
// compile() so threading actually populates filler.isPortal.
// ===========================================================================

describe('validatePortalScopedStyle [Phase 38] — live validation through compile()', () => {
  it('(D1) POSITIVE: PortalListStyledDemo.rozie portal `.swatch`/`.id`/`.label` rules flag', () => {
    const pos = compile(readFileSync(POS_PATH, 'utf8'), {
      target: 'lit',
      filename: POS_PATH,
      resolverRoot: REPO_ROOT,
    });
    const warns = pos.diagnostics.filter((d) => d.code === ROZ088);
    expect(warns.length).toBeGreaterThanOrEqual(1);
    // A portal-exclusive cosmetic content class (filled into the `#item` portal
    // slot — ROZ088 messages name the bare subject class) is flagged.
    expect(warns.some((d) => d.message.includes('swatch'))).toBe(true);
  });

  it('(D2) NEGATIVE: FlowCanvasDemo.rozie (`.rozie-demo-node` in :root{}, Phase-41 rework) → 0 ROZ088', () => {
    const neg = compile(readFileSync(NEG_PATH, 'utf8'), {
      target: 'lit',
      filename: NEG_PATH,
      resolverRoot: REPO_ROOT,
    });
    expect(neg.diagnostics.filter((d) => d.code === ROZ088)).toHaveLength(0);
  });
});

// ===========================================================================
// (E) REPO-WIDE AUDIT — compile every demo in examples/demos/ through
// compile() (target:'lit', filename + resolverRoot=repo root so producer
// resolution threads filler.isPortal) and assert the set of ROZ088-flagged
// files exactly equals a pinned baseline.
//
// ─── BASELINE — Wave-3 ROZ088 fixes COMPLETE (2026-06-14) ──────────────────
// The Wave-3 effort (quick-task 260614-ky0) fixed all 10 latent portal-styling
// demos: each had a plain scoped `<style>` rule whose subject is portal-
// exclusive (a latent Lit shadow-DOM styling bug invisible to every behavioral/
// typecheck/screenshot gate), now routed through the `:root {}` escape hatch +
// `adopt-document-styles` on the wrapper, and each verified byte-identical 6/6
// in the pinned Linux container (no rebless needed). The original diagnostic was
// Plan 38-02 (Phase 38, emit-neutral D-02); the worklist was
// `.planning/todos/pending/portal-scoped-style-lit-wave3-fixes.md`.
// EXACTLY ONE entry remains, by design — the permanent canary (see below).
//
//   - PortalListStyledDemo is the named live-POSITIVE (D1/E2 below) and the SOLE
//     permanent member of the expected set.
//   - FlowCanvasDemo is the named live-NEGATIVE (Phase 41 reworked it to style
//     its portal `.rozie-demo-node` chrome via `:root {}`, D2 below); it MUST
//     NOT be a member. (FlowCanvasDeclarativeDemo, the former negative, was
//     retired in Phase 41.)
//   - All 10 fixable demos were fixed in Wave 3 (portal-content scoped rules
//     moved to the `:root {}` escape hatch + `adopt-document-styles`; each
//     verified byte-identical 6/6 in the pinned Linux container).
//   - PortalListStyledDemo is the PERMANENT CANARY — deliberately NOT fixed.
//     Its `.row { display: contents }` rule is the subject of the 260520-bu7
//     cross-target @portal CSS-specificity fixture (must stay a SCOPED rule to
//     compete with the wrapper's `@portal item { div { display:flex } }`), and
//     it already renders byte-identical on Lit (no visible bug). It legitimately
//     flags ROZ088, serving as the live-positive that proves the detector fires.
//     DO NOT fix it (decision: Dan, 2026-06-14).
//
// Wave 3 has landed: the EXPECTED set is now its permanent floor (the canary).
// The assertion still fails loudly on BOTH a NEW unexpected positive (a freshly-
// introduced latent bug, or a precision regression in the pass) AND an unexpected
// DISAPPEARANCE (the canary silently stopped flagging — e.g. a threading
// regression making the pass vacuous, or someone "fixed" the canary).
// ===========================================================================

describe('validatePortalScopedStyle [Phase 38] — repo-wide audit', () => {
  // Sorted basenames of every demo currently flagged by ROZ088 (the pre-fix
  // baseline — empirically derived, see header comment). Keep sorted.
  const EXPECTED_ROZ088_FILES = [
    // CodeMirrorDemo.rozie REMOVED in the Wave-3 ROZ088 CodeMirror family batch —
    // its five portal-exclusive cosmetics (`.cm-panel-fill` / `.cm-toppanel-fill`
    // / `.cm-tooltip-fill` / `.cm-gutter-fill` / `.cm-deco-fill`, the demo's own
    // custom markup filled into the panel / topPanel / tooltip / gutter /
    // decoration portal slots) were moved into a host-qualified `:root {}`
    // escape-hatch block (.rozie-codemirror .cm-*-fill) + `adopt-document-styles`
    // on the CodeMirror wrapper (now ROZ088-clean, a D2-style negative). Lockstep
    // tightening per the audit's own contract.
    // ChartBehaviorDemo.rozie REMOVED in the Wave-3 ROZ088 Chart family batch —
    // its portal-exclusive cosmetic (`.rozie-demo-tip`, the demo's external-HTML
    // tooltip markup filled into the `tooltip` portal slot) was moved into a
    // host-qualified `:root {}` escape-hatch block (.rozie-chart .rozie-demo-tip)
    // + `adopt-document-styles` on the Chart wrapper (now ROZ088-clean, a
    // D2-style negative). Lockstep tightening per the audit's own contract.
    // FlowCanvasDemo.rozie REMOVED in Phase 41 — reworked to style its portal
    // `.rozie-demo-node` chrome via the `:root {}` escape hatch (now ROZ088-clean,
    // the D2 live-negative). Lockstep tightening per the audit's own contract.
    // FullCalendarDemo / FullCalendarAllSlotsDemo / FullCalendarSlotsDemo
    // REMOVED in the Wave-3 ROZ088 FullCalendar family batch — their portal-
    // exclusive cosmetics (`.fc-event-title`, `.fc-slot-marker`, `.fc-slot-event`
    // / `.fc-slot-daycell` / `.fc-slot-dayheader`) were moved into host-qualified
    // `:root {}` escape-hatch blocks + `adopt-document-styles` on the FullCalendar
    // wrapper (now ROZ088-clean, D2-style negatives). Lockstep tightening per the
    // audit's own contract.
    // MapLibreDemo.rozie REMOVED in the Wave-3 ROZ088 MapLibre family batch —
    // its two portal-exclusive cosmetics (`.rozie-demo-pin`, the demo's pin
    // markup filled into the reactive multi-instance `marker` portal slot, and
    // `.demo-ctrl-btn`, the demo's button filled into the mount-once `control`
    // portal slot) were moved into a host-qualified `:root {}` escape-hatch block
    // (.rozie-maplibre .rozie-demo-pin / .rozie-maplibre .demo-ctrl-btn). The
    // MapLibre wrapper already carries `adopt-document-styles` (no wrapper edit —
    // now ROZ088-clean, a D2-style negative). Lockstep tightening per the audit's
    // own contract.
    // PortalListDemo.rozie REMOVED in the Wave-3 ROZ088 pilot — its portal
    // `.portal-list-demo__*` cosmetics were moved into a `:root {}` escape-hatch
    // block + `adopt-document-styles` on the PortalList wrapper (now ROZ088-clean,
    // a D2-style negative). Lockstep tightening per the audit's own contract.
    //
    // PortalListStyledDemo.rozie — the PERMANENT ROZ088 canary (NOT a pending fix).
    // Its `.row { display: contents }` is the 260520-bu7 @portal CSS-specificity
    // fixture and MUST stay a SCOPED rule; the demo already renders byte-identical
    // on Lit (no visible bug). Kept flagged on purpose as the live-positive that
    // proves the detector still fires — DO NOT remove or "fix" (decision: Dan 2026-06-14).
    'PortalListStyledDemo.rozie',
    // TipTapBubbleMenuDemo / TipTapNodeViewDemo / TipTapNodeViewScreenshotDemo
    // REMOVED in the Wave-3 ROZ088 TipTap family batch — their portal-exclusive
    // cosmetics (`.rozie-menu`, `.rozie-mention-chip`, `.rozie-callout*`) were
    // moved into host-qualified `:root {}` escape-hatch blocks + `adopt-document-
    // styles` on the TipTap wrapper (now ROZ088-clean, D2-style negatives).
    // Lockstep tightening per the audit's own contract.
  ];

  const DEMOS_DIR = resolve(REPO_ROOT, 'examples/demos');

  /** Compile every examples/demos/*.rozie and return the sorted set of files that flag ≥1 ROZ088. */
  function flaggedCorpusFiles(): string[] {
    const flagged: string[] = [];
    const demoFiles = readdirSync(DEMOS_DIR)
      .filter((f) => f.endsWith('.rozie'))
      .sort();
    for (const f of demoFiles) {
      const p = resolve(DEMOS_DIR, f);
      // resolverRoot=repo root + absolute filename so consumer demos with
      // <components> imports to the @rozie-ui producers thread filler.isPortal.
      const res = compile(readFileSync(p, 'utf8'), {
        target: 'lit',
        filename: p,
        resolverRoot: REPO_ROOT,
      });
      if (res.diagnostics.some((d) => d.code === ROZ088)) flagged.push(f);
    }
    return flagged.sort();
  }

  // IN-01: compile the whole demo corpus ONCE for the block. E1 and E2 both
  // read this shared result instead of independently re-running
  // `flaggedCorpusFiles()` — halving the compile count and the documented
  // cold-build race-flake surface.
  let cachedFlagged: string[];

  beforeAll(() => {
    cachedFlagged = flaggedCorpusFiles();
  });

  it('(E1) the ROZ088-flagged corpus set EXACTLY equals the pinned pre-fix baseline', () => {
    const flagged = cachedFlagged;

    const unexpected = flagged.filter((f) => !EXPECTED_ROZ088_FILES.includes(f));
    const missing = EXPECTED_ROZ088_FILES.filter((f) => !flagged.includes(f));

    // Surface BOTH directions loudly (no silent allow-list).
    expect(
      unexpected,
      `NEW unexpected ROZ088 positive(s) in the demo corpus: ${unexpected.join(
        ', ',
      )}. Each is either a real latent Lit shadow-DOM styling bug (log it to .planning/todos/) ` +
        `or a precision regression in validatePortalScopedStyle. Do NOT silently allow-list — triage it.`,
    ).toEqual([]);
    expect(
      missing,
      `Expected ROZ088 positive(s) DISAPPEARED from the demo corpus: ${missing.join(
        ', ',
      )}. Either the pass regressed (threading went vacuous) or a demo was fixed out-of-band ` +
        `without tightening EXPECTED_ROZ088_FILES. Update the baseline in lockstep with any Wave 3 fix.`,
    ).toEqual([]);

    expect(flagged).toEqual(EXPECTED_ROZ088_FILES);
  });

  it('(E2) PortalListStyledDemo (the SPEC live-positive) IS flagged; FlowCanvasDemo (the :root live-negative) is NOT', () => {
    expect(cachedFlagged).toContain(basename(POS_PATH)); // PortalListStyledDemo.rozie
    expect(cachedFlagged).not.toContain(basename(NEG_PATH)); // FlowCanvasDemo.rozie
  });
});
