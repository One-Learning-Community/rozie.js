// Quick task 260714-orv — duplicate between-imports comment bug.
//
// Root cause (confirmed by orchestrator): a comment sitting BETWEEN two
// adjacent top-level `import` statements in a `.rozie` <script> is attached
// by @babel/parser to BOTH neighbours as the SAME comment object
// (`imp1.trailingComments[0] === imp2.leadingComments[0]`).
// `@babel/generator` dedupes printed comments by object identity WITHIN a
// single `generate()` call. The four class-targets (react/solid/lit/angular)
// generate hoisted user imports ONE-AT-A-TIME
// (`userImportNodes.map(genCode).join('\n')`), so each import's `generate()`
// call gets its OWN dedup set → the shared comment prints TWICE. Vue/Svelte
// keep user imports in the residual body and share the same per-statement
// `genCode` join, hitting the identical hazard via
// `mirrorSpliceBoundaryComments`'s host-only-pair skip.
//
// This test is RED-FIRST: it must FAIL (count === 2) on all six targets
// before the emitter fix, and PASS (count === 1) after.
import { describe, expect, it } from 'vitest';
import { compile, type CompileTarget } from '../src/compile.js';

const TARGETS: CompileTarget[] = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

/** Count non-overlapping literal occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = 0;
  for (;;) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count += 1;
    idx += needle.length;
  }
  return count;
}

function compileFixture(target: CompileTarget, source: string) {
  const result = compile(source, { target, filename: 'DupImportComment.rozie' });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  return { result, errors };
}

describe('duplicate between-imports comment (quick 260714-orv)', () => {
  describe('a comment BETWEEN two adjacent top-level imports emits exactly once', () => {
    const BETWEEN_MARKER = 'BETWEEN_MARKER_ORV_260714';
    const source = `<rozie name="DupImportBetween">

<script>
import { aVal } from './a.js';
// ${BETWEEN_MARKER}
import { bVal } from './b.js';

const sum = $computed(() => aVal + bVal);
</script>

<template>
<div>{{ sum }}</div>
</template>

</rozie>
`;

    it.each(TARGETS)('%s emits the between-imports comment exactly once', (target) => {
      const { result, errors } = compileFixture(target, source);
      expect(errors).toEqual([]);
      expect(countOccurrences(result.code, BETWEEN_MARKER)).toBe(1);
    });
  });

  describe('a comment on the FIRST import only (no preceding import) still emits once', () => {
    const FIRST_MARKER = 'FIRST_MARKER_ORV_260714';
    const source = `<rozie name="FirstImportOnly">

<script>
// ${FIRST_MARKER}
import { aVal } from './a.js';
import { bVal } from './b.js';

const sum = $computed(() => aVal + bVal);
</script>

<template>
<div>{{ sum }}</div>
</template>

</rozie>
`;

    it.each(TARGETS)('%s emits the first-import-only comment exactly once (guards against over-stripping to zero)', (target) => {
      const { result, errors } = compileFixture(target, source);
      expect(errors).toEqual([]);
      expect(countOccurrences(result.code, FIRST_MARKER)).toBe(1);
    });
  });
});
