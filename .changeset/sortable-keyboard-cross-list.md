---
"@rozie-ui/sortable-list-react": minor
"@rozie-ui/sortable-list-vue": minor
"@rozie-ui/sortable-list-svelte": minor
"@rozie-ui/sortable-list-angular": minor
"@rozie-ui/sortable-list-solid": minor
"@rozie-ui/sortable-list-lit": minor
---

Keyboard users can now move rows between lists. While a row is lifted, Shift plus an arrow key hops it to the previous or next list that shares its `group`, honouring the same `pull`/`put` rules as a mouse drag (function-valued `pull`/`put` are not reachable by keyboard). A forward hop lands at the top of the next list, a backward hop at the bottom of the previous one. New props: `listLabel` (names the list for `aria-label` and announcements), `orientation` (`'horizontal'` swaps the arrow keys), `pageStep` (Page Up/Down distance, default 5) and `keyboardInstructions` (replaces the spoken instructions). Home, End, Page Up and Page Down also work while a row is lifted. The list container gets `role="list"`, rows reference the instructions through `aria-describedby`, and the default slot receives an `instructionsId` for handle buttons. Every `add`, `remove`, `change`, `start` and `end` payload now carries `interaction: 'pointer' | 'keyboard'`, and keyboard lifts fire `start` and `end`.

Fixed: Escape now cancels a lift and returns the row to where it was lifted, in the origin list and position. Before, it only left the row where the last move put it. This is a correction to documented behaviour (the package is pre-1.0), so it ships in a minor release.

Changed: Shift+arrows in grouped lists now hop between lists rather than being ignored.

Also fixed on Angular: the lifted-row class is now applied while a row is lifted, and SortableJS's own DOM events no longer leak to the host element as extra component events.
