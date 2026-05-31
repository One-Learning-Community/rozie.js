/**
 * ROZ203 — Expression-context mutation of reactive state (260530).
 *
 * Companion to the propWriteValidator (ROZ200). Where ROZ200 forbids writing
 * to a NON-model `$props.<key>` at all, this validator forbids a narrower
 * shape that is broken for a DIFFERENT reason: a mutation of reactive state
 * (`$data.<key>` or a `model: true` `$props.<key>`) whose VALUE IS CONSUMED.
 *
 * Background (cb341f12 + Pitfall 6): Rozie lowers mutations to reactive state
 * into per-target setters. In the setter-based targets the mutation expression
 * does NOT evaluate to the value JS semantics demand:
 *   - React  `$data.x++`   → `setX(prev => prev + 1)` (returns the setter's
 *     `void`/`undefined`, NOT the postfix pre-increment value)
 *   - React  `$data.x = v` → `setX(v)` (returns `undefined`, NOT `v`)
 *   - Solid  `$data.x()++` / Angular `this.x()++` are not even valid syntax.
 *
 * Statement context (`$data.x++;` / `$data.x += 1;` / `$data.x = v;` as its
 * own ExpressionStatement) discards the value — those lower cleanly through the
 * setter (cb341f12 handles `++`/`--`; compound/plain were already handled). It
 * is ONLY when the value is read back — `const y = $data.x++`, `arr[$data.i++]`,
 * `f($data.x = v)`, `const y = ($data.x += 1)` — that the lowering can't be
 * satisfied. Today the targets either pass it through verbatim (uncompilable)
 * or call a setter whose result is the wrong value (silently wrong). Both are
 * silent-broken emit; this turns it into a LOUD compile error.
 *
 * Detection: an `UpdateExpression` OR `AssignmentExpression` whose target is a
 * reactive accessor AND whose DIRECT PARENT is not an `ExpressionStatement`
 * (the value is consumed). Plain non-reactive locals (`let t; const y = t++`)
 * are untouched.
 *
 * Scope: `<script>` only — template expressions read for binding evaluation,
 * they don't write state.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Per D-11/D-12: every diagnostic
 * carries an accurate byte-offset loc from the offending node.
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { BindingsTable } from '../types.js';
import { detectMagicAccess } from '../visitors.js';

// Default-export interop (see collectScriptDecls.ts / propWriteValidator.ts).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

function locFromNode(node: t.Node): SourceLoc {
  return { start: node.start ?? 0, end: node.end ?? 0 };
}

/**
 * Is `target` a write to reactive state — `$data.<key>` (any declared key) or a
 * `model: true` `$props.<key>`? Returns the human label for the diagnostic
 * (`$data.x` / `$props.x`) or null if the target isn't reactive state.
 *
 * NON-model `$props` writes are NOT our concern — ROZ200 already rejects them
 * outright (they never get a setter), and double-emitting both codes for one
 * site would be noise.
 */
function reactiveTargetLabel(
  target: t.Node,
  bindings: BindingsTable,
): string | null {
  // Computed access ($data['x']) returns null from detectMagicAccess — defer
  // to ROZ106, same as ROZ200 does.
  const access = detectMagicAccess(target);
  if (!access) return null;
  if (access.scope === 'data') {
    if (!bindings.data.has(access.member)) return null; // unknown → ROZ101
    return `$data.${access.member}`;
  }
  if (access.scope === 'props') {
    const decl = bindings.props.get(access.member);
    if (!decl) return null; // unknown → ROZ100
    if (!decl.isModel) return null; // non-model → ROZ200 owns this
    return `$props.${access.member}`;
  }
  return null;
}

function makeRoz203(offendingNode: t.Node, label: string, kind: 'update' | 'assign'): Diagnostic {
  const sample = kind === 'update' ? `${label}++` : `${label} += 1`;
  const message =
    `Expression-context mutation of reactive state ('${sample}' used where its value is read) ` +
    `isn't supported — the value can't be read back from a setter-based target ` +
    `(React/Solid/Angular lower this to a setter call whose result is not the mutated value).`;
  return {
    code: RozieErrorCode.UPDATE_EXPRESSION_VALUE_CONSUMED,
    severity: 'error',
    message,
    loc: locFromNode(offendingNode),
    hint:
      `Split it into its own statement and read the value separately, e.g.\n` +
      `  ${label} += 1\n` +
      `  const y = ${label}`,
  };
}

/**
 * Run the expression-context reactive-mutation validator over the script
 * block. Emits ROZ203 for each consumed-value mutation of reactive state.
 * NEVER throws (D-08).
 */
export function runUpdateExpressionValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  if (!ast.script) return;
  traverse(ast.script.program, {
    UpdateExpression(path: NodePath<t.UpdateExpression>) {
      const label = reactiveTargetLabel(path.node.argument, bindings);
      if (label === null) return;
      // Statement context discards the value — fine (lowers through setter).
      if (path.parentPath?.isExpressionStatement()) return;
      diagnostics.push(makeRoz203(path.node, label, 'update'));
    },
    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      const label = reactiveTargetLabel(path.node.left, bindings);
      if (label === null) return;
      if (path.parentPath?.isExpressionStatement()) return;
      diagnostics.push(makeRoz203(path.node, label, 'assign'));
    },
  });
}
