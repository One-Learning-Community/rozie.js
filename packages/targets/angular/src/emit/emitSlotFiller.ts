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
 *     → `<ng-template #__dynSlot_<N>>…body…</ng-template>` PLUS a
 *       `[templates]="templates"` property-input binding on the producer tag
 *       (composed in `emitTemplateNode.ts`). The consumer-side class getter
 *       `templates` maps the user's runtime-key expression to each captured
 *       `__dynSlot_<N>` ViewChild; the producer's `templates()` input signal
 *       (Plan 07.3.2-03) consumes that map at runtime. F-07.3.2-11-A closure
 *       — see Phase 07.3.2.1 Plan 01 SUMMARY.
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
 * Dynamic-name branch (R5) — call `emitDynamicSlotFiller` instead, which
 * returns the multi-part shape (ng-template declaration + class-field
 * declarations); the producer-tag `[templates]="templates"` property-input
 * binding is composed by the caller in `emitTemplateNode.ts` (F-07.3.2-11-A).
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
 *     a synthetic-named `<ng-template>` declaration capturing the fill body.
 *     The CALLER (emitTemplateNode) is responsible for:
 *       (a) appending `[templates]="<getterName>"` as a property input on the
 *           producer tag, where <getterName> is the deterministic class-body
 *           getter that maps user-runtime-key-exprs to captured refs;
 *       (b) registering the @ViewChild capture + getter via scriptInjections.
 *
 * Implementation note: Angular's static content-projection (`@ContentChild`)
 * does not natively support a dynamic name. The producer-side acceptance of
 * a `templates` input signal (Phase 07.3.2 Plan 03) is the documented Angular
 * divergence — the consumer wires its dynamic-name fills as a property-INPUT
 * map rather than as projected `<ng-content>` children. The producer's
 * merged guard `@if ((headerTpl ?? templates()?.['header']))` (Phase 07.3.2
 * Plan 10) then resolves the runtime dispatch.
 *
 * Silent fallback on runtime miss (D-05): when `templates()?.[expr]` returns
 * `undefined`, the merged @if short-circuits to the bare-static template
 * ref (if any) or the producer's declared default content.
 *
 * History — Phase 07.3.2.1-01 (closes F-07.3.2-11-A): prior to this phase
 * `emitDynamicSlotFiller` was paired with a sibling `dispatch` string of
 * shape `<ng-container *ngTemplateOutlet="templates[<expr>]">` emitted as
 * a projected child of the producer tag. That shape was silently dropped
 * by Angular (no `<ng-content>` slot in the consumed component's view),
 * so the dynamic-name fill never rendered. The property-input contract
 * documented above replaces it; the broken projection emission has been
 * deleted from `emitTemplateNode.ts` (the previous `dispatchParts.push`
 * call site).
 */
export interface AngularDynamicSlotFillerEmission {
  /** `<ng-template #__dynSlot_<N>…>body</ng-template>` markup (child of component tag) */
  template: string;
  /** Synthetic template-ref name `__dynSlot_<N>` */
  refName: string;
  /** The rewritten dynamic-name expression — TEMPLATE context (Angular auto-scopes class members). */
  keyExpr: string;
  /**
   * The rewritten dynamic-name expression — CLASS-BODY context (`this.X()` per
   * identifier reference). Used by the consumer-side `templates` getter where
   * Angular's template-scope auto-resolution does not apply. Distinct from
   * `keyExpr` because template-literal shapes like `` `footer${footerMode()}` ``
   * cannot tolerate a naive outer `this.` prefix.
   */
  classBodyKeyExpr: string;
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
  const classBodyKeyExpr = rewriteTemplateExpression(filler.dynamicNameExpr, ctx.ir, {
    prefixThis: true,
  });
  return { template, refName, keyExpr, classBodyKeyExpr, params: filler.params };
}
