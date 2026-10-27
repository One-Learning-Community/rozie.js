# @rozie-ui/text-field-vue

Idiomatic **vue** `TextField` — an accessible **text field and textarea** with its own label, description, error message and character counter, compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The control is a native `<input>` (or `<textarea>`); Rozie owns the field around it: the `for` / `aria-describedby` / `aria-invalid` wiring, a two-way `modelValue` binding (an Angular `ControlValueAccessor`), opt-in textarea autosize, and a fully-tokenised skin. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/text-field-vue
```

Peer dependencies: `vue`. Install them alongside this package.

Also installed: `@rozie/runtime-vue` — Rozie's small, tree-shaken runtime helper package (controllable state, keyboard navigation, event modifiers, and safe interpolation). It arrives as a regular dependency, so npm pulls it for you. This build imports nothing from it today, so it shakes out of your bundle entirely. [What's in it and what it costs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md).

## Usage

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import TextField from '@rozie-ui/text-field-vue';

const email = ref('');
const error = computed(() => (email.value && !email.value.includes('@') ? 'Enter a valid email address.' : ''));
const notes = ref('');
</script>

<template>
  <TextField v-model:modelValue="email" label="Email" type="email"
             description="We never share it." :error="error" required />

  <!-- A textarea that grows with its content, with a character counter -->
  <TextField v-model:modelValue="notes" label="Notes" multiline autosize
             :max-rows="8" :max-length="500" show-count />
</template>
```

## Theming

Every cosmetic value is a `--rozie-text-field-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/text-field-vue/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
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

```vue
<script setup lang="ts">
import { ref } from 'vue';
const field = ref();          // template ref
</script>

<template>
  <TextField ref="field" v-model:modelValue="text" label="Search" />
  <button @click="field.clear()">Clear</button>
</template>
```

## Slots

| Slot | Params |
| --- | --- |
| prefix |  |
| suffix |  |
