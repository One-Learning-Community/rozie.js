<template>

<div class="rozie-lexical-toolbar" role="toolbar" aria-label="Text formatting" v-bind="$attrs">
  <button type="button" :class="['rozie-lexical-toolbar-btn', { active: active.bold }]" :aria-pressed="!!active.bold" aria-label="Bold" @mousedown="$event.preventDefault()" @click="formatBold"><strong>B</strong></button>
  <button type="button" :class="['rozie-lexical-toolbar-btn', { active: active.italic }]" :aria-pressed="!!active.italic" aria-label="Italic" @mousedown="$event.preventDefault()" @click="formatItalic"><em>I</em></button>
  <button type="button" :class="['rozie-lexical-toolbar-btn', { active: active.link }]" :aria-pressed="!!active.link" aria-label="Link" @mousedown="$event.preventDefault()" @click="toggleLink">Link</button>
  <button type="button" :class="['rozie-lexical-toolbar-btn', { active: active.list }]" :aria-pressed="!!active.list" aria-label="Bullet list" @mousedown="$event.preventDefault()" @click="insertList">&bull; List</button>
</div>

</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';

const active = ref({
  bold: false,
  italic: false,
  link: false,
  list: false
});

const editorCtx = inject('rozie-lexical-editor');

// NAMESPACE imports (D-05): both the `$`-API selection reads AND the command
// constants come through namespace bindings, so no bare `$`-identifier ever reaches
// the Svelte compiler (spike 013 / compile-lexical-check.mjs).
import * as lexical from 'lexical';
import * as lexicalList from '@lexical/list';
import * as lexicalLink from '@lexical/link';
import * as lexicalUtils from '@lexical/utils';

// The shared editor context object provided by the shell ({ get instance() {…} },
// spike 010 late-binding getter). `$inject` binds to a `const` (ROZ132), then aliases
// through a null-`let` (typeNeutralize) so `.instance` type-checks on the strict
// bundled leaves; TOP-LEVEL scope so the hoisted Solid teardown can reach it (see
// RichTextPlugin header for the full rationale).
let ctx: any = null;
ctx = editorCtx;
// The registerUpdateListener cleanup, captured once we register. null = not yet /
// torn down. `disposed` guards the deferred activation against an unmount that races
// ahead of the microtask below.
let teardown: any = null;
let disposed = false;
// Recompute the toolbar's active booleans from the CURRENT selection. MUST be called
// inside an editorState.read() (the registerUpdateListener callback / getEditorState
// read below) so the `$`-API resolves against the live editor state. Named
// `refreshActive` — NOT `setActive`, which would collide with the React/Solid
// generated `$data.active` setter (ROZ524, the TipTap toolbar precedent).
const refreshActive = () => {
  const sel = lexical.$getSelection();
  if (!lexical.$isRangeSelection(sel)) {
    active.value = {
      bold: false,
      italic: false,
      link: false,
      list: false
    };
    return;
  }
  const anchorNode = sel.anchor.getNode();
  // Ancestor-type reads via the namespace `$`-API: a ListNode / LinkNode anywhere
  // above the caret means the current selection is inside a list / link.
  const listNode = lexicalUtils.$getNearestNodeOfType(anchorNode, lexicalList.ListNode);
  const linkNode = lexicalUtils.$getNearestNodeOfType(anchorNode, lexicalLink.LinkNode);
  active.value = {
    bold: sel.hasFormat('bold'),
    italic: sel.hasFormat('italic'),
    link: linkNode !== null,
    list: listNode !== null
  };
};
// Register the selection-reading update listener against the shared editor and seed
// the initial active state. Deferred one microtask from $onMount (see header).
const activate = () => {
  if (teardown || disposed) return;
  const editor = ctx && ctx.instance;
  if (!editor) return;
  // READ side: on every editor update, read the current selection and reflect it into
  // $data.active so each button's active styling tracks the caret live. registerUpdateListener
  // returns its own cleanup.
  teardown = editor.registerUpdateListener(({
    editorState
  }: any) => {
    editorState.read(() => {
      refreshActive();
    });
  });
  // Seed the initial state so the buttons render correct active styling before the
  // first user-driven update fires.
  editor.getEditorState().read(() => {
    refreshActive();
  });
};
// WRITE side — button command dispatchers. Each reads the LIVE editor instance fresh
// through the getter (never a stale handle) and guards the pre-mount / torn-down null.
const formatBold = () => {
  const editor = ctx && ctx.instance;
  if (!editor) return;
  editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'bold');
};
const formatItalic = () => {
  const editor = ctx && ctx.instance;
  if (!editor) return;
  editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'italic');
};
const insertList = () => {
  const editor = ctx && ctx.instance;
  if (!editor) return;
  editor.dispatchCommand(lexicalList.INSERT_UNORDERED_LIST_COMMAND, undefined);
};
// Unopinionated toggle: if the selection is already a link, unlink (dispatch null);
// otherwise link it to a fixed sample href. A fixed href (over a prompt) keeps the
// primitive dependency-free and SSR/test-safe — consumers wire their own URL UX
// against the LinkPlugin's TOGGLE_LINK_COMMAND (D-12).
const toggleLink = () => {
  const editor = ctx && ctx.instance;
  if (!editor) return;
  editor.dispatchCommand(lexicalLink.TOGGLE_LINK_COMMAND, active.value.link ? null : 'https://example.com');
};

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // Defer one microtask so the parent shell's $onMount has created the editor —
  // child mount hooks fire before the parent's on React/Vue/Solid (see header).
  queueMicrotask(activate);
  _cleanup_0 = () => {
    disposed = true;
    if (teardown) {
      teardown();
      teardown = null;
    }
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });
</script>

<style scoped>
.rozie-lexical-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  margin-bottom: 0.375rem;
}
.rozie-lexical-toolbar-btn {
  padding: 0.25rem 0.5rem;
  min-width: 1.75rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.rozie-lexical-toolbar-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}
.rozie-lexical-toolbar-btn.active {
  background: #1a1a1a;
  color: #ffffff;
  border-color: #1a1a1a;
}
</style>
