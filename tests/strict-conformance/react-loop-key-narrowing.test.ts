/**
 * REACT-LOOP-KEY-NARROWING (quick 261019-9g1, add-on A) — a keyed multi-root
 * r-for whose `:key` re-tests the discriminant that its r-if children narrow must
 * typecheck under strict tsc on react, solid and lit.
 *
 * Pre-fix, React alone repeated the key expression on each narrowed r-if branch
 * element (`item !== 'gap' && <span key={item === 'gap' ? … : item}>`), where
 * `item` is already narrowed to `number`: TS2367 "no overlap". The key now rides
 * only on the enclosing `<Fragment key>`.
 *
 * quick 261019-ti9 (RK-1) — the SINGLE-root shapes (the loop body is exactly one
 * r-if, one r-if / r-else chain, a hostless `<template r-match>` or a
 * host-element `<div r-match>`) repeated the key the same way (TS2367 x4 on
 * React). The array item (the keyed Fragment, or the r-match host) now carries the
 * key exactly once. Every key stays index-dependent so Solid keeps its `<For>`.
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

const SRC_SINGLE = `<rozie name="LoopKeySingle">
<script lang="ts">
type Cell = number | 'gap'
const cells = (): Cell[] => [1, 'gap', 2]
</script>
<template>
<div>
  <template r-for="item, index in cells()" :key="item === 'gap' ? 'gap-' + index : item"><span r-if="item !== 'gap'">{{ item }}</span></template>
  <template r-for="item, index in cells()" :key="item === 'gap' ? 'gap-' + index : item"><i r-if="item === 'gap'">gap</i><b r-else>{{ item }}</b></template>
  <template r-for="item, index in cells()" :key="item === 'gap' ? 'gap-' + index : item"><template r-match="item"><i r-case="'gap'">gap</i><b r-default>{{ item }}</b></template></template>
  <template r-for="item, index in cells()" :key="item === 'gap' ? 'gap-' + index : item"><div r-match="item"><i r-case="'gap'">gap</i><b r-default>{{ item }}</b></div></template>
</div>
</template>
</rozie>`;

const SOURCES = [
  { name: 'LoopKeyNarrow', src: SRC },
  { name: 'LoopKeySingle', src: SRC_SINGLE },
];

const CASES = [
  { target: 'react' as const, ext: 'tsx', nm: 'packages/ui/pagination/packages/react' },
  { target: 'solid' as const, ext: 'tsx', nm: 'packages/ui/pagination/packages/solid' },
  { target: 'lit' as const, ext: 'ts', nm: 'packages/ui/pagination/packages/lit' },
];

describe('REACT-LOOP-KEY-NARROWING — a key that re-tests the narrowed discriminant typechecks', () => {
  for (const source of SOURCES) {
    for (const c of CASES) {
      it(`${source.name} / ${c.target}: strict tsc is clean`, () => {
        const r = compile(source.src, { target: c.target, filename: `${source.name}.rozie`, sourceMap: false });
        expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        const { raw, inventory } = typecheckCompiled({
          target: c.target,
          files: { [`${source.name}.${c.ext}`]: r.code },
          nodeModulesFrom: c.nm,
        });
        expect(totalErrors(inventory), raw).toBe(0);
      });
    }
  }
});
