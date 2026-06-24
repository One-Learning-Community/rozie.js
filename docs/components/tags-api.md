# API reference

The full `Tags` surface: props, the two-way tokens model, change events, the imperative handle, and the scoped slot. For the per-framework consumption code see the [usage page](/components/tags-usage); for the live widget see the [demo](/components/tags-demo).

## Props

The full prop surface. `modelValue` is the sole `model: true` prop — the committed tokens array — so the Angular output emits a `ControlValueAccessor` (a tags input **is** a form control). Boolean props default `false` (negative opt-out).

```rozie-props Tags
```

## Events

Every mutation of the committed list emits `change` (the new full array), so you can observe the list without two-way binding. Individual mutations also emit `add` / `remove`. A rejected candidate (duplicate, failed `validate`, or over `max`) emits nothing.

| Event | Description |
| --- | --- |
| `add` | Fired when a token is committed (an accepted Enter / comma / paste add). Payload `{ value, tokens }` — the newly added token string and the fresh full array. |
| `remove` | Fired when a token is removed (a chip remove-button click or Backspace in an empty input). Payload `{ value, index, tokens }` — the removed token, its former index, and the fresh full array. |
| `change` | Fired on every committed-list mutation (add, remove, paste-bulk-add, or a programmatic `clear`). Payload `{ value }` — the new full tokens array. |

## Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `clear` | Remove every token (emits `change` with `{ value: [] }`) and move DOM focus to the text input. Collision-safe — not a host-element member. |
| `focusInput` | Move DOM focus to the inline text input. Named `focusInput` (not `focus`) so it does not override the inherited `HTMLElement.focus` on the Lit custom element. |

## Slots

| Slot | Params | Description |
| --- | --- | --- |
| `tag` | `tag, index, remove` | Scoped — fully replaces the rendering of each chip. `tag` is the token string, `index` its position, and `remove()` a zero-arg function that removes this token. The default fallback renders the built-in chip (label + remove button). On React the slot is a render-prop `children` callback (the documented cross-framework slot divergence). |

The slot name `tag` deliberately does **not** equal any prop key (ROZ127 — a slot/prop name collision is a hard error because Svelte 5 collapses snippets and props into one `$props()` bag).
