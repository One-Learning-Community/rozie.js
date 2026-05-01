// PARSE-02 (props side) — <props> block parser scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 03. Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

describe('parseProps (PARSE-02)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
  });

  it.todo('Counter.rozie props parses { type: Number, default: 0, model: true } — identifier types via @babel/parser.parseExpression');
  it.todo('Counter.rozie props parses default: -Infinity unary expression');
  it.todo('Modal.rozie props parses multi-key object with mixed types and defaults');
  it.todo('TodoList.rozie props parses { type: Array, default: () => [] } — arrow-function default factory (PARSE-02 / D-03 — JSON5 cannot parse this)');
  it.todo('emits ROZ010 when <props> contains invalid JS expression');
  it.todo('emits ROZ011 when <props> top-level is not an object literal');
});
