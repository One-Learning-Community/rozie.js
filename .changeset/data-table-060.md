---
"@rozie-ui/data-table-react": minor
"@rozie-ui/data-table-vue": minor
"@rozie-ui/data-table-svelte": minor
"@rozie-ui/data-table-solid": minor
"@rozie-ui/data-table-lit": minor
"@rozie-ui/data-table-angular": minor
---

Three new capabilities, a cross-target `<select>` correctness fix, an extensive keyboard/a11y
hardening pass, and the theming + packaging fixes shared with the rest of this release.

**`getRowId` — selection and expansion now follow the row, not its position.** `table-core`
keys `rowSelection`/`expanded` by row position unless given a `getRowId`, so a row inserted
above a checked one silently moved the selection (and an open detail row) onto a different row.
New prop `getRowId: (originalRow, index, parentRow?) => string | number`. The active cell and an
in-progress edit remain positional by design of the grid — a push insert above them still shifts
the keyboard cursor; that is a separate, deliberately deferred design question.

**`row-activate` — open a row by click, or Enter in grid mode.** New event
`row-activate { row, index, trigger }` (`trigger` is `'click' | 'keyboard'`) for list-style use
(e.g. opening an email thread). Fires on a plain click outside any control in the clicked cell,
or on Enter over a non-editable, control-less cell in grid mode; never on group-header or detail
rows, selection gestures, drag-select, or a `singleClickEdit` click. Table mode is click-only (no
row focus there). Purely additive.

**Virtual lazy loading — sparse data up to `rowCount`, placeholder rows, and a
`visible-range-change` event.** Under `virtual` + `manual` + `rowCount`, `data` may now be
sparse: any `undefined`/`null` entry, or anything past `data.length`, is treated as a
not-yet-loaded row and fed to `table-core` as a cached placeholder. Placeholder rows carry
`aria-busy`, a new `#placeholder` scoped slot per data cell (`{ index, columnId }`, default a
skeleton bar), and are excluded from selection, expansion, editing and activation. New event
`visible-range-change { start, end }` reports the rendered window (overscan included) over the
full row space, deduped, so a consumer can fetch the rows currently on screen. Placeholder rows
are keyed `__rdt_ph_<index>` until they fill.

**Fixed: a filled placeholder row's cached measured size now migrates to its real id** (and the
migration is compatible with `@tanstack/virtual-core` `<=3.14`, whose cache-invalidation shape
differs from `3.15+`). Previously, when a lazy-loaded placeholder row filled with real data and
changed id, the virtualizer's size cache kept the stale entry — the new id had no cached size,
got re-estimated, and every re-keyed row's remeasure nudged the scroll anchor (measured: -4px per
row on React). No API surface change; this is purely an internal scroll-anchoring correctness fix
for `virtual` + `manual` + `getRowId` tables that lazy-fill placeholder rows.

**Cross-target — a bound `<select>`'s value now survives its own options rendering after it**
(Lit and Angular only; see the `@rozie/core` changeset in this same release for the emitter-level
fix). Consumer-visible symptom before this fix: a `<select>`-backed editor or filter could commit
whatever option happened to render first, not the value you set.

**An extensive keyboard/a11y hardening pass**, covering (non-exhaustively): pinned columns now
stick exactly past the pinned columns before them; a header-active-cell move that reaches an
off-window column keeps the tab stop; the active row stays rendered when the viewport scrolls it
away; Ctrl+Shift+Arrow extends a range from its focus corner rather than the active cell;
Shift+Space selects the row and Ctrl+Space the column, Escape drops an in-progress range; the
`GroupBar` is now fully keyboard-operable; the grid keymap now reaches a custom `#editor`
drop-in; the clipboard cluster (copy/cut/paste/fill/delete) is closed and each operation
announces the correct verb to assistive tech instead of always saying "pasted"; the column axis
and cell-range selection now carry a real accessible surface (`aria-colindex`/`aria-colcount` on
header and body cells, matching the row-axis equivalent that already existed); filter re-sync and
date-coercion edge cases are fixed; every built-in drop-in editor (not just `EditorText`) now
focuses on open and refocuses correctly on a reactive re-open; `width` now actually maps to the
underlying column `size` (it was previously a fully inert documented prop); a text filter's
commit timing no longer races the input's own draft write; and column headers announce their
label text to assistive tech instead of the raw column id.

**Theming — design-system bridges now yield to an ancestor's own tokens, and apply correctly on
Lit.** Same fix as every other themed family in this release: previously a bridge (`bootstrap`,
`material`, `shadcn`) assigned the tokens it maps directly on the table's own class, which always
beats an ancestor's value by CSS specificity rules regardless of import order — so with a bridge
imported, an ancestor override of a public `--rozie-data-table-*` token had no effect, and on Lit
(whose classes render inside a shadow root) every bridge was completely inert. Bridges now
redeclare only the wiring they map, with the design system's own variable as the fallback,
resolved at the table itself — so it follows the nearest theme scope and works identically
whichever CSS is imported first.

**Fixed: the toolbar keeps its shape under a host page's typography CSS.** A host page that
styles bare `<summary>` elements (VitePress, Tailwind's `prose`, most CMS themes) grew the
column-visibility `<details>` and stretched the search input to match, because the component set
padding/border but not margin on its own `<summary>`. `margin: 0` is now set explicitly.

**Solid packaging.** `@rozie-ui/data-table-solid` ships the same compiled-JS-by-default,
JSX-under-the-`solid`-condition packaging shape as every other published Solid leaf this release
— see the dedicated Solid packaging changeset for the full description. No API change.

No breaking type-shape change: the public `.d.ts` surface only grows (`getRowId`, the
`row-activate` event, the `visible-range-change` event, and the `#placeholder` slot scope).
