// quick 260807-cor (D4) Task 1 — `$slotted` reserved-sigil registration.
//
// `$slotted.<name>` is a new member-shape sigil (parallel to `$slots`).
// Registers it in RESERVED_SIGILS so a <data> field or r-for loop alias
// named `$slotted` raises ROZ202. Mirrors `attrsReservedSigil.test.ts` and
// `semantic/validators/__tests__/cloneReservedSigil.test.ts` exactly.
import { describe, it, expect } from 'vitest';
import { parse } from '../parse.js';
import { analyzeAST } from '../semantic/analyze.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RESERVED_SIGILS } from '../semantic/validators/reservedIdentifierValidator.js';

/** Run parse → analyzeAST and return the collected diagnostics. */
function analyzeSource(source: string, filename = 'slotted.rozie'): Diagnostic[] {
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

describe('$slotted reserved sigil (quick 260807-cor D4)', () => {
  it('$slotted is a registered reserved sigil', () => {
    expect(RESERVED_SIGILS.has('$slotted')).toBe(true);
  });

  it('a <data> field named $slotted produces the ROZ202 reserved-sigil collision', () => {
    const source = `<rozie name="X">
<data>{ $slotted: 0 }</data>
<template><div></div></template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('$slotted');
  });

  it('an r-for loop alias named $slotted produces the ROZ202 reserved-sigil collision', () => {
    const source = `<rozie name="X">
<template>
<ul><li r-for="$slotted in items" :key="$slotted">x</li></ul>
</template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('r-for loop variable');
  });
});
