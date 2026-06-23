/**
 * validateRForSlotNameCollision — r-for loop variable shadows a slot name (the
 * Svelte-5 snippet/loop-scope collision class).
 *
 * Post-IR pass that flags every `<slot name="X">` RENDERED INSIDE an `r-for`
 * whose loop variable (item alias or index alias) is also `X`:
 *
 *   <div r-for="X in items">
 *     <slot name="X" ... />     ← collision
 *   </div>
 *
 *   - Svelte 5 lowers the slot to a snippet prop `X` in the ONE `$props()`
 *     namespace. The compiled `{#each items as X}` loop variable shadows that
 *     snippet WITHIN the loop body, so `{@render X(...)}` renders the loop ITEM
 *     (a non-function) → runtime "X is not a function" — visible only at Svelte
 *     runtime, never at compile/typecheck/build.
 *   - The other five targets keep loop scope and slot invocation in distinct
 *     namespaces and are immune.
 *
 * That asymmetry is a silent cross-target divergence on 1 of 6 targets that has
 * recurred across families (embla `slide`→`item`, slider `mark`→`tick`, toast
 * `toast`→`t`). Unlike ROZ127 (slot/prop, a hard error) this is a WARNING: the
 * loop variable is legitimate and five targets work; the fix is a one-token
 * rename of the loop variable. The check is SCOPE-PRECISE — it fires only when
 * the colliding slot is rendered inside the shadowing loop's body, so a slot and
 * a loop var that merely share a name in disjoint scopes do NOT warn.
 *
 * Diagnostic shape — a DUAL code-frame (mirrors ROZ127 / ROZ979):
 *   - primary frame at the `r-for` element loc (where the rename happens);
 *   - `related[]` secondary frame at the shadowed `<slot>` invocation loc.
 *
 * Case-sensitive (`X` ≠ `x`). Per D-08 collected-not-thrown: NEVER throws — every
 * collision pushes a diagnostic and continues. Mutates `diagnostics` in place;
 * NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) — the single
 * chokepoint both `compile()` and `@rozie/unplugin` share — so it fires
 * regardless of entrypoint.
 *
 * @experimental — shape may change before v1.0
 */
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent, TemplateLoopIR, TemplateNode } from './types.js';

/**
 * Walk the template tree, tracking the stack of enclosing `r-for` loops, and
 * push ROZ980 for each `<slot name="X">` invocation whose name equals an
 * enclosing loop's `itemAlias` / `indexAlias`.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ980 pushed per collision)
 */
export function validateRForSlotNameCollision(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  if (ir.template === null) return;

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
            const which =
              loop.itemAlias === node.slotName
                ? 'item'
                : loop.indexAlias === node.slotName
                  ? 'index'
                  : null;
            if (which !== null) {
              diagnostics.push({
                code: RozieErrorCode.RFOR_SLOT_NAME_COLLISION,
                severity: 'warning',
                message: `The r-for ${which} variable '${node.slotName}' shadows <slot name="${node.slotName}"> rendered inside the loop. On Svelte 5 the slot is a snippet in the \`$props\` namespace, and the \`{#each … as ${node.slotName}}\` loop variable shadows it, so \`{@render ${node.slotName}()}\` renders the loop ${which} (a non-function) → runtime "${node.slotName} is not a function" on Svelte only. The other five targets are immune.`,
                loc: loop.sourceLoc,
                hint: `Rename the r-for loop variable so it differs from every slot rendered inside the loop — e.g. \`r-for="${node.slotName === 'item' ? 'row' : 'item'} in …"\` and update its references. The <slot name="${node.slotName}"> stays as-is.`,
                related: [
                  {
                    message: `<slot name="${node.slotName}"> rendered here (inside the loop)`,
                    loc: node.sourceLoc,
                  },
                ],
              });
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
}
