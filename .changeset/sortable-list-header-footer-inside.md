---
"@rozie-ui/sortable-list-react": patch
"@rozie-ui/sortable-list-vue": patch
"@rozie-ui/sortable-list-svelte": patch
"@rozie-ui/sortable-list-angular": patch
"@rozie-ui/sortable-list-solid": patch
"@rozie-ui/sortable-list-lit": patch
---

`#header` and `#footer` render inside the list element again, before and after the rows, as they did before 0.3.0. They sit inside the `listClass` box and its drop area. Indices still count item rows only. On Lit, an unfilled header or footer adds nothing to the list, so a mouse drop into an empty list still lands.
