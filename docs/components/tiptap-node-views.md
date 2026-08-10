# Node-view slots

The deep dive for the `nodeView` reactive portal slot on [`<TipTap>`](/components/tiptap), which renders a framework fragment as a custom ProseMirror node on all six targets.

TipTap's marquee feature is the **node view** — rendering a framework component as a custom ProseMirror node (a mention chip, an embed, an interactive widget, an editable callout). `@rozie-ui/tiptap` ships it as the `nodeView` slot, the **first reactive portal slot**: the consumer fragment re-renders **in place** (no remount) every time the engine reports a transaction — a selection change, an attribute update, the cursor entering or leaving the node.

| Slot | Renders | Scope params |
| --- | --- | --- |
| `nodeView` | A framework fragment as a custom ProseMirror node (mention chip, embed, editable callout) | `node`, `selected`, `updateAttributes`, `getPos`, `editor`, `contentDOM` |

The wrapper bundles two custom nodes that fill this slot:

- **`rozieMention`** — a non-editable inline **atom** (a `@mention` chip). It has no editable children, so it ignores `contentDOM`. `selected` flips as the caret enters/leaves it and the fragment re-renders to reflect it.
- **`rozieCallout`** — an editable **block**. It owns a ProseMirror-managed editable hole; its fragment renders chrome wrapping a `[data-rozie-hole]` placeholder, and the bridge grafts the engine-owned hole into it (see the recipe below).

## Engine-driven re-render

The slot is driven by ProseMirror's `NodeView` lifecycle, not a Rozie reactive loop. When a transaction touches the node — `update(node)`, `selectNode()`, `deselectNode()` — the wrapper calls the reactive portal's `update(scope)` with the fresh `node` / `selected` scope and the fragment re-renders **in place**. The grafted `contentDOM` is preserved across re-renders, so the editable subtree is never clobbered. (The three mount-once slots — this wrapper's `toolbar`, CodeMirror's `panel`, Chart.js's `tooltip` — keep their `() => void` shape; only `nodeView` is reactive.)

## The contentDOM editable-hole recipe

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

## Per-target consumer shape

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

The same `TipTap.rozie` source ships this into **Solid** (where `solid-tiptap` has no node-view renderer) and **Lit** (where no wrapper exists at all) — see the [comparison page](/components/tiptap-comparison) for the gap context.

## See also

- [TipTap showcase & API](/components/tiptap): the full props / events / imperative-handle reference and the other portal slots (`toolbar`, `bubbleMenu`, `floatingMenu`, `linkEditor`, `count`).
- [The portal-slot primitive](/examples/portal-list): how `<slot name="X" portal />` routes a consumer fragment through each target's imperative-render API.
- [TipTap libraries comparison](/components/tiptap-comparison): the per-framework wrapper matrix and the node-view gap context.
