# @rozie-ui/tiptap-lit

Idiomatic **lit** `TipTap` — a cross-framework rich-text editor component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [TipTap](https://tiptap.dev/) (the ProseMirror-based headless editor). Two-way `html` content binding, a batteries-included toolbar (or bring your own via the `toolbar` slot), a 14-verb imperative command handle, and `editorProps`/`extensions` passthroughs. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/tiptap-lit
```

Peer dependencies: the `@tiptap/core` + `@tiptap/starter-kit` engine (`^3`) + `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/tiptap-lit';

// <rozie-tip-tap> is a custom element. Bind `html` as a property and listen
// for the two-way `html-change` event.
const el = document.querySelector('rozie-tip-tap');
el.html = '<p>Hello <strong>world</strong></p>';
el.addEventListener('html-change', (e) => console.log(e.detail));
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
// The custom element IS the handle — its exposed methods are public element
// methods.
const el = document.querySelector('rozie-tip-tap');
el.toggleBold();
const html = el.getHTML();
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
| `undo` | Undo the last change. |
| `redo` | Redo the last undone change. |
| `chain` | Return a focused TipTap command chain for composing commands — e.g. `chain().toggleBold().toggleItalic().run()` (null before mount). |
| `isActive` | Whether a mark/node is active in the current selection — `isActive(name, attrs?)` (e.g. `isActive("heading", { level: 2 })`). Drives custom-toolbar active styling. False before mount. |
| `can` | Return the command-availability chain — `can().chain().focus().toggleBold().run()` returns a boolean — for enabling/disabling custom-toolbar buttons. null before mount. |
| `isEmpty` | Whether the document is empty — drives empty-state UI and submit-gating. true before mount. |

## Slots

When you fill the `toolbar` slot the internal toolbar is replaced by your own UI, which receives the live `editor` so its buttons can drive `editor.chain().focus()…run()`:

```ts
.toolbar=${({ editor }) => html`…`}
```

| Slot | Params |
| --- | --- |
| toolbar | editor |
| bubbleMenu | editor |
| floatingMenu | editor |
| nodeView | node, selected, updateAttributes, getPos, editor, contentDOM |
