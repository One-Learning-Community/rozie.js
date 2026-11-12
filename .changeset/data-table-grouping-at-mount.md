---
"@rozie-ui/data-table-react": patch
"@rozie-ui/data-table-vue": patch
"@rozie-ui/data-table-svelte": patch
"@rozie-ui/data-table-angular": patch
"@rozie-ui/data-table-solid": patch
"@rozie-ui/data-table-lit": patch
---

Fixed: on React, Solid and Lit, a table whose `grouping` was non-empty from the first render (`r-model:grouping="['category']"`, a one-way `:grouping`, or the target's equivalent binding) showed no group rows; the rows rendered ungrouped. This affects every React, Solid and Lit consumer that sets `grouping` when the table mounts. Vue, Svelte and Angular were not affected; they get the same rebuilt source with no behaviour change. Those three targets register their `<Column>` children after the table first builds its rows, and the grouped rows were built against no columns and then kept. The table now rebuilds them when its columns arrive, as it already did for `sorting` and `columnFilters`. If you worked around this by setting `grouping` after mount (for example one frame later in a mount hook), you no longer need to: bind it from the start.
