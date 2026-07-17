---
"@rozie-ui/command-palette-lit": patch
---

Fix the `$attrs` auto-fallthrough skip-list to always exclude `data-rozie-ref` (a reserved compiler bookkeeping attribute, never a consumer prop) and fix author `ref="x"` bindings inside a `r-portal`-relocated subtree so they survive the portal's `appendChild` relocation instead of resolving to `null` after the first render. Both fixes land via the regenerated Lit leaf; no API change, no per-target behavior divergence.
