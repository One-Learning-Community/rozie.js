# @rozie-ui/command-palette-react

## 0.2.0

### Minor Changes

- aaae31a: Add nested levels — an action-driven drill-in stack with breadcrumb/back
  navigation, per-level async sources (loading/error/race-drop), and an
  `openTo(path)` deep-link. This is the "Go to page…" hybrid-palette backbone
  and absorbs the previously-planned async-search feature.

  **Nested levels:** selecting an item that carries `children` (a static
  array) or `source` (a `(query) => items | Promise<items>` function) now
  **pushes** a child level instead of firing `select` — presence of either
  field is the navigation signal, no separate flag. Selecting a leaf item
  (no `children`/`source`) still emits `select`, and its payload gains an
  optional `path` — the id breadcrumb of levels navigated through to reach
  it.

  **Async sources:** a `source` returning a `Promise` puts its level into a
  `'loading'` status until it settles; only the LATEST in-flight request's
  result is applied (a monotonic request token drops stale resolutions from
  overlapping calls). A new `searchDebounce` prop (default ~150ms) debounces
  an async level's keystroke refetch only — a `children` level re-ranks
  locally with no debounce. New `loading` (`{ query }`) and `error`
  (`{ query, error, retry }`) slots render the in-flight/failed states
  (re-projected inside the existing `empty` region); a rejected `source`
  leaves the input usable and is retried on the next keystroke or via the
  `error` slot's `retry`.

  **Query lifecycle:** pushing a level clears the query to `''` for the child
  level; popping restores the PARENT level's query — both the two-way `query`
  model AND the visible search-box text — full undo, "back" feels like
  undo.

  **Navigation:** Backspace on an empty query pops one level; Escape pops one
  level at depth > 0 and only closes the palette at the root. A breadcrumb/
  back header renders above the input at depth > 0 (a new `breadcrumb` slot,
  scope `{ stack, back }`, overrides the default back-button + title fill).
  Two new events, `navigate` (a level was pushed, payload `{ item, depth }`)
  and `back` (a level was popped, no payload). Two new imperative handle
  methods: `openTo(path)` — deep-link straight into a nested level, drilling
  through an array of item ids from the root, async-aware (awaiting each
  hop's `Promise` source before resolving the next) — and `goBack()` — pop
  one level (a no-op at the root). The pop verb is named `goBack`, **not**
  `back`, to avoid colliding with the new `back` event.

  **Per-item title/placeholder:** a navigating item's optional `title` drives
  its level's breadcrumb/header label (falling back to `label`); its optional
  `placeholder` drives its level's search-box placeholder (falling back to
  the component's `placeholder` prop).

  None of this affects a consumer with no `children`/`source` items — every
  item stays a leaf and behaves exactly as before.

- b40d851: Add a pluggable ranking/scoring seam with query-match highlighting, and three
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

### Patch Changes

- Updated dependencies [55b41c5]
- Updated dependencies [458db46]
  - @rozie-ui/combobox-react@0.2.0
