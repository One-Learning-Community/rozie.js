<template>

<div :class="['rozie-tiptap', { 'is-readonly': !props.editable }]">
  
  <div v-if="props.editable && !$slots.toolbar" class="rozie-tiptap-toolbar">
    <button type="button" :class="{ active: active.bold }" aria-label="Bold" @click="toggleBold"><strong>B</strong></button>
    <button type="button" :class="{ active: active.italic }" aria-label="Italic" @click="toggleItalic"><em>I</em></button>
    <span class="sep"></span>
    <button type="button" :class="{ active: active.h1 }" aria-label="Heading 1" @click="toggleHeading(1)">H1</button>
    <button type="button" :class="{ active: active.h2 }" aria-label="Heading 2" @click="toggleHeading(2)">H2</button>
    <span class="sep"></span>
    <button type="button" :class="{ active: active.bulletList }" aria-label="Bullet list" @click="toggleBulletList">• List</button>
  </div><div v-if="props.editable && $slots.toolbar" class="rozie-tiptap-toolbar rozie-tiptap-toolbar--slot" ref="toolbarElRef"></div><div ref="editorElRef" class="rozie-tiptap-content" :data-placeholder="props.placeholder"></div>
</div>



</template>

<script setup lang="ts">
import { Fragment, h, onBeforeUnmount, onMounted, ref, render, useSlots, watch } from 'vue';

const props = withDefaults(
  defineProps<{ editable?: boolean; placeholder?: string; autofocus?: boolean; editorClass?: string; ariaLabel?: string; editorProps?: Record<string, any>; extensions?: any[] }>(),
  { editable: true, placeholder: '', autofocus: false, editorClass: '', ariaLabel: 'Rich text editor', editorProps: () => ({}), extensions: () => [] }
);

const html = defineModel<string>('html', { default: '<p>Start writing…</p>' });

const emit = defineEmits<{
  update: [...args: any[]];
  selectionUpdate: [...args: any[]];
  focus: [...args: any[]];
  blur: [...args: any[]];
}>();

defineSlots<{
  toolbar(props: { editor: any }): any;
}>();

const slots = useSlots();

const active = ref({
  bold: false,
  italic: false,
  h1: false,
  h2: false,
  bulletList: false
});

const toolbarElRef = ref<HTMLElement>();
const editorElRef = ref<HTMLElement>();

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// The live editor instance — null before mount / after destroy. Named `editor`
// (distinct from any template `ref="X"` name) so no capture-var-vs-ref double
// declaration trap (the Chart.js canvasEl/canvasNode lesson).
// The live editor instance — null before mount / after destroy. Named `editor`
// (distinct from any template `ref="X"` name) so no capture-var-vs-ref double
// declaration trap (the Chart.js canvasEl/canvasNode lesson).
let editor: any = null;

// The raw HTML string the editor currently reflects. Compared against in the
// $props.html reconciler so the watcher's mount-time fire is a no-op: the
// editor is created with `content: $props.html`, so right after mount the bound
// model already matches and setContent must NOT re-run (re-running it replaces
// the whole ProseMirror document and resets the selection — the official
// @tiptap/* wrappers guard the same way against the *raw* value, never against
// the normalized `editor.getHTML()`). This is the CodeMirror suppress-echo
// guard in HTML-string form (flatpickr lineage).
// The raw HTML string the editor currently reflects. Compared against in the
// $props.html reconciler so the watcher's mount-time fire is a no-op: the
// editor is created with `content: $props.html`, so right after mount the bound
// model already matches and setContent must NOT re-run (re-running it replaces
// the whole ProseMirror document and resets the selection — the official
// @tiptap/* wrappers guard the same way against the *raw* value, never against
// the normalized `editor.getHTML()`). This is the CodeMirror suppress-echo
// guard in HTML-string form (flatpickr lineage).
let lastHtml: any = null;

// The `toolbar` portal slot's dispose handle. COMPONENT-scope (top-level let),
// NOT a $onMount-local — the Solid emitter hoists the $onMount-returned cleanup
// into a sibling onCleanup() OUTSIDE the mount-body IIFE, so a mount-local would
// lose scope there (the Chart.js tooltipEl/tooltipDispose hoist lesson).
// The `toolbar` portal slot's dispose handle. COMPONENT-scope (top-level let),
// NOT a $onMount-local — the Solid emitter hoists the $onMount-returned cleanup
// into a sibling onCleanup() OUTSIDE the mount-body IIFE, so a mount-local would
// lose scope there (the Chart.js tooltipEl/tooltipDispose hoist lesson).
let toolbarDispose: any = null;

// Recompute the internal toolbar's active-mark booleans from the live editor.
// Recompute the internal toolbar's active-mark booleans from the live editor.
const refreshActive = () => {
  if (!editor) return;
  active.value = {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    h1: editor.isActive('heading', {
      level: 1
    }),
    h2: editor.isActive('heading', {
      level: 2
    }),
    bulletList: editor.isActive('bulletList')
  };
};
// ── Imperative handle (Phase 21 $expose) — TipTap is command-rich, so this is
// the marquee surface: 14 verbs over the live Editor, uniform across all 6
// targets. Each guards the pre-mount / destroyed `editor = null`.
//
// Collision discipline:
//   - The content setter is named `setContent`, NOT `setHtml` — an `html` model
//     prop makes React auto-generate a `setHtml` state setter, so a `setHtml`
//     $expose verb would collide on the React target (ROZ524). (CodeMirror's
//     setValue→replaceValue lesson, html edition.)
//   - None of the 14 names collide with LitElement reserved lifecycle methods
//     (update/render/firstUpdated/updated/willUpdate/requestUpdate).
//   - The focus/blur COMMANDS are named `focusEditor`/`blurEditor`, NOT
//     `focus`/`blur` — the component emits `focus`/`blur` EVENTS, and on
//     class-based targets (Angular) an output field and a method cannot share a
//     name (ROZ121). The diagnostic's own guidance: rename the method, keep the
//     event's public name. (The expose-verb-vs-event-name collision lesson.)
//   - None equals a prop name (html/editable/placeholder/autofocus/editorClass/
//     ariaLabel/editorProps/extensions).
function getEditor() {
  return editor;
}
function focusEditor() {
  editor?.commands.focus();
}
function blurEditor() {
  editor?.commands.blur();
}
function getHTML() {
  return editor ? editor.getHTML() : '';
}
function getJSON() {
  return editor ? editor.getJSON() : null;
}
// setContent routes through the SAME suppress-echo bookkeeping as $watch(html):
// update lastHtml first, set with emitUpdate:false (no onUpdate bounce), then
// reflect into the model so a programmatic set keeps the bound state in sync.
// setContent routes through the SAME suppress-echo bookkeeping as $watch(html):
// update lastHtml first, set with emitUpdate:false (no onUpdate bounce), then
// reflect into the model so a programmatic set keeps the bound state in sync.
function setContent(next: any) {
  if (!editor) return;
  const v = next ?? '';
  if (v === lastHtml) return;
  lastHtml = v;
  editor.commands.setContent(v, {
    emitUpdate: false
  });
  html.value = v;
  refreshActive();
}
function clearContent() {
  if (!editor) return;
  editor.commands.clearContent();
  lastHtml = editor.getHTML();
  html.value = lastHtml;
  refreshActive();
}
function toggleBold() {
  editor?.chain().focus().toggleBold().run();
  refreshActive();
}
function toggleItalic() {
  editor?.chain().focus().toggleItalic().run();
  refreshActive();
}
function toggleHeading(level: any) {
  editor?.chain().focus().toggleHeading({
    level: level ?? 1
  }).run();
  refreshActive();
}
function toggleBulletList() {
  editor?.chain().focus().toggleBulletList().run();
  refreshActive();
}
function undo() {
  editor?.chain().focus().undo().run();
  refreshActive();
}
function redo() {
  editor?.chain().focus().redo().run();
  refreshActive();
}
// Power-user escape hatch — returns a pre-focused command chain (TipTap idiom:
// chain().focus().toggleBold().setColor('#f00').run()). null before mount.
// Power-user escape hatch — returns a pre-focused command chain (TipTap idiom:
// chain().focus().toggleBold().setColor('#f00').run()). null before mount.
function chain() {
  return editor ? editor.chain().focus() : null;
}

const portalContainers = new Set<HTMLElement>();
const portals = {
  toolbar: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
    const slotFn = slots.toolbar;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // toolbar { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-toolbar', '2aeee876');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
};
onBeforeUnmount(() => {
  for (const container of portalContainers) render(null, container);
  portalContainers.clear();
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  lastHtml = html.value;
  editor = new Editor({
    element: editorElRef.value!,
    content: html.value,
    editable: props.editable,
    autofocus: props.autofocus,
    // StarterKit first; consumer extensions LAST so they win (TipTap applies
    // later-registered extensions over earlier ones for the same node/mark).
    extensions: [StarterKit, ...props.extensions],
    editorProps: {
      attributes: {
        'aria-label': props.ariaLabel,
        ...(props.editorClass ? {
          class: props.editorClass
        } : {}),
        ...(props.placeholder ? {
          'data-placeholder': props.placeholder,
          'aria-placeholder': props.placeholder
        } : {})
      },
      // Consumer editorProps spread LAST — full ProseMirror editorProps control
      // (handleKeyDown, handlePaste, a custom `attributes`, …) wins.
      ...props.editorProps
    },
    onUpdate: ({
      editor
    }: any) => {
      const next = editor.getHTML();
      lastHtml = next;
      // Round-trip guard — see CodeMirror/Flatpickr for the same shape.
      if (next !== html.value) html.value = next;
      emit('update', next);
    },
    onSelectionUpdate: () => {
      refreshActive();
      emit('selectionUpdate');
    },
    onFocus: () => emit('focus'),
    onBlur: () => emit('blur')
  });
  refreshActive();

  // `toolbar` portal slot — when the consumer fills it, mount their toolbar
  // fragment into the engine-adjacent host node, handing them the live editor
  // (their buttons call editor.chain().focus()…run()). $portals.toolbar is
  // referenced ONLY here inside $onMount (the per-target portal helper is scoped
  // to the mount lifecycle — a top-level reference would fail the bundled-leaf
  // strict typecheck, the FullCalendar/CodeMirror pattern). The host div is
  // r-if-gated on $slots.toolbar so $refs.toolbarEl exists exactly when filled.
  if (slots.toolbar && toolbarElRef.value) {
    toolbarDispose = portals.toolbar(toolbarElRef.value!, {
      editor
    });
  }
  _cleanup_0 = () => {
    toolbarDispose?.();
    toolbarDispose = null;
    editor?.destroy();
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => html.value, (v: any) => {
  if (!editor) return;
  if (v === lastHtml) return;
  lastHtml = v;
  editor.commands.setContent(v, {
    emitUpdate: false
  });
  refreshActive();
});
watch(() => props.editable, (v: any) => editor?.setEditable(v, false));

defineExpose({ getEditor, focusEditor, blurEditor, getHTML, getJSON, setContent, clearContent, toggleBold, toggleItalic, toggleHeading, toggleBulletList, undo, redo, chain });
</script>

<style scoped>
.rozie-tiptap {
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  overflow: hidden;
  background: white;
}
.rozie-tiptap.is-readonly {
  background: #fafafa;
}
.rozie-tiptap-toolbar {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.25rem 0.375rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: #f5f5f7;
}
.rozie-tiptap-toolbar button {
  padding: 0.25rem 0.5rem;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 3px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  min-width: 1.75rem;
  color: rgba(0, 0, 0, 0.65);
}
.rozie-tiptap-toolbar button:hover {
  background: rgba(0, 0, 0, 0.06);
}
.rozie-tiptap-toolbar button.active {
  background: #1a1a1a;
  color: white;
  border-color: #1a1a1a;
}
.rozie-tiptap-toolbar .sep {
  width: 1px;
  height: 1rem;
  background: rgba(0, 0, 0, 0.1);
  margin: 0 0.25rem;
}
.rozie-tiptap-content {
  padding: 0.625rem 0.875rem;
  min-height: 6rem;
  font: inherit;
  outline: none;
}
.rozie-tiptap-content p { margin: 0 0 0.5rem; }
.rozie-tiptap-content p:last-child { margin-bottom: 0; }
.rozie-tiptap-content h1 { font-size: 1.5rem; margin: 0.5rem 0 0.375rem; }
.rozie-tiptap-content h2 { font-size: 1.25rem; margin: 0.5rem 0 0.375rem; }
.rozie-tiptap-content ul { margin: 0 0 0.5rem; padding-left: 1.5rem; }
</style>
