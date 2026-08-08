/**
 * reservedSlotNameValidator — ROZ210 reserved unnamed-slot key collision
 * (Quick 260808-iyh, D5 Task 1).
 *
 * RED-FIRST: `runReservedSlotNameValidator` does not yet exist and is not
 * yet wired into `analyzeAST`, so every ROZ210-positive case below fails
 * until Task 1's implementation lands.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import type { RozieAST } from '../../../ast/types.js';

function parseOrThrow(source: string, filename = 'reservedSlot.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(`parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`);
  }
  return ast;
}

function analyzeSource(source: string, filename = 'reservedSlot.rozie'): Diagnostic[] {
  return analyzeAST(parseOrThrow(source, filename)).diagnostics;
}

const roz210 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.RESERVED_SLOT_NAME);

function templateComponent(templateBody: string): string {
  return `<rozie name="ReservedSlot">
<template>${templateBody}</template>
</rozie>`;
}

describe('reservedSlotNameValidator — ROZ210 reserved unnamed-slot key (D5)', () => {
  it('fires exactly one ROZ210 on <slot name="default">, severity error, loc at the name value', () => {
    const hits = roz210(analyzeSource(templateComponent('<div><slot name="default" /></div>')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.code).toBe('ROZ210');
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.loc.start).toBeGreaterThan(0);
  });

  it('never throws (D-08) even when the validator is exercised against a real diagnostics accumulator', () => {
    expect(() =>
      analyzeSource(templateComponent('<div><slot name="default" /></div>')),
    ).not.toThrow();
  });

  it('produces zero ROZ210 for <slot name="header">', () => {
    const hits = roz210(analyzeSource(templateComponent('<div><slot name="header" /></div>')));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('produces zero ROZ210 for a bare unnamed <slot>', () => {
    const hits = roz210(analyzeSource(templateComponent('<div><slot /></div>')));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('produces zero ROZ210 for <slot name="defaultRow">', () => {
    const hits = roz210(analyzeSource(templateComponent('<div><slot name="defaultRow" /></div>')));
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });
});
