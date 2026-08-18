// Phase 80 (D-07b) — design-validation gate.
//
// A byte-shape-identical LOCAL copy of `@rozie/runtime-angular`'s
// `RozieSlot` directive (packages/runtime/angular/src/rozie-slot.directive.ts,
// SPEC R2's locked contract — verified line-for-line against the shipped
// file). This does NOT import the real `RozieSlot`, for a concrete,
// empirically-confirmed reason (Rule 3 — blocking tooling issue, not a
// design compromise):
//
// Importing `RozieSlot` via a relative path that escapes this package's
// directory tree (`../../../packages/runtime/angular/src/rozie-slot.directive`)
// reproducibly crashes with NG0203 ("inputFunction() can only be used
// within an injection context") the moment `RozieSlot` is instantiated
// inside an embedded view (`<ng-template rozieSlot="...">`) — even though
// this package's ngtsc Program is configured `compilationMode: "full"`
// (tsconfig.spec.json). Isolated by direct experiment: a directive with the
// EXACT SAME shape (selector, field names, `input.required()` +
// `inject(TemplateRef)`) works perfectly when it lives anywhere INSIDE this
// package's own directory tree, and fails ONLY when imported from outside
// it — regardless of file count, `@if`/`@for` nesting, or fallback-block
// structure (all independently ruled out by isolated minimal repros before
// landing on this fix). This strongly suggests the cross-package file gets
// compiled as partial-Ivy (matching `packages/runtime/angular`'s OWN
// `tsconfig.lib.json`, D-04's separate BUILD config) rather than under this
// package's `full` config — i.e. the exact "needs the Angular Linker"
// problem `vitest.config.ts`'s `server.deps.inline` comment already
// documents for the BUILT dist, just reached via a different path (source
// import instead of npm import).
//
// Task 1's job is proving the SIGNAL `contentChildren()` QUERY MECHANISM
// itself — not re-proving cross-package consumption, which is a genuinely
// different, already-flagged concern for whichever later plan (04/05/08)
// first mounts the POST-FIX emitted output (see vitest.config.ts's "KNOWN
// GAP" comment). A byte-identical local copy fully serves this task's
// actual purpose.
import { Directive, TemplateRef, inject, input } from '@angular/core';

@Directive({
  selector: 'ng-template[rozieSlot]',
  standalone: true,
})
export class RozieSlot {
  readonly rozieSlot = input.required<string>();
  readonly templateRef = inject(TemplateRef<unknown>);
}
