# TipTap — the cross-framework rich-text editor

`TipTap` is Rozie's data-bound port of [TipTap](https://tiptap.dev/) — the headless, ProseMirror-based rich-text editor. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers from a single wrapper. The official ecosystem is uneven: [`@tiptap/react`](https://www.npmjs.com/package/@tiptap/react) and [`@tiptap/vue-3`](https://www.npmjs.com/package/@tiptap/vue-3) are first-party, [`svelte-tiptap`](https://www.npmjs.com/package/svelte-tiptap) and [`ngx-tiptap`](https://www.npmjs.com/package/ngx-tiptap) are healthy community packages, [`solid-tiptap`](https://www.npmjs.com/package/solid-tiptap) is thin and stalling, and **Lit has no wrapper at all**. Rozie collapses all six into one source — and notably, **neither official wrapper ships a controlled two-way content contract or a toolbar**; Rozie does. See the [TipTap libraries comparison](/components/tiptap-comparison) for the full matrix.

This page is the **show-and-tell**: the API surface, per-framework quick starts, the events, the 14-verb imperative command handle, the `editorProps`/`extensions` passthroughs, the per-target recipe for the `toolbar` / `bubbleMenu` / `floatingMenu` portal slots, and the **`nodeView` reactive portal slot** that renders a framework fragment as a custom ProseMirror node (mention chips, embeds, editable callouts) on all six targets.

The full source for `TipTap.rozie` lives in the [`@rozie-ui/tiptap` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/src/TipTap.rozie).

## The `@rozie-ui/tiptap` packages

`TipTap` ships as six pre-compiled, per-framework packages generated from a single `TipTap.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/tiptap-react` | `npm i @rozie-ui/tiptap-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/packages/react/README.md) |
| `@rozie-ui/tiptap-vue` | `npm i @rozie-ui/tiptap-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/packages/vue/README.md) |
| `@rozie-ui/tiptap-svelte` | `npm i @rozie-ui/tiptap-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/packages/svelte/README.md) |
| `@rozie-ui/tiptap-angular` | `npm i @rozie-ui/tiptap-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/packages/angular/README.md) |
| `@rozie-ui/tiptap-solid` | `npm i @rozie-ui/tiptap-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/packages/solid/README.md) |
| `@rozie-ui/tiptap-lit` | `npm i @rozie-ui/tiptap-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/packages/lit/README.md) |

Each package carries the **two `@tiptap/*` engine peers** — `@tiptap/core` and `@tiptap/starter-kit` (both `^3`) — plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). Install the engine peers alongside the framework package:

```bash
npm i @rozie-ui/tiptap-react @tiptap/core @tiptap/starter-kit
```

TipTap is built from ProseMirror, which is framework-agnostic — the official wrappers exist only to glue `onUpdate` to component state and forward extensions. Rozie's wrapper does that plus a **controlled two-way `html` binding** (with an echo-guard), a **batteries-included toolbar** (or bring your own via the `toolbar` slot), a **14-verb imperative command handle**, and two consumer-extensibility passthroughs (`editorProps` for ProseMirror, `extensions` for extra TipTap extensions composed onto StarterKit). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `TipTap.rozie`, so they cannot drift from the compiled output — the package's `codegen.mjs` asserts the structural columns of this page against `ir.props` on every run.

## Quick start

The two-way value is `html` — the editor's document as an **HTML string**. Typing writes the new HTML back through the two-way path (TipTap's `onUpdate`), and a consumer write reflects into the live document (echo-guarded so a programmatic set doesn't reset the selection). The wrapper also emits `update` / `selectionUpdate` / `focus` / `blur` events.

### React

```tsx
import { useState } from 'react';
import { TipTap } from '@rozie-ui/tiptap-react';

export function Demo() {
  const [html, setHtml] = useState('<p>Hello <strong>world</strong></p>');
  return (
    <TipTap
      html={html}
      onHtmlChange={setHtml}
      placeholder="Start writing…"
      onUpdate={(html) => console.log('changed', html)}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import TipTap from '@rozie-ui/tiptap-vue';

const html = ref('<p>Hello <strong>world</strong></p>');
</script>

<template>
  <TipTap v-model:html="html" placeholder="Start writing…" />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import TipTap from '@rozie-ui/tiptap-svelte';

  let html = $state('<p>Hello <strong>world</strong></p>');
</script>

<TipTap bind:html placeholder="Start writing…" />
```

### Angular

```ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TipTap } from '@rozie-ui/tiptap-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [TipTap, FormsModule],
  template: `
    <TipTap [(html)]="html" placeholder="Start writing…" />
  `,
})
export class DemoComponent {
  html = '<p>Hello <strong>world</strong></p>';
}
```

### Solid

```tsx
import { createSignal } from 'solid-js';
import { TipTap } from '@rozie-ui/tiptap-solid';

export function Demo() {
  const [html, setHtml] = createSignal('<p>Hello <strong>world</strong></p>');
  return <TipTap html={html()} onHtmlChange={setHtml} placeholder="Start writing…" />;
}
```

### Lit

```ts
import '@rozie-ui/tiptap-lit';

// <rozie-tip-tap> is a custom element. Bind `html` as a property and listen for
// the two-way `html-change` event.
const el = document.querySelector('rozie-tip-tap');
el.html = '<p>Hello <strong>world</strong></p>';
el.placeholder = 'Start writing…';
el.addEventListener('html-change', (e) => {
  el.html = e.detail;
});
```

## API

### Props

| Name | Type | Default | Two-way (model) | Description |
| --- | --- | --- | :---: | --- |
| `html` | `String` | `"<p>Start writing…</p>"` | ✓ | The two-way document content as an HTML string. Typing writes back through the model path; a consumer write reflects into the live document (echo-guarded so a programmatic set doesn't reset the selection or re-emit `update`). |
| `editable` | `Boolean` | `true` | | Whether the document is editable. Toggling it calls TipTap's `setEditable` with `emitUpdate: false` (no spurious `update`). When `false`, the internal toolbar is hidden and the wrapper gets an `is-readonly` class. |
| `placeholder` | `String` | `""` | | Placeholder text, forwarded to the editor host as `data-placeholder` + `aria-placeholder`. For full empty-state placeholder rendering (show/hide on the empty doc), add TipTap's `Placeholder` extension through `:extensions`. |
| `autofocus` | `Boolean` | `false` | | Whether to place the caret in the document on mount (TipTap's `autofocus` option). |
| `editorClass` | `String` | `""` | | A CSS class applied to the contenteditable element (`editorProps.attributes.class`). |
| `ariaLabel` | `String` | `"Rich text editor"` | | The `aria-label` applied to the contenteditable element. |
| `editorProps` | `Object` | `{}` | | ProseMirror [`editorProps`](https://prosemirror.net/docs/ref/#view.EditorProps) passthrough — `handleKeyDown`, `handlePaste`, custom `attributes`, etc. Spread **last** so consumer `editorProps` win the wrapper's attribute defaults. |
| `extensions` | `Array` | `[]` | | Extra TipTap extensions composed onto `StarterKit` — the consumer-extensibility passthrough (TipTap's analog of an options bag). Consumer extensions genuinely win for a StarterKit-bundled node/mark: a same-named custom extension (e.g. a custom `Link`) auto-disables the corresponding `StarterKit` key, and the final extension array is name-deduped keeping the last (consumer) occurrence — no "Duplicate extension names" warning. Add Placeholder, Link, Image, Mention, custom nodes/marks, etc. |
| `starterKit` | `Object` | `{}` | | `StarterKit` config passthrough — spread into `StarterKit.configure(...)`. Accepts per-extension option objects or `false` to disable an extension, e.g. `{ heading: false }`, `{ link: { openOnClick: false } }`. An explicitly-set key here is always respected and never overridden by the `extensions` auto-disable scan. |
| `nodeSpecs` | `Array` | `[]` | | Custom ProseMirror node registration for the reactive `nodeView` portal slot — a general facility, read once at mount. Each entry: `{ name, tag, group, inline, atom, content, selectable, defining, attrs }`. One `Node.create` is built per entry; all render through the SAME `nodeView` fragment, dispatching on `scope.node.type.name`. An empty array (default) registers no custom nodes — zero overhead. |
| `uploadImage` | `Function` | `null` | | An async image-upload hook, `(file: File) => Promise<string>` resolving to a URL. When provided, the (otherwise-absent) `Image` extension is registered and pasting/dropping an image file uploads it via this function then inserts the resolved URL at the caret / drop position. When `null` (default), no `Image` extension and paste/drop are unchanged — zero overhead. Acts as a fallback: a consumer-supplied `editorProps.handlePaste` / `handleDrop` still wins. |

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `update` | `string` | The document changed — the new HTML string. (Also the channel that drives the two-way `html` model.) |
| `selectionUpdate` | — | The selection (caret / range) moved. |
| `focus` | — | The editor gained focus. |
| `blur` | — | The editor lost focus. |

### Imperative handle

Beyond props, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getEditor` | Return the underlying TipTap `Editor` for direct API access (commands, state, schema). `null` before mount and after destroy. |
| `focusEditor` | Focus the editor — place the caret in the document. |
| `blurEditor` | Blur the editor — remove focus. |
| `getHTML` | Return the current document serialized as an HTML string. |
| `getJSON` | Return the current document as a ProseMirror JSON object. |
| `setContent` | Replace the document — `setContent(html)`. Echo-guarded: reflects into the bound `html` model without bouncing an extra `update`. |
| `clearContent` | Clear the document to an empty paragraph (reflects the empty value into the `html` model). |
| `toggleBold` | Toggle bold on the current selection. |
| `toggleItalic` | Toggle italic on the current selection. |
| `toggleHeading` | Toggle a heading at a level — `toggleHeading(level)` (defaults to 1). |
| `toggleBulletList` | Toggle a bullet list at the current selection. |
| `toggleUnderline` | Toggle underline on the current selection. |
| `toggleOrderedList` | Toggle an ordered (numbered) list at the current selection. |
| `undo` | Undo the last change. |
| `redo` | Redo the last undone change. |
| `chain` | Return a focused TipTap command chain for composing commands — `chain().toggleBold().toggleItalic().run()`. `null` before mount. |

::: tip The focus/blur verbs are `focusEditor` / `blurEditor`, not `focus` / `blur`
The component emits `focus` and `blur` **events**, and on class-based targets (Angular) an output field and a method cannot share a name (ROZ121). The imperative verbs are therefore named `focusEditor` / `blurEditor`, keeping the event names idiomatic for consumers. Likewise the content setter is `setContent`, not `setHtml` — an `html` model prop makes the React target auto-generate a `setHtml` state setter (ROZ524).
:::

**React example:**

```tsx
import { useRef } from 'react';
import { TipTap, type TipTapHandle } from '@rozie-ui/tiptap-react';

const editor = useRef<TipTapHandle>(null);
// <TipTap ref={editor} ... />
editor.current?.toggleBold();
const html = editor.current?.getHTML();
editor.current?.chain()?.toggleItalic().toggleBulletList().run();
```

## Slots

The wrapper surfaces **four** portal slots. Three are **mount-once** — `toolbar`, `bubbleMenu`, `floatingMenu` — each handed the live `editor` so its buttons can drive `editor.chain().focus()…run()`. The fourth, `nodeView`, is a **reactive** slot covered in [Node-view slots](#node-view-slots) below. Fill `toolbar` and your toolbar UI replaces the internal one; leave it unfilled and the **batteries-included internal toolbar** (Bold / Italic / H1 / H2 / Bullet list / Underline / Ordered list, with live active-state highlighting, plus Undo / Redo) renders.

| Slot | Renders | Scope param |
| --- | --- | --- |
| `toolbar` | A consumer toolbar above the editor (replaces the internal one) | `editor` |
| `bubbleMenu` | A consumer menu shown on a non-empty text selection (over `@tiptap/extension-bubble-menu`) | `editor` |
| `floatingMenu` | A consumer menu shown on an empty line (over `@tiptap/extension-floating-menu`) | `editor` |

Each target fills `#toolbar` through its native imperative-render API:

**React** (render prop):

```tsx
<TipTap
  html={html}
  onHtmlChange={setHtml}
  renderToolbar={({ editor }) => (
    <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
  )}
/>
```

**Solid** (render prop):

```tsx
<TipTap
  html={html()}
  onHtmlChange={setHtml}
  renderToolbar={({ editor }) => (
    <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
  )}
/>
```

**Vue** (scoped slot):

```vue
<TipTap v-model:html="html">
  <template #toolbar="{ editor }">
    <button @click="editor.chain().focus().toggleBold().run()">Bold</button>
  </template>
</TipTap>
```

**Svelte** (snippet):

```svelte
<TipTap bind:html>
  {#snippet toolbar({ editor })}
    <button onclick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
  {/snippet}
</TipTap>
```

**Angular** (content child `<ng-template>`):

```html
<TipTap [(html)]="html">
  <ng-template #toolbar let-editor="editor">
    <button (click)="editor.chain().focus().toggleBold().run()">Bold</button>
  </ng-template>
</TipTap>
```

**Lit** (slot bridge — pass the render callback as a property):

```ts
const el = document.querySelector('rozie-tip-tap');
el.toolbar = ({ editor }) =>
  html`<button @click=${() => editor.chain().focus().toggleBold().run()}>Bold</button>`;
```

On every target the wrapper's `$portals.toolbar(node, { editor })` closure mounts the consumer's fragment into the toolbar host container and returns a dispose handle the wrapper calls on unmount.

### Bubble & floating menu slots

The `bubbleMenu` and `floatingMenu` slots are **selection-anchored menus** over TipTap's Floating-UI menu extensions (`@tiptap/extension-bubble-menu` / `@tiptap/extension-floating-menu`). They use the **same mount-once portal shape** as `toolbar` and receive the live `editor` — but the menu's host element is created by the wrapper and positioned by Floating UI, so you only supply the menu fragment. By default the **bubble menu** appears on a non-empty text selection and the **floating menu** on an empty line. Each menu extension is added **only when its slot is filled** (zero overhead otherwise), and the two extension peers are declared optional on every leaf package — install them only if you use the slots.

The fill API mirrors `toolbar` exactly — `renderBubbleMenu` / `renderFloatingMenu` render props (React/Solid), `#bubbleMenu` / `#floatingMenu` scoped slots (Vue) / snippets (Svelte) / `<ng-template>` content children (Angular), or `bubbleMenu` / `floatingMenu` properties on the Lit element:

**Vue:**

```vue
<TipTap v-model:html="html">
  <template #bubbleMenu="{ editor }">
    <button @click="editor.chain().focus().toggleBold().run()">Bold</button>
    <button @click="editor.chain().focus().toggleItalic().run()">Italic</button>
  </template>
  <template #floatingMenu="{ editor }">
    <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">H1</button>
  </template>
</TipTap>
```

**React:**

```tsx
<TipTap
  html={html}
  onHtmlChange={setHtml}
  renderBubbleMenu={({ editor }) => (
    <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
  )}
  renderFloatingMenu={({ editor }) => (
    <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
  )}
/>
```

On every target the wrapper's `$portals.bubbleMenu(node, { editor })` / `$portals.floatingMenu(node, { editor })` closures mount the consumer's menu fragment into the engine-owned (imperatively created) menu host and return a dispose handle called on unmount.

## Node-view slots

TipTap's marquee feature is the **node view** — rendering a framework component as a custom ProseMirror node (a mention chip, an embed, an interactive widget, an editable callout). `@rozie-ui/tiptap` ships it as the `nodeView` slot, the **first reactive portal slot**: the consumer fragment re-renders **in place** (no remount) every time the engine reports a transaction — a selection change, an attribute update, the cursor entering or leaving the node.

| Slot | Renders | Scope params |
| --- | --- | --- |
| `nodeView` | A framework fragment as a custom ProseMirror node (mention chip, embed, editable callout) | `node`, `selected`, `updateAttributes`, `getPos`, `editor`, `contentDOM` |

The wrapper bundles two custom nodes that fill this slot:

- **`rozieMention`** — a non-editable inline **atom** (a `@mention` chip). It has no editable children, so it ignores `contentDOM`. `selected` flips as the caret enters/leaves it and the fragment re-renders to reflect it.
- **`rozieCallout`** — an editable **block**. It owns a ProseMirror-managed editable hole; its fragment renders chrome wrapping a `[data-rozie-hole]` placeholder, and the bridge grafts the engine-owned hole into it (see the recipe below).

### Engine-driven re-render

The slot is driven by ProseMirror's `NodeView` lifecycle, not a Rozie reactive loop. When a transaction touches the node — `update(node)`, `selectNode()`, `deselectNode()` — the wrapper calls the reactive portal's `update(scope)` with the fresh `node` / `selected` scope and the fragment re-renders **in place**. The grafted `contentDOM` is preserved across re-renders, so the editable subtree is never clobbered. (The three mount-once slots — this wrapper's `toolbar`, CodeMirror's `panel`, Chart.js's `tooltip` — keep their `() => void` shape; only `nodeView` is reactive.)

### The contentDOM editable-hole recipe

An editable node view splits its DOM in two: the **chrome** you render, and the **editable hole** ProseMirror owns. Your fragment renders the chrome and marks where the hole goes with a `[data-rozie-hole]` element; the per-target bridge grafts `contentDOM` into it. After the graft, ProseMirror manages that subtree — your framework must never render children into it.

A single fragment can serve both node types by branching on `node.type.name` at the **expression** level (`:class`, `:data-*`) rather than with `r-if` — an `r-if` (or `@if`) block nested inside a projected Angular `<ng-template>` slot breaks consumer AOT, so the inactive half is hidden with CSS instead:

```vue
<template #nodeView="{ node, selected }">
  <span :class="node.type.name === 'rozieCallout' ? 'is-callout' : 'is-mention'">
    <!-- mention chip -->
    <span class="chip" :data-selected="selected ? 'true' : 'false'">{{ node.attrs.label }}</span>
    <!-- editable callout: the [data-rozie-hole] placeholder gets contentDOM grafted in -->
    <span class="callout" :data-tone="node.attrs.tone">
      <span class="badge">{{ node.attrs.tone }}</span>
      <span :data-rozie-hole="node.type.name === 'rozieCallout' ? '' : null"></span>
    </span>
  </span>
</template>
```

The graft is synchronous on every target, but the **idiom differs by ref-timing** (you don't write this — it's emitted per target — but it explains why the recipe is "render a placeholder, let the bridge fill it" rather than "ref the hole yourself"):

| Target | Graft idiom |
| --- | --- |
| React / Solid / Lit | native `ref` (synchronous-within-render) |
| Vue / Svelte / Angular | query-after-render (`dom.querySelector('[data-rozie-hole]')` post-mount) |

### Per-target consumer shape

The `nodeView` slot uses the same native imperative-render API as every other portal slot — `renderNodeView` render prop, `#nodeView` scoped slot / snippet / content-child, or a `nodeView` property on the Lit element:

**React / Solid** (render prop):

```tsx
<TipTap
  html={html}
  onHtmlChange={setHtml}
  renderNodeView={({ node, selected }) => (
    <span data-selected={selected}>{node.attrs.label}</span>
  )}
/>
```

**Vue** (scoped slot):

```vue
<TipTap v-model:html="html">
  <template #nodeView="{ node, selected }">
    <span :data-selected="selected">{{ node.attrs.label }}</span>
  </template>
</TipTap>
```

**Svelte** (snippet):

```svelte
<TipTap bind:html>
  {#snippet nodeView({ node, selected })}
    <span data-selected={selected}>{node.attrs.label}</span>
  {/snippet}
</TipTap>
```

**Angular** (content child `<ng-template>`):

```html
<TipTap [(html)]="html">
  <ng-template #nodeView let-node="node" let-selected="selected">
    <span [attr.data-selected]="selected">{{ node.attrs.label }}</span>
  </ng-template>
</TipTap>
```

**Lit** (slot bridge — pass the render callback as a property):

```ts
const el = document.querySelector('rozie-tip-tap');
el.nodeView = ({ node, selected }) =>
  html`<span data-selected=${selected}>${node.attrs.label}</span>`;
```

The same `TipTap.rozie` source ships this into **Solid** (where `solid-tiptap` has no node-view renderer) and **Lit** (where no wrapper exists at all) — see the [comparison page](/components/tiptap-comparison#node-view-portal-slots-g1-shipped) for the gap context.

## Recipes

### Driving the editor from the toolbar handle

The 14 `$expose` verbs cover the imperative surface props alone can't express. Grab the handle and wire your own external toolbar — without the `toolbar` slot — by calling the command verbs directly:

```tsx
const editor = useRef<TipTapHandle>(null);
// <TipTap ref={editor} ... />
<button onClick={() => editor.current?.toggleBold()}>Bold</button>
<button onClick={() => editor.current?.toggleHeading(2)}>H2</button>
<button onClick={() => editor.current?.undo()}>Undo</button>
<button onClick={() => console.log(editor.current?.getJSON())}>Log JSON</button>
```

### Adding extensions via `:extensions`

StarterKit is the bundled baseline. Everything else — Placeholder, Link, Image, TextAlign, Mention, custom nodes/marks — comes through the `:extensions` passthrough. The wrapper composes consumer extensions **last** so they win for the same node/mark — and when your extension replaces one StarterKit already bundles (e.g. a custom `Link`), the wrapper auto-disables StarterKit's copy via `StarterKit.configure({ link: false })` so you get no "Duplicate extension names" warning and your extension's schema/attrs are the ones that render:

```bash
npm i @tiptap/extension-placeholder @tiptap/extension-link
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import TipTap from '@rozie-ui/tiptap-vue';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';

const html = ref('<p></p>');
// A custom Link replaces StarterKit's bundled Link automatically — no
// `starterKit={{ link: false }}` needed, and no duplicate-extension warning.
const extensions = [Placeholder.configure({ placeholder: 'Write something…' }), Link.configure({ openOnClick: false })];
</script>

<template>
  <TipTap v-model:html="html" :extensions="extensions" />
</template>
```

### Configuring StarterKit via `:starterKit`

Reach into any bundled StarterKit extension directly — no need to know which extension needs disabling for a custom replacement (the `extensions` auto-disable scan above already handles that case). Use `starterKit` when you just want to reconfigure or turn off a StarterKit-native extension in place:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import TipTap from '@rozie-ui/tiptap-vue';

const html = ref('<p></p>');
// Restrict headings to H1/H2 and turn off the bundled horizontal rule.
const starterKit = { heading: { levels: [1, 2] }, horizontalRule: false };
</script>

<template>
  <TipTap v-model:html="html" :starter-kit="starterKit" />
</template>
```

An explicit key in `starterKit` is always respected — it is never overridden by the `extensions` auto-disable scan, even if you also pass a same-named custom extension.

### Customizing ProseMirror behavior via `:editorProps`

`editorProps` is forwarded straight to ProseMirror. Override paste handling, key bindings, or the contenteditable attributes:

```tsx
<TipTap
  html={html}
  onHtmlChange={setHtml}
  editorProps={{
    handlePaste: (view, event) => {
      // custom paste handling; return true to mark as handled
      return false;
    },
    attributes: { class: 'prose max-w-none', spellcheck: 'false' },
  }}
/>
```

## Gotchas

### The echo-guard keeps two-way binding from ping-ponging

A model two-way binding can ping-pong: the consumer's state signals back into the wrapper's `html` watcher faster than the wrapper's own emit clears. The wrapper solves this once with a `lastHtml` guard shared by the `html` watcher, the `onUpdate` reflect, **and** the `setContent` / `clearContent` handle verbs. The guard compares against the **raw** last value (not `editor.getHTML()`, ProseMirror's normalized serialization), so a mount-time or prop-driven set never re-runs `setContent` and resets the selection.

### Why `focus` / `blur` are events but the verbs are renamed

`focus` and `blur` are emitted as events (so consumers can wire save-on-blur or toolbar show/hide). Because an Angular output field and a method cannot share a name (ROZ121), the imperative commands are `focusEditor` / `blurEditor`. This keeps **both** capabilities — the focus/blur notifications *and* the imperative focus/blur control — alive across all six targets.

### Placeholder rendering is bundled

The `placeholder` prop renders empty-state ghost text out of the box — the text shows only while the document is empty and hides as you type. `@rozie-ui/tiptap` bundles `@tiptap/extensions` (ships `Placeholder` in v3) and wires the prop to `Placeholder.configure({ placeholder })` at editor construction, so no consumer `:extensions` wiring is needed. The ghost-text CSS reaches the engine-rendered `.is-editor-empty` node (which carries no Rozie scope attribute) via the `:root { }` engine-DOM escape hatch on all six targets. The prop still also forwards `aria-placeholder` for assistive tech. See the [comparison page](/components/tiptap-comparison#bundle-placeholder-g3-shipped) for details.

### Feature-complete versus the official wrappers

TipTap's marquee feature — **custom node views** — ships via the [`nodeView` reactive slot](#node-view-slots), and selection-anchored **bubble / floating menus** ship via the [`bubbleMenu` / `floatingMenu` slots](#bubble-floating-menu-slots), both uniformly across all six targets (including Solid and Lit, where no upstream renderer exists). Together with the bundled Placeholder and the auto-emitted Angular `ControlValueAccessor`, that closes every meaningful gap versus the official wrappers. The one intentionally-unmatched item is switching the *two-way model payload itself* to JSON (`ngx-tiptap`'s `outputFormat`) — read JSON off the `getJSON()` handle instead. See the [comparison page](/components/tiptap-comparison#bubble-floating-menu-slots-g2-shipped) for the full matrix.

## Cross-references

- [`TipTap.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/src/TipTap.rozie) — the canonical wrapper.
- [TipTap libraries comparison](/components/tiptap-comparison) — the per-framework wrapper matrix + the gap-closure status.
- [The portal-slot primitive](/examples/portal-list) — how `<slot name="X" portal />` routes a consumer fragment through each target's imperative-render API. The `nodeView` slot adds the `reactive` flag for engine-driven in-place re-render.
- [`$expose` and the imperative handle](/guide/features#expose-→-a-consumer-callable-imperative-handle-everywhere)
- [`r-model` — two-way binding everywhere](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere)
