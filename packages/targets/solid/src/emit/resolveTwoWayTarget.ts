/**
 * resolveTwoWayTarget — Solid target (Phase 07.3 Plan 07.3-07 / TWO-WAY-03).
 *
 * Resolves the RHS Expression of a consumer-side `r-model:propName=` binding
 * into the Solid `{ local, setter }` JSX-name pair that the emit branch
 * stitches into the attribute-pair shape:
 *
 *   `${propName}={${local}()} on${Capitalize(propName)}Change={${setter}}`
 *
 * Crucial Solid vs React difference: the returned `local` is the Accessor
 * IDENTIFIER (no trailing `()`); the emit branch applies the invocation
 * `local()`. The setter is the Setter identifier (NEVER invoked).
 *
 * Three accepted cases (Phase 07.3 D-03 permissive LHS rule — see
 * packages/core/src/semantic/lvalue.ts):
 *
 *   1. `$data.X`         → { local: 'X', setter: 'setX' }
 *        Solid emits `const [X, setX] = createSignal(...)` from each
 *        <data> entry (emitScript.ts:152-158); the consumer-side
 *        binding reuses that pair directly.
 *
 *   2. `$data.X.Y.Z`     → { local: 'X', setter: 'setX' }
 *        Deep chains reuse the ROOT's Accessor/Setter pair — Solid's
 *        createSignal pair is at the top level only. Setting the deep
 *        member happens by reading via `X()` and then re-setting via
 *        `setX({ ...X(), Y: { ...X().Y, Z: $event } })`. The simple
 *        attribute-pair shape here forwards just the root identifiers
 *        — the wrapping component is responsible for the deep-write
 *        idiom. (PATTERNS §Solid lines 582-597.)
 *
 *   3. `$props.X` (X has model: true on consumer's <props>)
 *                       → { local: 'X', setter: 'setX' }
 *        The forwarding pattern (WrapperModal). Solid hoists
 *        `model: true` props into a controllable-signal pair via
 *        `const [X, setX] = createControllableSignal(_props, 'X', ...)`
 *        (emitScript.ts:126-149). The pair has the SAME shape as the
 *        $data case — `X` Accessor + `setX` Setter — because the
 *        controllable-signal setter internally fires the
 *        `_props.onXChange?.(v)` callback. So the inner-child binding
 *        forwards into the controllable pair, NOT into `local.X` /
 *        `local.onXChange`. Verified against emitRModel.ts:60-62.
 *
 * Returns null when the expression doesn't match any accepted shape;
 * the caller (emitTemplateAttribute) emits diagnostics via the
 * upstream validator (ROZ951) and falls back to a no-op shape. In
 * practice an invalid LHS would already have been rejected at
 * lower-time, so reaching the null branch here is a defensive guard.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Walk a member-expression chain to find the leftmost object identifier and
 * the first property segment. Mirrors the helper in core/src/semantic/lvalue.ts
 * but returns just the two names we need (no IR cross-checking — that's the
 * validator's job).
 */
function getMemberRoot(
  expr: t.Expression,
): { rootName: string; firstMemberName: string | null } | null {
  let current: t.Expression = expr;
  let firstMemberName: string | null = null;
  while (
    t.isMemberExpression(current) ||
    t.isOptionalMemberExpression(current)
  ) {
    if (current.computed) return null;
    if (!t.isIdentifier(current.property)) return null;
    firstMemberName = current.property.name;
    current = current.object;
  }
  if (!t.isIdentifier(current)) return null;
  return { rootName: current.name, firstMemberName };
}

/**
 * Resolve a writable lvalue expression to its Solid Accessor + Setter names.
 *
 * @param expr - RHS Expression from the `twoWayBinding` AttributeBinding
 * @param ir   - Consumer's lowered IRComponent (validates that head identifier
 *               is declared in <data> / <props>, and that $props.X is model:true)
 * @returns { local, setter } pair when expr is a valid writable lvalue;
 *          null when expr doesn't match an accepted shape. Both names are
 *          bare identifiers (no `()` invocation); the emit branch is
 *          responsible for adding `()` to `local` when stitching the
 *          attribute-pair string.
 */
export function resolveTwoWayTarget(
  expr: t.Expression,
  ir: IRComponent,
): { local: string; setter: string } | null {
  if (!expr || typeof expr !== 'object') return null;
  if (!t.isMemberExpression(expr) && !t.isOptionalMemberExpression(expr)) {
    return null;
  }

  const head = getMemberRoot(expr);
  if (head === null) return null;
  if (head.firstMemberName === null) return null;

  if (head.rootName === '$data') {
    // $data.X (and deeper $data.X.Y.Z) → reuse the X / setX createSignal pair.
    const stateDecl = ir.state.find((s) => s.name === head.firstMemberName);
    if (!stateDecl) return null;
    return {
      local: head.firstMemberName,
      setter: 'set' + capitalize(head.firstMemberName),
    };
  }

  if (head.rootName === '$props') {
    // $props.X — only valid when X is a declared prop with model: true.
    // The forwarding pattern reuses the createControllableSignal pair which
    // is named with the SAME { X, setX } shape as the $data case
    // (emitScript.ts:126-149, emitRModel.ts:60-62).
    const prop = ir.props.find((p) => p.name === head.firstMemberName);
    if (!prop || prop.isModel !== true) return null;
    return {
      local: head.firstMemberName,
      setter: 'set' + capitalize(head.firstMemberName),
    };
  }

  // $refs.X, $slots.X, $el etc. are not writable lvalues for r-model.
  return null;
}
