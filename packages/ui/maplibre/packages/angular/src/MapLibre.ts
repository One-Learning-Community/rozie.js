import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, InjectionToken, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import maplibregl from 'maplibre-gl';

interface DefaultCtx {}

interface MarkerCtx {
  $implicit: { marker: any; index: any };
  marker: any;
  index: any;
}

interface PopupCtx {
  $implicit: { popup: any; index: any };
  popup: any;
  index: any;
}

interface ControlCtx {
  $implicit: { map: any };
  map: any;
}

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-map-libre',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-maplibre" #containerEl></div>

    <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />






    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [`
    :host(rozie-map-libre) { display: contents; }
    .rozie-maplibre {
      width: 100%;
      height: 100%;
      min-height: 300px;
      position: relative;
      overflow: hidden;
      border-radius: 6px;
    }

    ::ng-deep .rozie-maplibre .rozie-maplibre-marker {
        cursor: pointer;
      }
    ::ng-deep .rozie-maplibre .rozie-maplibre-control {
        display: flex;
        flex-direction: column;
      }
  `],
  providers: [
    {
      provide: rozieToken('maplibre:sources'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => MapLibre)); return ({
  register: (id: any, spec: any) => {
    __rozieCtxHost.sourceReg.set({
      ...__rozieCtxHost.sourceReg(),
      [id]: spec
    });
  },
  update: (id: any, spec: any) => {
    __rozieCtxHost.sourceReg.set({
      ...__rozieCtxHost.sourceReg(),
      [id]: spec
    });
  },
  unregister: (id: any) => {
    const n = {
      ...__rozieCtxHost.sourceReg()
    };
    delete n[id];
    __rozieCtxHost.sourceReg.set(n);
  }
}); },
    },
    {
      provide: rozieToken('maplibre:layers'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => MapLibre)); return ({
  register: (id: any, spec: any) => {
    __rozieCtxHost.layerReg.set({
      ...__rozieCtxHost.layerReg(),
      [id]: spec
    });
  },
  update: (id: any, spec: any) => {
    __rozieCtxHost.layerReg.set({
      ...__rozieCtxHost.layerReg(),
      [id]: spec
    });
  },
  unregister: (id: any) => {
    const n = {
      ...__rozieCtxHost.layerReg()
    };
    delete n[id];
    __rozieCtxHost.layerReg.set(n);
  }
}); },
    },
  ],
})
export class MapLibre {
  /**
   * The map center as `[lng, lat]` — **longitude first** (MapLibre's convention, not Leaflet's `[lat, lng]`). Two-way: panning the map writes the new center back through the model path (echo-guarded), and a consumer write `easeTo`s the live map. The `moveend` echo reads `getCenter()` as `[lng, lat]`.
   * @example
   * <MapLibre r-model:center="center" r-model:zoom="zoom" />
   */
  center = model<any[]>((() => [0, 0])());
  /**
   * The zoom level. Two-way: scroll / pinch writes the new zoom back, and a consumer write `easeTo`s the camera. Echo-guarded against the wrapper's own programmatic moves.
   */
  zoom = model<number>(1);
  /**
   * The map rotation (bearing) in degrees. Two-way via the `rotateend` echo and the `easeTo` reconcile.
   */
  bearing = model<number>(0);
  /**
   * The map tilt (pitch) in degrees. Two-way via the `pitchend` echo and the `easeTo` reconcile.
   */
  pitch = model<number>(0);
  /**
   * The map style — a `StyleSpecification` object **or** a style-URL string. Named `mapStyle` (not `style`) because `style` is a reserved attribute across the targets — `react-map-gl` and `vue-maplibre-gl` use the same name for the same reason. Defaults to MapLibre's official no-token demo tiles, so the component "just works" with zero config. Changing it calls `setStyle` and re-applies your `sources` / `layers` once the new style loads.
   */
  mapStyle = input<unknown>(undefined);
  /**
   * Minimum zoom level. Applied at construction and via `setMinZoom` on change.
   */
  minZoom = input<number>(0);
  /**
   * Maximum zoom level. Applied at construction and via `setMaxZoom` on change.
   */
  maxZoom = input<number>(22);
  /**
   * A `LngLatBoundsLike` the camera is constrained to. Applied via `setMaxBounds` on change (pass `undefined` to clear).
   */
  maxBounds = input<unknown>(undefined);
  /**
   * **Construction-only** initial fit — a `LngLatBoundsLike` the map fits to on mount (overrides `center` / `zoom` when set). Pair with `fitBoundsOptions`.
   */
  bounds = input<unknown>(undefined);
  /**
   * **Construction-only** options for the initial `bounds` fit (padding, max-zoom, etc.).
   */
  fitBoundsOptions = input<Record<string, any>>((() => ({}))());
  /**
   * Toggle drag-to-pan. Applied at construction and reconciled live via the handler's `enable()` / `disable()`.
   */
  dragPan = input<boolean>(true);
  /**
   * Toggle right-drag / ctrl-drag rotation. Applied at construction and reconciled live.
   */
  dragRotate = input<boolean>(true);
  /**
   * Toggle scroll-wheel zoom. Applied at construction and reconciled live.
   */
  scrollZoom = input<boolean>(true);
  /**
   * Toggle double-click zoom. Applied at construction and reconciled live.
   */
  doubleClickZoom = input<boolean>(true);
  /**
   * Toggle shift-drag box zoom. Applied at construction and reconciled live.
   */
  boxZoom = input<boolean>(true);
  /**
   * Toggle keyboard navigation. Applied at construction and reconciled live.
   */
  keyboard = input<boolean>(true);
  /**
   * Toggle touch pinch-zoom + rotate. Applied at construction and reconciled live.
   */
  touchZoomRotate = input<boolean>(true);
  /**
   * Toggle two-finger touch pitch. Applied at construction and reconciled live.
   */
  touchPitch = input<boolean>(true);
  /**
   * The marker data that drives the reactive multi-instance `marker` slot — one entry per marker (`{ lng, lat, id?, anchor?, offset?, draggable?, ... }`). One portal handle mounts per entry; changing the array reconciles markers keep / update / dispose with no remount. Only meaningful when the `marker` slot is filled.
   */
  markers = input<any[]>((() => [])());
  /**
   * The popup data that drives the reactive multi-instance `popup` slot — one entry per popup (`{ lng, lat, id?, anchor?, offset?, closeButton?, closeOnClick?, ... }`). One portal handle mounts per entry. Only meaningful when the `popup` slot is filled.
   */
  popups = input<any[]>((() => [])());
  /**
   * Declarative GeoJSON / vector / raster sources — `[{ id, spec }]` (or a bare `SourceSpecification` carrying an `id`). Reconciled into the live style (add / `setData` / remove) once the style has loaded. The config-array authoring shape for sources; declarative `<Source>` / `<Layer>` children are the alternative shape (both feed the same registry).
   */
  sources = input<any[]>((() => [])());
  /**
   * Declarative layers — `LayerSpecification[]` (each with an `id`). Reconciled into the live style (add / `setPaintProperty` / `setLayoutProperty` / remove) once the style has loaded; `beforeId` controls draw order.
   */
  layers = input<any[]>((() => [])());
  /**
   * Layer ids whose feature `mouseenter` / `mouseleave` fire the `@mouseenter` / `@mouseleave` events (populating `e.features`). Registered / unregistered per id on change.
   */
  interactiveLayerIds = input<any[]>((() => [])());
  /**
   * Standard map controls — strings (`'navigation'` / `'geolocate'` / `'scale'` / `'fullscreen'` / `'attribution'`) or `{ type, position?, options? }` objects. Reconciled (remove-all + re-add) on change.
   */
  controls = input<any[]>((() => [])());
  /**
   * The raw `MapOptions` passthrough — spread into the `Map` constructor **before** the curated keys, so explicit props win. The MapLibre analog of an options bag for anything the curated surface doesn't special-case.
   */
  options = input<Record<string, any>>((() => ({}))());
  sourceReg = signal({});
  layerReg = signal({});
  containerEl = viewChild<ElementRef<HTMLDivElement>>('containerEl');
  load = output<unknown>();
  idle = output<unknown>();
  move = output<unknown>();
  rotate = output<unknown>();
  dragstart = output<unknown>();
  drag = output<unknown>();
  dragend = output<unknown>();
  click = output<unknown>();
  dblclick = output<unknown>();
  contextmenu = output<unknown>();
  mousemove = output<unknown>();
  error = output<unknown>();
  styledata = output<unknown>();
  sourcedata = output<unknown>();
  moveend = output<unknown>();
  zoomend = output<unknown>();
  rotateend = output<unknown>();
  pitchend = output<unknown>();
  mouseenter = output<unknown>();
  mouseleave = output<unknown>();
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('marker', { read: TemplateRef }) markerTpl?: TemplateRef<MarkerCtx>;
  @ContentChild('popup', { read: TemplateRef }) popupTpl?: TemplateRef<PopupCtx>;
  @ContentChild('control', { read: TemplateRef }) controlTpl?: TemplateRef<ControlCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _markerTpl = contentChild('marker', { read: TemplateRef });
  private _popupTpl = contentChild('popup', { read: TemplateRef });
  private _controlTpl = contentChild('control', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;
  private __rozieWatchInitial_6 = true;
  private __rozieWatchInitial_7 = true;
  private __rozieWatchInitial_8 = true;
  private __rozieWatchInitial_9 = true;
  private __rozieWatchInitial_10 = true;
  private __rozieWatchInitial_11 = true;
  private __rozieWatchInitial_12 = true;
  private __rozieWatchInitial_13 = true;
  private __rozieWatchInitial_14 = true;
  private __rozieWatchInitial_15 = true;
  private __rozieWatchInitial_16 = true;
  private __rozieWatchInitial_17 = true;
  private __rozieWatchInitial_18 = true;
  private __rozieWatchInitial_19 = true;
  private __rozieWatchInitial_20 = true;
  private __rozieWatchInitial_21 = true;
  private __rozieWatchInitial_22 = true;
  private __rozieWatchInitial_23 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.center())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (!this.instance || !Array.isArray(v) || v.length !== 2) return;
      const c = this.instance.getCenter();
      if (v[0] === c.lng && v[1] === c.lat) return;
      this.instance.easeTo({
        center: v,
        animate: false
      }, this.PROGRAMMATIC);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.zoom())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => {
      if (!this.instance || typeof v !== 'number' || v === this.instance.getZoom()) return;
      this.instance.easeTo({
        zoom: v,
        animate: false
      }, this.PROGRAMMATIC);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.bearing())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } ((v: any) => {
      if (!this.instance || typeof v !== 'number' || v === this.instance.getBearing()) return;
      this.instance.easeTo({
        bearing: v,
        animate: false
      }, this.PROGRAMMATIC);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.pitch())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (!this.instance || typeof v !== 'number' || v === this.instance.getPitch()) return;
      this.instance.easeTo({
        pitch: v,
        animate: false
      }, this.PROGRAMMATIC);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.mapStyle())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => {
      if (!this.instance) return;
      // a new style wipes imperatively-added sources/layers — reset the applied
      // tracking and re-apply once the new style loads.
      this.appliedLayerIds = [];
      this.appliedSourceIds = [];
      this.instance.setStyle(v ?? this.DEFAULT_STYLE);
      this.instance.once('styledata', () => this.applyLayers());
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.minZoom())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => {
      if (this.instance && typeof v === 'number') this.instance.setMinZoom(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.maxZoom())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } ((v: any) => {
      if (this.instance && typeof v === 'number') this.instance.setMaxZoom(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.maxBounds())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((v: any) => {
      if (this.instance) this.instance.setMaxBounds(v || null);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.markers())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } ((v: any) => {
      if (this.reconcileMarkers) this.reconcileMarkers(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.popups())(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } ((v: any) => {
      if (this.reconcilePopups) this.reconcilePopups(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.sources())(); untracked(() => { if (this.__rozieWatchInitial_10) { this.__rozieWatchInitial_10 = false; return; } (() => this.applyLayers())(); }); });
    effect(() => { const __watchVal = (() => this.layers())(); untracked(() => { if (this.__rozieWatchInitial_11) { this.__rozieWatchInitial_11 = false; return; } (() => this.applyLayers())(); }); });
    effect(() => { const __watchVal = (() => this.sourceReg())(); untracked(() => { if (this.__rozieWatchInitial_12) { this.__rozieWatchInitial_12 = false; return; } (() => this.applyLayers())(); }); });
    effect(() => { const __watchVal = (() => this.layerReg())(); untracked(() => { if (this.__rozieWatchInitial_13) { this.__rozieWatchInitial_13 = false; return; } (() => this.applyLayers())(); }); });
    effect(() => { const __watchVal = (() => this.interactiveLayerIds())(); untracked(() => { if (this.__rozieWatchInitial_14) { this.__rozieWatchInitial_14 = false; return; } ((v: any) => {
      if (this.reconcileInteractive) this.reconcileInteractive(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.controls())(); untracked(() => { if (this.__rozieWatchInitial_15) { this.__rozieWatchInitial_15 = false; return; } (() => this.applyControls())(); }); });
    effect(() => { const __watchVal = (() => this.dragPan())(); untracked(() => { if (this.__rozieWatchInitial_16) { this.__rozieWatchInitial_16 = false; return; } (() => this.applyInteractionToggles())(); }); });
    effect(() => { const __watchVal = (() => this.dragRotate())(); untracked(() => { if (this.__rozieWatchInitial_17) { this.__rozieWatchInitial_17 = false; return; } (() => this.applyInteractionToggles())(); }); });
    effect(() => { const __watchVal = (() => this.scrollZoom())(); untracked(() => { if (this.__rozieWatchInitial_18) { this.__rozieWatchInitial_18 = false; return; } (() => this.applyInteractionToggles())(); }); });
    effect(() => { const __watchVal = (() => this.doubleClickZoom())(); untracked(() => { if (this.__rozieWatchInitial_19) { this.__rozieWatchInitial_19 = false; return; } (() => this.applyInteractionToggles())(); }); });
    effect(() => { const __watchVal = (() => this.boxZoom())(); untracked(() => { if (this.__rozieWatchInitial_20) { this.__rozieWatchInitial_20 = false; return; } (() => this.applyInteractionToggles())(); }); });
    effect(() => { const __watchVal = (() => this.keyboard())(); untracked(() => { if (this.__rozieWatchInitial_21) { this.__rozieWatchInitial_21 = false; return; } (() => this.applyInteractionToggles())(); }); });
    effect(() => { const __watchVal = (() => this.touchZoomRotate())(); untracked(() => { if (this.__rozieWatchInitial_22) { this.__rozieWatchInitial_22 = false; return; } (() => this.applyInteractionToggles())(); }); });
    effect(() => { const __watchVal = (() => this.touchPitch())(); untracked(() => { if (this.__rozieWatchInitial_23) { this.__rozieWatchInitial_23 = false; return; } (() => this.applyInteractionToggles())(); }); });
  }

  ngAfterViewInit() {
    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      marker: (container: HTMLElement, scope: { marker: unknown; index: unknown }): ReactivePortalHandle => {
        const tpl = this._markerTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-marker', 'f1ee1082');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
      popup: (container: HTMLElement, scope: { popup: unknown; index: unknown }): ReactivePortalHandle => {
        const tpl = this._popupTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-popup', 'f1ee1082');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
      control: (container: HTMLElement, scope: { map: unknown }): (() => void) => {
        const tpl = this._controlTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-control', 'f1ee1082');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
    };
    const el = this.containerEl()?.nativeElement;

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
      ...this.options(),
      style: this.mapStyle() ?? this.DEFAULT_STYLE,
      center: this.center(),
      zoom: this.zoom(),
      bearing: this.bearing(),
      pitch: this.pitch(),
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom(),
      maxBounds: this.maxBounds(),
      bounds: this.bounds(),
      fitBoundsOptions: this.fitBoundsOptions(),
      dragPan: this.dragPan(),
      dragRotate: this.dragRotate(),
      scrollZoom: this.scrollZoom(),
      doubleClickZoom: this.doubleClickZoom(),
      boxZoom: this.boxZoom(),
      keyboard: this.keyboard(),
      touchZoomRotate: this.touchZoomRotate(),
      touchPitch: this.touchPitch()
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
    this.instance.on('load', (e: any) => this.load.emit(e));
    this.instance.on('idle', (e: any) => this.idle.emit(e));
    this.instance.on('move', (e: any) => this.move.emit(e));
    this.instance.on('rotate', (e: any) => this.rotate.emit(e));
    this.instance.on('dragstart', (e: any) => this.dragstart.emit(e));
    this.instance.on('drag', (e: any) => this.drag.emit(e));
    this.instance.on('dragend', (e: any) => this.dragend.emit(e));
    this.instance.on('click', (e: any) => this.click.emit(this.payload(e)));
    this.instance.on('dblclick', (e: any) => this.dblclick.emit(this.payload(e)));
    this.instance.on('contextmenu', (e: any) => this.contextmenu.emit(this.payload(e)));
    this.instance.on('mousemove', (e: any) => this.mousemove.emit(this.payload(e)));
    this.instance.on('error', (e: any) => this.error.emit(e));
    this.instance.on('styledata', (e: any) => this.styledata.emit(e));
    this.instance.on('sourcedata', (e: any) => this.sourcedata.emit(e));

    // ─── camera-lifecycle + two-way echo (echo-guarded) ─────────────────────
    // ─── camera-lifecycle + two-way echo (echo-guarded) ─────────────────────
    this.instance.on('moveend', (e: any) => {
      this.moveend.emit(e);
      if (e.rozieProgrammatic) return;
      const c = this.instance.getCenter();
      const next = [c.lng, c.lat];
      if (!this.sameCenter(next, this.center())) this.center.set(next);
      const z = this.instance.getZoom();
      if (z !== this.zoom()) this.zoom.set(z);
    });
    this.instance.on('zoomend', (e: any) => {
      this.zoomend.emit(e);
      if (e.rozieProgrammatic) return;
      const z = this.instance.getZoom();
      if (z !== this.zoom()) this.zoom.set(z);
    });
    this.instance.on('rotateend', (e: any) => {
      this.rotateend.emit(e);
      if (e.rozieProgrammatic) return;
      const b = this.instance.getBearing();
      if (b !== this.bearing()) this.bearing.set(b);
    });
    this.instance.on('pitchend', (e: any) => {
      this.pitchend.emit(e);
      if (e.rozieProgrammatic) return;
      const p = this.instance.getPitch();
      if (p !== this.pitch()) this.pitch.set(p);
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
      if (!(this.markerTpl ?? this.templates()?.['marker'])) return;
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
      if (!(this.popupTpl ?? this.templates()?.['popup'])) return;
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
        const enter = (e: any) => this.mouseenter.emit(this.payload(e));
        const leave = (e: any) => this.mouseleave.emit(this.payload(e));
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
    if ((this.controlTpl ?? this.templates()?.['control'])) {
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
    this.reconcileMarkers(this.markers());
    this.reconcilePopups(this.popups());
    this.reconcileInteractive(this.interactiveLayerIds());

    // sources/layers need the style loaded.
    // sources/layers need the style loaded.
    if (this.instance.isStyleLoaded()) this.applyLayers();else this.instance.on('load', this.applyLayers);
    this.__rozieDestroyRef.onDestroy(() => {
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
    });
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
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
    for (const spec of this.controls() as any) {
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
    set('dragPan', this.dragPan());
    set('dragRotate', this.dragRotate());
    set('scrollZoom', this.scrollZoom());
    set('doubleClickZoom', this.doubleClickZoom());
    set('boxZoom', this.boxZoom());
    set('keyboard', this.keyboard());
    set('touchZoomRotate', this.touchZoomRotate());
    set('touchPitch', this.touchPitch());
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
    const mergedSources = mergeById(this.sources(), this.sourceReg());
    const mergedLayers = mergeById(this.layers(), this.layerReg());
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
  getMap = () => {
    return this.instance;
  };
  flyTo = (opts: any) => {
    if (this.instance) this.instance.flyTo(opts);
  };
  easeTo = (opts: any) => {
    if (this.instance) this.instance.easeTo(opts);
  };
  jumpTo = (opts: any) => {
    if (this.instance) this.instance.jumpTo(opts);
  };
  fitBounds = (bounds: any, opts: any) => {
    if (this.instance) this.instance.fitBounds(bounds, opts);
  };
  getCenter = () => {
    if (!this.instance) return null;
    const c = this.instance.getCenter();
    return [c.lng, c.lat];
  };
  getZoom = () => {
    return this.instance ? this.instance.getZoom() : null;
  };
  resize = () => {
    if (this.instance) this.instance.resize();
  };
  queryRenderedFeatures = (geometry: any, options: any) => {
    return this.instance ? this.instance.queryRenderedFeatures(geometry, options) : [];
  };
  project = (lngLat: any) => {
    return this.instance ? this.instance.project(lngLat) : null;
  };
  unproject = (point: any) => {
    return this.instance ? this.instance.unproject(point) : null;
  };
  getBounds = () => {
    return this.instance ? this.instance.getBounds() : null;
  };
  zoomIn = (opts: any) => {
    if (this.instance) this.instance.zoomIn(opts);
  };
  zoomOut = (opts: any) => {
    if (this.instance) this.instance.zoomOut(opts);
  };
  panBy = (offset: any, opts: any) => {
    if (this.instance) this.instance.panBy(offset, opts);
  };

  static ngTemplateContextGuard(
    _dir: MapLibre,
    _ctx: unknown,
  ): _ctx is DefaultCtx | MarkerCtx | PopupCtx | ControlCtx {
    return true;
  }
}

export default MapLibre;
