import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { adoptDocumentStyles, createLitControllableProperty, injectGlobalStyles } from '@rozie/runtime-lit';
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

interface RozieToolbarSlotCtx {
  editor: any;
}

interface RozieBubbleMenuSlotCtx {
  editor: any;
}

interface RozieFloatingMenuSlotCtx {
  editor: any;
}

interface RozieNodeViewSlotCtx {
  node: any;
  selected: any;
  updateAttributes: any;
  getPos: any;
  editor: any;
  contentDOM: any;
}

@customElement('rozie-tip-tap')
export default class TipTap extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
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
.rozie-tiptap-content .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: rgba(0, 0, 0, 0.4);
    float: left;
    height: 0;
    pointer-events: none;
  }
`;

  /**
   * The editor's document content as an HTML string — the sole `model: true` prop (two-way `r-model`). Typing writes the new HTML back through the model path (TipTap's `onUpdate`); a consumer write reflects into the live document, echo-guarded so a programmatic set does not reset the selection or re-emit `update`.
   * @example
   * <TipTap r-model:html="content" placeholder="Start writing…" />
   */
  @property({ type: String, attribute: 'html' }) _html_attr: string = '<p>Start writing…</p>';
  private _htmlControllable = createLitControllableProperty<string>({ host: this, eventName: 'html-change', defaultValue: '<p>Start writing…</p>', initialControlledValue: undefined });
  /**
   * Whether the document is editable. Toggling it calls TipTap's `setEditable` with `emitUpdate: false` (no spurious `update`). When `false`, the internal toolbar is hidden and the wrapper gets an `is-readonly` class.
   */
  @property({ type: Boolean, reflect: true }) editable: boolean = true;
  /**
   * Placeholder text, forwarded to the editor host as `data-placeholder` + `aria-placeholder` and painted as ghost text on the first empty node via the bundled Placeholder extension. An empty string adds no placeholder.
   */
  @property({ type: String, reflect: true }) placeholder: string = '';
  /**
   * Whether to place the caret in the document on mount (TipTap's `autofocus` option).
   */
  @property({ type: Boolean, reflect: true }) autofocus: boolean = false;
  /**
   * A CSS class applied to the contenteditable element (`editorProps.attributes.class`).
   */
  @property({ type: String, reflect: true }) editorClass: string = '';
  /**
   * The accessible name (`aria-label`) applied to the contenteditable element.
   */
  @property({ type: String, reflect: true }) ariaLabel: string = 'Rich text editor';
  /**
   * ProseMirror `editorProps` passthrough — `handleKeyDown`, `handlePaste`, a custom `attributes`, etc. Spread **last** so consumer `editorProps` win the wrapper's attribute defaults.
   */
  @property({ type: Object }) editorProps: any = {};
  /**
   * Extra TipTap extensions composed onto `StarterKit` — the consumer-extensibility passthrough (Link, Image, Mention, custom nodes/marks, …). Consumer extensions genuinely win for a StarterKit-bundled node or mark: a same-named custom extension (e.g. a custom `Link`) auto-disables the corresponding StarterKit key (unless explicitly configured via `starterKit`), and the final extension array is name-deduped keeping the last (consumer) occurrence — so a custom Link/Underline/OrderedList replaces StarterKit's without a "Duplicate extension names" warning.
   */
  @property({ type: Array }) extensions: any[] = [];
  /**
   * StarterKit config passthrough — spread into `StarterKit.configure(...)`. Accepts per-extension option objects or `false` to disable an extension, e.g. `{ heading:false }`, `{ heading:{ levels:[1,2] } }`, `{ link:false }`. A StarterKit-bundled node/mark is auto-disabled when a same-named custom extension is supplied via `extensions`; an explicitly-set key here is always respected and never overridden by that auto-disable scan.
   */
  @property({ type: Object }) starterKit: any = {};
  private _active = signal({
  bold: false,
  italic: false,
  h1: false,
  h2: false,
  bulletList: false
});
  @query('[data-rozie-ref="toolbarEl"]') private _refToolbarEl!: HTMLElement;
  @query('[data-rozie-ref="editorEl"]') private _refEditorEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();

  @state() private _hasSlotToolbar = false;
  @queryAssignedElements({ slot: 'toolbar', flatten: true }) private _slotToolbarElements!: Element[];
  @property({ attribute: false }) toolbar?: (scope: { editor: any }) => unknown;
  @state() private _hasSlotBubbleMenu = false;
  @queryAssignedElements({ slot: 'bubbleMenu', flatten: true }) private _slotBubbleMenuElements!: Element[];
  @property({ attribute: false }) bubbleMenu?: (scope: { editor: any }) => unknown;
  @state() private _hasSlotFloatingMenu = false;
  @queryAssignedElements({ slot: 'floatingMenu', flatten: true }) private _slotFloatingMenuElements!: Element[];
  @property({ attribute: false }) floatingMenu?: (scope: { editor: any }) => unknown;
  @state() private _hasSlotNodeView = false;
  @queryAssignedElements({ slot: 'nodeView', flatten: true }) private _slotNodeViewElements!: Element[];
  @property({ attribute: false }) nodeView?: (scope: { node: any; selected: any; updateAttributes: any; getPos: any; editor: any; contentDOM: any }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="toolbar"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotToolbar = this._slotToolbarElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="bubbleMenu"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotBubbleMenu = this._slotBubbleMenuElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="floatingMenu"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotFloatingMenu = this._slotFloatingMenuElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="nodeView"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotNodeView = this._slotNodeViewElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotToolbar = Array.from(this.children).some((el) => el.getAttribute('slot') === 'toolbar');
    this._hasSlotBubbleMenu = Array.from(this.children).some((el) => el.getAttribute('slot') === 'bubbleMenu');
    this._hasSlotFloatingMenu = Array.from(this.children).some((el) => el.getAttribute('slot') === 'floatingMenu');
    this._hasSlotNodeView = Array.from(this.children).some((el) => el.getAttribute('slot') === 'nodeView');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    adoptDocumentStyles(this);

    this._armListeners();

    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      toolbar: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
        const tpl = this.toolbar;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-toolbar', '2aeee876');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      bubbleMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
        const tpl = this.bubbleMenu;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-bubbleMenu', '2aeee876');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      floatingMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
        const tpl = this.floatingMenu;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-floatingMenu', '2aeee876');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      nodeView: (container: HTMLElement, scope: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): ReactivePortalHandle => {
        const tpl = this.nodeView;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-nodeView', '2aeee876');
        const renderScope = (s: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
    };

    this._disconnectCleanups.push((() => {
      this.toolbarDispose?.();
      this.toolbarDispose = null;
      this.bubbleMenuDispose?.();
      this.bubbleMenuDispose = null;
      this.floatingMenuDispose?.();
      this.floatingMenuDispose = null;
      this.editor?.destroy();
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.html)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (!this.editor) return;
      if (v === this.lastHtml) return;
      this.lastHtml = v;
      this.editor.commands.setContent(v, {
        emitUpdate: false
      });
      this.refreshActive();
    })(__watchVal); }); }));

    this.lastHtml = this.html;

    // Register the reactive node-view nodes ONLY when the consumer fills the
    // `nodeView` slot — an unfilled slot adds no custom nodes (zero overhead, no
    // unused $portals.nodeView reference fired). $portals.nodeView is captured
    // here inside the mount body and passed into the node factory, keeping the
    // reference scoped to the mount lifecycle (the toolbar-slot discipline).
    // Register the reactive node-view nodes ONLY when the consumer fills the
    // `nodeView` slot — an unfilled slot adds no custom nodes (zero overhead, no
    // unused $portals.nodeView reference fired). $portals.nodeView is captured
    // here inside the mount body and passed into the node factory, keeping the
    // reference scoped to the mount lifecycle (the toolbar-slot discipline).
    const nodeViewExtensions = this.nodeView !== undefined ? this.makeNodeViewExtensions(portals.nodeView) : [];

    // Placeholder ghost-text (G3). Read $props.placeholder ONCE at construction
    // (setup-once, like content/editable/autofocus — no reactivity required). The
    // Placeholder extension (@tiptap/extensions, version-matched to StarterKit)
    // adds class `is-editor-empty` + a `data-placeholder` attribute to the first
    // empty node; the `::before` rule in the `:root { }` engine-DOM escape hatch
    // (in the style block) paints the ghost text. Empty placeholder = no extension.
    // Placeholder ghost-text (G3). Read $props.placeholder ONCE at construction
    // (setup-once, like content/editable/autofocus — no reactivity required). The
    // Placeholder extension (@tiptap/extensions, version-matched to StarterKit)
    // adds class `is-editor-empty` + a `data-placeholder` attribute to the first
    // empty node; the `::before` rule in the `:root { }` engine-DOM escape hatch
    // (in the style block) paints the ghost text. Empty placeholder = no extension.
    const placeholderExtensions = this.placeholder ? [Placeholder.configure({
      placeholder: this.placeholder
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
    if (this.bubbleMenu !== undefined) {
      this.bubbleMenuEl = document.createElement('div');
      this.bubbleMenuEl.className = 'rozie-tiptap-bubble-menu';
    }
    if (this.floatingMenu !== undefined) {
      this.floatingMenuEl = document.createElement('div');
      this.floatingMenuEl.className = 'rozie-tiptap-floating-menu';
    }
    const menuExtensions = [...(this.bubbleMenuEl ? [BubbleMenu.configure({
      element: this.bubbleMenuEl
    })] : []), ...(this.floatingMenuEl ? [FloatingMenu.configure({
      element: this.floatingMenuEl
    })] : [])];
    this.editor = new Editor({
      element: this._refEditorEl,
      content: this.html,
      editable: this.editable,
      autofocus: this.autofocus,
      // StarterKit first (config-disabled per the collision scan below); the
      // Placeholder ext next; the reactive node-view nodes next; consumer
      // extensions LAST so they win (TipTap applies later-registered extensions
      // over earlier ones for the same node/mark) — and the whole array is
      // name-deduped keeping the LAST occurrence as a safety net (D-03) on top
      // of the config-level auto-disable (D-02), which is what actually silences
      // StarterKit's internal same-named extension (e.g. its bundled `Link`).
      extensions: this.dedupeExtensionsByName([StarterKit.configure(this.buildStarterKitConfig(this.starterKit, this.extensions)), ...placeholderExtensions, ...nodeViewExtensions, ...menuExtensions, ...this.extensions]),
      editorProps: {
        attributes: {
          'aria-label': this.ariaLabel,
          ...(this.editorClass ? {
            class: this.editorClass
          } : {}),
          ...(this.placeholder ? {
            'data-placeholder': this.placeholder,
            'aria-placeholder': this.placeholder
          } : {})
        },
        // Consumer editorProps spread LAST — full ProseMirror editorProps control
        // (handleKeyDown, handlePaste, a custom `attributes`, …) wins.
        ...this.editorProps
      },
      onUpdate: ({
        editor
      }: any) => {
        const next = editor.getHTML();
        this.lastHtml = next;
        // Round-trip guard — see CodeMirror/Flatpickr for the same shape.
        if (next !== this.html) this._htmlControllable.write(next);
        this.dispatchEvent(new CustomEvent("update", {
          detail: next,
          bubbles: true,
          composed: true
        }));
      },
      onSelectionUpdate: () => {
        this.refreshActive();
        this.dispatchEvent(new CustomEvent("selectionUpdate", {
          detail: undefined,
          bubbles: true,
          composed: true
        }));
      },
      onFocus: () => this.dispatchEvent(new CustomEvent("focus", {
        detail: undefined,
        bubbles: true,
        composed: true
      })),
      onBlur: () => this.dispatchEvent(new CustomEvent("blur", {
        detail: undefined,
        bubbles: true,
        composed: true
      }))
    });
    this.refreshActive();

    // `toolbar` portal slot — when the consumer fills it, mount their toolbar
    // fragment into the engine-adjacent host node, handing them the live editor
    // (their buttons call editor.chain().focus()…run()). $portals.toolbar is
    // referenced ONLY here inside $onMount (the per-target portal helper is scoped
    // to the mount lifecycle — a top-level reference would fail the bundled-leaf
    // strict typecheck, the FullCalendar/CodeMirror pattern). The host div is
    // r-if-gated on $slots.toolbar so $refs.toolbarEl exists exactly when filled.
    // `toolbar` portal slot — when the consumer fills it, mount their toolbar
    // fragment into the engine-adjacent host node, handing them the live editor
    // (their buttons call editor.chain().focus()…run()). $portals.toolbar is
    // referenced ONLY here inside $onMount (the per-target portal helper is scoped
    // to the mount lifecycle — a top-level reference would fail the bundled-leaf
    // strict typecheck, the FullCalendar/CodeMirror pattern). The host div is
    // r-if-gated on $slots.toolbar so $refs.toolbarEl exists exactly when filled.
    if (this.toolbar !== undefined && this._refToolbarEl) {
      this.toolbarDispose = portals.toolbar(this._refToolbarEl, {
        editor: this.editor
      });
    }

    // `bubbleMenu` / `floatingMenu` portal slots — mount the consumer's menu
    // fragment into the engine-owned (imperatively-created) host element handed to
    // the Floating-UI menu extension, with the live editor in scope (their buttons
    // call editor.chain().focus()…run()). Like toolbar/nodeView, $portals.bubbleMenu
    // / $portals.floatingMenu are referenced ONLY inside $onMount (the bundled-leaf
    // strict-typecheck discipline). The element is created above only when the slot
    // is filled, so each portal fires exactly when its slot exists.
    // `bubbleMenu` / `floatingMenu` portal slots — mount the consumer's menu
    // fragment into the engine-owned (imperatively-created) host element handed to
    // the Floating-UI menu extension, with the live editor in scope (their buttons
    // call editor.chain().focus()…run()). Like toolbar/nodeView, $portals.bubbleMenu
    // / $portals.floatingMenu are referenced ONLY inside $onMount (the bundled-leaf
    // strict-typecheck discipline). The element is created above only when the slot
    // is filled, so each portal fires exactly when its slot exists.
    if (this.bubbleMenuEl) {
      this.bubbleMenuDispose = portals.bubbleMenu(this.bubbleMenuEl, {
        editor: this.editor
      });
    }
    if (this.floatingMenuEl) {
      this.floatingMenuDispose = portals.floatingMenu(this.floatingMenuEl, {
        editor: this.editor
      });
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('editable'))) { const __watchVal = (() => this.editable)(); ((v: any) => this.editor?.setEditable(v, false))(__watchVal); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const container of this._portalContainers) render(nothing, container);
      this._portalContainers.clear();
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'html') this._htmlControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-tiptap": true, 'is-readonly': !this.editable }).filter(([, v]) => v).map(([k]) => k).join(' ')}" data-rozie-s-2aeee876>
  
  ${this.editable && !(this.toolbar !== undefined) ? html`<div class="rozie-tiptap-toolbar" data-rozie-s-2aeee876>
    <button class="${Object.entries({ active: this._active.value.bold }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-label="Bold" @click=${this.toggleBold} data-rozie-s-2aeee876><strong data-rozie-s-2aeee876>B</strong></button>
    <button class="${Object.entries({ active: this._active.value.italic }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-label="Italic" @click=${this.toggleItalic} data-rozie-s-2aeee876><em data-rozie-s-2aeee876>I</em></button>
    <span class="sep" data-rozie-s-2aeee876></span>
    <button class="${Object.entries({ active: this._active.value.h1 }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-label="Heading 1" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.toggleHeading(1); }} data-rozie-s-2aeee876>H1</button>
    <button class="${Object.entries({ active: this._active.value.h2 }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-label="Heading 2" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.toggleHeading(2); }} data-rozie-s-2aeee876>H2</button>
    <span class="sep" data-rozie-s-2aeee876></span>
    <button class="${Object.entries({ active: this._active.value.bulletList }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-label="Bullet list" @click=${this.toggleBulletList} data-rozie-s-2aeee876>• List</button>
  </div>` : nothing}${this.editable && this.toolbar !== undefined ? html`<div class="rozie-tiptap-toolbar rozie-tiptap-toolbar--slot" data-rozie-ref="toolbarEl" data-rozie-s-2aeee876></div>` : nothing}<div class="rozie-tiptap-content" data-placeholder=${this.placeholder} data-rozie-ref="editorEl" data-rozie-s-2aeee876></div>
</div>

<slot name="toolbar"></slot>

<slot name="bubbleMenu"></slot>
<slot name="floatingMenu"></slot>

<slot name="nodeView"></slot>
`;
  }

  editor: any = null;

  lastHtml: any = null;

  toolbarDispose: any = null;

  bubbleMenuEl: any = null;

  bubbleMenuDispose: any = null;

  floatingMenuEl: any = null;

  floatingMenuDispose: any = null;

  refreshActive = () => {
  if (!this.editor) return;
  this._active.value = {
    bold: this.editor.isActive('bold'),
    italic: this.editor.isActive('italic'),
    h1: this.editor.isActive('heading', {
      level: 1
    }),
    h2: this.editor.isActive('heading', {
      level: 2
    }),
    bulletList: this.editor.isActive('bulletList')
  };
};

  STARTERKIT_COLLISION_MAP = {
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

  buildStarterKitConfig = (userConfig: any, exts: any) => {
  const effective = {
    ...userConfig
  };
  for (const ext of exts as any) {
    const name = ext && typeof ext === 'object' ? ext.name : undefined;
    if (typeof name !== 'string') continue;
    const optionKey = this.STARTERKIT_COLLISION_MAP[name];
    if (optionKey && !(optionKey in effective)) effective[optionKey] = false;
  }
  return effective;
};

  dedupeExtensionsByName = (exts: any) => {
  const byKey = new Map();
  let anonSeq = 0;
  for (const ext of exts as any) {
    const name = ext && typeof ext === 'object' ? ext.name : undefined;
    const key = typeof name === 'string' ? name : `__rozie_anon_${anonSeq++}`;
    byKey.set(key, ext);
  }
  return [...byKey.values()];
};

  makeNodeView = (nv: any, editable: any) => (props: any) => {
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

  makeNodeViewExtensions = (nv: any) => {
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
    addNodeView: () => this.makeNodeView(nv, false)
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
    addNodeView: () => this.makeNodeView(nv, true)
  });
  return [Mention, Callout];
};

  getEditor() {
    return this.editor;
  }

  focusEditor() {
    this.editor?.commands.focus();
  }

  blurEditor() {
    this.editor?.commands.blur();
  }

  getHTML() {
    return this.editor ? this.editor.getHTML() : '';
  }

  getJSON() {
    return this.editor ? this.editor.getJSON() : null;
  }

  getText() {
    return this.editor ? this.editor.getText() : '';
  }

  setContent(next: any) {
    if (!this.editor) return;
    const v = next ?? '';
    if (v === this.lastHtml) return;
    this.lastHtml = v;
    this.editor.commands.setContent(v, {
      emitUpdate: false
    });
    this._htmlControllable.write(v);
    this.refreshActive();
  }

  clearContent() {
    if (!this.editor) return;
    this.editor.commands.clearContent();
    this.lastHtml = this.editor.getHTML();
    this._htmlControllable.write(this.lastHtml);
    this.refreshActive();
  }

  toggleBold() {
    this.editor?.chain().focus().toggleBold().run();
    this.refreshActive();
  }

  toggleItalic() {
    this.editor?.chain().focus().toggleItalic().run();
    this.refreshActive();
  }

  toggleHeading(level: any) {
    this.editor?.chain().focus().toggleHeading({
      level: level ?? 1
    }).run();
    this.refreshActive();
  }

  toggleBulletList() {
    this.editor?.chain().focus().toggleBulletList().run();
    this.refreshActive();
  }

  undo() {
    this.editor?.chain().focus().undo().run();
    this.refreshActive();
  }

  redo() {
    this.editor?.chain().focus().redo().run();
    this.refreshActive();
  }

  chain() {
    return this.editor ? this.editor.chain().focus() : null;
  }

  isActive(name: any, attrs: any) {
    return this.editor ? this.editor.isActive(name, attrs) : false;
  }

  can() {
    return this.editor ? this.editor.can() : null;
  }

  isEmpty() {
    return this.editor ? this.editor.isEmpty : true;
  }

  get html(): string { return this._htmlControllable.read(); }
  set html(v: string) { this._htmlControllable.notifyPropertyWrite(v); }
}

injectGlobalStyles('rozie-tip-tap-392ab86c-global', `
.rozie-tiptap-content .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: rgba(0, 0, 0, 0.4);
    float: left;
    height: 0;
    pointer-events: none;
  }
`);
