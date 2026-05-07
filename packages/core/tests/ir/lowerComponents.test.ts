// Phase 06.2 P1 Task 2 — lowerComponents tests.
// Implementation: packages/core/src/ir/lowerers/lowerComponents.ts.
import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';
import { parseComponents } from '../../src/parsers/parseComponents.js';
import { lowerComponents } from '../../src/ir/lowerers/lowerComponents.js';

function parseAndLower(src: string): {
  table: ReturnType<typeof lowerComponents>;
  parseDiagnostics: Diagnostic[];
  lowerDiagnostics: Diagnostic[];
} {
  const { node, diagnostics: parseDiagnostics } = parseComponents(
    src,
    { start: 0, end: src.length },
    src,
  );
  const lowerDiagnostics: Diagnostic[] = [];
  const table = lowerComponents(node, lowerDiagnostics);
  return { table, parseDiagnostics, lowerDiagnostics };
}

describe('lowerComponents (Phase 06.2 P1 Task 2)', () => {
  it('returns an empty Map when AST is null', () => {
    const out = lowerComponents(null, []);
    expect(out).toBeInstanceOf(Map);
    expect(out.size).toBe(0);
  });

  it('lowers a populated <components> block to a source-ordered Map', () => {
    const src = '{ Modal: "./Modal.rozie", CardHeader: "./CardHeader.rozie" }';
    const { table, parseDiagnostics } = parseAndLower(src);
    expect(parseDiagnostics).toEqual([]);
    expect(table.size).toBe(2);
    // Insertion order = source order (D-129).
    const keys = [...table.keys()];
    expect(keys).toEqual(['Modal', 'CardHeader']);
    const modal = table.get('Modal')!;
    expect(modal.type).toBe('ComponentDecl');
    expect(modal.localName).toBe('Modal');
    expect(modal.importPath).toBe('./Modal.rozie');
    expect(modal.sourceLoc).toBeDefined();
    expect(typeof modal.sourceLoc.start).toBe('number');
    const cardHeader = table.get('CardHeader')!;
    expect(cardHeader.localName).toBe('CardHeader');
    expect(cardHeader.importPath).toBe('./CardHeader.rozie');
  });

  it('silently skips non-PascalCase keys (Task 4 owns the diagnostic, if any)', () => {
    // 'modal' (lowercase) — Task 2 skips so the Map only contains valid entries.
    const src = '{ modal: "./Modal.rozie", Card: "./Card.rozie" }';
    const { table } = parseAndLower(src);
    expect(table.size).toBe(1);
    expect(table.has('modal')).toBe(false);
    expect(table.has('Card')).toBe(true);
  });

  it('passes through duplicate import paths (ROZ923 in Task 4)', () => {
    const src = '{ A: "./X.rozie", B: "./X.rozie" }';
    const { table } = parseAndLower(src);
    expect(table.size).toBe(2);
    expect(table.get('A')!.importPath).toBe('./X.rozie');
    expect(table.get('B')!.importPath).toBe('./X.rozie');
  });

  it('skips entries with non-StringLiteral values (parseComponents already flagged)', () => {
    const src = '{ Modal: SomeIdent, Card: "./Card.rozie" }';
    const { table, parseDiagnostics } = parseAndLower(src);
    // parseComponents emits the ROZ011 placeholder.
    expect(parseDiagnostics.some((d) => d.code === 'ROZ011' || d.code === 'ROZ921')).toBe(true);
    expect(table.size).toBe(1);
    expect(table.has('Modal')).toBe(false);
    expect(table.has('Card')).toBe(true);
  });
});
