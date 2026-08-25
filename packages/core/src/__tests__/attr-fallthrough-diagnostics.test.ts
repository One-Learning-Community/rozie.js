// Phase 14 Plan 14-01 (Wave 0 scaffold) — fallthrough diagnostics (R8/R9).
//
// Two fallthrough-time diagnostics, both detected during lowering and
// collected-not-thrown:
//   - ROZ970 ATTR_FALLTHROUGH_MULTI_ROOT (R8 — error): a multi-root template
//     with auto-fallthrough enabled has no single root to receive the
//     inherited attributes. `inherit-attrs="false"` suppresses it.
//   - ROZ971 ATTR_DOUBLE_APPLY (R9 — warning): `$attrs` is referenced
//     explicitly (e.g. `r-bind="$attrs"`) while auto-fallthrough is still on,
//     so the attributes would be applied twice. `inherit-attrs="false"`
//     suppresses it.
//
// Both ROZ970 and ROZ971 cases are INTENTIONALLY RED. Wave 1 (Plan 14-02)
// adds the lowerTemplate / lowerToIR passes that emit them. The
// `RozieErrorCode` symbols already exist (Task 1 registered them). The
// diagnostic is COLLECTED — these tests assert on the diagnostic array, never
// `.toThrow()`.
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';

/** Compile an inline `.rozie` source (Vue target) and return diagnostics. */
function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'vue',
    filename: 'AttrFallthrough.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

/** Compile an inline `.rozie` source (Vue target) and return the emitted code. */
function compileCode(source: string): string {
  return compile(source, {
    target: 'vue',
    filename: 'AttrFallthrough.rozie',
    types: false,
    sourceMap: false,
  }).code;
}

// A two-root template — two sibling elements at the template top level, no
// single wrapping root to absorb inherited attributes.
const MULTI_ROOT_BODY = `<header></header>
<main></main>`;

// A single-root template that ALSO references $attrs explicitly via a
// bare-spread r-bind — the double-apply shape.
const SINGLE_ROOT_DOUBLE_APPLY = `<div r-bind="$attrs"></div>`;

// Phase 82: one real element + a bare <slot> sibling — the shape Plan 82-02
// must stop classifying as multi-root (Strategy B, D-01).
const ELEMENT_PLUS_SLOT_BODY = `<div class="wrap"></div>
<slot />`;

// Phase 82: the same two nodes in the opposite order — `packages/ui/rete/src/
// NodeType.rozie` is authored slot-first, so order-independence is a real
// requirement, not a hypothetical (82-PLAN.md Task 2).
const ELEMENT_AFTER_SLOT_BODY = `<slot />
<div class="wrap"></div>`;

// Phase 82 regression guard: two slot invocations and NO element. There is no
// element anywhere in this body to receive the spread, so ROZ970 must survive
// Plan 82-02's slot-tolerant generalization untouched.
const TWO_SLOTS_NO_ELEMENT_BODY = `<slot />
<slot name="footer" />`;

// Phase 82 regression guard: a real element PLUS a conditional sibling (not a
// slot). Only slot invocations are non-disqualifying per D-01/D-06 — a second
// candidate root that is a conditional must keep erroring.
const ELEMENT_PLUS_CONDITIONAL_BODY = `<div class="wrap"></div>
<span r-if="$props.show"></span>`;

// Phase 82: a lone r-if-gated root — Correction 3 / D-02's silent-drop repro
// (`examples/Modal.rozie` / `examples/PortalOverlay.rozie` are authored this
// way). `countRootElements` reports exactly 1 (a TemplateConditional root is
// one structural root), so ROZ970 never fires; `synthesizeAttrsFallthrough`
// also cannot resolve an element to receive the spread. Before ROZ098
// existed this combination silently dropped the consumer's attributes with
// no compile-time signal at all.
const CONDITIONAL_ROOT_BODY = `<div class="wrap" r-if="$props.show"></div>`;

// WR-01: an `r-match` root authored on a REAL element — the host `<div>` is
// rendered UNCONDITIONALLY and only the content nested inside it varies per
// branch (`TemplateMatchIR.hostElement`, types.ts:1334). This is NOT an
// element-less shape, so ROZ098 must not fire and the synthesized `$attrs`
// spread has an obvious destination: the host itself.
const MATCH_HOST_ROOT_BODY = `<div class="wrap" r-match="'a'">
  <span r-case="'a'">a</span>
  <span r-default>default</span>
</div>`;

// WR-01 over-reach guard: the SAME rungs under a non-rendering
// `<template r-match>` host. There is no unconditional element here, so
// ROZ098 must KEEP firing — this shape stays D-02-deferred.
const TEMPLATE_MATCH_ROOT_BODY = `<template r-match="'a'">
  <span r-case="'a'">a</span>
  <span r-default>default</span>
</template>`;

// WR-01 follow-up (code review): a COMPONENT-tag `r-match` host. The wrapper
// renders unconditionally, but Plan 14-05 skips synthesis on a non-`html`
// root — the spread would land as a prop on the inner component rather than
// as a DOM attribute — so this shape still drops the consumer's attributes
// and must keep a diagnostic. Keying the exemption on host PRESENCE alone
// would have silenced it, splitting the validator's predicate from the
// synthesizer's: exactly the drift class that caused WR-01.
const COMPONENT_MATCH_HOST_BODY = `<Foo r-match="$props.status">
  <span r-case="'a'">a</span>
  <span r-default>default</span>
</Foo>`;

/** Declares a `Foo` child component so COMPONENT_MATCH_HOST_BODY resolves. */
function rozieWithComponent(openTag: string, templateBody: string): string {
  return `${openTag}
<components>
{ Foo: './Foo.rozie' }
</components>
<props>
{ status: { type: String, default: 'a' } }
</props>
<template>
${templateBody}
</template>
</rozie>
`;
}

function rozie(openTag: string, templateBody: string): string {
  return `${openTag}
<template>
${templateBody}
</template>
</rozie>
`;
}

// Phase 82: `CONDITIONAL_ROOT_BODY` and `ELEMENT_PLUS_CONDITIONAL_BODY` both
// read `$props.show` — declare it so $props.show resolves and no unrelated
// ROZ100 (UNKNOWN_PROPS_REF) fires alongside the fallthrough assertions.
function rozieWithShowProp(openTag: string, templateBody: string): string {
  return `${openTag}
<props>
{ show: { type: Boolean, default: true } }
</props>
<template>
${templateBody}
</template>
</rozie>
`;
}

describe('attribute-fallthrough diagnostics (Phase 14 R8/R9)', () => {
  it('R8: a multi-root template with default inherit-attrs produces a ROZ970 error', () => {
    // Wave 1 (Plan 14-02) implements this — currently RED.
    const diags = compileDiagnostics(rozie('<rozie name="MultiRoot">', MULTI_ROOT_BODY));
    const multiRoot = diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT);
    expect(
      multiRoot.length,
      `expected a ROZ970 for a multi-root + fallthrough; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(multiRoot[0]!.severity).toBe('error');
  });

  it('R8: the same multi-root template with inherit-attrs="false" produces no ROZ970', () => {
    const diags = compileDiagnostics(
      rozie('<rozie name="MultiRoot" inherit-attrs="false">', MULTI_ROOT_BODY),
    );
    const multiRoot = diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT);
    expect(multiRoot, JSON.stringify(multiRoot)).toEqual([]);
  });

  it('R9: a single-root template + r-bind="$attrs" with default inherit-attrs produces a ROZ971 warning', () => {
    // Wave 1 (Plan 14-02) implements this — currently RED.
    const diags = compileDiagnostics(rozie('<rozie name="DoubleApply">', SINGLE_ROOT_DOUBLE_APPLY));
    const doubleApply = diags.filter((d) => d.code === RozieErrorCode.ATTR_DOUBLE_APPLY);
    expect(
      doubleApply.length,
      `expected a ROZ971 for explicit $attrs while auto-fallthrough on; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(doubleApply[0]!.severity).toBe('warning');
  });

  it('R9: the same single-root + r-bind="$attrs" with inherit-attrs="false" produces no ROZ971', () => {
    const diags = compileDiagnostics(
      rozie('<rozie name="DoubleApply" inherit-attrs="false">', SINGLE_ROOT_DOUBLE_APPLY),
    );
    const doubleApply = diags.filter((d) => d.code === RozieErrorCode.ATTR_DOUBLE_APPLY);
    expect(doubleApply, JSON.stringify(doubleApply)).toEqual([]);
  });

  it('R9 (WR-02): r-bind="$attrs" on a real-element r-match host emits ROZ971', () => {
    // WR-02 regression: validateAttrFallthrough.walkTemplate previously
    // visited TemplateMatch.branches[].body but ignored hostElement, so an
    // explicit r-bind="$attrs" on a `<div r-match>` wrapper escaped R9
    // detection. The fix walks the host so the spreadBinding on the
    // wrapper is visited.
    const diags = compileDiagnostics(
      rozie(
        '<rozie name="DoubleApplyMatch">',
        `<div r-match="'a'" r-bind="$attrs">
  <template r-case="'a'">a</template>
  <template r-default>default</template>
</div>`,
      ),
    );
    const doubleApply = diags.filter((d) => d.code === RozieErrorCode.ATTR_DOUBLE_APPLY);
    expect(
      doubleApply.length,
      `expected ROZ971 for r-bind="$attrs" on r-match host; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(doubleApply[0]!.severity).toBe('warning');
  });
});

// Phase 82 (multi-root consumer attribute fallthrough) — Plan 82-01 (Wave 0
// RED fixtures). Strategy B (D-01) teaches `countRootElements` and
// `synthesizeAttrsFallthrough` to ignore `<slot>` invocations when exactly
// one real (`tagKind: 'html'`) element root exists, and adds ROZ098
// ATTR_FALLTHROUGH_GATED_ROOT (D-04/D-05) for the r-if/r-match-single-root
// silent-drop case (D-02, diagnose now — branch-descent synthesis DEFERRED).
//
// The five assertions below marked RED are INTENTIONALLY failing against the
// current compiler: `countRootElements` and `synthesizeAttrsFallthrough`
// still treat a slot sibling as a disqualifying second root, and
// `validateAttrFallthrough` does not yet emit ROZ098 at all. Plan 82-02 turns
// them green. The `RozieErrorCode` members already exist (Plan 82-01 Task 1
// registered them) — the same Phase-14-Wave-0/Wave-1 sequencing this file's
// own header documents.
describe('attribute-fallthrough diagnostics (Phase 82 multi-root + gated-root)', () => {
  it('Phase 82 RED: an element + slot template with default inherit-attrs produces no ROZ970', () => {
    // Plan 82-02 implements the slot-tolerant root resolution — currently RED.
    const diags = compileDiagnostics(
      rozie('<rozie name="ElementPlusSlot">', ELEMENT_PLUS_SLOT_BODY),
    );
    const multiRoot = diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT);
    expect(
      multiRoot,
      `expected no ROZ970 for an element + <slot> sibling (Plan 82-02 slot-tolerant root resolution); got ${JSON.stringify(diags)}`,
    ).toEqual([]);
  });

  it('Phase 82 RED: an element + slot template emits the synthesized $attrs spread onto the element root', () => {
    // Asserts on the EMITTED Vue output, not IR — proving the spread reaches
    // codegen, not just that the diagnostic is silenced. Currently RED: the
    // multi-root disqualification aborts compilation before codegen runs.
    const code = compileCode(rozie('<rozie name="ElementPlusSlotSpread">', ELEMENT_PLUS_SLOT_BODY));
    expect(
      code,
      `expected the emitted Vue output to contain v-bind="$attrs"; got:\n${code}`,
    ).toContain('v-bind="$attrs"');
  });

  it('Phase 82 RED: a slot + element template (opposite order) also produces no ROZ970', () => {
    // Order-independence: packages/ui/rete/src/NodeType.rozie is authored
    // slot-first, so root resolution must be set-based, not positional.
    const diags = compileDiagnostics(
      rozie('<rozie name="ElementAfterSlot">', ELEMENT_AFTER_SLOT_BODY),
    );
    const multiRoot = diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT);
    expect(
      multiRoot,
      `expected no ROZ970 regardless of element/slot ordering; got ${JSON.stringify(diags)}`,
    ).toEqual([]);
  });

  it('Phase 82 regression guard: two slots and no element still produce exactly one ROZ970', () => {
    // GREEN today, must stay GREEN after Plan 82-02 — there is no element
    // anywhere in this body to receive the attrs, so the hard error survives.
    const diags = compileDiagnostics(
      rozie('<rozie name="TwoSlotsNoElement">', TWO_SLOTS_NO_ELEMENT_BODY),
    );
    const multiRoot = diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT);
    expect(
      multiRoot.length,
      `expected exactly one ROZ970 — no element exists to receive attrs; got ${JSON.stringify(diags)}`,
    ).toBe(1);
  });

  it('Phase 82 regression guard: element plus conditional sibling still produces exactly one ROZ970', () => {
    // GREEN today, must stay GREEN after Plan 82-02 — only <slot> invocations
    // are non-disqualifying (D-01/D-06); a conditional sibling is still a
    // second candidate root and must keep erroring.
    const diags = compileDiagnostics(
      rozieWithShowProp('<rozie name="ElementPlusConditional">', ELEMENT_PLUS_CONDITIONAL_BODY),
    );
    const multiRoot = diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT);
    expect(
      multiRoot.length,
      `expected exactly one ROZ970 — a conditional sibling is a second candidate root, not exempted; got ${JSON.stringify(diags)}`,
    ).toBe(1);
  });

  it('Phase 82 RED: a lone r-if-gated root produces exactly one ATTR_FALLTHROUGH_GATED_ROOT warning', () => {
    // Plan 82-02 wires the ROZ098 emission call site — currently RED (zero
    // diagnostics fire today; the drop is completely silent, D-02's premise).
    const diags = compileDiagnostics(
      rozieWithShowProp('<rozie name="ConditionalRoot">', CONDITIONAL_ROOT_BODY),
    );
    const gatedRoot = diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_GATED_ROOT);
    expect(
      gatedRoot.length,
      `expected exactly one ATTR_FALLTHROUGH_GATED_ROOT for a gated single root; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(gatedRoot[0]!.severity).toBe('warning');
  });

  it('Phase 82: the same gated root with inherit-attrs="false" produces no ATTR_FALLTHROUGH_GATED_ROOT', () => {
    // Vacuously true today (the diagnostic does not exist yet) and genuinely
    // true after Plan 82-02 — the opt-out silences ROZ098 exactly as it
    // silences ROZ970. Not a RED case; included as the opt-out half of the
    // existing present/absent pair pattern (lines 67-75 above).
    const diags = compileDiagnostics(
      rozieWithShowProp(
        '<rozie name="ConditionalRootOptOut" inherit-attrs="false">',
        CONDITIONAL_ROOT_BODY,
      ),
    );
    const gatedRoot = diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_GATED_ROOT);
    expect(
      gatedRoot,
      `expected inherit-attrs="false" to silence ATTR_FALLTHROUGH_GATED_ROOT; got ${JSON.stringify(gatedRoot)}`,
    ).toEqual([]);
  });

  it('WR-01 RED: an r-match root WITH a real host element produces no ATTR_FALLTHROUGH_GATED_ROOT and does synthesize the spread', () => {
    // The host `<div class="wrap">` renders unconditionally on every target,
    // so the ROZ098 message ("no unconditional element to attach the
    // inherited attributes to") is factually false for this shape and its
    // hint ("move the gating condition onto a child so the root element is
    // unconditional") is inapplicable — the root element already IS
    // unconditional. RED today on both halves: one diagnostic fires and no
    // spread is emitted.
    const source = rozie('<rozie name="MatchHostRoot">', MATCH_HOST_ROOT_BODY);
    const gatedRoot = compileDiagnostics(source).filter(
      (d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_GATED_ROOT,
    );
    expect(
      gatedRoot,
      `an r-match host element IS unconditional — expected no ATTR_FALLTHROUGH_GATED_ROOT; got ${JSON.stringify(gatedRoot)}`,
    ).toEqual([]);
    expect(
      compileCode(source),
      'expected the synthesized $attrs spread to land on the unconditional r-match host',
    ).toContain('v-bind="$attrs"');
  });

  it('WR-01 over-reach guard: a <template r-match> root still produces exactly one ATTR_FALLTHROUGH_GATED_ROOT', () => {
    // GREEN today, must stay GREEN. A `<template r-match>` host is
    // non-rendering — there is genuinely no unconditional element, so the
    // D-02-deferred signal must survive the hostElement exemption.
    const gatedRoot = compileDiagnostics(
      rozie('<rozie name="TemplateMatchRoot">', TEMPLATE_MATCH_ROOT_BODY),
    ).filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_GATED_ROOT);
    expect(
      gatedRoot.length,
      `a <template r-match> root has no unconditional element — expected exactly one ATTR_FALLTHROUGH_GATED_ROOT; got ${JSON.stringify(gatedRoot)}`,
    ).toBe(1);
    expect(gatedRoot[0]!.severity).toBe('warning');
  });

  it('WR-01 follow-up RED: a component-tag r-match host keeps ROZ098, with wording that does not claim the root is conditional', () => {
    // The synthesizer skips a non-`html` root (Plan 14-05), so the attrs are
    // still dropped here and the signal must survive. But the gated-root
    // message would be false for this shape too — the root IS unconditional,
    // it just is not an HTML element — so it gets its own wording. RED on the
    // message assertion today: the diagnostic does not fire at all.
    const source = rozieWithComponent(
      '<rozie name="ComponentMatchHost">',
      COMPONENT_MATCH_HOST_BODY,
    );
    const gatedRoot = compileDiagnostics(source).filter(
      (d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_GATED_ROOT,
    );
    expect(
      gatedRoot.length,
      `a component-tag r-match host still drops attrs — expected exactly one ATTR_FALLTHROUGH_GATED_ROOT; got ${JSON.stringify(gatedRoot)}`,
    ).toBe(1);
    expect(gatedRoot[0]!.severity).toBe('warning');
    expect(
      gatedRoot[0]!.message,
      `expected component-tag wording, not the conditional-root message; got: ${gatedRoot[0]!.message}`,
    ).toContain('component tag');
    expect(
      compileCode(source),
      'a component-tag root owns its own fallthrough surface — no spread should be synthesized',
    ).not.toContain('v-bind="$attrs"');
  });

  it('Phase 82 RED: no new silent drops — every fixture body satisfies exactly one of {ROZ970, emitted $attrs bind, ATTR_FALLTHROUGH_GATED_ROOT}', () => {
    // Structural guard: Plan 82-02's two independent predicates
    // (`countRootElements` and the synthesizer's root-resolution loop) must
    // never drift apart and open a NEW silent drop. Every body below must
    // land in EXACTLY one of the three observable arms.
    //
    // TWO_SLOTS_NO_ELEMENT_BODY is deliberately exempt from this table: it is
    // already covered by the regression-guard case above (the ROZ970 arm),
    // and any body whose root is a lone slot invocation is a renderless
    // pass-through excluded by D-06 — there is no element anywhere in that
    // shape that could ever receive the spread.
    const trichotomyCases: Array<{ name: string; source: string }> = [
      { name: 'MULTI_ROOT_BODY', source: rozie('<rozie name="Trichotomy1">', MULTI_ROOT_BODY) },
      {
        name: 'SINGLE_ROOT_DOUBLE_APPLY',
        source: rozie('<rozie name="Trichotomy2">', SINGLE_ROOT_DOUBLE_APPLY),
      },
      {
        name: 'ELEMENT_PLUS_SLOT_BODY',
        source: rozie('<rozie name="Trichotomy3">', ELEMENT_PLUS_SLOT_BODY),
      },
      {
        name: 'ELEMENT_AFTER_SLOT_BODY',
        source: rozie('<rozie name="Trichotomy4">', ELEMENT_AFTER_SLOT_BODY),
      },
      {
        name: 'ELEMENT_PLUS_CONDITIONAL_BODY',
        source: rozieWithShowProp('<rozie name="Trichotomy5">', ELEMENT_PLUS_CONDITIONAL_BODY),
      },
      {
        name: 'CONDITIONAL_ROOT_BODY',
        source: rozieWithShowProp('<rozie name="Trichotomy6">', CONDITIONAL_ROOT_BODY),
      },
      {
        name: 'MATCH_HOST_ROOT_BODY',
        source: rozie('<rozie name="Trichotomy7">', MATCH_HOST_ROOT_BODY),
      },
      {
        name: 'TEMPLATE_MATCH_ROOT_BODY',
        source: rozie('<rozie name="Trichotomy8">', TEMPLATE_MATCH_ROOT_BODY),
      },
      {
        name: 'COMPONENT_MATCH_HOST_BODY',
        source: rozieWithComponent('<rozie name="Trichotomy9">', COMPONENT_MATCH_HOST_BODY),
      },
    ];

    for (const { name, source } of trichotomyCases) {
      const result = compile(source, {
        target: 'vue',
        filename: 'AttrFallthrough.rozie',
        types: false,
        sourceMap: false,
      });
      const hasRoz970 = result.diagnostics.some(
        (d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT,
      );
      const hasSpread = result.code.includes('v-bind="$attrs"');
      const hasGatedRoot = result.diagnostics.some(
        (d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_GATED_ROOT,
      );
      const satisfiedCount = [hasRoz970, hasSpread, hasGatedRoot].filter(Boolean).length;
      expect(
        satisfiedCount,
        `${name}: expected exactly one of {ROZ970, emitted $attrs bind, ATTR_FALLTHROUGH_GATED_ROOT}; got hasRoz970=${hasRoz970} hasSpread=${hasSpread} hasGatedRoot=${hasGatedRoot}, diagnostics=${JSON.stringify(result.diagnostics)}`,
      ).toBe(1);
    }
  });
});
