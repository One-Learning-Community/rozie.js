// Phase 15 Plan 15-01 (Wave 0 scaffold) — `$listeners` magic accessor (R3).
//
// `$listeners` is the consumer-passed listener cluster minus declared events.
// Task 2 registered it in all three accessor sets:
//   - RESERVED_SIGILS      → shadowing it is a ROZ202 collision
//   - MAGIC_ACCESSOR_NAMES → `$listeners.click` member reads resolve, not flagged
//   - STABLE_IDENTIFIERS   → bare `$listeners` never enters a React dep array
//                            (load-bearing for the bare `r-on="$listeners"` form)
//
// R3 has three halves:
//   - `$listeners` referenced in `<script>` and in a template `r-on="$listeners"`
//     produces NO unknown-reference diagnostic (it is a recognized accessor).
//   - `$listeners.click?.(e)` member access in `<script>` produces no
//     unknown-reference diagnostic (member-accessor parity with `$attrs`).
//   - a `<data>` field named `$listeners`, and an `r-for` loop alias
//     `$listeners`, each produce the ROZ202 reserved-sigil collision.
//
// All cases PASS as of Task 2 — `$listeners` registration landed in Plan 15-01.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import { RESERVED_SIGILS } from '../reservedIdentifierValidator.js';

/** Run parse → analyzeAST and return the collected diagnostics. */
function analyzeSource(source: string, filename = 'listeners.rozie'): Diagnostic[] {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags
        .map((d) => d.message)
        .join(', ')}`,
    );
  }
  return analyzeAST(ast).diagnostics;
}

const roz202 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.RESERVED_IDENTIFIER_COLLISION);

// Diagnostic codes for "this identifier resolves to nothing declared".
const UNKNOWN_REF_CODES: ReadonlySet<string> = new Set([
  RozieErrorCode.UNKNOWN_PROPS_REF,
  RozieErrorCode.UNKNOWN_DATA_REF,
  RozieErrorCode.UNKNOWN_REFS_REF,
  RozieErrorCode.UNKNOWN_SLOTS_REF,
]);

describe('$listeners magic accessor (Phase 15 R3)', () => {
  it('R3: $listeners is a registered reserved sigil', () => {
    expect(RESERVED_SIGILS.has('$listeners')).toBe(true);
  });

  it('R3: $listeners referenced in <script> + r-on="$listeners" produces no unknown-reference diagnostic', () => {
    const source = `<rozie name="ListenersProbe">
<script>
const a = $listeners
</script>
<template>
<div r-on="$listeners"></div>
</template>
</rozie>
`;
    const { diagnostics } = compile(source, {
      target: 'vue',
      filename: 'ListenersProbe.rozie',
      types: false,
      sourceMap: false,
    });
    const unknownRefs = diagnostics.filter((d) => UNKNOWN_REF_CODES.has(d.code));
    expect(
      unknownRefs,
      `$listeners is a magic accessor — no unknown-reference diagnostic expected; got ${JSON.stringify(unknownRefs)}`,
    ).toEqual([]);
  });

  it('R3: $listeners.click?.(e) member access in <script> produces no unknown-reference diagnostic', () => {
    const source = `<rozie name="ListenersMemberProbe">
<script>
function handle(e) {
  $listeners.click?.(e)
}
</script>
<template>
<div></div>
</template>
</rozie>
`;
    const { diagnostics } = compile(source, {
      target: 'vue',
      filename: 'ListenersMemberProbe.rozie',
      types: false,
      sourceMap: false,
    });
    const unknownRefs = diagnostics.filter((d) => UNKNOWN_REF_CODES.has(d.code));
    expect(
      unknownRefs,
      `$listeners.click?.() member access should resolve; got ${JSON.stringify(unknownRefs)}`,
    ).toEqual([]);
  });

  it('R3: a <data> field named $listeners produces the ROZ202 reserved-sigil collision', () => {
    const source = `<rozie name="X">
<data>{ $listeners: 0 }</data>
<template><div></div></template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('$listeners');
  });

  it('R3: an r-for loop alias named $listeners produces the ROZ202 reserved-sigil collision', () => {
    const source = `<rozie name="X">
<template>
<ul><li r-for="$listeners in items" :key="$listeners">x</li></ul>
</template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('r-for loop variable');
  });
});
