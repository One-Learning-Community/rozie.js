// Phase 14 Plan 14-01 (Wave 0 scaffold) — `$attrs` magic accessor (R3).
//
// `$attrs` is the consumer-passed attribute cluster minus declared props.
// Task 2 registered it in all three accessor sets:
//   - RESERVED_SIGILS      → shadowing it is a ROZ202 collision
//   - MAGIC_ACCESSOR_NAMES → `$attrs.x` member reads resolve, not flagged
//   - STABLE_IDENTIFIERS   → bare `$attrs` never enters a React dep array
//
// R3 has two halves:
//   - `$attrs` referenced in `<script>` and in a template `r-bind="$attrs"`
//     produces NO unknown-reference diagnostic (it is a recognized accessor).
//   - a `<data>` field named `$attrs`, and an `r-for` loop alias `$attrs`,
//     each produce the ROZ202 reserved-sigil collision.
//
// All cases PASS as of Task 2 — `$attrs` registration landed in Plan 14-01.
import { describe, it, expect } from 'vitest';
import { parse } from '../parse.js';
import { analyzeAST } from '../semantic/analyze.js';
import { compile } from '../compile.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RESERVED_SIGILS } from '../semantic/validators/reservedIdentifierValidator.js';

/** Run parse → analyzeAST and return the collected diagnostics. */
function analyzeSource(source: string, filename = 'attrs.rozie'): Diagnostic[] {
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

describe('$attrs magic accessor (Phase 14 R3)', () => {
  it('R3: $attrs is a registered reserved sigil', () => {
    expect(RESERVED_SIGILS.has('$attrs')).toBe(true);
  });

  it('R3: $attrs referenced in <script> + r-bind="$attrs" produces no unknown-reference diagnostic', () => {
    const source = `<rozie name="AttrsProbe">
<script>
const a = $attrs
</script>
<template>
<div r-bind="$attrs"></div>
</template>
</rozie>
`;
    const { diagnostics } = compile(source, {
      target: 'vue',
      filename: 'AttrsProbe.rozie',
      types: false,
      sourceMap: false,
    });
    const unknownRefs = diagnostics.filter((d) => UNKNOWN_REF_CODES.has(d.code));
    expect(
      unknownRefs,
      `$attrs is a magic accessor — no unknown-reference diagnostic expected; got ${JSON.stringify(unknownRefs)}`,
    ).toEqual([]);
  });

  it('R3: a <data> field named $attrs produces the ROZ202 reserved-sigil collision', () => {
    const source = `<rozie name="X">
<data>{ $attrs: 0 }</data>
<template><div></div></template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('$attrs');
  });

  it('R3: an r-for loop alias named $attrs produces the ROZ202 reserved-sigil collision', () => {
    const source = `<rozie name="X">
<template>
<ul><li r-for="$attrs in items" :key="$attrs">x</li></ul>
</template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('r-for loop variable');
  });
});
