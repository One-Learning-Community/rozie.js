// PARSE-01 — SFC block splitter scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 02. This file establishes the test shape and
// anchors snapshot paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const FIXTURES_DIR = resolve(__dirname, '../fixtures/blocks');

describe('splitBlocks (PARSE-01)', () => {
  it('test infrastructure is wired', () => {
    // Sanity check that fixtures and examples paths resolve.
    expect(EXAMPLES_DIR).toMatch(/examples$/);
    expect(FIXTURES_DIR).toMatch(/fixtures\/blocks$/);
  });

  it.todo('Counter.rozie splits into all 5 used blocks (props/data/script/template/style) with byte-accurate offsets');
  it.todo('SearchInput.rozie splits cleanly with rich modifier-bearing template');
  it.todo('Dropdown.rozie splits with <listeners> block AND :root style escape hatch');
  it.todo('TodoList.rozie splits — proves arrow-default props parsing');
  it.todo('Modal.rozie splits — proves multi-$onMount + .self modifier');
  it.todo('empty <props></props> round-trips with content === "" (Pitfall 1 edge case)');
  it.todo('emits ROZ001 diagnostic when <rozie> envelope is missing');
});
