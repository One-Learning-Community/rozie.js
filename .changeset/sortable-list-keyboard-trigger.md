---
"@rozie-ui/sortable-list-react": minor
"@rozie-ui/sortable-list-vue": minor
"@rozie-ui/sortable-list-svelte": minor
"@rozie-ui/sortable-list-angular": minor
"@rozie-ui/sortable-list-solid": minor
"@rozie-ui/sortable-list-lit": minor
---

New `keyboardTrigger` prop on SortableList: `'row'` (the default, today's behaviour) or `'handle'`. In handle mode only the consumer's own handle button, matched by the `handle` selector, drives keyboard reordering. Rows are no longer tab stops, so Tab goes handle, then the row's input, then the next row's handle. Space and Enter typed into an input inside a row reach the input and never lift the row. The same Space/Enter lift and drop, Arrow move and Escape cancel flow applies, with the same announcements, and focus returns to the moved row's handle after every move on all six frameworks, including a burst of quick key presses on Angular. Handled keys call `preventDefault`, so the handle button's click does not fire. If `keyboardTrigger` is `'handle'` but no `handle` selector is set, keyboard reordering is turned off and a console warning is logged rather than quietly falling back to row mode.

Also fixed: the "Moved X to position N" announcement named the row that had been displaced instead of the row that moved on React, Vue and Lit. It now names the row that moved on all six.
