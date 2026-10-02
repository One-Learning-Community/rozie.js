# API reference

The full `Popover` surface: props, the two-way `open` model and its change event, the imperative handle, and the slots. For the per-framework consumption code see the [usage page](/components/popover-usage).

## Props

The full prop surface. The single `model: true` slice (`open`, the **Two-way** column) is an optional two-way `r-model` with an uncontrolled fallback.

```rozie-props Popover
```

## Models (the two-way open state)

`open` is the one `model: true` prop — a boolean, where `true` shows the floating content. Two-way bind it and the component writes the new state back whenever the trigger gesture, a dismissal or the handle toggles it. Left unbound it falls back to an uncontrolled default.

| Model (`r-model:`) | Shape | Change event | Description |
| --- | --- | --- | --- |
| `open` | `boolean` | Vue `update:open` · React/Solid `onOpenChange` · Svelte `bind:open` · Angular `openChange` · Lit `open-change` | Whether the floating content is shown. Written back on every trigger gesture (`click`/`hover`/`focus`), Escape / click-outside dismissal, or programmatic `show`/`hide`/`toggle`. |

## Events

`Popover` declares no events of its own: the `open` model's change event above is the only change signal. (A separate `change` event existed until 0.3.0. It was removed because on Angular and Lit a native `change` from any input inside the panel bubbles to the host under the same name.)

## Imperative handle

Declared once via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `show` | Open the floating content (no-op when `disabled`). Fires the `open` model's change event. |
| `hide` | Close the floating content. Fires the `open` model's change event. |
| `toggle` | Flip the open state (no-op when `disabled`). Fires the `open` model's change event. |
| `reposition` | Recompute the floating position immediately (`computePosition`). Named `reposition`, not `update`, because `update` is a reserved Lit `ReactiveElement` lifecycle method. |

## Slots

| Slot | Params | Description |
| --- | --- | --- |
| `anchor` | `{ open, toggle, show, hide, panelId }` | The trigger element. The scoped params expose the open state, the open/close verbs and the panel's id (`idBase + '-panel'`) so you can build any trigger (a `<button>`, an icon, etc.) with matching `aria-expanded` / `aria-controls`; the gesture handlers wire automatically per `trigger`. |
| (default) | — | The floating content. Mounted while `open` (and not `disabled`); with `keepMounted` it stays mounted but hidden while closed. Floating UI positions it relative to the anchor or the `reference`. |
