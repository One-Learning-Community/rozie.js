// PARSE-03 — <script> block parser tests.
// Implementation: packages/core/src/parsers/parseScript.ts (Plan 03 Task 2).
// Anchors paths per RESEARCH.md Pitfall 8.
//
// Marquee acceptance: console.log preservation — RESEARCH.md Risk 5 / D-08
// trust-erosion floor. console.log statements in user <script> MUST survive
// verbatim through to the AST and ultimately every emitted target.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Statement, ExpressionStatement, CallExpression } from '@babel/types';
import { splitBlocks } from '../../src/splitter/splitBlocks.js';
import { parseScript } from '../../src/parsers/parseScript.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

function loadScript(name: string) {
  const source = readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
  const blocks = splitBlocks(source, `${name}.rozie`);
  if (!blocks.script) throw new Error(`${name}.rozie has no <script> block`);
  return { source, content: blocks.script.content, contentLoc: blocks.script.contentLoc };
}

function isCallToIdentifier(stmt: Statement, name: string): boolean {
  if (stmt.type !== 'ExpressionStatement') return false;
  const exprStmt = stmt as ExpressionStatement;
  if (exprStmt.expression.type !== 'CallExpression') return false;
  const callee = (exprStmt.expression as CallExpression).callee;
  return callee.type === 'Identifier' && callee.name === name;
}

describe('parseScript (PARSE-03)', () => {
  it('parses Counter.rozie <script> into Babel AST with 5 top-level statements', () => {
    const { source, content, contentLoc } = loadScript('Counter');
    const { node, diagnostics } = parseScript(content, contentLoc, source, 'Counter.rozie');
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    expect(node!.program.type).toBe('File');
    // Phase 3 Plan 02 Task 3: console.log("hello from rozie") (DX-03 anchor) +
    // 2 const $computed declarations + increment + decrement = 5 top-level statements
    expect(node!.program.program.body.length).toBe(5);
  });

  it('preserves multiple $onMount calls in Dropdown.rozie as separate AST nodes (source-order multi-lifecycle)', () => {
    const { source, content, contentLoc } = loadScript('Dropdown');
    const { node, diagnostics } = parseScript(content, contentLoc, source, 'Dropdown.rozie');
    expect(diagnostics).toEqual([]);
    const onMounts = node!.program.program.body.filter(s => isCallToIdentifier(s, '$onMount'));
    expect(onMounts.length).toBe(2);
  });

  it('preserves multiple $onMount AND $onUnmount calls in Modal.rozie in source order', () => {
    const { source, content, contentLoc } = loadScript('Modal');
    const { node, diagnostics } = parseScript(content, contentLoc, source, 'Modal.rozie');
    expect(diagnostics).toEqual([]);
    const lifecycle = node!.program.program.body.filter(
      s => isCallToIdentifier(s, '$onMount') || isCallToIdentifier(s, '$onUnmount'),
    );
    // Modal.rozie has 2x $onMount + 1x $onUnmount = 3 lifecycle calls.
    expect(lifecycle.length).toBeGreaterThanOrEqual(3);
    const onMounts = lifecycle.filter(s => isCallToIdentifier(s, '$onMount'));
    const onUnmounts = lifecycle.filter(s => isCallToIdentifier(s, '$onUnmount'));
    expect(onMounts.length).toBeGreaterThanOrEqual(2);
    expect(onUnmounts.length).toBeGreaterThanOrEqual(1);
  });

  it('PARSE-03 / Risk 5 trust-erosion floor — console.log("hello from rozie") survives parsing into AST verbatim', () => {
    // Phase 3 Plan 02 Task 3 promoted this from a synthetic injection to a
    // real-source anchor: examples/Counter.rozie's <script> block now contains
    // `console.log("hello from rozie")` as its first top-level statement. We
    // assert it survives parse → AST verbatim.
    const counterSrc = readFileSync(resolve(EXAMPLES_DIR, 'Counter.rozie'), 'utf8');
    expect(counterSrc).toContain('console.log("hello from rozie")');
    const blocks = splitBlocks(counterSrc, 'Counter.rozie');
    const { node, diagnostics } = parseScript(
      blocks.script!.content,
      blocks.script!.contentLoc,
      counterSrc,
      'Counter.rozie',
    );
    expect(diagnostics).toEqual([]);
    const consoleCalls = node!.program.program.body.filter(s => {
      if (s.type !== 'ExpressionStatement') return false;
      const expr = (s as ExpressionStatement).expression;
      if (expr.type !== 'CallExpression') return false;
      const call = expr as CallExpression;
      if (call.callee.type !== 'MemberExpression') return false;
      const memberObj = call.callee.object;
      const memberProp = call.callee.property;
      return (
        memberObj.type === 'Identifier' &&
        memberObj.name === 'console' &&
        memberProp.type === 'Identifier' &&
        memberProp.name === 'log'
      );
    });
    expect(consoleCalls.length).toBe(1);
    const stmt = consoleCalls[0] as ExpressionStatement;
    const arg = (stmt.expression as CallExpression).arguments[0]!;
    expect(arg.type).toBe('StringLiteral');
    expect((arg as { type: 'StringLiteral'; value: string }).value).toBe('hello from rozie');
  });

  it('attaches comments to AST per attachComment: true', () => {
    const synthetic = '// trust-floor comment\nconst x = 1;\n/* block */\nconst y = 2;';
    const { node, diagnostics } = parseScript(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    expect(node!.program.comments?.length).toBeGreaterThan(0);
    const allValues = (node!.program.comments ?? []).map(c => c.value).join('|');
    expect(allValues).toMatch(/trust-floor/);
    expect(allValues).toMatch(/block/);
  });

  it('threads byte offsets — top-level statement indices land within contentLoc range', () => {
    const { source, content, contentLoc } = loadScript('Counter');
    const { node } = parseScript(content, contentLoc, source, 'Counter.rozie');
    for (const stmt of node!.program.program.body) {
      const start = stmt.loc?.start.index ?? stmt.start;
      const end = stmt.loc?.end.index ?? stmt.end;
      expect(typeof start).toBe('number');
      expect(typeof end).toBe('number');
      expect(start!).toBeGreaterThanOrEqual(contentLoc.start);
      expect(end!).toBeLessThanOrEqual(contentLoc.end);
    }
  });

  it('emits ROZ030 or ROZ031 (recoverable or unrecoverable) on syntax errors', () => {
    const synthetic = 'const = 1;';
    const { diagnostics } = parseScript(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    const errs = diagnostics.filter(d => d.code === 'ROZ030' || d.code === 'ROZ031');
    expect(errs.length).toBeGreaterThan(0);
  });

  it('does NOT throw on truly hostile input — D-08 collected-not-thrown', () => {
    const synthetic = '<<<<<<';
    let threw = false;
    let result: ReturnType<typeof parseScript> | null = null;
    try {
      result = parseScript(synthetic, { start: 0, end: synthetic.length }, synthetic);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    // Either ROZ030 (Babel recovered) or ROZ031 (we caught) is acceptable.
    expect(result!.diagnostics.length).toBeGreaterThan(0);
    const codes = result!.diagnostics.map(d => d.code);
    expect(codes.some(c => c === 'ROZ030' || c === 'ROZ031')).toBe(true);
  });

  it('preserves let-declared mutable state (Modal.rozie savedBodyOverflow)', () => {
    const { source, content, contentLoc } = loadScript('Modal');
    const { node, diagnostics } = parseScript(content, contentLoc, source, 'Modal.rozie');
    expect(diagnostics).toEqual([]);
    // Find the `let savedBodyOverflow = ''` declaration.
    const letDecls = node!.program.program.body.filter(
      s => s.type === 'VariableDeclaration' && s.kind === 'let',
    );
    expect(letDecls.length).toBeGreaterThan(0);
  });

  it('preserves spread + template literal in TodoList.rozie', () => {
    const { source, content, contentLoc } = loadScript('TodoList');
    const { node, diagnostics } = parseScript(content, contentLoc, source, 'TodoList.rozie');
    expect(diagnostics).toEqual([]);
    // Just verify the file parsed successfully and produced a non-empty body.
    expect(node!.program.program.body.length).toBeGreaterThan(0);
  });
});
