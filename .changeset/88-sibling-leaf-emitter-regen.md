---
"@rozie-ui/combobox-react": patch
"@rozie-ui/command-palette-react": patch
"@rozie-ui/date-picker-react": patch
"@rozie-ui/embla-react": patch
---

Regenerated with the corrected React slot-invocation emitter (see `@rozie/core`'s
`??`/`?:` slot-fallback precedence fix in this same release).

**No behavior change.** The emitter fix parenthesizes a slot fallback expression at the
single shared strip point in `renderInvocationFallback`. In these four leaves the affected
fallbacks all sit in the `:` (else) branch of a render-prop/slot ternary, where the added
parentheses are semantically inert — `cond ? x : (y)` is identical to `cond ? x : y`. The
emitted output differs textually from the published tarballs and is regenerated here so the
shipped source matches what the current compiler produces; runtime behavior is unchanged.

The defect the emitter fix closes (an off-type non-function `slots` record entry throwing
`TypeError`, or rendering the wrong branch, when a dynamic-name family slot's fallback is
itself a nested `<slot>`) is not reachable in these four components, none of which declare
dynamic-name slot families. They are regenerated for source/registry consistency only.
