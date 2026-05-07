/**
 * rewriteRozieIdentifiers — Plan 04-02 Task 1 (React target).
 *
 * Walks a CLONED Babel Program and rewrites Rozie-specific magic accessors
 * into React-idiomatic identifier shapes per RESEARCH.md Pattern 2 (lines
 * 466-501) verbatim:
 *
 *   - `$props.value` (model: true) read   → `value`              (NO .value — useState/useControllableState return T directly)
 *   - `$props.value = X` (model write)    → `setValue(X)`         (CallExpression replacing the AssignmentExpression)
 *   - `$props.value += X` (model compound) → `setValue(prev => prev + X)`  (Pitfall 6 functional updater for concurrent-safe semantics)
 *   - `$props.step` (non-model) read      → `props.step`
 *   - `$data.foo` read                    → `foo`                (bare local from useState)
 *   - `$data.foo = X`                     → `setFoo(X)`
 *   - `$data.foo += 1`                    → `setFoo(prev => prev + 1)`
 *   - `$data.foo.bar = X` nested write    → emit ROZ521, leave AST unchanged (Pitfall 7)
 *   - `$refs.foo` read                    → `foo.current`
 *   - `$slots.foo` (boolean check)        → `props.renderFoo`    (Plan 04-03 will refine boolean-context to `!!`)
 *   - `$emit('search', q)`                → `props.onSearch?.(q)`  (camelCase + on-prefix + optional-chain)
 *
 * `$onMount`/`$onUnmount`/`$onUpdate` calls are NOT mutated by this pass —
 * they're consumed STRUCTURALLY from `ir.lifecycle` by emitScript (Task 2).
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * Per Phase 2 D-T-2-01-04 CJS-interop pattern: normalize `@babel/traverse`
 * default-export at import time.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

export interface RewriteScriptResult {
  rewrittenProgram: File;
  diagnostics: Diagnostic[];
}

/** Convert an event name (`'search'` / `'value-change'`) to a `props.onX` field name (`onSearch` / `onValueChange`). */
function toReactEventPropName(eventName: string): string {
  // Hyphen / underscore split + camelCase + 'on' prefix.
  const parts = eventName.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return 'on';
  const camel = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return 'on' + camel;
}

/** Capitalize first letter of a name: `value` → `Value`, `hovering` → `Hovering`. */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Map of compound-assignment operator → matching binary operator. */
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
 * Build the per-state setter call: `setName(rhs)` for plain `=`, or
 * `setName(prev => prev OP rhs)` for compound operators (Pitfall 6).
 */
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
  if (!binOp) {
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  const arrow = t.arrowFunctionExpression(
    [t.identifier('prev')],
    t.binaryExpression(binOp, t.identifier('prev'), rhs),
  );
  return t.callExpression(t.identifier(setterName), [arrow]);
}

/**
 * Detect whether a MemberExpression LHS represents a NESTED write
 * (e.g., `$data.todo.title = X`). Returns the root `$data`/`$props`
 * Identifier name when so; null otherwise.
 */
function nestedWriteRoot(left: t.LVal | t.OptionalMemberExpression): string | null {
  if (!t.isMemberExpression(left)) return null;
  // SHALLOW write would be MemberExpression{object: Identifier('$data'), property: Identifier('field')}.
  // NESTED write would be MemberExpression{object: MemberExpression{...$data.X}, property: Identifier('subField')}.
  if (!t.isMemberExpression(left.object) && !t.isOptionalMemberExpression(left.object)) {
    return null;
  }
  // Walk to root.
  let node: t.Node = left.object;
  while (
    (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    (t.isMemberExpression(node.object) || t.isOptionalMemberExpression(node.object))
  ) {
    node = node.object;
  }
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) return null;
  const root = node.object;
  if (!t.isIdentifier(root)) return null;
  if (root.name !== '$data' && root.name !== '$props') return null;
  return root.name;
}

/**
 * Rewrite Rozie magic-accessor identifiers in-place on a cloned Program.
 *
 * Strategy: single-pass @babel/traverse with multiple visitors. Replacements
 * use `path.replaceWith` and DO NOT call `path.skip()` — letting traversal
 * descend into the replacement node ensures nested rewrites apply (e.g., the
 * `node.right` of a setter-replaced AssignmentExpression still gets walked
 * so `$props.step` references inside it are rewritten to `props.step`).
 */
export function rewriteRozieIdentifiers(
  program: File,
  ir: IRComponent,
): RewriteScriptResult {
  const diagnostics: Diagnostic[] = [];

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => s.name));

  // Phase 06.1 P2 (D-104/D-106): name → IR-primitive lookups so synthesized
  // identifier nodes can inherit the IR's sourceLoc. The .loc cast is `as any`
  // because @babel/types' SourceLocation expects {line, column} while our
  // SourceLoc is {start, end} byte offsets — runtime shape diverges; the
  // metadata is present for v2 to refine into proper line/column.
  const stateByName = new Map(ir.state.map((s) => [s.name, s]));
  const refByName = new Map(ir.refs.map((r) => [r.name, r]));
  const propByName = new Map(ir.props.map((p) => [p.name, p]));

  traverse(program, {
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;

      // Detect nested writes BEFORE we attempt any rewrite. Emit ROZ521 +
      // leave AST unchanged (Pitfall 7).
      const nested = nestedWriteRoot(left);
      if (nested !== null) {
        const startLoc = node.loc?.start;
        const endLoc = node.loc?.end;
        diagnostics.push({
          code: RozieErrorCode.TARGET_REACT_NESTED_STATE_MUTATION,
          severity: 'warning',
          message: `Nested member write \`${nested}.<deep-path> = …\` is not auto-rewritten in v1 (Pitfall 7). Use \`set${nested === '$data' ? 'Field' : 'Field'}(prev => ({ ...prev, ... }))\` or accept the leftover \`${nested}.\` reference in emitted output. AST left unchanged.`,
          loc: {
            start: startLoc?.index ?? 0,
            end: endLoc?.index ?? 0,
          },
        });
        return;
      }

      // SHALLOW writes: `$data.X = ...` or `$props.X = ...` (model only).
      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj)) return;
      if (left.computed) return;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$data') {
        if (!dataNames.has(prop.name)) return;
        const setterCall = buildSetterCall(prop.name, node.operator, node.right);
        path.replaceWith(setterCall);
        // No path.skip() — let traversal descend into the new arrow body so
        // `$props.step` references inside `prev + $props.step` get rewritten.
        return;
      }

      if (obj.name === '$props') {
        if (!modelProps.has(prop.name)) return;
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
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // $props.value (model) → value
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthId);
          return;
        }
        if (nonModelProps.has(prop.name)) {
          // $props.step → props.step (mutate object, retain property)
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering (bare)
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthId);
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogEl.current
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const newObj = t.identifier(prop.name);
        if (refDecl) newObj.loc = refDecl.sourceLoc as any;
        path.node.object = newObj;
        path.node.property = t.identifier('current');
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // $slots.foo → props.renderFoo (Plan 04-03 may layer `!!` for boolean ctx)
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
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthId);
          return;
        }
        if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthId);
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const newObj = t.identifier(prop.name);
        if (refDecl) newObj.loc = refDecl.sourceLoc as any;
        path.node.object = newObj;
        path.node.property = t.identifier('current');
        return;
      }
    },

    /**
     * `$emit('event', ...args)` → `props.onEvent?.(...args)` optional-chain.
     *
     * Leave $onMount/$onUnmount/$onUpdate untouched (consumed structurally
     * by emitScript). Leave console.log untouched (DX-03 floor).
     */
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (callee.name !== '$emit') return;

      const args = path.node.arguments;
      if (args.length === 0) return;
      const firstArg = args[0]!;
      if (!t.isStringLiteral(firstArg)) {
        // Non-literal event name — emit cannot be statically rewritten.
        return;
      }
      const eventName = firstArg.value;
      const propName = toReactEventPropName(eventName);
      // Filter out JSXNamespacedName which can never appear here (TS narrowing).
      const restArgs = args
        .slice(1)
        .filter((a) => !t.isJSXNamespacedName(a)) as Array<
        t.Expression | t.SpreadElement | t.ArgumentPlaceholder
      >;
      // Plan 04-04 lint-clean fix — `props.onClose?.()` (OptionalCallExpression
      // of OptionalMemberExpression) confuses eslint-plugin-react-hooks v5's
      // exhaustive-deps narrowing: the deps array entry `props.onClose` is a
      // plain MemberExpression but the body's optional chain doesn't structurally
      // match, so the lint rule warns "missing dependency: props". Workaround:
      // emit a logical-AND guard `props.onClose && props.onClose(...)` which
      // uses MemberExpression on both sides — matches deps[] entry exactly.
      const memberExpr = t.memberExpression(
        t.identifier('props'),
        t.identifier(propName),
      );
      const replacement = t.logicalExpression(
        '&&',
        memberExpr,
        t.callExpression(t.cloneNode(memberExpr), restArgs),
      );
      path.replaceWith(replacement);
    },
  });

  return { rewrittenProgram: program, diagnostics };
}
