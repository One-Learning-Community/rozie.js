/**
 * SOLID-LOOP-ALIAS-NARROWING (EB-2, quick 261019-9g1) — a union r-for alias
 * (`number | 'gap'`) narrowed by an r-if and fed to a `:param-types` slot param
 * typed `number` must typecheck under strict tsc on solid, react and lit.
 *
 * Pre-fix, Solid alone failed with TS2322 at the slot getter: `<Show when>` is
 * not a type guard, so the item stayed `number | 'gap'` inside the branch.
 * The emitter now lowers a chain whose tests read a raw keyless-For alias to a
 * fragment-wrapped JSX conditional (see emitConditional.ts), which TypeScript
 * narrows.
 *
 * Shapes: (i) a plain `!==` r-if, (ii) an alias-plus-signal test, (iii) an
 * `===` r-if with an r-else whose body wraps the typed slot.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const SRC = `<rozie name="LoopAliasNarrow">
<props>
{
  show: { type: Boolean, default: true },
}
</props>
<script lang="ts">
type Cell = number | 'gap'
const cells = (): Cell[] => [1, 'gap', 2]
</script>
<template>
<div>
  <template r-for="item, index in cells()" :key="index">
    <span r-if="item !== 'gap'">
      <slot name="cell" :value="item" :param-types="{ value: 'number' }"></slot>
    </span>
    <span r-if="item !== 'gap' && $props.show">
      <slot name="cellShown" :value="item" :param-types="{ value: 'number' }"></slot>
    </span>
    <i r-if="item === 'gap'">gap</i>
    <span r-else>
      <slot name="cellElse" :value="item" :param-types="{ value: 'number' }"></slot>
    </span>
  </template>
</div>
</template>
</rozie>`;

const CASES = [
  { target: 'solid' as const, file: 'LoopAliasNarrow.tsx', nm: 'packages/ui/pagination/packages/solid' },
  { target: 'react' as const, file: 'LoopAliasNarrow.tsx', nm: 'packages/ui/pagination/packages/react' },
  { target: 'lit' as const, file: 'LoopAliasNarrow.ts', nm: 'packages/ui/pagination/packages/lit' },
];

describe('SOLID-LOOP-ALIAS-NARROWING — a narrowed union r-for alias feeds a number-typed slot param', () => {
  for (const c of CASES) {
    it(`${c.target}: strict tsc is clean`, () => {
      const r = compile(SRC, { target: c.target, filename: 'LoopAliasNarrow.rozie', sourceMap: false });
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
