// Phase 16 Plan 16-03 — core `validateRestoreFocus` test.
//
// `$restoreFocus(selector, idx)` is the Phase 16 author-surface sigil that
// restores focus to a row in a keyed `r-for` list after a state mutation
// that reorders the list. Per-target lowering: React/Vue/Angular emit `void 0`
// (their keyed reconcilers move the existing DOM element on reorder);
// Svelte/Solid/Lit emit a `queueMicrotask(...)` that re-queries the row by
// selector and refocuses it.
//
// This file tests the IR-side validator (SPEC R9/R10):
//   - ROZ975 RESTORE_FOCUS_NON_LITERAL_SELECTOR  (R9 — non-literal first arg)
//   - ROZ976 RESTORE_FOCUS_BAD_ARITY             (R9 — wrong number of args)
//
// Priority: ROZ976 (arity) fires first, ROZ975 (literal) second — at most ONE
// diagnostic per call site, mirroring validateClassSelector's per-call shape.
//
// The validator runs in `lowerToIR` so the same chokepoint covers compile()
// and @rozie/unplugin entrypoints; target choice is irrelevant for these
// validator-side tests — vue is the simplest stable choice.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

const RESTORE_FOCUS_NON_LITERAL_SELECTOR =
  RozieErrorCode.RESTORE_FOCUS_NON_LITERAL_SELECTOR; // ROZ975 — R9
const RESTORE_FOCUS_BAD_ARITY = RozieErrorCode.RESTORE_FOCUS_BAD_ARITY; // ROZ976 — R9

/**
 * Compile an inline `.rozie` source through the Vue target (any target works —
 * `validateRestoreFocus` runs in `lowerToIR`, shared by all six) and return
 * the collected diagnostics.
 */
function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'vue',
    filename: 'RestoreFocusValidation.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

/** A `.rozie` source with a single `$restoreFocus` call in `<script>` carrying
 *  the given argument-list expression text verbatim. */
function probeSource(argExpr: string): string {
  return `<rozie name="RestoreFocusValidation">

<data>
{ idx: 0 }
</data>

<script>
$onMount(() => { $restoreFocus(${argExpr}); })
</script>

<template>
<ul><li :data-idx="$data.idx">x</li></ul>
</template>

</rozie>
`;
}

describe('validateRestoreFocus [Phase 16]', () => {
  it('R9 / ROZ976: zero args is a compile error', () => {
    const diags = compileDiagnostics(probeSource(''));
    const err = diags.find(
      (d) => d.code === RESTORE_FOCUS_BAD_ARITY && d.severity === 'error',
    );
    expect(err, 'expected a ROZ976 error for $restoreFocus()').toBeDefined();
  });

  it('R9 / ROZ976: one arg is a compile error', () => {
    const diags = compileDiagnostics(probeSource("'.row'"));
    const err = diags.find(
      (d) => d.code === RESTORE_FOCUS_BAD_ARITY && d.severity === 'error',
    );
    expect(err, "expected a ROZ976 error for $restoreFocus('.row')").toBeDefined();
  });

  it('R9 / ROZ976: three args is a compile error', () => {
    const diags = compileDiagnostics(probeSource("'.row', 0, 'extra'"));
    const err = diags.find(
      (d) => d.code === RESTORE_FOCUS_BAD_ARITY && d.severity === 'error',
    );
    expect(
      err,
      "expected a ROZ976 error for $restoreFocus('.row', 0, 'extra')",
    ).toBeDefined();
  });

  it('R9 / ROZ975: a non-literal first arg (member access) is a compile error', () => {
    const diags = compileDiagnostics(probeSource('$data.idx, 0'));
    const err = diags.find(
      (d) =>
        d.code === RESTORE_FOCUS_NON_LITERAL_SELECTOR && d.severity === 'error',
    );
    expect(
      err,
      'expected a ROZ975 error for $restoreFocus($data.idx, 0)',
    ).toBeDefined();
  });

  it('R9 / ROZ975: a non-literal first arg (identifier) is a compile error', () => {
    // Wrap in `(function () { const sel = ".row"; $restoreFocus(sel, 0); })()`
    // shape via a bare identifier — the parser accepts `sel` as a free
    // identifier in the script context and the validator rejects it.
    const diags = compileDiagnostics(probeSource('sel, 0'));
    const err = diags.find(
      (d) =>
        d.code === RESTORE_FOCUS_NON_LITERAL_SELECTOR && d.severity === 'error',
    );
    expect(err, 'expected a ROZ975 error for $restoreFocus(sel, 0)').toBeDefined();
  });

  it('valid: $restoreFocus(\'.row\', $data.idx) compiles with no $restoreFocus error', () => {
    const diags = compileDiagnostics(probeSource("'.row', $data.idx"));
    const restoreFocusErrors = diags.filter(
      (d) =>
        d.severity === 'error' &&
        (d.code === RESTORE_FOCUS_NON_LITERAL_SELECTOR ||
          d.code === RESTORE_FOCUS_BAD_ARITY),
    );
    expect(
      restoreFocusErrors,
      'a valid $restoreFocus call must not error',
    ).toEqual([]);
  });

  it('priority: arity wins over literal — $restoreFocus($data.cls) emits exactly one ROZ976 (NOT ROZ975)', () => {
    const diags = compileDiagnostics(probeSource('$data.idx'));
    const restoreFocusErrors = diags.filter(
      (d) =>
        d.code === RESTORE_FOCUS_NON_LITERAL_SELECTOR ||
        d.code === RESTORE_FOCUS_BAD_ARITY,
    );
    // Per-call priority: ROZ976 (arity) wins; exactly ONE diagnostic.
    expect(restoreFocusErrors).toHaveLength(1);
    expect(restoreFocusErrors[0]?.code).toBe(RESTORE_FOCUS_BAD_ARITY);
  });
});
