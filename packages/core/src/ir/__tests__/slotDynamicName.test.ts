/**
 * slotDynamicName.test.ts — Phase 79 Plan 79-06 Tasks 1+2 (R1/R7/D-12).
 *
 * RED-FIRST: at the point this file is authored, `SlotDecl.dynamicNameExpr`
 * / `SlotDecl.namePrefix` do not exist and ROZ090/ROZ091/ROZ092/ROZ094/ROZ096
 * are not wired — every non-trivial assertion below fails until
 * `lowerSlots.ts`'s `:name` reservation lands.
 *
 * Drives through `lowerToIR` (NOT `lowerSlots` in isolation) per D-12's
 * convention, mirroring the sibling `validateEmitNameCollision.test.ts`.
 *
 * RESOLVED AMBIGUITY (recorded here, not just in the SUMMARY, so the test
 * intent is self-documenting): `codes.ts`'s own registry comment for
 * ROZ094 reads "a bound :name yields no static leading prefix (bare
 * identifier, call expression, or a template literal with an empty first
 * quasi)" — three trigger shapes. This plan's task prose only walks through
 * the empty-leading-quasi shape explicitly. The implementation follows the
 * BROADER, canonical registry definition: ROZ094 fires whenever
 * `dynamicNameExpr` is set and `namePrefix` did NOT get derived, covering
 * all three shapes uniformly (simpler rule, matches RESEARCH.md's D-10
 * planned fixture set, which separately lists "a prefixed dynamic family"
 * AND "a no-prefix dynamic slot" as distinct fixture members).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { IRComponent, SlotDecl } from '../types.js';

function lower(
  source: string,
  filename = 'DynName.rozie',
): { ir: IRComponent; diagnostics: Diagnostic[] } {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(`parse() returned null AST: ${parseDiags.map((d) => d.code).join(', ')}`);
  }
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
    filename,
  });
  const diagnostics = [...parseDiags, ...irDiags];
  if (!ir) {
    throw new Error(`lowerToIR returned null ir: ${diagnostics.map((d) => d.code).join(', ')}`);
  }
  return { ir, diagnostics };
}

function firstSlot(ir: IRComponent): SlotDecl {
  const slot = ir.slots[0];
  if (!slot) throw new Error('no slots found on ir.slots');
  return slot;
}

/** Codes ROZ090 through ROZ095 inclusive — the AC-11 "clean component" range. */
function roz090through095(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => /^ROZ09[0-5]$/.test(d.code));
}

describe('lowerSlots — :name reservation IR fields (Phase 79 R1, Plan 79-06 Task 1)', () => {
  it('AC-2: <slot :name="col.key"> sets dynamicNameExpr, leaves name as the empty-string sentinel, and mints NO `name` ParamDecl', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="col.key" :value="col.key" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('');
    expect('dynamicNameExpr' in slot).toBe(true);
    expect(slot.dynamicNameExpr).toBeDefined();
    expect(slot.params.every((p) => p.name !== 'name')).toBe(true);
    expect('namePrefix' in slot).toBe(false);
  });

  it('AC-3: <slot :name="\'cell\'"> (StringLiteral) constant-folds to a static name with NO dynamicNameExpr/namePrefix keys', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="'cell'" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('cell');
    expect('dynamicNameExpr' in slot).toBe(false);
    expect('namePrefix' in slot).toBe(false);
  });

  it('AC-3: <slot :name="`cell`"> (zero-interpolation TemplateLiteral) constant-folds identically to the StringLiteral case', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="\`cell\`" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('cell');
    expect('dynamicNameExpr' in slot).toBe(false);
    expect('namePrefix' in slot).toBe(false);
  });

  it('AC-5: <slot :name="`cell-${k}`"> sets namePrefix to the leading quasi text', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="\`cell-\${k}\`" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('');
    expect(slot.namePrefix).toBe('cell-');
    expect(slot.dynamicNameExpr).toBeDefined();
  });

  it('AC-12: <slot :name="`${k}-cell`"> (empty leading quasi) sets dynamicNameExpr with NO namePrefix key', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="\`\${k}-cell\`" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.dynamicNameExpr).toBeDefined();
    expect('namePrefix' in slot).toBe(false);
  });

  it('byte-identity (AC-1): <slot name="header" :close="c"> carries EXACTLY the pre-Phase-79 enumerable key set — no new keys present-but-undefined', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot name="header" :close="c" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(Object.keys(slot).sort()).toEqual(
      ['defaultContent', 'name', 'nestedSlots', 'params', 'presence', 'sourceLoc', 'type'].sort(),
    );
  });

  it('determinePresence: a slot with a non-constant :name inside r-if="$slots.x" stays "always" — a runtime name has no compile-time $slots.<key> guard to test against', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <div r-if="$slots.x">
    <slot :name="col.key" />
  </div>
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.presence).toBe('always');
  });

  it('WR-02 regression (79-REVIEW-FIX): a constant-folded :name (AC-3) inside a matching r-if="$slots.<name>" resolves to "conditional", not "always"', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <div r-if="$slots.header">
    <slot :name="'header'" />
  </div>
</template>
</rozie>`);
    const slot = firstSlot(ir);
    // AC-3: a constant-folded :name is byte-identical to a static name="..."
    // attribute — including for presence purposes.
    expect(slot.name).toBe('header');
    expect('dynamicNameExpr' in slot).toBe(false);
    expect(slot.presence).toBe('conditional');
  });

  it('WR-02 regression (79-REVIEW-FIX): a template-literal constant-folded :name inside a matching r-if resolves to "conditional"', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <div r-if="$slots.header">
    <slot :name="\`header\`" />
  </div>
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('header');
    expect(slot.presence).toBe('conditional');
  });

  it('every pre-existing core IR fixture with only static slot names is unaffected — a component with two static slots produces two SlotDecls with no dynamic-name keys', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot name="header" />
  <slot name="footer" :x="1" />
</template>
</rozie>`);
    expect(ir.slots.length).toBe(2);
    for (const slot of ir.slots) {
      expect('dynamicNameExpr' in slot).toBe(false);
      expect('namePrefix' in slot).toBe(false);
    }
  });
});

describe('lowerSlots — ROZ090/ROZ091/ROZ092/ROZ094/ROZ096 diagnostics (Phase 79 R7, Plan 79-06 Task 2)', () => {
  it('ROZ090: <slot name="cell" :name="k"> — a static name= AND a bound :name cannot both define the slot name', () => {
    const { diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot name="cell" :name="k" />
</template>
</rozie>`);
    const hits = diagnostics.filter((d) => d.code === RozieErrorCode.SLOT_NAME_STATIC_AND_BOUND);
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.loc).toBeTruthy();
    expect(hits[0]!.message).toContain('cell');
  });

  it('WR-03 regression (79-REVIEW-FIX): <slot name="cell" :name="k"> (ROZ090 error case) still resets SlotDecl.name to the \'\' sentinel, preserving the "every dynamic-name slot has name === \'\'" invariant', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot name="cell" :name="k" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('');
    expect(slot.dynamicNameExpr).toBeDefined();
  });

  it('ROZ092: <slot portal :name="k"> — a bound :name on a portal slot is an error (portalKey() needs a compile-time string)', () => {
    const { diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot portal :name="k" :params="['arg']" />
</template>
</rozie>`);
    const hits = diagnostics.filter((d) => d.code === RozieErrorCode.SLOT_DYNAMIC_NAME_ON_PORTAL);
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.loc).toBeTruthy();
  });

  it('ROZ094: a template-literal :name with an empty leading quasi emits a WARNING and the slot still lowers successfully', () => {
    const { ir, diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot :name="\`\${k}-cell\`" />
</template>
</rozie>`);
    const hits = diagnostics.filter((d) => d.code === RozieErrorCode.SLOT_DYNAMIC_NAME_NO_PREFIX);
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
    expect(hits[0]!.loc).toBeTruthy();
    // A warning must not abort lowering — the SlotDecl was still produced.
    expect(ir.slots.length).toBe(1);
    expect(ir.slots[0]!.dynamicNameExpr).toBeDefined();
  });

  it('ROZ094 ALSO fires for a bare member-expression :name (no TemplateLiteral at all — no static prefix is derivable either way)', () => {
    const { diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot :name="col.key" />
</template>
</rozie>`);
    const hits = diagnostics.filter((d) => d.code === RozieErrorCode.SLOT_DYNAMIC_NAME_NO_PREFIX);
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
  });

  it('ROZ094 does NOT fire when a static prefix IS derivable (`cell-${k}`)', () => {
    const { diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot :name="\`cell-\${k}\`" />
</template>
</rozie>`);
    expect(diagnostics.filter((d) => d.code === RozieErrorCode.SLOT_DYNAMIC_NAME_NO_PREFIX).length).toBe(0);
  });

  it('ROZ096: a :name value that fails to parse as a JS expression emits an error and never falls back to a silent `undefined` identifier (T-79-12)', () => {
    const { ir, diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot :name="(" />
</template>
</rozie>`);
    const hits = diagnostics.filter((d) => d.code === RozieErrorCode.SLOT_DYNAMIC_NAME_PARSE_ERROR);
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.loc).toBeTruthy();
    // Never silently synthesizes a dynamicNameExpr from the unparseable text.
    const slot = firstSlot(ir);
    expect('dynamicNameExpr' in slot).toBe(false);
  });

  it('ROZ091 reachability proof: is UNREACHABLE through normal authoring — collectParamsFromSlotElement skips every binding attr named "name" before a ParamDecl can be minted, even with a duplicate :name attribute', () => {
    const { ir, diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot :name="k" :name="k2" />
</template>
</rozie>`);
    expect(diagnostics.filter((d) => d.code === RozieErrorCode.SLOT_NAME_PARAM_ON_DYNAMIC_SLOT).length).toBe(0);
    const slot = firstSlot(ir);
    expect(slot.params.every((p) => p.name !== 'name')).toBe(true);
    // The registry code stays declared (never deleted/renumbered) for
    // stability even though this component proves it cannot fire.
    expect(RozieErrorCode.SLOT_NAME_PARAM_ON_DYNAMIC_SLOT).toBe('ROZ091');
  });

  it("AC-11: a component with no :name anywhere emits ZERO diagnostics from the ROZ090..ROZ095 cluster", () => {
    const { diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot name="header" />
  <slot name="footer" :x="1" />
</template>
</rozie>`);
    expect(roz090through095(diagnostics).length).toBe(0);
  });
});
