# @rozie-ui/codemirror-solid

Idiomatic **solid** `CodeMirror` — a cross-framework code editor compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [CodeMirror 6](https://codemirror.net/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/codemirror-solid
```

Peer dependencies: the five `@codemirror/*` engine packages (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`) plus the `codemirror` meta-package (for the `basicSetup` bundle), all `^6`, + `solid-js`. Install them alongside this package.

## Usage

```tsx
import { createSignal } from 'solid-js';
import { CodeMirror } from '@rozie-ui/codemirror-solid';

export function Demo() {
  const [value, setValue] = createSignal('const greeting = "hello";\n');
  return (
    <CodeMirror
      value={value()}
      onValueChange={setValue}
      language="javascript"
      theme="dark"
    />
  );
}
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

```tsx
import { CodeMirror, type CodeMirrorHandle } from '@rozie-ui/codemirror-solid';

let handle: CodeMirrorHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<CodeMirror ref={(h) => (handle = h)} />;
handle?.focus();
const text = handle?.getValue();
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
| `undo` | Undo the last change (CodeMirror history command). |
| `redo` | Redo the last undone change. |
| `selectAll` | Select the entire document. |
| `scrollToPos` | Scroll a document position into view — `scrollToPos(pos, opts?)` (defaults to vertically centering). Not named `scrollIntoView`/`scrollTo` to avoid the Lit inherited-method shadow. |

## Slots

| Slot | Params |
| --- | --- |
| panel | view |
| topPanel | view |
| tooltip | view, pos |
| gutter | line, view |
| decoration | from, to, view |
