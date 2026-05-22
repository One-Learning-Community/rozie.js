// Phase 14 Plan 14-01 (Wave 0 scaffold) — `r-bind` parser cases (R1).
//
// `r-bind="<expr>"` is the bare-spread attribute-fallthrough form: the
// expression evaluates to an object whose own enumerable keys are applied as
// attributes on the host element (the `spreadBinding` IR variant — D-07).
//
// R1 has two halves:
//   - the bare `r-bind="obj"` form is VALID — it parses to a `directive` attr
//     named `bind` and produces no diagnostic. (PASSES today — the parser
//     already accepts any `r-*` directive name; the spreadBinding LOWERING
//     lands in Wave 1.)
//   - the `r-bind:foo="x"` COLON form is NOT supported — colon args are a
//     `r-model:propName`-only feature, so a colon on `r-bind` is the
//     ROZ969 (R_BIND_COLON_FORM) compile error.
//
// The ROZ969 case is INTENTIONALLY RED. Wave 1 (Plan 14-02) adds the
// lowerTemplate guard that emits R_BIND_COLON_FORM. The `RozieErrorCode`
// symbol itself already exists (Task 1 registered it), so this references the
// registry directly — no string-literal placeholder.
import { describe, it, expect } from 'vitest';
import { parse } from '../parse.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { TemplateElement, TemplateNode } from '../ast/blocks/TemplateAST.js';

/** Wrap a single-element template body in a minimal `.rozie` envelope. */
function rozieSource(elementMarkup: string): string {
  return `<rozie name="RBindProbe">
<template>
${elementMarkup}
</template>
</rozie>
`;
}

/** Find the first `TemplateElement` in a parsed template's children. */
function firstElement(children: TemplateNode[]): TemplateElement {
  const el = children.find(
    (c): c is TemplateElement => c.type === 'TemplateElement',
  );
  if (!el) throw new Error('no TemplateElement parsed');
  return el;
}

describe('r-bind parser cases (Phase 14 R1)', () => {
  it('R1: a bare r-bind="someObj" parses with zero diagnostics', () => {
    const { ast, diagnostics } = parse(rozieSource('<div r-bind="someObj"></div>'));
    expect(ast, 'ast should be non-null').not.toBeNull();
    expect(diagnostics, JSON.stringify(diagnostics)).toEqual([]);
  });

  it('R1: a bare r-bind="someObj" yields a directive attr named "bind" on the tag', () => {
    const { ast } = parse(rozieSource('<div r-bind="someObj"></div>'));
    const el = firstElement(ast!.template!.children);
    const attr = el.attributes.find((a) => a.rawName === 'r-bind');
    expect(attr, 'r-bind attribute should be present on the parsed tag').toBeDefined();
    expect(attr?.kind).toBe('directive');
    expect(attr?.name).toBe('bind');
  });

  it('R1: r-bind:foo="x" colon form yields exactly one ROZ969 error', () => {
    // Wave 1 (Plan 14-02) implements this — currently RED.
    const { diagnostics } = parse(rozieSource('<div r-bind:foo="x"></div>'));
    const colonFormDiags = diagnostics.filter(
      (d) => d.code === RozieErrorCode.R_BIND_COLON_FORM,
    );
    expect(
      colonFormDiags.length,
      `expected exactly one ROZ969 for r-bind:foo; got ${JSON.stringify(diagnostics)}`,
    ).toBe(1);
    expect(colonFormDiags[0]!.severity).toBe('error');
  });
});
