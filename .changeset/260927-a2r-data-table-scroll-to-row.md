---
"@rozie-ui/data-table-react": minor
"@rozie-ui/data-table-vue": minor
"@rozie-ui/data-table-svelte": minor
"@rozie-ui/data-table-angular": minor
"@rozie-ui/data-table-solid": minor
"@rozie-ui/data-table-lit": minor
---

Added `scrollToRow(index, options?)` and `getScrollElement()` to the DataTable imperative handle.

Previously, scrolling a `virtual` table to a specific row programmatically meant reaching into the internal `.rdt-scroll` class selector — the only prior way to do it, and one that breaks on any internal refactor. `scrollToRow` closes that gap: it mirrors TanStack virtual-core's own `scrollToIndex` API shape exactly, forwarding `options` (`{ align?: 'start' | 'center' | 'end' | 'auto', behavior?: 'auto' | 'smooth' | 'instant' }`) unchanged. `getScrollElement()` returns the same `.rdt-scroll` DOM node the row/column virtualizer(s) observe, for a consumer that wants to read scroll position directly.

Both verbs are independent of `focusCell`'s grid-mode focus — `scrollToRow` never moves the roving active cell or fires `activecell-change`, and is callable in either `interactionMode`, table or grid. Both are safe no-ops/`null` when the table is not `virtual`.
