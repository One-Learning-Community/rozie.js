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
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

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
  it('a non-identifier slot name (cell-status) emits a templates() signal-map lookup with NO `??` merge', () => {
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
    expect(code).toContain("templates()?.['cell-status']");
    const invocation = code.match(/\*ngTemplateOutlet="templates\(\)\?\.\['cell-status'\][^"]*"/);
    expect(invocation).not.toBeNull();
    expect(invocation![0]).not.toContain('??');
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

  it('an identifier-named slot (header) stays byte-identical to the pre-phase merged form', () => {
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
    expect(code).toContain("*ngTemplateOutlet=\"(headerTpl ?? templates()?.['header'])\"");
    expect(code).toContain("@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;");
  });

  it('a component declaring BOTH cell-status and header emits record-only for the first and merge for the second, in IR order', () => {
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
    const cellIdx = code.indexOf("templates()?.['cell-status']");
    const headerIdx = code.indexOf("(headerTpl ?? templates()?.['header'])");
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

describe('Angular consumer — non-identifier slot fill routes into the [templates] getter path (R12/D-03)', () => {
  it('a fill targeting a non-identifier slot name (#cell-status) routes through the [templates] getter, not @ContentChild', () => {
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
    expect(code).toMatch(/\[templates\]="templates"/);
    expect(code).toMatch(/get templates\(\): Record<string, TemplateRef<unknown>>/);
    expect(code).toMatch(/\['cell-status'\]: this\.__dynSlot_\d+!/);
    expect(code).not.toMatch(/#cell-status/);
  });
});
