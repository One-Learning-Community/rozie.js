---
"@rozie/runtime-solid": patch
---

Added `pickListeners`, a runtime helper consumed by Rozie-emitted Solid components. Fixes a bug
where a component root with both its own `class`/`style` AND a directly-bound native listener
(e.g. `@click`) let a consumer's pass-through props silently overwrite that `class`/`style` —
the emitter's R6 all-fire listener merge was passing the WHOLE pass-through props bucket into
`mergeListeners`, not just its listener keys. `pickListeners` filters an opaque props bucket down
to its `on*`-prefixed, function-valued keys before the merge, so non-listener keys (class, style,
aria-\*, data-\*, …) never re-enter it. Affects every compiled Solid component whose root has an
owned class/style plus a directly-bound listener (`dialog-solid`, `switch-solid`,
`pagination-solid`, `toast-solid` in this release).
