// Phase 07.3 Plan 04 — Svelte target consumer-side two-way binding emit.
//
// Asserts that an AttributeBinding of `kind: 'twoWayBinding'` (the IR variant
// added in Plan 07.3-02 by the lowerer for `<Producer r-model:propName="expr"
// />`) is emitted by the Svelte target as Svelte 5's `bind:propName={<expr>}`
// (runes-mode `$bindable()`-aware two-way binding form).
//
// CONTEXT.md D-01 keystone: `<Modal r-model:open="$data.x">` → `<Modal
// bind:open={x}>`. The producer-side `$bindable(...)` machinery (TWO-WAY-02)
// is already in place for any `<props>` entry marked `model: true`; this plan
// only covers the *consumer-side* template emit.
//
// Regression guards:
//   - bare `r-model="$data.x"` on a form input must STAY as `bind:value={x}`
//     (TWO-WAY-02 producer-side machinery untouched — the existing
//     `attr.name === 'r-model'` branch handles it; see Test 9 in
//     emitTemplate.test.ts).
//   - the Wave 2 throw-stub MUST no longer fire when the IR carries a
//     `twoWayBinding` AttributeBinding.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitTemplate } from '../src/emit/emitTemplate.js';

const REGISTRY = createDefaultRegistry();

function lowerInline(src: string): IRComponent {
  const result = parse(src, { filename: 'inline.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: REGISTRY });
  if (!lowered.ir) {
    throw new Error(
      `lowerToIR() returned null IR: ${lowered.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return lowered.ir;
}

describe('Svelte target — consumer-side two-way binding emit (Phase 07.3-04)', () => {
  it('emits bind:open={x} for <Modal r-model:open="$data.x" />', () => {
    const src = `<rozie name="Consumer">

<components>
{
  Modal: './Modal.rozie',
}
</components>

<data>
{
  x: false
}
</data>

<template>
<Modal r-model:open="$data.x" />
</template>

</rozie>
`;
    const ir = lowerInline(src);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    // Expected Svelte 5 bind form: `bind:open={x}` (no quotes, no `on:`,
    // matches the runes-mode $bindable() producer-side machinery).
    expect(template).toContain('bind:open={x}');
    // Hard-negatives: must NOT emit Vue-style `:open=` (would be a syntax
    // error in Svelte 5) and must NOT degrade to a plain one-way `open={x}`
    // — both shapes would compile but silently break two-way semantics.
    expect(template).not.toMatch(/(?<!bind):open=/);
    expect(template).not.toMatch(/(?<!bind:)open=\{x\}/);
  });

  it('emits bind:value={count} when propName is a multi-character identifier', () => {
    const src = `<rozie name="Consumer">

<components>
{
  Counter: './Counter.rozie',
}
</components>

<data>
{
  count: 0
}
</data>

<template>
<Counter r-model:value="$data.count" />
</template>

</rozie>
`;
    const ir = lowerInline(src);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:value={count}');
  });

  it('re-exposed model prop → get/set bind firing on<key>change (Svelte model-change parity)', () => {
    // D-03 permissive LHS rule: consumer may pass $props.x through to a child
    // when its own <props> declares model: true — the "re-exposed model" shape
    // (KanbanColumn `cards`, WrapperModal `open`). Svelte's plain `bind:` alone
    // propagates the child's writeback to the `$bindable` prop but fires NO
    // `<key>-change` EVENT, so a parent consuming the model ONE-WAY (`:selected`
    // + `@selected-change`, the deep-chain-lvalue fallback forced by ROZ951)
    // would silently never receive the writeback (React/Vue DO deliver it via
    // onValueChange / defineModel). The Svelte emitter therefore emits the
    // Svelte 5.9 get/set function-binding form so the setter ALSO fires
    // `on<key>change` — restoring cross-target parity. The `onactivechange`
    // prop is declared + destructured by emitScript.
    const src = `<rozie name="Consumer">

<components>
{
  Tab: './Tab.rozie',
}
</components>

<props>
{
  active: { type: Boolean, model: true }
}
</props>

<template>
<Tab r-model:selected="$props.active" />
</template>

</rozie>
`;
    const ir = lowerInline(src);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    // Get/set function-binding form: getter returns the local model, setter
    // writes it back AND fires the synthesized change callback.
    expect(template).toContain(
      'bind:selected={() => active, (__rozieNext) => { active = __rozieNext; onactivechange?.(__rozieNext); }}',
    );
    // Must NOT degrade to the plain one-way/two-way form that drops the event.
    expect(template).not.toContain('bind:selected={active}>');
  });

  it('data-field two-way binding stays a plain bind: (no spurious change event)', () => {
    // Regression guard for the fix above: a `$data.*` lvalue (NOT a model prop)
    // must keep the plain `bind:` form — the get/set change-event wiring is
    // scoped to re-exposed MODEL props only.
    const src = `<rozie name="Consumer">

<components>
{
  Tab: './Tab.rozie',
}
</components>

<data>
{
  chosen: false
}
</data>

<template>
<Tab r-model:selected="$data.chosen" />
</template>

</rozie>
`;
    const ir = lowerInline(src);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:selected={chosen}');
    expect(template).not.toContain('__rozieNext');
  });

  it('does NOT change bare r-model="$data.x" on form input (TWO-WAY-02 regression guard)', () => {
    // The bare r-model form-input branch (attr.name === 'r-model', kind ===
    // 'binding') must continue to emit `bind:value={x}` — this plan only
    // adds the new `kind === 'twoWayBinding'` branch.
    const src = `<rozie name="Consumer">

<data>
{
  draft: ''
}
</data>

<template>
<input r-model="$data.draft" />
</template>

</rozie>
`;
    const ir = lowerInline(src);
    const { template, diagnostics } = emitTemplate(ir, REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:value={draft}');
  });

  it('Wave 2 throw-stub no longer fires for twoWayBinding AttributeBinding', () => {
    // Direct regression check: before Plan 07.3-04 the Svelte emitter threw
    // "Phase 07.3 Wave 3 Plan 07.3-04" from emitSingleAttr the moment a
    // twoWayBinding AttributeBinding reached it. After Plan 07.3-04 the call
    // returns a non-throwing string. The act of completing emitTemplate
    // without throwing is the assertion.
    const src = `<rozie name="Consumer">

<components>
{
  Modal: './Modal.rozie',
}
</components>

<data>
{
  open: false
}
</data>

<template>
<Modal r-model:open="$data.open" />
</template>

</rozie>
`;
    const ir = lowerInline(src);
    expect(() => emitTemplate(ir, REGISTRY)).not.toThrow();
  });
});
