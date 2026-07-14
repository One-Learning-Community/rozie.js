---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Add a pluggable ranking/scoring seam with query-match highlighting, and three
new display-only option-row slots (`#icon` / `#trailing` / `#actions`).

**Scoring seam:** `CommandPalette` now accepts an optional `score` prop —
`(item, query) => number | null` — to customize how `items` are ranked and
filtered. Return `null` to exclude an item from the results; higher numbers
rank first. Leave it unset to use the new built-in fuzzy-subsequence scorer,
which matches the query against each item's `label` (weighted above its
`keywords`) and ranks stronger matches first.

**Behavior change:** the built-in default matching changed from 0.1.0's plain
substring filter to fuzzy-subsequence matching. This is **more permissive** —
queries that previously matched nothing (because the characters weren't
contiguous) may now match and rank an item. Ordering may also differ, since
results are now ranked by match strength rather than left as a simple
filtered subset in source order. Empty/whitespace queries are unaffected —
`items` are still returned in source order.

Query-matched characters in each visible option's label are now highlighted
(a `.rozie-command-palette-option-label-match` class on the matched runs,
themeable via `--rozie-command-palette-match-*` custom properties) — this
applies regardless of whether the built-in scorer or a custom `score` is
used, since highlighting is computed independently from the label + query.

**Option-row slots:** the default `#option` row gained three additive,
display-only scoped slots — `#icon` (`{ option }`), `#actions`
(`{ option, actions }`), and `#trailing` (`{ option }`) — laid out as
`[icon] [label + group] <spacer> [actions] [trailing]`. None render anything
when left unfilled, so existing consumers of the default row are unaffected.
Items may now carry optional `icon` and `actions` fields; both are
display-only and ignored by ranking.
