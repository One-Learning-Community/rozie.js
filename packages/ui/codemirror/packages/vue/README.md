# @rozie-ui/codemirror-vue

Idiomatic **vue** `CodeMirror` — a cross-framework code editor compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [CodeMirror 6](https://codemirror.net/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/codemirror-vue
```

Peer dependencies: the five `@codemirror/*` engine packages (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`) plus the `codemirror` meta-package (for the `basicSetup` bundle), all `^6`, + `vue`. Install them alongside this package.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';

const value = ref('const greeting = "hello";\n');
</script>

<template>
  <CodeMirror v-model:value="value" language="javascript" theme="dark" />
</template>
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `value` | `String` | `""` | ✓ |  |
| `language` | `String` | `"javascript"` |  |  |
| `theme` | `unknown` | `"light"` |  |  |
| `readOnly` | `Boolean` | `false` |  |  |
| `height` | `Number` | `240` |  |  |
| `placeholder` | `String` | `""` |  |  |
| `extensions` | `Array` | `[]` |  |  |
| `basicSetup` | `Boolean` | `false` |  |  |
| `gutterLines` | `Array` | `[]` |  |  |
| `decorations` | `Array` | `[]` |  |  |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```vue
<script setup>
import { ref } from 'vue';
const cm = ref();          // template ref
</script>

<template>
  <CodeMirror ref="cm" />
  <button @click="cm.focus()">Focus</button>
</template>
```

| Method | Description |
| --- | --- |
| `getView` | Return the underlying CodeMirror `EditorView` for direct API access. |
| `focus` | Focus the editor. |
| `getValue` | Return the current document text as a string. |
| `replaceValue` | Replace the document text — routes through the same suppress-echo guard as the `value` prop watcher. |
| `dispatch` | Dispatch a raw CodeMirror transaction — `dispatch(tr)`. |
| `insertText` | Insert text at the current main selection — `insertText(text)`. |
| `getSelection` | Return the main selection range (`{ anchor, head, from, to }`) or null. |
| `setSelection` | Set the selection — `setSelection(posNumber | { anchor, head })`. |

## Slots

| Slot | Params |
| --- | --- |
| panel | view |
| topPanel | view |
| tooltip | view, pos |
| gutter | line, view |
| decoration | from, to, view |
