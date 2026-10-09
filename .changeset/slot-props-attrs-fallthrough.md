---
"@rozie/core": patch
---

React and Solid: a component's own slot props are no longer part of the attribute pass-through spread onto the root element. The rest bucket already skipped declared props and emit-handler props; the slot members the props interface declares (`<name>Slot` and `slots` on Solid; `render<Name>`, `children` for a declared default slot, and `slots` on React) were the missing third group. On Solid a consumer's slot render function was written to the DOM as an attribute holding the function's source (for example `toastslot="({toast:e,dismiss:n})=>…"`), and a `slots` record as a serialized object. A component with no slots compiles to the same rest-bucket code as before. Vue, Svelte, Angular and Lit were never affected.
