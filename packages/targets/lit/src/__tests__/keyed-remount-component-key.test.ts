/**
 * Keyed-remount codegen, Task 3 — Lit `:key` on a composed component now
 * lowers to `TemplateElementIR.remountKeyExpression` (Task 1, DONE) but Lit
 * currently forwards the raw `:key` binding as an INERT `.key=${…}` property
 * binding on the custom element (component tags route every non-boolean,
 * non-form binding through the `.prop=${expr}` property-binding path — see
 * emitTemplate.ts:618-647). Nothing reads a `.key` property on a Lit custom
 * element, so the component never remounts on a `:key` change
 * (data-table-super-crosstarget-findings.md §3.1).
 *
 * Fix: reuse the `r-external` `keyed()` precedent (r-external-keyed.test.ts)
 * — wrap the WHOLE component invocation in
 * `${keyed(<remountKeyExpression>, html\`<invocation>\`)}` so lit-html
 * disposes + recreates the custom element whenever the key value changes.
 * The inert `.key=` property binding is stripped at the same seam so it
 * isn't ALSO emitted.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

function compile(source: string, filename = 'KEYED_REMOUNT.rozie'): string {
  const { ast } = parse(source, { filename });
  if (!ast) throw new Error('parse failed');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lower failed');
  const { code } = emitLit(ir, { filename, source });
  return code;
}

const SRC_KEYED = `<rozie name="KeyedHost">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ v: 0 }</data>
<template>
  <div>
    <MyComp :key="String(v)" />
  </div>
</template>
</rozie>
`;

const SRC_NO_KEY = `<rozie name="KeyedHostNoKey">
<components>{ MyComp: "./MyComp.rozie" }</components>
<template>
  <div>
    <MyComp />
  </div>
</template>
</rozie>
`;

const SRC_LOOP_KEY = `<rozie name="KeyedHostLoop">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ xs: [] }</data>
<template>
  <div>
    <MyComp r-for="x in xs" :key="x.id" />
  </div>
</template>
</rozie>
`;

describe('emitLit — component :key wraps in keyed() (keyed-remount codegen Task 3)', () => {
  it('imports the `keyed` directive when a component carries :key', () => {
    const code = compile(SRC_KEYED);
    expect(code).toContain(
      "import { keyed } from 'lit/directives/keyed.js';",
    );
  });

  it('wraps the component invocation in `keyed(<expr>, html`…`)`', () => {
    const code = compile(SRC_KEYED);
    expect(code).toMatch(/\$\{keyed\(String\(this\._v\.value\), html`<rozie-my-comp/);
  });

  it('does NOT emit an inert `.key=` property binding on the wrapped component', () => {
    const code = compile(SRC_KEYED);
    expect(code).not.toMatch(/\.key=\$\{/);
  });

  it('does NOT declare the unrelated `_rozieReconcileSeq` counter (that is r-external-only)', () => {
    const code = compile(SRC_KEYED);
    expect(code).not.toContain('_rozieReconcileSeq');
  });

  it('control: component WITHOUT :key emits no keyed() wrap and no keyed import', () => {
    const code = compile(SRC_NO_KEY);
    expect(code).not.toContain(
      "import { keyed } from 'lit/directives/keyed.js';",
    );
    expect(code).not.toMatch(/keyed\(/);
  });

  it('control: r-for loop :key on a component is unaffected (no keyed() wrap; loop key path unchanged)', () => {
    const code = compile(SRC_LOOP_KEY);
    // The r-for path does not route through remountKeyExpression, so there is
    // no `keyed()` wrap and no `keyed` import contributed by THIS element —
    // `repeat()` (or the loop's own key handling) is the loop's own concern.
    expect(code).not.toContain(
      "import { keyed } from 'lit/directives/keyed.js';",
    );
  });
});
