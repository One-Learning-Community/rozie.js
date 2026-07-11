/**
 * unwrapMustache — shared strip primitive for the "child node emits a bare
 * `{...}` mustache but the caller needs to splice it into JS-EXPRESSION
 * position" bug class (R10-1 conditional, R11-1 loop).
 *
 * A `<slot>` (and some conditional/loop compositions built on top of one)
 * lowers to a bare `{expr}` JSX-expression mustache. When that string is
 * spliced directly into another JS-expression position — a `&&`/ternary
 * operand (emitConditional's `renderBranchBody`, R10-1) or a render-callback
 * arrow body (emitLoop, R11-1) — the two `{ }` collapse: `{cond && {expr}}`
 * is a block/object-literal in JSX logical position (invalid JSX), and
 * `item => {expr}` is an ARROW BLOCK BODY with no `return` (valid JS, but the
 * callback silently yields `undefined` — the loop renders NOTHING).
 *
 * `stripBalancedMustache` is STRIP-ONLY: it returns the inner string (or
 * `null` when the input isn't a `{...}` mustache). It is deliberately NOT a
 * "returns `(inner)`" helper — callers decide whether to parenthesize.
 * React's R10-1 `renderBranchBody` and R11-1 `emitLoop` both parenthesize
 * (`(${inner})`); Solid's R10-1 `buildShow` fallback-attribute site does
 * NOT (the `fallback={ }` attribute already supplies the delimiters) — see
 * the sibling `packages/targets/solid/src/emit/unwrapMustache.ts` for that
 * asymmetry. Matches the EXACT `startsWith('{')/endsWith('}')/length > 2`
 * heuristic already used by the `emitSlotInvocation.ts` un-wrap precedent —
 * a simple first/last-char + length check, NOT a real brace-balance parse —
 * so byte output stays unchanged when routing existing call sites through
 * this helper.
 *
 * @experimental — shape may change before v1.0
 */

/**
 * Strip the outer `{` / `}` from a bare JSX-expression mustache string.
 *
 * @param s - A rendered JSX child string (e.g. the return value of `emitNode`).
 * @returns The inner expression text when `s` is a `{...}` mustache
 *          (`s.startsWith('{') && s.endsWith('}') && s.length > 2`), else `null`.
 *          Callers decide whether to re-wrap the result in parens.
 */
export function stripBalancedMustache(s: string): string | null {
  if (s.startsWith('{') && s.endsWith('}') && s.length > 2) {
    return s.slice(1, -1);
  }
  return null;
}
