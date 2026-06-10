import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_maplibre_source = createContext(Symbol.for("rozie:maplibre:source"));

const __rozieCtx_maplibre_layers = createContext(Symbol.for("rozie:maplibre:layers"));

@customElement('rozie-layer')
export default class Layer extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) id!: string;
  @property({ type: String, reflect: true }) type: string = undefined;
  @property({ type: Object }) paint: unknown = undefined;
  @property({ type: Object }) layout: unknown = undefined;
  @property({ type: String, reflect: true }) source: string = undefined;
  @property({ type: String, reflect: true }) beforeId: string = undefined;
private __rozieFirstUpdateDone = false;
private __rozieCtxConsumer_maplibre_source = new ContextConsumer(this, { context: __rozieCtx_maplibre_source, subscribe: true });
private get srcCtx() { return this.__rozieCtxConsumer_maplibre_source.value ?? null; }
private __rozieCtxConsumer_maplibre_layers = new ContextConsumer(this, { context: __rozieCtx_maplibre_layers, subscribe: true });
private get layers() { return this.__rozieCtxConsumer_maplibre_layers.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this.reg = this.layers;
    this.ctx = this.srcCtx;

    // Effective source id: explicit prop wins, else the nearest <Source> ancestor id,
    // else undefined (a sourceless layer e.g. background). Reads the LIVE `ctx`/`srcCtx`
    // at CALL time so a late-resolving <Source> context (parent mounts AFTER this child
    // on React/Vue/Svelte/Angular; async on Lit) is picked up on re-register. `ctx` is
    // the `any` alias so the `.id` read type-checks on the strict bundled leaves.

    this._disconnectCleanups.push((() => {
      if (this.reg) this.reg.unregister(this.id);
    }));

    if (this.reg) {
      this.didRegister = true;
      this.appliedSource = this.resolveSource();
      this.reg.register(this.id, this.buildSpec());
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('paint'))) { const __watchVal = (() => this.paint)(); (() => {
      if (this.reg) this.reg.update(this.id, {
        id: this.id,
        type: this.type,
        paint: this.paint,
        layout: this.layout,
        source: this.resolveSource(),
        beforeId: this.beforeId
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('layout'))) { const __watchVal = (() => this.layout)(); (() => {
      if (this.reg) this.reg.update(this.id, {
        id: this.id,
        type: this.type,
        paint: this.paint,
        layout: this.layout,
        source: this.resolveSource(),
        beforeId: this.beforeId
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('type'))) { const __watchVal = (() => this.type)(); (() => {
      if (this.reg) this.reg.update(this.id, {
        id: this.id,
        type: this.type,
        paint: this.paint,
        layout: this.layout,
        source: this.resolveSource(),
        beforeId: this.beforeId
      });
    })(); }
    this.__rozieFirstUpdateDone = true;

    const live = this.layers;
    if (!live) return;
    if (!this.reg) this.reg = live;
    const src = this.resolveSource();
    if (!this.didRegister) {
      this.didRegister = true;
      this.appliedSource = src;
      this.reg.register(this.id, this.buildSpec());
      return;
    }
    if (src != null && src !== this.appliedSource) {
      this.appliedSource = src;
      this.reg.update(this.id, this.buildSpec());
    }
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
    return html``;
  }

  reg: any = null;

  ctx: any = null;

  resolveSource = () => this.source ?? (this.ctx && this.ctx.id);

  appliedSource: any = null;

  didRegister = false;

  buildSpec = () => ({
  id: this.id,
  type: this.type,
  paint: this.paint,
  layout: this.layout,
  source: this.resolveSource(),
  beforeId: this.beforeId
});
}
