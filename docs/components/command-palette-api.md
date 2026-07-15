# API reference

The full `CommandPalette` surface: props, the two-way `open` + `query` models, the `select` event, the imperative handle, and the slots. For the per-framework consumption code see the [usage page](/components/command-palette-usage).

## Props

The full prop surface. The two `model: true` slices (`open` and `query`, the **Two-way** column) are two-way `r-model` bindings.

```rozie-props CommandPalette
```

## Models (two-way state)

`open` and `query` are both `model: true`. Two-way bind each (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`, and likewise for `query`). Because there are **two** models the component generates **no** Angular `ControlValueAccessor` — a palette is not a single form control.

| Model (`r-model:`) | Shape | Description |
| --- | --- | --- |
| `open` | `boolean` | Whether the overlay is shown. Written back `false` on every close path (backdrop click, Escape at the root, a `closeOnSelect` selection, or `close()`/`toggle()`). |
| `query` | `string` | The current LEVEL's search text. Written back as the user types; cleared to `""` on open AND whenever a nested level is pushed. Popping a level restores the parent level's query (both the model and the visible input text) — back is a full undo. |

## Nested levels

Selecting an item that carries `children` (a static array) or `source` (a `(query) => items | Promise<items>` function) **pushes** a child level instead of firing `select` — presence of either field is the navigation signal, no separate flag. A `source` may return a `Promise`; the level enters `loading` until it settles, and only the LATEST in-flight request's result is applied (stale resolutions are dropped). `searchDebounce` (default ~150ms) debounces an async level's keystroke refetch only — a `children` level re-ranks locally with no debounce.

Backspace on an empty query pops one level; Escape pops one level at depth > 0 and only closes the palette at the root. A breadcrumb/back header renders above the input at depth > 0 (overridable via the `breadcrumb` slot). The imperative `openTo(path)` handle deep-links straight to a nested level.

## Default items (empty / home view)

The `defaultItems` prop is what renders while the query is empty — the palette's "home" state, resolved **per level**. The top-level `defaultItems` prop is the ROOT level's home view; a navigating item's own `defaultItems` field (alongside its `children`/`source`) is that CHILD level's home view — captured onto its pushed level exactly like `title`/`placeholder` already are.

Whichever `defaultItems` is active renders as soon as the query is empty (on open, and whenever the query is cleared) and switches to the scored `items`/`source` results the moment the user types. Clearing the query returns to `defaultItems` again. They compose with [grouped commands](#grouped-commands) for free — a `defaultItems` entry carrying a `group` field renders in its labeled section, same as any other command. Scoring **never** reorders `defaultItems` — they render in exactly the order given, since an empty query short-circuits before ranking runs.

This is the first-class replacement for branching on `query === ''` inside a `source` function to return a "default" view — and the natural home for a recents/frecency list (it composes with the `score` prop's own recency-boost hook). Pushing a level whose item carries `defaultItems` shows that home view immediately, with no loading flash and without ever invoking `source('')`.

A palette (or level) with no `defaultItems` set behaves exactly as before this feature — the full, unfiltered `items`/`children` list in source order.

## Grouped commands

Commands sharing the same `items[].group` string render as labeled sections — auto-derived from the existing `group` field, no separate opt-in prop. Commands with no `group` render first in a headingless block; groups then follow in first-appearance order (the order their first member appears in `items`), each labeled with its `group` string. A consumer whose items carry no `group` at all sees today's flat, unsectioned list — byte-identical to before this feature.

Override the section heading's markup with the `groupHeading` slot (see below); the default fill renders the group string as-is.

## Capping groups

`groupCap` is a straight pass-through to the vendored combobox's `groupCap` (see [Capping groups](/components/combobox#capping-groups) on the Combobox API page): set it to cap each command section to its first `groupCap` results, adding a keyboard-reachable "+N more" row that expands that section in place when activated (Enter or click). `0`/absent = uncapped (default), byte-identical to today. The palette adds no new prop/slot/emit/expose of its own — the default "+N more" fill renders exactly as the vendored combobox renders it; override it via the combobox's `groupMore` slot semantics if you compose the palette directly.

**Caveat:** the ⌘K/Right-arrow row action menu (see [Interactive sub-actions](#interactive-sub-actions) below) resolves the highlighted row by section index, which assumes the uncapped section order. Combining `groupCap` with per-row `actions` is not composed in this pass.

## Interactive sub-actions

Each result row may carry its own `actions?: [{ id, label, icon?, shortcut?, disabled? }]` array — a per-row action menu (the "⌘K-within-the-palette" pattern), reached separately from the row's primary `select`/`navigate`. Three triggers open it for the currently highlighted row, and each is a no-op on a row with no `actions`:

- **`actionKey`** (default `"$mod+k"`, i.e. ⌘K/Ctrl+K) — a portable `$mod+<letter>` token; a bare single-letter token (e.g. `"k"`) matches with no modifier.
- **Caret-at-end Right-arrow** — only when the search input's text caret is collapsed at the very end (so it never hijacks normal text editing).
- **Clicking the row's actions affordance** — the same `actions` option-row region used for the `#actions` slot; it stops the click from bubbling to the row's own selection handler, so it never accidentally commits the option underneath it.

Opening the menu moves REAL DOM focus into the first enabled `role="menuitem"` — the search input's own popup stays visibly open the whole time (it does not blur-close). Inside the menu: ↑/↓ rove over enabled actions (disabled entries are skipped, clamped at the ends — never wraps); Enter/Space fires `action-select` and always closes the menu; Escape or ← closes the menu, restores focus to the search input, and reopens the result list — it does **not** pop a level or close the palette (a sub-surface being open always takes precedence over level-pop, which always takes precedence over closing at the root). Pushing or popping a level while the menu is open closes it first — level navigation always returns to the result list.

## Events

| Event | Description |
| --- | --- |
| `select` | Fired when the user chooses a LEAF command — one with no `children`/`source` (click, or highlight + Enter). Payload `{ item, path }` — `item` is the full chosen command object, `path` is the id breadcrumb of levels navigated through to reach it (empty at the root). `open` / `query` are two-way **models**, not events. |
| `navigate` | Fired when a nested level is pushed (selecting an item with `children`/`source`). Payload `{ item, depth }` — the navigated-to item and the resulting nesting depth (1-based; root is 0). |
| `back` | Fired when a level is popped (Backspace-on-empty, Escape at depth > 0, or `goBack()`). No payload. Does not fire at the root. |
| `action-select` | Fired when the user chooses a row action from its action menu. Payload `{ item, action }` — `item` is the full anchored command object (the row the menu was opened for), `action` is the chosen entry from that row's `actions[]`. The menu always closes on selection; the palette additionally closes when `closeOnAction` is `true` (the default). |

## Imperative handle

Declared once via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `show` | Open the palette (writes `open` → `true`). Clears the query, resets the highlight, and focuses the search input. The open verb is `show` — **not** `open` — because an `open()` verb collides with the `open` model (both collapse onto React's generated open/setOpen state). |
| `close` | Close the palette (writes `open` → `false`), resetting the query and the level stack to root. |
| `toggle` | Flip the open state. |
| `focus` | Move DOM focus to the search input. Deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (accepted warn-only ROZ137). |
| `goBack` | Pop one nested level (restoring the parent query + input text). A no-op at the root. Named `goBack` — **not** `back` — because a `back()` verb would collide with the `back` event. |
| `openTo` | `openTo(path)` — deep-link into a nested level. `path` is an array of item ids from the root; opens the palette, resets to root, then drills through each id in turn, async-aware (awaiting a `Promise` `source` before the next hop). Stops silently at the first id that doesn't resolve. |

## Slots

| Slot | Params | Description |
| --- | --- | --- |
| `option` | `{ option, index, active, selected, disabled }` | Custom render for a single result row. **Breaking change:** renamed from `item` and realigned to the `@rozie-ui/listbox` `option` vocabulary (the palette now composes the listbox primitive). `option` is the command (`{ id, label, group, keywords, disabled, _i }`); `index` is its position; `active` is whether it is currently highlighted; `selected` whether it is the committed value; `disabled` whether it is non-selectable. Falls back to the label plus an optional group badge. |
| `empty` | `{ query }` | The settled-but-empty state; `query` is the current search string. Falls back to the `emptyText` prop. Not shown while `loading`/`error` (see below). |
| `loading` | `{ query }` | Shown while the active level's async `source` is in flight. Falls back to "Loading…". |
| `error` | `{ query, error, retry }` | Shown when the active level's async `source` rejected. `error` is the rejection value; `retry` re-invokes the source at the current query. |
| `breadcrumb` | `{ stack, back }` | The depth > 0 header (a panel sibling above the input, not inside the combobox). `stack` is the root..current breadcrumb (`[{ id, title }]`); `back` is the `goBack` handle. Falls back to a back button + the current level's title. |
| `actionItem` | `{ action, item, active, disabled }` | Custom render for one row inside the action menu. `action` is the entry from the anchored row's `actions[]`; `item` is the anchored command; `active` is whether it is currently roving-highlighted; `disabled` mirrors `action.disabled`. Falls back to icon (if present) + label + a right-aligned `shortcut` hint. Named `actionItem` (camelCase) — a hyphenated slot name is not a valid identifier across all six targets. |
| `groupHeading` | `{ group }` | Custom render for a section heading when commands are grouped (see [Grouped commands](#grouped-commands) above). `group` is `{ id, label }` — the group's `id` is the `group` string it was derived from; `label` defaults to that same string. Falls back to `group.label`. Not rendered at all when no command carries a `group`. |
| `footer` | — | A persistent footer bar below the list (e.g. keyboard hints). Rendered only when provided. |
