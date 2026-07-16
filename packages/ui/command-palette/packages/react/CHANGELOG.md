# @rozie-ui/command-palette-react

## 0.4.0

### Minor Changes

- e0b8383: Breadcrumb ancestor segments are now click-to-jump — clicking a muted ancestor pops the level stack straight back to that tier, emitting one `back` event per popped level (exactly like pressing Backspace that many times), keyboard-focusable with a "Back to `<title>`" aria-label. The current segment stays non-interactive. It composes with the already-staged 0.4.0 minor.
- eaaff1d: Command items may now carry an optional `hotKey?: string` field — a display-only teaching badge advertising an app-global shortcut the consumer owns (e.g. Copy `$mod+c`, Print `$mod+p`), rendered right-aligned before the `#actions` affordance and gated on the item's `hotKey`. It reuses the same portable `$mod`/`$shift`/`$alt`/`$ctrl` modifier grammar as the existing `actionKey` hint — the palette never binds or listens for the key, it is purely visual. That grammar is now factored out into a shared `formatKeyToken` helper that `actionKey`'s own default hint also renders through. Five new `--rozie-command-palette-hotkey-*` theming tokens fall back to the existing `--rozie-command-palette-actions-hint-*` values.
- d9ba7c2: New **inline command arguments** (Raycast-style): a command item declares `args: [{ id, placeholder?, required?, default? }]` (text inputs only in v1). Selecting an args-bearing item (Enter or click) automatically enters a panel-internal args surface — reusing the same real-focus/`pinOpen` mechanics as the existing per-row action menu, with zero new props/events. A non-interactive chip shows the pending command's label above the field(s); the result list stays visibly open but is dimmed and `aria-hidden` while the args surface is active.

  Enter with every `required` field non-empty (after trim) fires the EXISTING `select` event with an added `args: { [id]: value }` key — additive and non-breaking: an argless command's `select` payload carries no `args` key at all. Enter with a missing required field instead focuses the first unfilled field. `default` prefills its field (selected on focus so typing replaces it). Escape closes the args surface and restores the list + query (same precedence tier as closing the sub-actions menu); Backspace on an empty first field also pops back to the list. `args` wins over a `source`/`children` navigation on the same item (mutually exclusive); `args` is compatible with the per-row `actions` menu (which is inactive once the args surface is open).

  New optional slot `argsField` (scope `{ item, arg, value, setValue }`) replaces the default field chrome (surface 11→12 slots). New `--rozie-command-palette-args-{padding,gap,chip-bg,chip-color,field-padding,field-border,field-radius,field-bg,dim-opacity}` tokens alias the existing panel/input fallbacks. No compiler change, no `@rozie-ui/combobox` change — the args surface reuses `pinOpen`/`reopenComboboxPopup` verbatim.

- 27dc962: Added a per-level `virtual` (long-list windowing) author-side API, threading three new props — `virtual` (Boolean), `virtualMaxHeight` (String), `virtualEstimateRowHeight` (Number) — onto the vendored combobox's own windowing support. Resolved PER LEVEL, exactly like `defaultItems`/`title`/`placeholder`: the top-level props window the ROOT list, while a navigating item's own `virtual`/`virtualMaxHeight`/`virtualEstimateRowHeight` fields window THAT pushed child level (captured onto its frame at push time). This is unblocked by `@rozie-ui/combobox`'s `virtual` prop now being live-flippable at runtime (see that package's own changeset) — a level pushed with `virtual: true` windows immediately, no remount required.

  A virtual level renders **flat**: the vendored combobox's `isGrouped` requires `!virtual`, so auto-derived groups, `groupCap`, and the `groupHeading` slot are inactive for that level. This is honestly bidirectional — popping back to a level whose `virtual` resolves `false` restores its non-windowed (and, if applicable, grouped) render.

  Surface grows 15 → 18 props (`virtual`/`virtualMaxHeight`/`virtualEstimateRowHeight`, placed after `appendTo`); models/emits/slots/expose are unchanged. All three props unset is byte-behavior-identical to today (`:virtual="false"`, `:max-height="''"`, `:estimate-row-height="36"`).

- 35250cc: New `appendTo` prop (surface 14→15) lets the overlay escape an ancestor whose `overflow: hidden` / `transform` / `filter` / `contain` would otherwise clip the palette's `position: fixed` overlay — a real embedding bug (an app-shell iframe or a designer-chrome wrapper with its own layout is the common case). Defaults to `false` (render in place, today's behavior — zero change for existing consumers); set it to `true`/`'body'` to portal to `document.body`, a CSS selector string to portal to the first matching element, or an `Element` reference to portal to that element directly.

  Built on a new compiler primitive (`r-portal`, see the toolchain changeset) using each target's native element-teleport construct — React `createPortal`, Vue `<Teleport>`, Solid `<Portal>`, a Svelte action, an AOT-safe Angular effect, and a Lit `ReactiveController`. Everything else about the palette works unchanged through the portal — the levels Escape funnel, combobox's own focus management, and the row-action-menu arbitration are all rooted at `$refs.panel`/`$refs.frame` (never `$el`), so a moved node's ref identity survives the relocation with zero logic changes. Theming custom properties (`--rozie-command-palette-*`) must be set on `:root` (or the `appendTo` container itself) to reach a portalled overlay — see the [API reference](/components/command-palette-api#escaping-a-clipped-ancestor-appendto) for the full value grammar and the Lit-specific theming note.

  Also corrects a stale header comment in `CommandPalette.rozie` that cited an already-fixed compiler gap as the reason native `<dialog>` was avoided — the actual (unchanged) reason is that `<dialog>.showModal()`'s native focus-trap/Escape would fight the palette's own levels Escape funnel and combobox focus management.

### Patch Changes

- ea7c6a8: Fix `groupCap` composition with per-row `actions`: the ⌘K / Right-arrow action menu now always anchors to the exact highlighted VISIBLE row — it previously mis-anchored to the uncapped-order neighbour once any section overflowed its cap. Firing the action key on a "+N more" row is now correctly a no-op (it previously could wrongly open a menu). Composes into the already-staged `0.4.0` minor.
- bd68fdb: Platform-aware `actionKey` hint: the row-actions affordance's default hint badge rendered the mac `⌘` glyph on every platform. It now shows `⌘K` on Apple platforms and `Ctrl+K` elsewhere (SSR-safe sniff, display-only — shortcut matching was already portable via `metaKey || ctrlKey` and is unchanged).
  - @rozie/runtime-react@0.2.0

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
  - @rozie-ui/combobox-react@0.3.0

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
