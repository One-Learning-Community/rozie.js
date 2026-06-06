# @rozie-ui/codemirror-angular

Idiomatic **angular** `CodeMirror` — a cross-framework code editor compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [CodeMirror 6](https://codemirror.net/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/codemirror-angular
```

Peer dependencies: the five `@codemirror/*` engine packages (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`, all `^6`) + `@angular/core + @angular/common`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { CodeMirror } from '@rozie-ui/codemirror-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CodeMirror],
  template: `
    <CodeMirror [(value)]="value" language="javascript" theme="dark" />
  `,
})
export class DemoComponent {
  value = 'const greeting = "hello";\n';
}
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `value` | `String` | `""` | ✓ |  |
| `language` | `String` | `"javascript"` |  |  |
| `theme` | `String` | `"light"` |  |  |
| `readOnly` | `Boolean` | `false` |  |  |
| `height` | `Number` | `240` |  |  |
| `placeholder` | `String` | `""` |  |  |
| `extensions` | `Array` | `[]` |  |  |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(CodeMirror) cm!: CodeMirror;  // or the viewChild() signal
  focusEditor() { this.cm.focus(); }
  read() { return this.cm.getValue(); }
}
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
