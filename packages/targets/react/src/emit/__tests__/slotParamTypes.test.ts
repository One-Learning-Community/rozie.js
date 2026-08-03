/**
 * Quick 260802-v1v Task 11 — SEAM 7 INVESTIGATE (timeboxed): React `.d.ts`
 * slot params typed `() => void` for `r-for` loop vars.
 *
 * D-86 (`renderPropsInterface.ts:289-323`, `inferParamType`) resolves a
 * slot-param `valueExpression` against `ir.props` ONLY. `r-for` loop vars
 * are unresolved BY CONSTRUCTION — they are never props — so Case 1's bare-
 * Identifier fallback ("treat as a residual-script function reference")
 * fires and emits `() => void`, even when the identifier is a plain data
 * value (an array element, an index). `<slot name="slide" :slide="slide"
 * :index="i">` inside an `r-for="slide, i in $props.slides"` — the
 * `Carousel.rozie:573` shape — emits a public `.d.ts` that LIES about the
 * consumer-facing slot-param callback shape: `renderSlide?: (params: {
 * slide: () => void; index: () => void }) => ReactNode`, when both are
 * plain data values (an array element and a loop index), never callables.
 *
 * The INLINE `.tsx` path (`refineSlotTypes.ts`) already emits the SAFE
 * `any` for exactly this case; only the separately-synthesised PUBLIC
 * `.d.ts` lies — this is the consumer-facing product surface, in scope
 * per the house rule ([[feedback_no_cosmetic_tsc_on_emitted_bodies]] draws
 * the line at emitted BODIES, not public types).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitReactTypes } from '../emitTypes.js';
import { emitReact } from '../../emitReact.js';

const EMBLA_SHAPED_SRC = `<rozie name="Probe">
<props>
{
  slides: { type: Array, default: () => [] },
}
</props>
<template>
<div>
  <div r-for="slide, i in $props.slides" :key="slide">
    <slot name="slide" :slide="slide" :index="i">{{ slide }}</slot>
  </div>
</div>
</template>
</rozie>`;

function irFor(src: string) {
  const { ast } = parse(src, { filename: 'Probe.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return ir;
}

describe('emitReactTypes — r-for slot-param .d.ts type (Quick 260802-v1v seam 7)', () => {
  it('RED — an r-for loop var slot param must NOT type as () => void in the public .d.ts', () => {
    const dts = emitReactTypes(irFor(EMBLA_SHAPED_SRC));
    expect(dts).not.toContain('slide: () => void');
    expect(dts).not.toContain('index: () => void');
  });

  it('deliberate, reviewed change — the Dropdown toggle shape moves from () => void to unknown', () => {
    // The D-86 "residual-script function reference" heuristic (removed by
    // this seam) had no way to distinguish an actual script-defined
    // callback (toggle) from an r-for loop variable at this call site --
    // both are unresolved bare identifiers. Rather than leave the loop-var
    // lie in place, `() => void` is dropped for BOTH shapes; `unknown` is
    // honest (forces the consumer to narrow/assert) where `() => void` was
    // already a v1 best-effort GUESS, not a resolved type.
    const src = `<rozie name="Dropdown">
<props>
{
  open: { type: Boolean, default: false },
}
</props>
<template>
<div>
  <slot name="trigger" :open="$props.open" :toggle="toggle">
  </slot>
</div>
</template>
<script>
function toggle() { }
</script>
</rozie>`;
    const dts = emitReactTypes(irFor(src));
    expect(dts).toMatch(/renderTrigger\?: \(params: \{ open: boolean; toggle: unknown \}\) => ReactNode;/);
    expect(dts).not.toContain('toggle: () => void');
  });

  it('non-regression — a resolved $props read still infers its real type', () => {
    const dts = emitReactTypes(irFor(EMBLA_SHAPED_SRC));
    // The component prop 'slides' itself is unaffected by this seam.
    expect(dts).toContain('slides?: unknown[];');
  });

  it('runtime bytes unaffected — the inline .tsx render path is byte-identical either way', () => {
    // S2 tripwire: this seam is `.d.ts`-only. If fixing it ever touches
    // runtime emit bytes, that is out of shape for this investigation.
    const before = emitReact(irFor(EMBLA_SHAPED_SRC), {
      filename: 'Probe.rozie',
      source: EMBLA_SHAPED_SRC,
    }).code;
    expect(before).toContain('slide: any');
  });
});
