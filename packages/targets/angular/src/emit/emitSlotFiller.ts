/**
 * emitSlotFiller — Phase 07.2 Plan 03 Task 1 (Angular target).
 *
 * Consumer-side mirror of emitSlotInvocation (producer side). Where the
 * producer declares `<ng-container *ngTemplateOutlet="headerTpl; context: {...}" />`
 * and `@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<...>`,
 * the consumer emits a nested `<ng-template #header let-close="close">…</ng-template>`
 * inside the component tag. Angular's content-projection picks them up via
 * the matching `@ContentChild('<name>', { read: TemplateRef })`.
 *
 * Default-slot shorthand: the existing emitTemplateNode.ts L371-376 already
 * wraps loose children in `<ng-template #defaultSlot>…</ng-template>` for any
 * Rozie-component invocation (D-LIT-ANG-DEFAULT-SLOT). When slotFillers is
 * populated this module owns the synthesis instead, so the wrapper synthesis
 * happens HERE (and the dispatch in emitTemplateNode skips its default-slot
 * wrap path).
 *
 * Output shapes (per RESEARCH §"Pattern 3.f Angular"):
 *
 *   { name: 'header', params: [] }
 *     → `<ng-template #header>…body…</ng-template>`
 *
 *   { name: 'header', params: [{name:'close'}] }
 *     → `<ng-template #header let-close="close">…body…</ng-template>`
 *
 *   { name: '', params: [] }                              (default-shorthand)
 *     → `<ng-template #defaultSlot>…body…</ng-template>`
 *
 *   { name: '', params: [{name:'item'}] }                (scoped default)
 *     → `<ng-template #defaultSlot let-item="item">…body…</ng-template>`
 *
 *   { isDynamic: true, dynamicNameExpr } — R5 dynamic name
 *     → `<ng-template [rozieSlot]="<keyExpr>">…body…</ng-template>` — a
 *       self-declaring keyed marker (Phase 80 R4). The producer's per-instance
 *       `contentChildren(RozieSlot, { descendants: true })` content query
 *       collects it directly, so no consumer-side ViewChild/getter/binding
 *       plumbing is needed any more — see the history note below.
 *
 * Arrow-function-in-context caveat (Pitfall 4): when a fill body's event
 * handler contains arrow expressions, the same arrow-function-rejection
 * concern that motivates producer-side `buildSlotCtxHelper` (emitSlotInvocation.ts
 * L62-88, L191-232) applies INSIDE the fill body too — Angular's template
 * parser doesn't accept arrow expressions in template bindings. However, the
 * existing per-event emit path (emitTemplateNode.emitEvents) already converts
 * arrow handlers into class-body wrapper methods (`_merged_<event>_<N>`) via
 * emitTemplateEvent's guarded-handler machinery. That same machinery runs
 * inside the recursive emitChildren callback we pass in here, so fill-body
 * arrow expressions get hoisted to class fields naturally — no consumer-side-
 * specific helper synthesis needed for the static-name + default cases. The
 * dedicated `buildSlotCtxHelper` form lives on the producer side because
 * that's where the *args* of a `<slot :close="…">` declaration get hoisted;
 * consumer fill bodies don't carry slot-args (those are destructure params
 * the producer hands them).
 *
 * Phase 07.1 self-reference pattern: SlotFillerDecl + IRComponent + the IR
 * TemplateNode alias are imported via the `@rozie/core` package specifier,
 * NOT the deep ../../../core/src/ir/types.js relative path that would
 * reintroduce the cross-package `.d.ts` identity bug Phase 07.1 fixed.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  SlotFillerDecl,
  IRComponent,
  IRTemplateNode as TemplateNode,
} from '@rozie/core';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';
import { renderRecordKey } from './refineSlotTypes.js';

/**
 * Context shape this module needs. Mirrors the producer-side
 * EmitSlotInvocationCtx pattern — accept a recursive emitChildren callback so
 * we don't have to import emitNode here (which would create a static cycle
 * with emitTemplateNode that imports this module).
 */
export interface EmitSlotFillerCtx {
  ir: IRComponent;
  /** Recursive call back into emitNode for fill bodies. */
  emitChildren: (children: TemplateNode[]) => string;
}

/**
 * Reference-name for the `#tplRef` template variable.
 *   - '' (default) → 'defaultSlot' (matches D-LIT-ANG-DEFAULT-SLOT convention)
 *   - 'header'      → 'header'      (verbatim, mirrors emitSlotInvocation.ts L238)
 */
function templateRefName(slotName: string): string {
  return slotName === '' ? 'defaultSlot' : slotName;
}

/**
 * Build the `let-<localVar>="<slotKey>"` binding list for a scoped fill.
 * Returns leading-space-prefixed text suitable for direct concatenation
 * after the `#<refName>` token, or '' when there are no params.
 *
 * Rename support (quick 260526-ljo): when `bindAs` is set, the LHS uses the
 * local binding name (`let-column=...`) while the RHS still references the
 * producer's slot key (`...="item"`). Angular's `ngTemplateOutletContext`
 * dispatches by RHS (slot key), so this preserves producer-side contract.
 *
 *   - [{name:'item'}]                    → ' let-item="item"'
 *   - [{name:'item', bindAs:'column'}]   → ' let-column="item"'
 */
function letBindings(filler: SlotFillerDecl): string {
  if (filler.params.length === 0) return '';
  const parts = filler.params.map((p) => `let-${p.bindAs ?? p.name}="${p.name}"`);
  return ' ' + parts.join(' ');
}

/**
 * Format ONE static-named filler (or default-shorthand) as an Angular
 * `<ng-template #ref let-…>…</ng-template>` markup string suitable for
 * inclusion as a CHILD of the component tag.
 *
 * Dynamic-name / record-path branch (R5, R12, matchedFamily) — call
 * `emitDynamicSlotFiller` instead, which returns the keyed-marker shape
 * (Phase 80 R4); no companion class-field or producer-tag binding is
 * composed by the caller any more.
 */
export function emitSlotFiller(
  filler: SlotFillerDecl,
  ctx: EmitSlotFillerCtx,
): string {
  if (filler.isDynamic) {
    // Caller should route dynamic fillers through `emitDynamicSlotFiller`
    // instead — emitting empty here is the symmetric fallback when the
    // caller forgot to branch.
    return '';
  }

  // Phase 79 Plan 05 (R12/D-03) — a fill targeting a non-identifier,
  // non-default slot name (e.g. `#cell-status`) cannot use a plain
  // `<ng-template #cell-status>` + `@ContentChild('cell-status', ...)` pair —
  // a hyphenated template-reference variable does not resolve. The caller
  // should route it through `emitDynamicSlotFiller` instead (the SAME
  // `[templates]` getter path the R5 dynamic-name fills already use).
  // Emitting empty here is the symmetric fallback when the caller forgot to
  // branch.
  if (filler.name !== '' && !isSlotNameIdentifier(filler.name)) {
    return '';
  }

  // Phase 79 Plan 11 (R5/D-09) — a `matchedFamily` fill has no producer
  // `@ContentChild`-capturable slot either (its exact name never appeared as
  // a producer SlotDecl — it only matched a name-PREFIX family), so it must
  // ALSO be excluded here even when its name happens to be identifier-shaped
  // (e.g. a family fill named `cellStatus`), otherwise it would emit BOTH an
  // `<ng-template #cellStatus>` AND a `[templates]`-getter entry. Mirrors
  // React/Solid's 79-10 `matchedFamily` exclusion verbatim.
  if (filler.matchedFamily === true) {
    return '';
  }

  const refName = templateRefName(filler.name);
  const lets = letBindings(filler);
  const body = ctx.emitChildren(filler.body);

  return `<ng-template #${refName}${lets}>${body}</ng-template>`;
}

/**
 * R5/R12/matchedFamily record-path filler emission (Phase 80 R4).
 *
 * Each record-path filler (dynamic-name `<template #[expr]>`, a non-identifier
 * static name like `#cell-status`, or a `matchedFamily` fill) emits a single
 * `<ng-template [rozieSlot]="<key>"${lets}>${body}</ng-template>` — a
 * self-declaring keyed marker directive. There is no companion class field,
 * getter, or producer-tag binding: the producer's own per-instance
 * `contentChildren(RozieSlot, { descendants: true })` content query
 * (`@rozie/runtime-angular`'s `RozieSlot`, Plan 01/04) collects the marker
 * directly out of the projected content, including from inside an `@if` or
 * `@for` embedded view — which a static `@ViewChild(..., { static: true })`
 * could never see, and which is the whole reason this shape replaces that
 * one (SPEC R4).
 *
 * The bound key is the TEMPLATE-scope rewritten expression for the dynamic
 * branch (Angular auto-resolves identifiers against the component instance
 * inside a template binding — a `this.`-prefixed expression there either
 * fails `strictTemplates` or silently resolves nothing), and the single-quoted
 * escaped literal (`renderRecordKey`, T-79-07) for the two static branches.
 *
 * History — this function's prior shape (pre-Phase-80) captured each fill
 * behind a synthetic `#__dynSlot_<N>` template-ref name plus a class-body
 * `@ViewChild(..., { static: true })` and a `templates` getter, bound onto
 * the producer tag as a `[templates]="templates"` property input. That
 * shape had two silent-wrong-render bugs the marker-directive shape fixes:
 * a static view query cannot see into an embedded view (`@if`/`@for`), and
 * the constant getter name meant two sibling producer tags on one consumer
 * shared a single map, silently dropping one producer's fills. (An even
 * earlier shape — Phase 07.3.2.1-01 — tried a projected
 * `<ng-container *ngTemplateOutlet="templates[<expr>]">` dispatcher, which
 * Angular silently dropped outright since the consumed component declared no
 * matching `<ng-content>`. Re-adding a projected-outlet dispatcher of any
 * kind here would reintroduce that same failure mode.)
 */
export interface AngularDynamicSlotFillerEmission {
  /** `<ng-template [rozieSlot]="<key>"…>body</ng-template>` markup (child of component tag) */
  template: string;
  /** The rewritten key expression (dynamic branch) or single-quoted escaped literal (static branches) — TEMPLATE-scope, the same value bound in `template`. Read by the duplicate-static-key check. */
  keyExpr: string;
  /** The fill's params (used to build let-bindings on the marker's context) */
  params: readonly { name: string }[];
}

export function emitDynamicSlotFiller(
  filler: SlotFillerDecl,
  ctx: EmitSlotFillerCtx,
): AngularDynamicSlotFillerEmission | null {
  if (filler.isDynamic) {
    if (!filler.dynamicNameExpr) return null; // ROZ946 already emitted upstream
    const lets = letBindings(filler);
    const body = ctx.emitChildren(filler.body);
    const keyExpr = rewriteTemplateExpression(filler.dynamicNameExpr, ctx.ir);
    const template = `<ng-template [rozieSlot]="${keyExpr}"${lets}>${body}</ng-template>`;
    return { template, keyExpr, params: filler.params };
  }
  // Phase 79 Plan 11 (R5/D-09) — a `matchedFamily` fill has a static,
  // IDENTIFIER-shaped name (its exact name never appeared as a producer
  // SlotDecl — it only matched a name-PREFIX family, 79-07), so it routes
  // through this SAME marker mechanism, keyed on its OWN name as a quoted
  // string literal (a compile-time-known key, not a rewritten runtime
  // expression — unlike the `isDynamic` branch above). Checked BEFORE the
  // non-identifier branch below so a family fill whose name happens to also
  // be non-identifier-shaped (e.g. the real fixture's `#cell-status`) still
  // keys correctly either way (both branches key on the escaped literal name
  // identically for a static name).
  if (filler.matchedFamily === true) {
    const lets = letBindings(filler);
    const body = ctx.emitChildren(filler.body);
    const literalKey = renderRecordKey(filler.name);
    const template = `<ng-template [rozieSlot]="${literalKey}"${lets}>${body}</ng-template>`;
    return { template, keyExpr: literalKey, params: filler.params };
  }
  // Phase 79 Plan 05 (R12/D-03) — a non-identifier STATIC slot name (e.g.
  // `#cell-status`): route through this SAME marker mechanism, keyed on the
  // escaped literal name rather than a computed expression.
  if (filler.name !== '' && !isSlotNameIdentifier(filler.name)) {
    const lets = letBindings(filler);
    const body = ctx.emitChildren(filler.body);
    const literalKey = renderRecordKey(filler.name);
    const template = `<ng-template [rozieSlot]="${literalKey}"${lets}>${body}</ng-template>`;
    return { template, keyExpr: literalKey, params: filler.params };
  }
  return null;
}
