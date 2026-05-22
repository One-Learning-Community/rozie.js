/**
 * rewriteTemplateExpression — Plan 04-03 Task 1 (React target).
 *
 * Renders a Babel Expression for use inside JSX (template @event handler,
 * :prop binding, or {{ }} interpolation). Mirrors Vue's
 * rewriteTemplateExpression but with React-side identifier shapes.
 *
 * Mappings:
 *   - `$props.value` (model)     → `value`        (bare; useControllableState local)
 *   - `$props.step`  (non-model) → `props.step`
 *   - `$data.foo`                → `foo`          (bare; useState local)
 *   - `$refs.foo`                → `foo.current`
 *   - `$slots.foo` (boolean ctx) → `(props.renderFoo ?? props.slots?.['foo'])` (Phase 07.3.2 Plan 08 — merge guard with dynamic-name fallback)
 *   - `$emit('foo', x)` call     → `props.onFoo?.(x)` (camelCase + on-prefix + optional-chain)
 *
 * Inputs are deep-cloned BEFORE traversal so the IR's referential preservation
 * (IR-04) is never violated.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

// Phase 07.3.2 Plan 08 — jsescOption: { quotes: 'single' } so that newly
// synthesised string literals (e.g., the `'foo'` key inside
// `props.slots?.['foo']` from the $slots.X merge rewrite at L151+) match the
// single-quote style emitSlotInvocation.ts already uses at its hand-built
// fieldRef (emitSlotInvocation.ts:230-231). Keeping both producers in the
// same quote style means the dist-parity Modal.tsx fixture is internally
// consistent at both the GUARD site and the INVOCATION site.
const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  jsescOption: { quotes: 'single' },
};

function flattenInlineCode(code: string): string {
  return code.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function capitalize(name: string): string {
  /* v8 ignore next -- defensive: state/model-prop names are never empty (parser rejects empty identifiers) */
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function toReactEventPropName(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return 'on';
  const camel = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return 'on' + camel;
}

/**
 * Render a Babel Expression as a JSX-context string.
 * IR is consulted for prop/data/ref/computed/slot name lookups.
 */
export function rewriteTemplateExpression(
  expr: t.Expression,
  ir: IRComponent,
): string {
  const cloned = t.cloneNode(expr, true, false);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => s.name));

  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  // Map of compound-assignment operator → matching binary operator.
  const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
    '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '**=': '**',
    '<<=': '<<', '>>=': '>>', '>>>=': '>>>', '&=': '&', '|=': '|', '^=': '^',
  };

  function buildSetterCall(
    stateName: string,
    operator: string,
    rhs: t.Expression,
  ): t.CallExpression {
    const setterName = 'set' + capitalize(stateName);
    if (operator === '=') {
      return t.callExpression(t.identifier(setterName), [rhs]);
    }
    const binOp = COMPOUND_OP_MAP[operator];
    /* v8 ignore next -- defensive: COMPOUND_OP_MAP covers every compound operator @babel/parser produces */
    if (!binOp) return t.callExpression(t.identifier(setterName), [rhs]);
    const arrow = t.arrowFunctionExpression(
      [t.identifier('prev')],
      t.binaryExpression(binOp, t.identifier('prev'), rhs),
    );
    return t.callExpression(t.identifier(setterName), [arrow]);
  }

  traverse(wrapper, {
    // Phase 14 D-04 — the `$attrs` magic accessor lowers to the bare `attrs`
    // identifier. The spread emitter has ALREADY decided this is a `$attrs`
    // case BEFORE calling rewrite (so it skips the `normalizeAttrs` wrap);
    // this visitor is what turns `{...$attrs}` into the lowered `{...attrs}`.
    // `attrs` is the synthesised binding the per-target shell will introduce
    // when synthesis is un-gated in Plan 14-05. Until then this rewrite is
    // observable only via manual `r-bind="$attrs"` fixtures (synthesis off).
    Identifier(path) {
      if (path.node.name !== '$attrs') return;
      // Skip the LHS of a MemberExpression / OptionalMemberExpression (those
      // are handled by their own visitors when applicable). Skip property keys
      // on object literals (`{ $attrs: x }` is not a magic reference).
      const parent = path.parent;
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node
      ) {
        return;
      }
      if (t.isObjectProperty(parent) && parent.key === path.node && !parent.computed) {
        return;
      }
      path.replaceWith(t.identifier('attrs'));
      path.skip();
    },

    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;
      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop) || left.computed) return;

      if (obj.name === '$data' && dataNames.has(prop.name)) {
        const setterCall = buildSetterCall(prop.name, node.operator, node.right);
        path.replaceWith(setterCall);
        return;
      }
      if (obj.name === '$props' && modelProps.has(prop.name)) {
        const setterCall = buildSetterCall(prop.name, node.operator, node.right);
        path.replaceWith(setterCall);
        return;
      }
    },

    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      /* v8 ignore next -- defensive: a non-computed MemberExpression always has an Identifier property */
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          path.replaceWith(t.identifier(prop.name));
          path.skip();
          return;
        }
        if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.foo → foo.current
        path.node.object = t.identifier(prop.name);
        path.node.property = t.identifier('current');
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // Phase 07.3.2 Plan 08 (F-07.3.2-05-A) — $slots.foo lowers to the
        // MERGED dynamic-fallback shape:
        //   (props.renderFoo ?? props.slots?.['foo'])
        // so r-if guards (and any other truthy check on $slots.foo) evaluate
        // truthy when ONLY a dynamic-name slot fill is present (the consumer
        // passed `slots={{ [slotName]: () => ... }}` with no static-name fill).
        //
        // This mirrors the canonical merge shape Plan 01 already emits at the
        // slot INVOCATION site (emitSlotInvocation.ts:231). The two layers
        // (guard + invocation) MUST agree — before this plan, the rewriter
        // produced a bare `props.renderFoo` and the Modal 2 dynamic-fill cell
        // in tests/visual-regression/specs/modal-consumer-close.spec.ts failed
        // because `(undefined || undefined)` short-circuited the <header> guard.
        const renderName = 'render' + capitalize(prop.name);
        const fieldKey = prop.name;
        const merged = t.parenthesizedExpression(
          t.logicalExpression(
            '??',
            t.memberExpression(t.identifier('props'), t.identifier(renderName)),
            t.optionalMemberExpression(
              t.memberExpression(t.identifier('props'), t.identifier('slots')),
              t.stringLiteral(fieldKey),
              true, // computed (bracket-access)
              true, // optional (?.)
            ),
          ),
        );
        path.replaceWith(merged);
        path.skip();
        return;
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      /* v8 ignore next -- defensive: a non-computed OptionalMemberExpression always has an Identifier property */
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          path.replaceWith(t.identifier(prop.name));
          path.skip();
          return;
        }
        if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.node.object = t.identifier(prop.name);
        path.node.property = t.identifier('current');
        return;
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $classSelector('grip') → "." + styles.grip — same lowering as the
      // <script> path (rewriteScript.ts); both hooks call the SAME shared
      // helper so they cannot drift (Pitfall 4). Handled BEFORE the $emit-only
      // early-return so a :attr-position $classSelector is rewritten.
      if (callee.name === '$classSelector') {
        lowerClassSelectorCall(path);
        return;
      }

      if (callee.name !== '$emit') return;

      const args = path.node.arguments;
      if (args.length === 0) return;
      const firstArg = args[0]!;
      if (!t.isStringLiteral(firstArg)) return;

      const eventName = firstArg.value;
      const propName = toReactEventPropName(eventName);
      const restArgs = args
        .slice(1)
        .filter((a) => !t.isJSXNamespacedName(a)) as Array<
        t.Expression | t.SpreadElement | t.ArgumentPlaceholder
      >;
      const replacement = t.optionalCallExpression(
        t.memberExpression(t.identifier('props'), t.identifier(propName)),
        restArgs,
        true,
      );
      path.replaceWith(replacement);
    },
  });

  const stmt = wrapper.program.body[0]!;
  const raw = !t.isExpressionStatement(stmt)
    ? /* v8 ignore next -- defensive: the wrapper is built from a single ExpressionStatement, so this arm is unreachable */
      generate(cloned, GEN_OPTS).code
    : generate(stmt.expression, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
