/**
 * Plan 79-05 Task 2 — Angular non-identifier slot name record-only routing (R12/D-03).
 *
 * A slot name that is not a valid JS identifier (e.g. `cell-status`) can no
 * longer mint an `@ContentChild` template-reference-variable field — a
 * hyphenated argument to `@ContentChild` does not resolve. This plan routes
 * such a name through the pre-existing `templates()` signal-map lookup ALONE,
 * on both the producer side (`emitSlotInvocation.ts`) and the consumer side
 * (the `[templates]`-getter mechanism the R5 dynamic-name path already uses).
 *
 * Identifier-named slots (e.g. `header`) MUST stay byte-identical to the
 * pre-phase merged form — that is the core byte-identity guarantee (AC-22)
 * this whole phase is built on.
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

function compileAngular(src: string, filename: string): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

describe('Angular producer — non-identifier slot name record-only routing (R12/D-03)', () => {
  it('a non-identifier slot name (cell-status) emits a __rozieFillMap()/templates() signal-map lookup chain (Phase 80 rebless)', () => {
    const code = compileAngular(
      `
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="value()"></slot></div>
</template>
</rozie>
`,
      'Cell.rozie',
    );
    // Phase 80 rebless: a record-only slot's lookup gained the fill-map
    // precedence tier (proven by producerFillMap.test.ts, Plan 04 Task 3) —
    // this test no longer asserts the ABSENCE of `??`.
    expect(code).toContain("__rozieFillMap()['cell-status'] ?? templates()?.['cell-status']");
    const invocation = code.match(
      /\*ngTemplateOutlet="\(__rozieFillMap\(\)\['cell-status'\] \?\? templates\(\)\?\.\['cell-status'\]\)[^"]*"/,
    );
    expect(invocation).not.toBeNull();
  });

  it('a non-identifier slot name mints NO @ContentChild whose argument contains a hyphen', () => {
    const code = compileAngular(
      `
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="value()"></slot></div>
</template>
</rozie>
`,
      'Cell.rozie',
    );
    const contentChildArgs = [...code.matchAll(/@ContentChild\('([^']*)'/g)].map((m) => m[1]);
    for (const arg of contentChildArgs) {
      expect(arg).not.toContain('-');
    }
    expect(code).not.toMatch(/cell-statusTpl/);
  });

  // Phase 80 Plan 12 (amended prohibition 4b, D-09 fix): retitled from
  // "stays byte-identical to the pre-phase merged form". Before the D-09
  // fix, an identifier-only producer's slot never gained the fill-map tier
  // (hasRecordOnlySlot was false for an all-identifier producer). The
  // widened hasKeyedFillIntake gate (slots.length > 0) now applies to EVERY
  // slot-declaring producer, so this single-identifier-slot producer gains
  // the same additive `__rozieFillMap()['header'] ?? ` middle tier as a
  // record-only producer. Prohibition 4a (the @ContentChild declaration
  // path itself, and static-content-child-leftmost precedence) is what
  // stays byte-identical — proven by the second assertion below and by
  // producerFillMap.test.ts's "diagnostics-negative" case (Plan 10 Task 2).
  it('an identifier-named slot (header) keeps @ContentChild leftmost and gains the amended fill-map middle tier (was byte-identical pre-Plan-10, D-09 widening)', () => {
    const code = compileAngular(
      `
<rozie name="X">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`,
      'X.rozie',
    );
    expect(code).toContain(
      "*ngTemplateOutlet=\"(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])\"",
    );
    expect(code).toContain(
      "@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;",
    );
  });

  it('a component declaring BOTH cell-status and header emits record-only for the first and a three-tier merge for the second, in IR order (Phase 80 rebless)', () => {
    const code = compileAngular(
      `
<rozie name="Mixed">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div>
  <slot name="cell-status" :value="value()"></slot>
  <slot name="header"></slot>
</div>
</template>
</rozie>
`,
      'Mixed.rozie',
    );
    // Phase 80 rebless: the MIXED producer's identifier-named `header` slot
    // deliberately gains the fill-map tier too (per-slot, not per-slot-kind
    // precedence — Plan 04 summary), so the pre-phase two-tier
    // `(headerTpl ?? templates()?.['header'])` form is now three-tier. Proven
    // by producerFillMap.test.ts (Plan 04 Task 3) and confirmed byte-for-byte
    // against tests/dist-parity/fixtures/DynamicSlots.angular.ts's
    // `headerCellTpl` chain in this same rebless pass.
    const cellIdx = code.indexOf("__rozieFillMap()['cell-status'] ?? templates()?.['cell-status']");
    const headerIdx = code.indexOf(
      "(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])",
    );
    expect(cellIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeGreaterThan(-1);
    expect(cellIdx).toBeLessThan(headerIdx);
  });

  it('a non-identifier slot name containing a single quote and a backslash is escaped, not emitted raw (T-79-07)', () => {
    const code = compileAngular(
      `
<rozie name="X">
<template>
<div><slot name="a'b\\c"></slot></div>
</template>
</rozie>
`,
      'X.rozie',
    );
    // The Angular shell wraps the whole template markup in a backtick JS
    // template literal, so every literal backslash in the rendered markup is
    // doubled at the SOURCE level (backtick-literal escaping) — after Angular
    // parses that literal at build time, the runtime attribute string is
    // exactly the single-escaped `'a\'b\\c'` this test's key is built from.
    // Mirrors the same doubling convention asserted in emitDecorator.test.ts.
    expect(code).toContain("templates()?.['a\\\\'b\\\\\\\\c']");
  });

  it('does not emit an invalid ctx-name union member for a record-only slot in ngTemplateContextGuard', () => {
    const code = compileAngular(
      `
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div>
  <slot name="cell-status" :value="value()"></slot>
  <slot name="header"></slot>
</div>
</template>
</rozie>
`,
      'Cell.rozie',
    );
    expect(code).not.toMatch(/Cell-statusCtx/);
    expect(code).toMatch(/_ctx is HeaderCtx/);
  });
});

describe('Angular consumer — non-identifier slot fill routes into the [rozieSlot] marker path (R12/D-03, Phase 80 rebless)', () => {
  it('a fill targeting a non-identifier slot name (#cell-status) routes through a [rozieSlot] marker, not @ContentChild', () => {
    const code = compileAngular(
      `
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell value="x">
    <template #cell-status="{ value }">
      <span>{{ value }}</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`,
      'ConsumerX.rozie',
    );
    // Phase 80 rebless: the `[templates]`-getter mechanism this test used to
    // assert is a net deletion (SPEC R4) — the fill is now a marker directive
    // bound to the quoted string literal. New shape proven by
    // consumerRozieSlotFill.test.ts (Phase 80 Plan 05, Task 1, 4/4 pass).
    expect(code).toContain('<ng-template [rozieSlot]="\'cell-status\'" let-value="value">');
    expect(code).not.toMatch(/\[templates\]="templates"/);
    expect(code).not.toMatch(/get templates\(\): Record<string, TemplateRef<unknown>>/);
    expect(code).not.toMatch(/__dynSlot_\d+/);
    expect(code).not.toMatch(/#cell-status/);
  });
});
