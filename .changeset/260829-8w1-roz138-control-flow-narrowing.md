---
"@rozie/core": patch
---

ROZ138 (React stale-read) no longer fires when the write it would pair with the read is
provably unreachable before that read — either because the write sits in a branch that
`return`s/`throw`s before control can fall through to the read, or because the write and
the read sit in mutually exclusive `.consequent`/`.alternate` arms of the same `if`
statement. The diagnostic still fires on the genuine bug shape it was built for: a write
inside a plain (non-returning) conditional followed by a read after the `if`, and a
write-then-read within the same branch.

Previously the validator's dominance test was a raw textual offset comparison with no
branch/loop reasoning, so a write buried in a `return`ing arm or an `else`-exclusive arm
still "dominated" every later read in the function body — even though that write could
never actually run on the same path as the read. On the shipped `packages/ui` corpus this
produced 24 warnings, 100% of them false positives, concentrated in the two components
(`SortableList`, `DataTable`) that are already the most carefully engineered against this
exact React footgun. Narrowing the analysis to two sound control-flow suppressions (still no
general CFG — no loop-iteration reasoning, no cross-function/async-window reasoning) drops
that count to 3, all in `DataTable`'s `clampActiveCell`, where a real (if currently harmless)
React-vs-others control-flow divergence exists.

`.rozie` authors do not need to change anything — this is a diagnostic-only compiler fix.
Emitted output is byte-identical across all six targets; no `@rozie-ui/*` leaf package
requires a version bump.
