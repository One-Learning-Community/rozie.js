# TextField — the cross-framework accessible text field

`TextField` is an accessible single-line or multiline text field that carries its own label, help text, error message and character counter. The control is a native `<input>` (or a `<textarea>` with `multiline`). What the component adds is the field around it, the part every form UI rebuilds once per framework:

- the `<label for>` ↔ control `id` link, with generated ids that never collide between instances;
- `aria-describedby` pointing at the description, the error and the counter, in that order, only for the ones that are rendered;
- `aria-invalid` and the invalid styling, driven by an `error` message (or `invalid` on its own);
- a two-way `modelValue` binding, which on Angular is a real `ControlValueAccessor`, so `[formControl]` and `[(ngModel)]` bind directly;
- opt-in textarea **autosize** between `rows` and `maxRows`;
- a token-themed skin, with bridges for shadcn/ui, Material 3 and Bootstrap 5.

The same component ships for React, Vue, Svelte, Angular, Solid, and Lit.

<PublishedTargetsNotice family="text-field" :published="[]" />

## The `@rozie-ui/text-field` packages

`TextField` is designed to ship as six pre-compiled, per-framework packages, but none has published to npm yet — every row below is still in dogfooding. The links go to each target's workspace README for review:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/text-field-react` | *not yet published (dogfooding)* | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/text-field/packages/react/README.md) |
| `@rozie-ui/text-field-vue` | *not yet published (dogfooding)* | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/text-field/packages/vue/README.md) |
| `@rozie-ui/text-field-svelte` | *not yet published (dogfooding)* | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/text-field/packages/svelte/README.md) |
| `@rozie-ui/text-field-angular` | *not yet published (dogfooding)* | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/text-field/packages/angular/README.md) |
| `@rozie-ui/text-field-solid` | *not yet published (dogfooding)* | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/text-field/packages/solid/README.md) |
| `@rozie-ui/text-field-lit` | *not yet published (dogfooding)* | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/text-field/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`).

## Quick start

Two-way bind `modelValue` and give the field a `label`. Pass a validation message through `error` and the field wires up `aria-invalid` and `aria-describedby` for you:

```rozie
<components>
{
  TextField: './TextField.rozie',
}
</components>

<data>
{
  email: '',
  notes: '',
}
</data>

<template>
  <TextField
    r-model:modelValue="$data.email"
    label="Email"
    type="email"
    description="We never share it."
    :error="$data.email && !$data.email.includes('@') ? 'Enter a valid email address.' : ''"
    required
  />

  <!-- a textarea that grows with its content, with a character counter -->
  <TextField r-model:modelValue="$data.notes" label="Notes" multiline autosize :maxRows="8" :maxLength="500" showCount />
</template>
```

`r-model:modelValue` is Rozie's [two-way bind](/guide/props-and-two-way#model-true-→-idiomatic-two-way-binding-everywhere): the field writes the text back on every keystroke. Because `modelValue` is the sole `model: true` prop, the Angular output also implements `ControlValueAccessor`.

## Why the control lives inside the component

A generic `<Field>` that wraps *your* `<input>` would be the more flexible shape, but it cannot work on all six targets. The Lit build renders inside a shadow root, and id references (`<label for>`, `aria-describedby`) do not cross a shadow boundary: a label in the shadow root cannot point at an input you slot in from the page. Keeping the control inside means every id reference resolves inside one tree on every target. Use the `prefix` and `suffix` slots for icons, units or buttons next to the text.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `modelValue` | `String` | `''` | yes (via `r-model`) | The text (two-way). The sole `model: true` prop, so Angular emits a `ControlValueAccessor`. Written on every keystroke. |
| `label` | `String` | `''` | yes | Visible label, rendered as a `<label>` whose `for` points at the control. |
| `description` | `String` | `''` | yes | Help text under the control, linked through `aria-describedby`. |
| `error` | `String` | `''` | yes | Error message. Non-empty renders it, links it through `aria-describedby`, and sets `aria-invalid="true"`. |
| `invalid` | `Boolean` | `false` | yes | Mark invalid without a message. A non-empty `error` implies it. |
| `type` | `String` | `"text"` | yes | The native input `type` (`text`, `email`, `password`, `search`, `tel`, `url`). Ignored when `multiline`. |
| `placeholder` | `String` | `''` | yes | Placeholder text. Not a substitute for `label`. |
| `name` | `String` | `''` | yes | The native `name`, for a plain HTML `<form>`. On Lit the control is in a shadow root and does not join an outer form. |
| `autocomplete` | `String` | `''` | yes | The native `autocomplete` hint. Empty leaves the browser default. |
| `required` | `Boolean` | `false` | yes | Sets native `required` and shows an `aria-hidden` `*` after the label. |
| `disabled` | `Boolean` | `false` | yes | Disable the control (also the Angular CVA disabled state). |
| `readonly` | `Boolean` | `false` | yes | Focusable and selectable, but not editable. |
| `maxLength` | `Number` | `null` | yes | Native `maxlength`. `null` means no limit. |
| `showCount` | `Boolean` | `false` | yes | Show a character counter (`n / maxLength`, or `n`), linked through `aria-describedby`. |
| `multiline` | `Boolean` | `false` | yes | Render a `<textarea>` instead of an `<input>`. |
| `rows` | `Number` | `3` | yes | Visible rows of a `multiline` field; the minimum height with `autosize`. |
| `autosize` | `Boolean` | `false` | yes | Grow a `multiline` field to fit its content, from `rows` up to `maxRows`. |
| `maxRows` | `Number` | `null` | yes | The tallest an `autosize` field grows, in rows; past it the textarea scrolls. |
| `ariaLabel` | `String` | `null` | yes | Accessible name when there is no visible `label`. |
| `idBase` | `String` | `''` | yes | Id base: the control is `idBase + '-input'`. Empty generates a unique `rozie-text-field-<n>` after mount. |

### Events

| Event | Description |
| --- | --- |
| `change` | The user committed an edit: the DOM `change` event, on blur after changing the text, or on Enter in a single-line field. Payload `{ value }`. Programmatic writes never fire it. |
| `enter` | The user pressed **Enter** in a single-line field, outside an IME composition. Payload `{ value }`. Not prevented, so a form still submits. |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move focus to the control. Deliberately named `focus`, overriding the inherited `HTMLElement.focus` on the Lit custom element (the otp / number-field precedent). |
| `select` | Focus the control and select all of its text. |
| `clear` | Empty the field (`modelValue = ''`). Does not emit `change`. |

### Slots

| Slot | Description |
| --- | --- |
| `prefix` | Content before the text inside the control box (an icon, a currency sign). Rendered only when filled. |
| `suffix` | Content after the text inside the control box (a unit, a clear button). Rendered only when filled. |

## Theming

Every cosmetic value the component renders is a `--rozie-text-field-*` CSS custom property with a built-in fallback, so it works with zero configuration and remains fully re-skinnable. Override tokens at any ancestor scope:

```css
.signup {
  --rozie-text-field-radius: 0.25rem;
  --rozie-text-field-focus-color: #7c3aed;
  --rozie-text-field-focus-ring: rgba(124, 58, 237, 0.25);
  --rozie-text-field-error-color: #b91c1c;
}
```

The complete token table and the design-system bridges live on the [dedicated theming page](/components/text-field-theming).

## Accessibility

- The label is a real `<label for>`, so clicking it focuses the control and screen readers announce it as the control's name. Without a visible label, set `ariaLabel`.
- The description, error and counter are linked through `aria-describedby` in that order, and only while rendered. The error is not a live region: it is announced when the control is focused, which avoids interrupting someone who is still typing. Move focus to the field (the `focus()` handle) after a failed submit so the error is heard.
- `required` uses the native attribute, which screen readers announce; the visible `*` is `aria-hidden` so it is not read twice.
- The counter is not a live region either, for the same reason.
