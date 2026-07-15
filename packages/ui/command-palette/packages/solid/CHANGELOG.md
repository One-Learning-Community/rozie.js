# @rozie-ui/command-palette-solid

## 0.3.0

### Minor Changes

- 564ed59: Pass-through `groupCap` prop — cap command sections with an expand-in-place
  "+N more" row.

  Set `groupCap` to cap each command section (see [Grouped
  commands](/components/command-palette-api#grouped-commands)) to its first
  `groupCap` results, straight through to the vendored `@rozie-ui/combobox`
  primitive's own `groupCap`. An overflowing section renders a
  keyboard-reachable "+N more" row that expands that section in place when
  activated — no new palette prop/slot/emit/expose beyond `groupCap` itself.
  `0`/absent (default) is uncapped, byte-identical to before this release.

  Note: the ⌘K/Right-arrow row action menu resolves the highlighted row by
  section index, which assumes the uncapped section order — combining
  `groupCap` with per-row `actions` is not composed in this release.

  This release requires the sibling `@rozie-ui/combobox-*` packages at a
  version carrying the native `groupCap` prop / `groupMore` slot
  (`combobox-group-cap`).

- 019b02e: **BREAKING:** `@select` now emits `{ item, path }` — `item` is the full chosen
  command object (everything you put on the item: `id`/`label`/`group`/
  `keywords`/`icon`/`actions`/`disabled`/any custom fields), and `path` is the
  levels id-breadcrumb (unchanged). Previously `@select` emitted a slim
  projection, `{ id, label, group, path }`, dropping any other fields you'd
  attached to the item and forcing consumers to re-resolve the full item from
  just its `id`.

  This mirrors the existing `@navigate` event's `{ item, depth }` shape — both
  navigation events now consistently hand back the full item.

  **Migrate:** `e.id` → `e.item.id`, `e.label` → `e.item.label`, `e.group` →
  `e.item.group`. `e.path` is unchanged.

- e8e2192: Added interactive secondary actions (the "⌘K-within-the-palette" pattern):
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

- 6820171: Grouped commands now render as real labeled sections via the vendored
  `@rozie-ui/combobox` primitive's native option grouping, instead of a per-row
  text badge. Commands sharing the same `items[].group` string are auto-derived
  into `[{ id, label }]` sections (no new opt-in prop) and rendered under a
  labeled `role="group"` heading; commands with no `group` render first in a
  headingless block. Global relevance ranking is preserved WITHIN a group and
  sacrificed ACROSS groups (the intended semantics of a sectioned list) —
  groups themselves appear in first-appearance order.

  The previous per-row `.rozie-command-palette-option-group` badge is
  suppressed whenever grouping is active; a consumer whose items carry no
  `group` sees today's flat, unsectioned list, byte-identical to before this
  change.

  New slot `groupHeading` (scope `{ group }`, where `group` is `{ id, label }`)
  customizes the section heading; the default fill renders `group.label`.

  This release requires the sibling `@rozie-ui/combobox-*` packages at a
  version carrying the native `groups` prop / `groupHeading` slot
  (`combobox-native-groups`).

- 46bad6c: New prop `defaultItems` — a first-class empty/home view, resolved **per
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

### Patch Changes

- d3782ef: Style polish for the nested-levels + sub-actions UI, driven by a rendered
  audit:
  - **fix:** the per-row action flyout escaped to the viewport's right edge
    instead of staying anchored to the palette (the panel established no
    containing block). A new non-clipping `.rozie-command-palette-frame`
    wrapper now owns positioning; the flyout is a frame child (sibling of the
    panel) so it can extend past a short panel without ever being clipped or
    escaping to the viewport.
  - The default `#breadcrumb` fill now renders the full root..current trail
    (muted ancestors › an emphasized current segment) instead of a bare `‹` +
    the current title alone. The slot API (`{ stack, back }`) is unchanged.
  - The composed search input renders borderless with a subtle bottom divider
    instead of the vendored combobox's default bordered/blue-focus-ring look,
    via panel-scope token overrides (see the combobox tokens release below).
  - Subtle top spacing now separates the leading ungrouped command block from
    the first labeled group heading.

  No new props/emits/slots/expose; no behavior change. Requires the sibling
  `@rozie-ui/combobox-*` packages at a version carrying
  `--rozie-combobox-focus-border-color` / `--rozie-combobox-input-underline` /
  `--rozie-combobox-group-heading-margin-top`.

- Updated dependencies [d3782ef]
- Updated dependencies [564ed59]
- Updated dependencies [99fee43]
- Updated dependencies [f3e1bdf]
  - @rozie-ui/combobox-solid@0.3.0

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
  - @rozie-ui/combobox-solid@0.2.0
