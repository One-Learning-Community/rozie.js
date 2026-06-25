import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_maplibre_source = createContext(Symbol.for("rozie:maplibre:source"));

const __rozieCtx_maplibre_layers = createContext(Symbol.for("rozie:maplibre:layers"));

@customElement('rozie-layer')
export default class Layer extends SignalWatcher(LitElement) {
  /**
   * The MapLibre layer id (required). Identifies the layer in the parent `<MapLibre>` registry and the underlying style.
   * @example
   * <Layer id="circles" type="circle" :paint="{ 'circle-radius': 5 }" />
   */
  @property({ type: String, reflect: true }) id!: string;
  /**
   * The `LayerSpecification.type` — `'circle'` / `'fill'` / `'line'` / `'symbol'` / `'raster'` / `'background'` / … A `'background'` layer needs no source; every other type requires a `source` (explicit or injected from a parent `<Source>`).
   */
  @property({ type: String, reflect: true }) type: string = undefined;
  /**
   * The layer's `paint` properties (the `LayerSpecification.paint` object, e.g. `{ 'line-color': '#e11', 'line-width': 3 }`). Changes are reconciled via `setPaintProperty` with no remount.
   */
  @property({ type: Object }) paint: unknown = undefined;
  /**
   * The layer's `layout` properties (the `LayerSpecification.layout` object, e.g. `{ 'line-cap': 'round' }`). Changes are reconciled via `setLayoutProperty` with no remount.
   */
  @property({ type: Object }) layout: unknown = undefined;
  /**
   * Explicit source id for the flat shape (a background layer needs none, or a cross-source reference). When omitted inside a `<Source>`, the injected source context supplies the id automatically.
   */
  @property({ type: String, reflect: true }) source: string = undefined;
  /**
   * Insert this layer immediately **before** the layer with this id, controlling draw order (the `addLayer` `beforeId` argument). Omit to append on top.
   */
  @property({ type: String, reflect: true }) beforeId: string = undefined;
private __rozieWatchInitial_0 = true;
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

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.resolveSource())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((src: any) => {
      if (!this.reg || src == null || src === this.appliedSource) return;
      this.appliedSource = src;
      this.reg.update(this.id, this.buildSpec());
    })(__watchVal); }); }));

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
