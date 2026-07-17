---
"@rozie/core": patch
"@rozie/cli": patch
"@rozie/unplugin": patch
"@rozie/babel-plugin": patch
---

Fix the `@rozie/target-lit` emitter's `$attrs` auto-fallthrough skip-list to always exclude the reserved `data-rozie-ref` attribute (compiler bookkeeping, never a consumer prop). Without this fix, a parent-assigned `ref=` on a compiled Lit component's own host tag could clobber that component's own internal `data-rozie-ref` markers via attribute fallthrough re-application. The Lit emitter is bundled into `@rozie/core` (and therefore inlined into `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`, all of which compile `.rozie` through core) — this patch corrects the emitted Lit output for every consumer compiling through any of those entry points.
