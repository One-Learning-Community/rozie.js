// Phase 15 Plan 15-01 (Wave 0 scaffold) — `r-on` parser + literal-key cases (R1).
//
// `r-on="<expr>"` is the object-form-only listener-spread directive: the
// expression evaluates to an object whose own enumerable keys are each applied
// as an event listener on the host element (the `ListenerSpreadIR` node — D-16,
// landing on `TemplateElementIR.listenerSpreads` parallel to `events`).
//
// R1 has three halves:
//   - the bare `r-on="someObj"` form is VALID — it parses to a `directive` attr
//     named `on` and produces no diagnostic. (PASSES today — the parser
//     already accepts any `r-*` directive name; the listenerSpread LOWERING
//     lands in Wave 1.)
//   - the `r-on:click="x"` COLON form is NOT supported — colon args are a
//     `r-model:propName`-only feature, so a colon on `r-on` is the
//     ROZ972 (R_ON_COLON_FORM) compile error (mirror of Phase 14's ROZ969).
//   - literal-key `r-on="{ 'click.stop': fn, 'input.debounce(300)': onInput }"`
//     lowers with a populated `listenerSpreads[0].literalKeys` entry whose
//     `eventName` and resolved `modifierPipeline` reflect the per-key parse
//     (the existing peggy modifier grammar applies; D-15).
//
// The ROZ972 and literal-key cases are INTENTIONALLY RED. Wave 1 (Plan 15-02)
// adds (a) the lowerTemplate guard that emits R_ON_COLON_FORM, and (b) the
// r-on lowering branch that builds `ListenerSpreadIR` with `literalKeys`. The
// `RozieErrorCode` symbol itself already exists (Task 1 registered it).
import { describe, it, expect } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { TemplateElement, TemplateNode } from '../ast/blocks/TemplateAST.js';
import type {
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
} from '../ir/types.js';

/** Wrap a single-element template body in a minimal `.rozie` envelope. */
function rozieSource(elementMarkup: string): string {
  return `<rozie name="ROnProbe">
<template>
${elementMarkup}
</template>
</rozie>
`;
}

/** Find the first AST `TemplateElement` in a parsed template's children. */
function firstElement(children: TemplateNode[]): TemplateElement {
  const el = children.find(
    (c): c is TemplateElement => c.type === 'TemplateElement',
  );
  if (!el) throw new Error('no TemplateElement parsed');
  return el;
}

/** Find the first IR `TemplateElement` in an IR template's children. */
function firstIRElement(node: IRTemplateNode | null): TemplateElementIR {
  if (!node) throw new Error('IR template is null');
  // The outer wrapper is a TemplateFragment when the template body has
  // surrounding whitespace; the lowered single element may be nested directly
  // under it. Walk to the first TemplateElement we find.
  const stack: IRTemplateNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (cur.type === 'TemplateElement') return cur;
    if (cur.type === 'TemplateFragment') stack.push(...cur.children);
  }
  throw new Error('no IR TemplateElement found');
}

describe('r-on parser cases (Phase 15 R1)', () => {
  it('R1: a bare r-on="someObj" parses with zero diagnostics', () => {
    const { ast, diagnostics } = parse(rozieSource('<div r-on="someObj"></div>'));
    expect(ast, 'ast should be non-null').not.toBeNull();
    expect(diagnostics, JSON.stringify(diagnostics)).toEqual([]);
  });

  it('R1: a bare r-on="someObj" yields a directive attr named "on" on the tag', () => {
    const { ast } = parse(rozieSource('<div r-on="someObj"></div>'));
    const el = firstElement(ast!.template!.children);
    const attr = el.attributes.find((a) => a.rawName === 'r-on');
    expect(attr, 'r-on attribute should be present on the parsed tag').toBeDefined();
    expect(attr?.kind).toBe('directive');
    expect(attr?.name).toBe('on');
  });

  it('R1: r-on:click="x" colon form yields exactly one ROZ972 error', () => {
    // Wave 1 (Plan 15-02) implements this — currently RED.
    const { diagnostics } = parse(rozieSource('<div r-on:click="x"></div>'));
    const colonFormDiags = diagnostics.filter(
      (d) => d.code === RozieErrorCode.R_ON_COLON_FORM,
    );
    expect(
      colonFormDiags.length,
      `expected exactly one ROZ972 for r-on:click; got ${JSON.stringify(diagnostics)}`,
    ).toBe(1);
    expect(colonFormDiags[0]!.severity).toBe('error');
  });

  it('R1: literal-key r-on="{ \'click.stop\': fn }" lowers a populated listenerSpreads[0].literalKeys entry', () => {
    // Wave 1 (Plan 15-02) implements this — currently RED. The IR-level
    // assertion lives here (NOT a compile-time diagnostic) so it goes red
    // until lowerTemplate's r-on branch builds the literalKeys structure.
    const source = `<rozie name="ROnLiteralProbe">
<script>
const fn = (e) => { e.preventDefault() }
</script>
<template>
<div r-on="{ 'click.stop': fn }"></div>
</template>
</rozie>
`;
    const { ast, diagnostics: parseDiags } = parse(source);
    expect(ast, JSON.stringify(parseDiags)).not.toBeNull();
    const { ir, diagnostics: lowerDiags } = lowerToIR(ast!, {
      modifierRegistry: createDefaultRegistry(),
    });
    expect(ir, JSON.stringify(lowerDiags)).not.toBeNull();
    expect(
      lowerDiags.filter((d) => d.severity === 'error'),
      `unexpected lowering errors: ${JSON.stringify(lowerDiags)}`,
    ).toEqual([]);
    const el = firstIRElement(ir!.template);
    // The author-written r-on lands at index 0 (push happens during the
    // attribute loop, BEFORE synthesizeListenersFallthrough appends the
    // bare-$listeners auto-spread). The synthesized entry lives at
    // index 1 on this single-html-root default-inherit-listeners shape.
    expect(
      el.listenerSpreads.length,
      `expected at least one listenerSpreads entry; got ${JSON.stringify(el.listenerSpreads)}`,
    ).toBeGreaterThanOrEqual(1);
    const spread = el.listenerSpreads[0]!;
    expect(spread.literalKeys, 'literalKeys should be populated for an ObjectExpression').toBeDefined();
    expect(spread.literalKeys!.length).toBeGreaterThan(0);
    const first = spread.literalKeys![0]!;
    expect(first.eventName).toBe('click');
    expect(
      first.modifierPipeline.length,
      'click.stop should produce at least one resolved modifier pipeline entry',
    ).toBeGreaterThan(0);
  });
});
