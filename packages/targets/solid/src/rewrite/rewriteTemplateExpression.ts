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
 *   - `$slots.foo`               → `(_props.fooSlot ?? _props.slots?.['foo'])` (Phase 07.3.2 Plan 09 merge — dynamic-name fallback)
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
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';

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

// jsescOption.quotes='single' aligns generator string-literal output with the
// canonical merge shape emitted by `emitSlotInvocation.ts:139` (string
// template uses single quotes). Without this, `$slots.X` rewrite produces
// `_props.slots?.["x"]` (double quotes) which diverges visually from the
// invocation site in dist-parity fixtures and tests.
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
  /* v8 ignore next -- defensive: COMPOUND_OP_MAP covers every compound operator @babel/parser produces */
  if (!binOp) return t.callExpression(t.identifier(setterName), [rhs]);
  // Functional updater for compound: setX(prev => prev + rhs)
  const arrow = t.arrowFunctionExpression(
    [t.identifier('prev')],
    t.binaryExpression(binOp, t.identifier('prev'), rhs),
  );
  return t.callExpression(t.identifier(setterName), [arrow]);
}

/**
 * Optional knobs for callers that need to influence rewriting beyond the IR.
 */
export interface RewriteTemplateOpts {
  /**
   * Identifiers that resolve to a Solid `Accessor<T>` (a `() => T` getter) at
   * runtime — bare references in expression position get auto-wrapped in a
   * CallExpression so the unwrapped VALUE is used, not the accessor function.
   *
   * Today's sole caller is `emitLoop`, which passes the loop's `indexAlias`
   * here because Solid `<For>`'s callback shape is
   * `(item: T, index: () => number) => JSX.Element` — the index parameter is
   * a reactive accessor, NOT a scalar. Without this rewrite, user expressions
   * like `:key="keyFor(item, index)"` would pass the function itself as the
   * second argument, breaking eslint-plugin-solid's `solid/reactivity` rule
   * (and silently producing wrong values at runtime).
   */
  invokeAccessors?: ReadonlySet<string> | undefined;
  /**
   * Phase 33 / REQ-26 — reactive-portal scope-param accessor rewrite. Maps each
   * in-scope local param name (the consumer's bindAs/local name) to the SCOPE
   * PROPERTY it resolves to. A bare reference to one of these locals is rewritten
   * to `<scopeAccessorIdent>().<scopeProp>` so the read happens lazily inside the
   * tracking computation each render — making the consumer fragment re-render IN
   * PLACE on `setScopeSig` (no remount).
   *
   * Only the Solid reactive-portal consumer filler (emitSlotFiller) passes this,
   * and only when the matching producer slot is `<slot portal reactive>`. Empty/
   * undefined is the universal back-compat path (mount-once portals + every
   * non-portal scoped slot keep the destructured-value shape).
   */
  scopeAccessorParams?:
    | { accessorIdent: string; params: ReadonlyMap<string, string> }
    | undefined;
  /**
   * Spike-012 NEW-4 — identifiers bound to a RAW loop VALUE by an enclosing
   * keyless `<For>` (the item alias). Under `<For>` the item callback param is a
   * scalar, NOT an accessor, so a bare reference must stay bare — even when the
   * SAME name also happens to be a `$computed` (a lexical shadow: the loop param
   * shadows the outer memo inside the body). Without this, the Identifier visitor
   * would see the name in `computedNames` and rewrite `item` → `item()`, calling
   * the scalar (TS2349 + runtime TypeError). Populated by `emitLoop` on the child
   * ctx for the keyless-`<For>` body only; a keyed `<Key>` item alias is a real
   * accessor and is threaded via `invokeAccessors` instead (so it DOES get `()`).
   */
  loopValueBindings?: ReadonlySet<string> | undefined;
}

/**
 * Render a Babel Expression as a JSX-context string for Solid.
 * IR is consulted for prop/data/ref/computed/slot name lookups.
 */
export function rewriteTemplateExpression(
  expr: t.Expression,
  ir: IRComponent,
  opts: RewriteTemplateOpts = {},
): string {
  const cloned = t.cloneNode(expr, true, false);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => s.name));
  const invokeAccessors = opts.invokeAccessors;
  const scopeAccessor = opts.scopeAccessorParams;
  const loopValueBindings = opts.loopValueBindings;

  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X` in template
  // event handlers / bindings. `$model` is model-only by contract (Wave 1
  // rejected non-model/non-existent `$model.X` before lowering) and always a
  // member-expression object (D-03); normalize `$model` → `$props` before the
  // main traversal so every write/read routes through the IDENTICAL
  // `$props.<modelProp>` lowering → byte-identical emit. Reuse, not reimplement.
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
      /* v8 ignore next -- defensive: a non-computed MemberExpression always has an Identifier property */
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
        // $slots.foo → (_props.fooSlot ?? _props.slots?.['foo'])
        //
        // Phase 07.3.2 Plan 09 — gap closure for F-07.3.2-05-A row #4 (Solid
        // Modal 2 dynamic-fill). The static-named slot field is merged with
        // the consumer-side dynamic-name `slots?:` map so r-if guards
        // (`r-if="$slots.header"`) evaluate truthy when ONLY a dynamic-name
        // fill is present (consumer used `<template #[expr]>` without a
        // static-name fill). Mirrors the canonical merge already in place at
        // the invocation site in `emit/emitSlotInvocation.ts` (line ~139).
        //
        // Pitfall 2 (Solid reactive-tracking): the merge expression stays
        // inline — wrapped only with `extra: { parenthesized: true }` so
        // `@babel/generator` emits the outer parens. Solid's compiler wraps
        // the whole surrounding JSX expression (`<Show when={...}>` body /
        // `{...}` braces) in a tracking accessor → reactivity-on-change of
        // `_props.slots` is preserved. NO hoisting to `untrack(...)` or a
        // top-level `const merged = ...`.
        //
        // Default slot (name === '') keeps the legacy `_props.children`
        // shape; default-slot guards never reference `$slots.<empty>` from
        // template source so the dynamic-map merge does not apply there.
        const fieldName = prop.name === '' ? 'children' : prop.name + 'Slot';
        if (prop.name === '') {
          path.node.object = t.identifier('_props');
          path.node.property = t.identifier(fieldName);
          return;
        }
        const fieldKey = prop.name;
        const lhs = t.memberExpression(t.identifier('_props'), t.identifier(fieldName));
        const slotsMember = t.memberExpression(t.identifier('_props'), t.identifier('slots'));
        // _props.slots?.['header']  (optional, computed)
        const rhs = t.optionalMemberExpression(
          slotsMember,
          t.stringLiteral(fieldKey),
          /* computed */ true,
          /* optional */ true,
        );
        const merged = t.logicalExpression('??', lhs, rhs);
        // `t.parenthesizedExpression` wraps the LogicalExpression so the
        // generator emits outer parens unconditionally — including when the
        // merge sits at the top level (where `extra.parenthesized` would be
        // suppressed as redundant). Matches the canonical merge shape
        // emitted at the invocation site (`emit/emitSlotInvocation.ts:139`).
        const wrapped = t.parenthesizedExpression(merged);
        path.replaceWith(wrapped);
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

    Identifier(path) {
      const name = path.node.name;

      // Phase 33 / REQ-26 — reactive-portal scope-param accessor rewrite. A bare
      // reference to a reactive-portal scope param (`node`, `selected`, …) is
      // rewritten to `<accessor>().<scopeProp>` so the read tracks the scope
      // signal each render → in-place re-render on update(scope). Runs FIRST so
      // these locals never fall through to the computed/invokeAccessor branches.
      if (scopeAccessor) {
        const scopeProp = scopeAccessor.params.get(name);
        if (scopeProp !== undefined) {
          const parentPath = path.parentPath;
          /* v8 ignore next -- defensive: a traversed Identifier always has a parentPath */
          if (parentPath) {
            // Skip property keys / shorthand keys — only VALUE positions rewrite.
            const parentNode = parentPath.node;
            const isMemberProp =
              (t.isMemberExpression(parentNode) ||
                t.isOptionalMemberExpression(parentNode)) &&
              parentNode.property === path.node &&
              !parentNode.computed;
            const isObjectKey =
              t.isObjectProperty(parentNode) &&
              parentNode.key === path.node &&
              !parentNode.computed;
            if (!isMemberProp && !isObjectKey) {
              path.replaceWith(
                t.memberExpression(
                  t.callExpression(t.identifier(scopeAccessor.accessorIdent), []),
                  t.identifier(scopeProp),
                ),
              );
              path.skip();
              return;
            }
          }
        }
      }

      // Phase 14 D-04 — the `$attrs` magic accessor lowers to the bare `attrs`
      // identifier. The spread emitter decides this is a `$attrs` case BEFORE
      // calling rewrite (so it skips the `normalizeAttrs` wrap); this branch
      // turns `{...$attrs}` into the lowered `{...attrs}`. `attrs` is the
      // synthesised binding the per-target shell will introduce when synthesis
      // is un-gated in Plan 14-05.
      //
      // Phase 15 D-19 — `$listeners` lowers to bare `attrs` as well (Solid's
      // listener cluster is the SAME rest-of-props bucket as `$attrs`;
      // splitProps yields ONE bucket and both `$attrs` + `$listeners`
      // resolve to it). Routing the rewrite directly into `attrs` avoids
      // declaring a separate `const $listeners = attrs` line — that decl
      // would read `attrs` outside JSX and trip eslint-plugin-solid's
      // `solid/reactivity` rule (every reactive variable must be consumed
      // inside JSX / createEffect / event handlers). Inlining at the JSX
      // call site keeps the reactivity check satisfied.
      if (name === '$attrs' || name === '$listeners') {
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
        return;
      }

      // Spike-012 NEW-4 — a keyless `<For>` item alias is a RAW value in the
      // loop body; leave it bare even if the same name is also a `$computed`
      // (the loop param lexically shadows the memo). Guard BEFORE the computed /
      // invoke-accessor rewrite so `item` never becomes `item()` inside the loop.
      if (loopValueBindings?.has(name)) return;

      const isComputed = computedNames.has(name);
      const isInvokeAccessor = invokeAccessors?.has(name) ?? false;
      // Both branches rewrite bare references to `name()` — computed getters
      // and loop-index accessors share the same wrap-in-CallExpression shape.
      // Only when the identifier is used as a value (not as a callee — already
      // a call, not as a property key, not in a declaration).
      if (!isComputed && !isInvokeAccessor) return;

      const parentPath = path.parentPath;
      /* v8 ignore next -- defensive: a traversed Identifier always has a parentPath */
      if (!parentPath) return;

      // Skip: already being called → `remaining()`
      if (parentPath.isCallExpression() && parentPath.node.callee === path.node) return;
      // Skip: property key in member expression → `obj.remaining`
      if (parentPath.isMemberExpression() && parentPath.node.property === path.node && !parentPath.node.computed) return;
      // Skip: object property key in shorthand or non-computed form
      if (parentPath.isObjectProperty() && parentPath.node.key === path.node && !parentPath.node.computed) {
        // Shorthand `{ index }` would otherwise lose its value half on rewrite;
        // expand to `{ index: index() }` to keep the rewrite well-formed.
        if (parentPath.node.shorthand) {
          parentPath.node.shorthand = false;
          parentPath.node.value = t.callExpression(t.identifier(name), []);
          path.skip();
        }
        return;
      }

      path.replaceWith(t.callExpression(t.identifier(name), []));
      path.skip();
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $classSelector('grip') → ".grip" — same lowering as the <script> path
      // (rewriteScript.ts); both hooks call the SAME shared helper so they
      // cannot drift (Pitfall 4). Handled BEFORE the $emit-only early-return so
      // a :attr-position $classSelector is rewritten.
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
    ? /* v8 ignore next -- defensive: the wrapper is built from a single ExpressionStatement, so this arm is unreachable */
      generate(cloned, GEN_OPTS).code
    : generate(stmt.expression, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
