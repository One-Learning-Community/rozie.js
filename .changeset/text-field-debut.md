---
"@rozie-ui/text-field-react": patch
"@rozie-ui/text-field-vue": patch
"@rozie-ui/text-field-svelte": patch
"@rozie-ui/text-field-angular": patch
"@rozie-ui/text-field-solid": patch
"@rozie-ui/text-field-lit": patch
---

New family: `@rozie-ui/text-field`, an accessible text field and textarea. `TextField` renders a label, the control, an optional description and an error message, and wires `for` / `id`, `aria-describedby` and `aria-invalid` between them on every target, including inside the Lit shadow root.

- Two-way `modelValue` with an uncontrolled fallback; on Angular it is a `ControlValueAccessor`, so the field works with `ngModel` and reactive forms.
- `multiline` renders a `<textarea>` with `rows`, and `autosize` grows it with its content up to `maxRows`.
- `type`, `placeholder`, `name`, `autocomplete`, `required` (with a visual marker), `disabled`, `readonly`, `maxLength` and a `showCount` character counter.
- A `change` event when the user commits an edit (not on every keystroke, and not on programmatic writes), and an `enter` event for Enter in a single-line field.
- `prefix` / `suffix` slots inside the bordered control box, and an imperative `focus()`, `select()` and `clear()`.
