/**
 * slotNameIdentityCollision.test.ts — WR-01 (phase-79 code-review finding),
 * quick task 260817-buk.
 *
 * `findDynamicSlotOrdinal` (`dynamicSlotOrdinal.ts`) disambiguates dynamic-
 * name slot invocations by REWRITTEN EXPRESSION TEXT with first-match-wins
 * semantics. Two independently-declared `<slot :name="…">` sites whose
 * expressions rewrite to IDENTICAL text therefore collide — both invocations
 * resolve to the FIRST declaration's ordinal.
 *
 * ============================================================================
 * OBSERVED FAILURE (recorded verbatim before writing assertions, per plan
 * Step 4 — this is the review's open gap, now closed with real evidence)
 * ============================================================================
 *
 * Producer (mirrors the React sibling file's `IDENTICAL_EXPR_SRC` — a data
 * table's per-column header/footer slots, both bound to `$data.col.key`):
 *
 *   <slot :name="$data.col.key" :value="1"></slot>
 *   <slot :name="$data.col.key"></slot>
 *
 * Compiling this through the real `lowerInline` → `emitSvelte` path produces:
 *
 *   <script lang="ts">
 *   ...
 *   const __rozieDynSlot0 = $derived(snippets?.[col.key]);
 *   const __rozieDynSlot1 = $derived(snippets?.[col.key]);
 *   ...
 *   </script>
 *   <div ...>{@render __rozieDynSlot0?.({ value: 1 })}{@render __rozieDynSlot0?.()}</div>
 *
 * The DECLARATION side (`emitScript.ts`'s `ir.slots.indexOf(s)`) is
 * unaffected by this bug — it independently derives its ordinal from the
 * SlotDecl object it already holds, so both `__rozieDynSlot0` and
 * `__rozieDynSlot1` ARE correctly declared in `<script>`. The bug is entirely
 * on the INVOCATION side: `findDynamicSlotOrdinal` compares rewritten
 * expression TEXT (`col.key` for both), so it always returns ordinal `0` —
 * confirming the plan's prediction exactly. Both render sites emit
 * `__rozieDynSlot0`; `__rozieDynSlot1` is declared but NEVER rendered — a
 * dead binding — and the with-params invocation's OWN param object
 * (`{ value: 1 }`) happens to land on the correct call site here only because
 * ordinal 0 IS the with-params declaration in this ordering (the REVERSED
 * case below proves the general defect: whichever declaration is ordinal 0
 * "wins" for BOTH invocations, regardless of which one an invocation actually
 * belongs to).
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSvelte } from '../../emitSvelte.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) {
    throw new Error(`parse failed: ${JSON.stringify(result.diagnostics)}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  }
  return lowered.ir;
}

function compileSvelte(ir: IRComponent, filename: string): string {
  return emitSvelte(ir, { filename }).code;
}

// Same producer shape as the React sibling file's IDENTICAL_EXPR_SRC — two
// independent dynamic-name slots binding the IDENTICAL source expression
// (`$data.col.key`). With-params declared FIRST.
const IDENTICAL_EXPR_SRC = `<rozie name="IdenticalExprSlots">
<data>
{ col: { key: 'k' } }
</data>
<template>
<div>
  <slot :name="$data.col.key" :value="1"></slot>
  <slot :name="$data.col.key"></slot>
</div>
</template>
</rozie>`;

// Reversed order — the zero-param declaration comes FIRST.
const IDENTICAL_EXPR_REVERSED_SRC = `<rozie name="IdenticalExprSlotsRev">
<data>
{ col: { key: 'k' } }
</data>
<template>
<div>
  <slot :name="$data.col.key"></slot>
  <slot :name="$data.col.key" :value="1"></slot>
</div>
</template>
</rozie>`;

describe('Svelte sourceLoc identity — IDENTICAL dynamicNameExpr text on two declarations (WR-01)', () => {
  it('with-params declared first: every declared __rozieDynSlotN binding is actually rendered, each at its OWN site', () => {
    const ir = lowerInline(IDENTICAL_EXPR_SRC);
    const code = compileSvelte(ir, 'IdenticalExprSlots.rozie');
    // Both bindings must still be DECLARED (declaration side is unaffected —
    // it derives its own ordinal from ir.slots.indexOf(s) independently).
    expect(code).toContain('const __rozieDynSlot0 = $derived(snippets?.[col.key]);');
    expect(code).toContain('const __rozieDynSlot1 = $derived(snippets?.[col.key]);');
    // The with-params invocation must render ordinal 0 (its own declaration,
    // declared first) and the zero-param invocation must render ordinal 1
    // (its own declaration, declared second) — NOT both rendering ordinal 0.
    expect(code).toContain('{@render __rozieDynSlot0?.({ value: 1 })}');
    expect(code).toContain('{@render __rozieDynSlot1?.()}');
    // No declared binding is left dead in the template.
    expect(code).not.toContain('{@render __rozieDynSlot0?.()}');
    expect(code).not.toContain('{@render __rozieDynSlot1?.({ value: 1 })}');
  });

  it('zero-param declared first: the with-params declaration (declared second) still renders its OWN binding with its OWN param object', () => {
    const ir = lowerInline(IDENTICAL_EXPR_REVERSED_SRC);
    const code = compileSvelte(ir, 'IdenticalExprSlotsRev.rozie');
    expect(code).toContain('const __rozieDynSlot0 = $derived(snippets?.[col.key]);');
    expect(code).toContain('const __rozieDynSlot1 = $derived(snippets?.[col.key]);');
    // Zero-param declared first (ordinal 0) → its invocation renders ordinal 0.
    expect(code).toContain('{@render __rozieDynSlot0?.()}');
    // With-params declared second (ordinal 1) → its invocation renders
    // ordinal 1 with its OWN param object.
    expect(code).toContain('{@render __rozieDynSlot1?.({ value: 1 })}');
    expect(code).not.toContain('{@render __rozieDynSlot0?.({ value: 1 })}');
    expect(code).not.toContain('{@render __rozieDynSlot1?.()}');
  });
});
