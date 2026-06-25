import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { adoptDocumentStyles, createLitControllableProperty, injectGlobalStyles } from '@rozie/runtime-lit';
import { ContextProvider, createContext } from '@lit/context';
import maplibregl from 'maplibre-gl';

const __rozieCtx_maplibre_sources = createContext(Symbol.for("rozie:maplibre:sources"));

const __rozieCtx_maplibre_layers = createContext(Symbol.for("rozie:maplibre:layers"));

interface RozieMarkerSlotCtx {
  marker: unknown;
  index: unknown;
}

interface RoziePopupSlotCtx {
  popup: unknown;
  index: unknown;
}

interface RozieControlSlotCtx {
  map: unknown;
}

@customElement('rozie-map-libre')
export default class MapLibre extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-maplibre[data-rozie-s-f1ee1082] {
  width: 100%;
  height: 100%;
  min-height: 300px;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
}
.rozie-maplibre .rozie-maplibre-marker {
    cursor: pointer;
  }
.rozie-maplibre .rozie-maplibre-control {
    display: flex;
    flex-direction: column;
  }
`;

  /**
   * The map center as `[lng, lat]` — **longitude first** (MapLibre's convention, not Leaflet's `[lat, lng]`). Two-way: panning the map writes the new center back through the model path (echo-guarded), and a consumer write `easeTo`s the live map. The `moveend` echo reads `getCenter()` as `[lng, lat]`.
   * @example
   * <MapLibre r-model:center="center" r-model:zoom="zoom" />
   */
  @property({ type: Array, attribute: 'center' }) _center_attr: any[] = [0, 0];
  private _centerControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'center-change', defaultValue: [0, 0], initialControlledValue: undefined });
  /**
   * The zoom level. Two-way: scroll / pinch writes the new zoom back, and a consumer write `easeTo`s the camera. Echo-guarded against the wrapper's own programmatic moves.
   */
  @property({ type: Number, attribute: 'zoom' }) _zoom_attr: number = 1;
  private _zoomControllable = createLitControllableProperty<number>({ host: this, eventName: 'zoom-change', defaultValue: 1, initialControlledValue: undefined });
  /**
   * The map rotation (bearing) in degrees. Two-way via the `rotateend` echo and the `easeTo` reconcile.
   */
  @property({ type: Number, attribute: 'bearing' }) _bearing_attr: number = 0;
  private _bearingControllable = createLitControllableProperty<number>({ host: this, eventName: 'bearing-change', defaultValue: 0, initialControlledValue: undefined });
  /**
   * The map tilt (pitch) in degrees. Two-way via the `pitchend` echo and the `easeTo` reconcile.
   */
  @property({ type: Number, attribute: 'pitch' }) _pitch_attr: number = 0;
  private _pitchControllable = createLitControllableProperty<number>({ host: this, eventName: 'pitch-change', defaultValue: 0, initialControlledValue: undefined });
  /**
   * The map style — a `StyleSpecification` object **or** a style-URL string. Named `mapStyle` (not `style`) because `style` is a reserved attribute across the targets — `react-map-gl` and `vue-maplibre-gl` use the same name for the same reason. Defaults to MapLibre's official no-token demo tiles, so the component "just works" with zero config. Changing it calls `setStyle` and re-applies your `sources` / `layers` once the new style loads.
   */
  @property({ type: Object }) mapStyle: unknown = undefined;
  /**
   * Minimum zoom level. Applied at construction and via `setMinZoom` on change.
   */
  @property({ type: Number, reflect: true }) minZoom: number = 0;
  /**
   * Maximum zoom level. Applied at construction and via `setMaxZoom` on change.
   */
  @property({ type: Number, reflect: true }) maxZoom: number = 22;
  /**
   * A `LngLatBoundsLike` the camera is constrained to. Applied via `setMaxBounds` on change (pass `undefined` to clear).
   */
  @property({ type: Object }) maxBounds: unknown = undefined;
  /**
   * **Construction-only** initial fit — a `LngLatBoundsLike` the map fits to on mount (overrides `center` / `zoom` when set). Pair with `fitBoundsOptions`.
   */
  @property({ type: Object }) bounds: unknown = undefined;
  /**
   * **Construction-only** options for the initial `bounds` fit (padding, max-zoom, etc.).
   */
  @property({ type: Object }) fitBoundsOptions: any = {};
  /**
   * Toggle drag-to-pan. Applied at construction and reconciled live via the handler's `enable()` / `disable()`.
   */
  @property({ type: Boolean, reflect: true }) dragPan: boolean = true;
  /**
   * Toggle right-drag / ctrl-drag rotation. Applied at construction and reconciled live.
   */
  @property({ type: Boolean, reflect: true }) dragRotate: boolean = true;
  /**
   * Toggle scroll-wheel zoom. Applied at construction and reconciled live.
   */
  @property({ type: Boolean, reflect: true }) scrollZoom: boolean = true;
  /**
   * Toggle double-click zoom. Applied at construction and reconciled live.
   */
  @property({ type: Boolean, reflect: true }) doubleClickZoom: boolean = true;
  /**
   * Toggle shift-drag box zoom. Applied at construction and reconciled live.
   */
  @property({ type: Boolean, reflect: true }) boxZoom: boolean = true;
  /**
   * Toggle keyboard navigation. Applied at construction and reconciled live.
   */
  @property({ type: Boolean, reflect: true }) keyboard: boolean = true;
  /**
   * Toggle touch pinch-zoom + rotate. Applied at construction and reconciled live.
   */
  @property({ type: Boolean, reflect: true }) touchZoomRotate: boolean = true;
  /**
   * Toggle two-finger touch pitch. Applied at construction and reconciled live.
   */
  @property({ type: Boolean, reflect: true }) touchPitch: boolean = true;
  /**
   * The marker data that drives the reactive multi-instance `marker` slot — one entry per marker (`{ lng, lat, id?, anchor?, offset?, draggable?, ... }`). One portal handle mounts per entry; changing the array reconciles markers keep / update / dispose with no remount. Only meaningful when the `marker` slot is filled.
   */
  @property({ type: Array }) markers: any[] = [];
  /**
   * The popup data that drives the reactive multi-instance `popup` slot — one entry per popup (`{ lng, lat, id?, anchor?, offset?, closeButton?, closeOnClick?, ... }`). One portal handle mounts per entry. Only meaningful when the `popup` slot is filled.
   */
  @property({ type: Array }) popups: any[] = [];
  /**
   * Declarative GeoJSON / vector / raster sources — `[{ id, spec }]` (or a bare `SourceSpecification` carrying an `id`). Reconciled into the live style (add / `setData` / remove) once the style has loaded. The config-array authoring shape for sources; declarative `<Source>` / `<Layer>` children are the alternative shape (both feed the same registry).
   */
  @property({ type: Array }) sources: any[] = [];
  /**
   * Declarative layers — `LayerSpecification[]` (each with an `id`). Reconciled into the live style (add / `setPaintProperty` / `setLayoutProperty` / remove) once the style has loaded; `beforeId` controls draw order.
   */
  @property({ type: Array }) layers: any[] = [];
  /**
   * Layer ids whose feature `mouseenter` / `mouseleave` fire the `@mouseenter` / `@mouseleave` events (populating `e.features`). Registered / unregistered per id on change.
   */
  @property({ type: Array }) interactiveLayerIds: any[] = [];
  /**
   * Standard map controls — strings (`'navigation'` / `'geolocate'` / `'scale'` / `'fullscreen'` / `'attribution'`) or `{ type, position?, options? }` objects. Reconciled (remove-all + re-add) on change.
   */
  @property({ type: Array }) controls: any[] = [];
  /**
   * The raw `MapOptions` passthrough — spread into the `Map` constructor **before** the curated keys, so explicit props win. The MapLibre analog of an options bag for anything the curated surface doesn't special-case.
   */
  @property({ type: Object }) options: any = {};
  private _sourceReg = signal({});
  private _layerReg = signal({});
  @query('[data-rozie-ref="containerEl"]') private _refContainerEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieWatchInitial_1 = true;
private __rozieWatchInitial_2 = true;
private __rozieWatchInitial_3 = true;
private __rozieWatchInitial_12 = true;
private __rozieWatchInitial_13 = true;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();
private __rozieCtxProvider_maplibre_sources = new ContextProvider(this, { context: __rozieCtx_maplibre_sources, initialValue: ((__rozieCtxHost) => ({
  register: (id: any, spec: any) => {
    __rozieCtxHost._sourceReg.value = {
      ...__rozieCtxHost._sourceReg.value,
      [id]: spec
    };
  },
  update: (id: any, spec: any) => {
    __rozieCtxHost._sourceReg.value = {
      ...__rozieCtxHost._sourceReg.value,
      [id]: spec
    };
  },
  unregister: (id: any) => {
    const n = {
      ...__rozieCtxHost._sourceReg.value
    };
    delete n[id];
    __rozieCtxHost._sourceReg.value = n;
  }
}))(this) });
private __rozieCtxProvider_maplibre_layers = new ContextProvider(this, { context: __rozieCtx_maplibre_layers, initialValue: ((__rozieCtxHost) => ({
  register: (id: any, spec: any) => {
    __rozieCtxHost._layerReg.value = {
      ...__rozieCtxHost._layerReg.value,
      [id]: spec
    };
  },
  update: (id: any, spec: any) => {
    __rozieCtxHost._layerReg.value = {
      ...__rozieCtxHost._layerReg.value,
      [id]: spec
    };
  },
  unregister: (id: any) => {
    const n = {
      ...__rozieCtxHost._layerReg.value
    };
    delete n[id];
    __rozieCtxHost._layerReg.value = n;
  }
}))(this) });

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @state() private _hasSlotMarker = false;
  @queryAssignedElements({ slot: 'marker', flatten: true }) private _slotMarkerElements!: Element[];
  @property({ attribute: false }) marker?: (scope: { marker: unknown; index: unknown }) => unknown;
  @state() private _hasSlotPopup = false;
  @queryAssignedElements({ slot: 'popup', flatten: true }) private _slotPopupElements!: Element[];
  @property({ attribute: false }) popup?: (scope: { popup: unknown; index: unknown }) => unknown;
  @state() private _hasSlotControl = false;
  @queryAssignedElements({ slot: 'control', flatten: true }) private _slotControlElements!: Element[];
  @property({ attribute: false }) control?: (scope: { map: unknown }) => unknown;

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

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="marker"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotMarker = this._slotMarkerElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="popup"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotPopup = this._slotPopupElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="control"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotControl = this._slotControlElements.length > 0; };
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
    this._hasSlotMarker = Array.from(this.children).some((el) => el.getAttribute('slot') === 'marker');
    this._hasSlotPopup = Array.from(this.children).some((el) => el.getAttribute('slot') === 'popup');
    this._hasSlotControl = Array.from(this.children).some((el) => el.getAttribute('slot') === 'control');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    adoptDocumentStyles(this);

    this._armListeners();

    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      marker: (container: HTMLElement, scope: { marker: unknown; index: unknown }): ReactivePortalHandle => {
        const tpl = this.marker;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-marker', 'f1ee1082');
        const renderScope = (s: { marker: unknown; index: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { marker: unknown; index: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
      popup: (container: HTMLElement, scope: { popup: unknown; index: unknown }): ReactivePortalHandle => {
        const tpl = this.popup;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-popup', 'f1ee1082');
        const renderScope = (s: { popup: unknown; index: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { popup: unknown; index: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
      control: (container: HTMLElement, scope: { map: unknown }): (() => void) => {
        const tpl = this.control;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-control', 'f1ee1082');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
    };

    this._disconnectCleanups.push((() => {
      for (const [, entry] of this.markerEntries as any) {
        entry.handle.dispose();
        entry.engine.remove();
      }
      this.markerEntries.clear();
      for (const [, entry] of this.popupEntries as any) {
        entry.handle.dispose();
        entry.engine.remove();
      }
      this.popupEntries.clear();
      if (this.controlDispose) this.controlDispose();
      if (this.instance) this.instance.remove();
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.center)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (!this.instance || !Array.isArray(v) || v.length !== 2) return;
      const c = this.instance.getCenter();
      if (v[0] === c.lng && v[1] === c.lat) return;
      this.instance.easeTo({
        center: v,
        animate: false
      }, this.PROGRAMMATIC);
    })(__watchVal); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.zoom)(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => {
      if (!this.instance || typeof v !== 'number' || v === this.instance.getZoom()) return;
      this.instance.easeTo({
        zoom: v,
        animate: false
      }, this.PROGRAMMATIC);
    })(__watchVal); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.bearing)(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } ((v: any) => {
      if (!this.instance || typeof v !== 'number' || v === this.instance.getBearing()) return;
      this.instance.easeTo({
        bearing: v,
        animate: false
      }, this.PROGRAMMATIC);
    })(__watchVal); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.pitch)(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (!this.instance || typeof v !== 'number' || v === this.instance.getPitch()) return;
      this.instance.easeTo({
        pitch: v,
        animate: false
      }, this.PROGRAMMATIC);
    })(__watchVal); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._sourceReg.value)(); untracked(() => { if (this.__rozieWatchInitial_12) { this.__rozieWatchInitial_12 = false; return; } (() => this.applyLayers())(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._layerReg.value)(); untracked(() => { if (this.__rozieWatchInitial_13) { this.__rozieWatchInitial_13 = false; return; } (() => this.applyLayers())(); }); }));

    this._disconnectCleanups.push(effect(() => { void this._sourceReg.value; this.__rozieCtxProvider_maplibre_sources.setValue(((__rozieCtxHost) => ({
      register: (id: any, spec: any) => {
        __rozieCtxHost._sourceReg.value = {
          ...__rozieCtxHost._sourceReg.value,
          [id]: spec
        };
      },
      update: (id: any, spec: any) => {
        __rozieCtxHost._sourceReg.value = {
          ...__rozieCtxHost._sourceReg.value,
          [id]: spec
        };
      },
      unregister: (id: any) => {
        const n = {
          ...__rozieCtxHost._sourceReg.value
        };
        delete n[id];
        __rozieCtxHost._sourceReg.value = n;
      }
    }))(this)); }));
    this._disconnectCleanups.push(effect(() => { void this._layerReg.value; this.__rozieCtxProvider_maplibre_layers.setValue(((__rozieCtxHost) => ({
      register: (id: any, spec: any) => {
        __rozieCtxHost._layerReg.value = {
          ...__rozieCtxHost._layerReg.value,
          [id]: spec
        };
      },
      update: (id: any, spec: any) => {
        __rozieCtxHost._layerReg.value = {
          ...__rozieCtxHost._layerReg.value,
          [id]: spec
        };
      },
      unregister: (id: any) => {
        const n = {
          ...__rozieCtxHost._layerReg.value
        };
        delete n[id];
        __rozieCtxHost._layerReg.value = n;
      }
    }))(this)); }));

    const el = this._refContainerEl;

    // seed the null-let tracking arrays (declared null so typeNeutralize types them
    // `any`; the reconcile/teardown code only runs after this mount init).
    // seed the null-let tracking arrays (declared null so typeNeutralize types them
    // `any`; the reconcile/teardown code only runs after this mount init).
    this.controlInstances = [];
    this.appliedLayerIds = [];
    this.appliedSourceIds = [];

    // mapOptions is a null-let so the bundled-leaf typeNeutralize pass annotates it
    // `any` — MapLibre's MapOptions strict-types center (LngLatLike tuple), style
    // (string|StyleSpecification) and maxBounds/bounds (LngLatBoundsLike), which the
    // loosely-typed .rozie props (any[] / unknown) don't satisfy under the strict
    // react/solid/lit tsc. Routing the construction through an `any` options object
    // is the .rozie-native fix (no codegen type-aid, no lang="ts") — the same
    // null-let idiom `let instance = null` already relies on.
    // mapOptions is a null-let so the bundled-leaf typeNeutralize pass annotates it
    // `any` — MapLibre's MapOptions strict-types center (LngLatLike tuple), style
    // (string|StyleSpecification) and maxBounds/bounds (LngLatBoundsLike), which the
    // loosely-typed .rozie props (any[] / unknown) don't satisfy under the strict
    // react/solid/lit tsc. Routing the construction through an `any` options object
    // is the .rozie-native fix (no codegen type-aid, no lang="ts") — the same
    // null-let idiom `let instance = null` already relies on.
    let mapOptions: any = null;
    mapOptions = {
      container: el,
      ...this.options,
      style: this.mapStyle ?? this.DEFAULT_STYLE,
      center: this.center,
      zoom: this.zoom,
      bearing: this.bearing,
      pitch: this.pitch,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      maxBounds: this.maxBounds,
      bounds: this.bounds,
      fitBoundsOptions: this.fitBoundsOptions,
      dragPan: this.dragPan,
      dragRotate: this.dragRotate,
      scrollZoom: this.scrollZoom,
      doubleClickZoom: this.doubleClickZoom,
      boxZoom: this.boxZoom,
      keyboard: this.keyboard,
      touchZoomRotate: this.touchZoomRotate,
      touchPitch: this.touchPitch
    };
    this.instance = new maplibregl.Map(mapOptions);

    // ─── forward map events ─────────────────────────────────────────────────
    // NOTE: the CONTINUOUS `zoom` and `pitch` events are deliberately NOT forwarded
    // — `zoom` and `pitch` are also two-way `model: true` camera props, and a same-
    // named emit collides with the model on Vue (defineModel vs defineEmits) and
    // Angular (ModelSignal vs OutputEmitterRef). The two-way binding already conveys
    // zoom/pitch changes; consumers wanting an event get the terminal `zoomend` /
    // `pitchend` below. `move`/`rotate` have no such clash (the models are `center`
    // and `bearing`, not `move`/`rotate`), so those continuous events stay.
    // ─── forward map events ─────────────────────────────────────────────────
    // NOTE: the CONTINUOUS `zoom` and `pitch` events are deliberately NOT forwarded
    // — `zoom` and `pitch` are also two-way `model: true` camera props, and a same-
    // named emit collides with the model on Vue (defineModel vs defineEmits) and
    // Angular (ModelSignal vs OutputEmitterRef). The two-way binding already conveys
    // zoom/pitch changes; consumers wanting an event get the terminal `zoomend` /
    // `pitchend` below. `move`/`rotate` have no such clash (the models are `center`
    // and `bearing`, not `move`/`rotate`), so those continuous events stay.
    this.instance.on('load', (e: any) => this.dispatchEvent(new CustomEvent("load", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('idle', (e: any) => this.dispatchEvent(new CustomEvent("idle", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('move', (e: any) => this.dispatchEvent(new CustomEvent("move", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('rotate', (e: any) => this.dispatchEvent(new CustomEvent("rotate", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('dragstart', (e: any) => this.dispatchEvent(new CustomEvent("dragstart", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('drag', (e: any) => this.dispatchEvent(new CustomEvent("drag", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('dragend', (e: any) => this.dispatchEvent(new CustomEvent("dragend", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('click', (e: any) => this.dispatchEvent(new CustomEvent("click", {
      detail: this.payload(e),
      bubbles: true,
      composed: true
    })));
    this.instance.on('dblclick', (e: any) => this.dispatchEvent(new CustomEvent("dblclick", {
      detail: this.payload(e),
      bubbles: true,
      composed: true
    })));
    this.instance.on('contextmenu', (e: any) => this.dispatchEvent(new CustomEvent("contextmenu", {
      detail: this.payload(e),
      bubbles: true,
      composed: true
    })));
    this.instance.on('mousemove', (e: any) => this.dispatchEvent(new CustomEvent("mousemove", {
      detail: this.payload(e),
      bubbles: true,
      composed: true
    })));
    this.instance.on('error', (e: any) => this.dispatchEvent(new CustomEvent("error", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('styledata', (e: any) => this.dispatchEvent(new CustomEvent("styledata", {
      detail: e,
      bubbles: true,
      composed: true
    })));
    this.instance.on('sourcedata', (e: any) => this.dispatchEvent(new CustomEvent("sourcedata", {
      detail: e,
      bubbles: true,
      composed: true
    })));

    // ─── camera-lifecycle + two-way echo (echo-guarded) ─────────────────────
    // ─── camera-lifecycle + two-way echo (echo-guarded) ─────────────────────
    this.instance.on('moveend', (e: any) => {
      this.dispatchEvent(new CustomEvent("moveend", {
        detail: e,
        bubbles: true,
        composed: true
      }));
      if (e.rozieProgrammatic) return;
      const c = this.instance.getCenter();
      const next = [c.lng, c.lat];
      if (!this.sameCenter(next, this.center)) this._centerControllable.write(next);
      const z = this.instance.getZoom();
      if (z !== this.zoom) this._zoomControllable.write(z);
    });
    this.instance.on('zoomend', (e: any) => {
      this.dispatchEvent(new CustomEvent("zoomend", {
        detail: e,
        bubbles: true,
        composed: true
      }));
      if (e.rozieProgrammatic) return;
      const z = this.instance.getZoom();
      if (z !== this.zoom) this._zoomControllable.write(z);
    });
    this.instance.on('rotateend', (e: any) => {
      this.dispatchEvent(new CustomEvent("rotateend", {
        detail: e,
        bubbles: true,
        composed: true
      }));
      if (e.rozieProgrammatic) return;
      const b = this.instance.getBearing();
      if (b !== this.bearing) this._bearingControllable.write(b);
    });
    this.instance.on('pitchend', (e: any) => {
      this.dispatchEvent(new CustomEvent("pitchend", {
        detail: e,
        bubbles: true,
        composed: true
      }));
      if (e.rozieProgrammatic) return;
      const p = this.instance.getPitch();
      if (p !== this.pitch) this._pitchControllable.write(p);
    });

    // ─── REACTIVE MULTI-INSTANCE marker portal slot ─────────────────────────
    // One reactive portal handle per markers[] entry, reconciled keep/update/dispose
    // on prop change. Built here so $portals.marker is in the mount scope; bridged
    // to the top-level $watch via reconcileMarkers (CM rebuildGutterExt discipline).
    // ─── REACTIVE MULTI-INSTANCE marker portal slot ─────────────────────────
    // One reactive portal handle per markers[] entry, reconciled keep/update/dispose
    // on prop change. Built here so $portals.marker is in the mount scope; bridged
    // to the top-level $watch via reconcileMarkers (CM rebuildGutterExt discipline).
    this.reconcileMarkers = (list: any) => {
      if (!(this.marker !== undefined)) return;
      const arr = Array.isArray(list) ? list : [];
      const seen = new Set();
      arr.forEach((m: any, index: any) => {
        if (!m || typeof m.lng !== 'number' || typeof m.lat !== 'number') return;
        const key = m.id != null ? m.id : index;
        seen.add(key);
        const scope = {
          marker: m,
          index
        };
        const entry = this.markerEntries.get(key);
        if (entry) {
          entry.engine.setLngLat([m.lng, m.lat]);
          entry.handle.update(scope);
        } else {
          const node = document.createElement('div');
          node.className = 'rozie-maplibre-marker';
          const handle = portals.marker(node, scope);
          const engine = new maplibregl.Marker({
            element: node,
            anchor: m.anchor,
            offset: m.offset,
            draggable: m.draggable
          }).setLngLat([m.lng, m.lat]).addTo(this.instance);
          this.markerEntries.set(key, {
            engine,
            handle,
            el: node
          });
        }
      });
      for (const [key, entry] of this.markerEntries as any) {
        if (!seen.has(key)) {
          entry.handle.dispose();
          entry.engine.remove();
          this.markerEntries.delete(key);
        }
      }
    };

    // ─── REACTIVE MULTI-INSTANCE popup portal slot ──────────────────────────
    // ─── REACTIVE MULTI-INSTANCE popup portal slot ──────────────────────────
    this.reconcilePopups = (list: any) => {
      if (!(this.popup !== undefined)) return;
      const arr = Array.isArray(list) ? list : [];
      const seen = new Set();
      arr.forEach((p: any, index: any) => {
        if (!p || typeof p.lng !== 'number' || typeof p.lat !== 'number') return;
        const key = p.id != null ? p.id : index;
        seen.add(key);
        const scope = {
          popup: p,
          index
        };
        const entry = this.popupEntries.get(key);
        if (entry) {
          entry.engine.setLngLat([p.lng, p.lat]);
          entry.handle.update(scope);
        } else {
          const node = document.createElement('div');
          node.className = 'rozie-maplibre-popup-body';
          const handle = portals.popup(node, scope);
          const engine = new maplibregl.Popup({
            closeButton: p.closeButton !== undefined ? p.closeButton : true,
            closeOnClick: p.closeOnClick !== undefined ? p.closeOnClick : false,
            anchor: p.anchor,
            offset: p.offset
          }).setLngLat([p.lng, p.lat]).setDOMContent(node).addTo(this.instance);
          this.popupEntries.set(key, {
            engine,
            handle,
            el: node
          });
        }
      });
      for (const [key, entry] of this.popupEntries as any) {
        if (!seen.has(key)) {
          entry.handle.dispose();
          entry.engine.remove();
          this.popupEntries.delete(key);
        }
      }
    };

    // ─── layer-scoped feature mouseenter/mouseleave (needs a layer id) ───────
    // ─── layer-scoped feature mouseenter/mouseleave (needs a layer id) ───────
    this.reconcileInteractive = (ids: any) => {
      const want = (Array.isArray(ids) ? ids : []).filter(Boolean);
      for (const [id, l] of this.featureListeners as any) {
        if (!want.includes(id)) {
          this.instance.off('mouseenter', id, l.enter);
          this.instance.off('mouseleave', id, l.leave);
          this.featureListeners.delete(id);
        }
      }
      for (const id of want as any) {
        if (this.featureListeners.has(id)) continue;
        const enter = (e: any) => this.dispatchEvent(new CustomEvent("mouseenter", {
          detail: this.payload(e),
          bubbles: true,
          composed: true
        }));
        const leave = (e: any) => this.dispatchEvent(new CustomEvent("mouseleave", {
          detail: this.payload(e),
          bubbles: true,
          composed: true
        }));
        this.instance.on('mouseenter', id, enter);
        this.instance.on('mouseleave', id, leave);
        this.featureListeners.set(id, {
          enter,
          leave
        });
      }
    };

    // ─── mount-once custom CONTROL portal slot ──────────────────────────────
    // ─── mount-once custom CONTROL portal slot ──────────────────────────────
    if (this.control !== undefined) {
      const host = document.createElement('div');
      host.className = 'maplibregl-ctrl rozie-maplibre-control';
      this.customControl = {
        onAdd() {
          return host;
        },
        onRemove() {
          if (host.parentNode) host.parentNode.removeChild(host);
        }
      };
      this.instance.addControl(this.customControl, 'top-right');
      this.controlDispose = portals.control(host, {
        map: this.instance
      });
    }

    // standard controls + interaction toggles don't need style load.
    // standard controls + interaction toggles don't need style load.
    this.applyControls();
    this.applyInteractionToggles();

    // markers/popups/interactive are DOM/event overlays — no style-load gate.
    // markers/popups/interactive are DOM/event overlays — no style-load gate.
    this.reconcileMarkers(this.markers);
    this.reconcilePopups(this.popups);
    this.reconcileInteractive(this.interactiveLayerIds);

    // sources/layers need the style loaded.
    // sources/layers need the style loaded.
    if (this.instance.isStyleLoaded()) this.applyLayers();else this.instance.on('load', this.applyLayers);
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('mapStyle'))) { const __watchVal = (() => this.mapStyle)(); ((v: any) => {
      if (!this.instance) return;
      // a new style wipes imperatively-added sources/layers — reset the applied
      // tracking and re-apply once the new style loads.
      this.appliedLayerIds = [];
      this.appliedSourceIds = [];
      this.instance.setStyle(v ?? this.DEFAULT_STYLE);
      this.instance.once('styledata', () => this.applyLayers());
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('minZoom'))) { const __watchVal = (() => this.minZoom)(); ((v: any) => {
      if (this.instance && typeof v === 'number') this.instance.setMinZoom(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('maxZoom'))) { const __watchVal = (() => this.maxZoom)(); ((v: any) => {
      if (this.instance && typeof v === 'number') this.instance.setMaxZoom(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('maxBounds'))) { const __watchVal = (() => this.maxBounds)(); ((v: any) => {
      if (this.instance) this.instance.setMaxBounds(v || null);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('markers'))) { const __watchVal = (() => this.markers)(); ((v: any) => {
      if (this.reconcileMarkers) this.reconcileMarkers(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('popups'))) { const __watchVal = (() => this.popups)(); ((v: any) => {
      if (this.reconcilePopups) this.reconcilePopups(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('sources'))) { const __watchVal = (() => this.sources)(); (() => this.applyLayers())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('layers'))) { const __watchVal = (() => this.layers)(); (() => this.applyLayers())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('interactiveLayerIds'))) { const __watchVal = (() => this.interactiveLayerIds)(); ((v: any) => {
      if (this.reconcileInteractive) this.reconcileInteractive(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('controls'))) { const __watchVal = (() => this.controls)(); (() => this.applyControls())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('dragPan'))) { const __watchVal = (() => this.dragPan)(); (() => this.applyInteractionToggles())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('dragRotate'))) { const __watchVal = (() => this.dragRotate)(); (() => this.applyInteractionToggles())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('scrollZoom'))) { const __watchVal = (() => this.scrollZoom)(); (() => this.applyInteractionToggles())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('doubleClickZoom'))) { const __watchVal = (() => this.doubleClickZoom)(); (() => this.applyInteractionToggles())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('boxZoom'))) { const __watchVal = (() => this.boxZoom)(); (() => this.applyInteractionToggles())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('keyboard'))) { const __watchVal = (() => this.keyboard)(); (() => this.applyInteractionToggles())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('touchZoomRotate'))) { const __watchVal = (() => this.touchZoomRotate)(); (() => this.applyInteractionToggles())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('touchPitch'))) { const __watchVal = (() => this.touchPitch)(); (() => this.applyInteractionToggles())(); }
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
    if (name === 'center') this._centerControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'zoom') this._zoomControllable.notifyAttributeChange(value === null ? 1 : Number(value));
    if (name === 'bearing') this._bearingControllable.notifyAttributeChange(value === null ? 0 : Number(value));
    if (name === 'pitch') this._pitchControllable.notifyAttributeChange(value === null ? 0 : Number(value));
  }

  render() {
    return html`
<div class="rozie-maplibre" data-rozie-ref="containerEl" data-rozie-s-f1ee1082></div>

<slot></slot>

<slot name="marker"></slot>

<slot name="popup"></slot>

<slot name="control"></slot>
`;
  }

  instance: any = null;

  DEFAULT_STYLE = 'https://demotiles.maplibre.org/style.json';

  PROGRAMMATIC = {
  rozieProgrammatic: true
};

  markerEntries = new Map();

  popupEntries = new Map();

  controlInstances: any = null;

  controlDispose: any = null;

  customControl: any = null;

  featureListeners = new Map();

  appliedLayerIds: any = null;

  appliedSourceIds: any = null;

  reconcileMarkers: any = null;

  reconcilePopups: any = null;

  reconcileInteractive: any = null;

  sameCenter = (a: any, b: any) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];

  payload = (e: any) => ({
  lngLat: e.lngLat ? {
    lng: e.lngLat.lng,
    lat: e.lngLat.lat
  } : null,
  point: e.point ? {
    x: e.point.x,
    y: e.point.y
  } : null,
  features: e.features || [],
  originalEvent: e.originalEvent
});

  buildControl = (spec: any) => {
  const type = typeof spec === 'string' ? spec : spec.type;
  const opts = typeof spec === 'object' && spec.options || {};
  if (type === 'navigation') return new maplibregl.NavigationControl(opts);
  if (type === 'geolocate') return new maplibregl.GeolocateControl(opts);
  if (type === 'scale') return new maplibregl.ScaleControl(opts);
  if (type === 'fullscreen') return new maplibregl.FullscreenControl(opts);
  if (type === 'attribution') return new maplibregl.AttributionControl(opts);
  return null;
};

  applyControls = () => {
  if (!this.instance) return;
  for (const c of this.controlInstances as any) this.instance.removeControl(c);
  this.controlInstances = [];
  for (const spec of this.controls as any) {
    if (!spec) continue;
    const ctrl = this.buildControl(spec);
    if (!ctrl) continue;
    const position = typeof spec === 'object' && spec.position || undefined;
    this.instance.addControl(ctrl, position);
    this.controlInstances.push(ctrl);
  }
};

  applyInteractionToggles = () => {
  if (!this.instance) return;
  const set = (name: any, on: any) => {
    const handler = this.instance[name];
    if (handler) on ? handler.enable() : handler.disable();
  };
  set('dragPan', this.dragPan);
  set('dragRotate', this.dragRotate);
  set('scrollZoom', this.scrollZoom);
  set('doubleClickZoom', this.doubleClickZoom);
  set('boxZoom', this.boxZoom);
  set('keyboard', this.keyboard);
  set('touchZoomRotate', this.touchZoomRotate);
  set('touchPitch', this.touchPitch);
};

  applyLayers = () => {
  if (!this.instance || !this.instance.isStyleLoaded()) return;

  // ─── union the config-array props with the declarative-children registry ────
  // (registry ∪ props), keyed by id. D-02: the registry (declarative children) is
  // the LAST writer and overrides the config-array on id collision. Ordering: array
  // entries first in array order, then registry entries in registration order —
  // `[...$props.layers, ...registryLayers]` — each still honoring its explicit
  // `beforeId` (the existing applyLayers ordering contract, REUSED unchanged,
  // RESEARCH OQ3). The empty-registry path is byte-equivalent to today: with both
  // registries empty, mergeById returns exactly the config array (dedup by id of
  // an array with no registry overrides is the array itself), so (∅ ∪ props) ===
  // props in behavior — the dist-parity zero-drift guarantee (RESEARCH A3).
  const mergeById = (arr: any, reg: any) => {
    // out seeded from the (any-typed) input so strict tsc infers any[] not never[]
    // (untyped <script> can't use a TS `: any[]`/`as any[]` annotation; .slice(0,0)
    //  yields an empty array with identical runtime behavior to `const out = []`).
    const out = (Array.isArray(arr) ? arr : []).slice(0, 0);
    const idx = new Map();
    for (const e of (Array.isArray(arr) ? arr : []) as any) {
      if (!e || !e.id) {
        out.push(e);
        continue;
      }
      if (idx.has(e.id)) {
        out[idx.get(e.id)] = e;
      } else {
        idx.set(e.id, out.length);
        out.push(e);
      }
    }
    for (const id in reg) {
      const e = reg[id];
      if (!e || !e.id) continue;
      if (idx.has(e.id)) {
        out[idx.get(e.id)] = e;
      } else {
        idx.set(e.id, out.length);
        out.push(e);
      }
    }
    return out;
  };
  const mergedSources = mergeById(this.sources, this._sourceReg.value);
  const mergedLayers = mergeById(this.layers, this._layerReg.value);
  const wantLayerIds = mergedLayers.map((l: any) => l && l.id).filter(Boolean);
  const wantSourceIds = mergedSources.map((s: any) => s && s.id).filter(Boolean);

  // 1. drop removed layers
  for (const id of this.appliedLayerIds as any) {
    if (!wantLayerIds.includes(id) && this.instance.getLayer(id)) this.instance.removeLayer(id);
  }
  // 2. add/update sources
  for (const s of mergedSources as any) {
    if (!s || !s.id) continue;
    const spec = s.spec || s;
    const existing = this.instance.getSource(s.id);
    if (!existing) this.instance.addSource(s.id, spec);else if (spec.type === 'geojson' && spec.data) existing.setData(spec.data);
  }
  // 3. add/update layers. DEFENSIVE: a non-background layer whose `source` is not
  // (yet) present in the engine is SKIPPED rather than added — a declarative
  // <Layer> may register before its <Source> parent has supplied the source id
  // (child-before-parent mount order on React/Vue/Svelte/Angular), in which case
  // addLayer would throw "source ... doesn't exist" / read null `.type` and abort
  // the whole loop (dropping later layers like `bg`). The <Layer> re-registers with
  // the resolved source on $onUpdate, re-running this reconcile, so the layer lands
  // on the next tick. Background layers need no source. addLayer is wrapped so any
  // single malformed spec can't abort the rest of the loop either.
  for (const l of mergedLayers as any) {
    if (!l || !l.id) continue;
    if (!this.instance.getLayer(l.id)) {
      const needsSource = l.type !== 'background';
      if (needsSource && (l.source == null || !this.instance.getSource(l.source))) continue;
      // Build a CLEAN LayerSpecification: a declarative <Layer> registry spec carries
      // a `beforeId` (not a LayerSpecification key — it is the addLayer 2nd arg) and
      // explicit `source: undefined` / `layout: undefined` keys (the prop defaults).
      // MapLibre v5 rejects a background layer that has ANY `source` key, and an
      // undefined `layout` — so emit only the keys MapLibre expects (the config-array
      // path is unaffected: those specs are already clean, this just re-emits them).
      // null-let → typeNeutralize `any` so the dynamic key assignments below
      // type-check on the strict bundled leaves (the `let x = null` idiom).
      let clean: any = null;
      clean = {
        id: l.id,
        type: l.type
      };
      if (needsSource) clean.source = l.source;
      if (l.paint != null) clean.paint = l.paint;
      if (l.layout != null) clean.layout = l.layout;
      if (l.sourceLayer != null) clean['source-layer'] = l.sourceLayer;
      if (l.filter != null) clean.filter = l.filter;
      if (l.minzoom != null) clean.minzoom = l.minzoom;
      if (l.maxzoom != null) clean.maxzoom = l.maxzoom;
      try {
        this.instance.addLayer(clean, l.beforeId);
      } catch (e: any) {
        // surfaced via the `error` emit path; skip so later layers still apply.
      }
    } else {
      if (l.paint) for (const k in l.paint) this.instance.setPaintProperty(l.id, k, l.paint[k]);
      if (l.layout) for (const k in l.layout) this.instance.setLayoutProperty(l.id, k, l.layout[k]);
    }
  }
  // 4. drop removed sources (their layers are gone)
  for (const id of this.appliedSourceIds as any) {
    if (!wantSourceIds.includes(id) && this.instance.getSource(id)) this.instance.removeSource(id);
  }
  this.appliedLayerIds = wantLayerIds;
  this.appliedSourceIds = wantSourceIds;
};

  getMap() {
    return this.instance;
  }

  flyTo(opts: any) {
    if (this.instance) this.instance.flyTo(opts);
  }

  easeTo(opts: any) {
    if (this.instance) this.instance.easeTo(opts);
  }

  jumpTo(opts: any) {
    if (this.instance) this.instance.jumpTo(opts);
  }

  fitBounds(bounds: any, opts: any) {
    if (this.instance) this.instance.fitBounds(bounds, opts);
  }

  getCenter() {
    if (!this.instance) return null;
    const c = this.instance.getCenter();
    return [c.lng, c.lat];
  }

  getZoom() {
    return this.instance ? this.instance.getZoom() : null;
  }

  resize() {
    if (this.instance) this.instance.resize();
  }

  queryRenderedFeatures(geometry: any, options: any) {
    return this.instance ? this.instance.queryRenderedFeatures(geometry, options) : [];
  }

  project(lngLat: any) {
    return this.instance ? this.instance.project(lngLat) : null;
  }

  unproject(point: any) {
    return this.instance ? this.instance.unproject(point) : null;
  }

  getBounds() {
    return this.instance ? this.instance.getBounds() : null;
  }

  zoomIn(opts: any) {
    if (this.instance) this.instance.zoomIn(opts);
  }

  zoomOut(opts: any) {
    if (this.instance) this.instance.zoomOut(opts);
  }

  panBy(offset: any, opts: any) {
    if (this.instance) this.instance.panBy(offset, opts);
  }

  get center(): any[] { return this._centerControllable.read(); }
  set center(v: any[]) { this._centerControllable.notifyPropertyWrite(v); }
  get zoom(): number { return this._zoomControllable.read(); }
  set zoom(v: number) { this._zoomControllable.notifyPropertyWrite(v); }
  get bearing(): number { return this._bearingControllable.read(); }
  set bearing(v: number) { this._bearingControllable.notifyPropertyWrite(v); }
  get pitch(): number { return this._pitchControllable.read(); }
  set pitch(v: number) { this._pitchControllable.notifyPropertyWrite(v); }
}

injectGlobalStyles('rozie-map-libre-global', `
.rozie-maplibre .rozie-maplibre-marker {
    cursor: pointer;
  }
.rozie-maplibre .rozie-maplibre-control {
    display: flex;
    flex-direction: column;
  }
`);
