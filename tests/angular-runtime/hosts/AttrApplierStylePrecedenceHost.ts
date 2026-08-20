// Quick task 260819-sg9 (Tier 2) — R3(c) DI-identity + style-precedence
// machine proof. A hand-authored standalone component (no `.rozie`
// compilation involved) with an `[ngStyle]` binding for `color` AND an
// `afterRenderEffect` that feeds a CONFLICTING value for the SAME property
// through an applier built by `createRozieAttrApplier(inject(Renderer2))`.
// Mirrors the emitted shape exactly: both `inject()` calls (Renderer2
// implicitly via the applier factory call, ElementRef via viewChild is not
// needed here — the spread target is a template-ref query, matching the
// emitter's own `viewChild<ElementRef>('rozieSpread_<N>')` pattern) live in
// class-field initializer position, and the diff/merge logic runs through
// the REAL `@rozie/runtime-angular` package, not a hand-rolled stand-in —
// this is the standing regression guard for the caller-injects contract
// (Renderer2 crosses the package boundary as a VALUE, never resolved
// inside the runtime package itself).
import { Component, ElementRef, Renderer2, afterRenderEffect, inject, viewChild } from '@angular/core';
import { NgStyle } from '@angular/common';
import { createRozieAttrApplier } from '@rozie/runtime-angular';

@Component({
  selector: 'attr-applier-style-precedence-host',
  standalone: true,
  imports: [NgStyle],
  template: `<div [ngStyle]="{ color: 'red' }" #target></div>`,
})
export class AttrApplierStylePrecedenceHost {
  readonly target = viewChild<ElementRef>('target');
  private readonly applyAttrs = createRozieAttrApplier(inject(Renderer2));
  private readonly spreadEffect = afterRenderEffect(() => {
    const el = this.target()?.nativeElement;
    if (!el) return;
    this.applyAttrs(el, { style: 'color: blue' });
  });
}
