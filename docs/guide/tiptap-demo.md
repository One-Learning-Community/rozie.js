---
title: TipTap — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import TipTap from '@rozie-ui/tiptap-vue';

// An in-memory initial document — network-free (so the demo works offline and in
// CI). The two-way `html` model is the editor's document serialized as an HTML
// string; typing writes the new HTML back, the readout below mirrors it live.
const html = ref(
  '<h2>Rozie ❤️ TipTap</h2><p>This is the <strong>real</strong> <em>@rozie-ui/tiptap-vue</em> editor. Select some text and hit a toolbar button, or just start typing.</p><ul><li>One source.</li><li>Six frameworks.</li></ul>'
);

const editor = ref();

// A rough word count off the bound HTML string — strips tags, collapses
// whitespace. Updates live as you type because `html` is the two-way model.
const words = () => {
  const text = html.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
};
</script>

# TipTap — live demo

This is the **real `@rozie-ui/tiptap-vue` package** running on this page (VitePress is itself a Vue app). Type in the editor, select text and drive the formatting buttons, or hit **Clear** — then watch the live HTML readout and word count update. Everything below is driven by the same `TipTap.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="tiptap-live">
  <div class="tiptap-live__controls">
    <button @click="editor?.toggleBold()"><strong>B</strong> Bold</button>
    <button @click="editor?.toggleItalic()"><em>I</em> Italic</button>
    <span class="tiptap-live__sep" />
    <button @click="editor?.toggleHeading(1)">H1</button>
    <button @click="editor?.toggleHeading(2)">H2</button>
    <button @click="editor?.toggleBulletList()">• List</button>
    <span class="tiptap-live__sep" />
    <button @click="editor?.undo()">↶ Undo</button>
    <button @click="editor?.redo()">↷ Redo</button>
    <span class="tiptap-live__sep" />
    <button @click="editor?.focusEditor()">Focus</button>
    <button class="tiptap-live__primary" @click="editor?.clearContent()">Clear</button>
  </div>

  <div class="tiptap-live__stage">
    <TipTap
      ref="editor"
      v-model:html="html"
      placeholder="Start writing…"
      style="min-height: 200px;"
    />
  </div>

  <div class="tiptap-live__readout">
    <code>{{ words() }} words · {{ html.length }} chars of HTML</code>
  </div>

  <div class="tiptap-live__output">
    <strong>Bound HTML</strong>
    <pre>{{ html }}</pre>
  </div>
</div>
</ClientOnly>

The document is two-way bound with `v-model:html` — the readout above updates live as you type, and the buttons drive the imperative handle (`toggleBold`, `toggleItalic`, `toggleHeading`, `toggleBulletList`, `undo`, `redo`, `focusEditor`, `clearContent`). The component bundles its own toolbar (Bold / Italic / H1 / H2 / Bullet list, with live active-state highlighting); the buttons here are a second, *external* toolbar driving the same `$expose` handle. See the [full API](/guide/tiptap) for the complete prop/event/handle surface — including the `toolbar` / `bubbleMenu` / `floatingMenu` portal slots and the reactive `nodeView` slot.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/tiptap/src/TipTap.rozie{html}[TipTap.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/tiptap-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/tiptap/packages/react/src/TipTap.tsx[React]
<<< ../../packages/ui/tiptap/packages/vue/src/TipTap.vue[Vue]
<<< ../../packages/ui/tiptap/packages/svelte/src/TipTap.svelte[Svelte]
<<< ../../packages/ui/tiptap/packages/angular/src/TipTap.ts[Angular]
<<< ../../packages/ui/tiptap/packages/solid/src/TipTap.tsx[Solid]
<<< ../../packages/ui/tiptap/packages/lit/src/TipTap.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same events, same 14-verb imperative handle, same portal slots, all from the one source above.

## See also

- [TipTap — showcase & API](/guide/tiptap) — install, quick starts for all six frameworks, the events, the imperative handle, and the toolbar / bubble-menu / floating-menu / node-view slots.
- [TipTap libraries comparison](/guide/tiptap-comparison) — how `@rozie-ui/tiptap` stacks up against the per-framework wrappers.

<style scoped>
.tiptap-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.tiptap-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.tiptap-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.tiptap-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.tiptap-live__controls button.tiptap-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.tiptap-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.tiptap-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  overflow: hidden;
}
.tiptap-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
.tiptap-live__output {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--vp-c-divider);
}
.tiptap-live__output pre {
  display: block;
  margin-top: 0.5rem;
  padding: 0.6rem 0.75rem;
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.78rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}
</style>
