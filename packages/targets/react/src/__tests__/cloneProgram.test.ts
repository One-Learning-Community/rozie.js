// Plan 04-02 Task 1 (TDD RED) — cloneScriptProgram tests for React target.
//
// Mirror of packages/targets/vue/src/__tests__/cloneProgram.test.ts.
// Per IR-04 (cross-mutation hazard T-2-05-01): per-target emitters MUST clone
// the IR's preserved Babel `File` before any mutation. Phase 4 (React) and
// Phase 5 (Svelte/Angular) consume the SAME ir.setupBody.scriptProgram —
// mutating in place would corrupt downstream targets in a multi-target build.
//
// `cloneScriptProgram` uses `t.cloneNode(file, /* deep */ true,
// /* withoutLoc */ false)`. Tests assert:
//   1. Returned File is a NEW object (reference inequality)
//   2. Mutating the clone leaves the original Program.body untouched
//   3. Inner-node `loc` field is preserved on the clone
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

describe('cloneScriptProgram (React)', () => {
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
    clone.program.body.push(
      t.expressionStatement(t.callExpression(t.identifier('foo'), [])),
    );

    expect(clone.program.body.length).toBe(originalLen + 1);
    expect(original.program.body.length).toBe(originalLen);
  });

  it('preserves inner-node `loc` field on the clone (deep, withoutLoc=false)', () => {
    const original = parseProgram(`const x = 1;\n`);
    const clone = cloneScriptProgram(original);

    const cloneDecl = clone.program.body[0]!;
    expect(cloneDecl.loc).not.toBeNull();
    if (cloneDecl.loc) {
      expect(cloneDecl.loc.start.line).toBe(1);
    }
  });
});
