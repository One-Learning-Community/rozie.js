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

## Events

| Event | Description |
| --- | --- |
| `select` | Fired when the user chooses a LEAF command — one with no `children`/`source` (click, or highlight + Enter). Payload `{ item, path }` — `item` is the full chosen command object, `path` is the id breadcrumb of levels navigated through to reach it (empty at the root). `open` / `query` are two-way **models**, not events. |
| `navigate` | Fired when a nested level is pushed (selecting an item with `children`/`source`). Payload `{ item, depth }` — the navigated-to item and the resulting nesting depth (1-based; root is 0). |
| `back` | Fired when a level is popped (Backspace-on-empty, Escape at depth > 0, or `goBack()`). No payload. Does not fire at the root. |

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
| `footer` | — | A persistent footer bar below the list (e.g. keyboard hints). Rendered only when provided. |
