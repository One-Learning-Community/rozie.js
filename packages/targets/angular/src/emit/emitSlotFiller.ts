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
 *     → reserved for Wave 2 (consumer-dynamic-name fixture). The shape
 *       `<ng-container *ngTemplateOutlet="..." />` requires runtime template
 *       refs the consumer dispatches against — full implementation lands in
 *       Plan 07.2-05.
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
 * Build the `let-<param>="<param>"` binding list for a scoped fill.
 * Returns leading-space-prefixed text suitable for direct concatenation
 * after the `#<refName>` token, or '' when there are no params.
 */
function letBindings(filler: SlotFillerDecl): string {
  if (filler.params.length === 0) return '';
  const parts = filler.params.map((p) => `let-${p.name}="${p.name}"`);
  return ' ' + parts.join(' ');
}

/**
 * Format ONE static-named filler (or default-shorthand) as an Angular
 * `<ng-template #ref let-…>…</ng-template>` markup string suitable for
 * inclusion as a CHILD of the component tag.
 *
 * Dynamic-name branch (R5) — call `emitDynamicSlotFiller` instead, which
 * returns the multi-part shape (ng-template declaration + ng-container
 * dispatch + class-field declarations).
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

  const refName = templateRefName(filler.name);
  const lets = letBindings(filler);
  const body = ctx.emitChildren(filler.body);

  return `<ng-template #${refName}${lets}>${body}</ng-template>`;
}

/**
 * R5 dynamic-name dispatch tuple per D-04 Angular row.
 *
 * Each dynamic filler emits:
 *   - `template`: `<ng-template #__dynSlot_<N>${lets}>${body}</ng-template>`
 *     a synthetic-named `<ng-template>` declaration capturing the fill body
 *   - `dispatch`: `<ng-container *ngTemplateOutlet="templates['__dynSlot_<N>']${ctxAttr}; if templates['__dynSlot_<N>']"></ng-container>` ...
 *     actually we emit the simpler form using runtime expression as the
 *     lookup key and synthesise the templates map from a class-body field
 *
 * Implementation note: Angular's static content-projection (`@ContentChild`)
 * does not natively support a dynamic name. The standard idiom for dynamic
 * template selection is `[ngTemplateOutlet]="templates[expr]"` where
 * `templates` is a `Record<string, TemplateRef<unknown>>` view-children map.
 * We synthesise such a map in the consumer's class body, indexed by the
 * synthetic template-ref names. The producer-side acceptance of a `templates`
 * input prop is the documented Angular divergence (parallel to React/Svelte/
 * Solid render-prop divergence) that Plan 07.2-06 spells out in
 * docs/parity.md.
 *
 * Silent fallback on runtime miss (D-05): Angular's `*ngTemplateOutlet`
 * silently no-ops when its template ref is `undefined` (`templates[unknown]`
 * returns undefined). The producer's `*ngTemplateOutlet="namedTpl"` then
 * renders its declared defaultContent.
 *
 * The templates-map value type is `TemplateRef<unknown>`. The keys are the
 * synthetic `__dynSlot_<N>` names — at runtime, the dispatch reads
 * `templates[<rewrittenExpr>]`, which IS NOT the synthetic name. For Wave
 * 1, the dispatch wires `templates[<rewrittenExpr>]` directly — the producer
 * is expected to accept a `templates` input prop carrying the fill bindings.
 * The synthetic-name keys live in the consumer-side map for QueryList
 * population only; the actual runtime dispatch resolves via the consumer's
 * own `templates` object expression (built once in the consumer constructor
 * from the ViewChild refs). Plan 07.2-06 finalises the producer-side
 * acceptance via the same divergence note.
 */
export interface AngularDynamicSlotFillerEmission {
  /** `<ng-template #__dynSlot_<N>…>body</ng-template>` markup (child of component tag) */
  template: string;
  /** Synthetic template-ref name `__dynSlot_<N>` */
  refName: string;
  /** The rewritten dynamic-name expression (used by the dispatch's lookup) */
  keyExpr: string;
  /** The fill's params (used to build let-bindings on the dispatcher's context) */
  params: readonly { name: string }[];
}

export function emitDynamicSlotFiller(
  filler: SlotFillerDecl,
  ctx: EmitSlotFillerCtx,
  index: number,
): AngularDynamicSlotFillerEmission | null {
  if (!filler.isDynamic) return null;
  if (!filler.dynamicNameExpr) return null; // ROZ946 already emitted upstream
  const refName = `__dynSlot_${index}`;
  const lets = letBindings(filler);
  const body = ctx.emitChildren(filler.body);
  const template = `<ng-template #${refName}${lets}>${body}</ng-template>`;
  const keyExpr = rewriteTemplateExpression(filler.dynamicNameExpr, ctx.ir);
  return { template, refName, keyExpr, params: filler.params };
}
