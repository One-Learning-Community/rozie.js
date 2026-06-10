import { LitElement, html, nothing, render } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, ContextProvider, createContext } from '@lit/context';

const __rozieCtx_rete_node = createContext(Symbol.for("rozie:rete:node"));

const __rozieCtx_rete_canvas = createContext(Symbol.for("rozie:rete:canvas"));

interface RozieBodySlotCtx {
  id: unknown;
  label: unknown;
}

@customElement('rozie-flow-node')
export default class FlowNode extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) id!: string;
  @property({ type: Number, reflect: true }) x: number = 0;
  @property({ type: Number, reflect: true }) y: number = 0;
  @property({ type: Object }) label: unknown = undefined;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();
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

  @state() private _hasSlotBody = false;
  @queryAssignedElements({ slot: 'body', flatten: true }) private _slotBodyElements!: Element[];
  @property({ attribute: false }) body?: (scope: { id: unknown; label: unknown }) => unknown;
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="body"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotBody = this._slotBodyElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

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
    this._hasSlotBody = Array.from(this.children).some((el) => el.getAttribute('slot') === 'body');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      body: (container: HTMLElement, scope: { id: unknown; label: unknown }): ReactivePortalHandle => {
        const tpl = this.body;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-body', '23c15996');
        const renderScope = (s: { id: unknown; label: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { id: unknown; label: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
    };

    this.cv = this.canvas;

    // The live $portals.body handle ({ dispose }) returned by the parent-invoked
    // renderBody callback. Module-scope `any` so the teardown — which the Solid emitter
    // hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose it.

    this._disconnectCleanups.push((() => {
      if (this.bodyHandle && this.bodyHandle.dispose) {
        try {
          this.bodyHandle.dispose();
        } catch (e: any) {}
      }
      if (this.cv) this.cv.unregister(this.id);
    }));

    // The body-mount closure — captures the mount-scoped `portals` local. Disposes a
    // prior handle first so a re-fired renderBody (e.g. ports changed → fresh node
    // build) does not stack portal roots into the same engine host.
    this.mountBody = (host: any) => {
      if (!host) return;
      if (this.bodyHandle && this.bodyHandle.dispose) {
        try {
          this.bodyHandle.dispose();
        } catch (e: any) {}
      }
      this.bodyHandle = portals.body(host, {
        id: this.id,
        label: this.label
      });
    };
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — at which point
    // the FlowNode mounts its own body portal into the engine `body` host.
    // On Lit the injected canvas may still be undefined here (REQ-30 async context);
    // the $onUpdate below performs the registration once the value arrives.
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — at which point
    // the FlowNode mounts its own body portal into the engine `body` host.
    // On Lit the injected canvas may still be undefined here (REQ-30 async context);
    // the $onUpdate below performs the registration once the value arrives.
    if (this.cv && !this.registered) {
      this.registered = true;
      this.cv.register(this.id, this.buildSpec());
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('x'))) { const __watchVal = (() => this.x)(); (() => {
      if (this.cv) this.cv.update(this.id, this.buildSpec());
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('y'))) { const __watchVal = (() => this.y)(); (() => {
      if (this.cv) this.cv.update(this.id, this.buildSpec());
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('label'))) { const __watchVal = (() => this.label)(); (() => {
      if (this.cv) this.cv.update(this.id, this.buildSpec());
    })(); }
    this.__rozieFirstUpdateDone = true;

    if (this.registered) return;
    const live = this.canvas;
    if (live == null) return;
    this.cv = live;
    this.registered = true;
    this.cv.register(this.id, this.buildSpec());
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

  render() {
    return html`

<slot name="body"></slot>

<div class="rozie-flow-node-children" style="display:none" data-rozie-s-23c15996><slot></slot></div>
`;
  }

  cv: any = null;

  bodyHandle: any = null;

  mountBody: any = null;

  registered = false;

  buildSpec = () => ({
  id: this.id,
  x: this.x,
  y: this.y,
  label: this.label,
  inputs: [],
  outputs: [],
  // D-04 render-callback: the parent hands the engine body host; delegate to the
  // mountBody closure (defined inside $onMount so it can see the emitter's mount-
  // scoped `portals` local). Until $onMount has run, mountBody is null — but the
  // parent only invokes renderBody AFTER reconcileNodes (post-register, post-mount),
  // so mountBody is always set by then.
  renderBody: (host: any) => {
    // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html
    // "cannot find node" when re-rendering into an engine-owned host that the area
    // re-created) can NEVER abort the parent's reconcileNodes loop — a thrown
    // renderBody would propagate out of area.update/addNode and stop the whole graph
    // from building (cfg renders, the declarative nodes don't). The body simply
    // re-mounts on the next reconcile tick if a single attempt fails.
    if (host && this.mountBody) {
      try {
        this.mountBody(host);
      } catch (e: any) {}
    }
  }
});
}
