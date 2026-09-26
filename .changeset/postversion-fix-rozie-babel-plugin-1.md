---
"@rozie/babel-plugin": patch
---

Fixed a Solid-target compile bug: a component root with an owned `class`/`style` AND a
directly-bound native listener compiled the R6 all-fire listener merge over the WHOLE
pass-through props bucket, letting a consumer's own `class`/`style` silently overwrite the
component's. The Solid emitter now filters that merge down to just its listener keys
(`@rozie/runtime-solid`'s new `pickListeners`). Recompile any `.rozie` file targeting Solid to
pick up the fix.
