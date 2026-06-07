# @rozie-ui/codemirror-angular

Idiomatic **angular** `CodeMirror` — a cross-framework code editor compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [CodeMirror 6](https://codemirror.net/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/codemirror-angular
```

Peer dependencies: the five `@codemirror/*` engine packages (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`) plus the `codemirror` meta-package (for the `basicSetup` bundle), all `^6`, + `@angular/core + @angular/common`. Install them alongside this package.

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

## Angular forms

The generated class implements `ControlValueAccessor` — the `value` model prop is the control value — so it binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { CodeMirror } from '@rozie-ui/codemirror-angular';

@Component({
  selector: 'app-code-form',
  standalone: true,
  imports: [CodeMirror, ReactiveFormsModule],
  template: `
    <!-- Reactive forms — [formControl] / formControlName bind directly -->
    <CodeMirror [formControl]="source" />
  `,
})
export class CodeFormComponent {
  source = new FormControl('');
}

// Template-driven forms work the same way:
//   <CodeMirror [(ngModel)]="source" name="source" />
```

The accessor contract: only real user interaction dirties the control — programmatic writes (form `setValue` / `reset`, or the `[(value)]` two-way binding) update the view without echoing back into the form; `writeValue(null)` resets to the prop default (`""`); the control is marked touched on focusout.

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
| topPanel | view |
| tooltip | view, pos |
| gutter | line, view |
| decoration | from, to, view |
