# @rozie-ui/text-field-lit

Idiomatic **lit** `TextField` — an accessible **text field and textarea** with its own label, description, error message and character counter, compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The control is a native `<input>` (or `<textarea>`); Rozie owns the field around it: the `for` / `aria-describedby` / `aria-invalid` wiring, a two-way `modelValue` binding (an Angular `ControlValueAccessor`), opt-in textarea autosize, and a fully-tokenised skin. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/text-field-lit
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

Also installed: `@rozie/runtime-lit` — Rozie's small, tree-shaken runtime helper package (controllable state, keyboard navigation, event modifiers, and safe interpolation). It arrives as a regular dependency, so npm pulls it for you. Your bundler keeps only the helpers this component actually uses — typically a few hundred bytes to a few KB, minified and gzipped. [What's in it and what it costs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md).

## Usage

```ts
import '@rozie-ui/text-field-lit';

// <rozie-text-field> is a custom element. Set props as properties (or kebab-case
// attributes), and listen for `model-value-change` to receive each keystroke as
// the two-way model, or `change` for a committed edit.
const el = document.querySelector('rozie-text-field');
el.label = 'Email';
el.type = 'email';
el.required = true;
el.addEventListener('model-value-change', (e) => {
  el.modelValue = e.detail;
  el.error = e.detail && !e.detail.includes('@') ? 'Enter a valid email address.' : '';
});

// The control and its label live in the element's shadow root, so they label
// each other there. A native <form> does not see the inner input: read
// `modelValue` when you submit.
```

## Theming

Every cosmetic value is a `--rozie-text-field-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/text-field-lit/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `modelValue` | `String` | `''` | ✓ |  | The text in the field (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so `[(ngModel)]` and `[formControl]` bind directly. Written on every keystroke. |
| `label` | `String` | `''` |  |  | Visible label text, rendered as a `<label>` whose `for` points at the control. Leave it empty and set `ariaLabel` when the field has no visible label. |
| `description` | `String` | `''` |  |  | Help text shown under the control and linked to it through `aria-describedby`, so screen readers announce it after the label. |
| `error` | `String` | `''` |  |  | Error message. A non-empty value renders it under the control, links it through `aria-describedby`, and marks the control `aria-invalid="true"`. Clear it (empty string) once the value is valid again. |
| `invalid` | `Boolean` | `false` |  |  | Mark the field invalid (`aria-invalid="true"` and the invalid styling) without showing a message, for example when the message is rendered elsewhere. A non-empty `error` implies this. |
| `type` | `String` | `"text"` |  |  | The native input `type`: `'text'`, `'email'`, `'password'`, `'search'`, `'tel'` or `'url'`. Ignored when `multiline` is set. |
| `placeholder` | `String` | `''` |  |  | Placeholder text shown while the field is empty. It is not a substitute for `label`: it disappears on input and many screen readers do not announce it. |
| `name` | `String` | `''` |  |  | The native `name` attribute, used when the field sits in a plain HTML `<form>`. On Lit the control is in a shadow root, so it does not join the outer form; bind `modelValue` there. |
| `autocomplete` | `String` | `''` |  |  | The native `autocomplete` hint (e.g. `'email'`, `'current-password'`, `'off'`). Empty leaves the browser default. |
| `required` | `Boolean` | `false` |  |  | Mark the field required: sets the native `required` attribute (announced by screen readers) and shows a `*` after the label. The marker is `aria-hidden` so it is not read twice. |
| `disabled` | `Boolean` | `false` |  |  | Disable the control. Also sets the Angular `ControlValueAccessor` disabled state. |
| `readonly` | `Boolean` | `false` |  |  | Make the control read-only: the text is shown, focusable and selectable but cannot be edited. |
| `maxLength` | `Number` | `null` |  |  | Maximum number of characters, forwarded as the native `maxlength`. `null` (the default) means no limit. With `showCount`, the counter reads `n / maxLength`. |
| `showCount` | `Boolean` | `false` |  |  | Show a character counter under the control (`n / maxLength`, or just `n` without a limit). The counter is linked through `aria-describedby`; it is not a live region, so it does not interrupt typing. |
| `multiline` | `Boolean` | `false` |  |  | Render a `<textarea>` instead of an `<input>`. |
| `rows` | `Number` | `3` |  |  | Visible rows of a `multiline` field (the native `rows`). With `autosize` it is the minimum height. |
| `autosize` | `Boolean` | `false` |  |  | Grow a `multiline` field to fit its content, from `rows` up to `maxRows`. It re-measures on input, on programmatic `modelValue` changes and when the field width changes. |
| `maxRows` | `Number` | `null` |  |  | The tallest an `autosize` field grows, in rows; past it the textarea scrolls. `null` (the default) means no cap. |
| `ariaLabel` | `String` | `null` |  |  | Accessible name for the control (`aria-label`) when there is no visible `label`. |
| `idBase` | `String` | `''` |  |  | Id base for the control and its text: the control is `idBase + '-input'`, and the description, error and counter are `-description`, `-error` and `-count`. Leave it empty (the default) and each instance generates a unique base after mount (`rozie-text-field-<n>`); set it when you need stable ids, for example to point an external element at the control. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired when the user commits an edit: on blur, when the text differs from what it was when the field gained focus. Payload `{ value }`. The same on all six targets (it is not the native `change` event, which React fires on every keystroke). For every keystroke, bind `modelValue` instead. |
| `enter` | Fired when the user presses **Enter** in a single-line field, except while an IME composition is open. Payload `{ value }`. The key is not prevented, so an enclosing `<form>` still submits. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `focus` | Move focus to the control (the `<input>`, or the `<textarea>` when `multiline`). |
| `select` | Focus the control and select all of its text. |
| `clear` | Empty the field: writes `modelValue = ''` (and re-measures an `autosize` field). Does not emit `change`. |

```ts
// The custom element IS the handle: exposed methods are public element methods.
const el = document.querySelector('rozie-text-field');
el.focus();   // moves focus into the inner control
el.select();
el.clear();
```

## Slots

| Slot | Params |
| --- | --- |
| prefix |  |
| suffix |  |
