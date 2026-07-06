/**
 * findRForSlotNameCollisions — pure detector for TWO Svelte-5 snippet/scope
 * shadow classes that both crash (or silently mis-render) at Svelte RUNTIME
 * only, with zero compile/typecheck signal:
 *
 * CLASS 1 — r-for-loop-var == slot-name (the original detector):
 *
 *   <div r-for="X in items">
 *     <slot name="X" ... />     ← collision: 'X' ∈ returned set
 *   </div>
 *
 *   Svelte 5 lowers the slot to a snippet binding `X`. The compiled
 *   `{#each items as X}` loop variable shadows that snippet WITHIN the loop
 *   body, so `{@render X(...)}` renders the loop ITEM (a non-function) →
 *   runtime "X is not a function". The other five targets keep loop scope and
 *   slot invocation in distinct namespaces and are immune.
 *
 * CLASS 2 — script/param-scope shadow (Phase 73 item #1 broadening): a
 * top-level `<script>` HELPER's PARAMETER — a `function foo(X) {...}` or a
 * top-level `const foo = (X) => {...}` — named the same as a declared slot:
 *
 *   <script>
 *   function renderNode(element, node) {   // param `node`
 *     if ($slots.node) { ... }             // rewrites to bare `node` —
 *   }                                      // SHADOWED by the param above!
 *   </script>
 *   <slot name="node" ... />
 *
 *   The Svelte emitter lowers `$slots.node` (script-side presence check) to
 *   the bare slot-merge identifier `node`. A same-named PARAMETER on the
 *   enclosing helper shadows that identifier WITHIN the helper's body, so the
 *   presence check silently reads the local param instead — e.g. dropping the
 *   default-chrome fallback because the (always-truthy) param reads as
 *   "filled" (the `rete` FlowCanvas `node`→`reteNode` / `embla`/`slider`
 *   author-workaround lesson). This is DISTINCT from a top-level `<props>` /
 *   `<data>` / `$computed` / plain-helper-NAME collision (handled separately by
 *   `portalSlotMergeName`'s widened set) — this class is specifically a
 *   nested-scope PARAMETER binding, which no other detector scans for.
 *
 * Both classes are AUTO-FIXED by the Svelte emitter: the emitter-generated
 * snippet binding (and every reference — render site, `$slots.X`/`$portals.X`
 * rewrites) is renamed to a safe suffixed identifier (`X$$slot`), so the
 * component Just Works on all six targets with NO author action. This
 * detector is the single source of truth `portalSlotMergeName` +
 * `emitSlotInvocation` consult to decide which slots to rename.
 *
 * Class 1 is SCOPE-PRECISE: a name is returned ONLY when the colliding slot is
 * rendered inside the shadowing loop's body — a slot and a loop var that
 * merely share a name in disjoint scopes do NOT collide. Class 2 is
 * CONSERVATIVE (not scope-precise to the read site): ANY top-level helper
 * parameter matching a declared slot name triggers the rename, regardless of
 * whether that helper's body actually reads `$slots.X` — a false-positive
 * rename is harmless (just an extra safe suffix), while a false negative is a
 * silent runtime footgun. Neither class ever flags a slot name that only
 * equals a declared `<props>` key — that collision is the separate, already-
 * hard-error ROZ127 (`validateSlotPropCollision`), never a rename target.
 *
 * Case-sensitive (`X` ≠ `x`). NEVER throws; NEVER mutates `ir`. Pure (input
 * `ir` → output `Set<string>`).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { IRComponent, TemplateLoopIR, TemplateNode } from './types.js';

/** Simple + default + rest param identifier names (skips destructured patterns). */
function functionParamNames(
  params: Array<t.Identifier | t.Pattern | t.RestElement>,
): string[] {
  const names: string[] = [];
  for (const p of params) {
    if (t.isIdentifier(p)) {
      names.push(p.name);
    } else if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) {
      names.push(p.left.name);
    } else if (t.isRestElement(p) && t.isIdentifier(p.argument)) {
      names.push(p.argument.name);
    }
    // Destructured patterns (ObjectPattern/ArrayPattern) are intentionally
    // skipped — a slot name inside a destructure is a rarer shape and the
    // shipped Class 1 rename + `portalSlotMergeName`'s widened set already
    // cover the common top-level-binding collisions.
  }
  return names;
}

/**
 * CLASS 2 — collect every slot name shadowed by a top-level `<script>`
 * helper's PARAMETER: a `function foo(X) {...}` FunctionDeclaration, or a
 * top-level `const/let foo = (X) => {...}` / `function (X) {...}` expression.
 */
function findScriptParamSlotShadows(ir: IRComponent): Set<string> {
  const shadows = new Set<string>();
  const slotNames = new Set(
    ir.slots.map((s) => s.name).filter((n) => n !== ''),
  );
  if (slotNames.size === 0) return shadows;

  const program = ir.setupBody?.scriptProgram;
  if (!program) return shadows;

  const checkParams = (params: Array<t.Identifier | t.Pattern | t.RestElement>): void => {
    for (const name of functionParamNames(params)) {
      if (slotNames.has(name)) shadows.add(name);
    }
  };

  for (const stmt of program.program.body) {
    if (t.isFunctionDeclaration(stmt)) {
      checkParams(stmt.params);
    } else if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        const init = decl.init;
        if (
          init !== null &&
          (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))
        ) {
          checkParams(init.params);
        }
      }
    }
  }
  return shadows;
}

/**
 * Walk the template tree, tracking the stack of enclosing `r-for` loops, and
 * collect each `<slot name="X">` invocation whose name equals an enclosing
 * loop's `itemAlias` / `indexAlias` (Class 1), UNIONED with every script/
 * param-scope shadow (Class 2).
 *
 * @param ir - the lowered IRComponent
 * @returns the set of colliding slot names (empty when none collide)
 */
export function findRForSlotNameCollisions(ir: IRComponent): Set<string> {
  // CLASS 2 first — a pure script-side scan, independent of the template walk
  // below (and unaffected by `ir.template === null`, e.g. an all-portal-slot
  // component with no plain template slot invocation).
  const collisions = findScriptParamSlotShadows(ir);
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
