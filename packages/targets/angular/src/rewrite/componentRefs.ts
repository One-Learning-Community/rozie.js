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
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';

export function collectComponentRefTypes(ir: IRComponent): Map<string, string> {
  // Defensive nullish-fallbacks (D-08): `compile()` always populates these, but
  // partial IRs hand-built in unit tests may omit `components`/`refs`.
  const componentTags = new Set<string>((ir.components ?? []).map((c) => c.localName));
  // Self-recursion: a `<Self ref="x">` resolves to the locally-defined class.
  if (ir.name) componentTags.add(ir.name);
  const out = new Map<string, string>();
  for (const ref of ir.refs ?? []) {
    if (componentTags.has(ref.elementTag)) {
      out.set(ref.name, ref.elementTag);
    }
  }
  return out;
}
