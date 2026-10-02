---
"@rozie-ui/listbox-react": patch
"@rozie-ui/listbox-vue": patch
"@rozie-ui/listbox-svelte": patch
"@rozie-ui/listbox-angular": patch
"@rozie-ui/listbox-lit": patch
---

`id` now defaults to `''`, and each listbox generates a unique id base after mount (`rozie-listbox-<n>`). Every listbox left at the default used to share the listbox id and the option ids (`rozie-listbox-list`, `rozie-listbox-opt-<i>`), so `aria-activedescendant` / `aria-controls` could resolve to another instance on the same page. An explicit `id` is used as before.
