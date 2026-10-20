/**
 * SOLID-STATE-NARROWING (SN-1, quick 261019-ti9) — an r-if that tests a nullable
 * component-level value (`$props`, a model prop, `$data`, `$computed`) and re-reads
 * it as a typed slot param, a typed call argument or a member access must
 * typecheck under strict tsc on solid, react and lit.
 *
 * Pre-fix, Solid alone failed (TS2531 / TS2532 / TS2345 / TS2322 / TS18047):
 * `<Show when>` is not a type guard, `$data` / `$computed` / model reads are
 * signal CALLS (TypeScript never narrows a call), and `local.x` property narrowing
 * does not survive the slot-param getter closure. The emitter now lowers a
 * gated branch to Show's function child, `<Show when={…}>{(_rozieWhen0) => …}</Show>`,
 * whose accessor is typed `NonNullable<…>` (see emitConditional.ts).
 *
 * Shapes: bare truthiness, `!!x`, `x != null`, `x !== null`, `x !== undefined`,
 * `null != x`, a nested r-if, a mustache `<slot r-if>` body and an r-else fallback.
 * Slot names deliberately differ from every prop name (ROZ127).
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const WITNESS = `<rozie name="StateNarrow">
<types>
export interface Item { name: string; child: Item | null }
</types>
<props>
{
  label: { type: String, default: null },
  count: { type: Number },
  value: { type: String, model: true },
}
</props>
<data>
{
  picked: null as Item | null,
  maybe: undefined as Item | undefined,
}
</data>
<script lang="ts">
const sel = $computed((): Item | null => $data.picked)
const fmt = (s: string): string => s.toUpperCase()
const dbl = (n: number): number => n * 2
</script>
<template>
<div>
  <span r-if="$props.label"><slot name="labelSlot" :value="$props.label" :param-types="{ value: 'string' }"></slot></span>
  <span r-if="$props.label">{{ fmt($props.label) }} {{ $props.label.length }}</span>
  <span r-if="!!$props.label">{{ fmt($props.label) }}</span>
  <span r-if="$data.picked"><slot name="item" :item="$data.picked" :param-types="{ item: 'Item' }"></slot>{{ $data.picked.name }}</span>
  <span r-if="sel">{{ sel.name }}</span>
  <span r-if="$props.value">{{ fmt($props.value) }}</span>
  <span r-if="$props.count != null">{{ dbl($props.count) }}</span>
  <span r-if="$data.picked !== null">{{ $data.picked.name }}</span>
  <span r-if="$data.maybe !== undefined">{{ $data.maybe.name }}</span>
  <span r-if="null != $data.picked">{{ $data.picked.name }}</span>
  <span r-if="$data.picked"><b r-if="$data.picked.child">{{ $data.picked.child.name }}</b></span>
  <slot r-if="$props.label" name="bare" :value="$props.label" :param-types="{ value: 'string' }" />
  <span r-if="$props.label">{{ fmt($props.label) }}</span>
  <span r-else>none</span>
</div>
</template>
</rozie>`;

/** A NULLABLE model prop (default: null) re-read as a typed call argument. */
const MODEL = `<rozie name="ModelNarrow">
<props>
{
  value: { type: String, default: null, model: true },
}
</props>
<script lang="ts">
const fmt = (s: string): string => s.toUpperCase()
</script>
<template>
<div>
  <span r-if="$props.value">{{ fmt($props.value) }}</span>
  <span r-if="$model.value != null">{{ fmt($model.value) }}</span>
</div>
</template>
</rozie>`;

const TARGETS = [
  { target: 'solid' as const, ext: 'tsx', nm: 'packages/ui/pagination/packages/solid' },
  { target: 'react' as const, ext: 'tsx', nm: 'packages/ui/pagination/packages/react' },
  { target: 'lit' as const, ext: 'ts', nm: 'packages/ui/pagination/packages/lit' },
];

const SOURCES = [
  { name: 'StateNarrow', src: WITNESS, targets: ['solid', 'react', 'lit'] },
  { name: 'ModelNarrow', src: MODEL, targets: ['solid', 'react'] },
];

describe('SOLID-STATE-NARROWING — a narrowed nullable component value feeds typed positions', () => {
  for (const s of SOURCES) {
    for (const c of TARGETS) {
      if (!s.targets.includes(c.target)) continue;
      it(`${s.name} / ${c.target}: strict tsc is clean`, () => {
        const r = compile(s.src, { target: c.target, filename: `${s.name}.rozie`, sourceMap: false });
        expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        const { raw, inventory } = typecheckCompiled({
          target: c.target,
          files: { [`${s.name}.${c.ext}`]: r.code },
          nodeModulesFrom: c.nm,
        });
        expect(totalErrors(inventory), raw).toBe(0);
      });
    }
  }
});
