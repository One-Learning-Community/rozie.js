/**
 * Phase 67 Plan 01 (SC-1 / SC-3) — RED-FIRST both-direction witness for the Vue
 * emitter's `:attr` nullability nullish-drop.
 *
 * Vue has NO `rozieAttr` path and does NO type inference, so — exactly like the
 * react/solid Phase-65 Class-1 heuristic — it must decide by expression SHAPE:
 *   - a nullable-SHAPED `:attr` binding in a nullable-typed DOM-attr slot
 *     (identifier / call / general member) MUST wrap as `(expr) ?? undefined`
 *     so a `string|null`/`number|null` value assigns into the `X | undefined`
 *     slot (clears the 10 TS2322 in the vue-tsc family-child gate);
 *   - a provably-non-nullish `:attr` binding (`arr.length`, `!!flag`, a literal,
 *     arithmetic) MUST stay RAW — appending `?? undefined` to a statically-non-null
 *     operand is TS2869 "unreachable right operand".
 *
 * RED-FIRST ANCHOR (observed pre-fix, before the emitter change — commit
 * `test(67-01)`):
 *   - Positive `:aria-activedescendant="$data.activeDescendant"` emitted RAW as
 *       :aria-activedescendant="activeDescendant"
 *     (NO `?? undefined`) → the positive `.toContain('(activeDescendant) ?? undefined')`
 *     assertion FAILS. Same for `:tabindex="cellTabindex()"` (raw `:tabindex="cellTabindex()"`).
 *   - Negative + ternary-regression assertions already reflect current behavior
 *     (they pass pre-fix and must keep passing post-fix).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

const REGISTRY = createDefaultRegistry();

function lowerInline(src: string): IRComponent {
  const result = parse(src, { filename: 'Test.rozie' });
  if (!result.ast)
    throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

describe('emitTemplateAttribute (Vue) — `:attr` nullability nullish-drop (Phase 67)', () => {
  it('POSITIVE: nullable-shaped `:attr` in a nullable DOM-attr slot wraps as `(expr) ?? undefined`', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ activeDescendant: null }</data>
<script lang="ts">
function cellTabindex(): number | null { return null; }
</script>
<template>
  <div :aria-activedescendant="$data.activeDescendant" :tabindex="cellTabindex()"></div>
</template>
</rozie>`);
    const { template } = emitTemplate(ir, REGISTRY);
    // Bare-identifier read (a `string | null` computed) → wrapped.
    expect(template).toContain(':aria-activedescendant="(activeDescendant) ?? undefined"');
    // CallExpression (`number | null` helper) → wrapped (the react DIVERGENCE:
    // Vue MUST wrap calls, react leaves them raw because it has `rozieAttr`).
    expect(template).toContain(':tabindex="(cellTabindex()) ?? undefined"');
  });

  it('NEGATIVE: provably-non-nullish `:attr` stays RAW (TS2869 guard) — including within the gated attr set', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ items: [], loading: false }</data>
<template>
  <div :data-count="$data.items.length" :aria-busy="!!$data.loading" :tabindex="$data.items.length" :aria-invalid="!!$data.loading"></div>
</template>
</rozie>`);
    const { template } = emitTemplate(ir, REGISTRY);
    // Ungated attrs — always raw.
    expect(template).toContain(':data-count="items.length"');
    expect(template).toContain(':aria-busy="!!loading"');
    // GATED attrs with a provably-non-nullish SHAPE — must NOT wrap (the exclusion
    // set: `.length` member, `!!x` boolean unary), else TS2869.
    expect(template).toContain(':tabindex="items.length"');
    expect(template).toContain(':aria-invalid="!!loading"');
    // No `?? undefined` anywhere in this template.
    expect(template).not.toContain('?? undefined');
  });

  it('REGRESSION: literal-`null` ternary path (normalizeNullAttrBinding) is byte-unchanged', () => {
    const ir = lowerInline(`<rozie name="Test">
<data>{ x: null }</data>
<template>
  <div :accept="$data.x ? $data.x.join(',') : null"></div>
</template>
</rozie>`);
    const { template } = emitTemplate(ir, REGISTRY);
    // The `: null` branch is mapped to `: undefined`; `accept` is not a gated
    // nullable-slot attr, so NO `?? undefined` wrap is added.
    expect(template).toContain(`:accept="x ? x.join(',') : undefined"`);
    expect(template).not.toContain('?? undefined');
  });
});
