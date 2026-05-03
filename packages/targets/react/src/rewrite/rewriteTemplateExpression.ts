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
 *   - `$slots.foo` (boolean ctx) → `props.renderFoo` (caller may layer `!!` for booleans)
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

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function flattenInlineCode(code: string): string {
  return code.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function capitalize(name: string): string {
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

  traverse(wrapper, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
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
        // $slots.foo → props.renderFoo (caller layers `!!` for boolean ctx)
        path.node.object = t.identifier('props');
        path.node.property = t.identifier('render' + capitalize(prop.name));
        return;
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
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
    ? generate(cloned, GEN_OPTS).code
    : generate(stmt.expression, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
