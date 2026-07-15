---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

New prop `defaultItems` — a first-class empty/home view, resolved **per
level**. The top-level `defaultItems` prop is the ROOT level's home view; a
navigating item's own `defaultItems` field (alongside its `children`/
`source`) is that child level's home view, captured onto its pushed level
exactly like `title`/`placeholder` already are.

Whichever `defaultItems` is active renders as soon as the query is empty (on
open, and whenever the query is cleared) and switches to scored `items`/
`source` results the moment the user types; clearing returns to
`defaultItems` again. They compose with grouped commands for free — an entry
carrying a `group` field renders in its labeled section. Scoring never
reorders `defaultItems` — they render in author order, since an empty query
short-circuits before ranking runs.

This is the first-class replacement for branching on `query === ''` inside a
`source` function to return a "default" view, and the natural home for a
recents/frecency list (it composes with the `score` prop's own
recency-boost hook). Pushing a level whose item carries `defaultItems` shows
that home view immediately — no loading flash, and `source('')` is never
invoked.

A palette (or level) with no `defaultItems` set is byte-behavior-identical
to before this feature — the full, unfiltered `items`/`children` list in
source order.
