/**
 * Component-ref detection (debug `refs-lowering-cross-target`, Finding 2).
 *
 * A template `ref="X"` can sit on either a plain HTML element (`<div ref="x">`)
 * or a CHILD COMPONENT (`<FlowCanvas ref="flow">`). The Angular target lowers
 * the two DIFFERENTLY:
 *
 *   - HTML-element ref → `viewChild<ElementRef<DomType>>('X')`, read as
 *     `this.X()?.nativeElement` (the DOM element).
 *   - child-component ref → `viewChild<ComponentType>('X')`, read as `this.X()`
 *     (the COMPONENT INSTANCE — Angular's view-query default read for a template
 *     reference variable on a component element). The component instance carries
 *     the `$expose` methods (re-emitted as public class members), so a consumer
 *     `$refs.flow.screenToFlowPosition(...)` resolves the handle — matching the
 *     other five targets. The host-element lowering returned an `ElementRef`
 *     whose `nativeElement` lacks those methods → silent no-op.
 *
 * Detection mirrors `annotateTagKind` (core `lowerTemplate.ts`): a ref is a
 * component ref when its element's tag — preserved verbatim (PascalCase) on
 * `RefDecl.elementTag` — matches a registered `<components>` child
 * (`ComponentDecl.localName`) or the component's own name (`ir.name`, the
 * `tagKind: 'self'` self-recursion case). Matching is exact and case-sensitive,
 * the same predicate the tag-kind resolver uses.
 *
 * The returned Map keys are ref NAMES; values are the component TYPE name (=
 * the tag = the imported binding, since the Angular shell imports each child as
 * `import { <localName> } from …` with NO alias — emitAngular.ts — and the self
 * type is the locally-defined class `ir.name`). A plain HTML-element ref is
 * absent from the Map.
 *
 * Phase 66 (D-1): the match itself was LIFTED into the shared core resolver
 * `resolveComponentRefs`. This function is now a pure internal redirect that
 * preserves the exported `collectComponentRefTypes` name + `Map<string,string>`
 * return so its consumers (emitScript.ts, rewriteScript.ts, and the inline-
 * template paths rewriteListenerExpression.ts / rewriteTemplateExpression.ts)
 * are untouched. The returned Map is
 * identical to the pre-lift output for the same input (behavior-preserving —
 * Angular leaf output must stay byte-identical, CONTEXT P1).
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { resolveComponentRefs } from '../../../../core/src/codegen/resolveComponentRefs.js';

export function collectComponentRefTypes(ir: IRComponent): Map<string, string> {
  return resolveComponentRefs(ir);
}
