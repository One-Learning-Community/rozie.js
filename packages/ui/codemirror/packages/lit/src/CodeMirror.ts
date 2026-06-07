import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, injectGlobalStyles } from '@rozie/runtime-lit';
import { styleMap } from 'lit/directives/style-map.js';
import { EditorState, Compartment, EditorSelection } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, showPanel, placeholder as placeholderExt } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

interface RoziePanelSlotCtx {
  view: unknown;
}

@customElement('rozie-code-mirror')
export default class CodeMirror extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-codemirror[data-rozie-s-34cfda5a] {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
}
.cm-mount[data-rozie-s-34cfda5a] {
  height: 100%;
  width: 100%;
}
.rozie-codemirror .cm-editor {
    height: 100%;
    font-size: 13px;
  }
.rozie-codemirror .cm-scroller {
    height: 100%;
  }
.rozie-codemirror .rozie-cm-panel {
    padding: 2px 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    font-size: 12px;
  }
`;

  @property({ type: String, attribute: 'value' }) _value_attr: string = '';
  private _valueControllable = createLitControllableProperty<string>({ host: this, eventName: 'value-change', defaultValue: '', initialControlledValue: undefined });
  @property({ type: String, reflect: true }) language: string = 'javascript';
  @property({ type: String, reflect: true }) theme: string = 'light';
  @property({ type: Boolean, reflect: true }) readOnly: boolean = false;
  @property({ type: Number, reflect: true }) height: number = 240;
  @property({ type: String, reflect: true }) placeholder: string = '';
  @property({ type: Array }) extensions: any[] = [];
  @query('[data-rozie-ref="hostEl"]') private _refHostEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();

  @state() private _hasSlotPanel = false;
  @queryAssignedElements({ slot: 'panel', flatten: true }) private _slotPanelElements!: Element[];
  @property({ attribute: false }) panel?: (scope: { view: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="panel"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotPanel = this._slotPanelElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotPanel = Array.from(this.children).some((el) => el.getAttribute('slot') === 'panel');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    const portals = {
      panel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
        const tpl = this.panel;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-panel', '34cfda5a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
    };

    this._disconnectCleanups.push((() => this.view?.destroy()));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.value)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => this.writeDoc(v))(__watchVal); }); }));

    // One `panel` portal slot — mounted through CM6's `showPanel` facet. The
    // Panel's `dom` is the portal host node; $portals.panel(dom, scope) mounts the
    // consumer's framework-native fragment on Panel.mount() and the returned
    // dispose runs in Panel.destroy(). Empty extension ([]) when the consumer
    // doesn't fill the slot.
    // NOTE: the Panel's mount/destroy are ARROW-FUNCTION properties (not object
    // `mount() {}` methods) and the panel host element + view are captured in
    // plain `const`s. The object-method form gives each method its own `this`
    // scope, and the Lit emitter's component-field rewrite walks INTO that method
    // body and rewrites a closure-captured `view` reference to `this.view`
    // (TS2339 "Property 'view' does not exist on type 'Panel'"). Arrow-function
    // properties share the enclosing lexical scope, so the captured `panelView`
    // const resolves correctly on every target. CM6 calls `panel.mount()` /
    // `panel.destroy()` either way.
    const panelExt = () => {
      if (!(this.panel !== undefined)) return [];
      return showPanel.of((panelView: any) => {
        const dom = document.createElement('div');
        dom.className = 'rozie-cm-panel';
        const scope = {
          view: panelView
        };
        let dispose: any = null;
        return {
          dom,
          top: false,
          mount: () => {
            dispose = portals.panel(dom, scope);
          },
          destroy: () => {
            dispose?.();
            dispose = null;
          }
        };
      });
    };
    const buildState = (doc: any) => EditorState.create({
      doc,
      extensions: [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap]), this.langCompartment.of(this.langExt()), this.themeCompartment.of(this.themeExt()), this.readOnlyCompartment.of(EditorState.readOnly.of(this.readOnly)), this.placeholderCompartment.of(this.phExt()), this.panelCompartment.of(panelExt()), EditorView.updateListener.of((update: any) => {
        if (!update.docChanged) return;
        if (this.suppressEmit) return;
        // Push the new doc out through the model:true emit path. Consumers
        // bound via `r-model:value="$data.x"` receive the change.
        this._valueControllable.write(update.state.doc.toString());
      }),
      // Consumer extensions LAST so they win CM6's last-registered-wins facets.
      this.extensionsCompartment.of(this.extensions)]
    });
    this.view = new EditorView({
      state: buildState(this.value),
      parent: this._refHostEl
    });
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('language'))) { const __watchVal = (() => this.language)(); (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.langCompartment.reconfigure(this.langExt())
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('theme'))) { const __watchVal = (() => this.theme)(); (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.themeCompartment.reconfigure(this.themeExt())
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('readOnly'))) { const __watchVal = (() => this.readOnly)(); ((v: any) => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(v))
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('placeholder'))) { const __watchVal = (() => this.placeholder)(); (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.placeholderCompartment.reconfigure(this.phExt())
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('extensions'))) { const __watchVal = (() => this.extensions)(); ((v: any) => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.extensionsCompartment.reconfigure(v)
      });
    })(__watchVal); }
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
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="rozie-codemirror" style=${styleMap({ height: this.height + 'px' })} data-rozie-s-34cfda5a>
  <div class="cm-mount" data-rozie-ref="hostEl" data-rozie-s-34cfda5a></div>
</div>

<slot name="panel"></slot>
`;
  }

  view: any = null;

  suppressEmit = false;

  langCompartment = new Compartment();

  themeCompartment = new Compartment();

  readOnlyCompartment = new Compartment();

  placeholderCompartment = new Compartment();

  extensionsCompartment = new Compartment();

  panelCompartment = new Compartment();

  langExt = (): any => this.language === 'javascript' ? javascript() : [];

  themeExt = (): any => this.theme === 'dark' ? oneDark : [];

  phExt = (): any => this.placeholder ? placeholderExt(this.placeholder) : [];

  writeDoc = (v: any) => {
  if (!this.view) return;
  const current = this.view.state.doc.toString();
  const next = v ?? '';
  if (current === next) return;
  this.suppressEmit = true;
  try {
    this.view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: next
      }
    });
  } finally {
    this.suppressEmit = false;
  }
};

  getView() {
    return this.view;
  }

  focus() {
    this.view?.focus();
  }

  getValue() {
    return this.view ? this.view.state.doc.toString() : '';
  }

  replaceValue(v: any) {
    this.writeDoc(v);
  }

  dispatch(tr: any) {
    this.view?.dispatch(tr);
  }

  insertText(text: any) {
    if (!this.view) return;
    const {
      from,
      to
    } = this.view.state.selection.main;
    this.view.dispatch({
      changes: {
        from,
        to,
        insert: text
      },
      userEvent: 'input.type'
    });
  }

  getSelection() {
    return this.view ? this.view.state.selection.main : null;
  }

  setSelection(range: any) {
    if (!this.view) return;
    const sel = typeof range === 'number' ? EditorSelection.single(range) : EditorSelection.single(range.anchor, range.head);
    this.view.dispatch({
      selection: sel
    });
  }

  get value(): string { return this._valueControllable.read(); }
  set value(v: string) { this._valueControllable.notifyPropertyWrite(v); }
}

injectGlobalStyles('rozie-code-mirror-global', `
.rozie-codemirror .cm-editor {
    height: 100%;
    font-size: 13px;
  }
.rozie-codemirror .cm-scroller {
    height: 100%;
  }
.rozie-codemirror .rozie-cm-panel {
    padding: 2px 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    font-size: 12px;
  }
`);
