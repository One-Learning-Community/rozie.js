# @rozie-ui/tiptap-svelte

Idiomatic **svelte** `TipTap` — a cross-framework rich-text editor component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [TipTap](https://tiptap.dev/) (the ProseMirror-based headless editor). Two-way `html` content binding, a batteries-included toolbar (or bring your own via the `toolbar` slot), a 14-verb imperative command handle, and `editorProps`/`extensions` passthroughs. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/tiptap-svelte
```

Peer dependencies: the `@tiptap/core` + `@tiptap/starter-kit` engine (`^3`) + `svelte`. Install them alongside this package.

## Usage

```svelte
<script lang="ts">
  import TipTap from '@rozie-ui/tiptap-svelte';

  let html = $state('<p>Hello <strong>world</strong></p>');
</script>

<TipTap bind:html placeholder="Start writing…" />
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

## Events

| Event | Description |
| --- | --- |
| `update` | The document changed — payload is the new HTML string. |
| `selectionUpdate` | The selection (caret/range) moved. |
| `focus` | The editor gained focus. |
| `blur` | The editor lost focus. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```svelte
<script>
  let editor;                 // component instance via bind:this
</script>

<TipTap bind:this={editor} />
<button onclick={() => editor.toggleBold()}>Bold</button>
```

| Method | Description |
| --- | --- |
| `getEditor` | Return the underlying TipTap `Editor` instance for direct API access (commands, state, schema, extension storage). |
| `focusEditor` | Focus the editor — place the caret in the document. |
| `blurEditor` | Blur the editor — remove focus from the document. |
| `getHTML` | Return the current document serialized as an HTML string. |
| `getJSON` | Return the current document as a ProseMirror JSON object (`JSONContent`). |
| `setContent` | Replace the document content — `setContent(html)`. Echo-guarded: reflects into the bound `html` model without bouncing an extra `update`. |
| `clearContent` | Clear the document to an empty paragraph (reflects the empty value into the bound `html` model). |
| `toggleBold` | Toggle bold on the current selection. |
| `toggleItalic` | Toggle italic on the current selection. |
| `toggleHeading` | Toggle a heading at the given level — `toggleHeading(level)` (defaults to 1). |
| `toggleBulletList` | Toggle a bullet list at the current selection. |
| `undo` | Undo the last change. |
| `redo` | Redo the last undone change. |
| `chain` | Return a focused TipTap command chain for composing commands — e.g. `chain().toggleBold().toggleItalic().run()` (null before mount). |

## Slots

When you fill the `toolbar` slot the internal toolbar is replaced by your own UI, which receives the live `editor` so its buttons can drive `editor.chain().focus()…run()`:

```svelte
{#snippet toolbar({ editor })} … {/snippet}
```

| Slot | Params |
| --- | --- |
| toolbar | editor |
