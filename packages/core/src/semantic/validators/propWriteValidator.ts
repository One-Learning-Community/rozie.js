/**
 * SEM-02 / ROZ200 — Static prop-write validator (Plan 02-02 Task 2).
 *
 * Detects writes to `$props.foo` where `foo` does NOT have `model: true`.
 * Operator-agnostic per Pitfall 3 — covers ALL AssignmentExpression
 * operators (`=`, compound `+=` / `-=` / `*=` / etc., logical-assigns
 * `&&=` / `||=` / `??=`) AND UpdateExpression (`++` / `--`).
 *
 * Scope: <script> only. Template-attribute expressions don't write to
 * props (they read for binding evaluation).
 *
 * Behavior:
 *   - $props.foo = 5   → ROZ200 (if foo lacks model: true)
 *   - $props.foo += 1  → ROZ200 (any compound operator)
 *   - $props.foo++     → ROZ200 (UpdateExpression)
 *   - const { foo } = $props; foo = 5  → NO ROZ200 (foo is a NEW local)
 *   - $props.bogus = 5 → NO ROZ200 (defer to ROZ100; no decl to check
 *     isModel against)
 *   - $props['foo'] = 5 → NO ROZ200 (defer to ROZ106 from
 *     unknownRefValidator)
 *
 * Per Phase 2 success criterion 2: Counter.rozie's `$props.value += $props.step`
 * succeeds because `value` has `model: true`. Counter-with-step-write.rozie
 * (a synthetic copy that mutates `$props.step`) emits exactly one ROZ200.
 *
 * Per D-08 collected-not-thrown: NEVER throws.
 * Per D-11/D-12: every emitted diagnostic carries an accurate byte-offset
 * loc from the AssignmentExpression / UpdateExpression node, plus a
 * `related` entry pointing at the prop's declaration.
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { BindingsTable, PropDeclEntry } from '../types.js';
import { detectMagicAccess } from '../visitors.js';

// Default-export interop (see collectScriptDecls.ts).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

function locFromNode(node: t.Node): SourceLoc {
  return { start: node.start ?? 0, end: node.end ?? 0 };
}

/**
 * Build the ROZ200 diagnostic for a single offending write site.
 */
function makeRoz200(
  offendingNode: t.Node,
  member: string,
  decl: PropDeclEntry,
  operator: string,
): Diagnostic {
  // Verb selection (write/mutate) is presentation only — gating on the operator
  // for diagnostic emission would re-introduce Pitfall 3.
  const isPlainAssign = operator.length === 1; // '=' (the only single-char operator)
  const verb = isPlainAssign ? 'write to' : 'mutate';
  const operatorPhrase = isPlainAssign ? '' : ` with ${operator}`;
  const message = `Cannot ${verb} '$props.${member}'${operatorPhrase} — '${member}' is not declared with model: true.`;
  return {
    code: RozieErrorCode.WRITE_TO_NON_MODEL_PROP,
    severity: 'error',
    message,
    loc: locFromNode(offendingNode),
    hint: "Add 'model: true' to the prop declaration if two-way binding is intended, or use $data for component-local state.",
    related: [{ message: 'Prop declared here', loc: decl.sourceLoc }],
  };
}

/**
 * For an LHS node (left-hand side of AssignmentExpression OR argument of
 * UpdateExpression), inspect whether it's a write to a non-model prop.
 * If so, push a ROZ200 diagnostic. Returns true if the LHS targeted
 * a magic accessor (regardless of whether a diagnostic fired) — callers
 * use this to know whether to skip downstream walking.
 */
function checkLHSForPropWrite(
  lhs: t.Node,
  parentNode: t.Node,
  operator: string,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  // detectMagicAccess returns null on computed access ($props['foo']) — leave
  // that to unknownRefValidator (ROZ106).
  const access = detectMagicAccess(lhs);
  if (!access) return;
  if (access.scope !== 'props') return;
  const decl = bindings.props.get(access.member);
  if (!decl) {
    // Unknown prop — unknownRefValidator emits ROZ100; don't double-emit.
    return;
  }
  if (decl.isModel) return; // Two-way binding allowed.
  diagnostics.push(makeRoz200(parentNode, access.member, decl, operator));
}

/**
 * Run the prop-write validator over the script block. Emits ROZ200 for each
 * write to a non-model prop. NEVER throws (D-08).
 */
export function runPropWriteValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  if (!ast.script) return;
  traverse(ast.script.program, {
    AssignmentExpression(path) {
      checkLHSForPropWrite(
        path.node.left,
        path.node,
        path.node.operator,
        bindings,
        diagnostics,
      );
    },
    UpdateExpression(path) {
      checkLHSForPropWrite(
        path.node.argument,
        path.node,
        path.node.operator,
        bindings,
        diagnostics,
      );
    },
  });
}
