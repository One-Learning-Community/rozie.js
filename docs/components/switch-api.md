# API reference

The full `Switch` surface: props, the two-way `modelValue` model, the `change` event, the scoped default slot, and the imperative handle. For the per-framework consumption code see the [usage page](/components/switch-usage).

## Props

The full prop surface. The single `model: true` slice (`modelValue`, the **Two-way** column) is an optional two-way `r-model` with an uncontrolled fallback; as the sole model prop it drives the Angular `ControlValueAccessor`, so a switch is a form control.

```rozie-props Switch
```

## Models (the two-way value)

`modelValue` is the one `model: true` prop — a `boolean`, where `true` is the checked/on state. Two-way bind it (`r-model:modelValue` / `v-model:modelValue` / `bind:modelValue` / `[(modelValue)]`) and the component writes the new state back on every toggle. Left unbound it falls back to an uncontrolled default.

| Model (`r-model:`) | Shape | Change event | Description |
| --- | --- | --- | --- |
| `modelValue` | `boolean` | `change` | The on/off state. Written back on every toggle (click / Space / Enter / `toggle()`). As the sole model prop it drives the Angular `ControlValueAccessor`. Reflected as `aria-checked`. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the switch is toggled — by a click, by Space/Enter, or by the programmatic `toggle()` handle. Payload `{ checked }` — the new boolean state. No-op while `disabled` or `readonly`. |

## Imperative handle

Declared once via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the switch control. Deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (accepted, warn-only ROZ137). |
| `toggle` | Flip the on/off state (same funnel as a click / Space / Enter) and emit `change`. A no-op while `disabled` or `readonly`. |

## Slots

| Slot | Params | Description |
| --- | --- | --- |
| `(default)` | `checked`, `toggle` | A scoped default slot for a fully custom thumb/track (or a label + icon). It receives `{ checked, toggle }` — the current boolean and the toggle function — while the component keeps the accessible button, keyboard handling, and two-way binding. Omit it for the built-in tokenised track + thumb. |
