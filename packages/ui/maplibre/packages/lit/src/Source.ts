import { LitElement, html } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { ContextConsumer, ContextProvider, createContext } from '@lit/context';

const __rozieCtx_maplibre_source = createContext(Symbol.for("rozie:maplibre:source"));

const __rozieCtx_maplibre_sources = createContext(Symbol.for("rozie:maplibre:sources"));

@customElement('rozie-source')
export default class Source extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) id!: string;
  @property({ type: Object }) spec: unknown = undefined;
private __rozieWatchInitial_0 = true;
private __rozieFirstUpdateDone = false;
private __rozieCtxProvider_maplibre_source = new ContextProvider(this, { context: __rozieCtx_maplibre_source, initialValue: ((__rozieCtxHost) => ({
  get id() {
    return __rozieCtxHost.id;
  }
}))(this) });
private __rozieCtxConsumer_maplibre_sources = new ContextConsumer(this, { context: __rozieCtx_maplibre_sources, subscribe: true });
private get sources() { return this.__rozieCtxConsumer_maplibre_sources.value; }

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this.reg = this.sources;

    // idempotency flag so the $onMount register and the late-context $onUpdate path
    // (Lit async, REQ-30) never double-register the source.

    this._disconnectCleanups.push((() => {
      if (this.reg) this.reg.unregister(this.id);
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.sources)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((live: any) => {
      if (this.didRegister || live == null) return;
      this.reg = live;
      this.didRegister = true;
      this.reg.register(this.id, {
        id: this.id,
        spec: this.spec
      });
    })(__watchVal); }); }));

    // register this source's spec into the parent registry; the parent's
    // applyLayers() reconcile (style-load gated) picks it up via its registry watch.
    // On Lit the injected sources registry may still be undefined here (async
    // context, REQ-30) — the $onUpdate below registers once it resolves.
    if (this.reg && !this.didRegister) {
      this.didRegister = true;
      this.reg.register(this.id, {
        id: this.id,
        spec: this.spec
      });
    }
    // unregister on unmount so the parent reaps this source (its layers first).
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('spec'))) { const __watchVal = (() => this.spec)(); ((v: any) => {
      if (this.reg) this.reg.update(this.id, {
        id: this.id,
        spec: v
      });
    })(__watchVal); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`
<slot></slot>
`;
  }

  reg: any = null;

  didRegister = false;
}
