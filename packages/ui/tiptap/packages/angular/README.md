# @rozie-ui/tiptap-angular

Idiomatic **angular** `TipTap` — a cross-framework rich-text editor component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [TipTap](https://tiptap.dev/) (the ProseMirror-based headless editor). Two-way `html` content binding, a batteries-included toolbar (or bring your own via the `toolbar` slot), a 14-verb imperative command handle, and `editorProps`/`extensions` passthroughs. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/tiptap-angular
```

Peer dependencies: the `@tiptap/core` + `@tiptap/starter-kit` engine (`^3`) + `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TipTap } from '@rozie-ui/tiptap-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [TipTap, FormsModule],
  template: `<TipTap [(html)]="html" placeholder="Start writing…" />`,
})
export class DemoComponent {
  html = '<p>Hello <strong>world</strong></p>';
}
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `html` model prop is the control value — so it binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TipTap } from '@rozie-ui/tiptap-angular';

@Component({
  selector: 'app-editor-form',
  standalone: true,
  imports: [TipTap, ReactiveFormsModule],
  template: `
    <!-- Reactive forms — [formControl] / formControlName bind directly -->
    <TipTap [formControl]="body" />
  `,
})
export class EditorFormComponent {
  body = new FormControl('<p>Start writing…</p>');
}

// Template-driven forms work the same way:
//   <TipTap [(ngModel)]="body" name="body" />
```

The accessor contract: only real user interaction dirties the control — programmatic writes (form `setValue` / `reset`, or the `[(html)]` two-way binding) update the view without echoing back into the form; `writeValue(null)` resets to the prop default (`"<p>Start writing…</p>"`); the control is marked touched on focusout.

## Props

| Name | Type | Default | Two-way (model) |
| --- | --- | --- | :---: |
| `html` | `String` | `"<p>Start writing…</p>"` | ✓ |
| `editable` | `Boolean` | `true` |  |
| `placeholder` | `String` | `""` |  |
| `autofocus` | `Boolean` | `false` |  |
| `editorClass` | `String` | `""` |  |
| `ariaLabel` | `String` | `"Rich text editor"` |  |
| `editorProps` | `Object` | `{}` |  |
| `extensions` | `Array` | `[]` |  |
| `starterKit` | `Object` | `{}` |  |
| `nodeSpecs` | `Array` | `[]` |  |
| `uploadImage` | `Function` | `null` |  |

## Events

| Event | Description |
| --- | --- |
| `update` | The document changed — payload is the new HTML string. |
| `selectionUpdate` | The selection (caret/range) moved. |
| `focus` | The editor gained focus. |
| `blur` | The editor lost focus. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(TipTap) editor!: TipTap;  // or the viewChild() signal
  bold() { this.editor.toggleBold(); }
  html() { return this.editor.getHTML(); }
}
```

| Method | Description |
| --- | --- |
| `getEditor` | Return the underlying TipTap `Editor` instance for direct API access (commands, state, schema, extension storage). |
| `focusEditor` | Focus the editor — place the caret in the document. |
| `blurEditor` | Blur the editor — remove focus from the document. |
| `getHTML` | Return the current document serialized as an HTML string. |
| `getJSON` | Return the current document as a ProseMirror JSON object (`JSONContent`). |
| `getText` | Return the current document as a plain-text string (word/char counts, search indexing, plaintext export). |
| `setContent` | Replace the document content — `setContent(html)`. Echo-guarded: reflects into the bound `html` model without bouncing an extra `update`. |
| `clearContent` | Clear the document to an empty paragraph (reflects the empty value into the bound `html` model). |
| `toggleBold` | Toggle bold on the current selection. |
| `toggleItalic` | Toggle italic on the current selection. |
| `toggleHeading` | Toggle a heading at the given level — `toggleHeading(level)` (defaults to 1). |
| `toggleBulletList` | Toggle a bullet list at the current selection. |
| `toggleUnderline` | Toggle underline on the current selection. |
| `toggleOrderedList` | Toggle an ordered (numbered) list at the current selection. |
| `undo` | Undo the last change. |
| `redo` | Redo the last undone change. |
| `chain` | Return a focused TipTap command chain for composing commands — e.g. `chain().toggleBold().toggleItalic().run()` (null before mount). |
| `isActive` | Whether a mark/node is active in the current selection — `isActive(name, attrs?)` (e.g. `isActive("heading", { level: 2 })`). Drives custom-toolbar active styling. False before mount. |
| `can` | Return the command-availability chain — `can().chain().focus().toggleBold().run()` returns a boolean — for enabling/disabling custom-toolbar buttons. null before mount. |
| `isEmpty` | Whether the document is empty — drives empty-state UI and submit-gating. true before mount. |

## Slots

When you fill the `toolbar` slot the internal toolbar is replaced by your own UI, which receives the live `editor` so its buttons can drive `editor.chain().focus()…run()`:

```ts
<ng-template #toolbar let-editor="editor"> … </ng-template>
```

| Slot | Params |
| --- | --- |
| toolbar | editor |
| bubbleMenu | editor |
| floatingMenu | editor |
| nodeView | node, selected, updateAttributes, getPos, editor, contentDOM |
