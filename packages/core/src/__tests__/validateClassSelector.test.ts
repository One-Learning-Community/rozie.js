// Phase 13 Plan 13-01 (Wave 0 RED scaffold) — core `validateClassSelector` test.
//
// `$classSelector('<class>')` is the Phase 13 helper that lowers a class name
// to a CSS selector matching the class as it actually renders at runtime.
// Three compile-time validation rules guard it (13-SPEC R3/R4/R5); the
// validator that enforces them — `validateClassSelector` — is wired into
// `lowerToIR` by Plan 13-02.
//
// This scaffold is INTENTIONALLY RED. The validator and its three diagnostic
// codes do not exist yet:
//   - ROZ965 CLASS_SELECTOR_ARG_NOT_LITERAL  (R3 — non-string-literal argument)
//   - ROZ966 CLASS_SELECTOR_UNKNOWN_CLASS    (R4 — class not in <style> scope,
//                                             hint carries a did-you-mean)
//   - ROZ967 CLASS_SELECTOR_INVALID_TOKEN    (R5 — multi-token / dotted / `#` /
//                                             combinator argument)
// Plan 13-02 adds them to `diagnostics/codes.ts` as RozieErrorCode.* symbols.
//
// Codes are ROZ965/966/967 — NOT ROZ964/965/966 — because ROZ964 was taken by
// a Phase 12 fix (RMODEL_MODIFIER_NOT_APPLICABLE) committed since planning.
// Plan 13-02 shipped the RozieErrorCode.CLASS_SELECTOR_* symbols, so the bare
// string literals from the Wave 0 scaffold now reference the registry directly.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

const CLASS_SELECTOR_ARG_NOT_LITERAL = RozieErrorCode.CLASS_SELECTOR_ARG_NOT_LITERAL; // ROZ965 — R3
const CLASS_SELECTOR_UNKNOWN_CLASS = RozieErrorCode.CLASS_SELECTOR_UNKNOWN_CLASS; // ROZ966 — R4
const CLASS_SELECTOR_INVALID_TOKEN = RozieErrorCode.CLASS_SELECTOR_INVALID_TOKEN; // ROZ967 — R5

/**
 * Compile an inline `.rozie` source through the Vue target (any target works —
 * `validateClassSelector` runs in `lowerToIR`, shared by all six) and return
 * the collected diagnostics.
 */
function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'vue',
    filename: 'ClassSelectorValidation.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

/** A `.rozie` source whose `<style>` declares `.grip` and `.panel`, with a
 *  single `$classSelector` call in `<script>` carrying the given argument
 *  expression text verbatim. */
function probeSource(argExpr: string): string {
  return `<rozie name="ClassSelectorValidation">

<data>
{ cls: 'grip' }
</data>

<script>
const sel = $classSelector(${argExpr})
</script>

<template>
<div class="panel"><span class="grip" :data-sel="sel">x</span></div>
</template>

<style>
.panel { display: block; }
.grip { cursor: grab; }
</style>

</rozie>
`;
}

describe('validateClassSelector [Wave 0 RED — implemented in Plan 13-02]', () => {
  it('R3 / ROZ965: a non-string-literal argument is a compile error (identifier)', () => {
    const diags = compileDiagnostics(probeSource('$data.cls'));
    const err = diags.find(
      (d) => d.code === CLASS_SELECTOR_ARG_NOT_LITERAL && d.severity === 'error',
    );
    expect(err, 'expected a ROZ965 error for $classSelector($data.cls)').toBeDefined();
  });

  it('R3 / ROZ965: a concatenated-string argument is a compile error', () => {
    const diags = compileDiagnostics(probeSource("'gr' + 'ip'"));
    const err = diags.find(
      (d) => d.code === CLASS_SELECTOR_ARG_NOT_LITERAL && d.severity === 'error',
    );
    expect(err, "expected a ROZ965 error for $classSelector('gr' + 'ip')").toBeDefined();
  });

  it('R4 / ROZ966: an undeclared class is a compile error with a did-you-mean hint', () => {
    // `.grip` and `.panel` are declared; `grpi` is a near-match typo of `grip`,
    // so the hint MUST carry a did-you-mean suggestion (D-05).
    const diags = compileDiagnostics(probeSource("'grpi'"));
    const err = diags.find(
      (d) => d.code === CLASS_SELECTOR_UNKNOWN_CLASS && d.severity === 'error',
    );
    expect(err, "expected a ROZ966 error for $classSelector('grpi')").toBeDefined();
    expect(err?.hint, 'ROZ966 hint should suggest the near-match class').toMatch(
      /grip/,
    );
  });

  it('R5 / ROZ967: a whitespace-separated multi-token argument is a compile error', () => {
    const diags = compileDiagnostics(probeSource("'a b'"));
    const err = diags.find(
      (d) => d.code === CLASS_SELECTOR_INVALID_TOKEN && d.severity === 'error',
    );
    expect(err, "expected a ROZ967 error for $classSelector('a b')").toBeDefined();
  });

  it('R5 / ROZ967: a leading-dot argument is a compile error', () => {
    const diags = compileDiagnostics(probeSource("'.grip'"));
    const err = diags.find(
      (d) => d.code === CLASS_SELECTOR_INVALID_TOKEN && d.severity === 'error',
    );
    expect(err, "expected a ROZ967 error for $classSelector('.grip')").toBeDefined();
  });

  it('R5 / ROZ967: a combinator argument is a compile error', () => {
    const diags = compileDiagnostics(probeSource("'a>b'"));
    const err = diags.find(
      (d) => d.code === CLASS_SELECTOR_INVALID_TOKEN && d.severity === 'error',
    );
    expect(err, "expected a ROZ967 error for $classSelector('a>b')").toBeDefined();
  });

  it('valid: $classSelector(\'grip\') with .grip declared compiles with no error', () => {
    const diags = compileDiagnostics(probeSource("'grip'"));
    const classSelectorErrors = diags.filter(
      (d) =>
        d.severity === 'error' &&
        (d.code === CLASS_SELECTOR_ARG_NOT_LITERAL ||
          d.code === CLASS_SELECTOR_UNKNOWN_CLASS ||
          d.code === CLASS_SELECTOR_INVALID_TOKEN),
    );
    expect(classSelectorErrors, 'a valid $classSelector call must not error').toEqual(
      [],
    );
  });
});
