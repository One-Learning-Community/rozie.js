import { LitElement, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { ContextConsumer, ContextProvider, createContext } from '@lit/context';

const __rozieCtx_rete_node = createContext(Symbol.for("rozie:rete:node"));

const __rozieCtx_rete_canvas = createContext(Symbol.for("rozie:rete:canvas"));

@customElement('rozie-flow-node')
export default class FlowNode extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) id!: string;
  @property({ type: Number, reflect: true }) x: number = 0;
  @property({ type: Number, reflect: true }) y: number = 0;
  @property({ type: Object }) label: unknown = undefined;
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieFirstUpdateDone = false;
private __rozieCtxProvider_rete_node = new ContextProvider(this, { context: __rozieCtx_rete_node, initialValue: ((__rozieCtxHost) => ({
  get id() {
    return __rozieCtxHost.id;
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (__rozieCtxHost.cv) __rozieCtxHost.cv.addPort(__rozieCtxHost.id, side, key, label, multiple);
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

    this.cv = this.canvas;

    // The FlowNode's own host element, captured at mount ($el only safe in $onMount,
    // ROZ123). The parent-invoked renderBody closure appends THIS into the engine
    // `body` host — moving the host preserves Lit shadow projection of the slot body.
    // Module-scope `any` so it survives into the parent's later render-scope call.

    this._disconnectCleanups.push((() => {
      if (this.cv) this.cv.unregister(this.id);
    }));

    this.hostEl = this._ref__rozieRoot;
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — projecting
    // this FlowNode's body into the engine element from the PARENT's render scope.
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — projecting
    // this FlowNode's body into the engine element from the PARENT's render scope.
    if (this.cv) {
      this.cv.register(this.id, {
        id: this.id,
        x: this.x,
        y: this.y,
        label: this.label,
        inputs: [],
        outputs: [],
        // D-04 render-callback: the parent calls this with the engine body host div.
        renderBody: (host: any) => {
          if (host && this.hostEl) host.appendChild(this.hostEl);
        }
      });
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('x'))) { const __watchVal = (() => this.x)(); (() => {
      if (this.cv) this.cv.update(this.id, {
        id: this.id,
        x: this.x,
        y: this.y,
        label: this.label,
        renderBody: (host: any) => {
          if (host && this.hostEl) host.appendChild(this.hostEl);
        }
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('y'))) { const __watchVal = (() => this.y)(); (() => {
      if (this.cv) this.cv.update(this.id, {
        id: this.id,
        x: this.x,
        y: this.y,
        label: this.label,
        renderBody: (host: any) => {
          if (host && this.hostEl) host.appendChild(this.hostEl);
        }
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('label'))) { const __watchVal = (() => this.label)(); (() => {
      if (this.cv) this.cv.update(this.id, {
        id: this.id,
        x: this.x,
        y: this.y,
        label: this.label,
        renderBody: (host: any) => {
          if (host && this.hostEl) host.appendChild(this.hostEl);
        }
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

<div class="rozie-flow-node-host" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="__rozieRoot" data-rozie-s-23c15996><slot></slot></div>
`;
  }

  cv: any = null;

  hostEl: any = null;

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
