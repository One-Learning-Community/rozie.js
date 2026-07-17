---
"@rozie-ui/toast-lit": patch
---

Fix the `$attrs` auto-fallthrough skip-list to always exclude `data-rozie-ref` — a reserved compiler bookkeeping attribute, never a consumer prop. Previously a parent-assigned `ref=` on this component's own host tag could clobber the component's own internal `data-rozie-ref` markers via fallthrough re-application. No API change, no per-target behavior divergence.
