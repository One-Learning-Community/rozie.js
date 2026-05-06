/**
 * rewriteTemplateExpression — Phase 5 Plan 05-04a Task 2 (Angular target).
 *
 * Renders a Babel Expression as an Angular-template-friendly string. Mirrors
 * rewriteRozieIdentifiers but operates on a single Expression. Same rewrites
 * as the script-side path because Angular's template surface uses `this.x()`
 * signal-call shape just like the script body — well, actually Angular
 * templates don't need `this.` prefix (templates implicitly bind to component
 * instance), so signal accessors become `x()` not `this.x()`.
 *
 *   - `$props.value`  (model)     → `value()`     (signal call, no `this.`)
 *   - `$props.step`   (non-model) → `step()`
 *   - `$data.hovering`            → `hovering()`
 *   - `$refs.dialogEl`            → `dialogEl()?.nativeElement`
 *   - `$slots.foo`                → `fooTpl` (TemplateRef ref check is `!!fooTpl`)
 *   - `$emit('foo', x)`           → `foo.emit(x)` (no `this.` prefix in template)
 *
 * EXCEPT for `@for` track-expression context: do NOT prefix loop variable
 * with anything (e.g., `track item.id` should NOT become `track this.item.id`).
 * Loop-local bindings shadow the component instance.
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

/**
 * Build `name.set(rhs)` for a plain `=`, or `name.set(name() OP rhs)` for
 * compound operators. Used when rewriting template-context AssignmentExpressions
 * targeting signal-typed members.
 */
function buildTemplateSetterCall(
  signalName: string,
  operator: string,
  rhs: t.Expression,
  compoundOpMap: Record<string, t.BinaryExpression['operator']>,
): t.CallExpression {
  const setterCallee = t.memberExpression(
    t.identifier(signalName),
    t.identifier('set'),
  );
  if (operator === '=') {
    return t.callExpression(setterCallee, [rhs]);
  }
  const binOp = compoundOpMap[operator];
  if (!binOp) {
    return t.callExpression(setterCallee, [rhs]);
  }
  const innerRead = t.callExpression(t.identifier(signalName), []);
  return t.callExpression(setterCallee, [t.binaryExpression(binOp, innerRead, rhs)]);
}

export interface RewriteTemplateOpts {
  /**
   * Names of identifiers that are loop-local bindings within this expression's
   * context (e.g., `item` in `r-for="item in items"`). Bare identifier
   * references matching these names are NOT rewritten — they shadow component
   * members.
   */
  loopBindings?: ReadonlySet<string> | undefined;
  /**
   * Collision-renames from rewriteScript (e.g., `close` → `_close`). When the
   * template references a renamed user method, rewrite the bare identifier
   * accordingly. Output fields (e.g., emit `close = output()`) keep their bare
   * names — only user methods that collided are renamed.
   */
  collisionRenames?: ReadonlyMap<string, string> | undefined;
}

/**
 * Render a Babel Expression as an Angular-template-friendly string.
 */
export function rewriteTemplateExpression(
  expr: t.Expression,
  ir: IRComponent,
  opts: RewriteTemplateOpts = {},
): string {
  const cloned = t.cloneNode(expr, true, false);
  const loopBindings = opts.loopBindings ?? new Set<string>();
  const collisionRenames = opts.collisionRenames ?? new Map<string, string>();

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? '' : s.name)));
  const computedNames = new Set(ir.computed.map((c) => c.name));

  // Bare identifier names that, when referenced in template expressions in
  // READ position (not call/lvalue), need a `()` invocation (signal-call).
  const signalIdentifiers = new Set<string>([
    ...modelProps,
    ...nonModelProps,
    ...dataNames,
    ...refNames,
    ...computedNames,
  ]);

  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
    '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '**=': '**',
    '<<=': '<<', '>>=': '>>', '>>>=': '>>>', '&=': '&', '|=': '|', '^=': '^',
  };

  traverse(wrapper, {
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;
      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj)) return;
      if (left.computed) return;
      if (!t.isIdentifier(prop)) return;

      // $data.X = Y → X.set(Y) — but template binding can also be
      // `$props.X = Y` for model:true props.
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        const setterCall = buildTemplateSetterCall(prop.name, node.operator, node.right, COMPOUND_OP_MAP);
        path.replaceWith(setterCall);
        // Skip descending into the new node — the inner Identifier `X` would
        // otherwise get wrapped to `X()` by the Identifier visitor below.
        path.skip();
        return;
      }
      if (obj.name === '$props' && modelProps.has(prop.name)) {
        const setterCall = buildTemplateSetterCall(prop.name, node.operator, node.right, COMPOUND_OP_MAP);
        path.replaceWith(setterCall);
        path.skip();
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
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          // $props.value → value()  (signal call; no `this.` prefix in templates)
          path.replaceWith(t.callExpression(t.identifier(prop.name), []));
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.callExpression(t.identifier(prop.name), []));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.foo → foo()?.nativeElement (signal call + optional chain)
        path.replaceWith(
          t.optionalMemberExpression(
            t.callExpression(t.identifier(prop.name), []),
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
          prop.name === ''
            ? 'defaultTpl'
            : `${prop.name}Tpl`;
        path.replaceWith(t.identifier(tplName));
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
          path.replaceWith(t.callExpression(t.identifier(prop.name), []));
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.callExpression(t.identifier(prop.name), []));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(
          t.optionalMemberExpression(
            t.callExpression(t.identifier(prop.name), []),
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
          prop.name === ''
            ? 'defaultTpl'
            : `${prop.name}Tpl`;
        path.replaceWith(t.identifier(tplName));
        path.skip();
        return;
      }
    },

    /**
     * `$emit('event', x)` → `event.emit(x)` (no `this.` in template context).
     */
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (callee.name !== '$emit') return;
      const args = path.node.arguments;
      if (args.length === 0) return;
      const first = args[0];
      if (!t.isStringLiteral(first)) return;
      const eventName = first.value;
      const rest = args.slice(1);
      const replacement = t.callExpression(
        t.memberExpression(t.identifier(eventName), t.identifier('emit')),
        rest as Array<t.Expression | t.SpreadElement | t.ArgumentPlaceholder>,
      );
      path.replaceWith(replacement);
    },

    /**
     * Bare-identifier rewrite for template context:
     *   - Apply collision-rename (e.g., `close` → `_close`).
     *   - Wrap signal-typed bare identifier reads in a `()` invocation
     *     (e.g., `canDecrement` → `canDecrement()`).
     *
     * Loop-local bindings are excluded — they shadow component members.
     */
    Identifier(path) {
      const name = path.node.name;
      if (loopBindings.has(name)) return;
      // Skip declaration-site identifiers and member-property positions.
      const parent = path.parent;
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

      // Apply collision rename in-place when applicable. Signals that use
      // collision-rename are unusual (output names colliding with user methods
      // — outputs aren't signals), so this rename happens BEFORE the signal-call
      // wrap check.
      let effectiveName = name;
      if (collisionRenames.has(name)) {
        effectiveName = collisionRenames.get(name)!;
        path.node.name = effectiveName;
      }

      // Signal-call wrap: bare identifier reference to a signal in READ
      // position needs a `()` invocation suffix.
      if (signalIdentifiers.has(name)) {
        const isCallee =
          (t.isCallExpression(parent) || t.isOptionalCallExpression(parent)) &&
          parent.callee === path.node;
        const isAssignLeft =
          t.isAssignmentExpression(parent) && parent.left === path.node;
        if (isCallee || isAssignLeft) {
          // Already a call/assignment — no wrap.
          return;
        }
        path.replaceWith(t.callExpression(t.identifier(effectiveName), []));
        path.skip();
      }
    },
  });

  const stmt = wrapper.program.body[0]!;
  const rewrittenExpr = !t.isExpressionStatement(stmt) ? cloned : stmt.expression;
  const raw = generate(rewrittenExpr, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
