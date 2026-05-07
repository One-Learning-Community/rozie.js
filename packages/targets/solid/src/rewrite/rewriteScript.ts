/**
 * rewriteRozieIdentifiers — Solid target (P2 complete implementation).
 *
 * Walks a CLONED Babel Program and rewrites Rozie-specific magic accessors
 * into Solid-idiomatic identifier shapes.
 *
 * Mappings:
 *   - `$props.x` (any prop) read   → `local.x`   (splitProps result)
 *   - `$props.x = v` (model write) → `setX(v)` or `setX(prev => prev OP v)` for compound
 *   - `$data.x` read               → `x()`        (signal getter call)
 *   - `$data.x = v`                → `setX(v)`    (signal setter call)
 *   - `$data.x += n`               → `setX(prev => prev + n)` (compound updater)
 *   - `$refs.foo` read             → `fooRef`     (plain variable set via ref callback)
 *   - `$emit('event', args)`       → `_props.onEvent?.(args)` (optional-chain call)
 *   - `$onMount`, `$onUnmount`, `$onUpdate` — NOT mutated; consumed structurally from ir.lifecycle
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

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

/** Convert an event name to a `_props.onX` field name. */
function toSolidEventPropName(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return 'on';
  const camel = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return 'on' + camel;
}

/** Capitalize first letter. */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Map of compound-assignment operator → matching binary operator. */
const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
  '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '**=': '**',
  '<<=': '<<', '>>=': '>>', '>>>=': '>>>', '&=': '&', '|=': '|', '^=': '^',
};

/**
 * Build a signal setter call for assignment. For simple `=` emit `setX(rhs)`;
 * for compound operators emit `setX(prev => prev OP rhs)` (functional updater).
 */
function buildSetterCall(
  varName: string,
  operator: string,
  rhs: t.Expression,
): t.CallExpression {
  const setterName = 'set' + capitalize(varName);
  if (operator === '=') {
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  const binOp = COMPOUND_OP_MAP[operator];
  if (!binOp) {
    // Fallback for unsupported operators — simple setter
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  const arrow = t.arrowFunctionExpression(
    [t.identifier('prev')],
    t.binaryExpression(binOp, t.identifier('prev'), rhs),
  );
  return t.callExpression(t.identifier(setterName), [arrow]);
}

/**
 * Rewrite $props/$data/$refs in a single expression node (cloned from IR).
 *
 * Used by emitScript.ts to rewrite computed body expressions that live in
 * ir.computed[i].body — these are Babel AST nodes separate from the main
 * script body, so they need their own rewrite pass. The node is cloned first
 * to avoid mutating the shared IR.
 *
 * @experimental — shape may change before v1.0
 */
export function rewriteRozieExpressionNode(
  expr: t.Expression | t.BlockStatement,
  ir: IRComponent,
): t.Expression | t.BlockStatement {
  // For BlockStatements, wrap body statements directly in the program.
  // For Expressions, wrap as an ExpressionStatement.
  let programBody: t.Statement[];
  const isBlock = t.isBlockStatement(expr);
  if (isBlock) {
    programBody = t.cloneNode(expr as t.BlockStatement, true, false).body;
  } else {
    programBody = [t.expressionStatement(t.cloneNode(expr as t.Expression, true, false))];
  }

  // Wrap in a File/Program so traverse() has a root to walk.
  const wrapped: File = {
    type: 'File',
    program: {
      type: 'Program',
      body: programBody,
      directives: [],
      sourceType: 'module',
    },
    comments: [],
    errors: [],
  };
  const result = rewriteRozieIdentifiers(wrapped, ir);
  const body = result.rewrittenProgram.program.body;

  if (isBlock) {
    return t.blockStatement(body);
  }
  // Extract the expression from the first statement.
  const stmt = body[0];
  if (stmt && t.isExpressionStatement(stmt)) {
    return stmt.expression;
  }
  // Fallback: return original
  return expr;
}

/**
 * Full Solid identifier rewrite pass. Replaces all $props/$data/$refs/$emit
 * references with their Solid-idiomatic equivalents.
 */
export function rewriteRozieIdentifiers(
  cloned: File,
  ir: IRComponent,
): RewriteScriptResult {
  const diagnostics: Diagnostic[] = [];

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));

  traverse(cloned, {
    // Handle assignment expressions: $data.x = v → setX(v)
    // $data.x += n → setX(prev => prev + n)
    // $props.x = v (model) → setX(v)
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;
      if (!t.isMemberExpression(left) || left.computed) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop)) return;

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

    // Handle member expression reads:
    // $props.x (any) → local.x (via splitProps)
    // $data.x → x() (signal getter call)
    // $refs.x → xRef (plain variable)
    MemberExpression(path) {
      const { object, property, computed } = path.node;
      if (computed) return;
      if (!t.isIdentifier(object) || !t.isIdentifier(property)) return;

      if (object.name === '$props') {
        if (modelProps.has(property.name)) {
          // Model prop: createControllableSignal returns [Accessor<T>, Setter<T>]
          // The accessor is the signal name itself; call it: value()
          path.replaceWith(t.callExpression(t.identifier(property.name), []));
          path.skip();
          return;
        }
        if (nonModelProps.has(property.name)) {
          // Non-model prop: access via local (splitProps result)
          path.node.object = t.identifier('local');
          return;
        }
        // Unknown prop: use local as best-effort
        path.node.object = t.identifier('local');
        return;
      }

      if (object.name === '$data' && dataNames.has(property.name)) {
        // Signal getter: name()
        path.replaceWith(t.callExpression(t.identifier(property.name), []));
        path.skip();
        return;
      }

      if (object.name === '$refs' && refNames.has(property.name)) {
        // $refs.foo → fooRef (plain variable initialized to null at top of body)
        path.replaceWith(t.identifier(property.name + 'Ref'));
        path.skip();
        return;
      }
    },

    // Handle $emit('event', args) → _props.onEvent?.(args)
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || callee.name !== '$emit') return;

      const args = path.node.arguments;
      const eventArg = args[0];
      if (!eventArg || !t.isStringLiteral(eventArg)) return;

      const eventName = eventArg.value;
      const propName = toSolidEventPropName(eventName);
      const restArgs = args.slice(1) as Array<t.Expression | t.SpreadElement | t.ArgumentPlaceholder>;

      path.replaceWith(
        t.optionalCallExpression(
          t.memberExpression(t.identifier('_props'), t.identifier(propName)),
          restArgs,
          true,
        ),
      );
    },
  });

  return { rewrittenProgram: cloned, diagnostics };
}
