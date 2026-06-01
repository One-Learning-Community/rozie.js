/**
 * SEM / Phase 21 — `$expose` methods-only validator (ROZ115–ROZ120).
 *
 * `$expose({ clear, open })` exposes named `<script>` functions as a consumer-
 * callable imperative handle. This validator enforces the LOCKED accept-set
 * (21-PLAN <interfaces>): a `$expose` property value is VALID iff it is
 *   (a) a bare identifier (shorthand `{ clear }` or explicit `{ clear: clear }`)
 *       resolving to a top-level `<script>` FunctionDeclaration OR an
 *       arrow/function-valued `const`, OR
 *   (b) an inline ArrowFunctionExpression / FunctionExpression value
 *       (`{ getValue: () => $data.x }`).
 * A `$computed`-bound name is a reactive VALUE, not a function => ROZ118.
 * Everything else (literal, member-expr, call-expr, identifier not resolving to
 * a `<script>` function) => ROZ118.
 *
 * The six malformed forms each get one distinct code:
 *   ROZ115 — `$expose(x)` argument is not an object literal
 *   ROZ116 — `$expose({ ...o })` a property is a spread
 *   ROZ117 — `$expose({ [k]: v })` a property has a computed key
 *   ROZ118 — `$expose({ a: 1 })` value is not an in-scope function / inline fn
 *   ROZ119 — two top-level `$expose(...)` calls
 *   ROZ120 — `$expose(...)` inside a nested function (not Program top level)
 *
 * At most ONE diagnostic per offending site; all error severity (D-08
 * collected-not-thrown: never throws — `compile()` never throws on malformed
 * `$expose`). Reads `bindings.exposeCalls` (every call site, populated by
 * collectScriptDecls) so duplicate + nested-scope detection needs no re-walk.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { BindingsTable } from '../types.js';

function locFromNode(node: t.Node): SourceLoc {
  return { start: node.start ?? 0, end: node.end ?? 0 };
}

/**
 * Build the set of names that resolve to an in-scope `<script>` FUNCTION at
 * Program top level. A `const X = (…) => …` / `const X = function…` qualifies;
 * a `$computed`-bound const does NOT (it binds a reactive VALUE — a `$computed`
 * callback's RETURN is the value, so exposing the binding is ROZ118). Plain
 * function declarations always qualify.
 */
function collectInScopeFunctionNames(ast: RozieAST): Set<string> {
  const names = new Set<string>();
  if (!ast.script) return names;
  const body = ast.script.program.program.body;
  for (const stmt of body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
      continue;
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id)) continue;
        const init = decl.init;
        if (!init) continue;
        // Arrow / function-expression const → a function value.
        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          names.add(decl.id.name);
        }
        // NOTE: a $computed(...) const binds a reactive VALUE, not a function —
        // intentionally NOT added (exposing it is ROZ118).
      }
    }
  }
  return names;
}

/**
 * Run the `$expose` methods-only validator. Emits ROZ115–ROZ120. NEVER throws
 * (D-08). Mutates `diagnostics` in place; never mutates `ast` / `bindings`.
 */
export function runExposeValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  const calls = bindings.exposeCalls;
  if (calls.length === 0) return; // No $expose — nothing to validate.

  const inScopeFns = collectInScopeFunctionNames(ast);

  // ROZ120 — every non-top-level call is a nested-scope error.
  for (const site of calls) {
    if (!site.atTopLevel) {
      diagnostics.push({
        code: RozieErrorCode.EXPOSE_NOT_TOP_LEVEL,
        severity: 'error',
        message:
          '$expose(...) must be called once at <script> top level, not inside a function.',
        loc: locFromNode(site.call),
        hint: 'Move the $expose({ ... }) call to the top level of the <script> block.',
      });
    }
  }

  // ROZ119 — more than one TOP-LEVEL call. The first top-level call is the
  // canonical one; every subsequent top-level call is a duplicate.
  const topLevel = calls.filter((c) => c.atTopLevel);
  for (let i = 1; i < topLevel.length; i++) {
    diagnostics.push({
      code: RozieErrorCode.EXPOSE_DUPLICATE_CALL,
      severity: 'error',
      message:
        '$expose(...) may be called only once. Merge the exposed methods into a single $expose({ ... }) call.',
      loc: locFromNode(topLevel[i]!.call),
      hint: 'Combine all exposed method names into one $expose({ ... }) call.',
    });
  }

  // Shape validation runs ONLY on the canonical (first top-level) call. A
  // nested-only $expose already produced ROZ120; we do not also shape-check it.
  const canonical = topLevel[0];
  if (!canonical) return;

  const arg = canonical.call.arguments[0];

  // ROZ115 — argument is not an object literal.
  if (!arg || !t.isObjectExpression(arg)) {
    diagnostics.push({
      code: RozieErrorCode.EXPOSE_ARG_NOT_OBJECT,
      severity: 'error',
      message:
        '$expose(...) requires an object literal of method references, e.g. $expose({ clear, open }).',
      loc: locFromNode(arg ?? canonical.call),
      hint: 'Pass an object literal whose properties reference in-scope <script> functions.',
    });
    return;
  }

  for (const prop of arg.properties) {
    // ROZ116 — spread property.
    if (t.isSpreadElement(prop)) {
      diagnostics.push({
        code: RozieErrorCode.EXPOSE_SPREAD_PROPERTY,
        severity: 'error',
        message:
          '$expose({ ... }) does not support spread properties — list each exposed method explicitly.',
        loc: locFromNode(prop),
        hint: 'Replace the spread with explicit method references, e.g. { clear, open }.',
      });
      continue;
    }

    // ObjectMethod (`{ clear() {} }`) is a valid function value.
    if (t.isObjectMethod(prop)) {
      if (prop.computed) {
        diagnostics.push({
          code: RozieErrorCode.EXPOSE_COMPUTED_KEY,
          severity: 'error',
          message:
            '$expose({ ... }) does not support computed keys — use a static method name.',
          loc: locFromNode(prop),
          hint: 'Use a plain identifier key, e.g. { clear } or { clear: clear }.',
        });
      }
      continue; // a method definition IS a function value — valid.
    }

    // ObjectProperty.
    if (t.isObjectProperty(prop)) {
      // ROZ117 — computed key.
      if (prop.computed) {
        diagnostics.push({
          code: RozieErrorCode.EXPOSE_COMPUTED_KEY,
          severity: 'error',
          message:
            '$expose({ ... }) does not support computed keys — use a static method name.',
          loc: locFromNode(prop),
          hint: 'Use a plain identifier key, e.g. { clear } or { clear: clear }.',
        });
        continue;
      }

      const value = prop.value;

      // (b) inline arrow / function expression value → always valid.
      if (
        t.isArrowFunctionExpression(value) ||
        t.isFunctionExpression(value)
      ) {
        continue;
      }

      // (a) bare identifier resolving to an in-scope <script> function → valid.
      if (t.isIdentifier(value) && inScopeFns.has(value.name)) {
        continue;
      }

      // Everything else → ROZ118 (literal, member-expr, call-expr, identifier
      // not resolving to a <script> function, $computed-bound name, etc.).
      diagnostics.push({
        code: RozieErrorCode.EXPOSE_VALUE_NOT_FUNCTION,
        severity: 'error',
        message:
          '$expose({ ... }) values must reference an in-scope <script> function (or be an inline arrow). Reactive values are exposed via a getter method, e.g. { getValue: () => $data.x }.',
        loc: locFromNode(prop),
        hint: 'Reference a top-level <script> function by name, or pass an inline arrow function.',
      });
    }
  }
}
