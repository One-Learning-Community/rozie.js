// quick 260807-cor (D4) Task 1 — `$slotted.<name>` Svelte lowering.
//
// Svelte has no shadow boundary — slot content is already a real light-DOM
// descendant of the component — so `$slotted.<name>` is a COMPILE-TIME
// CONSTANT `[]` on this target (mirrors the 5-no-ops/1-real shape of
// `$reconcileAfterDomMutation`).
import { describe, it, expect } from 'vitest';
import { compile } from '../../../../core/src/compile.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

const UNKNOWN_REF_CODES: ReadonlySet<string> = new Set([
  RozieErrorCode.UNKNOWN_PROPS_REF,
  RozieErrorCode.UNKNOWN_DATA_REF,
  RozieErrorCode.UNKNOWN_REFS_REF,
  RozieErrorCode.UNKNOWN_SLOTS_REF,
]);

const READ_SOURCE = `<rozie name="SlottedProbe">
<script lang="ts">
function readSlotted(): void {
  const items = $slotted.default;
  void items;
}
</script>
<template>
<div><slot /></div>
</template>
</rozie>
`;

describe('$slotted.<name> — Svelte (quick 260807-cor D4)', () => {
  it('compiles cleanly with no unknown-reference diagnostic and no residual $slotted token', () => {
    const { code, diagnostics } = compile(READ_SOURCE, {
      target: 'svelte',
      filename: 'SlottedProbe.rozie',
      types: false,
      sourceMap: false,
    });
    const errors = diagnostics.filter((d: Diagnostic) => d.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
    const unknownRefs = diagnostics.filter((d: Diagnostic) => UNKNOWN_REF_CODES.has(d.code));
    expect(unknownRefs, JSON.stringify(unknownRefs)).toEqual([]);
    expect(code).not.toContain('$slotted');
  });

  it('$slotted.default lowers to an empty array literal', () => {
    const { code } = compile(READ_SOURCE, {
      target: 'svelte',
      filename: 'SlottedProbe.rozie',
      types: false,
      sourceMap: false,
    });
    expect(code).toMatch(/const items = \[\];/);
  });
});
