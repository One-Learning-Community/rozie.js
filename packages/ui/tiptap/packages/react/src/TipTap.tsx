import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './TipTap.css';
import './TipTap.global.css';
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
// Image node extension (ask D). Not part of StarterKit. Version-pinned in
// lockstep with @tiptap/core (3.23.5). Named export `Image` — verified against
// the installed dist `.d.ts` (also carries a default export; we use the named
// form to match the BubbleMenu/FloatingMenu import style). Gated on
// $props.uploadImage — an absent hook registers NO Image extension.
import { Image } from '@tiptap/extension-image';

// The live editor instance — null before mount / after destroy. Named `editor`
// (distinct from any template `ref="X"` name) so no capture-var-vs-ref double
// declaration trap (the Chart.js canvasEl/canvasNode lesson).

interface ToolbarCtx { editor: any; }

interface BubbleMenuCtx { editor: any; }

interface FloatingMenuCtx { editor: any; }

interface NodeViewCtx { node: any; selected: any; updateAttributes: any; getPos: any; editor: any; contentDOM: any; }

interface TipTapProps {
  /**
   * The editor's document content as an HTML string — the sole `model: true` prop (two-way `r-model`). Typing writes the new HTML back through the model path (TipTap's `onUpdate`); a consumer write reflects into the live document, echo-guarded so a programmatic set does not reset the selection or re-emit `update`.
   * @example
   * <TipTap r-model:html="content" placeholder="Start writing…" />
   */
  html?: string;
  defaultHtml?: string;
  onHtmlChange?: (html: string) => void;
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
  /**
   * An async image-upload hook, signature `(file: File) => Promise<string>` resolving to a URL. When provided, the (otherwise-absent) Image extension is registered AND pasting/dropping an image file uploads it via this function then inserts the resolved URL at the caret / drop position. When `null` (default), the Image extension is absent and paste/drop are unchanged — zero overhead. The wrapper's paste/drop handling is a fallback: a consumer-supplied `editorProps.handlePaste` / `handleDrop` still wins.
   * @example
   * <TipTap :upload-image="uploadFn" />
   */
  uploadImage?: ((...args: any[]) => any) | null;
  onUpdate?: (...args: any[]) => void;
  onSelectionUpdate?: (...args: any[]) => void;
  onFocus?: (...args: any[]) => void;
  onBlur?: (...args: any[]) => void;
  renderToolbar?: (ctx: ToolbarCtx) => ReactNode;
  renderBubbleMenu?: (ctx: BubbleMenuCtx) => ReactNode;
  renderFloatingMenu?: (ctx: FloatingMenuCtx) => ReactNode;
  renderNodeView?: (ctx: NodeViewCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface TipTapHandle {
  getEditor: (...args: any[]) => any;
  focusEditor: (...args: any[]) => any;
  blurEditor: (...args: any[]) => any;
  getHTML: (...args: any[]) => any;
  getJSON: (...args: any[]) => any;
  getText: (...args: any[]) => any;
  setContent: (...args: any[]) => any;
  clearContent: (...args: any[]) => any;
  toggleBold: (...args: any[]) => any;
  toggleItalic: (...args: any[]) => any;
  toggleHeading: (...args: any[]) => any;
  toggleBulletList: (...args: any[]) => any;
  toggleUnderline: (...args: any[]) => any;
  toggleOrderedList: (...args: any[]) => any;
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  chain: (...args: any[]) => any;
  isActive: (...args: any[]) => any;
  can: (...args: any[]) => any;
  isEmpty: (...args: any[]) => any;
}

const TipTap = forwardRef<TipTapHandle, TipTapProps>(function TipTap(_props: TipTapProps, ref): JSX.Element {
  const portalRoots = useRef<Set<Root>>(new Set());
  const __defaultEditorProps = useState(() => (() => ({}))())[0];
  const __defaultExtensions = useState(() => (() => [])())[0];
  const __defaultStarterKit = useState(() => (() => ({}))())[0];
  const __defaultNodeSpecs = useState(() => (() => [])())[0];
  const props: Omit<TipTapProps, 'editable' | 'placeholder' | 'autofocus' | 'editorClass' | 'ariaLabel' | 'editorProps' | 'extensions' | 'starterKit' | 'nodeSpecs' | 'uploadImage'> & { editable: boolean; placeholder: string; autofocus: boolean; editorClass: string; ariaLabel: string; editorProps: Record<string, any>; extensions: any[]; starterKit: Record<string, any>; nodeSpecs: any[]; uploadImage: ((...args: any[]) => any) | null } = {
    ..._props,
    editable: _props.editable ?? true,
    placeholder: _props.placeholder ?? '',
    autofocus: _props.autofocus ?? false,
    editorClass: _props.editorClass ?? '',
    ariaLabel: _props.ariaLabel ?? 'Rich text editor',
    editorProps: _props.editorProps ?? __defaultEditorProps,
    extensions: _props.extensions ?? __defaultExtensions,
    starterKit: _props.starterKit ?? __defaultStarterKit,
    nodeSpecs: _props.nodeSpecs ?? __defaultNodeSpecs,
    uploadImage: _props.uploadImage ?? null,
  };
  const _renderToolbarRef = useRef(props.renderToolbar);
  _renderToolbarRef.current = props.renderToolbar;
  const _renderBubbleMenuRef = useRef(props.renderBubbleMenu);
  _renderBubbleMenuRef.current = props.renderBubbleMenu;
  const _renderFloatingMenuRef = useRef(props.renderFloatingMenu);
  _renderFloatingMenuRef.current = props.renderFloatingMenu;
  const _renderNodeViewRef = useRef(props.renderNodeView);
  _renderNodeViewRef.current = props.renderNodeView;
  const lastHtml = useRef<any>(null);
  const bubbleMenuEl = useRef<any>(null);
  const floatingMenuEl = useRef<any>(null);
  const editor = useRef<any>(null);
  const toolbarDispose = useRef<any>(null);
  const bubbleMenuDispose = useRef<any>(null);
  const floatingMenuDispose = useRef<any>(null);
  const [html, setHtml] = useControllableState({
    value: props.html,
    defaultValue: props.defaultHtml ?? '<p>Start writing…</p>',
    onValueChange: props.onHtmlChange,
  });
  const _editableRef = useRef(props.editable);
  _editableRef.current = props.editable;
  const _htmlRef = useRef(html);
  _htmlRef.current = html;
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    bulletList: false,
    underline: false,
    orderedList: false
  });
  const toolbarEl = useRef<HTMLDivElement | null>(null);
  const editorEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);

  const refreshActive = useCallback(() => {
    if (!editor.current) return;
    setActive({
      bold: editor.current.isActive('bold'),
      italic: editor.current.isActive('italic'),
      h1: editor.current.isActive('heading', {
        level: 1
      }),
      h2: editor.current.isActive('heading', {
        level: 2
      }),
      bulletList: editor.current.isActive('bulletList'),
      underline: editor.current.isActive('underline'),
      orderedList: editor.current.isActive('orderedList')
    });
  }, []);
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
  const buildStarterKitConfig = useCallback((userConfig: any, exts: any) => {
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
  }, []);
  const dedupeExtensionsByName = useCallback((exts: any) => {
    const byKey = new Map();
    let anonSeq = 0;
    for (const ext of exts as any) {
      const name = ext && typeof ext === 'object' ? ext.name : undefined;
      const key = typeof name === 'string' ? name : `__rozie_anon_${anonSeq++}`;
      byKey.set(key, ext);
    }
    return [...byKey.values()];
  }, []);
  function makeNodeView(nv: any, spec: any) {
    return (props: any) => {
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
  }
  function parseTagSelector(selector: any) {
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
  }
  const makeNodeViewExtensions = useCallback((nv: any, specs: any) => specs.map((spec: any) => {
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
  }), [makeNodeView, parseTagSelector]);
  function findImageFile(files: any) {
    if (!files) return undefined;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f && typeof f.type === 'string' && f.type.indexOf('image/') === 0) return f;
    }
    return undefined;
  }
  // uploadImage paste/drop fallbacks (ask D / D-04) — ProseMirror `editorProps`
  // handlers. TOP-LEVEL functions (siblings of `refreshActive`/the $expose
  // verbs below), NOT nested inside $onMount's ternary/object-literal — a
  // closure reading the component-scope `editor` from several function-levels
  // deep inside $onMount (object-literal method → `.then` callback) hits a
  // `this`-rebinding gap on the class-based targets (Angular/Lit) that the
  // emitter's nested-`this` repair does not reach at that depth
  // (emitter-backlog). A top-level function is only ONE level removed from the
  // promoted-`this` boundary — the same shallow depth as the `onUpdate` /
  // `$watch` callbacks elsewhere in this file, which already compile clean —
  // so referencing `editor` here needs no repair at all. Each handler claims
  // ONLY an image/* payload: returns `true` SYNCHRONOUSLY (claiming the
  // paste/drop now — never awaits inside the handler) and inserts the resolved
  // URL once the consumer's uploadImage promise settles; a rejection is
  // swallowed (`.catch(() => {})`) so a failed upload never crashes the editor
  // (T-e7i-01). Returns `false` for a non-image payload — or, for drop, an
  // internal node move — so ProseMirror (or a consumer editorProps handler,
  // which still wins via the LAST spread) processes it normally.
  function handlePaste(view: any, event: any, slice: any) {
    // Captured into a local (not repeated `$props.uploadImage` member reads) so
    // the null-check narrows the type on every target — including Lit, where
    // the Function prop lowers to a nullable function type and a bare
    // `$props.uploadImage(file)` call trips strict-null under bundled-leaf
    // typecheck (TS2721) even though this handler is only ever wired into
    // editorProps when uploadImage is truthy (belt-and-suspenders — the D-03
    // gate already guarantees this in practice).
    const upload = props.uploadImage;
    if (!upload) return false;
    const file = findImageFile(event.clipboardData ? event.clipboardData.files : undefined);
    if (!file) return false;
    event.preventDefault();
    upload(file).then((url: any) => {
      editor.current?.chain().focus().setImage({
        src: url
      }).run();
    }).catch(() => {});
    return true;
  }
  function handleDrop(view: any, event: any, slice: any, moved: any) {
    if (moved) return false;
    // See handlePaste — local capture for the same cross-target null-narrowing.
    const upload = props.uploadImage;
    if (!upload) return false;
    const file = findImageFile(event.dataTransfer ? event.dataTransfer.files : undefined);
    if (!file) return false;
    event.preventDefault();
    const pos = view.posAtCoords({
      left: event.clientX,
      top: event.clientY
    });
    upload(file).then((url: any) => {
      const insertPos = pos ? pos.pos : editor.current ? editor.current.state.selection.head : 0;
      editor.current?.chain().focus().insertContentAt(insertPos, {
        type: 'image',
        attrs: {
          src: url
        }
      }).run();
    }).catch(() => {});
    return true;
  }
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
    return editor.current;
  }
  function focusEditor() {
    editor.current?.commands.focus();
  }
  function blurEditor() {
    editor.current?.commands.blur();
  }
  function getHTML() {
    return editor.current ? editor.current.getHTML() : '';
  }
  function getJSON() {
    return editor.current ? editor.current.getJSON() : null;
  }
  // Plain-text extraction — word/char counts, search indexing, plaintext export.
  // Mirrors getHTML/getJSON (empty string before mount). Was advertised by intent
  // alongside getHTML/getJSON but never wired; now first-class.
  // Plain-text extraction — word/char counts, search indexing, plaintext export.
  // Mirrors getHTML/getJSON (empty string before mount). Was advertised by intent
  // alongside getHTML/getJSON but never wired; now first-class.
  function getText() {
    return editor.current ? editor.current.getText() : '';
  }
  // setContent routes through the SAME suppress-echo bookkeeping as $watch(html):
  // update lastHtml first, set with emitUpdate:false (no onUpdate bounce), then
  // reflect into the model so a programmatic set keeps the bound state in sync.
  // setContent routes through the SAME suppress-echo bookkeeping as $watch(html):
  // update lastHtml first, set with emitUpdate:false (no onUpdate bounce), then
  // reflect into the model so a programmatic set keeps the bound state in sync.
  function setContent(next: any) {
    if (!editor.current) return;
    const v = next ?? '';
    if (v === lastHtml.current) return;
    lastHtml.current = v;
    editor.current.commands.setContent(v, {
      emitUpdate: false
    });
    setHtml(v);
    refreshActive();
  }
  function clearContent() {
    if (!editor.current) return;
    editor.current.commands.clearContent();
    lastHtml.current = editor.current.getHTML();
    setHtml(lastHtml.current);
    refreshActive();
  }
  function toggleBold() {
    editor.current?.chain().focus().toggleBold().run();
    refreshActive();
  }
  function toggleItalic() {
    editor.current?.chain().focus().toggleItalic().run();
    refreshActive();
  }
  function toggleHeading(level: any) {
    editor.current?.chain().focus().toggleHeading({
      level: level ?? 1
    }).run();
    refreshActive();
  }
  function toggleBulletList() {
    editor.current?.chain().focus().toggleBulletList().run();
    refreshActive();
  }
  function toggleUnderline() {
    editor.current?.chain().focus().toggleUnderline().run();
    refreshActive();
  }
  function toggleOrderedList() {
    editor.current?.chain().focus().toggleOrderedList().run();
    refreshActive();
  }
  function undo() {
    editor.current?.chain().focus().undo().run();
    refreshActive();
  }
  function redo() {
    editor.current?.chain().focus().redo().run();
    refreshActive();
  }
  // Power-user escape hatch — returns a pre-focused command chain (TipTap idiom:
  // chain().focus().toggleBold().setColor('#f00').run()). null before mount.
  // Power-user escape hatch — returns a pre-focused command chain (TipTap idiom:
  // chain().focus().toggleBold().setColor('#f00').run()). null before mount.
  function chain() {
    return editor.current ? editor.current.chain().focus() : null;
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
    return editor.current ? editor.current.isActive(name, attrs) : false;
  }
  function can() {
    return editor.current ? editor.current.can() : null;
  }
  function isEmpty() {
    return editor.current ? editor.current.isEmpty : true;
  }

  useEffect(() => {
    interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portals = {
    toolbar: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
      const slot = _renderToolbarRef.current ?? props.slots?.['toolbar'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal toolbar { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-toolbar', '2aeee876');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    bubbleMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
      const slot = _renderBubbleMenuRef.current ?? props.slots?.['bubbleMenu'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal bubbleMenu { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-bubbleMenu', '2aeee876');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    floatingMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
      const slot = _renderFloatingMenuRef.current ?? props.slots?.['floatingMenu'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal floatingMenu { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-floatingMenu', '2aeee876');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    nodeView: (container: HTMLElement, scope: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): ReactivePortalHandle => {
      const slot = _renderNodeViewRef.current ?? props.slots?.['nodeView'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal nodeView { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-nodeView', '2aeee876');
      const root = createRoot(container);
      const renderScope = (s: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
  };
    lastHtml.current = _htmlRef.current;

    // Register the reactive node-view nodes ONLY when the consumer fills the
    // `nodeView` slot AND supplies one or more `nodeSpecs` (D-05 — BOTH halves
    // required). A stock <TipTap> with no nodeSpecs (or an unfilled slot) adds
    // NO custom nodes — zero overhead, no consumer-node-shaped parse rules
    // registered, no unused $portals.nodeView reference fired. $props.nodeSpecs is
    // read ONCE here (setup-once — NOT a $watch); $portals.nodeView is captured
    // here inside the mount body and passed into the node factory, keeping the
    // reference scoped to the mount lifecycle (the toolbar-slot discipline).
    const nodeViewExtensions = (props.renderNodeView ?? props.slots?.["nodeView"]) && props.nodeSpecs.length ? makeNodeViewExtensions(portals.nodeView, props.nodeSpecs) : [];

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
    if ((props.renderBubbleMenu ?? props.slots?.["bubbleMenu"])) {
      bubbleMenuEl.current = document.createElement('div');
      bubbleMenuEl.current.className = 'rozie-tiptap-bubble-menu';
    }
    if ((props.renderFloatingMenu ?? props.slots?.["floatingMenu"])) {
      floatingMenuEl.current = document.createElement('div');
      floatingMenuEl.current.className = 'rozie-tiptap-floating-menu';
    }
    const menuExtensions = [...(bubbleMenuEl.current ? [BubbleMenu.configure({
      element: bubbleMenuEl.current
    })] : []), ...(floatingMenuEl.current ? [FloatingMenu.configure({
      element: floatingMenuEl.current
    })] : [])];

    // Image-upload hook (ask D). Setup-once, gated on $props.uploadImage — read
    // ONCE here (not a $watch — mirrors autofocus/placeholder/nodeSpecs). When
    // absent: no Image extension, no paste/drop handlers (zero overhead, the
    // unfilled-slot discipline). Conditional SPREAD (not `const x = []; x.push`)
    // for the same never[]-inference reason as placeholderExtensions/nodeViewExtensions.
    const imageExtensions = props.uploadImage ? [Image] : [];

    // uploadHandlers — ProseMirror `editorProps` paste/drop fallbacks (D-04).
    // A SHALLOW gated reference object — `{}` (no-op) when $props.uploadImage
    // is unset, else shorthand-referencing the top-level handlePaste/handleDrop
    // functions declared above (see their doc comment for why they live at the
    // top level rather than as closures nested in this ternary).
    const uploadHandlers = props.uploadImage ? {
      handlePaste,
      handleDrop
    } : {};
    editor.current = new Editor({
      element: editorEl.current!,
      content: _htmlRef.current,
      editable: _editableRef.current,
      autofocus: props.autofocus,
      // StarterKit first (config-disabled per the collision scan below); the
      // Placeholder ext next; the reactive node-view nodes next; consumer
      // extensions LAST so they win (TipTap applies later-registered extensions
      // over earlier ones for the same node/mark) — and the whole array is
      // name-deduped keeping the LAST occurrence as a safety net (D-03) on top
      // of the config-level auto-disable (D-02), which is what actually silences
      // StarterKit's internal same-named extension (e.g. its bundled `Link`).
      extensions: dedupeExtensionsByName([StarterKit.configure(buildStarterKitConfig(props.starterKit, props.extensions)), ...placeholderExtensions, ...nodeViewExtensions, ...menuExtensions, ...imageExtensions, ...props.extensions]),
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
        // uploadImage paste/drop fallbacks (D-04) — spread BEFORE the consumer's
        // own editorProps so a consumer-supplied handlePaste/handleDrop wins.
        // `{}` (no-op) when $props.uploadImage is unset.
        ...uploadHandlers,
        // Consumer editorProps spread LAST — full ProseMirror editorProps control
        // (handleKeyDown, handlePaste, a custom `attributes`, …) wins.
        ...props.editorProps
      },
      onUpdate: ({
        editor
      }: any) => {
        const next = editor.getHTML();
        lastHtml.current = next;
        // Round-trip guard — see CodeMirror/Flatpickr for the same shape.
        if (next !== _htmlRef.current) setHtml(next);
        props.onUpdate && props.onUpdate(next);
      },
      onSelectionUpdate: () => {
        refreshActive();
        props.onSelectionUpdate && props.onSelectionUpdate();
      },
      onFocus: () => props.onFocus && props.onFocus(),
      onBlur: () => props.onBlur && props.onBlur()
    });
    refreshActive();

    // `toolbar` portal slot — when the consumer fills it, mount their toolbar
    // fragment into the engine-adjacent host node, handing them the live editor
    // (their buttons call editor.chain().focus()…run()). $portals.toolbar is
    // referenced ONLY here inside $onMount (the per-target portal helper is scoped
    // to the mount lifecycle — a top-level reference would fail the bundled-leaf
    // strict typecheck, the FullCalendar/CodeMirror pattern). The host div is
    // r-if-gated on $slots.toolbar so $refs.toolbarEl exists exactly when filled.
    if ((props.renderToolbar ?? props.slots?.["toolbar"]) && toolbarEl.current) {
      toolbarDispose.current = portals.toolbar(toolbarEl.current!, {
        editor: editor.current
      });
    }

    // `bubbleMenu` / `floatingMenu` portal slots — mount the consumer's menu
    // fragment into the engine-owned (imperatively-created) host element handed to
    // the Floating-UI menu extension, with the live editor in scope (their buttons
    // call editor.chain().focus()…run()). Like toolbar/nodeView, $portals.bubbleMenu
    // / $portals.floatingMenu are referenced ONLY inside $onMount (the bundled-leaf
    // strict-typecheck discipline). The element is created above only when the slot
    // is filled, so each portal fires exactly when its slot exists.
    if (bubbleMenuEl.current) {
      bubbleMenuDispose.current = portals.bubbleMenu(bubbleMenuEl.current, {
        editor: editor.current
      });
    }
    if (floatingMenuEl.current) {
      floatingMenuDispose.current = portals.floatingMenu(floatingMenuEl.current, {
        editor: editor.current
      });
    }
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      toolbarDispose.current?.();
      toolbarDispose.current = null;
      bubbleMenuDispose.current?.();
      bubbleMenuDispose.current = null;
      floatingMenuDispose.current?.();
      floatingMenuDispose.current = null;
      editor.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = html;
    if (!editor.current) return;
    if (v === lastHtml.current) return;
    lastHtml.current = v;
    editor.current.commands.setContent(v, {
      emitUpdate: false
    });
    refreshActive();
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    const v = props.editable;
    editor.current?.setEditable(v, false);
  }, [props.editable]);

  const _rozieExposeRef = useRef({ getEditor, focusEditor, blurEditor, getHTML, getJSON, getText, setContent, clearContent, toggleBold, toggleItalic, toggleHeading, toggleBulletList, toggleUnderline, toggleOrderedList, undo, redo, chain, isActive, can, isEmpty });
  _rozieExposeRef.current = { getEditor, focusEditor, blurEditor, getHTML, getJSON, getText, setContent, clearContent, toggleBold, toggleItalic, toggleHeading, toggleBulletList, toggleUnderline, toggleOrderedList, undo, redo, chain, isActive, can, isEmpty };
  useImperativeHandle(ref, () => ({ getEditor: (...args: Parameters<typeof getEditor>): ReturnType<typeof getEditor> => _rozieExposeRef.current.getEditor(...args), focusEditor: (...args: Parameters<typeof focusEditor>): ReturnType<typeof focusEditor> => _rozieExposeRef.current.focusEditor(...args), blurEditor: (...args: Parameters<typeof blurEditor>): ReturnType<typeof blurEditor> => _rozieExposeRef.current.blurEditor(...args), getHTML: (...args: Parameters<typeof getHTML>): ReturnType<typeof getHTML> => _rozieExposeRef.current.getHTML(...args), getJSON: (...args: Parameters<typeof getJSON>): ReturnType<typeof getJSON> => _rozieExposeRef.current.getJSON(...args), getText: (...args: Parameters<typeof getText>): ReturnType<typeof getText> => _rozieExposeRef.current.getText(...args), setContent: (...args: Parameters<typeof setContent>): ReturnType<typeof setContent> => _rozieExposeRef.current.setContent(...args), clearContent: (...args: Parameters<typeof clearContent>): ReturnType<typeof clearContent> => _rozieExposeRef.current.clearContent(...args), toggleBold: (...args: Parameters<typeof toggleBold>): ReturnType<typeof toggleBold> => _rozieExposeRef.current.toggleBold(...args), toggleItalic: (...args: Parameters<typeof toggleItalic>): ReturnType<typeof toggleItalic> => _rozieExposeRef.current.toggleItalic(...args), toggleHeading: (...args: Parameters<typeof toggleHeading>): ReturnType<typeof toggleHeading> => _rozieExposeRef.current.toggleHeading(...args), toggleBulletList: (...args: Parameters<typeof toggleBulletList>): ReturnType<typeof toggleBulletList> => _rozieExposeRef.current.toggleBulletList(...args), toggleUnderline: (...args: Parameters<typeof toggleUnderline>): ReturnType<typeof toggleUnderline> => _rozieExposeRef.current.toggleUnderline(...args), toggleOrderedList: (...args: Parameters<typeof toggleOrderedList>): ReturnType<typeof toggleOrderedList> => _rozieExposeRef.current.toggleOrderedList(...args), undo: (...args: Parameters<typeof undo>): ReturnType<typeof undo> => _rozieExposeRef.current.undo(...args), redo: (...args: Parameters<typeof redo>): ReturnType<typeof redo> => _rozieExposeRef.current.redo(...args), chain: (...args: Parameters<typeof chain>): ReturnType<typeof chain> => _rozieExposeRef.current.chain(...args), isActive: (...args: Parameters<typeof isActive>): ReturnType<typeof isActive> => _rozieExposeRef.current.isActive(...args), can: (...args: Parameters<typeof can>): ReturnType<typeof can> => _rozieExposeRef.current.can(...args), isEmpty: (...args: Parameters<typeof isEmpty>): ReturnType<typeof isEmpty> => _rozieExposeRef.current.isEmpty(...args) }), []);

  return (
    <>
    <div className={clsx("rozie-tiptap", { "is-readonly": !props.editable })} data-rozie-s-2aeee876="">
      
      {!!(props.editable && !(props.renderToolbar ?? props.slots?.['toolbar'])) && <div className={"rozie-tiptap-toolbar"} data-rozie-s-2aeee876="">
        <button type="button" className={clsx({ active: active.bold })} aria-label="Bold" onClick={toggleBold} data-rozie-s-2aeee876=""><strong data-rozie-s-2aeee876="">B</strong></button>
        <button type="button" className={clsx({ active: active.italic })} aria-label="Italic" onClick={toggleItalic} data-rozie-s-2aeee876=""><em data-rozie-s-2aeee876="">I</em></button>
        <span className={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" className={clsx({ active: active.h1 })} aria-label="Heading 1" onClick={($event) => { toggleHeading(1); }} data-rozie-s-2aeee876="">H1</button>
        <button type="button" className={clsx({ active: active.h2 })} aria-label="Heading 2" onClick={($event) => { toggleHeading(2); }} data-rozie-s-2aeee876="">H2</button>
        <span className={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" className={clsx({ active: active.bulletList })} aria-label="Bullet list" onClick={toggleBulletList} data-rozie-s-2aeee876="">• List</button>
        <button type="button" className={clsx({ active: active.underline })} aria-label="Underline" onClick={toggleUnderline} data-rozie-s-2aeee876=""><u data-rozie-s-2aeee876="">U</u></button>
        <button type="button" className={clsx({ active: active.orderedList })} aria-label="Ordered list" onClick={toggleOrderedList} data-rozie-s-2aeee876="">1. List</button>
        <span className={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" aria-label="Undo" onClick={undo} data-rozie-s-2aeee876="">↺</button>
        <button type="button" aria-label="Redo" onClick={redo} data-rozie-s-2aeee876="">↻</button>
      </div>}{!!(props.editable && (props.renderToolbar ?? props.slots?.['toolbar'])) && <div className={"rozie-tiptap-toolbar rozie-tiptap-toolbar--slot"} ref={toolbarEl} data-rozie-s-2aeee876="" />}<div ref={editorEl} className={"rozie-tiptap-content"} data-placeholder={props.placeholder} data-rozie-s-2aeee876="" />
    </div>







    </>
  );
});
export default TipTap;
