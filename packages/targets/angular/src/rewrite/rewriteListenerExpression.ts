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
import { sanitizeEventName } from './sanitizeEventName.js';

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

/**
 * Mirror of rewriteScript.ts's COMPOUND_OP_MAP / buildAngularSetterCall.
 *
 * Phase 18 follow-up — an inline model/data WRITE inside a `<listeners>` body
 * (e.g. `@keydown.escape="$model.open = false"` or
 * `@resize="$data.n = $data.n + 1"`) must lower to the SAME Angular signal
 * setter the <script> path emits. The read-rewrite traversal below turns
 * `$props.X` / `$data.X` into a `this.X()` GETTER call unconditionally, which
 * Babel rejects as an assignment LHS (`this.X() = false`). The
 * AssignmentExpression / UpdateExpression visitors added to that same traversal
 * intercept the WRITE shape first and route it through this setter builder —
 * byte-identical to the script path ("reuse, not reimplement").
 */
const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
  '+=': '+',
  '-=': '-',
  '*=': '*',
  '/=': '/',
  '%=': '%',
  '**=': '**',
  '<<=': '<<',
  '>>=': '>>',
  '>>>=': '>>>',
  '&=': '&',
  '|=': '|',
  '^=': '^',
};

/**
 * Build `this.foo.set(rhs)` for a plain `=`, or
 * `this.foo.set(this.foo() OP rhs)` for compound operators. Behaviour-identical
 * to rewriteScript.ts's buildAngularSetterCall.
 */
function buildAngularSetterCall(
  signalName: string,
  operator: string,
  rhs: t.Expression,
): t.CallExpression {
  const setterCallee = t.memberExpression(
    t.memberExpression(t.thisExpression(), t.identifier(signalName)),
    t.identifier('set'),
  );
  if (operator === '=') {
    return t.callExpression(setterCallee, [rhs]);
  }
  const binOp = COMPOUND_OP_MAP[operator];
  /* v8 ignore next 3 -- defensive: COMPOUND_OP_MAP covers every compound operator @babel/parser produces */
  if (!binOp) {
    return t.callExpression(setterCallee, [rhs]);
  }
  const innerRead = t.callExpression(
    t.memberExpression(t.thisExpression(), t.identifier(signalName)),
    [],
  );
  return t.callExpression(setterCallee, [t.binaryExpression(binOp, innerRead, rhs)]);
}

/**
 * Phase 07.3.2 Plan 10 — listener-context `$slots.X` merge with dynamic-name
 * fallback. Produces `(this.<X>Tpl ?? this.templates()?.['<x>'])`. Listener
 * bodies run in class context so both operands carry the `this.` prefix.
 *
 * Single quotes on the computed-key string applied via `extra.raw` to match
 * emitSlotInvocation.ts:326 convention and minimize dist-parity diff.
 */
function buildListenerSlotsMerge(
  tplName: string,
  dynKey: string,
): t.Expression {
  const staticRef = t.memberExpression(t.thisExpression(), t.identifier(tplName));
  const templatesCall = t.callExpression(
    t.memberExpression(t.thisExpression(), t.identifier('templates')),
    [],
  );
  const dynKeyLit = t.stringLiteral(dynKey);
  (dynKeyLit as t.StringLiteral & { extra?: { raw?: string; rawValue?: string } }).extra = {
    raw: `'${dynKey}'`,
    rawValue: dynKey,
  };
  const dynamicRef = t.optionalMemberExpression(
    templatesCall,
    dynKeyLit,
    true,
    true,
  );
  const merge = t.logicalExpression('??', staticRef, dynamicRef);
  return t.parenthesizedExpression(merge);
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
  // Bug 2 (260520-gi1): the output() FIELD identifier is the sanitized
  // (valid-identifier) name — classMembers must track the sanitized form so
  // bare-identifier `this.` prefixing references the real field.
  const emits = new Set(ir.emits.map((e) => sanitizeEventName(e)));

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

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X` inside a
  // <listeners>-block body (e.g. an inline `handler: () => { $model.x = … }`).
  // This is the SEPARATE listener-body lowering path (RESEARCH Pitfall 2 /
  // Angular listener guard sites): patching only rewriteScript/rewriteTemplate
  // would leave a literal `$model.x` in the emitted listener block. Normalize
  // the accessor `$model` → `$props` before the main traversal so every
  // downstream write/read routes through the IDENTICAL `$props.<modelProp>`
  // Angular lowering → same signal setter/getter, byte-identical emit.
  traverse(wrapper, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
  });

  traverse(wrapper, {
    /**
     * Inline WRITE inside a listener body — mirror of rewriteScript.ts's
     * AssignmentExpression visitor. `$model.X` has already been normalized to
     * `$props.X` by the first traversal, so only the `$props.<modelProp>` and
     * `$data.<dataName>` write shapes are lowered here. Lowering replaces the
     * whole assignment with `this.X.set(...)` BEFORE the MemberExpression read
     * visitor descends into the now-replaced subtree, so the RHS's own
     * `$props`/`$data` reads (e.g. `$data.n` in `$data.n = $data.n + 1`) still
     * lower to `this.n()` on re-traversal. Non-model `$props` writes are
     * ROZ200/ROZ204 semantic errors that never reach emit; `$refs`/`$slots`
     * writes are not lowered.
     */
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;
      if (!t.isMemberExpression(left)) return;
      if (left.computed) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj)) return;
      /* v8 ignore next -- defensive: a non-computed MemberExpression LHS always has an Identifier property */
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$data') {
        if (!dataNames.has(prop.name)) return;
        path.replaceWith(buildAngularSetterCall(prop.name, node.operator, node.right));
        return;
      }
      if (obj.name === '$props') {
        if (!modelProps.has(prop.name)) return;
        path.replaceWith(buildAngularSetterCall(prop.name, node.operator, node.right));
        return;
      }
    },

    /**
     * `$data.x++` / `$data.x--` (and the model `$props.x` forms) inside a
     * listener body — mirror of rewriteScript.ts's UpdateExpression visitor.
     * `this.x` is a signal GETTER, so `this.x()++` is invalid; route through
     * the setter: `++` → `+= 1`, `--` → `-= 1`. Statement-context only, matching
     * the script path's restriction.
     */
    UpdateExpression(path) {
      const node = path.node;
      const arg = node.argument;
      if (!t.isMemberExpression(arg) || arg.computed) return;
      const obj = arg.object;
      const prop = arg.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop)) return;

      const isData = obj.name === '$data' && dataNames.has(prop.name);
      const isModel = obj.name === '$props' && modelProps.has(prop.name);
      if (!isData && !isModel) return;

      if (!path.parentPath?.isExpressionStatement()) return;

      const op = node.operator === '++' ? '+=' : '-=';
      path.replaceWith(buildAngularSetterCall(prop.name, op, t.numericLiteral(1)));
    },

    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      /* v8 ignore next -- defensive: a non-computed MemberExpression always has an Identifier property */
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
        // Phase 07.3.2 Plan 10 — listener-context $slots.X also merges with
        // the dynamic-name fallback (class-body context, `this.` prefix).
        const tplName = prop.name === '' ? 'defaultTpl' : `${prop.name}Tpl`;
        const dynKey = prop.name === '' ? 'defaultSlot' : prop.name;
        path.replaceWith(buildListenerSlotsMerge(tplName, dynKey));
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
      // Bug 2 (260520-gi1): the output() field id is the sanitized
      // (valid-identifier) name; `this.<field>.emit(…)` must agree with the
      // field declaration emitted in emitScript.ts.
      const eventName = sanitizeEventName(first.value);
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
  const rewrittenExpr = !t.isExpressionStatement(stmt)
    ? /* v8 ignore next -- defensive: the wrapper is built from a single ExpressionStatement */
      cloned
    : stmt.expression;
  const raw = generate(rewrittenExpr, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
