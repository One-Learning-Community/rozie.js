# Diagnostics — ROZ code reference

Every compile-time diagnostic Rozie emits carries a stable `ROZxxx` code. When the
compiler reports a problem, the code appears alongside the message and a source-located
code frame — for example `ROZ204: …`. This page is the lookup table: search for the code
you hit in your terminal and land on its severity and cause.

The codes are **public API** — a code string never renumbers across versions. (The
internal member name shown in muted text next to each code may be renamed for clarity, but
the `ROZxxx` string is the contract.)

## How to read this page

This entire reference is **generated at docs-build time** by scanning the compiler's own
diagnostic registry (`packages/core/src/diagnostics/codes.ts`). It can never drift from the
compiler — every code the compiler knows about appears below, grouped into the same clusters
the source file uses.

- **Code** — the stable `ROZxxx` string, with the internal member name in muted text.
- **Severity** — `error` halts compilation; `warning` is advisory; `-` means the registry
  comment doesn't state a severity explicitly (many parse-level codes only describe the cause).
- **Cause** — a one-line summary drawn directly from the registry comment. Where a comment is
  absent, this is `-`. Nothing here is invented; the page surfaces only what the source documents.

For the human-readable narrative behind many of these — `$model` write rules, `r-match` error
boundaries, `$classSelector` validation, listener-element rules — see
[Features & design choices](/guide/features).

```rozie-diagnostics
```
