<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  /**
   * The editor's document content as an HTML string — the sole `model: true` prop (two-way `r-model`). Typing writes the new HTML back through the model path (TipTap's `onUpdate`); a consumer write reflects into the live document, echo-guarded so a programmatic set does not reset the selection or re-emit `update`.
   * @example
   * <TipTap r-model:html="content" placeholder="Start writing…" />
   */
  html?: string;
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
  editorProps?: any;
  /**
   * Extra TipTap extensions composed onto `StarterKit` — the consumer-extensibility passthrough (Link, Image, Mention, custom nodes/marks, …). Composed **last** so consumer extensions win for the same node or mark.
   */
  extensions?: any[];
  toolbar?: Snippet<[{ editor: any }]>;
  bubbleMenu?: Snippet<[{ editor: any }]>;
  floatingMenu?: Snippet<[{ editor: any }]>;
  nodeView?: Snippet<[{ node: any; selected: any; updateAttributes: any; getPos: any; editor: any; contentDOM: any }]>;
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
  bubbleMenu: __bubbleMenuProp,
  floatingMenu: __floatingMenuProp,
  nodeView: __nodeViewProp,
  snippets,
  onupdate,
  onselectionupdate,
  onfocus,
  onblur
}: Props = $props();

const toolbar = $derived(__toolbarProp ?? snippets?.toolbar);
const bubbleMenu = $derived(__bubbleMenuProp ?? snippets?.bubbleMenu);
const floatingMenu = $derived(__floatingMenuProp ?? snippets?.floatingMenu);
const nodeView = $derived(__nodeViewProp ?? snippets?.nodeView);

let active = $state({
  bold: false,
  italic: false,
  h1: false,
  h2: false,
  bulletList: false
});

let toolbarEl = $state<HTMLElement | undefined>(undefined);
let editorEl = $state<HTMLElement | undefined>(undefined);

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
// ── Reactive node-view portal slot (Phase 33 — the FIRST shipped `reactive`
// portal slot, the marquee TipTap differentiator). When the consumer fills the
// `nodeView` slot, two custom ProseMirror nodes render the consumer fragment as
// a custom node *in-engine*, re-rendering it in place on every transaction via
// the reactive handle `$portals.nodeView(dom, scope) => { update, dispose }`
// (REQ-22). Both halves of the primitive are proven and shipped here:
//
//   1. `mention` — a NON-EDITABLE inline ATOM (selectable:true, no contentDOM,
//      Spike 009 / REQ-26). selectNode/deselectNode/update(node) → handle.update
//      so the chip re-renders in place (engine-driven; no Rozie reactive loop).
//
//   2. `callout` — an EDITABLE BLOCK (content:'inline*', so it HAS a contentDOM,
//      Spike 008 / REQ-23). ProseMirror owns the editable hole; the consumer
//      fragment renders chrome wrapping a [data-rozie-hole] placeholder and the
//      per-target portal bridge grafts contentDOM into that hole — native-ref on
//      React/Solid/Lit, querySelector-after-render on Vue/Svelte/Angular. The
//      .rozie source merely passes `contentDOM` in scope; the graft mechanism is
//      PER-TARGET and lives in the emitted portal bridge, not here.
//
// $portals.nodeView is referenced ONLY inside $onMount/the addNodeView closures
// (the $refs-only-in-onMount + bundled-leaf strict-typecheck discipline — the
// same constraint the toolbar slot follows). `makeNodeViewExtensions` is invoked
// from inside $onMount so the `nv` closure (capturing $portals.nodeView) is
// constructed within the mount lifecycle.
const makeNodeView = (nv: any, editable: any) => (props: any) => {
  const {
    node,
    getPos,
    editor: ed
  } = props;
  // engine-owned outer host the consumer fragment mounts into.
  const dom = document.createElement(editable ? 'div' : 'span');
  dom.className = editable ? 'rozie-tiptap-nodeview rozie-tiptap-nodeview--block' : 'rozie-tiptap-nodeview rozie-tiptap-nodeview--inline';
  // EDITABLE nodes own a ProseMirror-managed contentDOM; the bridge grafts it
  // into the consumer fragment's [data-rozie-hole]. ATOM nodes have none.
  const contentDOM = editable ? document.createElement(dom.tagName === 'DIV' ? 'div' : 'span') : null;
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
// Build the two custom Nodes bound to the reactive nodeView portal. Takes the
// per-target `$portals.nodeView` (captured here so the reference stays inside
// the mount lifecycle — never top-level, per the bundled-leaf typecheck rule).
const makeNodeViewExtensions = (nv: any) => {
  // (1) NON-EDITABLE inline atom @mention chip (Spike 009 / REQ-26).
  const Mention = Node.create({
    name: 'rozieMention',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    addAttributes: () => ({
      id: {
        default: null
      },
      label: {
        default: ''
      }
    }),
    parseHTML: () => [{
      tag: 'span[data-rozie-mention]'
    }],
    // ATOM nodes are leaf nodes — their renderHTML must NOT include a `0` content
    // hole (ProseMirror's DOMSerializer throws "Content hole not allowed in a leaf
    // node spec"). The chip's visible content is supplied by the node view; the
    // serialized form is just the marker span carrying the attrs.
    renderHTML: ({
      HTMLAttributes
    }: any) => ['span', {
      'data-rozie-mention': '',
      ...HTMLAttributes
    }],
    addNodeView: () => makeNodeView(nv, false)
  });

  // (2) EDITABLE block callout with a contentDOM hole (Spike 008 / REQ-23).
  const Callout = Node.create({
    name: 'rozieCallout',
    group: 'block',
    content: 'inline*',
    defining: true,
    addAttributes: () => ({
      tone: {
        default: 'info'
      }
    }),
    parseHTML: () => [{
      tag: 'div[data-rozie-callout]'
    }],
    renderHTML: ({
      HTMLAttributes
    }: any) => ['div', {
      'data-rozie-callout': '',
      ...HTMLAttributes
    }, 0],
    addNodeView: () => makeNodeView(nv, true)
  });
  return [Mention, Callout];
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
// Plain-text extraction — word/char counts, search indexing, plaintext export.
// Mirrors getHTML/getJSON (empty string before mount). Was advertised by intent
// alongside getHTML/getJSON but never wired; now first-class.
export function getText() {
  return editor ? editor.getText() : '';
}
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
export function chain() {
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
export function isActive(name: any, attrs: any) {
  return editor ? editor.isActive(name, attrs) : false;
}
export function can() {
  return editor ? editor.can() : null;
}
export function isEmpty() {
  return editor ? editor.isEmpty : true;
}

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
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
  bubbleMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
    if (!bubbleMenu) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-bubbleMenu', '2aeee876');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: bubbleMenu, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  floatingMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
    if (!floatingMenu) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-floatingMenu', '2aeee876');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: floatingMenu, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  nodeView: (container: HTMLElement, scope: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): ReactivePortalHandle => {
    if (!nodeView) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-nodeView', '2aeee876');
    const inst = mount(PortalHostReactive, {
      target: container,
      props: { snippet: nodeView, initialScope: scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return {
      update: (s: unknown): void => {
        (inst as unknown as { update(s: unknown): void }).update(s);
      },
      dispose: (): void => {
        unmount(inst as Parameters<typeof unmount>[0]);
        portalInstances.delete(inst as Record<string, unknown>);
      },
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
  lastHtml = html;

  // Register the reactive node-view nodes ONLY when the consumer fills the
  // `nodeView` slot — an unfilled slot adds no custom nodes (zero overhead, no
  // unused $portals.nodeView reference fired). $portals.nodeView is captured
  // here inside the mount body and passed into the node factory, keeping the
  // reference scoped to the mount lifecycle (the toolbar-slot discipline).
  const nodeViewExtensions = nodeView ? makeNodeViewExtensions(portals.nodeView) : [];

  // Placeholder ghost-text (G3). Read $props.placeholder ONCE at construction
  // (setup-once, like content/editable/autofocus — no reactivity required). The
  // Placeholder extension (@tiptap/extensions, version-matched to StarterKit)
  // adds class `is-editor-empty` + a `data-placeholder` attribute to the first
  // empty node; the `::before` rule in the `:root { }` engine-DOM escape hatch
  // (in the style block) paints the ghost text. Empty placeholder = no extension.
  const placeholderExtensions = placeholder ? [Placeholder.configure({
    placeholder: placeholder
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
  if (bubbleMenu) {
    bubbleMenuEl = document.createElement('div');
    bubbleMenuEl.className = 'rozie-tiptap-bubble-menu';
  }
  if (floatingMenu) {
    floatingMenuEl = document.createElement('div');
    floatingMenuEl.className = 'rozie-tiptap-floating-menu';
  }
  const menuExtensions = [...(bubbleMenuEl ? [BubbleMenu.configure({
    element: bubbleMenuEl
  })] : []), ...(floatingMenuEl ? [FloatingMenu.configure({
    element: floatingMenuEl
  })] : [])];
  editor = new Editor({
    element: editorEl!,
    content: html,
    editable: editable,
    autofocus: autofocus,
    // StarterKit first; the Placeholder ext next; the reactive node-view nodes
    // next; consumer extensions LAST so they win (TipTap applies later-registered
    // extensions over earlier ones for the same node/mark).
    extensions: [StarterKit, ...placeholderExtensions, ...nodeViewExtensions, ...menuExtensions, ...extensions],
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
  return () => {
    toolbarDispose?.();
    toolbarDispose = null;
    bubbleMenuDispose?.();
    bubbleMenuDispose = null;
    floatingMenuDispose?.();
    floatingMenuDispose = null;
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

<div class={["rozie-tiptap", { 'is-readonly': !editable }]} data-rozie-s-2aeee876>{#if editable && !toolbar}<div class="rozie-tiptap-toolbar" data-rozie-s-2aeee876><button type="button" class={{ active: active.bold }} aria-label="Bold" onclick={toggleBold} data-rozie-s-2aeee876><strong data-rozie-s-2aeee876>B</strong></button><button type="button" class={{ active: active.italic }} aria-label="Italic" onclick={toggleItalic} data-rozie-s-2aeee876><em data-rozie-s-2aeee876>I</em></button><span class="sep" data-rozie-s-2aeee876></span><button type="button" class={{ active: active.h1 }} aria-label="Heading 1" onclick={($event) => { toggleHeading(1); }} data-rozie-s-2aeee876>H1</button><button type="button" class={{ active: active.h2 }} aria-label="Heading 2" onclick={($event) => { toggleHeading(2); }} data-rozie-s-2aeee876>H2</button><span class="sep" data-rozie-s-2aeee876></span><button type="button" class={{ active: active.bulletList }} aria-label="Bullet list" onclick={toggleBulletList} data-rozie-s-2aeee876>• List</button></div>{/if}{#if editable && toolbar}<div class="rozie-tiptap-toolbar rozie-tiptap-toolbar--slot" bind:this={toolbarEl} data-rozie-s-2aeee876></div>{/if}<div bind:this={editorEl} class="rozie-tiptap-content" data-placeholder={placeholder} data-rozie-s-2aeee876></div></div>

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

:global {
  .rozie-tiptap-content .is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: rgba(0, 0, 0, 0.4);
      float: left;
      height: 0;
      pointer-events: none;
    }
}
</style>
