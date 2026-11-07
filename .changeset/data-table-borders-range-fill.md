---
"@rozie-ui/data-table-react": minor
"@rozie-ui/data-table-vue": minor
"@rozie-ui/data-table-svelte": minor
"@rozie-ui/data-table-angular": minor
"@rozie-ui/data-table-solid": minor
"@rozie-ui/data-table-lit": minor
---

Range fill and border fixes.

- **Range fill:** with a block of cells selected, `Ctrl`/`Cmd`+`Enter` in a cell editor writes its value to every selected cell in the active cell's column. It works with built-in, drop-in and custom slot editors. Editor slots get `rangeSize` and `commit(value, { toRange: true })`. The fill follows the paste rules: invalid cells are skipped, it's one undo step with one `cell-edit-commit` per changed cell, and it's announced as "N of M cells updated". The value is written as is, not converted to text. The range stays selected while the editor is open and after the fill.
- **Checkbox ranges:** `Space` (or `Enter`/`F2`) on a checkbox range sets every selected cell to the opposite of the active cell's value.
- **Border gaps:** the 1px lines of scrolled content beside pinned columns and above the sticky header are gone. The table now uses separate borders, and each cell draws its own lines. Cells also reset their borders, so a host's global `table td { border }` rule no longer draws inside the table.
- **Pinned cells:** pinned body and filter cells are opaque, and the group-row and filter-row bands still show on them. The new `--rozie-data-table-pinned-bg` token sets their background. It defaults to `#fff` in the base theme, and to the design system's surface colour in the bootstrap, material and shadcn bridges. On a dark or tinted page, set it to the colour behind the table.
- **Column lines:** the new `columnLines` prop draws column lines plus the outer lines at the start of each row and above the header; they follow the writing direction. Their colour follows the row-line colour unless `--rozie-data-table-column-border-color` is set.
