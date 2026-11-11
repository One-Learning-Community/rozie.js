---
"@rozie-ui/data-table-react": patch
"@rozie-ui/data-table-vue": patch
"@rozie-ui/data-table-svelte": patch
"@rozie-ui/data-table-solid": patch
"@rozie-ui/data-table-angular": patch
"@rozie-ui/data-table-lit": patch
---

Editing a `getSubRows` child row no longer overwrites a different record. A child row's record is not in the top-level `data` array, and the write used to fall back to the row's visible index, replacing whichever top-level record sat there (and emitting `cell-edit-commit` for the child). Child rows now open no editor (Enter, F2, type-to-edit, click-to-edit, `Shift+F2`, `editCell` / `editRow`), the checkbox toggle declines, and paste, cut, clear and fill-drag skip them; nothing is written and no commit event fires. Editing the parent rows is unchanged. Editing sub-rows themselves is not supported.
