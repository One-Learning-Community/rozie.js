---
"@rozie/core": patch
---

On React, a `$computed` value read bare from inside a `$onMount`-registered callback now
observes the CURRENT value instead of the first render's frozen snapshot, matching
Vue/Svelte/Angular/Solid/Lit.

`$computed` lowers to `const C = useMemo(() => ..., deps)`. `$onMount` lowers to a `[]`-dep
`useEffect` by contract (mount-once). A long-lived callback registered inside that effect and
reading `C` bare previously captured the FIRST render's value forever — even though the
`useMemo` recomputes on every dependency change, React never re-creates a mount-once closure
to observe the recomputation. The read is now routed through a synced ref
(`_<C>Ref.current`), the same live-ref treatment already applied to reactive state and model
props read from a mount body.

`.rozie` authors do not need to change anything — this is a compiler-side fix. A computed read
from a non-mount hook (`$onUpdate`), a locally-shadowed name, or a computed read only from the
template is unaffected, byte-identical.

No `@rozie-ui/*-react` leaf package requires a version bump from this change: a corpus-wide
post-lower census (12 `.rozie` files pairing `$computed` with `$onMount`) found zero shipped
sites that read a computed bare from inside a mount body. The three production workarounds
this defect otherwise motivated (`FlowCanvas.portTypeOf`, `DataTable.table` /
`refreshRowModel`, `PdfViewer`'s `$watch` hand-off) all deliberately avoid `$computed` in a
mount-read position for independent reasons and are left unchanged.
