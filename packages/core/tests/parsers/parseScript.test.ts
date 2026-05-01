// PARSE-03 — <script> block parser scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 03. Anchors paths per RESEARCH.md Pitfall 8.
//
// Marquee acceptance: console.log preservation — RESEARCH.md Risk 5 / D-08
// trust-erosion floor. console.log statements in user <script> MUST survive
// verbatim through to the AST and ultimately every emitted target.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

describe('parseScript (PARSE-03)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
  });

  // PARSE-03 / Risk 5 / D-08 trust-erosion floor — console.log preservation
  it.todo('console.log preservation (PARSE-03 / Risk 5 / D-08 trust-erosion floor): Counter.rozie script with console.log call survives verbatim through @babel/parser → RozieAST');
  it.todo('comments preserved: /* block */ and // line comments attached to statements via attachComment: true');
  it.todo('Modal.rozie multi-$onMount preserved as separate AST nodes (D-04 lifecycle: multiple $onMount calls run in source order)');
  it.todo('emits ROZ030 on Babel parse error in <script>');
  it.todo('emits ROZ031 on unrecoverable script syntax error');
});
