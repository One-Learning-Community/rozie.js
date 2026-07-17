/**
 * Quick 260717-8zb — `$memo(fn, keyFn)` misuse validator (ROZ146).
 *
 * `expandMemo` (packages/core/src/ir/lowerers/expandMemo.ts) runs in
 * `lowerToIR` BEFORE `analyzeAST`, and expands ONLY the well-formed shape:
 * a top-level single-declarator `const X = $memo(fnArrow, keyFnArrow)` with
 * EXACTLY two arrow-function arguments. Any other shape is left completely
 * untouched in the AST — a `let`-bound declaration, a multi-declarator
 * statement, a `$memo` call nested inside a function body, wrong arity, or
 * non-arrow-function arguments.
 *
 * By construction, ANY `$memo(...)` CallExpression this validator finds when
 * it walks the (post-expandMemo) `<script>` AST is therefore a misuse —
 * expandMemo would have already removed a well-formed one. This validator
 * does a single whole-program traverse for a `$memo`-callee CallExpression
 * and reports ROZ146 for every one found, so a malformed `$memo` call never
 * survives to emit as a dangling free identifier (a runtime ReferenceError on
 * every target — `$memo` is never sigil-lowered by any per-target emitter).
 *
 * Per D-08 collected-not-thrown: NEVER throws. No bindings dependency (a
 * pure AST walk over `ast.script.program`). Never mutates the AST.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { RozieAST } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { locFromBabel } from '../../diagnostics/locFromBabel.js';

// Default-export interop — see refsPreMountValidator.ts / bareSigilValidator.ts
// for the same pattern (CJS/ESM interop across bundler configurations).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

const MEMO_SIGIL = '$memo';

/** Human-readable description of why a specific misuse shape is invalid, used
 *  to make the diagnostic actionable rather than generic. */
function describeMisuse(path: {
  parent: t.Node;
}): string {
  const parent = path.parent;
  if (t.isVariableDeclarator(parent)) {
    // Could still be misused via arity/arg-shape or `let`/multi-decl — those
    // are indistinguishable from here without re-walking the enclosing
    // VariableDeclaration, which callers do via the shared message below.
    return 'it was not bound to a top-level `const X = $memo(fn, keyFn)` declaration with exactly two arrow-function arguments';
  }
  return '`$memo` must be called directly as the initializer of a top-level `const` declaration, not used as a nested/standalone expression';
}

/**
 * Run the `$memo` misuse validator over `ast.script`. Emits ROZ146 for every
 * `$memo(...)` CallExpression still present in the (post-expandMemo) script
 * AST. No-op when there is no `<script>` block.
 */
export function runMemoValidator(ast: RozieAST, diagnostics: Diagnostic[]): void {
  if (!ast.script) return;
  try {
    traverse(ast.script.program, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (!t.isIdentifier(callee) || callee.name !== MEMO_SIGIL) return;
        const reason = describeMisuse({ parent: path.parent });
        diagnostics.push({
          code: RozieErrorCode.MEMO_MISUSE,
          severity: 'error',
          message: `$memo(...) is misused: ${reason}.`,
          loc: locFromBabel(path.node),
          hint: 'Bind $memo to a top-level const with exactly two arrow-function arguments, e.g. `const filtered = $memo(() => computeFiltered(), () => [optsRef, query]);`.',
        });
      },
    });
  } catch {
    // Defensive: never let an unexpected AST shape propagate — collected-not-thrown (D-08).
  }
}
