// Phase 80 Plan 03 (Task 2) — the guard against the whole fixture set
// silently routing down the wrong path. Calls `compileAngular` directly (a
// plain Node-level parse -> lowerToIR -> emitAngular pipeline, no Vite/AOT
// involved) and asserts on the raw emitted TEXT of each fixture. A fixture
// that silently compiled to the identifier-named static `@ContentChild`
// path would produce a green Task 3 test that proves nothing — this test
// is what makes that impossible.
//
// Ambient globals (`describe`, `it`, `expect`) per setup-vitest.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileAngular } from './compileAngular';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

const CONSUMER_FIXTURES = [
  'ConsumerTopLevel',
  'ConsumerInsideIf',
  'ConsumerInsideFor',
  'ConsumerSiblingProducers',
  'ConsumerEmptyKeyFill',
];

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.rozie`), 'utf8');
}

describe('fixtures.compile — every fixture routes down the record path', () => {
  it('ProducerRecordPath compiles and declares the templates signal input', () => {
    const src = readFixture('ProducerRecordPath');
    const code = compileAngular(src, 'ProducerRecordPath.rozie');
    expect(code).toContain('templates');
    expect(code).toMatch(/templates\s*=\s*input</);
  });

  it.each(CONSUMER_FIXTURES)('%s compiles and declares no ContentChild capture for the fill name', (name) => {
    const src = readFixture(name);
    const code = compileAngular(src, `${name}.rozie`);
    expect(code.length).toBeGreaterThan(0);
    expect(code).not.toContain('ContentChild');
  });
});
