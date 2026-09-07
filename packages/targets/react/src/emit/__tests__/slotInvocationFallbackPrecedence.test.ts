/**
 * slotInvocationFallbackPrecedence.test.ts — Phase 88 Plan 01 (React target,
 * D-06/D-08).
 *
 * `renderInvocationFallback` (`emitSlotInvocation.ts:202-230`) strips the
 * outer `{...}` off a single fallback child so the result is usable as a
 * bare JS expression, then 4 call sites (`:249`, `:254`, `:332`, `:354`)
 * interpolate that text as the right operand of a `??`: `` `(${fieldRef} ??
 * ${invocationFallback})` ``. When the stripped child's OWN emission is
 * itself a bare ternary or `??`/`&&` chain — true for a nested
 * `TemplateSlotInvocation` or a `TemplateInterpolation` whose expression is
 * a ternary — `??` (spec precedence tier 6) binds tighter than `?:` (tier
 * 5), so `A ?? cond ? x : y` parses as `(A ?? cond) ? x : y` instead of the
 * intended `A ?? (cond ? x : y)`. An off-type non-function `slots` record
 * entry with no generic fill then throws `TypeError` (calling `undefined`
 * as a function) or silently renders the generic fallback instead of the
 * passed node — see `slot-family-fallback-precedence.test.tsx` for the
 * mounted behavioral proof of this exact failure mode.
 *
 * POSITIVE reproduces the precise three-tier shape all 12 data-table sites
 * (Phase 88 CONTEXT.md) will adopt: a dynamic-name (family) slot with
 * scoped params, whose inline fallback is a nested STATIC named-slot
 * invocation (`#cell`), whose OWN inline fallback is a bare `{{ }}`
 * interpolation. Per Phase 79 D-09, the outer slot's bound name
 * (`` `cell-${col.key}` ``) does not constant-fold, so `SlotDecl.name` stays
 * the `''` default-slot sentinel and `node.dynamicNameExpr` carries the
 * runtime key — this routes emission through the "Default with params,
 * hasInvocationFallback" branch at `:354`, the exact seam this phase's 12
 * sites hit.
 *
 * CONTROL_JSX and CONTROL_TEXT pin that a JSX-element fallback and a bare-
 * text fallback are BYTE-IDENTICAL before and after the fix — D-06
 * explicitly rejects unconditional parens on every `renderInvocationFallback`
 * return because that would drift every inline `<slot>` fallback in the
 * corpus (RESEARCH.md's blast-radius grep across 16 `tests/dist-parity`
 * fixtures found zero fixtures combining a dynamic/family slot, params, and
 * a nested-slot-invocation fallback — this file's POSITIVE case is the
 * first in the corpus to exercise that combination).
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../../emitReact.js';

function lower(src: string) {
  const result = parse(src, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error(`parse failed: ${JSON.stringify(result.diagnostics)}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  return lowered.ir;
}

function emit(src: string): { code: string } {
  const ir = lower(src);
  const result = emitReact(ir);
  return { code: result.code };
}

// POSITIVE — the three-tier shape: family slot (params-bearing, dynamic
// name) -> nested generic named slot (`#cell`, also params-bearing) ->
// bare interpolation. Matches the DataTable.rozie restructure shape
// (RESEARCH.md § "The 12 Slot Sites") minus the surrounding chrome.
const POSITIVE_SRC = `<rozie name="SlotFamilyFallbackPrecedenceProbe">
<props>
{
  columns: { type: Array, default: () => [] },
}
</props>
<template>
<div r-for="col in $props.columns" :key="col.key">
  <slot :name="\`cell-\${col.key}\`" :value="col.value">
    <slot name="cell" :value="col.value">{{ col.value }}</slot>
  </slot>
</div>
</template>
</rozie>`;

// CONTROL_JSX — same family-slot shape, but the fallback is a plain JSX
// element (`emitElement`), which starts with `<` and can never itself
// contain a top-level `??`/`?:` outside its own `{}` expression slots.
const CONTROL_JSX_SRC = `<rozie name="SlotFamilyFallbackControlJsxProbe">
<props>
{
  columns: { type: Array, default: () => [] },
}
</props>
<template>
<div r-for="col in $props.columns" :key="col.key">
  <slot :name="\`cell-\${col.key}\`" :value="col.value"><span>{{ col.value }}</span></slot>
</div>
</template>
</rozie>`;

// CONTROL_TEXT — same family-slot shape, but the fallback is bare static
// text, which `renderInvocationFallback` already wraps via `JSON.stringify`
// before it ever reaches the `??`/`?:` hazard.
const CONTROL_TEXT_SRC = `<rozie name="SlotFamilyFallbackControlTextProbe">
<props>
{
  columns: { type: Array, default: () => [] },
}
</props>
<template>
<div r-for="col in $props.columns" :key="col.key">
  <slot :name="\`cell-\${col.key}\`" :value="col.value">fallback text</slot>
</div>
</template>
</rozie>`;

describe('React renderInvocationFallback ?? / ?: precedence (Phase 88 D-06/D-08)', () => {
  it('POSITIVE — a params-bearing dynamic-name slot whose invocation fallback is a nested named-slot invocation parenthesizes the stripped ternary', () => {
    const { code } = emit(POSITIVE_SRC);

    // FIXED shape: the outer `??`'s right operand is the ENTIRE nested
    // ternary, wrapped in a fresh pair of parens (the pre-existing
    // fieldRef-merge parens around `(props.renderCell ?? props.slots?.['cell'])`
    // are a second, inner pair — "?? (" is immediately followed by the
    // NEW wrap's own "(").
    expect(code).toContain(
      "?? ((props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ value: col.value }) : (rozieDisplay(col.value))))",
    );

    // BROKEN shape (pre-fix): the SAME text but with only the single
    // pre-existing merge-paren after `??` — i.e., the nested ternary itself
    // unparenthesized. Must be absent post-fix.
    expect(code).not.toContain(
      "?? (props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ value: col.value }) : rozieDisplay(col.value))}",
    );

    // Defensive/literal acceptance-criteria check: no unparenthesized
    // `?? typeof ... ?` sequence anywhere in this expression (this shape
    // doesn't produce one — the nested child here is a NAMED slot, not a
    // dynamic one — but the invariant is asserted as a regression guard).
    expect(code).not.toMatch(/\?\?\s*typeof[^)]*\?/);
  });

  it('CONTROL A (JSX element fallback) — byte-identical, no added parens', () => {
    const { code } = emit(CONTROL_JSX_SRC);
    expect(code).toMatch(/\?\? <span data-rozie-s-[0-9a-f]+="">\{rozieDisplay\(col\.value\)\}<\/span>\)/);
    // No parenthesis is inserted before the JSX element.
    expect(code).not.toMatch(/\?\? \(<span/);
  });

  it('CONTROL B (bare text fallback) — byte-identical, no added parens', () => {
    const { code } = emit(CONTROL_TEXT_SRC);
    expect(code).toContain('?? "fallback text")');
    expect(code).not.toContain('?? ("fallback text")');
  });
});
