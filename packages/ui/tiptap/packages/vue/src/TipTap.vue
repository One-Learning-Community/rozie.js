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
    <button type="button" :class="{ active: active.underline }" aria-label="Underline" @click="toggleUnderline"><u>U</u></button>
    <button type="button" :class="{ active: active.orderedList }" aria-label="Ordered list" @click="toggleOrderedList">1. List</button>
    <span class="sep"></span>
    <button type="button" aria-label="Undo" @click="undo">↺</button>
    <button type="button" aria-label="Redo" @click="redo">↻</button>
  </div><div v-if="props.editable && $slots.toolbar" class="rozie-tiptap-toolbar rozie-tiptap-toolbar--slot" ref="toolbarElRef"></div><div ref="editorElRef" class="rozie-tiptap-content" :data-placeholder="props.placeholder"></div>
</div>








</template>

<script setup lang="ts">
import { Fragment, h, onBeforeUnmount, onMounted, ref, render, useSlots, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Whether the document is editable. Toggling it calls TipTap's `setEditable` with `emitUpdate: false` (no spurious `update`). When `false`, the internal toolbar is hidden and the wrapper gets an `is-readonly` class.
     */
    editable?: boolean;
    /**
     * Placeholder text, forwarded to the editor host as `data-placeholder` + `aria-placeholder` and painted as ghost text on the first empty node via the bundled Placeholder extension. An empty string adds no placeholder.
     */
    placeholder?: string;
    /**
     * Whether to place the caret in the document on mount (TipTap's `autofocus` option).
     */
    autofocus?: boolean;
    /**
     * A CSS class applied to the contenteditable element (`editorProps.attributes.class`).
     */
    editorClass?: string;
    /**
     * The accessible name (`aria-label`) applied to the contenteditable element.
     */
    ariaLabel?: string;
    /**
     * ProseMirror `editorProps` passthrough — `handleKeyDown`, `handlePaste`, a custom `attributes`, etc. Spread **last** so consumer `editorProps` win the wrapper's attribute defaults.
     */
    editorProps?: Record<string, any>;
    /**
     * Extra TipTap extensions composed onto `StarterKit` — the consumer-extensibility passthrough (Link, Image, Mention, custom nodes/marks, …). Consumer extensions genuinely win for a StarterKit-bundled node or mark: a same-named custom extension (e.g. a custom `Link`) auto-disables the corresponding StarterKit key (unless explicitly configured via `starterKit`), and the final extension array is name-deduped keeping the last (consumer) occurrence — so a custom Link/Underline/OrderedList replaces StarterKit's without a "Duplicate extension names" warning.
     */
    extensions?: any[];
    /**
     * StarterKit config passthrough — spread into `StarterKit.configure(...)`. Accepts per-extension option objects or `false` to disable an extension, e.g. `{ heading:false }`, `{ heading:{ levels:[1,2] } }`, `{ link:false }`. A StarterKit-bundled node/mark is auto-disabled when a same-named custom extension is supplied via `extensions`; an explicitly-set key here is always respected and never overridden by that auto-disable scan.
     */
    starterKit?: Record<string, any>;
    /**
     * Custom ProseMirror node registration for the reactive `nodeView` portal slot — general facility, read ONCE at mount (setup-once construction, not reactive). Each entry: `{ name, tag, group, inline, atom, content, selectable, defining, attrs }` — `name` (required, unique node name), `tag` (required, parseHTML selector string | string[]), `group` (default `'block'`), `inline` (default `false`), `atom` (default `false` — no contentDOM), `content` (e.g. `'inline*'`; presence ⇒ the node gets an editable contentDOM), `selectable` (default `true`), `defining` (default `false`), `attrs` (`{ key: { default } }`, ProseMirror `addAttributes` shape). One `Node.create` is built per entry; all render through the SAME `nodeView` fragment, which dispatches on `scope.node.type.name`. An empty array (default) registers no custom nodes — zero overhead.
     * @example
     * <TipTap :node-specs="[{ name: 'mention', tag: 'span[data-mention]', group: 'inline', inline: true, atom: true, attrs: { id: { default: null } } }]"><template #nodeView="{ node }">…</template></TipTap>
     */
    nodeSpecs?: any[];
  }>(),
  { editable: true, placeholder: '', autofocus: false, editorClass: '', ariaLabel: 'Rich text editor', editorProps: () => ({}), extensions: () => [], starterKit: () => ({}), nodeSpecs: () => [] }
);

/**
 * The editor's document content as an HTML string — the sole `model: true` prop (two-way `r-model`). Typing writes the new HTML back through the model path (TipTap's `onUpdate`); a consumer write reflects into the live document, echo-guarded so a programmatic set does not reset the selection or re-emit `update`.
 * @example
 * <TipTap r-model:html="content" placeholder="Start writing…" />
 */
const html = defineModel<string>('html', { default: '<p>Start writing…</p>' });

const emit = defineEmits<{
  update: [...args: any[]];
  selectionUpdate: [...args: any[]];
  focus: [...args: any[]];
  blur: [...args: any[]];
}>();

defineSlots<{
  toolbar(props: { editor: any }): any;
  bubbleMenu(props: { editor: any }): any;
  floatingMenu(props: { editor: any }): any;
  nodeView(props: { node: any; selected: any; updateAttributes: any; getPos: any; editor: any; contentDOM: any }): any;
}>();

const slots = useSlots();

const active = ref({
  bold: false,
  italic: false,
  h1: false,
  h2: false,
  bulletList: false,
  underline: false,
  orderedList: false
});

const toolbarElRef = ref<HTMLElement>();
const editorElRef = ref<HTMLElement>();

import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
// Selection-anchored menu extensions (G2). SEPARATE packages (NOT in
// @tiptap/extensions), version-pinned in lockstep with @tiptap/core (3.23.5).
// Both export their extension as a NAMED export (`BubbleMenu` / `FloatingMenu`)
// — verified against the installed dist .d.ts — and are `.configure({ element })`
// Extensions that own Floating-UI positioning and append the host element to the
// editor's parent automatically (no manual document insertion needed).
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { FloatingMenu } from '@tiptap/extension-floating-menu';
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
let lastHtml: any = null;
// The `toolbar` portal slot's dispose handle. COMPONENT-scope (top-level let),
// NOT a $onMount-local — the Solid emitter hoists the $onMount-returned cleanup
// into a sibling onCleanup() OUTSIDE the mount-body IIFE, so a mount-local would
// lose scope there (the Chart.js tooltipEl/tooltipDispose hoist lesson).
let toolbarDispose: any = null;
// The `bubbleMenu` / `floatingMenu` portal-slot dispose handles + the imperatively
// created menu host elements. COMPONENT-scope for the same hoist reason as
// toolbarDispose — and the host els must be reachable from BOTH the pre-`new
// Editor` extension build (the menu extension needs its `element` at construction)
// AND the post-construction portal mount, so they live here too (not $onMount
// locals). Each stays null when its slot is unfilled (zero overhead, no $portals
// reference fired — the nodeView discipline).
let bubbleMenuEl: any = null;
let bubbleMenuDispose: any = null;
let floatingMenuEl: any = null;
let floatingMenuDispose: any = null;
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
    bulletList: editor.isActive('bulletList'),
    underline: editor.isActive('underline'),
    orderedList: editor.isActive('orderedList')
  };
};
// ── StarterKit collision-aware config (ask A). StarterKit bundles several
// node/mark extensions INTERNALLY (invisible to a top-level array dedup) —
// e.g. its own `Link`. A consumer supplying a custom same-named extension via
// `extensions` therefore collides with StarterKit's copy and TipTap warns
// "Duplicate extension names found" while keeping BOTH; only
// `StarterKit.configure({ link:false })` actually disables StarterKit's. This
// map + helper make "consumer wins" true by auto-disabling the StarterKit key
// whenever the consumer supplies a same-named extension AND has not already
// decided that key's fate via the `starterKit` prop. Identity for the 15
// node/mark keys StarterKit exposes as `Partial<Options> | false`, plus the
// undo/redo option key `undoRedo` — mapped from BOTH its actual installed
// `.name` (`'undoRedo'`, verified against `@tiptap/extensions@3.23.5`) and the
// TipTap v2 alias `'history'` as a safety net for a consumer porting a v2
// History extension. Structural/plumbing StarterKit keys (document, text,
// dropcursor, gapcursor, listKeymap, trailingNode) are NOT node/mark
// replacements and are intentionally excluded.
const STARTERKIT_COLLISION_MAP = {
  bold: 'bold',
  italic: 'italic',
  strike: 'strike',
  code: 'code',
  heading: 'heading',
  paragraph: 'paragraph',
  blockquote: 'blockquote',
  codeBlock: 'codeBlock',
  hardBreak: 'hardBreak',
  horizontalRule: 'horizontalRule',
  bulletList: 'bulletList',
  orderedList: 'orderedList',
  listItem: 'listItem',
  link: 'link',
  underline: 'underline',
  undoRedo: 'undoRedo',
  history: 'undoRedo'
};
// Pure helper — returns `userConfig` extended so any StarterKit-bundled
// node/mark the consumer replaced (a same-named entry in `exts`) is disabled
// UNLESS the consumer already decided that key's fate in `userConfig` (an `in`
// presence check, so an explicit `false` OR an explicit options object both
// count as "consumer decided" — D-02, consumer wins unless configured
// explicitly). Never invokes consumer code — only reads `.name` and does key
// presence checks (guards a non-object/missing `.name` entry by skipping it).
const buildStarterKitConfig = (userConfig: any, exts: any) => {
  const effective = {
    ...userConfig
  };
  for (const ext of exts as any) {
    const name = ext && typeof ext === 'object' ? ext.name : undefined;
    if (typeof name !== 'string') continue;
    const optionKey = STARTERKIT_COLLISION_MAP[name];
    if (optionKey && !(optionKey in effective)) effective[optionKey] = false;
  }
  return effective;
};
// Pure helper — D-03 last-wins safety net over the FINAL assembled extension
// array. Dedupes by `.name`, keeping the LAST occurrence (later = consumer).
// A nameless/unnamed entry is never collapsed against another nameless entry
// — each survives, keyed by a per-entry unique fallback rather than a shared
// `undefined` key.
const dedupeExtensionsByName = (exts: any) => {
  const byKey = new Map();
  let anonSeq = 0;
  for (const ext of exts as any) {
    const name = ext && typeof ext === 'object' ? ext.name : undefined;
    const key = typeof name === 'string' ? name : `__rozie_anon_${anonSeq++}`;
    byKey.set(key, ext);
  }
  return [...byKey.values()];
};
// ── Reactive node-view portal slot (Phase 33 — the FIRST shipped `reactive`
// portal slot, the marquee TipTap differentiator; generalized in Phase
// 260719-d9e / ask B). When the consumer fills the `nodeView` slot AND
// supplies one or more `nodeSpecs`, each spec becomes its own custom
// ProseMirror node rendering the SAME consumer fragment as a custom node
// *in-engine*, re-rendering it in place on every transaction via the
// reactive handle `$portals.nodeView(dom, scope) => { update, dispose }`
// (REQ-22). The fragment dispatches on `scope.node.type.name` to tell the
// specs apart (D-03 — single-slot-dispatch, no dynamic per-type slot names).
//
// A spec with NO `content` (typically `atom:true`) is a NON-EDITABLE node —
// no contentDOM — driven purely by selectNode/deselectNode/update(node) →
// handle.update so the fragment re-renders in place (engine-driven; no Rozie
// reactive loop). Proven originally by the @mention-chip recipe (Spike 009 /
// REQ-26), now shipped as a `nodeSpecs` entry in the example demos.
//
// A spec WITH `content` (e.g. `'inline*'`) is an EDITABLE BLOCK — it HAS a
// contentDOM. ProseMirror owns the editable hole; the consumer fragment
// renders chrome wrapping a [data-rozie-hole] placeholder and the per-target
// portal bridge grafts contentDOM into that hole — native-ref on
// React/Solid/Lit, querySelector-after-render on Vue/Svelte/Angular. The
// .rozie source merely passes `contentDOM` in scope; the graft mechanism is
// PER-TARGET and lives in the emitted portal bridge, not here. Proven
// originally by the editable-callout recipe (Spike 008 / REQ-23), now shipped
// as a `nodeSpecs` entry in the example demos.
//
// $portals.nodeView is referenced ONLY inside $onMount/the addNodeView closures
// (the $refs-only-in-onMount + bundled-leaf strict-typecheck discipline — the
// same constraint the toolbar slot follows). `makeNodeViewExtensions` is invoked
// from inside $onMount so the `nv` closure (capturing $portals.nodeView) is
// constructed within the mount lifecycle.
const makeNodeView = (nv: any, spec: any) => (props: any) => {
  const {
    node,
    getPos,
    editor: ed
  } = props;
  // hasContentDOM derives from the spec, not a bare boolean: an editable node
  // is one that is NOT an atom and declares `content` (e.g. 'inline*').
  const hasContentDOM = !spec.atom && !!spec.content;
  // engine-owned outer host the consumer fragment mounts into.
  const dom = document.createElement(hasContentDOM ? 'div' : 'span');
  dom.className = hasContentDOM ? 'rozie-tiptap-nodeview rozie-tiptap-nodeview--block' : 'rozie-tiptap-nodeview rozie-tiptap-nodeview--inline';
  // EDITABLE nodes own a ProseMirror-managed contentDOM; the bridge grafts it
  // into the consumer fragment's [data-rozie-hole]. ATOM nodes have none.
  const contentDOM = hasContentDOM ? document.createElement(dom.tagName === 'DIV' ? 'div' : 'span') : null;
  if (contentDOM) contentDOM.className = 'rozie-tiptap-nodeview-content';
  const updateAttributes = (attrs: any) => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (pos == null) return;
    ed.view.dispatch(ed.view.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      ...attrs
    }));
  };
  const buildScope = (n: any, selected: any) => ({
    node: n,
    selected,
    updateAttributes,
    getPos,
    editor: ed,
    ...(contentDOM ? {
      contentDOM
    } : {})
  });

  // Reactive handle — { update, dispose }. The fragment mounts ONCE; every
  // engine transaction re-invokes handle.update(scope) re-rendering IN PLACE.
  const handle = nv(dom, buildScope(node, false));

  // contentDOM graft bridge (Spike 008 / REQ-23). For an EDITABLE node the
  // consumer fragment renders chrome WRAPPING a `[data-rozie-hole]` placeholder;
  // ProseMirror manages `contentDOM` and renders the node's editable children
  // INTO it, so `contentDOM` must live inside the visible hole. The fragment is
  // rendered into `dom` by the per-target reactive portal — synchronously on
  // React/Solid/Lit (native-ref timing) but post-mount/async on Vue/Svelte/
  // Angular (REQ-23). A query-after-render graft (retried across a microtask +
  // a RAF) covers BOTH timing classes uniformly from the engine side: as soon as
  // the hole exists, contentDOM is grafted in. ProseMirror then owns that subtree
  // and the framework never reconciles it away (the hole carries no child binding).
  const graftContentDOM = (attempt: any) => {
    if (!contentDOM) return;
    const hole = dom.querySelector('[data-rozie-hole]');
    if (hole) {
      if (contentDOM.parentNode !== hole) hole.appendChild(contentDOM);
      return;
    }
    if (attempt < 5) {
      if (attempt === 0) Promise.resolve().then(() => graftContentDOM(attempt + 1));else requestAnimationFrame(() => graftContentDOM(attempt + 1));
    }
  };
  graftContentDOM(0);

  // After a reactive re-render (chrome update), re-graft so a fragment that
  // recreated its `[data-rozie-hole]` element does NOT leave contentDOM detached
  // (REQ-24 — the editable subtree survives every chrome update).
  const updateInPlace = (n: any, selected: any) => {
    handle.update(buildScope(n, selected));
    if (contentDOM) graftContentDOM(0);
  };
  return {
    dom,
    ...(contentDOM ? {
      contentDOM
    } : {}),
    // attr / content change for THIS node → re-render the fragment in place,
    // keep the view (return true). The new node identity is forwarded so the
    // fragment reads fresh node.attrs (REQ-26).
    update(nextNode: any) {
      if (nextNode.type !== node.type) return false;
      updateInPlace(nextNode, false);
      return true;
    },
    // NodeSelection enters/leaves the node → toggle `selected` in scope so the
    // chip's selected styling is pure engine-driven reactive `update`.
    selectNode() {
      updateInPlace(node, true);
    },
    deselectNode() {
      updateInPlace(node, false);
    },
    destroy() {
      handle.dispose();
    }
  };
};
// Pure helper (ask B, D-02) — extracts { el, attr, value } from a parseHTML
// tag selector string, e.g. 'span[data-x]' → { el: 'span', attr: 'data-x',
// value: '' } or 'div[data-x=y]' → { el: 'div', attr: 'data-x', value: 'y' }.
// Drives renderHTML's marker attribute so the serialized element reproduces
// the exact shape the parseHTML rule expects. MUST NOT throw on a
// malformed/empty selector (T-d9e-01 — a bad selector degrades only that one
// node's render, never crashes the editor): falls back to el = the raw
// selector (or 'span' if falsy), attr = null (no marker), value = ''.
const parseTagSelector = (selector: any) => {
  const raw = typeof selector === 'string' ? selector : '';
  const elMatch = raw.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
  const el = elMatch ? elMatch[0] : raw || 'span';
  const attrMatch = raw.match(/\[([^\]=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/);
  if (!attrMatch) return {
    el,
    attr: null,
    value: ''
  };
  const attr = (attrMatch[1] ?? '').trim();
  const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
  return {
    el,
    attr,
    value
  };
};
// Build ONE custom Node per consumer-supplied spec, all bound to the SAME
// reactive nodeView portal (ask B, D-02). Takes the per-target
// `$portals.nodeView` (captured here so the reference stays inside the mount
// lifecycle — never top-level, per the bundled-leaf typecheck rule) and the
// `nodeSpecs` prop array (read once at mount — setup-once, not reactive).
const makeNodeViewExtensions = (nv: any, specs: any) => specs.map((spec: any) => {
  // hasContentDOM decides the renderHTML hole: an editable (non-atom,
  // content-bearing) node gets a trailing `0` content hole; a leaf/atom node
  // must NOT (ProseMirror's DOMSerializer throws "Content hole not allowed in
  // a leaf node spec" otherwise).
  const hasContentDOM = !spec.atom && !!spec.content;
  const firstTag = Array.isArray(spec.tag) ? spec.tag[0] : spec.tag;
  const {
    el,
    attr,
    value
  } = parseTagSelector(firstTag);
  return Node.create({
    name: spec.name,
    group: spec.group ?? 'block',
    inline: spec.inline ?? false,
    atom: spec.atom ?? false,
    selectable: spec.selectable ?? true,
    defining: spec.defining ?? false,
    ...(spec.content ? {
      content: spec.content
    } : {}),
    addAttributes: () => spec.attrs ?? {},
    parseHTML: () => (Array.isArray(spec.tag) ? spec.tag : [spec.tag]).map((t: any) => ({
      tag: t
    })),
    renderHTML: ({
      HTMLAttributes
    }: any) => hasContentDOM ? [el, {
      ...(attr ? {
        [attr]: value
      } : {}),
      ...HTMLAttributes
    }, 0] : [el, {
      ...(attr ? {
        [attr]: value
      } : {}),
      ...HTMLAttributes
    }],
    addNodeView: () => makeNodeView(nv, spec)
  });
});
// ── Imperative handle (Phase 21 $expose) — TipTap is command-rich, so this is
// the marquee surface: 16 verbs over the live Editor, uniform across all 6
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
// Plain-text extraction — word/char counts, search indexing, plaintext export.
// Mirrors getHTML/getJSON (empty string before mount). Was advertised by intent
// alongside getHTML/getJSON but never wired; now first-class.
function getText() {
  return editor ? editor.getText() : '';
}
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
function toggleUnderline() {
  editor?.chain().focus().toggleUnderline().run();
  refreshActive();
}
function toggleOrderedList() {
  editor?.chain().focus().toggleOrderedList().run();
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
function chain() {
  return editor ? editor.chain().focus() : null;
}
// Read-side toolbar primitives. These are precisely what a bring-your-own
// toolbar (the `toolbar`/`bubbleMenu`/`floatingMenu` portal slots) needs and
// the component already computes internally via refreshActive() — exposing them
// removes the per-consumer "drop to getEditor() and re-derive" boilerplate.
//   - isActive(name, attrs?): is a mark/node active in the current selection
//     (drive toolbar button active styling). False before mount.
//   - can(): the command-availability chain (editor.can().chain()…run()) for
//     enable/disable of toolbar buttons. null before mount (mirrors chain()).
//   - isEmpty(): document-empty (submit-gating / empty-state). true before mount.
function isActive(name: any, attrs: any) {
  return editor ? editor.isActive(name, attrs) : false;
}
function can() {
  return editor ? editor.can() : null;
}
function isEmpty() {
  return editor ? editor.isEmpty : true;
}

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
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
  bubbleMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
    const slotFn = slots.bubbleMenu;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // bubbleMenu { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-bubbleMenu', '2aeee876');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  floatingMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
    const slotFn = slots.floatingMenu;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // floatingMenu { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-floatingMenu', '2aeee876');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  nodeView: (container: HTMLElement, scope: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): ReactivePortalHandle => {
    const slotFn = slots.nodeView;
    if (!slotFn) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // nodeView { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-nodeView', '2aeee876');
    const renderScope = (s: unknown): void => {
      render(h(Fragment, null, slotFn(s)), container);
    };
    renderScope(scope);
    portalContainers.add(container);
    return {
      update: (s: unknown): void => renderScope(s),
      dispose: (): void => {
        render(null, container);
        portalContainers.delete(container);
      },
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

  // Register the reactive node-view nodes ONLY when the consumer fills the
  // `nodeView` slot AND supplies one or more `nodeSpecs` (D-05 — BOTH halves
  // required). A stock <TipTap> with no nodeSpecs (or an unfilled slot) adds
  // NO custom nodes — zero overhead, no consumer-node-shaped parse rules
  // registered, no unused $portals.nodeView reference fired. $props.nodeSpecs is
  // read ONCE here (setup-once — NOT a $watch); $portals.nodeView is captured
  // here inside the mount body and passed into the node factory, keeping the
  // reference scoped to the mount lifecycle (the toolbar-slot discipline).
  const nodeViewExtensions = slots.nodeView && props.nodeSpecs.length ? makeNodeViewExtensions(portals.nodeView, props.nodeSpecs) : [];

  // Placeholder ghost-text (G3). Read $props.placeholder ONCE at construction
  // (setup-once, like content/editable/autofocus — no reactivity required). The
  // Placeholder extension (@tiptap/extensions, version-matched to StarterKit)
  // adds class `is-editor-empty` + a `data-placeholder` attribute to the first
  // empty node; the `::before` rule in the `:root { }` engine-DOM escape hatch
  // (in the style block) paints the ghost text. Empty placeholder = no extension.
  const placeholderExtensions = props.placeholder ? [Placeholder.configure({
    placeholder: props.placeholder
  })] : [];

  // Selection-anchored menu extensions (G2). Built BEFORE `new Editor` because the
  // Floating-UI menu extension needs its host `element` at construction time. Each
  // menu's host element is created imperatively (the nodeView discipline — the
  // engine owns positioning; the consumer fragment is portalled in AFTER mount).
  // An unfilled slot adds NOTHING (zero overhead, no $portals reference fired).
  //
  // The host elements are created up front (when filled) so they're captured into
  // the component-scope `bubbleMenuEl`/`floatingMenuEl` for the post-construction
  // portal mount; the extension list is then assembled by conditional SPREAD (NOT
  // `const x = []; x.push(…)`), which under the strict-typecheck'd bundled leaves
  // infers `any[]` — a bare `const x = []` would infer `never[]` and reject
  // `.push(Extension)` (the placeholderExtensions/nodeViewExtensions discipline).
  if (slots.bubbleMenu) {
    bubbleMenuEl = document.createElement('div');
    bubbleMenuEl.className = 'rozie-tiptap-bubble-menu';
  }
  if (slots.floatingMenu) {
    floatingMenuEl = document.createElement('div');
    floatingMenuEl.className = 'rozie-tiptap-floating-menu';
  }
  const menuExtensions = [...(bubbleMenuEl ? [BubbleMenu.configure({
    element: bubbleMenuEl
  })] : []), ...(floatingMenuEl ? [FloatingMenu.configure({
    element: floatingMenuEl
  })] : [])];
  editor = new Editor({
    element: editorElRef.value!,
    content: html.value,
    editable: props.editable,
    autofocus: props.autofocus,
    // StarterKit first (config-disabled per the collision scan below); the
    // Placeholder ext next; the reactive node-view nodes next; consumer
    // extensions LAST so they win (TipTap applies later-registered extensions
    // over earlier ones for the same node/mark) — and the whole array is
    // name-deduped keeping the LAST occurrence as a safety net (D-03) on top
    // of the config-level auto-disable (D-02), which is what actually silences
    // StarterKit's internal same-named extension (e.g. its bundled `Link`).
    extensions: dedupeExtensionsByName([StarterKit.configure(buildStarterKitConfig(props.starterKit, props.extensions)), ...placeholderExtensions, ...nodeViewExtensions, ...menuExtensions, ...props.extensions]),
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

  // `bubbleMenu` / `floatingMenu` portal slots — mount the consumer's menu
  // fragment into the engine-owned (imperatively-created) host element handed to
  // the Floating-UI menu extension, with the live editor in scope (their buttons
  // call editor.chain().focus()…run()). Like toolbar/nodeView, $portals.bubbleMenu
  // / $portals.floatingMenu are referenced ONLY inside $onMount (the bundled-leaf
  // strict-typecheck discipline). The element is created above only when the slot
  // is filled, so each portal fires exactly when its slot exists.
  if (bubbleMenuEl) {
    bubbleMenuDispose = portals.bubbleMenu(bubbleMenuEl, {
      editor
    });
  }
  if (floatingMenuEl) {
    floatingMenuDispose = portals.floatingMenu(floatingMenuEl, {
      editor
    });
  }
  _cleanup_0 = () => {
    toolbarDispose?.();
    toolbarDispose = null;
    bubbleMenuDispose?.();
    bubbleMenuDispose = null;
    floatingMenuDispose?.();
    floatingMenuDispose = null;
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

defineExpose({ getEditor, focusEditor, blurEditor, getHTML, getJSON, getText, setContent, clearContent, toggleBold, toggleItalic, toggleHeading, toggleBulletList, toggleUnderline, toggleOrderedList, undo, redo, chain, isActive, can, isEmpty });
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

<style>
.rozie-tiptap-content .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: rgba(0, 0, 0, 0.4);
    float: left;
    height: 0;
    pointer-events: none;
  }
</style>
