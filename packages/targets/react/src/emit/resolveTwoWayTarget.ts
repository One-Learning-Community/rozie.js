/**
 * resolveTwoWayTarget — Phase 07.3 Plan 07.3-06 (React target).
 *
 * Resolves the writable LHS of a consumer-side `r-model:propName="expr"`
 * directive (IR variant `kind: 'twoWayBinding'`) to the pair of JSX-name
 * strings used inside the React attribute-pair emit shape:
 *
 *     `${attr.name}={${local}} on${capitalize(attr.name)}Change={${setter}}`
 *
 * Three cases per D-01 / RESEARCH §"Per-Target Consumer Two-Way Idiom — React":
 *
 *   1. `$data.X` — useState-backed top-level state on the consumer.
 *      → local = X         (the useState getter local)
 *        setter = setX     (the useState setter, per emitRModel.ts naming convention)
 *
 *   2. `$data.X.Y.Z` — deep member chain rooted in $data.X (D-03 permissive).
 *      → local = rewritten chain (e.g. `state.x.y.z` style; v1 fallback emits the
 *        rewritten expression text)
 *        setter = inline arrow `(v) => { <local> = v; }` so the deep-chain target
 *        is assigned in place. (Rare; producer-side useControllableState pattern
 *        does not natively express this — callers typically restructure to a flat
 *        `$data.X` for clarity.)
 *
 *   3. `$props.X` (X has model:true) — forwarding pattern (D-03 permissive).
 *      → local = X                 (the destructured prop received by the consumer)
 *        setter = onXChange         (the upstream `on<Capitalize(X)>Change` callback
 *        from the consumer's own props interface — synthesised by emitPropsInterface
 *        for model:true props)
 *
 * The validator (`validateTwoWayBindings`, Wave 2) already rejects non-writable
 * LHS via `isWritableLValue` before this helper is reached, so the precondition
 * is "expr is a writable lvalue per D-03". This helper trusts that contract and
 * does NOT re-validate.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';

// CJS interop normalization (mirrors emitTemplateAttribute.ts / emitRModel.ts).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function flattenInlineCode(code: string): string {
  return code.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/**
 * Capitalize first letter — mirrors emitRModel.ts:44 + emitPropsInterface.ts:68
 * so the consumer-side setter naming convention can never drift from the
 * producer-side props-interface synthesis convention.
 */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Walk a MemberExpression chain (NON-computed) inward to its leftmost object.
 * Returns the leftmost Identifier or null if the chain isn't pure dotted access.
 */
function leftmostIdentifier(expr: t.Expression): t.Identifier | null {
  let cur: t.Expression = expr;
  while (t.isMemberExpression(cur)) {
    if (cur.computed) return null;
    if (!t.isIdentifier(cur.property)) return null;
    cur = cur.object as t.Expression;
  }
  return t.isIdentifier(cur) ? cur : null;
}

/**
 * Render an expression as inline JSX-embeddable source text.
 */
function renderInline(expr: t.Expression): string {
  return flattenInlineCode(generate(expr, GEN_OPTS).code);
}

/**
 * Resolve the writable LHS of an `r-model:propName=` directive to the
 * `{ local, setter }` pair the React emit branch embeds in its JSX
 * attribute-pair output.
 *
 * Preconditions (enforced upstream by the IR-time validator):
 *   - `expr` is a writable lvalue per D-03 (`isWritableLValue` returned true).
 *
 * Postconditions:
 *   - `local` is a JSX-expression-safe string (no leading `$`).
 *   - `setter` is a JSX-expression-safe string (identifier OR arrow function).
 */
export function resolveTwoWayTarget(
  expr: t.Expression,
  ir: IRComponent,
): { local: string; setter: string } {
  // Case 1: shallow `$data.X` or `$props.X` (model:true).
  if (
    t.isMemberExpression(expr) &&
    !expr.computed &&
    t.isIdentifier(expr.object) &&
    t.isIdentifier(expr.property)
  ) {
    const obj = expr.object.name;
    const prop = expr.property.name;

    if (obj === '$data') {
      // useState-backed local — convention: getter = name, setter = set<Cap>name.
      // Validator guaranteed prop is in ir.state.
      return { local: prop, setter: `set${capitalize(prop)}` };
    }

    if (obj === '$props') {
      // Forwarding pattern — consumer's own prop is model:true, so its
      // props interface exposes the `on<Cap>Change` callback (synthesised by
      // emitPropsInterface.ts:92). Local is the destructured prop.
      return { local: prop, setter: `on${capitalize(prop)}Change` };
    }
  }

  // Case 2: deep chain `$data.X.Y.Z` (D-03 permissive — rooted in $data).
  // The validator already accepted this; v1 fallback emits the rewritten
  // member-chain text as local and an inline reassignment arrow as setter.
  if (t.isMemberExpression(expr) && t.isMemberExpression(expr.object)) {
    const root = leftmostIdentifier(expr);
    if (root && root.name === '$data') {
      // Strip the leading `$data.` to get the consumer-local member-chain text.
      // e.g. `$data.foo.bar.baz` → `foo.bar.baz`.
      const fullText = renderInline(expr);
      const local = fullText.replace(/^\$data\./, '');
      // Inline assignment arrow — v1 fallback. Rare enough that consumers are
      // expected to flatten to top-level `$data.X` for clarity.
      const setter = `(v) => { ${local} = v; }`;
      return { local, setter };
    }
  }

  // Defensive — should never reach this branch because the IR-time validator
  // would have emitted ROZ951 for any non-writable LHS. Keep the throw so a
  // regression in the validator surfaces immediately rather than silently
  // producing malformed JSX.
  throw new Error(
    `resolveTwoWayTarget: unexpected non-writable LHS reached the React emitter — validator should have caught this with ROZ951.`,
  );
}
