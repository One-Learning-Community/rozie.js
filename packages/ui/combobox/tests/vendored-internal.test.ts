/**
 * vendored-internal.test.ts — `src/internal/groupOptions.ts` is a byte copy of
 * the canonical `@rozie-ui/headless-core/src/internal/groupOptions.ts`.
 *
 * The guard lives in THIS package on purpose: an edit to this family's copy
 * changes this package's test-task hash, so a cached turbo run cannot replay a
 * stale pass. An edit to the canonical file reaches this task through the
 * `@rozie-ui/headless-core` devDependency.
 */
import { readFileSync } from 'node:fs';
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
