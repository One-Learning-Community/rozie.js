---
"@rozie/core": patch
---

Fixes a `??`/`?:` operator-precedence defect in the React target's slot-invocation emitter that could silently mis-render or throw when a dynamic-name (family) slot's inline fallback was itself a nested `<slot>` invocation (or an interpolation, `r-if`/`r-else`, or `r-match`/`r-case` node) — for example, a `cell-<columnId>` family slot whose fallback content is the generic `#cell` slot.

`renderInvocationFallback` strips the `{…}` wrap off a single-child fallback so it can be spliced into a `` `${fieldRef} ?? ${fallback}` `` expression. When that fallback child's own emission was already a bare top-level `cond ? a : b` (or `??`-chain) — which is exactly what a nested slot invocation, an interpolation whose author-written expression is a ternary, an `r-if`/`r-else`, or an `r-match`/`r-case` produces — the unparenthesized splice mis-parsed as `(fieldRef ?? cond) ? a : b` instead of the intended `fieldRef ?? (cond ? a : b)`. Because `??` binds tighter than `?:`, an off-type non-function entry in a `slots` record with no generic fill would then either throw `TypeError` (calling `undefined` as a function) or silently render the wrong branch, even though the passed value was itself a valid, truthy fallback node.

The fix parenthesizes the stripped fallback expression at the single shared strip point in `renderInvocationFallback` whenever the fallback child's own emission is a bare top-level JS expression — `TemplateInterpolation`, `TemplateSlotInvocation`, `TemplateConditional` (`r-if`/`r-else`), and `TemplateMatch` (`r-match`/`r-case`). JSX-element fallbacks and string-literal fallbacks are unaffected — they never reach this branch, so their emitted output is unchanged.
