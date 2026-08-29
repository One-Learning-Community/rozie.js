---
"@rozie/runtime-lit": minor
---

Lit's `$computed` now caches on its declared dependencies, matching every other compile target
(React's `useMemo`, Solid's `createMemo`, Vue/Angular's `computed`, Svelte's `$derived`). Before
this release, a Lit `$computed` compiled to a plain, uncached getter re-evaluated on every property
access — so a `$computed` returning an object or array yielded a fresh reference on every render,
defeating any downstream `$watch(() => $props.x, ...)` that expected referential stability.

New public export: `rozieMemo(host, key, deps, compute)`, a dep-value-compared memoization helper
(added to `@rozie/runtime-lit`). The Lit emitter now wires every memoizable `$computed` getter
through it automatically — no author-facing syntax change. A computed whose dependencies include a
closure call, a `$slots`/`$slotted` read, or an otherwise-unresolvable path still emits the
previous uncached getter, unchanged.

No `@rozie-ui/*-lit` leaf package requires a version bump from this change: across the full shipped
component surface, exactly one `$computed` declaration (`@rozie-ui/slider`'s `fillStyle`) exists,
and its single dependency is a closure call — so it continues to bail to the pre-existing uncached
getter, byte-identical.
