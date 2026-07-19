import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface TipTapProps {
  /**
   * The editor's document content as an HTML string — the sole `model: true` prop (two-way `r-model`). Typing writes the new HTML back through the model path (TipTap's `onUpdate`); a consumer write reflects into the live document, echo-guarded so a programmatic set does not reset the selection or re-emit `update`.
   * @example
   * <TipTap r-model:html="content" placeholder="Start writing…" />
   */
  html?: string;
  defaultHtml?: string;
  onHtmlChange?: (next: string) => void;
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
  editorProps?: Record<string, unknown>;
  /**
   * Extra TipTap extensions composed onto `StarterKit` — the consumer-extensibility passthrough (Link, Image, Mention, custom nodes/marks, …). Consumer extensions genuinely win for a StarterKit-bundled node or mark: a same-named custom extension (e.g. a custom `Link`) auto-disables the corresponding StarterKit key (unless explicitly configured via `starterKit`), and the final extension array is name-deduped keeping the last (consumer) occurrence — so a custom Link/Underline/OrderedList replaces StarterKit's without a "Duplicate extension names" warning.
   */
  extensions?: unknown[];
  /**
   * StarterKit config passthrough — spread into `StarterKit.configure(...)`. Accepts per-extension option objects or `false` to disable an extension, e.g. `{ heading:false }`, `{ heading:{ levels:[1,2] } }`, `{ link:false }`. A StarterKit-bundled node/mark is auto-disabled when a same-named custom extension is supplied via `extensions`; an explicitly-set key here is always respected and never overridden by that auto-disable scan.
   */
  starterKit?: Record<string, unknown>;
  /**
   * Custom ProseMirror node registration for the reactive `nodeView` portal slot — general facility, read ONCE at mount (setup-once construction, not reactive). Each entry: `{ name, tag, group, inline, atom, content, selectable, defining, attrs }` — `name` (required, unique node name), `tag` (required, parseHTML selector string | string[]), `group` (default `'block'`), `inline` (default `false`), `atom` (default `false` — no contentDOM), `content` (e.g. `'inline*'`; presence ⇒ the node gets an editable contentDOM), `selectable` (default `true`), `defining` (default `false`), `attrs` (`{ key: { default } }`, ProseMirror `addAttributes` shape). One `Node.create` is built per entry; all render through the SAME `nodeView` fragment, which dispatches on `scope.node.type.name`. An empty array (default) registers no custom nodes — zero overhead.
   * @example
   * <TipTap :node-specs="[{ name: 'mention', tag: 'span[data-mention]', group: 'inline', inline: true, atom: true, attrs: { id: { default: null } } }]"><template #nodeView="{ node }">…</template></TipTap>
   */
  nodeSpecs?: unknown[];
  onUpdate?: (...args: unknown[]) => void;
  onSelectionUpdate?: (...args: unknown[]) => void;
  onFocus?: (...args: unknown[]) => void;
  onBlur?: (...args: unknown[]) => void;
  renderToolbar?: (params: { editor: () => void }) => ReactNode;
  renderBubbleMenu?: (params: { editor: () => void }) => ReactNode;
  renderFloatingMenu?: (params: { editor: () => void }) => ReactNode;
  renderNodeView?: (params: { node: () => void; selected: () => void; updateAttributes: () => void; getPos: () => void; editor: () => void; contentDOM: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
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

declare const TipTap: React.ForwardRefExoticComponent<TipTapProps & React.RefAttributes<TipTapHandle>>;
export default TipTap;
