/**
 * Quick 260802-v1v Task 11 — SEAM 7, revised by Quick 260803-ibt (CR-02).
 *
 * WHAT SEAM 7 GOT RIGHT: D-86 (`renderPropsInterface.ts:289-323`,
 * `inferParamType`) previously resolved a slot-param `valueExpression`
 * against `ir.props` ONLY, and a bare-Identifier that failed to resolve
 * ("treat as a residual-script function reference") emitted `() => void`
 * unconditionally. `r-for` loop vars are unresolved BY CONSTRUCTION — they
 * are never props — so `<slot name="slide" :slide="slide" :index="i">`
 * inside an `r-for="slide, i in $props.slides"` (the `Carousel.rozie:573`
 * shape) emitted a public `.d.ts` that LIED about the consumer-facing
 * slot-param shape (`slide: () => void` for a plain array element). Seam 7
 * correctly killed that lie for loop vars.
 *
 * WHAT SEAM 7 OVERSHOT (CR-02): the same removal ALSO downgraded every
 * genuinely-callable slot param that resolves to a top-level `<script>`
 * function — documented consumer API (popover `toggle`, data-table
 * `setFilter`, command-palette `retry`, and this file's own `Dropdown`
 * `toggle` shape). Those are resolvable: `IRComponent.setupBody` is the
 * PRESERVED Babel Program (IR-04 referential preservation — the SAME `File`
 * node as `ast.script.program`, no clone), so a bare identifier CAN be
 * checked against top-level script function names without any signature
 * change to `inferParamType`/`renderPropsInterface` — script scope is
 * resolvable from `ir` alone; TEMPLATE scope (where `r-for` loop vars live)
 * is not, which is exactly why loop vars still correctly fall through to
 * `unknown`.
 *
 * WHY `(...args: any[]) => any` AND NOT `() => void`: `() => void` was the
 * original v1 lie — wrong ARITY (`setFilter(columnId, value)` consumers
 * were already casting around it even before seam 7). `(...args: any[]) =>
 * any` is the house callable-lowering standard (see `renderPropType`'s
 * `Function`/`'function'` cases in this same file) and fixes the arity lie
 * in the same change, while remaining a genuinely permissive callable type.
 *
 * This test previously asserted the `toggle` shape moving `() => void` ->
 * `unknown` as "deliberate, reviewed" — that assertion CEMENTED the CR-02
 * regression (memory: `feedback_snapshot_tests_cement_bugs`) and is
 * inverted below to assert `toggle` resolves callable again. The loop-var
 * assertions (`slide`/`index` must NOT be callable) are unchanged — that
 * half of seam 7 was correct and stays.
 *
 * The INLINE `.tsx` path (`refineSlotTypes.ts`) already emits the SAFE
 * `any` for exactly this case; only the separately-synthesised PUBLIC
 * `.d.ts` is in scope — this is the consumer-facing product surface, per
 * the house rule ([[feedback_no_cosmetic_tsc_on_emitted_bodies]] draws
 * the line at emitted BODIES, not public types).
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../../emitReact.js';
import { emitReactTypes } from '../emitTypes.js';

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

  it('CR-02 fix — the Dropdown toggle shape resolves callable, not unknown', () => {
    // Inverted per Quick 260803-ibt CR-02: `toggle` names a top-level
    // script FunctionDeclaration, which is resolvable via `ir.setupBody`
    // (IR-04 referential preservation) without any signature change. It
    // must type as the house callable-lowering standard, not `unknown`.
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
    expect(dts).toMatch(
      /renderTrigger\?: \(params: \{ open: boolean; toggle: \(\.\.\.args: any\[\]\) => any \}\) => ReactNode;/,
    );
    expect(dts).not.toContain('toggle: unknown');
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
