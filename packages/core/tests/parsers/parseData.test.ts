// PARSE-02 (data side) — <data> block parser scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 03. Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

describe('parseData (PARSE-02)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
  });

  it.todo('Counter.rozie data parses { hovering: false } — same parseExpression path as props');
  it.todo('SearchInput.rozie data parses computed-value object');
  it.todo('emits ROZ010 when <data> contains invalid JS expression');
});
