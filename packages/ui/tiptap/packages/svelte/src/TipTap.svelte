<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  html?: string;
  editable?: boolean;
  placeholder?: string;
  autofocus?: boolean;
  editorClass?: string;
  ariaLabel?: string;
  editorProps?: any;
  extensions?: any[];
  toolbar?: Snippet<[{ editor: any }]>;
  snippets?: Record<string, any>;
  onupdate?: (...args: unknown[]) => void;
  onselectionupdate?: (...args: unknown[]) => void;
  onfocus?: (...args: unknown[]) => void;
  onblur?: (...args: unknown[]) => void;
}

let __defaultEditorProps = (() => ({}))();
let __defaultExtensions = (() => [])();

let {
  html = $bindable('<p>Start writing…</p>'),
  editable = true,
  placeholder = '',
  autofocus = false,
  editorClass = '',
  ariaLabel = 'Rich text editor',
  editorProps = __defaultEditorProps,
  extensions = __defaultExtensions,
  toolbar: __toolbarProp,
  snippets,
  onupdate,
  onselectionupdate,
  onfocus,
  onblur
}: Props = $props();

const toolbar = $derived(__toolbarProp ?? snippets?.toolbar);

let active = $state({
  bold: false,
  italic: false,
  h1: false,
  h2: false,
  bulletList: false
});

let toolbarEl = $state<HTMLElement | undefined>(undefined);
let editorEl = $state<HTMLElement | undefined>(undefined);

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
  active = {
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
export function getEditor() {
  return editor;
}
export function focusEditor() {
  editor?.commands.focus();
}
export function blurEditor() {
  editor?.commands.blur();
}
export function getHTML() {
  return editor ? editor.getHTML() : '';
}
export function getJSON() {
  return editor ? editor.getJSON() : null;
}
// setContent routes through the SAME suppress-echo bookkeeping as $watch(html):
// update lastHtml first, set with emitUpdate:false (no onUpdate bounce), then
// reflect into the model so a programmatic set keeps the bound state in sync.
// setContent routes through the SAME suppress-echo bookkeeping as $watch(html):
// update lastHtml first, set with emitUpdate:false (no onUpdate bounce), then
// reflect into the model so a programmatic set keeps the bound state in sync.
export function setContent(next: any) {
  if (!editor) return;
  const v = next ?? '';
  if (v === lastHtml) return;
  lastHtml = v;
  editor.commands.setContent(v, {
    emitUpdate: false
  });
  html = v;
  refreshActive();
}
export function clearContent() {
  if (!editor) return;
  editor.commands.clearContent();
  lastHtml = editor.getHTML();
  html = lastHtml;
  refreshActive();
}
export function toggleBold() {
  editor?.chain().focus().toggleBold().run();
  refreshActive();
}
export function toggleItalic() {
  editor?.chain().focus().toggleItalic().run();
  refreshActive();
}
export function toggleHeading(level: any) {
  editor?.chain().focus().toggleHeading({
    level: level ?? 1
  }).run();
  refreshActive();
}
export function toggleBulletList() {
  editor?.chain().focus().toggleBulletList().run();
  refreshActive();
}
export function undo() {
  editor?.chain().focus().undo().run();
  refreshActive();
}
export function redo() {
  editor?.chain().focus().redo().run();
  refreshActive();
}
// Power-user escape hatch — returns a pre-focused command chain (TipTap idiom:
// chain().focus().toggleBold().setColor('#f00').run()). null before mount.
// Power-user escape hatch — returns a pre-focused command chain (TipTap idiom:
// chain().focus().toggleBold().setColor('#f00').run()). null before mount.
export function chain() {
  return editor ? editor.chain().focus() : null;
}

const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  toolbar: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
    if (!toolbar) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-toolbar', '2aeee876');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: toolbar, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
  lastHtml = html;
  editor = new Editor({
    element: editorEl!,
    content: html,
    editable: editable,
    autofocus: autofocus,
    // StarterKit first; consumer extensions LAST so they win (TipTap applies
    // later-registered extensions over earlier ones for the same node/mark).
    extensions: [StarterKit, ...extensions],
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        ...(editorClass ? {
          class: editorClass
        } : {}),
        ...(placeholder ? {
          'data-placeholder': placeholder,
          'aria-placeholder': placeholder
        } : {})
      },
      // Consumer editorProps spread LAST — full ProseMirror editorProps control
      // (handleKeyDown, handlePaste, a custom `attributes`, …) wins.
      ...editorProps
    },
    onUpdate: ({
      editor
    }: any) => {
      const next = editor.getHTML();
      lastHtml = next;
      // Round-trip guard — see CodeMirror/Flatpickr for the same shape.
      if (next !== html) html = next;
      onupdate?.(next);
    },
    onSelectionUpdate: () => {
      refreshActive();
      onselectionupdate?.();
    },
    onFocus: () => onfocus?.(),
    onBlur: () => onblur?.()
  });
  refreshActive();

  // `toolbar` portal slot — when the consumer fills it, mount their toolbar
  // fragment into the engine-adjacent host node, handing them the live editor
  // (their buttons call editor.chain().focus()…run()). $portals.toolbar is
  // referenced ONLY here inside $onMount (the per-target portal helper is scoped
  // to the mount lifecycle — a top-level reference would fail the bundled-leaf
  // strict typecheck, the FullCalendar/CodeMirror pattern). The host div is
  // r-if-gated on $slots.toolbar so $refs.toolbarEl exists exactly when filled.
  if (toolbar && toolbarEl) {
    toolbarDispose = portals.toolbar(toolbarEl!, {
      editor
    });
  }
  return () => {
    toolbarDispose?.();
    toolbarDispose = null;
    editor?.destroy();
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => html)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (!editor) return;
  if (v === lastHtml) return;
  lastHtml = v;
  editor.commands.setContent(v, {
    emitUpdate: false
  });
  refreshActive();
})(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { const __watchVal = (() => editable)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } ((v: any) => editor?.setEditable(v, false))(__watchVal); }); });
</script>


<div class={["rozie-tiptap", { 'is-readonly': !editable }]} data-rozie-s-2aeee876>
  
  {#if editable && !toolbar}<div class="rozie-tiptap-toolbar" data-rozie-s-2aeee876>
    <button type="button" class={{ active: active.bold }} aria-label="Bold" onclick={toggleBold} data-rozie-s-2aeee876><strong data-rozie-s-2aeee876>B</strong></button>
    <button type="button" class={{ active: active.italic }} aria-label="Italic" onclick={toggleItalic} data-rozie-s-2aeee876><em data-rozie-s-2aeee876>I</em></button>
    <span class="sep" data-rozie-s-2aeee876></span>
    <button type="button" class={{ active: active.h1 }} aria-label="Heading 1" onclick={($event) => { toggleHeading(1); }} data-rozie-s-2aeee876>H1</button>
    <button type="button" class={{ active: active.h2 }} aria-label="Heading 2" onclick={($event) => { toggleHeading(2); }} data-rozie-s-2aeee876>H2</button>
    <span class="sep" data-rozie-s-2aeee876></span>
    <button type="button" class={{ active: active.bulletList }} aria-label="Bullet list" onclick={toggleBulletList} data-rozie-s-2aeee876>• List</button>
  </div>{/if}{#if editable && toolbar}<div class="rozie-tiptap-toolbar rozie-tiptap-toolbar--slot" bind:this={toolbarEl} data-rozie-s-2aeee876></div>{/if}<div bind:this={editorEl} class="rozie-tiptap-content" data-placeholder={placeholder} data-rozie-s-2aeee876></div>
</div>




<style>
:global {
  .rozie-tiptap[data-rozie-s-2aeee876] {
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    overflow: hidden;
    background: white;
  }
  .rozie-tiptap.is-readonly[data-rozie-s-2aeee876] {
    background: #fafafa;
  }
  .rozie-tiptap-toolbar[data-rozie-s-2aeee876] {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.25rem 0.375rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: #f5f5f7;
  }
  .rozie-tiptap-toolbar[data-rozie-s-2aeee876] button[data-rozie-s-2aeee876] {
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
  .rozie-tiptap-toolbar[data-rozie-s-2aeee876] button[data-rozie-s-2aeee876]:hover {
    background: rgba(0, 0, 0, 0.06);
  }
  .rozie-tiptap-toolbar[data-rozie-s-2aeee876] button.active[data-rozie-s-2aeee876] {
    background: #1a1a1a;
    color: white;
    border-color: #1a1a1a;
  }
  .rozie-tiptap-toolbar[data-rozie-s-2aeee876] .sep[data-rozie-s-2aeee876] {
    width: 1px;
    height: 1rem;
    background: rgba(0, 0, 0, 0.1);
    margin: 0 0.25rem;
  }
  .rozie-tiptap-content[data-rozie-s-2aeee876] {
    padding: 0.625rem 0.875rem;
    min-height: 6rem;
    font: inherit;
    outline: none;
  }
  .rozie-tiptap-content[data-rozie-s-2aeee876] p[data-rozie-s-2aeee876] { margin: 0 0 0.5rem; }
  .rozie-tiptap-content[data-rozie-s-2aeee876] p[data-rozie-s-2aeee876]:last-child { margin-bottom: 0; }
  .rozie-tiptap-content[data-rozie-s-2aeee876] h1[data-rozie-s-2aeee876] { font-size: 1.5rem; margin: 0.5rem 0 0.375rem; }
  .rozie-tiptap-content[data-rozie-s-2aeee876] h2[data-rozie-s-2aeee876] { font-size: 1.25rem; margin: 0.5rem 0 0.375rem; }
  .rozie-tiptap-content[data-rozie-s-2aeee876] ul[data-rozie-s-2aeee876] { margin: 0 0 0.5rem; padding-left: 1.5rem; }
}
</style>
