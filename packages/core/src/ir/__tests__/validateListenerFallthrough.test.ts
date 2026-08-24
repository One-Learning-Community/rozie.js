/**
 * validateListenerFallthrough — Phase 15 Plan 15-02 Task 2.
 *
 * Unit cases for the listener-side R8/R9 validator. Drives `compile()` so the
 * full lowerToIR chokepoint runs (Plan 15-02 Task 3 wires the call). All cases
 * assert via the diagnostics array — D-08 collected-not-thrown.
 *
 * Coverage:
 *   R8 multi-root × four-corner flag matrix (inheritAttrs × inheritListeners)
 *   R9 double-apply × two listener-flag values
 *   Independence cases: ROZ970/971 vs ROZ973/974 do not coalesce
 *   $listeners member access does NOT trigger ROZ974 (only bare-identifier)
 *   $attrs bare-identifier on the same root does NOT trigger ROZ974
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../../compile.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';

function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'vue',
    filename: 'ListenerFallthroughUnit.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

/** Compile an inline `.rozie` source (Vue target) and return the emitted code. */
function compileCode(source: string): string {
  return compile(source, {
    target: 'vue',
    filename: 'ListenerFallthroughUnit.rozie',
    types: false,
    sourceMap: false,
  }).code;
}

const MULTI_ROOT_BODY = `<header></header>
<main></main>`;

// Phase 82 (D-17 mirror of attr-fallthrough-diagnostics.test.ts): one real
// element + a bare <slot> sibling — the shape Plan 82-02 must stop
// classifying as multi-root for BOTH the attrs and listeners twins.
const ELEMENT_PLUS_SLOT_BODY = `<div class="wrap"></div>
<slot />`;

// Phase 82: the same two nodes, opposite order — order-independence.
const ELEMENT_AFTER_SLOT_BODY = `<slot />
<div class="wrap"></div>`;

// Phase 82 regression guard: two slot invocations, no element — ROZ973 must
// survive Plan 82-02's slot-tolerant generalization untouched.
const TWO_SLOTS_NO_ELEMENT_BODY = `<slot />
<slot name="footer" />`;

// Phase 82 regression guard: a real element PLUS a conditional sibling (not a
// slot) — only slot invocations are non-disqualifying (D-01/D-06).
const ELEMENT_PLUS_CONDITIONAL_BODY = `<div class="wrap"></div>
<span r-if="$props.show"></span>`;

// Phase 82: a lone r-if-gated root — the D-17 listeners twin of
// `attr-fallthrough-diagnostics.test.ts`'s CONDITIONAL_ROOT_BODY.
// `countRootElements` reports exactly 1 (a TemplateConditional root is one
// structural root), so ROZ973 never fires; `synthesizeListenersFallthrough`
// also cannot resolve an element to receive the spread. Before ROZ099
// existed this combination silently dropped the consumer's listeners with no
// compile-time signal at all.
const CONDITIONAL_ROOT_BODY = `<div class="wrap" r-if="$props.show"></div>`;

function rozieEnv(openTag: string, body: string): string {
  return `${openTag}
<template>
${body}
</template>
</rozie>
`;
}

// Phase 82: CONDITIONAL_ROOT_BODY and ELEMENT_PLUS_CONDITIONAL_BODY both read
// $props.show — declare it so $props.show resolves and no unrelated ROZ100
// (UNKNOWN_PROPS_REF) fires alongside the fallthrough assertions.
function rozieEnvWithShowProp(openTag: string, body: string): string {
  return `${openTag}
<props>
{ show: { type: Boolean, default: true } }
</props>
<template>
${body}
</template>
</rozie>
`;
}

describe('validateListenerFallthrough (Phase 15 R8/R9)', () => {
  // ---- R8 multi-root × 4-corner flag matrix ----
  it('multi-root + inheritAttrs default + inheritListeners default → ROZ970 + ROZ973', () => {
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="MR">', MULTI_ROOT_BODY),
    );
    expect(
      diags.filter((d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT).length,
    ).toBe(1);
    expect(
      diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT).length,
    ).toBe(1);
  });

  it('multi-root + inheritAttrs=false + inheritListeners default → ONLY ROZ973 (independence)', () => {
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="MR" inherit-attrs="false">', MULTI_ROOT_BODY),
    );
    expect(
      diags.filter((d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT).length,
    ).toBe(1);
    expect(
      diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT),
    ).toEqual([]);
  });

  it('multi-root + inheritAttrs default + inheritListeners=false → ONLY ROZ970 (independence)', () => {
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="MR" inherit-listeners="false">', MULTI_ROOT_BODY),
    );
    expect(
      diags.filter((d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT).length,
    ).toBe(1);
    expect(
      diags.filter((d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT),
    ).toEqual([]);
  });

  it('multi-root + both flags false → no R8 diagnostics', () => {
    const diags = compileDiagnostics(
      rozieEnv(
        '<rozie name="MR" inherit-attrs="false" inherit-listeners="false">',
        MULTI_ROOT_BODY,
      ),
    );
    expect(
      diags.filter(
        (d) =>
          d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT ||
          d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
      ),
    ).toEqual([]);
  });

  // ---- R9 double-apply × 2 listener-flag values ----
  it('bare r-on="$listeners" + inheritListeners default → ROZ974 warning', () => {
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="DA">', `<div r-on="$listeners"></div>`),
    );
    const da = diags.filter((d) => d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY);
    expect(da.length).toBe(1);
    expect(da[0]!.severity).toBe('warning');
  });

  it('bare r-on="$listeners" + inheritListeners=false → no ROZ974', () => {
    const diags = compileDiagnostics(
      rozieEnv(
        '<rozie name="DA" inherit-listeners="false">',
        `<div r-on="$listeners"></div>`,
      ),
    );
    expect(
      diags.filter((d) => d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY),
    ).toEqual([]);
  });

  // ---- $listeners member access does NOT trigger ROZ974 ----
  it('r-on="$listeners.click" (member access) does NOT trigger ROZ974', () => {
    // Member access is not the bare-identifier form — the spread expression
    // is a MemberExpression, not an Identifier, so isBareListenersIdentifier
    // returns false. (The runtime semantics of spreading a non-object are a
    // per-target concern; the validator only flags the bare-identifier
    // double-apply shape.)
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="NoMember">', `<div r-on="$listeners.click"></div>`),
    );
    expect(
      diags.filter((d) => d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY),
    ).toEqual([]);
  });

  // ---- Independence: bare $attrs vs bare $listeners on same root ----
  it('r-bind="$attrs" + r-on="$listeners" on same root → both ROZ971 AND ROZ974', () => {
    const diags = compileDiagnostics(
      rozieEnv(
        '<rozie name="Both">',
        `<div r-bind="$attrs" r-on="$listeners"></div>`,
      ),
    );
    expect(
      diags.filter((d) => d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY).length,
    ).toBe(1);
    expect(
      diags.filter((d) => d.code === RozieErrorCode.ATTR_DOUBLE_APPLY).length,
    ).toBe(1);
  });

  it('r-bind="$attrs" alone does NOT trigger ROZ974 (only $listeners triggers it)', () => {
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="AttrsOnly">', `<div r-bind="$attrs"></div>`),
    );
    expect(
      diags.filter((d) => d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY),
    ).toEqual([]);
  });

  // ---- Sanity: validator never throws ----
  it('clean single-root template emits no R8/R9 diagnostics', () => {
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="Clean">', `<div></div>`),
    );
    expect(
      diags.filter(
        (d) =>
          d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT ||
          d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY,
      ),
    ).toEqual([]);
  });
});

// Phase 82 (multi-root consumer attribute fallthrough) — Plan 82-01 (Wave 0
// RED fixtures). D-17 mirror of `attr-fallthrough-diagnostics.test.ts`'s
// Phase-82 describe block: `$attrs` -> `$listeners`, `inheritAttrs` ->
// `inheritListeners`, `ATTR_FALLTHROUGH_MULTI_ROOT` ->
// `LISTENER_FALLTHROUGH_MULTI_ROOT`, `ATTR_FALLTHROUGH_GATED_ROOT` ->
// `LISTENER_FALLTHROUGH_GATED_ROOT`. Strategy B (D-01) teaches
// `countRootElements` and `synthesizeListenersFallthrough` (the D-17 twins of
// the attrs-side functions) to ignore `<slot>` invocations when exactly one
// real element root exists; ROZ099 LISTENER_FALLTHROUGH_GATED_ROOT
// (D-04/D-05) covers the r-if/r-match-single-root silent-drop case (D-02,
// diagnose now — branch-descent synthesis DEFERRED).
//
// The assertions below marked RED are INTENTIONALLY failing against the
// current compiler — Plan 82-02 turns them green. The `RozieErrorCode`
// members already exist (Plan 82-01 Task 1 registered them).
describe('validateListenerFallthrough (Phase 82 multi-root + gated-root)', () => {
  it('Phase 82 RED: an element + slot template with default inherit-listeners produces no ROZ973', () => {
    // Plan 82-02 implements the slot-tolerant root resolution — currently RED.
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="ElementPlusSlot">', ELEMENT_PLUS_SLOT_BODY),
    );
    const multiRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
    );
    expect(
      multiRoot,
      `expected no ROZ973 for an element + <slot> sibling (Plan 82-02 slot-tolerant root resolution); got ${JSON.stringify(diags)}`,
    ).toEqual([]);
  });

  it('Phase 82 RED: an element + slot template emits the synthesized fallthrough spread onto the element root', () => {
    // D-19 — Vue 3 has no `$listeners` instance property; the listener
    // cluster folds into `$attrs` and `emitListenerSpread`'s bare-$listeners
    // path always emits the empty string (packages/targets/vue/src/emit/
    // emitTemplateAttribute.ts). The ONLY observable Vue token proving a
    // single-root fallthrough was resolved is therefore `v-bind="$attrs"` —
    // confirmed empirically against this emitter (an existing default-
    // envelope single-root fixture with no explicit r-on compiles to exactly
    // `v-bind="$attrs"`, never a `v-on="$listeners"`-shaped spelling). Assert
    // on that real token rather than a guessed Vue-2-era `$listeners` spread.
    const code = compileCode(
      rozieEnv('<rozie name="ElementPlusSlotSpread">', ELEMENT_PLUS_SLOT_BODY),
    );
    expect(
      code,
      `expected the emitted Vue output to contain v-bind="$attrs" (Vue folds listener fallthrough into it, D-19); got:\n${code}`,
    ).toContain('v-bind="$attrs"');
  });

  it('Phase 82 RED: a slot + element template (opposite order) also produces no ROZ973', () => {
    // Order-independence: packages/ui/rete/src/NodeType.rozie is authored
    // slot-first, so root resolution must be set-based, not positional.
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="ElementAfterSlot">', ELEMENT_AFTER_SLOT_BODY),
    );
    const multiRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
    );
    expect(
      multiRoot,
      `expected no ROZ973 regardless of element/slot ordering; got ${JSON.stringify(diags)}`,
    ).toEqual([]);
  });

  it('Phase 82 regression guard: two slots and no element still produce exactly one ROZ973', () => {
    // GREEN today, must stay GREEN after Plan 82-02 — there is no element
    // anywhere in this body to receive the listeners, so the hard error
    // survives.
    const diags = compileDiagnostics(
      rozieEnv('<rozie name="TwoSlotsNoElement">', TWO_SLOTS_NO_ELEMENT_BODY),
    );
    const multiRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
    );
    expect(
      multiRoot.length,
      `expected exactly one ROZ973 — no element exists to receive listeners; got ${JSON.stringify(diags)}`,
    ).toBe(1);
  });

  it('Phase 82 regression guard: element plus conditional sibling still produces exactly one ROZ973', () => {
    // GREEN today, must stay GREEN after Plan 82-02 — only <slot> invocations
    // are non-disqualifying (D-01/D-06); a conditional sibling is still a
    // second candidate root and must keep erroring.
    const diags = compileDiagnostics(
      rozieEnvWithShowProp(
        '<rozie name="ElementPlusConditional">',
        ELEMENT_PLUS_CONDITIONAL_BODY,
      ),
    );
    const multiRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
    );
    expect(
      multiRoot.length,
      `expected exactly one ROZ973 — a conditional sibling is a second candidate root, not exempted; got ${JSON.stringify(diags)}`,
    ).toBe(1);
  });

  it('Phase 82 RED: a lone r-if-gated root produces exactly one LISTENER_FALLTHROUGH_GATED_ROOT warning', () => {
    // Plan 82-02 wires the ROZ099 emission call site — currently RED (zero
    // diagnostics fire today; the drop is completely silent, D-02's premise).
    const diags = compileDiagnostics(
      rozieEnvWithShowProp('<rozie name="ConditionalRoot">', CONDITIONAL_ROOT_BODY),
    );
    const gatedRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_GATED_ROOT,
    );
    expect(
      gatedRoot.length,
      `expected exactly one LISTENER_FALLTHROUGH_GATED_ROOT for a gated single root; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(gatedRoot[0]!.severity).toBe('warning');
  });

  it('Phase 82: the same gated root with inherit-listeners="false" produces no LISTENER_FALLTHROUGH_GATED_ROOT', () => {
    // Vacuously true today (the diagnostic does not exist yet) and genuinely
    // true after Plan 82-02 — the opt-out silences ROZ099 exactly as it
    // silences ROZ973. Not a RED case; included as the opt-out half of the
    // present/absent pair pattern this file's own four-corner matrix uses.
    const diags = compileDiagnostics(
      rozieEnvWithShowProp(
        '<rozie name="ConditionalRootOptOut" inherit-listeners="false">',
        CONDITIONAL_ROOT_BODY,
      ),
    );
    const gatedRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_GATED_ROOT,
    );
    expect(
      gatedRoot,
      `expected inherit-listeners="false" to silence LISTENER_FALLTHROUGH_GATED_ROOT; got ${JSON.stringify(gatedRoot)}`,
    ).toEqual([]);
  });

  it('Phase 82 RED: no new silent drops — every fixture body satisfies exactly one of {ROZ973, emitted fallthrough spread, LISTENER_FALLTHROUGH_GATED_ROOT}', () => {
    // Structural guard, listeners twin of the attrs-side trichotomy. Every
    // body below must land in EXACTLY one of the three observable arms.
    //
    // TWO_SLOTS_NO_ELEMENT_BODY is deliberately exempt: it is already
    // covered by the regression-guard case above (the ROZ973 arm), and any
    // body whose root is a lone slot invocation is a renderless pass-through
    // excluded by D-06 — there is no element anywhere in that shape that
    // could ever receive the spread.
    const trichotomyCases: Array<{ name: string; source: string }> = [
      { name: 'MULTI_ROOT_BODY', source: rozieEnv('<rozie name="Trichotomy1">', MULTI_ROOT_BODY) },
      {
        name: 'SINGLE_ROOT_LISTENERS_DOUBLE_APPLY',
        source: rozieEnv('<rozie name="Trichotomy2">', `<div r-on="$listeners"></div>`),
      },
      {
        name: 'ELEMENT_PLUS_SLOT_BODY',
        source: rozieEnv('<rozie name="Trichotomy3">', ELEMENT_PLUS_SLOT_BODY),
      },
      {
        name: 'ELEMENT_AFTER_SLOT_BODY',
        source: rozieEnv('<rozie name="Trichotomy4">', ELEMENT_AFTER_SLOT_BODY),
      },
      {
        name: 'ELEMENT_PLUS_CONDITIONAL_BODY',
        source: rozieEnvWithShowProp('<rozie name="Trichotomy5">', ELEMENT_PLUS_CONDITIONAL_BODY),
      },
      {
        name: 'CONDITIONAL_ROOT_BODY',
        source: rozieEnvWithShowProp('<rozie name="Trichotomy6">', CONDITIONAL_ROOT_BODY),
      },
    ];

    for (const { name, source } of trichotomyCases) {
      const result = compile(source, {
        target: 'vue',
        filename: 'ListenerFallthroughUnit.rozie',
        types: false,
        sourceMap: false,
      });
      const hasRoz973 = result.diagnostics.some(
        (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
      );
      const hasSpread = result.code.includes('v-bind="$attrs"');
      const hasGatedRoot = result.diagnostics.some(
        (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_GATED_ROOT,
      );
      const satisfiedCount = [hasRoz973, hasSpread, hasGatedRoot].filter(Boolean).length;
      expect(
        satisfiedCount,
        `${name}: expected exactly one of {ROZ973, emitted fallthrough spread, LISTENER_FALLTHROUGH_GATED_ROOT}; got hasRoz973=${hasRoz973} hasSpread=${hasSpread} hasGatedRoot=${hasGatedRoot}, diagnostics=${JSON.stringify(result.diagnostics)}`,
      ).toBe(1);
    }
  });

  it('Phase 82 RED: gated root cross-code independence — inherit-attrs="false" does NOT silence LISTENER_FALLTHROUGH_GATED_ROOT', () => {
    // The tandem-touch trap this case is designed to catch: a Plan-02
    // implementation that edits only validateAttrFallthrough.ts (and skips
    // its declared D-17 parallel sibling in validateListenerFallthrough.ts)
    // leaves this case red even after the attrs-side cases above turn green.
    // inherit-attrs="false" opts OUT of the attrs check entirely; default
    // inherit-listeners means the listeners check is still live, so exactly
    // one LISTENER_FALLTHROUGH_GATED_ROOT must fire and zero
    // ATTR_FALLTHROUGH_GATED_ROOT.
    const diags = compileDiagnostics(
      rozieEnvWithShowProp(
        '<rozie name="ConditionalRootCrossCode" inherit-attrs="false">',
        CONDITIONAL_ROOT_BODY,
      ),
    );
    const listenerGatedRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_GATED_ROOT,
    );
    const attrGatedRoot = diags.filter(
      (d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_GATED_ROOT,
    );
    expect(
      listenerGatedRoot.length,
      `expected exactly one LISTENER_FALLTHROUGH_GATED_ROOT independent of inherit-attrs="false"; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(
      attrGatedRoot,
      `expected zero ATTR_FALLTHROUGH_GATED_ROOT — inherit-attrs="false" opts out of the attrs check entirely; got ${JSON.stringify(attrGatedRoot)}`,
    ).toEqual([]);
  });
});
