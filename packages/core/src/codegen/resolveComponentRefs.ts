/**
 * resolveComponentRefs — Phase 66 (composed-component ref → Handle typing), D-1.
 *
 * Single shared source of truth for "is this `RefDecl` a composed-component ref,
 * and if so what is the child's local component name?" — LIFTED VERBATIM from the
 * Angular target's proven `collectComponentRefTypes` (rewrite/componentRefs.ts)
 * so all six emitters consume ONE resolver rather than re-deriving Angular's match
 * ad hoc (LOCKED-2 / D-1).
 *
 * A template `ref="X"` can sit on either a plain HTML element (`<div ref="x">`)
 * or a CHILD COMPONENT (`<FlowCanvas ref="flow">`). Only the latter carries the
 * child's `$expose` members, so its ref must be typed as the child instead of the
 * DOM fallback. Detection mirrors `annotateTagKind` (core `lowerTemplate.ts`): a
 * ref is a component ref when its element's tag — preserved verbatim (PascalCase)
 * on `RefDecl.elementTag` — matches a registered `<components>` child
 * (`ComponentDecl.localName`) or the component's own name (`ir.name`, the
 * `tagKind: 'self'` self-recursion case). Matching is exact and case-sensitive.
 *
 * The returned Map keys are ref NAMES; values are the child's LOCAL COMPONENT
 * name (= the tag = the imported binding). A plain HTML-element ref is ABSENT
 * from the Map — this INERTNESS for DOM refs is the carve-out that keeps every
 * non-composed ref byte-identical downstream (each emitter's DOM `switch` runs
 * unchanged when the resolver returns nothing for a ref).
 *
 * PURE helper: does NOT mutate the `RefDecl` IR shape. The alternative — annotate
 * `RefDecl` during semantic analysis with an optional `componentLocalName` — was
 * deliberately NOT taken (avoids IR-snapshot drift, D-1); emitters call this with
 * the whole `ir` at their ref-emit site instead.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../ir/types.js';

/**
 * Resolve which of an IR's refs point at a `<components>`-composed child.
 *
 * @param ir - the lowered component (its `components` table + `refs`).
 * @returns Map of `ref.name -> child local component name`. Empty for a component
 *   with no composed-component refs (DOM refs are never present).
 */
export function resolveComponentRefs(ir: IRComponent): Map<string, string> {
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
