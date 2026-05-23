// Phase 15 Plan 15-01 (Wave 0 scaffold) — fallthrough diagnostics (R8/R9).
//
// Two fallthrough-time diagnostics, both detected during lowering and
// collected-not-thrown:
//   - ROZ973 LISTENER_FALLTHROUGH_MULTI_ROOT (R8 — error): a multi-root
//     template with auto-listener-fallthrough enabled has no single root to
//     receive the inherited listeners. `inherit-listeners="false"` suppresses
//     it. INDEPENDENT of ROZ970 — the attrs-side + listeners-side checks
//     fire independently (SPEC R8 lock).
//   - ROZ974 LISTENER_DOUBLE_APPLY (R9 — warning): `$listeners` is referenced
//     explicitly (e.g. `r-on="$listeners"`) while auto-listener-fallthrough
//     is still on, so the listeners would be applied twice.
//     `inherit-listeners="false"` suppresses it. INDEPENDENT of ROZ971.
//
// Both ROZ973 and ROZ974 cases are INTENTIONALLY RED. Wave 1 (Plan 15-02)
// adds the lowerTemplate / lowerToIR passes that emit them. The
// `RozieErrorCode` symbols already exist (Task 1 registered them). The
// diagnostic is COLLECTED — these tests assert on the diagnostic array, never
// `.toThrow()`.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';

/** Compile an inline `.rozie` source (Vue target) and return diagnostics. */
function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'vue',
    filename: 'ListenerFallthrough.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

// A two-root template — two sibling elements at the template top level, no
// single wrapping root to absorb inherited listeners.
const MULTI_ROOT_BODY = `<header></header>
<main></main>`;

// A single-root template that ALSO references $listeners explicitly via a
// bare-spread r-on — the double-apply shape.
const SINGLE_ROOT_DOUBLE_APPLY = `<div r-on="$listeners"></div>`;

function rozie(openTag: string, templateBody: string): string {
  return `${openTag}
<template>
${templateBody}
</template>
</rozie>
`;
}

describe('listener-fallthrough diagnostics (Phase 15 R8/R9)', () => {
  it('R8: a multi-root template with default inherit-listeners produces a ROZ973 error', () => {
    // Wave 1 (Plan 15-02) implements this — currently RED.
    const diags = compileDiagnostics(
      rozie('<rozie name="MultiRoot">', MULTI_ROOT_BODY),
    );
    const multiRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
    );
    expect(
      multiRoot.length,
      `expected a ROZ973 for a multi-root + listener-fallthrough; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(multiRoot[0]!.severity).toBe('error');
  });

  it('R8: the same multi-root template with inherit-listeners="false" produces no ROZ973', () => {
    const diags = compileDiagnostics(
      rozie('<rozie name="MultiRoot" inherit-listeners="false">', MULTI_ROOT_BODY),
    );
    const multiRoot = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
    );
    expect(multiRoot, JSON.stringify(multiRoot)).toEqual([]);
  });

  it('R8 independence: multi-root + inherit-attrs="false" alone still produces ROZ973 (not coalesced with ROZ970)', () => {
    // Wave 1 (Plan 15-02) implements this — currently RED. SPEC R8 locks
    // ROZ973 as INDEPENDENT of ROZ970: the two checks fire separately. A
    // multi-root template with `inherit-attrs="false"` but default
    // `inherit-listeners` still triggers ROZ973, while ROZ970 is independently
    // suppressed by the attrs-side opt-out.
    const diags = compileDiagnostics(
      rozie(
        '<rozie name="MultiRoot" inherit-attrs="false">',
        MULTI_ROOT_BODY,
      ),
    );
    const multiRootListeners = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_FALLTHROUGH_MULTI_ROOT,
    );
    const multiRootAttrs = diags.filter(
      (d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT,
    );
    expect(
      multiRootListeners.length,
      `expected ROZ973 to fire independently of ROZ970; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(
      multiRootAttrs,
      `inherit-attrs="false" should suppress ROZ970; got ${JSON.stringify(multiRootAttrs)}`,
    ).toEqual([]);
  });

  it('R9: a single-root template + r-on="$listeners" with default inherit-listeners produces a ROZ974 warning', () => {
    // Wave 1 (Plan 15-02) implements this — currently RED.
    const diags = compileDiagnostics(
      rozie('<rozie name="DoubleApply">', SINGLE_ROOT_DOUBLE_APPLY),
    );
    const doubleApply = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY,
    );
    expect(
      doubleApply.length,
      `expected a ROZ974 for explicit $listeners while auto-listener-fallthrough on; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(doubleApply[0]!.severity).toBe('warning');
  });

  it('R9: the same single-root + r-on="$listeners" with inherit-listeners="false" produces no ROZ974', () => {
    const diags = compileDiagnostics(
      rozie(
        '<rozie name="DoubleApply" inherit-listeners="false">',
        SINGLE_ROOT_DOUBLE_APPLY,
      ),
    );
    const doubleApply = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY,
    );
    expect(doubleApply, JSON.stringify(doubleApply)).toEqual([]);
  });

  it('R9 independence: ROZ974 fires for r-on="$listeners" regardless of whether $attrs is also referenced', () => {
    // Wave 1 (Plan 15-02) implements this — currently RED. SPEC R9 locks
    // ROZ974 as INDEPENDENT of ROZ971: a component that combines both
    // r-bind="$attrs" + r-on="$listeners" on a single root produces BOTH
    // ROZ971 (attrs-side) AND ROZ974 (listeners-side). The two codes do not
    // coalesce.
    const diags = compileDiagnostics(
      rozie(
        '<rozie name="BothDoubleApply">',
        `<div r-bind="$attrs" r-on="$listeners"></div>`,
      ),
    );
    const listenerDoubleApply = diags.filter(
      (d) => d.code === RozieErrorCode.LISTENER_DOUBLE_APPLY,
    );
    expect(
      listenerDoubleApply.length,
      `expected ROZ974 to fire independently of ROZ971; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(listenerDoubleApply[0]!.severity).toBe('warning');
  });
});
