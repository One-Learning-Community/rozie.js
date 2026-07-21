import type { JSX } from 'solid-js';
import { Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
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
// Character/word count storage extension (D-01/D-02). SEPARATE package, not part
// of StarterKit, version-pinned in lockstep with core (3.23.5). Named export
// `CharacterCount` — verified against the installed dist `.d.ts` (re-exported
// from `@tiptap/extensions`, matching Placeholder's home package; also carries a
// default export, but the named form matches this file's import style). Gated on
// $props.maxLength / the `count` slot — an unfilled gate registers NO extension.
import { CharacterCount } from '@tiptap/extension-character-count';

// The live editor instance — null before mount / after destroy. Named `editor`
// (distinct from any template `ref="X"` name) so no capture-var-vs-ref double
// declaration trap (the Chart.js canvasEl/canvasNode lesson).

__rozieInjectStyle('TipTap-2aeee876', `.rozie-tiptap[data-rozie-s-2aeee876] {
  border: var(--rozie-tiptap-border, 1px solid rgba(0, 0, 0, 0.15));
  border-radius: var(--rozie-tiptap-radius, 6px);
  overflow: hidden;
  background: var(--rozie-tiptap-bg, white);
}
.rozie-tiptap.is-readonly[data-rozie-s-2aeee876] {
  background: var(--rozie-tiptap-readonly-bg, #fafafa);
}
.rozie-tiptap-toolbar[data-rozie-s-2aeee876] {
  display: flex;
  align-items: center;
  gap: var(--rozie-tiptap-toolbar-gap, 0.125rem);
  padding: var(--rozie-tiptap-toolbar-padding, 0.25rem 0.375rem);
  border-bottom: var(--rozie-tiptap-toolbar-border, 1px solid rgba(0, 0, 0, 0.08));
  background: var(--rozie-tiptap-toolbar-bg, #f5f5f7);
}
.rozie-tiptap-toolbar[data-rozie-s-2aeee876] button[data-rozie-s-2aeee876] {
  padding: var(--rozie-tiptap-button-padding, 0.25rem 0.5rem);
  border: var(--rozie-tiptap-button-border, 1px solid transparent);
  background: var(--rozie-tiptap-button-bg, transparent);
  border-radius: var(--rozie-tiptap-button-radius, 3px);
  cursor: pointer;
  font: inherit;
  font-size: var(--rozie-tiptap-button-font-size, 0.8125rem);
  min-width: var(--rozie-tiptap-button-min-width, 1.75rem);
  color: var(--rozie-tiptap-button-color, rgba(0, 0, 0, 0.65));
}
.rozie-tiptap-toolbar[data-rozie-s-2aeee876] button[data-rozie-s-2aeee876]:hover {
  background: var(--rozie-tiptap-button-hover-bg, rgba(0, 0, 0, 0.06));
}
.rozie-tiptap-toolbar[data-rozie-s-2aeee876] button.active[data-rozie-s-2aeee876] {
  background: var(--rozie-tiptap-button-active-bg, #1a1a1a);
  color: var(--rozie-tiptap-button-active-color, white);
  border-color: var(--rozie-tiptap-button-active-border-color, #1a1a1a);
}
.rozie-tiptap-toolbar[data-rozie-s-2aeee876] .sep[data-rozie-s-2aeee876] {
  width: var(--rozie-tiptap-toolbar-sep-width, 1px);
  height: var(--rozie-tiptap-toolbar-sep-height, 1rem);
  background: var(--rozie-tiptap-toolbar-sep-bg, rgba(0, 0, 0, 0.1));
  margin: var(--rozie-tiptap-toolbar-sep-margin, 0 0.25rem);
}
.rozie-tiptap-content[data-rozie-s-2aeee876] {
  padding: var(--rozie-tiptap-content-padding, 0.625rem 0.875rem);
  min-height: var(--rozie-tiptap-content-min-height, 6rem);
  font: inherit;
  outline: none;
}
.rozie-tiptap-content[data-rozie-s-2aeee876] p[data-rozie-s-2aeee876] { margin: var(--rozie-tiptap-content-p-margin, 0 0 0.5rem); }
.rozie-tiptap-content[data-rozie-s-2aeee876] p[data-rozie-s-2aeee876]:last-child { margin-bottom: 0; }
.rozie-tiptap-content[data-rozie-s-2aeee876] h1[data-rozie-s-2aeee876] { font-size: var(--rozie-tiptap-content-h1-font-size, 1.5rem); margin: var(--rozie-tiptap-content-h1-margin, 0.5rem 0 0.375rem); }
.rozie-tiptap-content[data-rozie-s-2aeee876] h2[data-rozie-s-2aeee876] { font-size: var(--rozie-tiptap-content-h2-font-size, 1.25rem); margin: var(--rozie-tiptap-content-h2-margin, 0.5rem 0 0.375rem); }
.rozie-tiptap-content[data-rozie-s-2aeee876] ul[data-rozie-s-2aeee876] { margin: var(--rozie-tiptap-content-list-margin, 0 0 0.5rem); padding-left: var(--rozie-tiptap-content-list-indent, 1.5rem); }
.rozie-tiptap-count[data-rozie-s-2aeee876] {
  display: flex;
  justify-content: flex-end;
  padding: var(--rozie-tiptap-count-padding, 0.25rem 0.625rem);
  border-top: var(--rozie-tiptap-count-border, 1px solid rgba(0, 0, 0, 0.08));
  font-size: var(--rozie-tiptap-count-font-size, 0.75rem);
  color: var(--rozie-tiptap-count-color, rgba(0, 0, 0, 0.5));
}
.rozie-tiptap-count-value.over[data-rozie-s-2aeee876] {
  color: var(--rozie-tiptap-count-over-color, #c0392b);
}
.rozie-tiptap-content .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: var(--rozie-tiptap-placeholder-color, rgba(0, 0, 0, 0.4));
    float: left;
    height: 0;
    pointer-events: none;
  }
.rozie-tiptap-link-editor {
    display: flex;
    align-items: center;
    gap: var(--rozie-tiptap-link-gap, 0.25rem);
    padding: var(--rozie-tiptap-link-padding, 0.3125rem 0.375rem);
    background: var(--rozie-tiptap-link-bg, #1a1a1a);
    border: var(--rozie-tiptap-link-border, 1px solid rgba(0, 0, 0, 0.2));
    border-radius: var(--rozie-tiptap-link-radius, 6px);
    box-shadow: var(--rozie-tiptap-link-shadow, 0 4px 16px rgba(0, 0, 0, 0.25));
  }
.rozie-tiptap-link-input {
    font: inherit;
    font-size: var(--rozie-tiptap-link-input-font-size, 0.8125rem);
    padding: var(--rozie-tiptap-link-input-padding, 0.1875rem 0.375rem);
    min-width: var(--rozie-tiptap-link-input-min-width, 11rem);
    border: var(--rozie-tiptap-link-input-border, 1px solid #444);
    border-radius: var(--rozie-tiptap-link-input-radius, 4px);
    background: var(--rozie-tiptap-link-input-bg, #fff);
    color: var(--rozie-tiptap-link-input-color, #000);
  }
.rozie-tiptap-link-editor button {
    font: inherit;
    font-size: var(--rozie-tiptap-link-button-font-size, 0.8125rem);
    padding: var(--rozie-tiptap-link-button-padding, 0.1875rem 0.5rem);
    border: var(--rozie-tiptap-link-button-border, 1px solid transparent);
    border-radius: var(--rozie-tiptap-link-button-radius, 4px);
    background: var(--rozie-tiptap-link-button-bg, rgba(255, 255, 255, 0.12));
    color: var(--rozie-tiptap-link-button-color, #fff);
    cursor: pointer;
  }
.rozie-tiptap-link-editor button:hover {
    background: var(--rozie-tiptap-link-button-hover-bg, rgba(255, 255, 255, 0.22));
  }
.rozie-tiptap-link-editor .rozie-tiptap-link-remove {
    color: var(--rozie-tiptap-link-remove-color, #ff9b9b);
  }`);

interface CountSlotCtx { characters: any; words: any; maxLength: any; over: any; }

interface ToolbarSlotCtx { editor: any; }

interface BubbleMenuSlotCtx { editor: any; }

interface FloatingMenuSlotCtx { editor: any; }

interface LinkEditorSlotCtx { editor: any; href: any; attrs: any; setLink: any; unsetLink: any; close: any; }

interface NodeViewSlotCtx { node: any; selected: any; updateAttributes: any; getPos: any; editor: any; contentDOM: any; }

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
  /**
   * A soft character-count threshold. `null` (default) registers NO CharacterCount extension and renders no counter — zero overhead. A number registers CharacterCount (gated — see `enforceMaxLength`) and renders a live `characters / maxLength` counter (overridable via the `#count` slot); once `$data.count.characters` exceeds it, the counter gets the `over` state. Overflow is still ALLOWED unless `enforceMaxLength` is also set.
   * @example
   * <TipTap :max-length="500" />
   */
  maxLength?: (number) | null;
  /**
   * Opts into a HARD cap at `maxLength` (negative-opt-out — `false` by default, soft mode). When `true` AND `maxLength` is set, CharacterCount is configured with `{ limit: maxLength }`, so ProseMirror itself refuses input past the limit — no overflow ever reaches the document. When `false` (default), the counter still tracks and surfaces the `over` state past `maxLength`, but typing/pasting is never blocked. Has no effect when `maxLength` is `null`.
   */
  enforceMaxLength?: boolean;
  /**
   * A custom `shouldShow` predicate for the GENERAL `bubbleMenu` slot — the TipTap signature `({ editor, view, state, oldState, from, to }) => boolean`. When provided, it REPLACES the general bubbleMenu's default predicate (show on a non-empty text selection), turning the `bubbleMenu` slot into a fully consumer-controllable selection-tooling surface (e.g. show only inside a table, or only for a specific mark). When `null` (default), the default non-empty-selection behavior applies. Orthogonal to the built-in link editor, which is its own bubble-menu surface with a link-aware trigger. NOTE: as a Function prop it lowers to a loosely-typed callable on some targets (React `any` / Angular `unknown`) — pass a correctly-typed predicate; the wrapper forwards it verbatim to `BubbleMenu.configure({ shouldShow })`.
   * @example
   * <TipTap :bubble-menu-should-show="({ editor }) => editor.isActive('table')"><template #bubbleMenu="{ editor }">…</template></TipTap>
   */
  bubbleMenuShouldShow?: ((...args: any[]) => any) | null;
  onUpdate?: (...args: unknown[]) => void;
  onSelectionUpdate?: (...args: unknown[]) => void;
  onFocus?: (...args: unknown[]) => void;
  onBlur?: (...args: unknown[]) => void;
  countSlot?: (ctx: CountSlotCtx) => JSX.Element;
  toolbarSlot?: (ctx: ToolbarSlotCtx) => JSX.Element;
  bubbleMenuSlot?: (ctx: BubbleMenuSlotCtx) => JSX.Element;
  floatingMenuSlot?: (ctx: FloatingMenuSlotCtx) => JSX.Element;
  linkEditorSlot?: (ctx: () => LinkEditorSlotCtx) => JSX.Element;
  nodeViewSlot?: (ctx: () => NodeViewSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: TipTapHandle) => void;
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
  getCharacterCount: (...args: any[]) => any;
  getWordCount: (...args: any[]) => any;
  openLinkEditor: (...args: any[]) => any;
}

export default function TipTap(_props: TipTapProps): JSX.Element {
  const _merged = mergeProps({ editable: true, placeholder: '', autofocus: false, editorClass: '', ariaLabel: 'Rich text editor', editorProps: (() => ({}))() as Record<string, any>, extensions: (() => [])() as any[], starterKit: (() => ({}))() as Record<string, any>, nodeSpecs: (() => [])() as any[], uploadImage: null, maxLength: null, enforceMaxLength: false, bubbleMenuShouldShow: null }, _props);
  const [local, attrs] = splitProps(_merged, ['html', 'editable', 'placeholder', 'autofocus', 'editorClass', 'ariaLabel', 'editorProps', 'extensions', 'starterKit', 'nodeSpecs', 'uploadImage', 'maxLength', 'enforceMaxLength', 'bubbleMenuShouldShow', 'ref']);
  onMount(() => { local.ref?.({ getEditor, focusEditor, blurEditor, getHTML, getJSON, getText, setContent, clearContent, toggleBold, toggleItalic, toggleHeading, toggleBulletList, toggleUnderline, toggleOrderedList, undo, redo, chain, isActive, can, isEmpty, getCharacterCount, getWordCount, openLinkEditor }); });

  const [html, setHtml] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'html', '<p>Start writing…</p>');
  const [active, setActive] = createSignal({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    bulletList: false,
    underline: false,
    orderedList: false,
    link: false
  });
  const [count, setCount] = createSignal({
    characters: 0,
    words: 0
  });
  const [link, setLink] = createSignal({
    href: '',
    attrs: {}
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
    bubbleMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
      const slot = _props.bubbleMenuSlot ?? _props.slots?.['bubbleMenu'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-bubbleMenu', '2aeee876');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    floatingMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
      const slot = _props.floatingMenuSlot ?? _props.slots?.['floatingMenu'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-floatingMenu', '2aeee876');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    linkEditor: (container: HTMLElement, scope: { editor: unknown; href: unknown; attrs: unknown; setLink: unknown; unsetLink: unknown; close: unknown }): ReactivePortalHandle => {
      const slot = _props.linkEditorSlot ?? _props.slots?.['linkEditor'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-linkEditor', '2aeee876');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { editor: unknown; href: unknown; attrs: unknown; setLink: unknown; unsetLink: unknown; close: unknown })), container);
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
    nodeView: (container: HTMLElement, scope: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): ReactivePortalHandle => {
      const slot = _props.nodeViewSlot ?? _props.slots?.['nodeView'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-nodeView', '2aeee876');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown })), container);
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
    // `nodeView` slot AND supplies one or more `nodeSpecs` (D-05 — BOTH halves
    // required). A stock <TipTap> with no nodeSpecs (or an unfilled slot) adds
    // NO custom nodes — zero overhead, no consumer-node-shaped parse rules
    // registered, no unused $portals.nodeView reference fired. $props.nodeSpecs is
    // read ONCE here (setup-once — NOT a $watch); $portals.nodeView is captured
    // here inside the mount body and passed into the node factory, keeping the
    // reference scoped to the mount lifecycle (the toolbar-slot discipline).
    const nodeViewExtensions = (_props.nodeViewSlot ?? _props.slots?.["nodeView"]) && local.nodeSpecs.length ? makeNodeViewExtensions(portals.nodeView, local.nodeSpecs) : [];

    // Placeholder ghost-text (G3). Read $props.placeholder ONCE at construction
    // (setup-once, like content/editable/autofocus — no reactivity required). The
    // Placeholder extension (@tiptap/extensions, version-matched to StarterKit)
    // adds class `is-editor-empty` + a `data-placeholder` attribute to the first
    // empty node; the `::before` rule in the `:root { }` engine-DOM escape hatch
    // (in the style block) paints the ghost text. Empty placeholder = no extension.
    const placeholderExtensions = local.placeholder ? [Placeholder.configure({
      placeholder: local.placeholder
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
    if ((_props.bubbleMenuSlot ?? _props.slots?.["bubbleMenu"])) {
      bubbleMenuEl = document.createElement('div');
      bubbleMenuEl.className = 'rozie-tiptap-bubble-menu';
    }
    if ((_props.floatingMenuSlot ?? _props.slots?.["floatingMenu"])) {
      floatingMenuEl = document.createElement('div');
      floatingMenuEl.className = 'rozie-tiptap-floating-menu';
    }
    // Link editor (#2) host — a dedicated, always-on (when editable) bubble-menu
    // surface, orthogonal to the general `bubbleMenu` slot. Created imperatively
    // (bubbleMenuEl discipline). Gated on editability — no link editing in readonly.
    if (local.editable) {
      linkEditorEl = document.createElement('div');
      linkEditorEl.className = 'rozie-tiptap-link-editor';
    }
    // Each BubbleMenu instance REQUIRES a unique pluginKey (REQ-41) so the two
    // Floating-UI plugins (the general bubbleMenu + the link editor) don't collide.
    // The general bubbleMenu's `shouldShow` is the consumer-controllable predicate
    // ($props.bubbleMenuShouldShow, #4) when provided, else the extension default
    // (non-empty text selection). The link editor's shouldShow is link-aware: show
    // on a link (edit) OR when the toolbar Link button set openFlag (create) — NARROW
    // by design so it never fires on a bare selection and collide with the general one.
    const menuExtensions = [...(bubbleMenuEl ? [BubbleMenu.configure({
      pluginKey: 'rozieBubbleMenu',
      element: bubbleMenuEl,
      ...(local.bubbleMenuShouldShow ? {
        shouldShow: local.bubbleMenuShouldShow
      } : {})
    })] : []), ...(floatingMenuEl ? [FloatingMenu.configure({
      element: floatingMenuEl
    })] : []), ...(linkEditorEl ? [BubbleMenu.configure({
      pluginKey: 'rozieLinkEditor',
      element: linkEditorEl,
      shouldShow: ({
        editor
      }: any) => editor.isActive('link') || openFlag
    })] : [])];

    // Image-upload hook (ask D). Setup-once, gated on $props.uploadImage — read
    // ONCE here (not a $watch — mirrors autofocus/placeholder/nodeSpecs). When
    // absent: no Image extension, no paste/drop handlers (zero overhead, the
    // unfilled-slot discipline). Conditional SPREAD (not `const x = []; x.push`)
    // for the same never[]-inference reason as placeholderExtensions/nodeViewExtensions.
    const imageExtensions = local.uploadImage ? [Image] : [];

    // Character/word count (D-01..D-03). Gated on maxLength being set OR the
    // `count` slot being filled — a stock <TipTap> with neither registers NO
    // CharacterCount extension (zero overhead, no VR drift). `limit` is ONLY
    // configured when BOTH enforceMaxLength is true AND maxLength is set (hard
    // cap); otherwise CharacterCount tracks with no limit (soft — overflow
    // allowed, surfaced via the `over` state). Setup-once, read here (NOT a
    // $watch). Conditional SPREAD (not `const x = []; x.push`) for the same
    // never[]-inference reason as placeholderExtensions/imageExtensions.
    const needsCount = local.maxLength != null || (_props.countSlot ?? _props.slots?.["count"]);
    const characterCountExtensions = needsCount ? [CharacterCount.configure(local.enforceMaxLength && local.maxLength != null ? {
      limit: local.maxLength ?? undefined
    } : {})] : [];

    // uploadHandlers — ProseMirror `editorProps` paste/drop fallbacks (D-04).
    // A SHALLOW gated reference object — `{}` (no-op) when $props.uploadImage
    // is unset, else shorthand-referencing the top-level handlePaste/handleDrop
    // functions declared above (see their doc comment for why they live at the
    // top level rather than as closures nested in this ternary).
    const uploadHandlers = local.uploadImage ? {
      handlePaste,
      handleDrop
    } : {};
    editor = new Editor({
      element: editorElRef,
      content: html(),
      editable: local.editable,
      autofocus: local.autofocus,
      // StarterKit first (config-disabled per the collision scan below); the
      // Placeholder ext next; the reactive node-view nodes next; consumer
      // extensions LAST so they win (TipTap applies later-registered extensions
      // over earlier ones for the same node/mark) — and the whole array is
      // name-deduped keeping the LAST occurrence as a safety net (D-03) on top
      // of the config-level auto-disable (D-02), which is what actually silences
      // StarterKit's internal same-named extension (e.g. its bundled `Link`).
      extensions: dedupeExtensionsByName([StarterKit.configure(buildStarterKitConfig(local.starterKit, local.extensions)), ...placeholderExtensions, ...nodeViewExtensions, ...menuExtensions, ...imageExtensions, ...characterCountExtensions, ...local.extensions]),
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
        // uploadImage paste/drop fallbacks (D-04) — spread BEFORE the consumer's
        // own editorProps so a consumer-supplied handlePaste/handleDrop wins.
        // `{}` (no-op) when $props.uploadImage is unset.
        ...uploadHandlers,
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
        refreshCount();
        refreshLink();
        _props.onUpdate?.(next);
      },
      onSelectionUpdate: () => {
        refreshActive();
        refreshLink();
        _props.onSelectionUpdate?.();
      },
      onFocus: () => _props.onFocus?.(),
      onBlur: () => _props.onBlur?.()
    });
    refreshActive();
    refreshCount();
    refreshLink();

    // `toolbar` portal slot — when the consumer fills it, mount their toolbar
    // fragment into the engine-adjacent host node, handing them the live editor
    // (their buttons call editor.chain().focus()…run()). $portals.toolbar is
    // referenced ONLY here inside $onMount (the per-target portal helper is scoped
    // to the mount lifecycle — a top-level reference would fail the bundled-leaf
    // strict typecheck, the FullCalendar/CodeMirror pattern). The host div is
    // r-if-gated on $slots.toolbar so $refs.toolbarEl exists exactly when filled.
    if ((_props.toolbarSlot ?? _props.slots?.["toolbar"]) && toolbarElRef) {
      toolbarDispose = portals.toolbar(toolbarElRef!, {
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

    // Link editor (#2) — mount the surface into its engine-managed host. When the
    // consumer fills `#linkEditor`, the REACTIVE portal renders their fragment
    // (re-rendered in place by refreshLink()'s handle.update() — Spike 016 proved
    // this survives the bubble-menu extension's detach-reattach). Otherwise the
    // component's own default form is built imperatively into the same host.
    // $portals.linkEditor is referenced ONLY here inside $onMount (portal discipline).
    if (linkEditorEl) {
      if ((_props.linkEditorSlot ?? _props.slots?.["linkEditor"])) {
        linkEditorHandle = portals.linkEditor(linkEditorEl, buildLinkScope());
      } else {
        buildDefaultLinkEditor(linkEditorEl);
      }
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    toolbarDispose?.();
    toolbarDispose = null;
    bubbleMenuDispose?.();
    bubbleMenuDispose = null;
    floatingMenuDispose?.();
    floatingMenuDispose = null;
    linkEditorHandle?.dispose();
    linkEditorHandle = null;
    linkEditorEl = null;
    linkInputEl = null;
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
    refreshCount();
    refreshLink();
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

  // ── Link editor (#2) surface. Its OWN dedicated bubble-menu instance (distinct
  // `pluginKey: 'rozieLinkEditor'`) with a link-aware trigger, orthogonal to the
  // general `bubbleMenu` slot. `linkEditorEl` is the imperatively-created host handed
  // to that BubbleMenu extension (the bubbleMenuEl discipline — engine owns
  // positioning). COMPONENT-scope for the same hoist reason as the menu els.
  //   - When the consumer fills the `#linkEditor` slot → `linkEditorHandle` is the
  //     REACTIVE portal handle ({ update, dispose }); refreshLink() re-renders it in
  //     place (Spike 016 proved a reactive portal survives the bubble-menu
  //     extension's element.remove()/appendChild detach-reattach cycles).
  //   - Otherwise → the component builds its OWN default form imperatively into
  //     `linkEditorEl` (`linkInputEl` = its URL <input>); refreshLink() imperatively
  //     refreshes the input value. Pure-script ⇒ byte-identical across all 6 targets,
  //     no framework-reconciliation risk, and no portal default-content (the emitter
  //     renders none for an unfilled portal slot).
  // `openFlag` = the toolbar Link button's create-mode trigger (set true on click,
  // cleared on Apply/Remove/Cancel/blur); the link-aware shouldShow shows the editor
  // when `editor.isActive('link')` (edit mode) OR `openFlag` (create mode).
  let linkEditorEl: any = null;
  let linkEditorHandle: any = null;
  let linkInputEl: any = null;
  let openFlag = false;

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
      bulletList: editor.isActive('bulletList'),
      underline: editor.isActive('underline'),
      orderedList: editor.isActive('orderedList'),
      link: editor.isActive('link')
    });
  }

  // ── Link editor (#2) command helpers + reactive refresh. TOP-LEVEL const arrows
  // (siblings of refreshActive/refreshCount) so every `editor` read sits at the same
  // shallow, proven-safe depth — never nested inside an object-literal method (the
  // redirectNestedThis gap [[project_emitter_redirect_nested_this_gap]]). The link
  // scope's setLink/unsetLink/close are these top-level fns, referenced by identity
  // from buildLinkScope so the consumer fragment (and the built-in form) call the
  // SAME verbs. `extendMarkRange('link')` widens the selection to the whole link so
  // an edit/removal applies to the entire mark, not just the caret word.
  //
  // DECLARATION ORDER IS LOAD-BEARING (topological, leaves first): apply/remove/close
  // → buildLinkScope → refreshLink → openLinkEditor. The React/Solid/Lit emitters lift
  // reactive closures into useCallback/memo with eager dependency ARRAYS, so a forward
  // reference to a later-declared reactive const is a hard TS2448 (use-before-decl) —
  // unlike a deferred function BODY, which is fine. apply/removeLink therefore do NOT
  // call refreshLink (which would make them depend on it and re-introduce a cycle):
  // the setLink/unsetLink chain dispatches a transaction that fires onSelectionUpdate +
  // onUpdate, both of which already call refreshLink. Only openLinkEditor (safely last)
  // calls it, for immediate prefill on the create affordance.
  function applyLink(attrs: any) {
    editor?.chain().focus().extendMarkRange('link').setLink(attrs).run();
    openFlag = false;
  }
  function removeLink() {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    openFlag = false;
  }
  function closeLink() {
    openFlag = false;
    editor?.commands.focus();
  }
  // The reactive `#linkEditor` slot scope — keys EXACTLY { editor, href, attrs,
  // setLink, unsetLink, close } (spec §5.3). `attrs` is the raw link mark attrs
  // object so a consumer can read custom attrs (e.g. data-course-link); setLink
  // forwards whatever attrs object it is handed VERBATIM (REQ-42 — persistence of a
  // custom attr is the consumer's Link.extend concern, not this wrapper's).
  function buildLinkScope() {
    return {
      editor,
      href: link().href,
      attrs: link().attrs,
      setLink: applyLink,
      unsetLink: removeLink,
      close: closeLink
    };
  }
  // Recompute link state from the live editor + drive the surface. Called from
  // onSelectionUpdate + onUpdate (and after content sets). When the consumer slot is
  // filled, re-render the reactive portal in place; otherwise refresh the built-in
  // form's input value — but NOT while the user is typing in it (don't stomp mid-edit).
  function refreshLink() {
    if (!editor) return;
    const a = editor.getAttributes('link');
    setLink({
      href: a.href || '',
      attrs: a
    });
    if (linkEditorHandle) {
      linkEditorHandle.update(buildLinkScope());
    } else if (linkInputEl && document.activeElement !== linkInputEl) {
      linkInputEl.value = a.href || '';
    }
  }
  // Toolbar Link button (create affordance, ask C's deferred button): flip the
  // open flag so the link-aware shouldShow surfaces the editor on the current
  // selection, prefilled with any existing href. Declared AFTER refreshLink so its
  // reactive dep array references an already-declared const (see order note above).
  function openLinkEditor() {
    openFlag = true;
    editor?.commands.focus();
    refreshLink();
  }
  // Build the batteries-included default link-editor form imperatively into the
  // engine-managed host (the bubble-menu extension owns positioning). Vanilla DOM
  // so it is byte-identical across all 6 targets and the framework never reconciles
  // it. Enter = Apply, Escape = Cancel. Used ONLY when the `#linkEditor` slot is
  // unfilled; a filled slot renders the consumer fragment via the reactive portal.
  function buildDefaultLinkEditor(el: any) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rozie-tiptap-link-input';
    input.placeholder = 'https://…';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'rozie-tiptap-link-apply';
    apply.textContent = 'Apply';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'rozie-tiptap-link-remove';
    remove.textContent = 'Remove';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'rozie-tiptap-link-cancel';
    cancel.textContent = 'Cancel';
    // Keep the caret/selection in the document when a control is pressed (a plain
    // click would blur the editor and collapse the selection before the command runs).
    const keepFocus = (e: any) => e.preventDefault();
    for (const b of [apply, remove, cancel] as any) b.addEventListener('mousedown', keepFocus);
    apply.addEventListener('click', () => applyLink({
      href: input.value
    }));
    remove.addEventListener('click', removeLink);
    cancel.addEventListener('click', closeLink);
    input.addEventListener('keydown', (e: any) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyLink({
          href: input.value
        });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeLink();
      }
    });
    el.appendChild(input);
    el.appendChild(apply);
    el.appendChild(remove);
    el.appendChild(cancel);
    linkInputEl = input;
  }

  // Recompute the character/word counter from the live editor (D-05). Robust to
  // CharacterCount being absent (maxLength unset, no #count slot): reads
  // `editor.storage.characterCount` when the extension is registered, else falls
  // back to a plain text derivation so `getCharacterCount`/`getWordCount` and the
  // #count slot's numbers are never stale.
  function refreshCount() {
    if (!editor) return;
    const storage = editor.storage.characterCount;
    setCount({
      characters: storage ? storage.characters() : editor.getText().length,
      words: storage ? storage.words() : editor.getText().split(/\s+/).filter(Boolean).length
    });
  }

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
  function buildStarterKitConfig(userConfig: any, exts: any) {
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
  }

  // Pure helper — D-03 last-wins safety net over the FINAL assembled extension
  // array. Dedupes by `.name`, keeping the LAST occurrence (later = consumer).
  // A nameless/unnamed entry is never collapsed against another nameless entry
  // — each survives, keyed by a per-entry unique fallback rather than a shared
  // `undefined` key.
  function dedupeExtensionsByName(exts: any) {
    const byKey = new Map();
    let anonSeq = 0;
    for (const ext of exts as any) {
      const name = ext && typeof ext === 'object' ? ext.name : undefined;
      const key = typeof name === 'string' ? name : `__rozie_anon_${anonSeq++}`;
      byKey.set(key, ext);
    }
    return [...byKey.values()];
  }

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

  // Pure helper (ask B, D-02) — extracts { el, attr, value } from a parseHTML
  // tag selector string, e.g. 'span[data-x]' → { el: 'span', attr: 'data-x',
  // value: '' } or 'div[data-x=y]' → { el: 'div', attr: 'data-x', value: 'y' }.
  // Drives renderHTML's marker attribute so the serialized element reproduces
  // the exact shape the parseHTML rule expects. MUST NOT throw on a
  // malformed/empty selector (T-d9e-01 — a bad selector degrades only that one
  // node's render, never crashes the editor): falls back to el = the raw
  // selector (or 'span' if falsy), attr = null (no marker), value = ''.
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

  // Build ONE custom Node per consumer-supplied spec, all bound to the SAME
  // reactive nodeView portal (ask B, D-02). Takes the per-target
  // `$portals.nodeView` (captured here so the reference stays inside the mount
  // lifecycle — never top-level, per the bundled-leaf typecheck rule) and the
  // `nodeSpecs` prop array (read once at mount — setup-once, not reactive).
  function makeNodeViewExtensions(nv: any, specs: any) {
    return specs.map((spec: any) => {
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
  }

  // Shared image-file finder for the upload handlers below — the first
  // `image/*` File in a FileList, else undefined. Guards a missing FileList.
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
    const upload = local.uploadImage;
    if (!upload) return false;
    const file = findImageFile(event.clipboardData ? event.clipboardData.files : undefined);
    if (!file) return false;
    event.preventDefault();
    upload(file).then((url: any) => {
      editor?.chain().focus().setImage({
        src: url
      }).run();
    }).catch(() => {});
    return true;
  }
  function handleDrop(view: any, event: any, slice: any, moved: any) {
    if (moved) return false;
    // See handlePaste — local capture for the same cross-target null-narrowing.
    const upload = local.uploadImage;
    if (!upload) return false;
    const file = findImageFile(event.dataTransfer ? event.dataTransfer.files : undefined);
    if (!file) return false;
    event.preventDefault();
    const pos = view.posAtCoords({
      left: event.clientX,
      top: event.clientY
    });
    upload(file).then((url: any) => {
      const insertPos = pos ? pos.pos : editor ? editor.state.selection.head : 0;
      editor?.chain().focus().insertContentAt(insertPos, {
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
    setHtml(v);
    refreshActive();
    refreshCount();
    refreshLink();
  }
  function clearContent() {
    if (!editor) return;
    editor.commands.clearContent();
    lastHtml = editor.getHTML();
    setHtml(lastHtml);
    refreshActive();
    refreshCount();
    refreshLink();
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
  // Character/word count reads (D-04). Prefer the CharacterCount extension's live
  // storage when registered (maxLength set or #count slot filled); otherwise a
  // text-based fallback so these ALWAYS return a number — 0 before mount, and a
  // correct count even on a stock <TipTap> that never registered CharacterCount.
  function getCharacterCount() {
    if (!editor) return 0;
    return editor.storage.characterCount ? editor.storage.characterCount.characters() : editor.getText().length;
  }
  function getWordCount() {
    if (!editor) return 0;
    return editor.storage.characterCount ? editor.storage.characterCount.words() : editor.getText().split(/\s+/).filter(Boolean).length;
  }

  return (
    <>
    <div class={"rozie-tiptap" + " " + rozieClass({ 'is-readonly': !local.editable })} data-rozie-s-2aeee876="">
      
      {<Show when={local.editable && !(_props.toolbarSlot ?? _props.slots?.['toolbar'])}><div class={"rozie-tiptap-toolbar"} data-rozie-s-2aeee876="">
        <button type="button" aria-label="Bold" class={rozieClass({ active: active().bold })} onClick={toggleBold} data-rozie-s-2aeee876=""><strong data-rozie-s-2aeee876="">B</strong></button>
        <button type="button" aria-label="Italic" class={rozieClass({ active: active().italic })} onClick={toggleItalic} data-rozie-s-2aeee876=""><em data-rozie-s-2aeee876="">I</em></button>
        <span class={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" aria-label="Heading 1" class={rozieClass({ active: active().h1 })} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { toggleHeading(1); }} data-rozie-s-2aeee876="">H1</button>
        <button type="button" aria-label="Heading 2" class={rozieClass({ active: active().h2 })} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { toggleHeading(2); }} data-rozie-s-2aeee876="">H2</button>
        <span class={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" aria-label="Bullet list" class={rozieClass({ active: active().bulletList })} onClick={toggleBulletList} data-rozie-s-2aeee876="">• List</button>
        <button type="button" aria-label="Underline" class={rozieClass({ active: active().underline })} onClick={toggleUnderline} data-rozie-s-2aeee876=""><u data-rozie-s-2aeee876="">U</u></button>
        <button type="button" aria-label="Ordered list" class={rozieClass({ active: active().orderedList })} onClick={toggleOrderedList} data-rozie-s-2aeee876="">1. List</button>
        <span class={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" aria-label="Link" class={rozieClass({ active: active().link })} onClick={openLinkEditor} data-rozie-s-2aeee876="">Link</button>
        <span class={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" aria-label="Undo" onClick={undo} data-rozie-s-2aeee876="">↺</button>
        <button type="button" aria-label="Redo" onClick={redo} data-rozie-s-2aeee876="">↻</button>
      </div></Show>}{<Show when={local.editable && (_props.toolbarSlot ?? _props.slots?.['toolbar'])}><div class={"rozie-tiptap-toolbar rozie-tiptap-toolbar--slot"} ref={(el) => { toolbarElRef = el as HTMLElement; }} data-rozie-s-2aeee876="" /></Show>}<div ref={(el) => { editorElRef = el as HTMLElement; }} class={"rozie-tiptap-content"} data-placeholder={local.placeholder} data-rozie-s-2aeee876="" />
      
      {<Show when={local.maxLength != null || (_props.countSlot ?? _props.slots?.['count'])}><div class={"rozie-tiptap-count"} data-rozie-s-2aeee876="">
        {(_props.countSlot ?? _props.slots?.['count'])?.({ characters: count().characters, words: count().words, maxLength: local.maxLength, over: local.maxLength != null && count().characters > local.maxLength }) ?? <span class={"rozie-tiptap-count-value" + " " + rozieClass({ over: local.maxLength != null && count().characters > local.maxLength })} data-rozie-s-2aeee876="">{rozieDisplay(count().characters)} / {local.maxLength}</span>}
      </div></Show>}</div>









    </>
  );
}
