---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Added interactive secondary actions (the "⌘K-within-the-palette" pattern):
each result row may now carry its own `actions?: [{ id, label, icon?,
shortcut?, disabled? }]` array, opened via a configurable `actionKey` prop
(default `"$mod+k"` — ⌘K/Ctrl+K), a caret-at-end Right-arrow, or clicking the
row's `#actions` affordance (now interactive — was display-only). Selecting
an action fires the new `action-select` event (`{ item, action }`); the new
`closeOnAction` prop (default `true`) controls whether running an action
also closes the palette.

Opening the menu moves real DOM focus into the first enabled `role="menuitem"`
while the result list stays visibly open. Inside the menu: ↑/↓ rove over
enabled actions (disabled entries are skipped, clamped at the ends); Enter/
Space fires `action-select` and always closes the menu; Escape/← close the
menu, restore focus to the search input, and reopen the result list — they do
**not** pop a level or close the palette (a sub-surface being open always
takes precedence over level-pop, which always takes precedence over closing
at the root). Pushing or popping a level while the menu is open closes it
first.

New slot `actionItem` (scope `{ action, item, active, disabled }`) customizes
each menu row; the existing `actions` slot is unchanged (its display scope
`{ option, actions }` still works — it now also doubles as the click
affordance that opens the menu). No new imperative handle verb was added.

This release also requires the sibling `@rozie-ui/combobox-*` packages at a
version carrying the `pinOpen(boolean)` imperative handle verb (added in the
`combobox-keepopen` change) — the action flyout uses it to keep the result
list open while it holds focus.
