/**
 * rewriteTemplateExpression — Solid target (P2 complete implementation).
 *
 * Renders a Babel Expression for use inside JSX (template @event handler,
 * :prop binding, or {{ }} interpolation). Mirrors the React target's
 * rewriteTemplateExpression but with Solid-specific identifier shapes.
 *
 * Mappings (Solid-specific):
 *   - `$props.value` (model)     → `local.value`   (via splitProps; createControllableSignal call)
 *   - `$props.step`  (non-model) → `local.step`    (via splitProps local)
 *   - `$data.foo`                → `foo()`          (signal getter — D-131)
 *   - `$data.foo = v`            → `setFoo(v)`      (signal setter)
 *   - `$refs.foo`                → `fooRef`         (plain variable; ref={(el) => { fooRef = el; }})
 *   - `$slots.foo`               → `_props.fooSlot !== undefined` (presence check)
 *   - `$emit('foo', x)` call     → `_props.onFoo?.(x)` (camelCase + on-prefix + optional-chain)
 *
 * NOTE: Signal reads (data + model props) need () calls in JSX — Solid reactivity.
 * The createControllableSignal accessor for model props IS a signal; call as name().
 *
 * Inputs are deep-cloned BEFORE traversal so the IR's referential preservation
 * is never violated.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';

// CJS interop normalization.
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

function toSolidEventPropName(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return 'on';
  const camel = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return 'on' + camel;
}

/** Map of compound-assignment operator → matching binary operator. */
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
  if (!binOp) return t.callExpression(t.identifier(setterName), [rhs]);
  // Functional updater for compound: setX(prev => prev + rhs)
  const arrow = t.arrowFunctionExpression(
    [t.identifier('prev')],
    t.binaryExpression(binOp, t.identifier('prev'), rhs),
  );
  return t.callExpression(t.identifier(setterName), [arrow]);
}

/**
 * Render a Babel Expression as a JSX-context string for Solid.
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
      if (obj.name === '$props' && (modelProps.has(prop.name) || nonModelProps.has(prop.name))) {
        // Model prop write → setter call; non-model prop write is a bug but emit setter for best-effort
        if (modelProps.has(prop.name)) {
          const setterCall = buildSetterCall(prop.name, node.operator, node.right);
          path.replaceWith(setterCall);
        }
        return;
      }
    },

    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        // All props (model + non-model) go through local (splitProps result).
        // Model props are signals: local.value is an Accessor, call as local.value()
        // But since local already holds the splitProps local, just use local.name
        if (modelProps.has(prop.name)) {
          // createControllableSignal returns [Accessor<T>, Setter<T>]
          // In template expressions, we call the accessor: value()
          // Replace $props.value with a call expression: value()
          path.replaceWith(
            t.callExpression(t.identifier(prop.name), []),
          );
          path.skip();
          return;
        }
        if (nonModelProps.has(prop.name)) {
          // Non-model: local.propName
          path.node.object = t.identifier('local');
          return;
        }
        // Unknown prop — use local fallback
        path.node.object = t.identifier('local');
        return;
      }

      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // Signal getter: foo()
        path.replaceWith(
          t.callExpression(t.identifier(prop.name), []),
        );
        path.skip();
        return;
      }

      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.foo → fooRef (plain variable, set via ref callback)
        path.replaceWith(t.identifier(prop.name + 'Ref'));
        path.skip();
        return;
      }

      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // $slots.foo → _props.fooSlot !== undefined  (caller layers presence check)
        const fieldName = prop.name === '' ? 'children' : prop.name + 'Slot';
        path.node.object = t.identifier('_props');
        path.node.property = t.identifier(fieldName);
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
          path.replaceWith(t.callExpression(t.identifier(prop.name), []));
          path.skip();
          return;
        }
        if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('local');
          return;
        }
        path.node.object = t.identifier('local');
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.callExpression(t.identifier(prop.name), []));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name + 'Ref'));
        path.skip();
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
      const propName = toSolidEventPropName(eventName);
      const restArgs = args
        .slice(1)
        .filter((a) => !t.isJSXNamespacedName(a)) as Array<
        t.Expression | t.SpreadElement | t.ArgumentPlaceholder
      >;
      const replacement = t.optionalCallExpression(
        t.memberExpression(t.identifier('_props'), t.identifier(propName)),
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
