/**
 * findReprojectionSlotNameCollisions — pure detector for the
 * re-projected-slot-name == child-fill-name collision class.
 *
 * Returns the SET of slot names X that the component RE-PROJECTS into a CHILD
 * component's slot of the SAME name X:
 *
 *   <Child>
 *     <template #X="{ ... }">      ← a SlotFillerDecl filling Child's slot 'X'
 *       <slot name="X" ... />      ← re-projects this component's OWN slot 'X'
 *     </template>                     collision: 'X' ∈ returned set
 *   </Child>
 *
 * Why this collides (only on the slot/snippet-unifying targets — Svelte 5,
 * Angular, Lit):
 *   - The fill `<template #X>` lowers to a snippet/template/function-prop NAMED
 *     `X` that is handed to the child.
 *   - The re-projected `<slot name="X">` lowers to a reference to THIS
 *     component's own `X` slot resolver (Svelte: `const X = $derived(__XProp ??
 *     snippets?.X)`; Angular/Lit: the analogous consumer-slot accessor).
 *   - On those three targets the forwarded `X` snippet/template/prop SHADOWS the
 *     same-named resolver, so the "did the consumer pass #X?" check resolves to
 *     the wrong binding and `@render`/outlet/`call` targets a non-renderable →
 *     the re-projected slot (and the rows it wraps) render NOTHING. Visible only
 *     at runtime, never at compile/typecheck/build (cf. the r-for-var ==
 *     slot-name class in `findRForSlotNameCollisions`).
 *   - vue/react/solid keep slot scope and the slot-fill namespace distinct and
 *     are immune — they must NOT apply the rename (byte-identity).
 *
 * The fix consuming this detector mirrors the r-for auto-fix: the colliding
 * RESOLVER binding (and its references) is renamed to a safe suffixed identifier
 * (`X$$slot`) while the forwarded fill keeps the child-required name `X`. This
 * detector is the scope-precise source of truth the per-target emitters consult.
 *
 * SCOPE-PRECISE: a name is returned ONLY when the re-projected `<slot name="X">`
 * is rendered INSIDE a fill whose target name is also `X` — a slot and a fill
 * that merely share a name in disjoint scopes do NOT collide. Case-sensitive
 * (`X` ≠ `x`). The default-slot sentinel `''` never collides (a `<template #X>`
 * fill is always named). NEVER throws; NEVER mutates `ir`. Pure.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, TemplateNode } from './types.js';

/**
 * Walk the template tree, tracking the stack of enclosing slot-fill target
 * names, and collect each `<slot name="X">` invocation whose name equals an
 * enclosing fill's target name.
 *
 * @param ir - the lowered IRComponent
 * @returns the set of colliding slot names (empty when none collide)
 */
export function findReprojectionSlotNameCollisions(ir: IRComponent): Set<string> {
  const collisions = new Set<string>();
  if (ir.template === null) return collisions;

  const walk = (node: TemplateNode, enclosingFillNames: string[]): void => {
    switch (node.type) {
      case 'TemplateSlotInvocation': {
        // The default-slot sentinel '' is never a `<template #X>` fill target,
        // so it never collides. Flag this re-projection if it sits inside a fill
        // of the same name.
        if (node.slotName !== '' && enclosingFillNames.includes(node.slotName)) {
          collisions.add(node.slotName);
        }
        // A slot's fallback content can itself contain nested fills + slots.
        for (const child of node.fallback) walk(child, enclosingFillNames);
        break;
      }
      case 'TemplateElement': {
        for (const child of node.children) walk(child, enclosingFillNames);
        if (node.slotFillers) {
          for (const filler of node.slotFillers) {
            // A dynamic-name fill (`<template #[expr]>`) has no static target
            // name to collide on — push nothing for it.
            const next =
              filler.isDynamic || filler.name === ''
                ? enclosingFillNames
                : enclosingFillNames.concat(filler.name);
            for (const child of filler.body) walk(child, next);
          }
        }
        break;
      }
      case 'TemplateLoop': {
        for (const child of node.body) walk(child, enclosingFillNames);
        break;
      }
      case 'TemplateFragment': {
        for (const child of node.children) walk(child, enclosingFillNames);
        break;
      }
      case 'TemplateConditional': {
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, enclosingFillNames);
        }
        break;
      }
      case 'TemplateMatch': {
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, enclosingFillNames);
        }
        if (node.hostElement) walk(node.hostElement, enclosingFillNames);
        break;
      }
      // TemplateInterpolation / TemplateStaticText — leaves, no children.
      default:
        break;
    }
  };

  walk(ir.template, []);
  return collisions;
}
