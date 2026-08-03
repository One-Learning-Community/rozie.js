/**
 * IN-03 (Quick 260803-ibt) — Lit `:class` bound to a null-defaulted prop
 * renders `class="null"` instead of dropping the attribute.
 *
 * `emitTemplate.ts`'s class-binding path (~:1413-1437) builds
 * `class="${staticPart}${(classExpr)}"` directly and never routes through
 * `emitAttribute` — so the `isNullablePropRead` gate added for seam 3 (Quick
 * 260802-v1v, `emitTemplate.ts:562`) never sees it. React (`className={null}`)
 * and Vue drop the attribute; lit-html stringifies `null` in a mixed/raw
 * attribute position. Fix: route the non-wrapped class value through the
 * SAME `isNullablePropRead` gate the generic attribute path uses.
 *
 * Adjacent-bug check (memory: `feedback_patch_adjacent_bugs`) — the `:style`
 * binding path was ALSO audited: it is NOT affected. `:style` (dynamic,
 * non-object-literal form) already routes through `rozieStyle`
 * (`packages/runtime/lit/src/rozieStyle.ts`), which explicitly returns Lit's
 * `nothing` sentinel for a `null`/`undefined` value — no adjacent hole there.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../../emitLit.js';
import { emitReact } from '../../../../react/src/emitReact.js';
import { emitVue } from '../../../../vue/src/emitVue.js';

const PROBE_SRC = `<rozie name="Probe">
<props>
{
  cls: { type: String, default: null },
}
</props>
<template>
<div :class="$props.cls">probe</div>
</template>
</rozie>`;

function compileLit(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitLit(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

function irFor(rozieSrc: string) {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return ir;
}

describe('Lit :class nullish-drop parity with React/Vue (Quick 260803-ibt IN-03)', () => {
  it('a null-defaulted prop bound to :class does NOT emit class="null" — the value is routed through rozieAttr so lit-html drops the attribute', () => {
    const code = compileLit(PROBE_SRC);
    expect(code).not.toContain('class="null"');
    expect(code).not.toContain('class="${(this.cls)}"');
    expect(code).toMatch(/class="\$\{\(rozieAttr\(this\.cls\)\)\}"/);
  });

  it('cross-target parity — React/Vue also drop the class attribute for a null-defaulted prop (control, unaffected by this seam)', () => {
    const ir = irFor(PROBE_SRC);
    const reactCode = emitReact(ir, { filename: 'Probe.rozie', source: PROBE_SRC }).code;
    // React: className={rozieAttr-equivalent} — a null className renders no attribute.
    // The React emitter already routes nullable prop reads through its own
    // seam-3 gate; assert it does NOT render the raw literal null->"null" lie.
    expect(reactCode).not.toContain('className="null"');

    const vueCode = emitVue(ir, { filename: 'Probe.rozie', source: PROBE_SRC }).code;
    expect(vueCode).not.toContain('class="null"');
  });
});
