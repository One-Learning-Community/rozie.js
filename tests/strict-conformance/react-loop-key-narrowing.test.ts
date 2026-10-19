/**
 * REACT-LOOP-KEY-NARROWING (quick 261019-9g1, add-on A) — a keyed multi-root
 * r-for whose `:key` re-tests the discriminant that its r-if children narrow must
 * typecheck under strict tsc on react, solid and lit.
 *
 * Pre-fix, React alone repeated the key expression on each narrowed r-if branch
 * element (`item !== 'gap' && <span key={item === 'gap' ? … : item}>`), where
 * `item` is already narrowed to `number`: TS2367 "no overlap". The key now rides
 * only on the enclosing `<Fragment key>`.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const SRC = `<rozie name="LoopKeyNarrow">
<script lang="ts">
type Cell = number | 'gap'
const cells = (): Cell[] => [1, 'gap', 2]
</script>
<template>
<div>
  <template r-for="item, index in cells()" :key="item === 'gap' ? 'gap-' + index : item">
    <i r-if="item === 'gap'">gap</i>
    <span r-if="item !== 'gap'">{{ item }}</span>
  </template>
</div>
</template>
</rozie>`;

const CASES = [
  { target: 'react' as const, file: 'LoopKeyNarrow.tsx', nm: 'packages/ui/pagination/packages/react' },
  { target: 'solid' as const, file: 'LoopKeyNarrow.tsx', nm: 'packages/ui/pagination/packages/solid' },
  { target: 'lit' as const, file: 'LoopKeyNarrow.ts', nm: 'packages/ui/pagination/packages/lit' },
];

describe('REACT-LOOP-KEY-NARROWING — a key that re-tests the narrowed discriminant typechecks', () => {
  for (const c of CASES) {
    it(`${c.target}: strict tsc is clean`, () => {
      const r = compile(SRC, { target: c.target, filename: 'LoopKeyNarrow.rozie', sourceMap: false });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const { raw, inventory } = typecheckCompiled({
        target: c.target,
        files: { [c.file]: r.code },
        nodeModulesFrom: c.nm,
      });
      expect(totalErrors(inventory), raw).toBe(0);
    });
  }
});
