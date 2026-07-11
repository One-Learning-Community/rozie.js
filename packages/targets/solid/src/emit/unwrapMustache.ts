/**
 * unwrapMustache — shared strip primitive for the "child node emits a bare
 * `{...}` mustache but the caller needs to splice it into JS-EXPRESSION
 * position" bug class (R10-1 conditional, R11-1 loop).
 *
 * A `<slot>` (and some conditional/loop compositions built on top of one)
 * lowers to a bare `{expr}` JSX-expression mustache. When that string is
 * spliced directly into another JS-expression position — the `fallback={ }`
 * attribute of `<Show>` (emitConditional's `buildShow`, R10-1) or a
 * render-callback arrow body (`<For>`/`<Key>` in emitLoop, R11-1) — the two
 * `{ }` collapse: `fallback={{expr}}` is an object-literal in a JSX-attribute
 * expression (invalid), and `item => {expr}` is an ARROW BLOCK BODY with no
 * `return` (valid JS, but the callback silently yields `undefined` — the
 * loop renders NOTHING).
 *
 * `stripBalancedMustache` is STRIP-ONLY: it returns the inner string (or
 * `null` when the input isn't a `{...}` mustache). It is deliberately NOT a
 * "returns `(inner)`" helper — callers decide whether to parenthesize.
 * `buildShow`'s `fallback={ }` site does NOT parenthesize (the attribute's
 * `{ }` already supplies the delimiters — re-wrapping would double them);
 * `emitLoop`'s render-callback arrow body DOES parenthesize
 * (`(${inner})`, an arrow-EXPRESSION body needs the parens to disambiguate
 * from a block body) — see the sibling
 * `packages/targets/react/src/emit/unwrapMustache.ts` for the React-side
 * (always-parenthesize) callers. Matches the EXACT
 * `startsWith('{')/endsWith('}')/length > 2` heuristic already used by the
 * `emitSlotInvocation.ts` un-wrap precedent — a simple first/last-char +
 * length check, NOT a real brace-balance parse — so byte output stays
 * unchanged when routing existing call sites through this helper.
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
