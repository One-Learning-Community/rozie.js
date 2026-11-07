---
"@rozie-ui/data-table-react": patch
"@rozie-ui/data-table-vue": patch
"@rozie-ui/data-table-svelte": patch
"@rozie-ui/data-table-angular": patch
"@rozie-ui/data-table-solid": patch
"@rozie-ui/data-table-lit": patch
---

Docs: `virtual` is chosen when the table mounts. Changing it afterwards isn't supported, so remount the table instead (for example with a `:key`). `columnLines` notes that each line takes 1px inside the cell, so unpinned columns outside column windowing render 1px wider.
