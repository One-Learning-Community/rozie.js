---
"@rozie/core": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/date-picker-solid": patch
"@rozie-ui/embla-solid": patch
"@rozie-ui/popover-solid": patch
"@rozie-ui/sortable-list-solid": patch
"@rozie-ui/tags-solid": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/toast-solid": patch
"@rozie-ui/data-table-solid": patch
---

Solid: slot scope values are now passed as lazy getters instead of eager reads.

A scoped slot invocation used to build its param object as `{ open: open() }`. Because that object is constructed inside the JSX insert that invokes the slot, Solid subscribed the **insert itself** to every signal read while building it — so any change re-ran the insert, re-invoked the consumer's slot function, and replaced the rendered subtree. Emitting `{ get open() { return open(); } }` defers the read into the consumer's own reactive scope, which is Solid's own convention for passing reactive props.

Observable fix: opening the data-table column menu no longer tears the just-focused trigger out of the DOM, so the documented "Escape returns focus to the trigger" guarantee now holds on Solid as it already did on the other five targets.

Literals and function-valued expressions are deliberately left as plain properties — neither can read a signal, and wrapping a function would hand the consumer a new identity on every property access.

Note for consumers: destructuring a slot scope (`({ option, index }) => …`) and spreading it behave exactly as before. The one behavior change is that **assigning** to a scope property now throws `TypeError: Cannot set property x of #<Object> which has only a getter`, where it previously succeeded silently. Writing to a slot scope was never a supported pattern.

`@rozie/core` is named here even though no file under `packages/core/` changed: the emitter lives in the private `@rozie/target-solid` package, which is bundled into core's published dist (and into `unplugin`, `babel-plugin`, and `cli`). A changeset derived from changed paths alone would ship a toolchain that still emits the bug.
