// command-palette-per-level-virtual / portal-through-portal cluster — the
// `$attrs` auto-fallthrough getter's declared-prop skip-list (Phase 15 Bug A,
// emitLit.ts `declaredAttrSkipNames`) filters ONLY author-declared prop
// attribute names. It never excluded Rozie's OWN internal `data-rozie-ref`
// bookkeeping attribute.
//
// Real-world manifestation: a PARENT component places `ref="combobox"` on a
// `<Combobox>` child usage. The Lit emitter correctly stamps
// `data-rozie-ref="combobox"` on the LIGHT-DOM `<rozie-combobox>` host tag
// (for the PARENT's own `$refs.combobox` resolution) — but that is a plain
// HTML attribute on the host element, so the CHILD's own `$attrs` getter
// (which walks `this.attributes` and skips only its OWN declared props) scoops
// it up as an "unrecognized" attribute and re-broadcasts it via
// `${rozieSpread(this.$attrs)}` onto the CHILD's OWN template-root element —
// clobbering the child's OWN internal `data-rozie-ref="__rozieRoot"` marker
// (or any other ref living on that same root element) with the PARENT's
// value. Any of the child's OWN `$el`-driven `@query('[data-rozie-ref="..."]')`
// lookups (e.g. Combobox.rozie's `buildVirtualizer()` scroll-element capture)
// then silently resolve to `null` forever — no error, just dead internal refs.
//
// Fix: `data-rozie-ref` is a Rozie-RESERVED bookkeeping attribute name (used
// by the compiler itself for ref/portal-marker lowering) — it must NEVER be
// treated as a pass-through consumer attribute, regardless of whether the
// component declares any props. Both `$attrs` getter code-generation
// branches (the declared-props skip-list branch AND the zero-declared-props
// fast path) must exclude it unconditionally.
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitLit } from '../emitLit.js';

function compile(src: string): string {
  const result = parse(src, { filename: 'RefCollision.rozie' });
  if (!result.ast) {
    throw new Error(`parse() null AST: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() null IR');
  const ir: IRComponent = lowered.ir;
  const { code, diagnostics } = emitLit(ir, { filename: 'RefCollision.rozie', source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return code;
}

// Has a declared prop (`label`) AND uses `$el` in script (synthesizes the
// `__rozieRoot` ref on the template root + the auto-fallthrough spread on
// that same root) — exercises the `declaredAttrSkipNames.length > 0` branch.
const SRC_WITH_PROPS = `<rozie name="RefCollisionWithProps">
<props>
{
  label: { type: String, default: '' },
}
</props>
<script>
const grab = () => { const root = $el; return root; }
</script>
<template>
<div>{{ $props.label }}</div>
</template>
</rozie>
`;

// Zero declared props — exercises the "no declared props" fast-path branch.
const SRC_NO_PROPS = `<rozie name="RefCollisionNoProps">
<script>
const grab = () => { const root = $el; return root; }
</script>
<template>
<div>hi</div>
</template>
</rozie>
`;

describe('emitLit — $attrs fallthrough getter excludes the reserved data-rozie-ref attribute', () => {
  it('(declared-props branch) skip-list includes data-rozie-ref so a parent-assigned ref= never clobbers the component\'s own internal ref markers', () => {
    const code = compile(SRC_WITH_PROPS);
    expect(code).toMatch(/private get \$attrs\(\)/);
    const getterMatch = code.match(/private get \$attrs\(\)[\s\S]*?\n {2}\}/);
    expect(getterMatch, 'expected to find the $attrs getter body').not.toBeNull();
    const getterBody = getterMatch![0];
    expect(getterBody).toContain("'data-rozie-ref'");
  });

  it('(zero-declared-props fast path) skip-list still excludes data-rozie-ref', () => {
    const code = compile(SRC_NO_PROPS);
    expect(code).toMatch(/private get \$attrs\(\)/);
    const getterMatch = code.match(/private get \$attrs\(\)[\s\S]*?\n {2}\}/);
    expect(getterMatch, 'expected to find the $attrs getter body').not.toBeNull();
    const getterBody = getterMatch![0];
    // The pre-fix fast path unconditionally forwarded EVERY host attribute
    // (`for (const a of Array.from(this.attributes)) out[a.name] = a.value;`)
    // with no skip check at all — assert a skip guard now exists.
    expect(getterBody).toContain("'data-rozie-ref'");
  });
});
