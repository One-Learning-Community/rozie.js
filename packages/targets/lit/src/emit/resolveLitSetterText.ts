/**
 * resolveLitSetterText — Lit consumer-side two-way binding LHS resolver.
 *
 * Phase 07.3 Plan 07.3-08 (TWO-WAY-03). Given a writable LHS expression
 * authored as `$data.X` / `$data.X.Y.Z` / `$props.X` (model:true forwarding),
 * returns the corresponding **assignment-target text** for emission inside
 * a Lit html`` template-fragment listener body, e.g.:
 *
 *   `$data.open1`         → `this._open1.value`     (preact-signals signal setter idiom)
 *   `$data.user.name`     → `this._user.value.name` (deep chain — root must still be a signal)
 *   `$props.open`         → `this.open`             (Lit @property setter — invokes the controllable's write)
 *
 * Lvalue admissibility is the responsibility of the IR-time validator
 * (validateTwoWayBindings, ROZ951). This helper assumes the expression
 * already passed validation — it only handles the **rewrite** to setter-text.
 *
 * Co-located with `kebabize()` because both helpers are needed by the
 * twoWayBinding emit branch in emitTemplateAttribute.ts and have no other
 * consumers in the Lit target. (toKebabCase from emitDecorator.ts is the
 * existing producer-side analog; we duplicate-but-name-distinct here so the
 * consumer-side helper can be co-located with its sole call site.)
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: true };

/**
 * Convert camelCase → kebab-case.
 *
 *   `open`           → `open`
 *   `closeOnEscape`  → `close-on-escape`
 *   `aBC`            → `a-bc`        (see byte-equal-contract note below)
 *   `foo-bar`        → `foo-bar`     (idempotent on already-kebab input)
 *
 * **Byte-equal contract with producer side.** Consumer's `@<eventName>` MUST
 * match producer's `dispatchEvent(new CustomEvent('<eventName>', ...))`
 * byte-for-byte or the listener never fires. The producer emits its event
 * name via `toKebabCase` (packages/targets/lit/src/emit/emitDecorator.ts:15;
 * referenced from emitScript.ts:172 as the `eventName` argument to
 * `createLitControllableProperty`). To preserve byte parity, this helper
 * delegates to the EXACT same algorithm — re-exported for emit-call-site
 * clarity. This means `aBC → a-bc` (producer behavior), NOT `a-b-c` (which
 * the PLAN.md draft initially specified as the naive `/[A-Z]/g` rewrite).
 * Diverging from the producer would silently break two-way binding for any
 * prop name containing adjacent capitals (rare in practice — props are
 * canonically lowerCamelCase — but the byte-contract still wins on principle).
 *
 * Re-export name `kebabize` is intentional: it makes the consumer-side call
 * sites read as "kebabize this prop name for an event name" without leaking
 * the producer-side `toKebabCase` (which is also used for tag names — a
 * different domain).
 */
export { toKebabCase as kebabize } from './emitDecorator.js';

/**
 * Resolve a writable LHS expression to its Lit setter-text.
 *
 * @param expr Parsed Babel Expression — must be `$data.X`, `$data.X.Y.Z`,
 *             or `$props.X` (caller responsibility: model:true validated).
 * @param ir   Component IR — used to decide which dollar-prefix maps to
 *             which `this.`-rooted form.
 *
 * @returns Setter-target text. NOT prefixed with `=` — the caller composes
 *          `${setterText} = e.detail;`.
 *
 * Examples:
 *   resolveLitSetterText(parseExpression('$data.open1'), ir)  → 'this._open1.value'
 *   resolveLitSetterText(parseExpression('$props.open'), ir)  → 'this.open'
 *   resolveLitSetterText(parseExpression('$data.user.name'), ir)
 *     → 'this._user.value.name'  (root user is a signal; .name is a deep read)
 */
export function resolveLitSetterText(
  expr: t.Expression,
  ir: IRComponent,
): string {
  // Walk to the root of a member-access chain. We need to know whether the
  // root is `$data.X` or `$props.X` to pick the correct setter form.
  // chain = the literal expression we'll emit, but with the root rewritten.
  const dataNames = new Set(ir.state.map((s) => s.name));
  const modelProps = new Set(
    ir.props.filter((p) => p.isModel).map((p) => p.name),
  );

  // Case 1: $data.X (top-level signal access — most common case).
  //   Output: `this._X.value`
  if (
    t.isMemberExpression(expr) &&
    t.isIdentifier(expr.object) &&
    expr.object.name === '$data' &&
    t.isIdentifier(expr.property) &&
    !expr.computed
  ) {
    const xName = expr.property.name;
    if (dataNames.has(xName)) {
      return `this._${xName}.value`;
    }
    // Unknown data name — fall through to the generic walker below so the
    // emit still produces a debuggable string. The IR-time validator
    // (ROZ951) is the primary gate against unknown names.
  }

  // Case 2: $props.X (forwarding — model:true on consumer's own prop).
  //   Output: `this.X` (Lit @property setter — invokes the controllable's write)
  if (
    t.isMemberExpression(expr) &&
    t.isIdentifier(expr.object) &&
    expr.object.name === '$props' &&
    t.isIdentifier(expr.property) &&
    !expr.computed
  ) {
    const xName = expr.property.name;
    if (modelProps.has(xName)) {
      return `this.${xName}`;
    }
    // Non-model prop — should have been caught by ROZ951. Emit a defensive
    // form anyway.
    return `this.${xName}`;
  }

  // Case 3: $data.X.Y.Z deep chain. Walk to the root, rewrite ONLY the root
  // segment, then re-generate. We clone so we don't mutate the IR.
  //
  // Strategy: traverse parent-most MemberExpression down to its root. If the
  // root is `$data.X` (X in dataNames), rewrite to `this._X.value` and keep
  // the rest of the chain intact.
  if (t.isMemberExpression(expr)) {
    const cloned = t.cloneNode(expr, true, false);
    let cursor: t.Expression = cloned;
    // Find the deepest object that is a MemberExpression — its `object`
    // becomes the root.
    while (
      t.isMemberExpression(cursor) &&
      t.isMemberExpression(cursor.object)
    ) {
      cursor = cursor.object;
    }
    // cursor is now the innermost MemberExpression — its `.object` is the
    // root Identifier (e.g., `$data`).
    if (t.isMemberExpression(cursor) && t.isIdentifier(cursor.object)) {
      const root = cursor.object;
      const rootProp = cursor.property;
      if (
        root.name === '$data' &&
        t.isIdentifier(rootProp) &&
        !cursor.computed &&
        dataNames.has(rootProp.name)
      ) {
        // Rewrite: `$data.X` (the innermost ME) → `this._X.value`
        const rewritten = t.memberExpression(
          t.memberExpression(
            t.thisExpression(),
            t.identifier(`_${rootProp.name}`),
          ),
          t.identifier('value'),
        );
        // Replace cursor.object + cursor.property with rewritten by mutating
        // the parent. But cursor IS the innermost ME — if expr === cursor we
        // already handled it above. Here expr is the OUTER chain.
        // We need: clone outer chain, then walk it parallelly to find the
        // innermost ME and swap its identity for `rewritten`.
        // Simpler: re-derive the chain by collecting property segments from
        // outermost inward.
        const segments: Array<{ prop: t.Identifier; computed: boolean }> = [];
        let walker: t.Expression = expr;
        while (
          t.isMemberExpression(walker) &&
          t.isMemberExpression(walker.object)
        ) {
          if (!t.isIdentifier(walker.property) || walker.computed) {
            // Computed/bracket access — bail to generic generate-as-is fallback.
            return generate(expr, GEN_OPTS).code;
          }
          segments.unshift({ prop: walker.property, computed: false });
          walker = walker.object;
        }
        // walker is now the innermost ME; it has been validated above.
        // Build out the chain on top of `rewritten`.
        let acc: t.Expression = rewritten;
        for (const seg of segments) {
          acc = t.memberExpression(acc, seg.prop, seg.computed);
        }
        return generate(acc, GEN_OPTS).code;
      }
    }
  }

  // Fallback — emit the expression verbatim. The validator is responsible
  // for rejecting non-writable LHS; this is a defensive last resort that
  // produces *something* debuggable rather than throwing at emit time.
  return generate(expr, GEN_OPTS).code;
}
