---
"@rozie/core": minor
---

Two small, additive compiler changes, made as prerequisites for Phase 85's real TypeScript type
intelligence in both editors (a Volar-based `@rozie/language-server`, consumed by VS Code and the
JetBrains Ultimate/WebStorm/PhpStorm-family plugin) — the language-server package itself is private
and does not publish; this changeset scopes only to what actually moved in `@rozie/core`'s public
contract.

**1. A completed reserved-sigil list.** `RESERVED_SIGILS` is now exported from the public barrel, and
now includes `$snapshot` and `$classSelector` — both real, shipped sigils that were previously only
tracked in a second, internal list (`reactivity/computeDeps.ts`), so shadowing either one (a `<data>`
field or an `r-for` alias named `$snapshot`, for example) compiled clean instead of raising `ROZ202`.
If your `.rozie` source happens to declare a data field, prop, or loop alias named `$snapshot` or
`$classSelector`, it will now correctly fail to compile with `ROZ202` — this is a bug fix to a
previously-silent gap, not new restrictive behavior; both names were already reserved in practice.

**2. A parser that recovers from a half-typed interpolation.** An unterminated `{{` inside
`<template>` still reports the exact same `ROZ051` diagnostic it always has — same code, same
severity, same message, same range. It now *additionally* yields a marked recovery AST node for that
span, which downstream IR lowering explicitly skips. Emitted output for every existing `.rozie` file
is byte-identical before and after this change, verified with a forced cold whole-repo rebuild across
all six targets. This exists so editor tooling reading the AST directly (as opposed to the emitted
IR) has something to answer completion/hover requests against mid-expression, while an author is still
typing a `{{ }}` block — previously the parser produced no interpolation node at all for that case.
