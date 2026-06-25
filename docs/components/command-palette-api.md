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
| `open` | `boolean` | Whether the overlay is shown. Written back `false` on every close path (backdrop click, Escape, a `closeOnSelect` selection, or `close()`/`toggle()`). |
| `query` | `string` | The search text. Written back as the user types; cleared to `""` whenever the palette opens. |

## Events

| Event | Description |
| --- | --- |
| `select` | Fired when the user chooses a command (click, or highlight + Enter). Payload `{ id, label, group }` — the chosen item. `open` / `query` are two-way **models**, not events. |

## Imperative handle

Declared once via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `show` | Open the palette (writes `open` → `true`). Clears the query, resets the highlight, and focuses the search input. The open verb is `show` — **not** `open` — because an `open()` verb collides with the `open` model (both collapse onto React's generated open/setOpen state). |
| `close` | Close the palette (writes `open` → `false`). |
| `toggle` | Flip the open state. |
| `focus` | Move DOM focus to the search input. Deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (accepted warn-only ROZ137). |

## Slots

| Slot | Params | Description |
| --- | --- | --- |
| `item` | `{ item, active }` | Custom render for a single result row. `item` is the command (`{ id, label, group, keywords, disabled, _i }`); `active` is whether it is currently highlighted. Falls back to the label plus an optional group badge. |
| `empty` | — | The no-results state. Falls back to the `emptyText` prop. |
| `footer` | — | A persistent footer bar below the list (e.g. keyboard hints). Rendered only when provided. |
