import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty } from '@rozie/runtime-lit';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// The live editor instance — null before mount / after destroy. Named `editor`
// (distinct from any template `ref="X"` name) so no capture-var-vs-ref double
// declaration trap (the Chart.js canvasEl/canvasNode lesson).

interface RozieToolbarSlotCtx {
  editor: unknown;
}

@customElement('rozie-tip-tap')
export default class TipTap extends SignalWatcher(LitElement) {
  static styles = css`
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
`;

  @property({ type: String, attribute: 'html' }) _html_attr: string = '<p>Start writing…</p>';
  private _htmlControllable = createLitControllableProperty<string>({ host: this, eventName: 'html-change', defaultValue: '<p>Start writing…</p>', initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) editable: boolean = true;
  @property({ type: String, reflect: true }) placeholder: string = '';
  @property({ type: Boolean, reflect: true }) autofocus: boolean = false;
  @property({ type: String, reflect: true }) editorClass: string = '';
  @property({ type: String, reflect: true }) ariaLabel: string = 'Rich text editor';
  @property({ type: Object }) editorProps: any = {};
  @property({ type: Array }) extensions: any[] = [];
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
  @property({ attribute: false }) toolbar?: (scope: { editor: unknown }) => unknown;

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
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotToolbar = Array.from(this.children).some((el) => el.getAttribute('slot') === 'toolbar');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

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
    };

    this._disconnectCleanups.push((() => {
      this.toolbarDispose?.();
      this.toolbarDispose = null;
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
    this.editor = new Editor({
      element: this._refEditorEl,
      content: this.html,
      editable: this.editable,
      autofocus: this.autofocus,
      // StarterKit first; consumer extensions LAST so they win (TipTap applies
      // later-registered extensions over earlier ones for the same node/mark).
      extensions: [StarterKit, ...this.extensions],
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
    <button class="${Object.entries({ active: this._active.value.h1 }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-label="Heading 1" @click=${($event: Event) => { this.toggleHeading(1); }} data-rozie-s-2aeee876>H1</button>
    <button class="${Object.entries({ active: this._active.value.h2 }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-label="Heading 2" @click=${($event: Event) => { this.toggleHeading(2); }} data-rozie-s-2aeee876>H2</button>
    <span class="sep" data-rozie-s-2aeee876></span>
    <button class="${Object.entries({ active: this._active.value.bulletList }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-label="Bullet list" @click=${this.toggleBulletList} data-rozie-s-2aeee876>• List</button>
  </div>` : nothing}${this.editable && this.toolbar !== undefined ? html`<div class="rozie-tiptap-toolbar rozie-tiptap-toolbar--slot" data-rozie-ref="toolbarEl" data-rozie-s-2aeee876></div>` : nothing}<div class="rozie-tiptap-content" data-placeholder=${this.placeholder} data-rozie-ref="editorEl" data-rozie-s-2aeee876></div>
</div>

<slot name="toolbar"></slot>
`;
  }

  editor: any = null;

  lastHtml: any = null;

  toolbarDispose: any = null;

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

  get html(): string { return this._htmlControllable.read(); }
  set html(v: string) { this._htmlControllable.notifyPropertyWrite(v); }
}
