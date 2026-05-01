/**
 * Shared Babel-traverse visitor utilities for Phase 2 semantic analysis.
 *
 * - `detectMagicAccess` — pattern-match $props.foo / $data.foo / $refs.foo /
 *   $slots.foo MemberExpressions. Used by Plan 02 validators and Plan 03
 *   ReactiveDepGraph.
 * - `extractCleanupReturn` — D-19 cleanup-return extraction for $onMount
 *   bodies. Plan 05 lowerScript invokes this; collectors do NOT (collectors
 *   are silent per Plan 02-01 contract).
 *
 * Per D-08 (collected-not-thrown): no `throw` statements. All edge cases
 * return a structured result with optional warnings; callers decide what to
 * do with them.
 */
import * as t from '@babel/types';

/**
 * Detect access pattern $props.foo / $data.foo / $refs.foo / $slots.foo.
 * Returns the scope + member name, or null if the node is not a magic
 * accessor read.
 *
 * Computed access (`$props['foo']`) returns null — Plan 02
 * unknownRefValidator emits ROZ106 separately for that pattern; this
 * helper's job is just to identify static magic-accessor reads.
 */
export function detectMagicAccess(
  node: t.Node,
): { scope: 'props' | 'data' | 'refs' | 'slots'; member: string } | null {
  if (!t.isMemberExpression(node)) return null;
  const obj = node.object;
  if (!t.isIdentifier(obj)) return null;
  // Reject computed access ($props['foo']) — handled separately as ROZ106.
  if (node.computed) return null;
  const prop = node.property;
  if (!t.isIdentifier(prop)) return null;
  const map: Record<string, 'props' | 'data' | 'refs' | 'slots'> = {
    $props: 'props',
    $data: 'data',
    $refs: 'refs',
    $slots: 'slots',
  };
  const scope = map[obj.name];
  return scope ? { scope, member: prop.name } : null;
}

/**
 * Result of extracting cleanup-return from an $onMount/$onUpdate body.
 *
 * `setup` is the callback body with the trailing cleanup-return statement
 * removed (when extracted). `cleanup` is the function/identifier that was
 * being returned, or null if no cleanup-return was present.
 *
 * `warnings` capture edge cases (async return, conditional cleanup, etc.)
 * that the caller (Plan 05 lowerScript) translates into ROZ105/etc. diagnostics.
 */
export interface LifecycleCleanupExtraction {
  /** Body without the cleanup return (BlockStatement) OR original expression body. */
  setup: t.BlockStatement | t.Expression;
  /** The returned function/identifier, or null if no cleanup. */
  cleanup: t.Expression | null;
  isAsync: boolean;
  warnings: Array<{ message: string; loc: t.SourceLocation | null }>;
}

/**
 * Extract cleanup-return from the body of $onMount(callback) / $onUpdate(callback).
 *
 * Per D-19: trailing `return fn` becomes the LifecycleHook.cleanup field.
 * Async arrows (`$onMount(async () => …)`) return Promises — never cleanup.
 *
 * USED BY Plan 05 lowerScript. Plan 02-01 collectors do NOT invoke this;
 * collectors are silent (no diagnostics emitted from collection).
 */
export function extractCleanupReturn(
  callback: t.ArrowFunctionExpression | t.FunctionExpression,
): LifecycleCleanupExtraction {
  const warnings: LifecycleCleanupExtraction['warnings'] = [];
  if (callback.async) {
    warnings.push({
      message: 'async $onMount cannot return a cleanup function — Promise return is implicit',
      loc: callback.loc ?? null,
    });
    return { setup: callback.body, cleanup: null, isAsync: true, warnings };
  }

  // Concise arrow body: $onMount(() => fn)
  if (!t.isBlockStatement(callback.body)) {
    if (t.isFunctionExpression(callback.body) || t.isArrowFunctionExpression(callback.body)) {
      return {
        setup: t.blockStatement([]),
        cleanup: callback.body,
        isAsync: false,
        warnings,
      };
    }
    // Concise arrow returning non-function — not a cleanup; setup is the expression
    return { setup: callback.body, cleanup: null, isAsync: false, warnings };
  }

  // Block body: walk to last statement
  const body = callback.body.body;
  if (body.length === 0) {
    return { setup: callback.body, cleanup: null, isAsync: false, warnings };
  }
  const last = body[body.length - 1];
  if (!last || !t.isReturnStatement(last) || !last.argument) {
    return { setup: callback.body, cleanup: null, isAsync: false, warnings };
  }

  // ReturnStatement with argument — must be a function or identifier resolving to one
  const arg = last.argument;
  if (t.isFunctionExpression(arg) || t.isArrowFunctionExpression(arg)) {
    const setupBody = t.blockStatement(body.slice(0, -1), callback.body.directives);
    return { setup: setupBody, cleanup: arg, isAsync: false, warnings };
  }
  if (t.isIdentifier(arg)) {
    const setupBody = t.blockStatement(body.slice(0, -1), callback.body.directives);
    return { setup: setupBody, cleanup: arg, isAsync: false, warnings };
  }
  if (t.isConditionalExpression(arg)) {
    warnings.push({
      message: 'conditional cleanup return — both branches must be cleanup functions',
      loc: arg.loc ?? null,
    });
    const setupBody = t.blockStatement(body.slice(0, -1), callback.body.directives);
    return { setup: setupBody, cleanup: arg, isAsync: false, warnings };
  }

  // ReturnStatement returning a non-function — undefined cleanup; warn.
  warnings.push({
    message: '$onMount return value is not a function; ignoring as cleanup',
    loc: arg.loc ?? null,
  });
  return { setup: callback.body, cleanup: null, isAsync: false, warnings };
}
