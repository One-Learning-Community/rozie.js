---
"@rozie/core": patch
---

Solid: `.capture`, `.passive` and `.once` on a template `@event` are now a compile error, as they already are on Svelte, Angular and Lit. They were a warning before, and the handler was bound without the option, so a `.capture` handler silently ran in the bubble phase. Put the handler in a `<listener>` (with no `:target` it attaches to the component's root element) to use these modifiers on every target.
