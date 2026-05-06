/**
 * rewriteListenerExpression — Phase 5 Plan 05-04a Task 3.
 *
 * Renders a Babel Expression for inlining inside an Angular constructor-body
 * `effect((onCleanup) => { ... })` block. Listener handler/when expressions
 * run in the constructor's `this`-bound context, so `this.X()` is the correct
 * shape (mirrors rewriteScript output) — NOT bare `X()` like template
 * expressions.
 *
 * Used by emitListeners to rewrite a listener's `handler` and `when`
 * expressions — both run in script context inside the synthesized
 * effect-callback.
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

export interface RewriteListenerOpts {
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  /**
   * Class members from rewriteScript (includes user method names like
   * `toggle`, `close`, `reposition`). Bare identifier references to these
   * get `this.` prefix.
   */
  classMembers?: ReadonlySet<string> | undefined;
  /**
   * Subset of classMembers that are signal-typed — bare identifier reads need
   * a `()` invocation suffix.
   */
  signalMembers?: ReadonlySet<string> | undefined;
}

/**
 * Rewrite for listener-context (constructor effect body):
 *   - $props.X (model)     → this.X()
 *   - $props.X (non-model) → this.X()
 *   - $data.X              → this.X()
 *   - $refs.X              → this.X()?.nativeElement
 *   - $slots.X             → this.XTpl
 *   - $emit('X', y)        → this.X.emit(y)
 *   - bare class member    → this.member  (with `()` if signal-typed)
 *
 * Loop-locals don't apply here (listeners run in component context, not loop).
 */
export function rewriteListenerExpression(
  expr: t.Expression,
  ir: IRComponent,
  opts: RewriteListenerOpts = {},
): string {
  const cloned = t.cloneNode(expr, true, false);
  const collisionRenames = opts.collisionRenames ?? new Map<string, string>();

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? '' : s.name)));
  const emits = new Set(ir.emits);

  // signalIdentifiers: bare ID -> needs `()` invocation when read.
  const signalIdentifiers = opts.signalMembers ?? new Set<string>([
    ...modelProps,
    ...nonModelProps,
    ...dataNames,
    ...refNames,
    ...computedNames,
  ]);

  // All class members for `this.` prefix. Includes user method names if
  // provided (otherwise just signals + emits + slot fields).
  const classMembers = opts.classMembers ?? new Set<string>([
    ...signalIdentifiers,
    ...emits,
    ...slotNames,
  ]);

  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  traverse(wrapper, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          path.replaceWith(
            t.callExpression(
              t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
              [],
            ),
          );
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
            [],
          ),
        );
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(
          t.optionalMemberExpression(
            t.callExpression(
              t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
              [],
            ),
            t.identifier('nativeElement'),
            false,
            true,
          ),
        );
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        const tplName =
          prop.name === '' ? 'defaultTpl' : `${prop.name}Tpl`;
        path.replaceWith(
          t.memberExpression(t.thisExpression(), t.identifier(tplName)),
        );
        path.skip();
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
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          path.replaceWith(
            t.callExpression(
              t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
              [],
            ),
          );
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
            [],
          ),
        );
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(
          t.optionalMemberExpression(
            t.callExpression(
              t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
              [],
            ),
            t.identifier('nativeElement'),
            false,
            true,
          ),
        );
        path.skip();
        return;
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || callee.name !== '$emit') return;
      const args = path.node.arguments;
      if (args.length === 0) return;
      const first = args[0];
      if (!t.isStringLiteral(first)) return;
      const eventName = first.value;
      const rest = args.slice(1);
      const replacement = t.callExpression(
        t.memberExpression(
          t.memberExpression(t.thisExpression(), t.identifier(eventName)),
          t.identifier('emit'),
        ),
        rest as Array<t.Expression | t.SpreadElement | t.ArgumentPlaceholder>,
      );
      path.replaceWith(replacement);
    },

    /**
     * Bare identifier rewrite: refer to class members via `this.X` (and
     * auto-call signals).
     */
    Identifier(path) {
      const name = path.node.name;
      const parent = path.parent;

      // Skip property positions and key positions.
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node &&
        !parent.computed
      ) {
        return;
      }
      if (
        (t.isObjectProperty(parent) || t.isObjectMethod(parent)) &&
        parent.key === path.node &&
        !parent.computed
      ) {
        return;
      }
      // Skip param/declarator id positions.
      if (
        (t.isFunctionDeclaration(parent) || t.isFunctionExpression(parent)) &&
        parent.id === path.node
      ) {
        return;
      }
      if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
      if (
        (t.isArrowFunctionExpression(parent) ||
          t.isFunctionExpression(parent) ||
          t.isFunctionDeclaration(parent)) &&
        parent.params.includes(path.node)
      ) {
        return;
      }
      // Skip Rozie magic ids.
      if (
        name === '$props' || name === '$data' || name === '$refs' ||
        name === '$slots' || name === '$emit' || name === '$onMount' ||
        name === '$onUnmount' || name === '$onUpdate'
      ) {
        return;
      }

      // Apply collision rename + check class membership.
      const renamedName = collisionRenames.get(name) ?? name;
      if (!classMembers.has(renamedName) && !collisionRenames.has(name)) {
        return;
      }

      const isCallee =
        (t.isCallExpression(parent) || t.isOptionalCallExpression(parent)) &&
        parent.callee === path.node;
      const isAssignLeft =
        t.isAssignmentExpression(parent) && parent.left === path.node;

      if (isAssignLeft && signalIdentifiers.has(name)) {
        // Don't rewrite — defer signal LHS handling.
        return;
      }

      const memberExpr = t.memberExpression(
        t.thisExpression(),
        t.identifier(renamedName),
      );

      if (isCallee || !signalIdentifiers.has(name)) {
        path.replaceWith(memberExpr);
        return;
      }

      // Signal in read position.
      path.replaceWith(t.callExpression(memberExpr, []));
    },
  });

  const stmt = wrapper.program.body[0]!;
  const rewrittenExpr = !t.isExpressionStatement(stmt) ? cloned : stmt.expression;
  const raw = generate(rewrittenExpr, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
