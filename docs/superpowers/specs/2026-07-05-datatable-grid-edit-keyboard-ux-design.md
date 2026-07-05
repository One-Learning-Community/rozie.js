# DataTable grid-edit keyboard UX — design

**Date:** 2026-07-05
**Status:** Approved (design), pending implementation
**Component:** `@rozie-ui/data-table` (canonical `packages/ui/data-table/src/*` + drop-ins + `examples/demos/DataTableSuperDemo.rozie`)

## Problem

Dogfooding the super data-table demo in **grid mode** surfaced inconsistent keyboard
behavior when entering a cell editor, differing by cell type:

- **Boolean / checkbox:** entering edit shows a checkbox, but Space (the natural toggle
  key) commits and *ends* edit mode in one keystroke, so there's no way to deliberately
  toggle — the whole "open an editor, then commit" ceremony is the wrong shape for a
  two-state value.
- **Date:** in edit, ArrowUp/ArrowDown steps the focused date segment (native
  `<input type="date">` behavior) **and immediately commits** each nudge. A user pressing
  Down does not expect the stored date to change on every keypress — unexpected UX and
  "bad form" (a stream of half-formed committed values, one `cell-edit-commit` per nudge).
- **Select:** same class as date — a focused `<select>` cycled with arrows fires `change`
  per option, each committing (and closing) the editor.
- **Text:** an intermittent "my input wasn't committed" report that could not be
  reproduced. **Out of scope** for this pass; revisit with a concrete repro.

## Root cause

There are two editor code paths per column:

1. **Built-in editors** (`DataTable.rozie`, keyed on `editorTypeOf`: `text` | `number` |
   `select` | `checkbox`) — these **defer commit**: interaction updates `draftValue`
   (`onCellEditorInput` / `onCellEditorCheckbox`), and commit happens on Enter/Tab/blur via
   `onEditorKeyDown` / `onEditorBlur`. This is the correct behavior.
2. **Drop-in editors** (`EditorText`, `EditorNumber`, `EditorSelect`, `EditorCheckbox`,
   `EditorDate`) routed through the `#editor` custom slot (`editor="custom"`).

The demo wires **every** editable column as `editor="custom"` → the drop-ins. And three of
the drop-ins — `EditorCheckbox`, `EditorSelect`, `EditorDate` — use
**immediate-commit-on-`change`**. `change` is fine for a single deliberate mouse gesture,
but fires on **every keyboard-driven value nudge**, each of which commits (and, in
single-cell mode, closes the editor). `EditorText` / `EditorNumber` already defer (draft on
`@input`, commit on Enter/blur) — the three immediate-commit drop-ins are the outliers.

Separately, a **boolean** value doesn't fit the enter-edit → manipulate → commit model at
all: with exactly two states, the editor ceremony is the wrong shape.

## Design decisions (locked with the user)

1. **Boolean cells toggle in place, no edit mode** (spreadsheet standard — Excel / Sheets /
   AG-Grid). On the active boolean cell, Space / Enter / F2 flip and commit the value
   instantly; no editor opens; type-to-edit is disabled.
2. **Date + select editors defer everything to Enter/blur** — keyboard nudges *and* mouse
   picks update the draft only; commit happens on Enter, Tab, or click-away (blur).
   Consistent with Text/Number and the built-ins; cross-browser safe; no change-source
   sniffing. Accepted trade-off: a mouse pick needs one follow-up gesture (Enter/Tab/
   next-cell) to persist — which the normal grid flow already provides.

## Change 1 — Boolean in-place toggle (framework)

Applies to built-in `editor:'checkbox'` columns in **single-cell** grid navigation only.
Full-row edit mode (Shift+F2) is unaffected (the `onGridKeyDown` early returns at
`editingRow >= 0` / `editingRowIndex != null` already exclude it), and the built-in
checkbox editor markup + the `EditorCheckbox` drop-in are untouched.

### 1a. New funnel `toggleActiveBooleanCell()` — `editCellLifecycle.rzts`

Flip the active cell's value and commit through the **exact same write path** as
`commitEdit`, without opening an editor:

- Resolve `colId = columnIdAt($data.activeRow, $data.activeColIndex)`; no-op if null / not
  `columnEditable`.
- `oldValue = cellValueAt(activeRow, activeColIndex)`; `newValue = !oldValue`.
- Run the column validator (`runValidator`); on rejection `setInvalid(err)` and abort (no
  model write) — same D-01 discipline as `commitEdit` (there is no editor to keep open, so
  the toggle simply does not apply).
- `field` = `defFor(colId).accessorKey ?? colId`; `srcIndex = sourceIndexOfRow(activeRow)`.
- `writeData(replaceRowValue(currentData(), srcIndex, field, newValue))`.
- Emit **exactly one** `cell-edit-commit { rowId, columnId, oldValue, newValue }` from this
  single call site (mirrors `commitEdit`'s D-07 single-emit discipline; `writeData` does not
  emit).
- Set `pendingEditFollow = { rowOriginal, rowId, col: activeColIndex }` so focus follows the
  toggled row if a boolean sort/filter relocates it, and survives a fine-grained re-render
  (Solid keyed-row replace) — the same mechanism `commitEdit` uses. No editor unmounts, but
  `writeData`'s re-render can still drop focus.

Export `toggleActiveBooleanCell`; add it to the `editCellLifecycle.rzts` import list in
`DataTable.rozie` (`:1172`) so the flattened component scope reaches it — the same wiring as
`beginEdit`. `onGridKeyDown` (in `gridKeydownHandlers.rzts`) then references it as a free
variable, exactly as it already references `beginEdit` / `editorTypeOf` /
`isActiveCellEditable`.

### 1b. `onGridKeyDown` branches — `gridKeydownHandlers.rzts`

Before the generic Enter/F2 edit-entry branch (`:114`) and after the Shift+F2 full-row
branch (`:107`), add a checkbox fast-path:

```
else if ((key === 'Enter' || key === 'F2' || key === ' ') &&
         isActiveCellEditable() && editorTypeOf(activeCellColumnId()) === 'checkbox') {
  e.preventDefault(); toggleActiveBooleanCell(); return
}
```

And exclude checkbox columns from the printable-key type-to-edit branch (`:117`) — add
`&& editorTypeOf(activeCellColumnId()) !== 'checkbox'` — so a stray printable key on a
boolean cell never opens the draft editor (type-to-edit disabled). Other printable keys then
fall through to native (no-op on a cell).

`Space` currently satisfies `key.length === 1` and would otherwise open the built-in
checkbox draft editor; the new branch intercepts it first for checkbox columns only. Text /
number cells keep their existing Space-seeds-editor behavior unchanged.

## Change 2 — `EditorDate` defers commit

`EditorDate.rozie`: in `onChange` (`:94`), drop the `doCommit()` call — update the draft
only:

```
const onChange = (e) => { $data.draft = e && e.target ? e.target.value : '' }
```

`onKeydown` already commits on Enter and cancels on Escape; `onBlur` already commits.
Segment arrows (native, fire `input`/`change`) now update the draft without committing;
commit is Enter/Tab/blur. Update the file's header comment to state deferred-commit.

## Change 3 — `EditorSelect` defers commit

`EditorSelect.rozie`: convert immediate-commit to draft-based, mirroring `EditorDate`:

- Add `<data>{ draft: '' }</data>`; seed once in setup: `$data.draft = $props.value != null
  ? String($props.value) : ''`.
- Bind `:value="$data.draft"` (replacing the `selectValue()` helper).
- `@change` updates the draft only (no commit).
- `@keydown`: Enter → `commit(draft)` (preventDefault), Escape → `cancel()`.
- `@blur` → `commit(draft)`.

Arrow-cycling a focused `<select>` now updates the draft without committing; commit is
Enter/Tab/blur. Update the header comment to state deferred-commit.

## Change 4 — Demo uses the built-in checkbox

`examples/demos/DataTableSuperDemo.rozie`:

- `:385` — change the `active` column from `editor="custom"` to `editor="checkbox"` so it
  exercises the built-in in-place toggle (Change 1). Same rendered checkbox markup.
- `:407–410` — remove the `<EditorCheckbox r-else-if="columnId === 'active'">` branch from
  the `#editor` slot dispatch (the slot is no longer invoked for `active`). The remaining
  `r-if`/`r-else-if`/`r-else` chain stays valid.
- Remove the now-unused `EditorCheckbox` import / components-registry entry (`:154`).

The other columns keep their (now-corrected) drop-ins: category/status → `EditorSelect`,
amount → `EditorNumber`, orderedAt → `EditorDate`, customer/text → `EditorText`.

## Out of scope (with rationale)

- **Text intermittent non-commit** — no reproduction. Revisit with concrete steps.
- **`EditorCheckbox` drop-in** — left immediate-commit. Single-cell boolean should use the
  built-in `editor:'checkbox'` (in-place toggle); in full-row edit mode the drop-in's
  `commit(v)` routes to `setRowDraft` (writes the row draft, no per-cell commit), so its
  immediate-`@change` is harmless there. A consumer wiring it as a custom single-cell editor
  keeps editor semantics by choice.
- **Auto-open native picker on entry** (`showPicker()`) — nicer native feel but uneven
  cross-browser support across the six targets; deferred.

## Testing (behavioral, not just snapshots)

Snapshot fixtures alone cement current emit; add behavioral assertions:

- **Boolean toggle:** on a built-in `editor:'checkbox'` cell, Space (and Enter, and F2)
  flips the model value, emits **exactly one** `cell-edit-commit` with the negated value,
  opens **no** editor, and keeps focus on the cell. A printable key opens no editor.
- **Boolean validator reject:** a column validator returning a string blocks the toggle (no
  model write) and sets the invalid state.
- **Date defer:** entering the date editor and stepping a segment with arrows updates the
  input but emits **no** `cell-edit-commit`; Enter (or blur) commits **once**.
- **Select defer:** cycling options with arrows emits no commit; Enter (or blur) commits once
  with the final selection.
- **Verify the "cell also moved" report:** confirm a segment/option arrow while an editor is
  open never also moves the active cell (guaranteed by the `editingRow >= 0` early return; a
  deferred commit keeps the editor open, so the compound cannot occur).

## Parity & verification obligations

Canonical `DataTable.rozie` + drop-in changes require the full data-table pipeline:

- Re-emit all six targets and re-vendor (Option-B vendoring) for `DataTable`, `EditorDate`,
  `EditorSelect`; re-compile `DataTableSuperDemo`.
- `turbo run test --force --continue` — target-suite snapshots drift on emitter/source
  change (cold run).
- `pnpm --filter dist-parity bootstrap` after `build --force` — rebless dist-parity.
- VR baselines are **Linux-rendered** — regenerate via Docker (`vr.sh -u`), not macOS.
- Run the full CI-equivalent gate (incl. Playwright e2e / VR interaction) before any push.

## Risks

- **Focus after toggle** on fine-grained targets (Solid keyed-row replace) — mitigated by
  reusing `pendingEditFollow`, the same recovery `commitEdit` relies on.
- **Mouse-pick ergonomics** for date/select — a pick now needs Enter/Tab/click-away to
  commit (accepted per decision 2; blur commits on any focus-away).
- **Emit-count regressions** — `toggleActiveBooleanCell` is a second `cell-edit-commit` call
  site; each path emits once per action (no shared-flush overlap), covered by the behavioral
  emit-count assertions above.
