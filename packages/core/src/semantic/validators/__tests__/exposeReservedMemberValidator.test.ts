// Phase 46 Plan 46-02 Task 1 — ROZ137 expose-verb-shadows-inherited-member
// advisory validator (ITEM-3, D-02/D-03b).
//
// An `$expose` verb whose name shadows an INHERITED member of the emitted class
// is a target-asymmetric footgun: on Angular+Lit the exposed method becomes a
// class method, and if its name is an `Object.prototype` member
// (`valueOf`/`toString`/`hasOwnProperty`/…) it breaks the legacy `@property`
// decorator's `Object`-assignability and cascades TS1240/TS1271 to EVERY
// decorator on the Lit class (the listbox `valueOf` finding — 38 errors from one
// name). On Lit ALSO an `HTMLElement`/`Element`/`Node` inherited member
// (`focus`/`blur`/`scrollTo`/`nodeType`/…) collides with the LitElement base-
// class method (the Embla `scrollTo`→TS2416 finding). ROZ137 (warning) fires on
// a reserved verb name, steering the author to a suffix rename (e.g. readValue).
// The validator NEVER throws on malformed input (D-08) and never mutates the AST.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import { runExposeReservedMemberValidator } from '../exposeReservedMemberValidator.js';
import { collectAllDeclarations } from '../../bindings.js';
import type { RozieAST } from '../../../ast/types.js';

function parseOrThrow(source: string, filename = 'expose.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

function analyzeSource(source: string, filename = 'expose.rozie'): Diagnostic[] {
  return analyzeAST(parseOrThrow(source, filename)).diagnostics;
}

const roz137 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.EXPOSE_RESERVED_MEMBER);

function exposeComponent(verb: string): string {
  return `<rozie name="X">
<data>{ x: 1 }</data>
<script>
function ${verb}() { return $data.x }
$expose({ ${verb} })
</script>
<template><div></div></template>
</rozie>`;
}

describe('exposeReservedMemberValidator — ROZ137 (Phase 46 ITEM-3)', () => {
  it('fires warning on $expose({ valueOf }) (Object.prototype member, Angular+Lit)', () => {
    const hits = roz137(analyzeSource(exposeComponent('valueOf')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
    expect(hits[0]!.code).toBe('ROZ137');
    expect(hits[0]!.message).toContain('valueOf');
    // Names the affected class targets for the Object.prototype set.
    expect(hits[0]!.message).toContain('Angular');
    expect(hits[0]!.message).toContain('Lit');
    expect(hits[0]!.loc.start).toBeGreaterThan(0);
  });

  it('fires on $expose({ toString }) (Object.prototype member)', () => {
    const hits = roz137(analyzeSource(exposeComponent('toString')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('toString');
  });

  it('fires on $expose({ hasOwnProperty }) (Object.prototype member)', () => {
    const hits = roz137(analyzeSource(exposeComponent('hasOwnProperty')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('hasOwnProperty');
  });

  it('fires on $expose({ focus }) (HTMLElement/Element/Node member, Lit)', () => {
    const hits = roz137(analyzeSource(exposeComponent('focus')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
    // The DOM-inherited set is Lit-only; the message names Lit (not Angular).
    expect(hits[0]!.message).toContain('Lit');
  });

  it('fires on $expose({ scrollTo }) (HTMLElement member — Embla finding)', () => {
    const hits = roz137(analyzeSource(exposeComponent('scrollTo')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('scrollTo');
  });

  it('fires on $expose({ nodeType }) (Node member)', () => {
    const hits = roz137(analyzeSource(exposeComponent('nodeType')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('nodeType');
  });

  it('does NOT fire on a benign verb $expose({ open }) — zero false positives', () => {
    const hits = roz137(analyzeSource(exposeComponent('open')));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('does NOT fire on a benign verb $expose({ clear })', () => {
    const hits = roz137(analyzeSource(exposeComponent('clear')));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('does NOT fire when there is no $expose call at all', () => {
    const src = `<rozie name="X">
<data>{ x: 1 }</data>
<script>
function valueOf() { return $data.x }
</script>
<template><div></div></template>
</rozie>`;
    // No $expose → no exposed verbs → no ROZ137 (a plain local helper named
    // valueOf is a different concern, not flagged by this validator).
    const hits = roz137(analyzeSource(src));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('flags multiple reserved verbs in one $expose call (one diagnostic each)', () => {
    const src = `<rozie name="X">
<data>{ x: 1 }</data>
<script>
function valueOf() { return $data.x }
function focus() { return $data.x }
function open() { return $data.x }
$expose({ valueOf, focus, open })
</script>
<template><div></div></template>
</rozie>`;
    const hits = roz137(analyzeSource(src));
    // valueOf + focus fire; open does not.
    expect(hits.length, JSON.stringify(hits)).toBe(2);
    const names = hits.map((h) => h.message);
    expect(names.some((m) => m.includes('valueOf'))).toBe(true);
    expect(names.some((m) => m.includes('focus'))).toBe(true);
  });

  it('never throws on a malformed $expose (D-08)', () => {
    const ast = parseOrThrow(`<rozie name="X">
<data>{ x: 1 }</data>
<script>
$expose(notAnObject)
</script>
<template><div></div></template>
</rozie>`);
    const bindings = collectAllDeclarations(ast);
    const diagnostics: Diagnostic[] = [];
    expect(() =>
      runExposeReservedMemberValidator(ast, bindings, diagnostics),
    ).not.toThrow();
  });

  it('never throws when called directly with empty diagnostics on a no-expose AST (D-08)', () => {
    const ast = parseOrThrow(`<rozie name="X">
<template><div></div></template>
</rozie>`);
    const bindings = collectAllDeclarations(ast);
    const diagnostics: Diagnostic[] = [];
    expect(() =>
      runExposeReservedMemberValidator(ast, bindings, diagnostics),
    ).not.toThrow();
    expect(roz137(diagnostics).length).toBe(0);
  });
});
