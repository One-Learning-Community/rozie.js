/**
 * collectSlottedReads — Lit target (quick 260807-cor, D4, Task 2a).
 *
 * Walks `ir.setupBody?.scriptProgram` and returns the set of slot keys read
 * through the `$slotted.<name>` sigil (non-computed member reads with an
 * Identifier property). This is the gate that keeps the assigned-elements
 * signal field + guarded slotchange write + pre-seed line OFF every
 * slot-bearing Lit leaf that never reads the sigil — the blast-radius guard
 * for the other 30 slot-bearing Lit leaves (RESEARCH.md P6).
 *
 * MUST run against the PRE-rewrite script program. `rewriteScript.ts` erases
 * the `$slotted` sigil into a `.value` read on the assigned-elements field,
 * so collecting AFTER rewrite would always observe an empty set. Per IR-04,
 * `ir.setupBody.scriptProgram` is the referentially-original AST (no target
 * ever mutates it in place — every target's `rewriteScript` clones first via
 * `cloneScriptProgram`), so calling this BEFORE or AFTER `rewriteScript` runs
 * for THIS target is equally safe; it is called before `emitSlotDecl` in
 * `emitLit.ts` simply because `emitSlotDecl` needs the result.
 *
 * Key normalization: the authored sigil is always spelled with the literal
 * identifier `default` for the unnamed slot (`$slotted.default`) — there is
 * no bracket/computed form. That string is exactly the key `emitSlotDecl.ts`
 * and `rewriteScript.ts:399`'s `slotNames` Set already use for the IR's
 * empty-string default `SlotDecl.name`, so no further normalization is
 * needed at the collection site; the CALLER maps `slot.name === '' ?
 * 'default' : slot.name` when consulting the returned set (mirroring the
 * existing convention).
 *
 * @experimental — shape may change before v1.0
 */

import type { NodePath } from '@babel/traverse';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { IRComponent } from '@rozie/core';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern) — mirrors every
// other traverse-consuming module in this codebase.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : (_traverse as unknown as { default: TraverseFn }).default;

const SLOTTED_SIGIL = '$slotted';

/**
 * Returns the set of slot keys ('default' for the unnamed slot, or the
 * authored `name="X"` string) read through `$slotted.<name>` anywhere in the
 * component's `<script>` block. Empty set when there is no script program or
 * no such read — the common case for the other 30 slot-bearing Lit leaves.
 * Per D-08 collected-not-thrown: never throws.
 */
export function collectSlottedReads(ir: IRComponent): Set<string> {
  const keys = new Set<string>();
  const program = ir.setupBody?.scriptProgram;
  if (!program) return keys;

  const record = (obj: t.Node, computed: boolean, prop: t.Node): void => {
    if (!t.isIdentifier(obj) || obj.name !== SLOTTED_SIGIL) return;
    if (computed) return;
    if (!t.isIdentifier(prop)) return;
    keys.add(prop.name);
  };

  try {
    traverse(program, {
      MemberExpression(path: NodePath<t.MemberExpression>) {
        record(path.node.object, path.node.computed, path.node.property);
      },
      OptionalMemberExpression(path: NodePath<t.OptionalMemberExpression>) {
        record(path.node.object, path.node.computed, path.node.property);
      },
    });
  } catch {
    // Defensive (D-08) — an unusual AST shape returns whatever was collected
    // so far rather than throwing; should be unreachable for parser output.
  }

  return keys;
}
