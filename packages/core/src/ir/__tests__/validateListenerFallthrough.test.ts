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

const MULTI_ROOT_BODY = `<header></header>
<main></main>`;

function rozieEnv(openTag: string, body: string): string {
  return `${openTag}
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
