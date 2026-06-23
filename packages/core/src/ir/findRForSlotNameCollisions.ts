/**
 * findRForSlotNameCollisions — pure detector for the r-for-loop-var ==
 * slot-name collision class (the Svelte-5 snippet/loop-scope shadow).
 *
 * Returns the SET of slot names that are RENDERED INSIDE an `r-for` whose loop
 * variable (item alias or index alias) is also that name:
 *
 *   <div r-for="X in items">
 *     <slot name="X" ... />     ← collision: 'X' ∈ returned set
 *   </div>
 *
 *   - Svelte 5 lowers the slot to a snippet binding `X`. The compiled
 *     `{#each items as X}` loop variable shadows that snippet WITHIN the loop
 *     body, so `{@render X(...)}` renders the loop ITEM (a non-function) →
 *     runtime "X is not a function" — visible only at Svelte runtime, never at
 *     compile/typecheck/build.
 *   - The other five targets keep loop scope and slot invocation in distinct
 *     namespaces and are immune.
 *
 * This was previously surfaced as the ROZ980 WARNING (asking the author to
 * rename the loop var). It is now AUTO-FIXED by the Svelte emitter: the
 * emitter-generated snippet binding (and its `{@render}`/`{#if}` references) is
 * renamed to a safe suffixed identifier (`X$$slot`), so the component Just Works
 * on all six targets with NO author action. This detector is the scope-precise
 * source of truth the Svelte emitter consults to decide which slots to rename.
 *
 * SCOPE-PRECISE: a name is returned ONLY when the colliding slot is rendered
 * inside the shadowing loop's body — a slot and a loop var that merely share a
 * name in disjoint scopes do NOT collide. Case-sensitive (`X` ≠ `x`). NEVER
 * throws; NEVER mutates `ir`. Pure (input `ir` → output `Set<string>`).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, TemplateLoopIR, TemplateNode } from './types.js';

/**
 * Walk the template tree, tracking the stack of enclosing `r-for` loops, and
 * collect each `<slot name="X">` invocation whose name equals an enclosing
 * loop's `itemAlias` / `indexAlias`.
 *
 * @param ir - the lowered IRComponent
 * @returns the set of colliding slot names (empty when none collide)
 */
export function findRForSlotNameCollisions(ir: IRComponent): Set<string> {
  const collisions = new Set<string>();
  if (ir.template === null) return collisions;

  const walk = (node: TemplateNode, enclosingLoops: TemplateLoopIR[]): void => {
    switch (node.type) {
      case 'TemplateLoop': {
        const next = enclosingLoops.concat(node);
        for (const child of node.body) walk(child, next);
        break;
      }
      case 'TemplateSlotInvocation': {
        // The default-slot sentinel is '' — a loop alias can never be '' — so it
        // never collides. Check this invocation against every enclosing loop.
        if (node.slotName !== '') {
          for (const loop of enclosingLoops) {
            if (loop.itemAlias === node.slotName || loop.indexAlias === node.slotName) {
              collisions.add(node.slotName);
            }
          }
        }
        // A slot's fallback content can itself contain loops + slots.
        for (const child of node.fallback) walk(child, enclosingLoops);
        break;
      }
      case 'TemplateElement': {
        for (const child of node.children) walk(child, enclosingLoops);
        if (node.slotFillers) {
          for (const filler of node.slotFillers) {
            for (const child of filler.body) walk(child, enclosingLoops);
          }
        }
        break;
      }
      case 'TemplateFragment': {
        for (const child of node.children) walk(child, enclosingLoops);
        break;
      }
      case 'TemplateConditional': {
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, enclosingLoops);
        }
        break;
      }
      case 'TemplateMatch': {
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, enclosingLoops);
        }
        if (node.hostElement) walk(node.hostElement, enclosingLoops);
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
