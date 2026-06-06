import type { JSX } from 'solid-js';
import { Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// The live editor instance — null before mount / after destroy. Named `editor`
// (distinct from any template `ref="X"` name) so no capture-var-vs-ref double
// declaration trap (the Chart.js canvasEl/canvasNode lesson).

__rozieInjectStyle('TipTap-2aeee876', `.rozie-tiptap[data-rozie-s-2aeee876] {
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
.rozie-tiptap-content[data-rozie-s-2aeee876] ul[data-rozie-s-2aeee876] { margin: 0 0 0.5rem; padding-left: 1.5rem; }`);

interface ToolbarSlotCtx { editor: any; }

interface NodeViewSlotCtx { node: any; selected: any; updateAttributes: any; getPos: any; editor: any; contentDOM: any; }

interface TipTapProps {
  html?: string;
  defaultHtml?: string;
  onHtmlChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  autofocus?: boolean;
  editorClass?: string;
  ariaLabel?: string;
  editorProps?: Record<string, any>;
  extensions?: any[];
  onUpdate?: (...args: unknown[]) => void;
  onSelectionUpdate?: (...args: unknown[]) => void;
  onFocus?: (...args: unknown[]) => void;
  onBlur?: (...args: unknown[]) => void;
  toolbarSlot?: (ctx: ToolbarSlotCtx) => JSX.Element;
  nodeViewSlot?: (ctx: NodeViewSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: TipTapHandle) => void;
}

export interface TipTapHandle {
  getEditor: (...args: any[]) => any;
  focusEditor: (...args: any[]) => any;
  blurEditor: (...args: any[]) => any;
  getHTML: (...args: any[]) => any;
  getJSON: (...args: any[]) => any;
  setContent: (...args: any[]) => any;
  clearContent: (...args: any[]) => any;
  toggleBold: (...args: any[]) => any;
  toggleItalic: (...args: any[]) => any;
  toggleHeading: (...args: any[]) => any;
  toggleBulletList: (...args: any[]) => any;
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  chain: (...args: any[]) => any;
}

export default function TipTap(_props: TipTapProps): JSX.Element {
  const _merged = mergeProps({ editable: true, placeholder: '', autofocus: false, editorClass: '', ariaLabel: 'Rich text editor', editorProps: (() => ({}))(), extensions: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['html', 'editable', 'placeholder', 'autofocus', 'editorClass', 'ariaLabel', 'editorProps', 'extensions', 'ref']);
  onMount(() => { local.ref?.({ getEditor, focusEditor, blurEditor, getHTML, getJSON, setContent, clearContent, toggleBold, toggleItalic, toggleHeading, toggleBulletList, undo, redo, chain }); });

  const [html, setHtml] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'html', '<p>Start writing…</p>');
  const [active, setActive] = createSignal({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    bulletList: false
  });
  interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portalDisposers = new Set<() => void>();
  const portals = {
    toolbar: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
      const slot = _props.toolbarSlot ?? _props.slots?.['toolbar'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-toolbar', '2aeee876');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    nodeView: (container: HTMLElement, scope: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): ReactivePortalHandle => {
      const slot = _props.nodeViewSlot ?? _props.slots?.['nodeView'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-nodeView', '2aeee876');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig() as { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }), container);
      portalDisposers.add(dispose);
      return {
        update: (s: unknown): void => {
          setScopeSig(s);
        },
        dispose: (): void => {
          dispose();
          portalDisposers.delete(dispose);
        },
      };
    },
  };
  onCleanup(() => {
    for (const dispose of portalDisposers) dispose();
    portalDisposers.clear();
  });
  onMount(() => {
    const _cleanup = (() => {
    lastHtml = html();

    // Register the reactive node-view nodes ONLY when the consumer fills the
    // `nodeView` slot — an unfilled slot adds no custom nodes (zero overhead, no
    // unused $portals.nodeView reference fired). $portals.nodeView is captured
    // here inside the mount body and passed into the node factory, keeping the
    // reference scoped to the mount lifecycle (the toolbar-slot discipline).
    const nodeViewExtensions = (_props.nodeViewSlot ?? _props.slots?.["nodeView"]) ? makeNodeViewExtensions(portals.nodeView) : [];
    editor = new Editor({
      element: editorElRef,
      content: html(),
      editable: local.editable,
      autofocus: local.autofocus,
      // StarterKit first; the reactive node-view nodes next; consumer extensions
      // LAST so they win (TipTap applies later-registered extensions over earlier
      // ones for the same node/mark).
      extensions: [StarterKit, ...nodeViewExtensions, ...local.extensions],
      editorProps: {
        attributes: {
          'aria-label': local.ariaLabel,
          ...(local.editorClass ? {
            class: local.editorClass
          } : {}),
          ...(local.placeholder ? {
            'data-placeholder': local.placeholder,
            'aria-placeholder': local.placeholder
          } : {})
        },
        // Consumer editorProps spread LAST — full ProseMirror editorProps control
        // (handleKeyDown, handlePaste, a custom `attributes`, …) wins.
        ...local.editorProps
      },
      onUpdate: ({
        editor
      }: any) => {
        const next = editor.getHTML();
        lastHtml = next;
        // Round-trip guard — see CodeMirror/Flatpickr for the same shape.
        if (next !== html()) setHtml(next);
        _props.onUpdate?.(next);
      },
      onSelectionUpdate: () => {
        refreshActive();
        _props.onSelectionUpdate?.();
      },
      onFocus: () => _props.onFocus?.(),
      onBlur: () => _props.onBlur?.()
    });
    refreshActive();

    // `toolbar` portal slot — when the consumer fills it, mount their toolbar
    // fragment into the engine-adjacent host node, handing them the live editor
    // (their buttons call editor.chain().focus()…run()). $portals.toolbar is
    // referenced ONLY here inside $onMount (the per-target portal helper is scoped
    // to the mount lifecycle — a top-level reference would fail the bundled-leaf
    // strict typecheck, the FullCalendar/CodeMirror pattern). The host div is
    // r-if-gated on $slots.toolbar so $refs.toolbarEl exists exactly when filled.
    if ((_props.toolbarSlot ?? _props.slots?.["toolbar"]) && toolbarElRef) {
      toolbarDispose = portals.toolbar(toolbarElRef, {
        editor
      });
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    toolbarDispose?.();
    toolbarDispose = null;
    editor?.destroy();
  });
  });
  createEffect(on(() => (() => html())(), (v) => untrack(() => ((v: any) => {
    if (!editor) return;
    if (v === lastHtml) return;
    lastHtml = v;
    editor.commands.setContent(v, {
      emitUpdate: false
    });
    refreshActive();
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.editable)(), (v) => untrack(() => ((v: any) => editor?.setEditable(v, false))(v)), { defer: true }));
  let toolbarElRef: HTMLElement | null = null;
  let editorElRef: HTMLElement | null = null;

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

  // Recompute the internal toolbar's active-mark booleans from the live editor.
  function refreshActive() {
    if (!editor) return;
    setActive({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      h1: editor.isActive('heading', {
        level: 1
      }),
      h2: editor.isActive('heading', {
        level: 2
      }),
      bulletList: editor.isActive('bulletList')
    });
  }

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
  function makeNodeView(nv: any, editable: any) {
    return (props: any) => {
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
  }

  // Build the two custom Nodes bound to the reactive nodeView portal. Takes the
  // per-target `$portals.nodeView` (captured here so the reference stays inside
  // the mount lifecycle — never top-level, per the bundled-leaf typecheck rule).
  function makeNodeViewExtensions(nv: any) {
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
  }
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
  function setContent(next: any) {
    if (!editor) return;
    const v = next ?? '';
    if (v === lastHtml) return;
    lastHtml = v;
    editor.commands.setContent(v, {
      emitUpdate: false
    });
    setHtml(v);
    refreshActive();
  }
  function clearContent() {
    if (!editor) return;
    editor.commands.clearContent();
    lastHtml = editor.getHTML();
    setHtml(lastHtml);
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
  function chain() {
    return editor ? editor.chain().focus() : null;
  }

  return (
    <>
    <div class={"rozie-tiptap"} classList={{ 'is-readonly': !local.editable }} data-rozie-s-2aeee876="">
      
      {<Show when={local.editable && !(_props.toolbarSlot ?? _props.slots?.['toolbar'])}><div class={"rozie-tiptap-toolbar"} data-rozie-s-2aeee876="">
        <button type="button" aria-label="Bold" classList={{ active: active().bold }} onClick={toggleBold} data-rozie-s-2aeee876=""><strong data-rozie-s-2aeee876="">B</strong></button>
        <button type="button" aria-label="Italic" classList={{ active: active().italic }} onClick={toggleItalic} data-rozie-s-2aeee876=""><em data-rozie-s-2aeee876="">I</em></button>
        <span class={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" aria-label="Heading 1" classList={{ active: active().h1 }} onClick={($event) => { toggleHeading(1); }} data-rozie-s-2aeee876="">H1</button>
        <button type="button" aria-label="Heading 2" classList={{ active: active().h2 }} onClick={($event) => { toggleHeading(2); }} data-rozie-s-2aeee876="">H2</button>
        <span class={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" aria-label="Bullet list" classList={{ active: active().bulletList }} onClick={toggleBulletList} data-rozie-s-2aeee876="">• List</button>
      </div></Show>}{<Show when={local.editable && (_props.toolbarSlot ?? _props.slots?.['toolbar'])}><div class={"rozie-tiptap-toolbar rozie-tiptap-toolbar--slot"} ref={(el) => { toolbarElRef = el as HTMLElement; }} data-rozie-s-2aeee876="" /></Show>}<div ref={(el) => { editorElRef = el as HTMLElement; }} class={"rozie-tiptap-content"} data-placeholder={local.placeholder} data-rozie-s-2aeee876="" />
    </div>




    </>
  );
}
