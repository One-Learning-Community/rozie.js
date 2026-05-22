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
import { describe, it, expect } from 'vitest';
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

// A two-root template — two sibling elements at the template top level, no
// single wrapping root to absorb inherited attributes.
const MULTI_ROOT_BODY = `<header></header>
<main></main>`;

// A single-root template that ALSO references $attrs explicitly via a
// bare-spread r-bind — the double-apply shape.
const SINGLE_ROOT_DOUBLE_APPLY = `<div r-bind="$attrs"></div>`;

function rozie(openTag: string, templateBody: string): string {
  return `${openTag}
<template>
${templateBody}
</template>
</rozie>
`;
}

describe('attribute-fallthrough diagnostics (Phase 14 R8/R9)', () => {
  it('R8: a multi-root template with default inherit-attrs produces a ROZ970 error', () => {
    // Wave 1 (Plan 14-02) implements this — currently RED.
    const diags = compileDiagnostics(
      rozie('<rozie name="MultiRoot">', MULTI_ROOT_BODY),
    );
    const multiRoot = diags.filter(
      (d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT,
    );
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
    const multiRoot = diags.filter(
      (d) => d.code === RozieErrorCode.ATTR_FALLTHROUGH_MULTI_ROOT,
    );
    expect(multiRoot, JSON.stringify(multiRoot)).toEqual([]);
  });

  it('R9: a single-root template + r-bind="$attrs" with default inherit-attrs produces a ROZ971 warning', () => {
    // Wave 1 (Plan 14-02) implements this — currently RED.
    const diags = compileDiagnostics(
      rozie('<rozie name="DoubleApply">', SINGLE_ROOT_DOUBLE_APPLY),
    );
    const doubleApply = diags.filter(
      (d) => d.code === RozieErrorCode.ATTR_DOUBLE_APPLY,
    );
    expect(
      doubleApply.length,
      `expected a ROZ971 for explicit $attrs while auto-fallthrough on; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(doubleApply[0]!.severity).toBe('warning');
  });

  it('R9: the same single-root + r-bind="$attrs" with inherit-attrs="false" produces no ROZ971', () => {
    const diags = compileDiagnostics(
      rozie(
        '<rozie name="DoubleApply" inherit-attrs="false">',
        SINGLE_ROOT_DOUBLE_APPLY,
      ),
    );
    const doubleApply = diags.filter(
      (d) => d.code === RozieErrorCode.ATTR_DOUBLE_APPLY,
    );
    expect(doubleApply, JSON.stringify(doubleApply)).toEqual([]);
  });
});
