---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Add nested levels — an action-driven drill-in stack with breadcrumb/back
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
