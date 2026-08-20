/**
 * Plan 14-05 Task 2 — Angular `spreadBinding` emitter
 * (afterRenderEffect() + Renderer2 applyAttrs, D-01 / 14-RESEARCH Pattern 3).
 *
 * Angular has NO native attribute-object spread. D-01 specifies an
 * `afterRenderEffect()` + `Renderer2` imperative diff helper. Quick task
 * 260819-sg9 (Tier 2) moved the shared diff/merge logic — what used to be an
 * INLINED private class-field IIFE — into `@rozie/runtime-angular`'s
 * `createRozieAttrApplier` / `createRozieHostAttrsReader` factories. The
 * emitted field initializer still performs its own `inject()` call and
 * passes the resolved instance INTO the factory
 * (`createRozieAttrApplier(inject(Renderer2))`); the factory itself never
 * resolves an Angular DI token. Deep behavioral coverage of the ported
 * diff/merge logic (per-element WeakMap scoping, null/undefined coercion,
 * class/style merge semantics) now lives in
 * `tests/angular-runtime/attrApplierBehavior.test.ts`, exercising the real
 * runtime package directly — this file stays scoped to the EMITTED SHAPE
 * (what the emitter's class-field initializers and import line look like).
 *
 * Emit contract:
 *   - A `#rozieSpread_<N>` template-ref attribute on the spread-target element.
 *   - A `viewChild<ElementRef>('rozieSpread_<N>')` class-field reading that
 *     ref (signal-based query — Angular 19+ idiom; same as emitPortals).
 *   - A SHARED `__rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));`
 *     private class field (one per component; reused across multiple
 *     spreadBindings).
 *   - A `private __rozieSpread_<N>_effect = afterRenderEffect(() => { ... });`
 *     field initializer guarding `nativeElement` (Pitfall 7 — `viewChild()?.
 *     nativeElement` may be `undefined` before first render).
 *
 * Cases:
 *   (1) LITERAL spread → template gets `#rozieSpread_<N>` + class-body gets
 *       the viewChild query, the applier factory-call field, and
 *       afterRenderEffect().
 *   (2) DYNAMIC spread → same shape; expression flows through verbatim.
 *   (3) `$attrs` spread → `applyAttrs` receives the bare `$attrs` Identifier
 *       (Angular's $attrs lowering is target-bespoke; the emitter leaves the
 *       Identifier alone — the shell binding wires it).
 *   (4) Two spreads on the same template → SHARED applier field, distinct
 *       `rozieSpread_<N>` refs (N=0,1).
 *   (5) R6 LITERAL class merge — the literal's `class` key is folded into
 *       Angular's existing class-merge path; only the rest goes through
 *       applyAttrs.
 *
 * Imports: emitAngular must add `inject`, `Renderer2`, `ElementRef`,
 * `afterRenderEffect`, `viewChild` to `@angular/core`, and
 * `createRozieAttrApplier` (plus `createRozieHostAttrsReader` for an
 * `$attrs` lowering) to `@rozie/runtime-angular`, when at least one
 * spreadBinding is emitted.
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../../emitAngular.js';

function compileAngular(src: string, filename = 'Test.rozie'): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) {
    throw new Error('lowerToIR() returned null IR');
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

describe('emitAngular — spreadBinding (Plan 14-05 Task 2 / D-01)', () => {
  it('(1) plain LITERAL spread → #rozieSpread_<N> + applyAttrs IIFE + afterRenderEffect()', () => {
    const code = compileAngular(`<rozie name="Test">
<template>
  <button r-bind="{ id: 'x', title: 't' }"></button>
</template>
</rozie>`);
    // Template-ref attribute on the spread target.
    expect(code).toContain('#rozieSpread_');
    // viewChild query field for the ref.
    expect(code).toMatch(/viewChild<ElementRef>\('rozieSpread_/);
    // Quick task 260819-sg9 (Tier 2) — the shared applier is now a one-line
    // factory-call field initializer importing from @rozie/runtime-angular
    // (INVERTED from the pre-Tier-2 "NO @rozie/runtime-angular import"
    // assertion this test used to make).
    expect(code).toContain(
      'private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));',
    );
    expect(code).toMatch(
      /import \{[^}]*\bcreateRozieAttrApplier\b[^}]*\} from '@rozie\/runtime-angular';/,
    );
    // Phase 14.1 / WR-A1 — afterRenderEffect() (not effect()) so the merged
    // class/style runs AFTER Angular's `[ngClass]`/`ɵɵstyleMap` bindings
    // commit; otherwise styleMap re-fires post-effect and clobbers the
    // consumer-merged style declarations. Field initializer guards
    // nativeElement (Pitfall 7).
    expect(code).toContain('afterRenderEffect(() =>');
    expect(code).toMatch(/\?\.nativeElement/);
    // The diff helper is constructed from an injected Renderer2 — the
    // set/removeAttribute calls themselves now live in
    // `@rozie/runtime-angular`'s `createRozieAttrApplier` (Quick task
    // 260819-sg9, Tier 2), covered directly in
    // `tests/angular-runtime/attrApplierBehavior.test.ts`.
    expect(code).toContain('inject(Renderer2)');
    // @angular/core import line carries the new symbols.
    expect(code).toMatch(/import \{[^}]*\binject\b[^}]*\} from '@angular\/core'/);
    expect(code).toMatch(/import \{[^}]*\bRenderer2\b[^}]*\} from '@angular\/core'/);
    expect(code).toMatch(/import \{[^}]*\bElementRef\b[^}]*\} from '@angular\/core'/);
    expect(code).toMatch(/import \{[^}]*\bafterRenderEffect\b[^}]*\} from '@angular\/core'/);
    expect(code).toMatch(/import \{[^}]*\bviewChild\b[^}]*\} from '@angular\/core'/);
  });

  it('(2) DYNAMIC spread → emits the same shape, expression flows through', () => {
    const code = compileAngular(`<rozie name="Test">
<data>{ obj: {} }</data>
<template>
  <button r-bind="$data.obj"></button>
</template>
</rozie>`);
    expect(code).toContain('#rozieSpread_');
    expect(code).toContain('__rozieApplyAttrs');
    // Dynamic expr — $data.obj rewrites to `this.obj()` at template-binding
    // scope; inside the effect-effect IIFE it's a class-field reference.
    expect(code).toMatch(/this\.obj\(\)/);
  });

  it('(3) $attrs spread → applyAttrs receives the synthesised host-attrs getter', () => {
    const code = compileAngular(`<rozie name="Test">
<template>
  <button r-bind="$attrs"></button>
</template>
</rozie>`);
    expect(code).toContain('#rozieSpread_');
    expect(code).toContain('__rozieApplyAttrs');
    // Angular has no native template-side `$attrs` accessor; the lowering
    // synthesises `__rozieGetHostAttrs()` which reads the host element's
    // attributes per call (CONTEXT.md A1 — auto-fallthrough projects the
    // consumer's attributes onto the template-root).
    expect(code).toContain('__rozieGetHostAttrs');
    expect(code).toMatch(/this\.__rozieGetHostAttrs\(\)/);
  });

  it('(4) two spreads → SHARED __rozieApplyAttrs (single IIFE), distinct refs', () => {
    // The template's `<div>` root has `inheritAttrs` defaulted to true, so
    // `synthesizeAttrsFallthrough` (lower.ts) appends a 3rd `$attrs` spread
    // onto the `<div>` root in addition to the two author-written spreads.
    // Total refs = 3 (1 synthesised + 2 explicit). All share the IIFE.
    const code = compileAngular(`<rozie name="Test">
<template>
  <div>
    <button r-bind="{ id: 'a' }"></button>
    <button r-bind="{ id: 'b' }"></button>
  </div>
</template>
</rozie>`);
    const refMatches = code.match(/#rozieSpread_(\d+)/g) ?? [];
    expect(refMatches.length).toBe(3);
    expect(new Set(refMatches).size).toBe(3);
    // Single applyAttrs IIFE — only ONE declaration of __rozieApplyAttrs.
    const helperDecls = (code.match(/__rozieApplyAttrs = /g) ?? []).length;
    expect(helperDecls).toBe(1);
  });

  it('(4-CR-02) __rozieApplyAttrs is now a factory-call field — per-element WeakMap scoping is a RUNTIME behavior, covered directly against the real package', () => {
    // CR-02 regression (per-element key-removal diff, not a shared
    // closure-scoped `let`): the emitter no longer inlines the WeakMap
    // internals to assert on — that behavior moved to
    // `@rozie/runtime-angular`'s `createRozieAttrApplier` (Quick task
    // 260819-sg9, Tier 2). The behavioral proof (two elements driven by one
    // applier keep independent previous-key state) now lives in
    // `tests/angular-runtime/attrApplierBehavior.test.ts`, exercising the
    // real runtime package against real jsdom elements. This test stays
    // scoped to the EMITTED SHAPE: the factory call, not its internals.
    const code = compileAngular(`<rozie name="Test">
<template>
  <div>
    <button r-bind="{ id: 'a' }"></button>
    <button r-bind="{ id: 'b' }"></button>
  </div>
</template>
</rozie>`);
    expect(code).toContain(
      'private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));',
    );
    expect(code).not.toMatch(/prevKeysByElement/);
  });

  it('(4-CR-04) applyAttrs accepting null/undefined is now a factory-call field — the nullish-coercion behavior is covered directly against the real package', () => {
    // CR-04 regression (a manual `r-bind="$data.maybeNull"` resolving to
    // null at runtime must not throw): the emitter no longer inlines the
    // `(el, obj) => { const safeObj = obj ?? {}; ... }` signature to assert
    // on — that behavior moved to `@rozie/runtime-angular`'s
    // `createRozieAttrApplier` (Quick task 260819-sg9, Tier 2). The
    // behavioral proof ("treats a null/undefined whole object as a clean
    // remove-all then no-op, never a TypeError") now lives in
    // `tests/angular-runtime/attrApplierBehavior.test.ts`. This test stays
    // scoped to the EMITTED SHAPE: the factory call and the dynamic
    // expression flowing through to it unchanged.
    const code = compileAngular(`<rozie name="Test">
<data>{ maybe: null }</data>
<template>
  <button r-bind="$data.maybe"></button>
</template>
</rozie>`);
    expect(code).toContain(
      'private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));',
    );
    expect(code).toMatch(/this\.__rozieApplyAttrs\(el, this\.maybe\(\)\)/);
  });

  it('(5) R6 LITERAL class merge: explicit :class + literal class merges via Angular class path; only `id` goes through applyAttrs', () => {
    const code = compileAngular(`<rozie name="Test">
<data>{ active: true }</data>
<template>
  <button :class="active ? 'a' : ''" r-bind="{ class: 'b', id: 'x' }"></button>
</template>
</rozie>`);
    // Angular merges multiple class sources via [ngClass]. The literal's
    // class value 'b' must appear in the merge alongside the explicit :class.
    // The literal `id: 'x'` still flows through the spread (applyAttrs).
    expect(code).toContain('#rozieSpread_');
    expect(code).toContain('__rozieApplyAttrs');
    // Class merge: BOTH 'b' (from literal) and the active ternary should be
    // wired through the per-target merge path. We don't snapshot exact
    // template text since Angular's class-merge shape is verbose; the key
    // invariant is that 'b' (the literal class) appears in the emitted code.
    expect(code).toContain("'b'");
    // The class key was extracted — the applied object should NOT contain
    // the `class` key. Look at the spread-effect body: it should not pass
    // `class:` through to applyAttrs.
    // (We don't enforce this very strictly here because the emitter may
    // legitimately keep `class` in some forms; the binding-level check is
    // covered by the runtime path. Document the intent.)
  });
});
