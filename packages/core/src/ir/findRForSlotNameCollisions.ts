/**
 * findRForSlotNameCollisions — pure detector for THREE Svelte-5 snippet/scope
 * shadow classes that crash (or silently mis-render, or hard-fail the Svelte
 * compile) at Svelte-only, with zero cross-target signal:
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
 * `<script>` HELPER's PARAMETER — a `function foo(X) {...}` or a `const foo =
 * (X) => {...}`, at ANY nesting depth (including inside `$onMount`/`$watch`/
 * event-handler closures) — named the same as a declared slot, where that
 * SAME helper's own body reads the `$slots.X` sigil:
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
 * CLASS 3 — top-level `<script>` IMPORT identifier == slot-name (Quick
 * 260717-8zb Task 2 Item 4): a top-level `import { X } from '...'` (or a
 * default/namespace import LOCAL-bound to `X`) whose local name equals a
 * declared `<slot name="X">`:
 *
 *   <script>
 *   import { breadcrumb } from './helpers.js'
 *   </script>
 *   <slot name="breadcrumb" ... />
 *
 *   The Svelte emitter's slot-merge declaration (`const breadcrumb =
 *   $derived(...)`, portalSlotMergeName.ts) shares the SAME top-level
 *   `<script>` program scope as every import — unlike Classes 1/2 (a RUNTIME
 *   shadow inside a narrower scope), this is a genuine DUPLICATE BINDING at
 *   the SAME scope level, so it is a hard Svelte "already declared" COMPILE
 *   error, not a silent runtime mis-render. Unconditional on the name match
 *   (no additional "is it read" gate is needed — an import always occupies
 *   its local binding name in program scope regardless of use, so any
 *   same-named top-level `<script>` binding is a genuine duplicate
 *   declaration the instant both exist).
 *
 * All THREE classes are AUTO-FIXED by the Svelte emitter: the
 * emitter-generated snippet/merge binding (and every reference — render
 * site, `$slots.X`/`$portals.X` rewrites) is renamed to a safe suffixed
 * identifier (`X$$slot`), so the component Just Works on all six targets
 * with NO author action. This detector is the single source of truth
 * `portalSlotMergeName` + `emitSlotInvocation` consult to decide which slots
 * to rename.
 *
 * Classes 1/2 are SCOPE-PRECISE: Class 1 requires the colliding slot to be
 * rendered inside the shadowing loop's body (a slot and a loop var that
 * merely share a name in disjoint scopes do NOT collide); Class 2 requires the
 * shadowing helper's OWN body to actually read `$slots.<name>` (a helper
 * param that merely shares a slot's name but never reads the sigil — e.g. a
 * plain data-object param — is NOT flagged). Class 3 needs no such gate (see
 * above — the collision is unconditional on the import existing). This keeps
 * unrelated existing components byte-identical: a false positive here would
 * force an unplanned rebless of every `@rozie-ui` leaf whose helper happens to
 * reuse a slot name as a parameter, defeating "batching shares only the
 * REBLESS, not the fixing." No class ever flags a slot name that only equals
 * a declared `<props>` key — that collision is the separate, already-hard-error
 * ROZ127 (`validateSlotPropCollision`), never a rename target.
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

/** Generic shallow recursive walk over any Babel node's child nodes. */
function walkNode(node: t.Node | null | undefined, onNode: (n: t.Node) => void): void {
  if (node === null || node === undefined) return;
  onNode(node);
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const child = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c !== null && typeof (c as t.Node)?.type === 'string') {
          walkNode(c as t.Node, onNode);
        }
      }
    } else if (child !== null && typeof (child as t.Node)?.type === 'string') {
      walkNode(child as t.Node, onNode);
    }
  }
}

/**
 * Does `body` contain a `$slots.<name>` read (a non-computed MemberExpression
 * on the bare `$slots` sigil identifier)? This is the ONLY sigil shape that
 * routes through the shared slot-merge identifier (`portalSlotMergeName`) at
 * script scope — `$portals.<name>(...)` is a plain method call on the
 * `portals` closure object and is NEVER renamed, so it is not scanned here.
 */
function bodyReadsSlotSigil(body: t.Node, name: string): boolean {
  let found = false;
  walkNode(body, (node) => {
    if (found) return;
    if (
      t.isMemberExpression(node) &&
      !node.computed &&
      t.isIdentifier(node.object) &&
      node.object.name === '$slots' &&
      t.isIdentifier(node.property) &&
      node.property.name === name
    ) {
      found = true;
    }
  });
  return found;
}

/**
 * CLASS 2 — collect every slot name shadowed by a `<script>` helper's
 * PARAMETER where that SAME helper's own body reads the `$slots.<name>` sigil:
 * a `function foo(X) {...}` FunctionDeclaration, a `const/let foo = (X) => {...}`
 * / `function (X) {...}` expression, or — critically — the SAME shapes NESTED
 * inside another closure (e.g. a helper declared inside `$onMount(() => {
 * const renderNode = (element, node) => {...} })`, the real `rete` FlowCanvas
 * shape). A top-level-only scan misses this: FlowCanvas's `renderNode` lives
 * inside `$onMount`'s callback, not as a direct top-level `<script>` statement
 * — so this walks the FULL script AST (every function-like node, at any
 * nesting depth), not just `program.body`'s direct children.
 *
 * SCOPE-PRECISE (unlike an earlier draft of this detector): a param name
 * matching a slot name is flagged ONLY when that function's OWN body actually
 * reads `$slots.<name>` — a helper param that merely happens to share a slot's
 * name but never reads the sigil (e.g. `startTimer(toast)` in
 * `packages/ui/toast` — a plain data-object param, no `$slots.toast` read
 * anywhere) is NOT flagged, keeping unrelated existing components
 * byte-identical. This mirrors the scope-precision of Class 1 and the sibling
 * `findRForLoopVarShadows.loopVarHelperShadows` check (which also gates on an
 * actual in-body reference, not a bare name match).
 */
function findScriptParamSlotShadows(ir: IRComponent): Set<string> {
  const shadows = new Set<string>();
  const slotNames = new Set(
    ir.slots.map((s) => s.name).filter((n) => n !== ''),
  );
  if (slotNames.size === 0) return shadows;

  const program = ir.setupBody?.scriptProgram;
  if (!program) return shadows;

  walkNode(program.program, (node) => {
    if (
      !t.isFunctionDeclaration(node) &&
      !t.isFunctionExpression(node) &&
      !t.isArrowFunctionExpression(node)
    ) {
      return;
    }
    for (const name of functionParamNames(node.params)) {
      if (slotNames.has(name) && bodyReadsSlotSigil(node.body, name)) {
        shadows.add(name);
      }
    }
  });

  return shadows;
}

/**
 * CLASS 3 (Quick 260717-8zb Task 2 Item 4) — collect every slot name that
 * equals the LOCAL binding name of a top-level `<script>` `import`
 * declaration: `import { X } from '...'`, `import X from '...'` (default),
 * or `import * as X from '...'` (namespace) — any specifier form binds a
 * local identifier in Program scope, which is exactly where the Svelte
 * emitter's slot-merge `const X = $derived(...)` also lives. Unconditional
 * on the name match (see the module header — this is a genuine same-scope
 * duplicate declaration, not a narrower-scope runtime shadow needing an
 * additional "is it read" gate).
 */
function findImportSlotNameCollisions(ir: IRComponent): Set<string> {
  const collisions = new Set<string>();
  const slotNames = new Set(
    ir.slots.map((s) => s.name).filter((n) => n !== ''),
  );
  if (slotNames.size === 0) return collisions;

  const program = ir.setupBody?.scriptProgram;
  if (!program) return collisions;

  for (const stmt of program.program.body) {
    if (!t.isImportDeclaration(stmt)) continue;
    for (const specifier of stmt.specifiers) {
      const localName = specifier.local.name;
      if (slotNames.has(localName)) collisions.add(localName);
    }
  }

  return collisions;
}

/**
 * Walk the template tree, tracking the stack of enclosing `r-for` loops, and
 * collect each `<slot name="X">` invocation whose name equals an enclosing
 * loop's `itemAlias` / `indexAlias` (Class 1), UNIONED with every script/
 * param-scope shadow (Class 2) and every top-level import-identifier
 * collision (Class 3).
 *
 * @param ir - the lowered IRComponent
 * @returns the set of colliding slot names (empty when none collide)
 */
export function findRForSlotNameCollisions(ir: IRComponent): Set<string> {
  // CLASS 2 + CLASS 3 first — pure script-side scans, independent of the
  // template walk below (and unaffected by `ir.template === null`, e.g. an
  // all-portal-slot component with no plain template slot invocation).
  const collisions = findScriptParamSlotShadows(ir);
  for (const name of findImportSlotNameCollisions(ir)) collisions.add(name);
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
