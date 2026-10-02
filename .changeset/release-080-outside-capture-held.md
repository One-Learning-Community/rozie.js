---
"@rozie-ui/listbox-angular": patch
"@rozie-ui/listbox-svelte": patch
---

Regenerated with the capture-phase `.outside` listener: the click-outside close now runs before the consumer's own click handlers, as on the other four targets (and a click on an option that removes its own element can no longer look like an outside click).
