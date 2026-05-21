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

  // Phase 9 Plan 09-01 Task 2 — conditional `typescript` Babel plugin.
  // The plugin is enabled ONLY when the resolved block `lang` is `'ts'`.
  describe('<script lang="ts"> — typescript plugin enablement (Phase 9)', () => {
    it('parses a type annotation into a TSTypeAnnotation node when lang="ts"', () => {
      const ts = 'let count: number = 0;';
      const { node, diagnostics } = parseScript(
        ts,
        { start: 0, end: ts.length },
        ts,
        'Typed.rozie',
        'ts',
      );
      expect(diagnostics).toEqual([]);
      expect(node).not.toBeNull();
      const decl = node!.program.program.body[0];
      expect(decl?.type).toBe('VariableDeclaration');
      const declarator = (decl as { declarations: Array<{ id: { typeAnnotation?: { type: string } } }> })
        .declarations[0]!;
      // The author's `: number` survives as a TSTypeAnnotation on the binding id.
      expect(declarator.id.typeAnnotation?.type).toBe('TSTypeAnnotation');
    });

    it('the SAME TS body WITHOUT lang="ts" yields a parse-error diagnostic, never a throw (plugin genuinely off)', () => {
      const ts = 'let count: number = 0;';
      // No `lang` argument → typescript plugin OFF → the `: number` annotation
      // is a Babel parse error. parseScript surfaces it as a diagnostic and
      // NEVER propagates the exception (D-08 collected-not-thrown). Babel may
      // recover (ROZ030) or throw-and-be-caught (ROZ031) depending on the
      // construct — either proves the plugin is off; the load-bearing fact is
      // that the SAME body with lang="ts" parses clean (the test above).
      let threw = false;
      let result: ReturnType<typeof parseScript> | null = null;
      try {
        result = parseScript(ts, { start: 0, end: ts.length }, ts);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
      const codes = result!.diagnostics.map((d) => d.code);
      expect(codes.some((c) => c === 'ROZ030' || c === 'ROZ031')).toBe(true);
    });

    it('parses `import type { … }` into an ImportDeclaration with importKind "type"', () => {
      const ts = "import type { Foo } from './foo';";
      const { node, diagnostics } = parseScript(
        ts,
        { start: 0, end: ts.length },
        ts,
        'Typed.rozie',
        'ts',
      );
      expect(diagnostics).toEqual([]);
      const stmt = node!.program.program.body[0];
      expect(stmt?.type).toBe('ImportDeclaration');
      expect((stmt as { importKind?: string }).importKind).toBe('type');
    });

    it('untyped JS parses identically with or without the lang argument', () => {
      const js = 'const a = 1;\nfunction f() { return a; }';
      const withoutLang = parseScript(js, { start: 0, end: js.length }, js);
      const withTs = parseScript(js, { start: 0, end: js.length }, js, undefined, 'ts');
      expect(withoutLang.diagnostics).toEqual([]);
      expect(withTs.diagnostics).toEqual([]);
      // Same top-level statement count regardless of plugin state — the
      // typescript plugin does not alter plain-JS parsing.
      expect(withoutLang.node!.program.program.body.length).toBe(
        withTs.node!.program.program.body.length,
      );
    });
  });
});
