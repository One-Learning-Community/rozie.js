# @rozie-ui/tiptap-react

Idiomatic **react** `TipTap` — a cross-framework rich-text editor component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [TipTap](https://tiptap.dev/) (the ProseMirror-based headless editor). Two-way `html` content binding, a batteries-included toolbar (or bring your own via the `toolbar` slot), a 14-verb imperative command handle, and `editorProps`/`extensions` passthroughs. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/tiptap-react
```

Peer dependencies: the `@tiptap/core` + `@tiptap/starter-kit` engine (`^3`) + `react + react-dom`. Install them alongside this package.

## Usage

```tsx
import { useState } from 'react';
import { TipTap } from '@rozie-ui/tiptap-react';

export function Demo() {
  const [html, setHtml] = useState('<p>Hello <strong>world</strong></p>');
  return <TipTap html={html} onHtmlChange={setHtml} placeholder="Start writing…" />;
}
```

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
| `maxLength` | `Number` | `null` |  |
| `enforceMaxLength` | `Boolean` | `false` |  |

## Events

| Event | Description |
| --- | --- |
| `update` | The document changed — payload is the new HTML string. |
| `selectionUpdate` | The selection (caret/range) moved. |
| `focus` | The editor gained focus. |
| `blur` | The editor lost focus. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```tsx
import { useRef } from 'react';
import { TipTap, type TipTapHandle } from '@rozie-ui/tiptap-react';

const editor = useRef<TipTapHandle>(null);
// <TipTap ref={editor} ... />
editor.current?.toggleBold();
const html = editor.current?.getHTML();
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
| `getCharacterCount` | Return the current character count. Reads the CharacterCount extension's live storage when registered (`maxLength` set or the `#count` slot filled), else falls back to `getText().length`. Always a number — 0 before mount. |
| `getWordCount` | Return the current word count. Reads the CharacterCount extension's live storage when registered, else falls back to a whitespace-split count of `getText()`. Always a number — 0 before mount. |

## Slots

When you fill the `toolbar` slot the internal toolbar is replaced by your own UI, which receives the live `editor` so its buttons can drive `editor.chain().focus()…run()`:

```tsx
renderToolbar={({ editor }) => <MyToolbar editor={editor} />}
```

| Slot | Params |
| --- | --- |
| count | characters, words, maxLength, over |
| toolbar | editor |
| bubbleMenu | editor |
| floatingMenu | editor |
| nodeView | node, selected, updateAttributes, getPos, editor, contentDOM |
