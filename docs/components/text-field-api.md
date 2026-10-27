# API reference

The full `TextField` surface: props, the two-way `modelValue` model, the `change` and `enter` events, the `prefix` / `suffix` slots, and the imperative handle. For the per-framework consumption code see the [usage page](/components/text-field-usage).

## Props

The full prop surface. The single `model: true` prop (`modelValue`, the **Two-way** column) is an optional two-way `r-model` with an uncontrolled fallback; as the sole model prop it drives the Angular `ControlValueAccessor`, so a text field is a form control.

```rozie-props TextField
```

## Models (the two-way value)

| Model (`r-model:`) | Shape | Change event | Description |
| --- | --- | --- | --- |
| `modelValue` | `string` | `input` | The text. Written back on every keystroke. As the sole model prop it drives the Angular `ControlValueAccessor` (`writeValue`, `registerOnChange`, touched on focus-out, `setDisabledState`). |

## Events

| Event | Payload | Description |
| --- | --- | --- |
| `change` | `TextFieldValuePayload` (`{ value: string }`) | The user committed an edit: on blur, when they changed the text since the field gained focus. Programmatic writes never fire it. Implemented on focus/blur rather than the native `change` event, which React fires on every keystroke, so it means the same on all six targets. |
| `enter` | `TextFieldValuePayload` (`{ value: string }`) | The user pressed **Enter** in a single-line field, except while an IME composition is open. The key is not prevented, so an enclosing `<form>` still submits. |

On Lit, events are dispatched as `CustomEvent`s with the payload on `detail`; the two-way model arrives as `model-value-change`.

## Slots

| Slot | Params | Description |
| --- | --- | --- |
| `prefix` | — | Rendered before the text, inside the bordered control box. Omitted from the DOM when not filled. |
| `suffix` | — | Rendered after the text, inside the bordered control box. Omitted from the DOM when not filled. |

## Imperative handle

Declared once via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move focus to the control (the `<input>`, or the `<textarea>` when `multiline`). Overrides `HTMLElement.focus` on the Lit element on purpose. |
| `select` | Focus the control and select all of its text. |
| `clear` | Empty the field: writes `modelValue = ''` and re-measures an `autosize` field. Does not emit `change`. |

## Generated ids

| Element | Id |
| --- | --- |
| control (`<input>` / `<textarea>`) | `<idBase>-input` |
| description | `<idBase>-description` |
| error | `<idBase>-error` |
| counter | `<idBase>-count` |

`<idBase>` is the `idBase` prop, or a unique `rozie-text-field-<n>` generated after mount (the page-wide counter Combobox, Listbox and Popover share). Pass `idBase` when server-rendered markup needs stable ids before hydration.
