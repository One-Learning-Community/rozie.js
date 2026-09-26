---
"@rozie/core": patch
---

Fixed a Solid-target compile bug: a component root with an owned `class`/`style` AND a
directly-bound native listener compiled the R6 all-fire listener merge over the WHOLE
pass-through props bucket, letting a consumer's own `class`/`style` silently overwrite the
component's. The Solid emitter now filters that merge down to just its listener keys
(`@rozie/runtime-solid`'s new `pickListeners`), and a root `style` bound before an opaque
attrs spread now merges with the consumer's `style` instead of being replaced by it.
Recompile any `.rozie` file targeting Solid to pick up the fix.
