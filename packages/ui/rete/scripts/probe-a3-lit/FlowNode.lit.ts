import { LitElement, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { __rozieReconcileAfterDomMutation, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { ContextConsumer, ContextProvider, createContext } from '@lit/context';
import { keyed } from 'lit/directives/keyed.js';

const __rozieCtx_rete_node = createContext(Symbol.for("rozie:rete:node"));

const __rozieCtx_rete_canvas = createContext(Symbol.for("rozie:rete:canvas"));

@customElement('rozie-flow-node')
export default class FlowNode extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) id!: string;
  @property({ type: Number, reflect: true }) x: number = 0;
  @property({ type: Number, reflect: true }) y: number = 0;
  @property({ type: Object }) label: unknown = undefined;
  @query('[data-rozie-ref="bodyEl"]') private _refBodyEl!: HTMLElement;
private __rozieFirstUpdateDone = false;
private __rozieCtxProvider_rete_node = new ContextProvider(this, { context: __rozieCtx_rete_node, initialValue: ((__rozieCtxHost) => ({
  get id() {
    return __rozieCtxHost.id;
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (__rozieCtxHost.canvas) __rozieCtxHost.canvas.addPort(__rozieCtxHost.id, side, key, label, multiple);
  }
}))(this) });
private __rozieCtxConsumer_rete_canvas = new ContextConsumer(this, { context: __rozieCtx_rete_canvas, subscribe: true });
private get canvas() { return this.__rozieCtxConsumer_rete_canvas.value; }

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  _rozieReconcileSeq = 0;

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

    this._disconnectCleanups.push((() => {
      if (this.canvas) this.canvas.unregister(this.id);
    }));

    // register this node's spec; reconcileNodes() builds the engine node, then
    // exposes its body host element for the D-04 relocation below.
    if (this.canvas) this.canvas.register(this.id, {
      id: this.id,
      x: this.x,
      y: this.y,
      label: this.label,
      inputs: [],
      outputs: []
    });

    // D-04: relocate our own rendered body into the engine-created body host. $refs
    // is only safe in $onMount (ROZ123); by registration time the engine element
    // exists, so bodyHostFor(id) returns the engine `body` div.
    // D-04: relocate our own rendered body into the engine-created body host. $refs
    // is only safe in $onMount (ROZ123); by registration time the engine element
    // exists, so bodyHostFor(id) returns the engine `body` div.
    const host = this.canvas && this.canvas.bodyHostFor(this.id);
    if (host && this._refBodyEl) host.appendChild(this._refBodyEl);
    // tell the framework the DOM moved — Lit-load-bearing (rebuild reconcile after
    // the cross-shadow-boundary move), no-op + byte-identical on the other 5.
    // tell the framework the DOM moved — Lit-load-bearing (rebuild reconcile after
    // the cross-shadow-boundary move), no-op + byte-identical on the other 5.
    __rozieReconcileAfterDomMutation(this);
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('x'))) { const __watchVal = (() => this.x)(); (() => {
      if (this.canvas) this.canvas.update(this.id, {
        id: this.id,
        x: this.x,
        y: this.y,
        label: this.label
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('y'))) { const __watchVal = (() => this.y)(); (() => {
      if (this.canvas) this.canvas.update(this.id, {
        id: this.id,
        x: this.x,
        y: this.y,
        label: this.label
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('label'))) { const __watchVal = (() => this.label)(); (() => {
      if (this.canvas) this.canvas.update(this.id, {
        id: this.id,
        x: this.x,
        y: this.y,
        label: this.label
      });
    })(); }
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
<div ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="bodyEl" data-rozie-s-23c15996>${keyed(this._rozieReconcileSeq ?? 0, html`<slot></slot>`)}</div>
`;
  }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['id', 'x', 'y', 'label']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
