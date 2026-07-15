import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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

interface ToolbarCtx {
  $implicit: { editor: any };
  editor: any;
}

interface BubbleMenuCtx {
  $implicit: { editor: any };
  editor: any;
}

interface FloatingMenuCtx {
  $implicit: { editor: any };
  editor: any;
}

interface NodeViewCtx {
  $implicit: { node: any; selected: any; updateAttributes: any; getPos: any; editor: any; contentDOM: any };
  node: any;
  selected: any;
  updateAttributes: any;
  getPos: any;
  editor: any;
  contentDOM: any;
}

@Component({
  selector: 'rozie-tip-tap',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-tiptap" [ngClass]="{ 'is-readonly': !editable() }">
      
      @if (editable() && !(toolbarTpl ?? templates()?.['toolbar'])) {
    <div class="rozie-tiptap-toolbar">
        <button type="button" [class]="{ active: active().bold }" aria-label="Bold" (click)="toggleBold()"><strong>B</strong></button>
        <button type="button" [class]="{ active: active().italic }" aria-label="Italic" (click)="toggleItalic()"><em>I</em></button>
        <span class="sep"></span>
        <button type="button" [class]="{ active: active().h1 }" aria-label="Heading 1" (click)="toggleHeading(1)">H1</button>
        <button type="button" [class]="{ active: active().h2 }" aria-label="Heading 2" (click)="toggleHeading(2)">H2</button>
        <span class="sep"></span>
        <button type="button" [class]="{ active: active().bulletList }" aria-label="Bullet list" (click)="toggleBulletList()">• List</button>
      </div>
    }@if (editable() && (toolbarTpl ?? templates()?.['toolbar'])) {
    <div class="rozie-tiptap-toolbar rozie-tiptap-toolbar--slot" #toolbarEl></div>
    }<div #editorEl class="rozie-tiptap-content" [attr.data-placeholder]="placeholder()"></div>
    </div>







    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [`
    :host(rozie-tip-tap) { display: contents; }
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

    ::ng-deep .rozie-tiptap-content .is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        color: rgba(0, 0, 0, 0.4);
        float: left;
        height: 0;
        pointer-events: none;
      }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TipTap),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class TipTap {
  /**
   * The editor's document content as an HTML string — the sole `model: true` prop (two-way `r-model`). Typing writes the new HTML back through the model path (TipTap's `onUpdate`); a consumer write reflects into the live document, echo-guarded so a programmatic set does not reset the selection or re-emit `update`.
   * @example
   * <TipTap r-model:html="content" placeholder="Start writing…" />
   */
  html = model<string>('<p>Start writing…</p>');
  /**
   * Whether the document is editable. Toggling it calls TipTap's `setEditable` with `emitUpdate: false` (no spurious `update`). When `false`, the internal toolbar is hidden and the wrapper gets an `is-readonly` class.
   */
  editable = input<boolean>(true);
  /**
   * Placeholder text, forwarded to the editor host as `data-placeholder` + `aria-placeholder` and painted as ghost text on the first empty node via the bundled Placeholder extension. An empty string adds no placeholder.
   */
  placeholder = input<string>('');
  /**
   * Whether to place the caret in the document on mount (TipTap's `autofocus` option).
   */
  autofocus = input<boolean>(false);
  /**
   * A CSS class applied to the contenteditable element (`editorProps.attributes.class`).
   */
  editorClass = input<string>('');
  /**
   * The accessible name (`aria-label`) applied to the contenteditable element.
   */
  ariaLabel = input<string>('Rich text editor');
  /**
   * ProseMirror `editorProps` passthrough — `handleKeyDown`, `handlePaste`, a custom `attributes`, etc. Spread **last** so consumer `editorProps` win the wrapper's attribute defaults.
   */
  editorProps = input<Record<string, any>>((() => ({}))());
  /**
   * Extra TipTap extensions composed onto `StarterKit` — the consumer-extensibility passthrough (Link, Image, Mention, custom nodes/marks, …). Composed **last** so consumer extensions win for the same node or mark.
   */
  extensions = input<any[]>((() => [])());
  active = signal({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    bulletList: false
  });
  toolbarEl = viewChild<ElementRef<HTMLDivElement>>('toolbarEl');
  editorEl = viewChild<ElementRef<HTMLDivElement>>('editorEl');
  update = output<unknown>();
  selectionUpdate = output<void>();
  focus = output<void>();
  blur = output<void>();
  @ContentChild('toolbar', { read: TemplateRef }) toolbarTpl?: TemplateRef<ToolbarCtx>;
  @ContentChild('bubbleMenu', { read: TemplateRef }) bubbleMenuTpl?: TemplateRef<BubbleMenuCtx>;
  @ContentChild('floatingMenu', { read: TemplateRef }) floatingMenuTpl?: TemplateRef<FloatingMenuCtx>;
  @ContentChild('nodeView', { read: TemplateRef }) nodeViewTpl?: TemplateRef<NodeViewCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _toolbarTpl = contentChild('toolbar', { read: TemplateRef });
  private _bubbleMenuTpl = contentChild('bubbleMenu', { read: TemplateRef });
  private _floatingMenuTpl = contentChild('floatingMenu', { read: TemplateRef });
  private _nodeViewTpl = contentChild('nodeView', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.html())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (!this.editor) return;
      if (v === this.lastHtml) return;
      this.lastHtml = v;
      this.editor.commands.setContent(v, {
        emitUpdate: false
      });
      this.refreshActive();
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.editable())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => this.editor?.setEditable(v, false))(__watchVal); }); });
  }

  ngAfterViewInit() {
    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      toolbar: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
        const tpl = this._toolbarTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-toolbar', '2aeee876');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      bubbleMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
        const tpl = this._bubbleMenuTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-bubbleMenu', '2aeee876');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      floatingMenu: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
        const tpl = this._floatingMenuTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-floatingMenu', '2aeee876');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      nodeView: (container: HTMLElement, scope: { node: unknown; selected: unknown; updateAttributes: unknown; getPos: unknown; editor: unknown; contentDOM: unknown }): ReactivePortalHandle => {
        const tpl = this._nodeViewTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-nodeView', '2aeee876');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
    };
    const __placeholder = this.placeholder();
    const __editorClass = this.editorClass();
    this.lastHtml = this.html();

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
    const nodeViewExtensions = (this.nodeViewTpl ?? this.templates()?.['nodeView']) ? this.makeNodeViewExtensions(portals.nodeView) : [];

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
    const placeholderExtensions = __placeholder ? [Placeholder.configure({
      placeholder: __placeholder
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
    if ((this.bubbleMenuTpl ?? this.templates()?.['bubbleMenu'])) {
      this.bubbleMenuEl = document.createElement('div');
      this.bubbleMenuEl.className = 'rozie-tiptap-bubble-menu';
    }
    if ((this.floatingMenuTpl ?? this.templates()?.['floatingMenu'])) {
      this.floatingMenuEl = document.createElement('div');
      this.floatingMenuEl.className = 'rozie-tiptap-floating-menu';
    }
    const menuExtensions = [...(this.bubbleMenuEl ? [BubbleMenu.configure({
      element: this.bubbleMenuEl
    })] : []), ...(this.floatingMenuEl ? [FloatingMenu.configure({
      element: this.floatingMenuEl
    })] : [])];
    this.editor = new Editor({
      element: this.editorEl()!.nativeElement,
      content: this.html(),
      editable: this.editable(),
      autofocus: this.autofocus(),
      // StarterKit first; the Placeholder ext next; the reactive node-view nodes
      // next; consumer extensions LAST so they win (TipTap applies later-registered
      // extensions over earlier ones for the same node/mark).
      extensions: [StarterKit, ...placeholderExtensions, ...nodeViewExtensions, ...menuExtensions, ...this.extensions()],
      editorProps: {
        attributes: {
          'aria-label': this.ariaLabel(),
          ...(__editorClass ? {
            class: __editorClass
          } : {}),
          ...(__placeholder ? {
            'data-placeholder': __placeholder,
            'aria-placeholder': __placeholder
          } : {})
        },
        // Consumer editorProps spread LAST — full ProseMirror editorProps control
        // (handleKeyDown, handlePaste, a custom `attributes`, …) wins.
        ...this.editorProps()
      },
      onUpdate: ({
        editor
      }: any) => {
        const next = editor.getHTML();
        this.lastHtml = next;
        // Round-trip guard — see CodeMirror/Flatpickr for the same shape.
        if (next !== this.html()) this.html.set(next), this.__rozieCvaOnChange(next);
        this.update.emit(next);
      },
      onSelectionUpdate: () => {
        this.refreshActive();
        this.selectionUpdate.emit();
      },
      onFocus: () => this.focus.emit(),
      onBlur: () => this.blur.emit()
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
    if ((this.toolbarTpl ?? this.templates()?.['toolbar']) && this.toolbarEl()?.nativeElement) {
      this.toolbarDispose = portals.toolbar(this.toolbarEl()!.nativeElement, {
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
    this.__rozieDestroyRef.onDestroy(() => {
      this.toolbarDispose?.();
      this.toolbarDispose = null;
      this.bubbleMenuDispose?.();
      this.bubbleMenuDispose = null;
      this.floatingMenuDispose?.();
      this.floatingMenuDispose = null;
      this.editor?.destroy();
    });
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
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
    this.active.set({
      bold: this.editor.isActive('bold'),
      italic: this.editor.isActive('italic'),
      h1: this.editor.isActive('heading', {
        level: 1
      }),
      h2: this.editor.isActive('heading', {
        level: 2
      }),
      bulletList: this.editor.isActive('bulletList')
    });
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
  getEditor = () => {
    return this.editor;
  };
  focusEditor = () => {
    this.editor?.commands.focus();
  };
  blurEditor = () => {
    this.editor?.commands.blur();
  };
  getHTML = () => {
    return this.editor ? this.editor.getHTML() : '';
  };
  getJSON = () => {
    return this.editor ? this.editor.getJSON() : null;
  };
  getText = () => {
    return this.editor ? this.editor.getText() : '';
  };
  setContent = (next: any) => {
    if (!this.editor) return;
    const v = next ?? '';
    if (v === this.lastHtml) return;
    this.lastHtml = v;
    this.editor.commands.setContent(v, {
      emitUpdate: false
    });
    this.html.set(v), this.__rozieCvaOnChange(v);
    this.refreshActive();
  };
  clearContent = () => {
    if (!this.editor) return;
    this.editor.commands.clearContent();
    this.lastHtml = this.editor.getHTML();
    this.html.set(this.lastHtml), this.__rozieCvaOnChange(this.lastHtml);
    this.refreshActive();
  };
  toggleBold = () => {
    this.editor?.chain().focus().toggleBold().run();
    this.refreshActive();
  };
  toggleItalic = () => {
    this.editor?.chain().focus().toggleItalic().run();
    this.refreshActive();
  };
  toggleHeading = (level: any) => {
    this.editor?.chain().focus().toggleHeading({
      level: level ?? 1
    }).run();
    this.refreshActive();
  };
  toggleBulletList = () => {
    this.editor?.chain().focus().toggleBulletList().run();
    this.refreshActive();
  };
  undo = () => {
    this.editor?.chain().focus().undo().run();
    this.refreshActive();
  };
  redo = () => {
    this.editor?.chain().focus().redo().run();
    this.refreshActive();
  };
  chain = () => {
    return this.editor ? this.editor.chain().focus() : null;
  };
  isActive = (name: any, attrs: any) => {
    return this.editor ? this.editor.isActive(name, attrs) : false;
  };
  can = () => {
    return this.editor ? this.editor.can() : null;
  };
  isEmpty = () => {
    return this.editor ? this.editor.isEmpty : true;
  };

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: string | null): void {
    this.html.set(v ?? '<p>Start writing…</p>');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  static ngTemplateContextGuard(
    _dir: TipTap,
    _ctx: unknown,
  ): _ctx is ToolbarCtx | BubbleMenuCtx | FloatingMenuCtx | NodeViewCtx {
    return true;
  }
}

export default TipTap;
