# API reference

The full `NumberField` surface: props, the two-way `modelValue` model, the `change` event, and the imperative handle. For the per-framework consumption code see the [usage page](/components/number-field-usage).

## Props

The full prop surface. The single `model: true` slice (`modelValue`, the **Two-way** column) is an optional two-way `r-model` with an uncontrolled fallback; as the sole model prop it drives the Angular `ControlValueAccessor`, so a number field is a form control.

```rozie-props NumberField
```

## Models (the two-way value)

`modelValue` is the one `model: true` prop — `number | null`, where `null` is the empty field. Two-way bind it (`r-model:modelValue` / `v-model:modelValue` / `bind:modelValue` / `[(modelValue)]`) and the component writes the new clamped + snapped value back on every commit. Left unbound it falls back to an uncontrolled default.

| Model (`r-model:`) | Shape | Change event | Description |
| --- | --- | --- | --- |
| `modelValue` | `number \| null` | `change` | The numeric value (`null` = empty). Written back clamped to `[min, max]` and snapped to `step` on every commit. As the sole model prop it drives the Angular `ControlValueAccessor`. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired on every committed change — a typed value committed on blur/Enter, a step (buttons / Arrow / Page / Home / End), a scrub, or a programmatic `increment`/`decrement`/`clear`. Payload `{ value }` — the new clamped + snapped number, or `null` when empty. |

## Imperative handle

Declared once via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the input and select its text. Deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (accepted, warn-only ROZ137). |
| `increment` | Step the value up by one `step` (clamped + snapped). Emits `change`. |
| `decrement` | Step the value down by one `step` (clamped + snapped). Emits `change`. |
| `clear` | Set the value to `null` (empty) and clear the edit buffer. Emits `change`. |

## Slots

`NumberField` declares no slots — the +/- steppers and the input are built in. Re-skin via the `--rozie-number-field-*` tokens (see [the showcase](/components/number-field#the-rozie-ui-number-field-packages)).
