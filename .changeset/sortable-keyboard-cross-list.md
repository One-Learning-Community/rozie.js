---
"@rozie-ui/sortable-list-react": minor
"@rozie-ui/sortable-list-vue": minor
"@rozie-ui/sortable-list-svelte": minor
"@rozie-ui/sortable-list-angular": minor
"@rozie-ui/sortable-list-solid": minor
"@rozie-ui/sortable-list-lit": minor
---

Keyboard users can now move rows between lists. While a row is lifted, Shift plus an arrow key hops it to the previous or next list that shares its `group`, honouring the same `pull`/`put` rules as a mouse drag (function-valued `pull`/`put` are not reachable by keyboard). A forward hop lands at the top of the next list, a backward hop at the bottom of the previous one. New props: `listLabel` (names the list for `aria-label` and announcements), `orientation` (`'horizontal'` swaps the arrow keys, and the default instructions then say "Use the left and right arrow keys to move"), `pageStep` (Page Up/Down distance, default 5) and `keyboardInstructions` (replaces the spoken instructions). Home, End, Page Up and Page Down also work while a row is lifted. The list container gets `role="list"`, rows reference the instructions through `aria-describedby`, and the default slot receives an `instructionsId` for handle buttons. Every `add`, `remove`, `change`, `start` and `end` payload now carries `interaction: 'pointer' | 'keyboard'`, and keyboard lifts fire `start` and `end`.

Fixed: Escape now cancels a lift and returns the row to where it was lifted, in the origin list and position. Before, it only left the row where the last move put it. This is a correction to documented behaviour (the package is pre-1.0), so it ships in a minor release.

Changed: Shift with an arrow key used to move a lifted row within its list, exactly like the plain arrow key. Now, in a list with a `group`, Shift+arrow hops the row to the previous or next list, and in a list without a `group` it does nothing.

Changed: only one keyboard lift can exist on a page. Pressing Space or Enter on a row of another list, even one in the same group, drops the active lift and lifts that row.

Changed: SortableJS's own native DOM events (`choose`, `start`, `sort`, `filter`, `change` and the rest) no longer bubble out of the list element, on every framework. Listen to the component's documented events (`start`, `end`, `change`, `add`, `remove`) instead.

Known limitation on Lit: a plain-HTML consumer cannot point a handle's `aria-describedby` at the `instructionsId` slot prop, because an id reference does not cross the shadow root. Give the handle its own `aria-label` or description instead. Rozie consumers are not affected.

Also fixed on Angular: the lifted-row class is now applied while a row is lifted, and SortableJS's own DOM events no longer reach the host element as extra component events.
