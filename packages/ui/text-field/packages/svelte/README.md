# @rozie-ui/text-field-svelte

Idiomatic **svelte** `TextField` — an accessible **text field and textarea** with its own label, description, error message and character counter, compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The control is a native `<input>` (or `<textarea>`); Rozie owns the field around it: the `for` / `aria-describedby` / `aria-invalid` wiring, a two-way `modelValue` binding (an Angular `ControlValueAccessor`), opt-in textarea autosize, and a fully-tokenised skin. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/text-field-svelte
```

Peer dependencies: `svelte`. Install them alongside this package.

Also installed: `@rozie/runtime-svelte` — Rozie's small, tree-shaken runtime helper package (controllable state, keyboard navigation, event modifiers, and safe interpolation). It arrives as a regular dependency, so npm pulls it for you. Your bundler keeps only the helpers this component actually uses — typically a few hundred bytes to a few KB, minified and gzipped. [What's in it and what it costs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md).

## Usage

```svelte
<script lang="ts">
  import TextField from '@rozie-ui/text-field-svelte';

  let email = $state('');
  let notes = $state('');
  const error = $derived(email && !email.includes('@') ? 'Enter a valid email address.' : '');
</script>

<TextField bind:modelValue={email} label="Email" type="email"
           description="We never share it." {error} required />

<!-- A textarea that grows with its content, with a character counter -->
<TextField bind:modelValue={notes} label="Notes" multiline autosize maxRows={8} maxLength={500} showCount />
```

## Theming

Every cosmetic value is a `--rozie-text-field-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```svelte
import '@rozie-ui/text-field-svelte/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `modelValue` | `String` | `''` | ✓ |  |
| `label` | `String` | `''` |  |  |
| `description` | `String` | `''` |  |  |
| `error` | `String` | `''` |  |  |
| `invalid` | `Boolean` | `false` |  |  |
| `type` | `String` | `"text"` |  |  |
| `placeholder` | `String` | `''` |  |  |
| `name` | `String` | `''` |  |  |
| `autocomplete` | `String` | `''` |  |  |
| `required` | `Boolean` | `false` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `readonly` | `Boolean` | `false` |  |  |
| `maxLength` | `Number` | `null` |  |  |
| `showCount` | `Boolean` | `false` |  |  |
| `multiline` | `Boolean` | `false` |  |  |
| `rows` | `Number` | `3` |  |  |
| `autosize` | `Boolean` | `false` |  |  |
| `maxRows` | `Number` | `null` |  |  |
| `ariaLabel` | `String` | `null` |  |  |
| `idBase` | `String` | `''` |  |  |

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

```svelte
<script lang="ts">
  let field;                  // component instance via bind:this
</script>

<TextField bind:this={field} bind:modelValue={text} label="Search" />
<button onclick={() => field.clear()}>Clear</button>
```

## Slots

| Slot | Params |
| --- | --- |
| prefix |  |
| suffix |  |
