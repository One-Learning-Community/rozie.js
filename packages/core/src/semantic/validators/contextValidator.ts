/**
 * SEM / Phase 36 — `$provide` / `$inject` context-primitive validator
 * (ROZ129–ROZ132).
 *
 * The cross-component context primitive adds two author-side sigils:
 *   - `$provide('key', value)` — a STATEMENT that publishes `value` under
 *     a string-literal `key` to descendant components.
 *   - `const x = $inject('key', fallback?)` — an EXPRESSION bound to a `const`
 *     that reads the nearest provided value for `key` (or `fallback`).
 *
 * This validator enforces the locked malformed-form rules (D-04 + CR-02). Each
 * gets one distinct code:
 *   ROZ129 INVALID_PROVIDE_KEY   — `$provide` first arg is not a string literal.
 *   ROZ130 INVALID_INJECT_KEY    — `$inject` first arg is not a string literal.
 *   ROZ131 PROVIDE_NOT_STATEMENT — `$provide(...)` used in expression position
 *                                  (it must be a top-level statement).
 *   ROZ132 INJECT_UNBOUND        — `$inject(...)` not bound to a `const x = …`.
 *   ROZ133 PROVIDE_MISSING_VALUE — `$provide('key')` with no value (CR-02).
 *   ROZ134 INJECT_MIXED_DECLARATION — `$inject(...)` shares a `const` with
 *                                  other declarators (WR-02).
 *
 * Mirrors `runExposeValidator` EXACTLY: reads the collected call-site arrays
 * (`bindings.provideCalls` / `bindings.injectCalls`, populated by
 * collectScriptDecls — no AST re-walk), early-returns when there are no calls,
 * and pushes Diagnostic objects. Per D-08 collected-not-thrown: NEVER throws —
 * `compile()` never throws on malformed `$provide`/`$inject`. Mutates
 * `diagnostics` in place; never mutates `bindings`.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { SourceLoc } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { BindingsTable } from '../types.js';

function locFromNode(node: t.Node): SourceLoc {
  return { start: node.start ?? 0, end: node.end ?? 0 };
}

/**
 * Run the `$provide`/`$inject` context validator. Emits ROZ129–ROZ132. NEVER
 * throws (D-08). Mutates `diagnostics` in place; never mutates `bindings`.
 */
export function runContextValidator(
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  const provideCalls = bindings.provideCalls;
  const injectCalls = bindings.injectCalls;
  if (provideCalls.length === 0 && injectCalls.length === 0) return;

  // ---- $provide checks (ROZ129 + ROZ131) ----
  for (const site of provideCalls) {
    // ROZ131 — expression-position $provide. `$provide` is a statement sigil; a
    // valid call is the expression of an ExpressionStatement. Check this FIRST
    // so a placement error reads before a key-shape error on the same call.
    if (!site.isStatement) {
      diagnostics.push({
        code: RozieErrorCode.PROVIDE_NOT_STATEMENT,
        severity: 'error',
        message:
          '$provide(...) must be a top-level statement, not used in expression position (its return value is not meaningful).',
        loc: locFromNode(site.call),
        hint: "Call $provide('key', value) as its own statement at <script> top level.",
      });
    }

    // ROZ129 — first argument is not a string literal.
    const keyArg = site.call.arguments[0];
    if (!keyArg || !t.isStringLiteral(keyArg)) {
      diagnostics.push({
        code: RozieErrorCode.INVALID_PROVIDE_KEY,
        severity: 'error',
        message:
          "$provide(key, value) requires a string-literal key, e.g. $provide('theme', value). Dynamic/computed keys are not supported.",
        loc: locFromNode(keyArg ?? site.call),
        hint: 'Pass a string-literal context key as the first argument.',
      });
    }

    // ROZ133 — missing value (CR-02). A `$provide('key')` with no value (or a
    // non-expression 2nd argument, e.g. a spread) is silently dropped by the
    // collector — nothing is provided and every descendant $inject resolves to
    // fallback/undefined. Make the silent failure a loud compile error.
    const valueArg = site.call.arguments[1];
    if (!valueArg || !t.isExpression(valueArg)) {
      diagnostics.push({
        code: RozieErrorCode.PROVIDE_MISSING_VALUE,
        severity: 'error',
        message:
          '$provide(key, value) requires a value as the second argument.',
        loc: locFromNode(site.call),
        hint: "Pass the value to publish: $provide('theme', value).",
      });
    }
  }

  // ---- $inject checks (ROZ130 + ROZ132) ----
  for (const site of injectCalls) {
    // ROZ132 — not bound to a `const x = $inject(...)`.
    if (!site.boundToConst) {
      diagnostics.push({
        code: RozieErrorCode.INJECT_UNBOUND,
        severity: 'error',
        message:
          '$inject(...) must be bound to a const, e.g. const theme = $inject(\'theme\').',
        loc: locFromNode(site.call),
        hint: "Assign the result to a const: const theme = $inject('theme', fallback?).",
      });
    } else if (!site.soleDeclarator) {
      // ROZ134 — mixed declaration (WR-02). `$inject` is bound to a const but
      // shares the declaration with other declarators. The per-statement strip
      // in the emitters would leak the whole statement (bare `$inject` ref +
      // double-declared binding), so the mixed shape is forbidden. Only checked
      // when the binding is otherwise valid (boundToConst), so a mixed `let`
      // reports ROZ132 alone, not both.
      diagnostics.push({
        code: RozieErrorCode.INJECT_MIXED_DECLARATION,
        severity: 'error',
        message:
          '$inject(...) must be the sole declarator of its const, not mixed with other declarators in one declaration.',
        loc: locFromNode(site.call),
        hint: "Split the declaration: const theme = $inject('theme'); const other = 5;",
      });
    }

    // ROZ130 — first argument is not a string literal.
    const keyArg = site.call.arguments[0];
    if (!keyArg || !t.isStringLiteral(keyArg)) {
      diagnostics.push({
        code: RozieErrorCode.INVALID_INJECT_KEY,
        severity: 'error',
        message:
          "$inject(key, fallback?) requires a string-literal key, e.g. $inject('theme'). Dynamic/computed keys are not supported.",
        loc: locFromNode(keyArg ?? site.call),
        hint: 'Pass a string-literal context key as the first argument.',
      });
    }
  }
}
