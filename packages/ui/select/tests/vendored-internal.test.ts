/**
 * vendored-internal.test.ts — `src/internal/groupOptions.ts` is a byte copy of
 * the canonical `@rozie-ui/headless-core/src/internal/groupOptions.ts`.
 *
 * The guard lives in THIS package on purpose: an edit to this family's copy
 * changes this package's test-task hash, so a cached turbo run cannot replay a
 * stale pass. An edit to the canonical file reaches this task through the
 * `@rozie-ui/headless-core` devDependency.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const canonical = readFileSync(resolve(ROOT, '..', 'headless-core/src/internal/groupOptions.ts'), 'utf8');

describe('vendored internal helpers stay byte-identical to headless-core', () => {
  it('src/internal/groupOptions.ts', () => {
    const copy = readFileSync(resolve(ROOT, 'src/internal/groupOptions.ts'), 'utf8');
    expect(copy).toBe(canonical);
  });
});

/**
 * Every file in `src/internal/` is vendored verbatim into each of the six leaves by
 * codegen's `copyInternal`. A leaf whose copy differs (codegen not re-run after an
 * edit, a hand edit in a leaf, a file left behind or missing) fails here.
 */
describe('each leaf carries a byte copy of every src/internal helper', () => {
  const LEAVES = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
  const sources = readdirSync(resolve(ROOT, 'src/internal')).filter((f) => !f.endsWith('.test.ts')).sort();

  it('there is something to vendor', () => {
    expect(sources).toEqual(expect.arrayContaining(['groupOptions.ts', 'valueMatch.ts']));
  });

  for (const leaf of LEAVES) {
    it(`${leaf}: same files, same bytes`, () => {
      const dir = resolve(ROOT, 'packages', leaf, 'src/internal');
      expect(readdirSync(dir).sort()).toEqual(sources);
      for (const file of sources) {
        expect(readFileSync(resolve(dir, file), 'utf8'), `${leaf}/src/internal/${file}`).toBe(readFileSync(resolve(ROOT, 'src/internal', file), 'utf8'));
      }
    });
  }
});
