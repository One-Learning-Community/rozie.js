/**
 * isWritableLValue — Phase 07.3 Plan 02 / 07.3-CONTEXT D-03 permissive LHS rule.
 *
 * Pure-function helper: given a Babel `Expression` node + the consumer's
 * `IRComponent`, returns `true` if the expression is a writable lvalue
 * acceptable as the RHS of `r-model:propName="expr"`.
 *
 * The rule deliberately mirrors what users intuitively expect to bind from
 * the consumer side:
 *
 *   - `$data.x`            → true  (top-level data ref; x declared in <data>)
 *   - `$data.x.y` / deeper → true  (deep member chain rooted in $data, head x declared)
 *   - `$props.x`           → true  ONLY when the consumer's own <props> declares
 *                                  x with `model: true` (the forwarding pattern
 *                                  — parallel to Vue wrapper components)
 *
 * Everything else is rejected with ROZ951:
 *   - literals (boolean/number/string/null/undefined)
 *   - ternaries / conditional expressions
 *   - function call results
 *   - $computed refs (computed refs are not lvalues)
 *   - $refs.x (refs are read-only DOM-element wrappers)
 *   - unknown $data.foo (foo not declared in <data>)
 *   - $props.x without model: true (one-way prop)
 *   - identifiers that aren't magic accessors (the rule is whitelist-only —
 *     custom helper identifiers cannot be lvalues for r-model purposes
 *     because the writer side has no machinery to push values back through
 *     them; if a user wants that, they wrap it in a $data setter)
 *
 * This helper is consumed ONLY by `validateTwoWayBindings` (ROZ951). The
 * existing `propWriteValidator` (ROZ200) intentionally keeps using
 * `detectMagicAccess` to preserve its existing semantics — splitting the
 * helpers prevents D-03's permissive rule from accidentally relaxing ROZ200.
 *
 * Per D-08 collected-not-thrown: returns false on any unexpected shape;
 * never throws. The caller is responsible for emitting ROZ951.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { IRComponent } from '../ir/types.js';

/**
 * Walk a chain of `MemberExpression` (and/or `OptionalMemberExpression`) nodes
 * to find the leftmost object identifier. Returns its name when the chain is
 * a simple identifier-rooted member chain with all-static keys; null otherwise.
 *
 * E.g.:
 *   - `$data.x`        → '$data'
 *   - `$data.x.y.z`    → '$data'
 *   - `$data['x']`     → null  (computed key — magic accessor case, ROZ106 turf)
 *   - `getFoo().x`     → null  (object is not an identifier)
 *   - `$data?.x`       → '$data' (optional chain still resolves the leftmost id)
 */
function getLeftmostIdentifierName(
  expr: t.Expression,
): { rootName: string; firstMemberName: string | null } | null {
  // Walk down through nested member expressions to the leftmost object.
  let current: t.Expression = expr;
  let firstMemberName: string | null = null;
  while (
    t.isMemberExpression(current) ||
    t.isOptionalMemberExpression(current)
  ) {
    // Computed keys (`obj[expr]`) or non-identifier static properties make the
    // chain unsuitable for our whitelist — reject the whole expression.
    if (current.computed) return null;
    if (!t.isIdentifier(current.property)) return null;
    // Capture the immediately-deeper property name on the first iteration.
    // The walker traverses outer-to-inner (the outermost MemberExpression
    // wraps the inner chain), so the LAST property we see is closest to the
    // root identifier — i.e. the "first member" after the root. Track every
    // step so the final assignment after the loop is correct.
    firstMemberName = current.property.name;
    current = current.object;
  }
  if (!t.isIdentifier(current)) return null;
  return { rootName: current.name, firstMemberName };
}

/**
 * Whitelist check: is `expr` a writable lvalue per Phase 07.3 D-03?
 *
 * @param expr - Babel Expression node (parsed RHS of `r-model:propName=`)
 * @param ir   - The consumer's lowered IRComponent (used to validate that
 *               `$data.x` head + `$props.x` head are declared, and that
 *               `$props.x` carries `model: true` when used as a forwarder)
 * @returns true iff `expr` is acceptable as the RHS of `r-model:propName=`
 */
export function isWritableLValue(
  expr: t.Expression,
  ir: IRComponent,
): boolean {
  // Defensive: a null/undefined Expression is never a writable lvalue.
  if (!expr || typeof expr !== 'object') return false;

  // Member-expression rooted in a magic accessor — the only accepted shape.
  if (t.isMemberExpression(expr) || t.isOptionalMemberExpression(expr)) {
    const head = getLeftmostIdentifierName(expr);
    if (head === null) return false;

    if (head.rootName === '$data') {
      // $data.x — x must be declared in the consumer's <data> block.
      // Deep chains ($data.x.y.z) are accepted as long as x is declared.
      if (head.firstMemberName === null) return false;
      return ir.state.some((s) => s.name === head.firstMemberName);
    }

    if (head.rootName === '$props') {
      // $props.x — x must be a declared prop AND carry model: true.
      // Deep chains ($props.x.y) inherit the model: true gate at the head.
      if (head.firstMemberName === null) return false;
      const prop = ir.props.find((p) => p.name === head.firstMemberName);
      return prop !== undefined && prop.isModel === true;
    }

    // $refs.x, $slots.x, $el — none are writable lvalues.
    return false;
  }

  // Bare identifiers (e.g. `isOpen` referencing a $computed ref or a local
  // helper) are NOT lvalues per D-03 — even when the identifier happens to
  // resolve to a $computed in <script>, computed values are read-only. The
  // user must either rebind to $data or expose a setter through their own
  // <props> with model: true.
  //
  // Literals, ternaries, calls, logical/binary expressions, etc. fall
  // through to the final return.
  return false;
}
