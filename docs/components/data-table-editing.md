# Editing

By default every cell is read-only. Mark a `<Column editable>` (and bind `r-model:data` to receive the writes) to make that column's cells editable — **the component owns the edit state**: the consumer binds the single `data` model and listens for the commit events, with no manual re-sync. A committed edit writes a **fresh** `data` array back (never an in-place mutation).

```rozie
<DataTable :data="$data.rows" r-model:data="$data.rows" interactionMode="grid"
  @cell-edit-commit="onCommit($event)">
  <Column field="name" header="Name" editable editor="text" />
  <Column field="qty" header="Qty" editable editor="number" :validate="(v) => Number(v) >= 0 || 'must be >= 0'" />
  <Column field="status" header="Status" editable editor="select" :editorOptions="$data.statusOptions" />
  <Column field="active" header="Active" editable editor="checkbox" />
</DataTable>
```

A cell enters edit mode on click, on a printable keypress (which seeds the editor with that character), on `F2`/`Enter` (seeds the current value), or via the [`editCell(rowIndex, colIndex)`](/components/data-table-api#imperative-handle) verb. `Enter` commits; `Escape` cancels.

**Built-in editor types** (the `editor` Column prop): `'text'` (default `<input type="text">`), `'number'`, `'select'` (populate `editorOptions` with `[{ value, label }]`), `'checkbox'`, and `'custom'` (no built-in editor — the `#editor` slot drives it).

**Validation.** The `validate` Column prop runs synchronously on commit: return `true`/falsy to accept, or a string to reject — the editor stays open and the message is announced via an aria-live region, and `cell-edit-commit` does **not** fire. Validators are defensively wrapped (a thrown error coerces to a generic message).

**Full-row edit.** `Shift+F2` on a row (or the [`editRow(rowIndex)`](/components/data-table-api#imperative-handle) verb) opens every editable cell in the row at once; `Tab`/`Shift+Tab` move between editors. `Enter` commits the whole row in one `r-model:data` write + one `row-edit-commit` (validated together — one failure blocks the commit); `Escape` reverts the row as a unit.

**The `#editor` scoped slot** (scope `{ columnId, column, row, value, commit, cancel }`) replaces the built-in editor for a column — dispatch by `columnId`. `commit(newValue)` validates + commits (firing `cell-edit-commit`); `cancel()` closes without saving. On React/Solid it is the `renderEditor` / `editorSlot` render prop and on Lit the `.editor` property (the documented divergence).

The commit events are `cell-edit-commit` (payload `{ rowId, columnId, oldValue, newValue }`) and `row-edit-commit` (payload `{ rowId, changes }` for the columns whose value actually changed) — see the [Events](/components/data-table-api#events) reference. Drive editing imperatively with `editCell` / `editRow` / `commitEditing`.

## Drop-in editor components

The `#editor` slot is fully headless — you can render any control. For the common cases the package also ships **opt-in drop-in editor components** so you don't have to hand-roll the input wiring: `EditorText`, `EditorNumber`, `EditorSelect`, `EditorCheckbox`, and `EditorDate`. They are **additive named exports** alongside `DataTable` (which stays the headless **default** export — importing the editors is byte-identical-off if you never use them):

```ts
import { DataTable, Column, EditorText, EditorNumber, EditorSelect, EditorCheckbox, EditorDate }
  from '@rozie-ui/data-table-<target>';
// (Vue: `import DataTable, { Column, EditorText, … }` — DataTable is the default.
//  Lit: the single side-effect import registers the <rozie-editor-*> custom elements.)
```

Each drop-in takes the `#editor` slot scope as its props — `{ columnId, column, row, value, commit, cancel }` — and `EditorSelect` additionally takes `options: [{ value, label }]` (the same shape as `<Column editorOptions>`). Mark the column `editor="custom"` so the slot drives rendering, then dispatch by `columnId` inside `#editor` and forward the scope to the matching drop-in. Use them **as-is**, or fork one as a template for a bespoke editor.

| Component | Renders | Extra props |
| --- | --- | --- |
| `EditorText` | `<input type="text">` | — |
| `EditorNumber` | `<input type="number">` | — |
| `EditorSelect` | `<select>` | `options: [{ value, label }]` |
| `EditorCheckbox` | `<input type="checkbox">` | — |
| `EditorDate` | `<input type="date">` | — |

## Per-framework code

The per-target wiring is the [editable cells snippet](/components/data-table-usage#editable-cells-inline-edit-validation) and the [drop-in editor components snippet](/components/data-table-usage#drop-in-editor-components-editor) on the usage page.

## See also

- [Columns](/components/data-table-columns) — the `editable` / `editor` / `validate` Column attributes.
- [Grid mode & keyboard](/components/data-table-grid-mode) — pairs naturally with editing for spreadsheet-style entry.
- [API reference](/components/data-table-api) — the `cell-edit-commit` / `row-edit-commit` events and the editing verbs.
