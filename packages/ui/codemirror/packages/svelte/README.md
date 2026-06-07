# @rozie-ui/codemirror-svelte

Idiomatic **svelte** `CodeMirror` — a cross-framework code editor compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [CodeMirror 6](https://codemirror.net/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/codemirror-svelte
```

Peer dependencies: the five `@codemirror/*` engine packages (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`) plus the `codemirror` meta-package (for the `basicSetup` bundle), all `^6`, + `svelte`. Install them alongside this package.

## Usage

```svelte
<script lang="ts">
  import CodeMirror from '@rozie-ui/codemirror-svelte';

  let value = $state('const greeting = "hello";\n');
</script>

<CodeMirror bind:value language="javascript" theme="dark" />
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

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```svelte
<script>
  let cm;                  // component instance via bind:this
</script>

<CodeMirror bind:this={cm} />
<button onclick={() => cm.focus()}>Focus</button>
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
