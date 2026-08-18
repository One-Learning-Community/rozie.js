/**
 * Plan 79-11 Task 1 — Angular producer dispatch on a dynamic-name slot
 * (R3/D-09), the sixth and final target for this phase.
 *
 * Generalizes 79-05's "non-identifier slot name" record-only routing to a
 * SECOND trigger: a producer `<slot :name="expr">` whose bound name does NOT
 * constant-fold (SlotDecl.dynamicNameExpr / 79-06). Both triggers share the
 * SAME `isRecordOnly` OR-extended decision in emitSlotInvocation.ts (no
 * parallel branch — T-79-24), mirroring React/Solid's 79-10 OR-extension.
 *
 * DEAD-FILE WARNING (79-05, verified at orchestrator level 2026-08-16):
 * `emitSlotDecl.ts` has zero production importers. Every assertion below
 * drives the REAL `emitAngular()` entrypoint (parse -> lowerToIR -> emitAngular),
 * exercising the LIVE seams: `emitSlotInvocation.ts` (producer dispatch) and
 * `refineSlotTypes.ts` (ContentChild-minting filter, consumed by
 * `emitScript.ts`) — never a unit test against the dead `emitSlotDecl.ts`
 * function directly.
 *
 * Task 2's matchedFamily consumer-routing tests live in the sibling
 * `slotFamilyConsumerRouting.test.ts`. Task 3's cold-gate compile assertion
 * exercises the full, real-file-on-disk round trip against the actual
 * DynamicSlots fixture pair.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

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

function compileAngular(ir: IRComponent, filename = 'inline.rozie'): string {
  const { code } = emitAngular(ir, { filename });
  return code;
}

describe('Angular producer — runtime-keyed dispatch for a dynamic-name slot (R3/D-09)', () => {
  // Phase 80 rebless (Plan 07): a record-only slot's resolution chain gained a
  // new precedence tier — `__rozieFillMap()[key] ?? templates()?.[key]` — so
  // this test no longer asserts the ABSENCE of `??`; it asserts the new
  // two-tier chain, still with no static field (@ContentChild) operand. New
  // shape proven by packages/targets/angular/src/__tests__/producerFillMap.test.ts
  // (Phase 80 Plan 04, Task 3 describe block) and emitSlotInvocation.ts's
  // isRecordOnlySlotDecl-gated splice.
  it('a SlotDecl carrying dynamicNameExpr emits a __rozieFillMap()/templates() record lookup chain keyed on the rewritten expression, with no static field operand', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    // `dynName` is a `<data>`-declared state signal; the template-context
    // rewrite calls it (`dynName()`), matching every other signal read in
    // this file's emitted template markup.
    expect(code).toContain('__rozieFillMap()[dynName()] ?? templates()?.[dynName()]');
    const invocation = code.match(
      /\*ngTemplateOutlet="\(__rozieFillMap\(\)\[dynName\(\)\] \?\? templates\(\)\?\.\[dynName\(\)\]\)[^"]*"/,
    );
    expect(invocation).not.toBeNull();
    expect(code).not.toMatch(/@ContentChild\('defaultSlot'/);
  });

  it('the emitted key comes from the PRODUCER expression, not from any consumer fill name (T-79-26) — a fixture where the two would differ', () => {
    // The producer's dynamicNameExpr text ('cellKeyFromProducer') is
    // deliberately distinct from any name a consumer might fill under, so
    // this test cannot pass by coincidence if the key were ever sourced from
    // node.slotName (the consumer's static fill name) instead.
    const ir = lowerInline(`
<rozie name="Cell">
<data>{ cellKeyFromProducer: 'x' }</data>
<template>
<div><slot :name="$data.cellKeyFromProducer" :value="1"></slot></div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    expect(code).toContain('templates()?.[cellKeyFromProducer()]');
    expect(code).not.toContain("templates()?.['defaultSlot']");
  });

  it('a dynamic-name family slot inside r-for keys on the rewritten expression referencing the loop variable', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<props>{ columns: { type: Array, default: () => [] }, row: { type: Object, default: () => ({}) } }</props>
<template>
<div r-for="col in columns()" :key="col.key">
  <slot :name="\`cell-\${col.key}\`" :row="row()" :value="row()[col.key]">
    <span>{{ row()[col.key] }}</span>
  </slot>
</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    // The whole component's template markup is composed as a backtick JS
    // template literal, so a literal backtick/`${` inside the RENDERED
    // markup (the rewritten `` `cell-${col.key}` `` key expression) is
    // escaped at the SOURCE level to keep the outer literal syntactically
    // valid — the real emitted `.ts` text contains a literal backslash
    // before each backtick and `${`.
    // Phase 80 rebless: the fill-map tier now precedes the `templates` tier
    // (proven by producerFillMap.test.ts, Plan 04 Task 3); the `??` this test
    // used to forbid is now a required part of the two-tier chain.
    expect(code).toContain(
      '__rozieFillMap()[\\`cell-\\${col.key}\\`] ?? templates()?.[\\`cell-\\${col.key}\\`]',
    );
  });

  it('a static-name SlotDecl in the same component emits its merged three-tier form (Phase 80 rebless)', () => {
    const ir = lowerInline(`
<rozie name="Mixed">
<data>{ dynName: 'cell-total' }</data>
<template>
<div>
  <slot :name="$data.dynName" :value="1"></slot>
  <slot name="header"></slot>
</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    // Phase 80: a MIXED producer's identifier-named slot deliberately gains
    // the fill-map tier too (per-slot, not per-slot-kind precedence, Plan 04
    // summary) — the pre-phase two-tier `(headerTpl ?? templates()?.['header'])`
    // form is now three-tier. Proven by producerFillMap.test.ts (Plan 04 Task
    // 3) and confirmed byte-for-byte against tests/dist-parity/fixtures/
    // DynamicSlots.angular.ts's `headerCellTpl` chain in this same rebless pass.
    expect(code).toContain(
      "*ngTemplateOutlet=\"(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])\"",
    );
    expect(code).toContain(
      "@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;",
    );
  });

  it('no arrow function is introduced inside the emitted ngTemplateOutlet binding for a dynamic-name slot', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    const outletMatch = code.match(/<ng-container \*ngTemplateOutlet="[^"]*" \/>/);
    expect(outletMatch).not.toBeNull();
    expect(outletMatch![0]).not.toContain('=>');
  });

  it('no doubled separator (`;;`) appears in the emitted binding text for a dynamic-name slot with context args', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1" :extra="2"></slot></div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    expect(code).not.toContain(';;');
  });
});

describe('Angular producer — a slot carrying dynamicNameExpr mints no @ContentChild/ctx-interface collision with a real default slot', () => {
  it('a component with BOTH a dynamic-name slot and a genuine default slot mints the @ContentChild field for the REAL default slot only once', () => {
    const ir = lowerInline(`
<rozie name="Mixed">
<data>{ dynName: 'x' }</data>
<template>
<div>
  <slot :name="$data.dynName" :value="1"></slot>
  <slot>fallback default content</slot>
</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    const contentChildMatches = [
      ...code.matchAll(/@ContentChild\('defaultSlot', \{ read: TemplateRef \}\)/g),
    ];
    expect(contentChildMatches.length).toBe(1);
    expect(code).toContain('templates()?.[dynName()]');
  });
});
