---
"@rozie-ui/data-table-solid": patch
---

Fixed: the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/data-table-solid`, this package's own.

**Fixed: lazy placeholder rows are now excluded from every clipboard write and from full-row
edit**, making the "excluded from selection, expansion, editing and activation" claim above
actually true. A paste, a cut, the Delete/Backspace range clear, and a fill-drag that span a
placeholder row (including a Ctrl+A that spans the whole `rowCount` space) no longer fabricate
a `cell-edit-commit` for it, inflate the N-of-M aria-live announce, or write a partial row into
the still-unloaded sparse hole; `editRow()` (and Shift+F2) on a placeholder row is now a no-op
instead of opening a row editor seeded with `undefined`s.

**Docs: the `placeholder` slot's per-target prop name is now documented**, alongside
`detail`/`groupBar`/`filter`, in the Slots section below (`renderPlaceholder` on React,
`placeholderSlot` on Solid, the `.placeholder` property on Lit, `#placeholder` elsewhere) — it
was previously listed only in the generic slots table with no naming note.
