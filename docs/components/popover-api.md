# API reference

The full `Popover` surface: props, the two-way `open` model, the `change` event, the imperative handle, and the slots. For the per-framework consumption code see the [usage page](/components/popover-usage).

## Props

The full prop surface. The single `model: true` slice (`open`, the **Two-way** column) is an optional two-way `r-model` with an uncontrolled fallback.

```rozie-props Popover
```

## Models (the two-way open state)

`open` is the one `model: true` prop — a boolean, where `true` shows the floating content. Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and the component writes the new state back whenever the trigger gesture or a dismissal toggles it. Left unbound it falls back to an uncontrolled default.

| Model (`r-model:`) | Shape | Change event | Description |
| --- | --- | --- | --- |
| `open` | `boolean` | `change` | Whether the floating content is shown. Written back on every trigger gesture (`click`/`hover`/`focus`), Escape / click-outside dismissal, or programmatic `show`/`hide`/`toggle`. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the open state changes. Payload is the new `open` boolean. Named `change` — **not** `open` — so the two-way model and its change notification do not collapse onto one name (the MapLibre model-prop==emit-name lesson). |

## Imperative handle

Declared once via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `show` | Open the floating content (no-op when `disabled`). Emits `change`. |
| `hide` | Close the floating content. Emits `change`. |
| `toggle` | Flip the open state (no-op when `disabled`). Emits `change`. |
| `reposition` | Recompute the floating position immediately (`computePosition`). Named `reposition`, not `update`, because `update` is a reserved Lit `ReactiveElement` lifecycle method. |

## Slots

| Slot | Params | Description |
| --- | --- | --- |
| `anchor` | `{ open, toggle, show, hide }` | The trigger element. The scoped params expose the open state and the open/close verbs so you can build any trigger (a `<button>`, an icon, etc.) and the gesture handlers wire automatically per `trigger`. |
| (default) | — | The floating content. Mounted only while `open` (and not `disabled`); Floating UI positions it relative to the anchor. |
