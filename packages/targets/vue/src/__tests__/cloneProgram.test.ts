// Phase 3 Plan 02 Task 1 (TDD RED) — cloneScriptProgram tests.
//
// Per RESEARCH.md Pattern 2 (lines 307-330) + IR types.ts cross-mutation
// warning (T-2-05-01): per-target emitters MUST clone the IR's preserved
// Babel `File` before any mutation. Phase 4 (React) and Phase 5
// (Svelte/Angular) will consume the SAME IR.setupBody.scriptProgram —
// mutating in place would corrupt downstream targets in a multi-target build.
//
// `cloneScriptProgram` uses `t.cloneNode(file, /* deep */ true,
// /* withoutLoc */ false)`. Tests assert:
//   1. Returned File is a NEW object (reference inequality)
//   2. Mutating the clone leaves the original Program.body untouched
//   3. Inner-node `loc` field is preserved on the clone (so @babel/generator's
//      source-map output references the original .rozie offsets)
import { describe, expect, it } from 'vitest';
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';

function parseProgram(src: string): t.File {
  return babelParse(src, {
    sourceType: 'module',
    attachComment: true,
    sourceFilename: 'test.rozie',
  });
}

describe('cloneScriptProgram', () => {
  it('returns a NEW File node (reference inequality)', () => {
    const original = parseProgram(`const x = 1;\nconsole.log(x);\n`);
    const clone = cloneScriptProgram(original);
    expect(clone).not.toBe(original);
    expect(clone.program).not.toBe(original.program);
    expect(clone.program.body).not.toBe(original.program.body);
  });

  it('mutating clone leaves original Program.body untouched', () => {
    const original = parseProgram(`const x = 1;\n`);
    const originalLen = original.program.body.length;

    const clone = cloneScriptProgram(original);
    // Push a synthetic statement onto the clone.
    clone.program.body.push(
      t.expressionStatement(t.callExpression(t.identifier('foo'), [])),
    );

    expect(clone.program.body.length).toBe(originalLen + 1);
    expect(original.program.body.length).toBe(originalLen);
  });

  it('mutating an inner node on the clone does not affect the original', () => {
    const original = parseProgram(`const x = 1;\n`);
    const clone = cloneScriptProgram(original);

    // Mutate the VariableDeclaration's first declarator's id name on the clone.
    const cloneDecl = clone.program.body[0]!;
    const origDecl = original.program.body[0]!;
    if (
      t.isVariableDeclaration(cloneDecl) &&
      t.isVariableDeclaration(origDecl)
    ) {
      const cloneDeclarator = cloneDecl.declarations[0]!;
      const origDeclarator = origDecl.declarations[0]!;
      if (t.isIdentifier(cloneDeclarator.id) && t.isIdentifier(origDeclarator.id)) {
        cloneDeclarator.id.name = 'mutated';
        expect(origDeclarator.id.name).toBe('x');
      }
    }
  });

  it('preserves inner-node `loc` field on the clone (deep, withoutLoc=false)', () => {
    const original = parseProgram(`const x = 1;\n`);
    const clone = cloneScriptProgram(original);

    const cloneDecl = clone.program.body[0]!;
    expect(cloneDecl.loc).not.toBeNull();
    if (cloneDecl.loc) {
      // Same line/column as the original since both come from the same source.
      expect(cloneDecl.loc.start.line).toBe(1);
    }
    if (t.isVariableDeclaration(cloneDecl)) {
      const declarator = cloneDecl.declarations[0]!;
      expect(declarator.loc).not.toBeNull();
    }
  });
});
