import { LitElement, html, nothing, render } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, ContextProvider, createContext } from '@lit/context';

const __rozieCtx_rete_nodeType = createContext(Symbol.for("rozie:rete:nodeType"));

const __rozieCtx_rete_canvas = createContext(Symbol.for("rozie:rete:canvas"));

interface RozieBodySlotCtx {
  node: unknown;
  selected: unknown;
  emit: unknown;
}

@customElement('rozie-node-type')
export default class NodeType extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) type!: string;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();
private __rozieCtxProvider_rete_nodeType = new ContextProvider(this, { context: __rozieCtx_rete_nodeType, initialValue: ((__rozieCtxHost) => ({
  get type() {
    return __rozieCtxHost.type;
  },
  addPort: (side: any, key: any, portType: any, label: any, multiple: any) => {
    if (__rozieCtxHost.cv) __rozieCtxHost.cv.addTypePort(__rozieCtxHost.type, side, key, portType, label, multiple);
  }
}))(this) });
private __rozieCtxConsumer_rete_canvas = new ContextConsumer(this, { context: __rozieCtx_rete_canvas, subscribe: true });
private get canvas() { return this.__rozieCtxConsumer_rete_canvas.value; }

  @state() private _hasSlotBody = false;
  @queryAssignedElements({ slot: 'body', flatten: true }) private _slotBodyElements!: Element[];
  @property({ attribute: false }) body?: (scope: { node: unknown; selected: unknown; emit: unknown }) => unknown;
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
      body: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
        const tpl = this.body;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-body', '372f9492');
        const renderScope = (s: { node: unknown; selected: unknown; emit: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { node: unknown; selected: unknown; emit: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
    };

    this.cv = this.canvas;

    // The live $portals.body handle ({ dispose }) returned by the parent-invoked
    // bodyRenderer callback. Module-scope `any` so the teardown — which the Solid
    // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose
    // it. (A NodeType type-template projects ONE body root per graph node; the canvas
    // disposes per-node on node unmount, this is the last-projection handle.)

    this._disconnectCleanups.push((() => {
      if (this.bodyHandle && this.bodyHandle.dispose) {
        try {
          this.bodyHandle.dispose();
        } catch (e: any) {}
      }
      if (this.cv) this.cv.unregisterType(this.type);
    }));

    // The body-mount closure — captures the mount-scoped `portals` local. Disposes a
    // prior handle first so a re-fired bodyRenderer (e.g. ports changed → fresh node
    // build) does not stack portal roots into the same engine host. Mounts the type's
    // `#body` slot, scoped with the graph node ({ node, selected, emit }).
    this.mountBody = (host: any, scope: any) => {
      if (!host) return null;
      if (this.bodyHandle && this.bodyHandle.dispose) {
        try {
          this.bodyHandle.dispose();
        } catch (e: any) {}
      }
      const s = scope || {};
      this.bodyHandle = portals.body(host, {
        node: s.node,
        selected: s.selected,
        emit: s.emit
      });
      return this.bodyHandle;
    };
    // register this TYPE's spec INCLUDING the bodyRenderer callback. The canvas's
    // renderNode resolves typeReg[node.type].bodyRenderer for every graph node of this
    // type and projects the body into the engine host. On Lit the injected canvas may
    // still be undefined here (REQ-30 async context); the $onUpdate below performs the
    // registration once the value arrives.
    // register this TYPE's spec INCLUDING the bodyRenderer callback. The canvas's
    // renderNode resolves typeReg[node.type].bodyRenderer for every graph node of this
    // type and projects the body into the engine host. On Lit the injected canvas may
    // still be undefined here (REQ-30 async context); the $onUpdate below performs the
    // registration once the value arrives.
    if (this.cv && !this.registered) {
      this.registered = true;
      this.cv.registerType(this.type, this.buildSpec());
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('type'))) { const __watchVal = (() => this.type)(); (() => {
      if (this.cv) this.cv.registerType(this.type, this.buildSpec());
    })(); }
    this.__rozieFirstUpdateDone = true;

    if (this.registered) return;
    const live = this.canvas;
    if (live == null) return;
    this.cv = live;
    this.registered = true;
    this.cv.registerType(this.type, this.buildSpec());
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

<div class="rozie-node-type-children" style="display:none" data-rozie-s-372f9492><slot></slot></div>
`;
  }

  cv: any = null;

  bodyHandle: any = null;

  mountBody: any = null;

  registered = false;

  buildSpec = () => ({
  type: this.type,
  // RENDER-BY-TYPE callback: the canvas hands the engine body host + scope; delegate
  // to the mountBody closure (defined inside $onMount so it can see the emitter's
  // mount-scoped `portals` local). Until $onMount has run, mountBody is null — but
  // the canvas only invokes bodyRenderer AFTER reconcileNodes (post-register,
  // post-mount), so mountBody is always set by then. Returns the { dispose } handle.
  bodyRenderer: (host: any, scope: any) => {
    // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html "cannot
    // find node" when re-rendering into an engine-owned host the area re-created)
    // can NEVER abort the canvas's renderNode loop — a thrown bodyRenderer would
    // propagate out of area.update/addNode and stop the whole graph from building.
    if (host && this.mountBody) {
      try {
        return this.mountBody(host, scope);
      } catch (e: any) {}
    }
    return null;
  }
});
}
