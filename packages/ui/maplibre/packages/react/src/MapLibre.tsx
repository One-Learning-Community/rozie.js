import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useControllableState } from '@rozie/runtime-react';
import './MapLibre.css';
import './MapLibre.global.css';
import maplibregl from 'maplibre-gl';

interface MarkerCtx { marker: any; index: any; }

interface PopupCtx { popup: any; index: any; }

interface ControlCtx { map: any; }

interface MapLibreProps {
  center?: any[];
  defaultCenter?: any[];
  onCenterChange?: (center: any[]) => void;
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (zoom: number) => void;
  bearing?: number;
  defaultBearing?: number;
  onBearingChange?: (bearing: number) => void;
  pitch?: number;
  defaultPitch?: number;
  onPitchChange?: (pitch: number) => void;
  mapStyle?: unknown;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: unknown;
  bounds?: unknown;
  fitBoundsOptions?: Record<string, any>;
  dragPan?: boolean;
  dragRotate?: boolean;
  scrollZoom?: boolean;
  doubleClickZoom?: boolean;
  boxZoom?: boolean;
  keyboard?: boolean;
  touchZoomRotate?: boolean;
  touchPitch?: boolean;
  markers?: any[];
  popups?: any[];
  sources?: any[];
  layers?: any[];
  interactiveLayerIds?: any[];
  controls?: any[];
  options?: Record<string, any>;
  onLoad?: (...args: any[]) => void;
  onIdle?: (...args: any[]) => void;
  onMove?: (...args: any[]) => void;
  onRotate?: (...args: any[]) => void;
  onDragstart?: (...args: any[]) => void;
  onDrag?: (...args: any[]) => void;
  onDragend?: (...args: any[]) => void;
  onClick?: (...args: any[]) => void;
  onDblclick?: (...args: any[]) => void;
  onContextmenu?: (...args: any[]) => void;
  onMousemove?: (...args: any[]) => void;
  onError?: (...args: any[]) => void;
  onStyledata?: (...args: any[]) => void;
  onSourcedata?: (...args: any[]) => void;
  onMoveend?: (...args: any[]) => void;
  onZoomend?: (...args: any[]) => void;
  onRotateend?: (...args: any[]) => void;
  onPitchend?: (...args: any[]) => void;
  onMouseenter?: (...args: any[]) => void;
  onMouseleave?: (...args: any[]) => void;
  renderMarker?: (ctx: MarkerCtx) => ReactNode;
  renderPopup?: (ctx: PopupCtx) => ReactNode;
  renderControl?: (ctx: ControlCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface MapLibreHandle {
  getMap: (...args: any[]) => any;
  flyTo: (...args: any[]) => any;
  easeTo: (...args: any[]) => any;
  jumpTo: (...args: any[]) => any;
  fitBounds: (...args: any[]) => any;
  getCenter: (...args: any[]) => any;
  getZoom: (...args: any[]) => any;
  resize: (...args: any[]) => any;
}

const MapLibre = forwardRef<MapLibreHandle, MapLibreProps>(function MapLibre(_props: MapLibreProps, ref): JSX.Element {
  const portalRoots = useRef<Set<Root>>(new Set());
  const __defaultFitBoundsOptions = useState(() => (() => ({}))())[0];
  const __defaultMarkers = useState(() => (() => [])())[0];
  const __defaultPopups = useState(() => (() => [])())[0];
  const __defaultSources = useState(() => (() => [])())[0];
  const __defaultLayers = useState(() => (() => [])())[0];
  const __defaultInteractiveLayerIds = useState(() => (() => [])())[0];
  const __defaultControls = useState(() => (() => [])())[0];
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<MapLibreProps, 'mapStyle' | 'minZoom' | 'maxZoom' | 'maxBounds' | 'bounds' | 'fitBoundsOptions' | 'dragPan' | 'dragRotate' | 'scrollZoom' | 'doubleClickZoom' | 'boxZoom' | 'keyboard' | 'touchZoomRotate' | 'touchPitch' | 'markers' | 'popups' | 'sources' | 'layers' | 'interactiveLayerIds' | 'controls' | 'options'> & { mapStyle: unknown; minZoom: number; maxZoom: number; maxBounds: unknown; bounds: unknown; fitBoundsOptions: Record<string, any>; dragPan: boolean; dragRotate: boolean; scrollZoom: boolean; doubleClickZoom: boolean; boxZoom: boolean; keyboard: boolean; touchZoomRotate: boolean; touchPitch: boolean; markers: any[]; popups: any[]; sources: any[]; layers: any[]; interactiveLayerIds: any[]; controls: any[]; options: Record<string, any> } = {
    ..._props,
    mapStyle: _props.mapStyle ?? undefined,
    minZoom: _props.minZoom ?? 0,
    maxZoom: _props.maxZoom ?? 22,
    maxBounds: _props.maxBounds ?? undefined,
    bounds: _props.bounds ?? undefined,
    fitBoundsOptions: _props.fitBoundsOptions ?? __defaultFitBoundsOptions,
    dragPan: _props.dragPan ?? true,
    dragRotate: _props.dragRotate ?? true,
    scrollZoom: _props.scrollZoom ?? true,
    doubleClickZoom: _props.doubleClickZoom ?? true,
    boxZoom: _props.boxZoom ?? true,
    keyboard: _props.keyboard ?? true,
    touchZoomRotate: _props.touchZoomRotate ?? true,
    touchPitch: _props.touchPitch ?? true,
    markers: _props.markers ?? __defaultMarkers,
    popups: _props.popups ?? __defaultPopups,
    sources: _props.sources ?? __defaultSources,
    layers: _props.layers ?? __defaultLayers,
    interactiveLayerIds: _props.interactiveLayerIds ?? __defaultInteractiveLayerIds,
    controls: _props.controls ?? __defaultControls,
    options: _props.options ?? __defaultOptions,
  };
  const _renderMarkerRef = useRef(props.renderMarker);
  _renderMarkerRef.current = props.renderMarker;
  const _renderPopupRef = useRef(props.renderPopup);
  _renderPopupRef.current = props.renderPopup;
  const _renderControlRef = useRef(props.renderControl);
  _renderControlRef.current = props.renderControl;
  const controlInstances = useRef<any>(null);
  const appliedLayerIds = useRef<any>(null);
  const appliedSourceIds = useRef<any>(null);
  const instance = useRef<any>(null);
  const reconcileMarkers = useRef<any>(null);
  const reconcilePopups = useRef<any>(null);
  const reconcileInteractive = useRef<any>(null);
  const customControl = useRef<any>(null);
  const controlDispose = useRef<any>(null);
  const [center, setCenter] = useControllableState({
    value: props.center,
    defaultValue: props.defaultCenter ?? (() => [0, 0])(),
    onValueChange: props.onCenterChange,
  });
  const [zoom, setZoom] = useControllableState({
    value: props.zoom,
    defaultValue: props.defaultZoom ?? 1,
    onValueChange: props.onZoomChange,
  });
  const [bearing, setBearing] = useControllableState({
    value: props.bearing,
    defaultValue: props.defaultBearing ?? 0,
    onValueChange: props.onBearingChange,
  });
  const [pitch, setPitch] = useControllableState({
    value: props.pitch,
    defaultValue: props.defaultPitch ?? 0,
    onValueChange: props.onPitchChange,
  });
  const _boxZoomRef = useRef(props.boxZoom);
  _boxZoomRef.current = props.boxZoom;
  const _doubleClickZoomRef = useRef(props.doubleClickZoom);
  _doubleClickZoomRef.current = props.doubleClickZoom;
  const _dragPanRef = useRef(props.dragPan);
  _dragPanRef.current = props.dragPan;
  const _dragRotateRef = useRef(props.dragRotate);
  _dragRotateRef.current = props.dragRotate;
  const _interactiveLayerIdsRef = useRef(props.interactiveLayerIds);
  _interactiveLayerIdsRef.current = props.interactiveLayerIds;
  const _keyboardRef = useRef(props.keyboard);
  _keyboardRef.current = props.keyboard;
  const _mapStyleRef = useRef(props.mapStyle);
  _mapStyleRef.current = props.mapStyle;
  const _markersRef = useRef(props.markers);
  _markersRef.current = props.markers;
  const _maxBoundsRef = useRef(props.maxBounds);
  _maxBoundsRef.current = props.maxBounds;
  const _maxZoomRef = useRef(props.maxZoom);
  _maxZoomRef.current = props.maxZoom;
  const _minZoomRef = useRef(props.minZoom);
  _minZoomRef.current = props.minZoom;
  const _popupsRef = useRef(props.popups);
  _popupsRef.current = props.popups;
  const _scrollZoomRef = useRef(props.scrollZoom);
  _scrollZoomRef.current = props.scrollZoom;
  const _touchPitchRef = useRef(props.touchPitch);
  _touchPitchRef.current = props.touchPitch;
  const _touchZoomRotateRef = useRef(props.touchZoomRotate);
  _touchZoomRotateRef.current = props.touchZoomRotate;
  const _bearingRef = useRef(bearing);
  _bearingRef.current = bearing;
  const _centerRef = useRef(center);
  _centerRef.current = center;
  const _pitchRef = useRef(pitch);
  _pitchRef.current = pitch;
  const _zoomRef = useRef(zoom);
  _zoomRef.current = zoom;
  const containerEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);
  const _watch6First = useRef(true);
  const _watch7First = useRef(true);
  const _watch8First = useRef(true);
  const _watch9First = useRef(true);
  const _watch10First = useRef(true);
  const _watch11First = useRef(true);
  const _watch12First = useRef(true);
  const _watch13First = useRef(true);
  const _watch14First = useRef(true);
  const _watch15First = useRef(true);
  const _watch16First = useRef(true);
  const _watch17First = useRef(true);
  const _watch18First = useRef(true);
  const _watch19First = useRef(true);
  const _watch20First = useRef(true);
  const _watch21First = useRef(true);

  const DEFAULT_STYLE = useMemo(() => 'https://demotiles.maplibre.org/style.json', []);
  // The eventData merged onto programmatic camera ops so the camera-lifecycle echo
  // handlers can ignore our own moves (the documented MapLibre echo-guard — robust
  // across batched ops where Leaflet's single boolean would race).
  const PROGRAMMATIC = {
    rozieProgrammatic: true
  };

  // Live entry maps for the REACTIVE MULTI-INSTANCE portal slots — keyed by
  // entry.id ?? index. Each value: { engine, handle, el }. COMPONENT-scope (not
  // $onMount-local) so the $onMount-returned teardown — which the Solid emitter
  // hoists into a sibling onCleanup() OUTSIDE the mount IIFE — keeps them in scope.
  const markerEntries = useMemo(() => new Map(), []);
  const popupEntries = useMemo(() => new Map(), []);
  const featureListeners = useMemo(() => new Map(), []);
  const sameCenter = useCallback((a: any, b: any) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1], []);
  const payload = useCallback((e: any) => ({
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
  }), []);
  function buildControl(spec: any) {
    const type = typeof spec === 'string' ? spec : spec.type;
    const opts = typeof spec === 'object' && spec.options || {};
    if (type === 'navigation') return new maplibregl.NavigationControl(opts);
    if (type === 'geolocate') return new maplibregl.GeolocateControl(opts);
    if (type === 'scale') return new maplibregl.ScaleControl(opts);
    if (type === 'fullscreen') return new maplibregl.FullscreenControl(opts);
    if (type === 'attribution') return new maplibregl.AttributionControl(opts);
    return null;
  }
  const applyControls = useCallback(() => {
    if (!instance.current) return;
    for (const c of controlInstances.current as any) instance.current.removeControl(c);
    controlInstances.current = [];
    for (const spec of props.controls as any) {
      if (!spec) continue;
      const ctrl = buildControl(spec);
      if (!ctrl) continue;
      const position = typeof spec === 'object' && spec.position || undefined;
      instance.current.addControl(ctrl, position);
      controlInstances.current.push(ctrl);
    }
  }, [buildControl, props.controls]);
  const applyInteractionToggles = useCallback(() => {
    if (!instance.current) return;
    const set = (name: any, on: any) => {
      const handler = instance.current[name];
      if (handler) on ? handler.enable() : handler.disable();
    };
    set('dragPan', props.dragPan);
    set('dragRotate', props.dragRotate);
    set('scrollZoom', props.scrollZoom);
    set('doubleClickZoom', props.doubleClickZoom);
    set('boxZoom', props.boxZoom);
    set('keyboard', props.keyboard);
    set('touchZoomRotate', props.touchZoomRotate);
    set('touchPitch', props.touchPitch);
  }, [props.boxZoom, props.doubleClickZoom, props.dragPan, props.dragRotate, props.keyboard, props.scrollZoom, props.touchPitch, props.touchZoomRotate]);
  const applyLayers = useCallback(() => {
    if (!instance.current || !instance.current.isStyleLoaded()) return;
    const wantLayerIds = props.layers.map((l: any) => l && l.id).filter(Boolean);
    const wantSourceIds = props.sources.map((s: any) => s && s.id).filter(Boolean);

    // 1. drop removed layers
    for (const id of appliedLayerIds.current as any) {
      if (!wantLayerIds.includes(id) && instance.current.getLayer(id)) instance.current.removeLayer(id);
    }
    // 2. add/update sources
    for (const s of props.sources as any) {
      if (!s || !s.id) continue;
      const spec = s.spec || s;
      const existing = instance.current.getSource(s.id);
      if (!existing) instance.current.addSource(s.id, spec);else if (spec.type === 'geojson' && spec.data) existing.setData(spec.data);
    }
    // 3. add/update layers
    for (const l of props.layers as any) {
      if (!l || !l.id) continue;
      if (!instance.current.getLayer(l.id)) {
        instance.current.addLayer(l, l.beforeId);
      } else {
        if (l.paint) for (const k in l.paint) instance.current.setPaintProperty(l.id, k, l.paint[k]);
        if (l.layout) for (const k in l.layout) instance.current.setLayoutProperty(l.id, k, l.layout[k]);
      }
    }
    // 4. drop removed sources (their layers are gone)
    for (const id of appliedSourceIds.current as any) {
      if (!wantSourceIds.includes(id) && instance.current.getSource(id)) instance.current.removeSource(id);
    }
    appliedLayerIds.current = wantLayerIds;
    appliedSourceIds.current = wantSourceIds;
  }, [props.layers, props.sources]);
  // ─── imperative handle (Phase 21 $expose) ───────────────────────────────────
  // 8 verbs. Collision-clear across all 3 classes: NOT a React model-setter
  // (setCenter/setZoom/setBearing/setPitch are the auto-gen'd ones — none here);
  // NOT a Lit lifecycle name (update/render/firstUpdated/updated/willUpdate/
  // requestUpdate); NOT an emitted event name (move/zoom/rotate/pitch/drag/click/
  // idle/error — getCenter/getZoom/resize/flyTo/easeTo/jumpTo/fitBounds/getMap all
  // differ). The camera verbs deliberately omit PROGRAMMATIC so an imperative move
  // echoes into $model (the prop $watch then no-ops, getCenter already matching).
  function getMap() {
    return instance.current;
  }
  function flyTo(opts: any) {
    if (instance.current) instance.current.flyTo(opts);
  }
  function easeTo(opts: any) {
    if (instance.current) instance.current.easeTo(opts);
  }
  function jumpTo(opts: any) {
    if (instance.current) instance.current.jumpTo(opts);
  }
  function fitBounds(bounds: any, opts: any) {
    if (instance.current) instance.current.fitBounds(bounds, opts);
  }
  function getCenter() {
    if (!instance.current) return null;
    const c = instance.current.getCenter();
    return [c.lng, c.lat];
  }
  function getZoom() {
    return instance.current ? instance.current.getZoom() : null;
  }
  function resize() {
    if (instance.current) instance.current.resize();
  }

  useEffect(() => {
    interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portals = {
    marker: (container: HTMLElement, scope: { marker: unknown; index: unknown }): ReactivePortalHandle => {
      const slot = _renderMarkerRef.current ?? props.slots?.['marker'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal marker { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-marker', 'f1ee1082');
      const root = createRoot(container);
      const renderScope = (s: { marker: unknown; index: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { marker: unknown; index: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
    popup: (container: HTMLElement, scope: { popup: unknown; index: unknown }): ReactivePortalHandle => {
      const slot = _renderPopupRef.current ?? props.slots?.['popup'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal popup { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-popup', 'f1ee1082');
      const root = createRoot(container);
      const renderScope = (s: { popup: unknown; index: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { popup: unknown; index: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
    control: (container: HTMLElement, scope: { map: unknown }): (() => void) => {
      const slot = _renderControlRef.current ?? props.slots?.['control'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal control { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-control', 'f1ee1082');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
  };
    const el = containerEl.current;

    // seed the null-let tracking arrays (declared null so typeNeutralize types them
    // `any`; the reconcile/teardown code only runs after this mount init).
    controlInstances.current = [];
    appliedLayerIds.current = [];
    appliedSourceIds.current = [];

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
      ...props.options,
      style: _mapStyleRef.current ?? DEFAULT_STYLE,
      center: _centerRef.current,
      zoom: _zoomRef.current,
      bearing: _bearingRef.current,
      pitch: _pitchRef.current,
      minZoom: _minZoomRef.current,
      maxZoom: _maxZoomRef.current,
      maxBounds: _maxBoundsRef.current,
      bounds: props.bounds,
      fitBoundsOptions: props.fitBoundsOptions,
      dragPan: _dragPanRef.current,
      dragRotate: _dragRotateRef.current,
      scrollZoom: _scrollZoomRef.current,
      doubleClickZoom: _doubleClickZoomRef.current,
      boxZoom: _boxZoomRef.current,
      keyboard: _keyboardRef.current,
      touchZoomRotate: _touchZoomRotateRef.current,
      touchPitch: _touchPitchRef.current
    };
    instance.current = new maplibregl.Map(mapOptions);

    // ─── forward map events ─────────────────────────────────────────────────
    // NOTE: the CONTINUOUS `zoom` and `pitch` events are deliberately NOT forwarded
    // — `zoom` and `pitch` are also two-way `model: true` camera props, and a same-
    // named emit collides with the model on Vue (defineModel vs defineEmits) and
    // Angular (ModelSignal vs OutputEmitterRef). The two-way binding already conveys
    // zoom/pitch changes; consumers wanting an event get the terminal `zoomend` /
    // `pitchend` below. `move`/`rotate` have no such clash (the models are `center`
    // and `bearing`, not `move`/`rotate`), so those continuous events stay.
    instance.current.on('load', (e: any) => props.onLoad && props.onLoad(e));
    instance.current.on('idle', (e: any) => props.onIdle && props.onIdle(e));
    instance.current.on('move', (e: any) => props.onMove && props.onMove(e));
    instance.current.on('rotate', (e: any) => props.onRotate && props.onRotate(e));
    instance.current.on('dragstart', (e: any) => props.onDragstart && props.onDragstart(e));
    instance.current.on('drag', (e: any) => props.onDrag && props.onDrag(e));
    instance.current.on('dragend', (e: any) => props.onDragend && props.onDragend(e));
    instance.current.on('click', (e: any) => props.onClick && props.onClick(payload(e)));
    instance.current.on('dblclick', (e: any) => props.onDblclick && props.onDblclick(payload(e)));
    instance.current.on('contextmenu', (e: any) => props.onContextmenu && props.onContextmenu(payload(e)));
    instance.current.on('mousemove', (e: any) => props.onMousemove && props.onMousemove(payload(e)));
    instance.current.on('error', (e: any) => props.onError && props.onError(e));
    instance.current.on('styledata', (e: any) => props.onStyledata && props.onStyledata(e));
    instance.current.on('sourcedata', (e: any) => props.onSourcedata && props.onSourcedata(e));

    // ─── camera-lifecycle + two-way echo (echo-guarded) ─────────────────────
    instance.current.on('moveend', (e: any) => {
      props.onMoveend && props.onMoveend(e);
      if (e.rozieProgrammatic) return;
      const c = instance.current.getCenter();
      const next = [c.lng, c.lat];
      if (!sameCenter(next, _centerRef.current)) setCenter(next);
      const z = instance.current.getZoom();
      if (z !== _zoomRef.current) setZoom(z);
    });
    instance.current.on('zoomend', (e: any) => {
      props.onZoomend && props.onZoomend(e);
      if (e.rozieProgrammatic) return;
      const z = instance.current.getZoom();
      if (z !== _zoomRef.current) setZoom(z);
    });
    instance.current.on('rotateend', (e: any) => {
      props.onRotateend && props.onRotateend(e);
      if (e.rozieProgrammatic) return;
      const b = instance.current.getBearing();
      if (b !== _bearingRef.current) setBearing(b);
    });
    instance.current.on('pitchend', (e: any) => {
      props.onPitchend && props.onPitchend(e);
      if (e.rozieProgrammatic) return;
      const p = instance.current.getPitch();
      if (p !== _pitchRef.current) setPitch(p);
    });

    // ─── REACTIVE MULTI-INSTANCE marker portal slot ─────────────────────────
    // One reactive portal handle per markers[] entry, reconciled keep/update/dispose
    // on prop change. Built here so $portals.marker is in the mount scope; bridged
    // to the top-level $watch via reconcileMarkers (CM rebuildGutterExt discipline).
    reconcileMarkers.current = (list: any) => {
      if (!(props.renderMarker ?? props.slots?.["marker"])) return;
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
        const entry = markerEntries.get(key);
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
          }).setLngLat([m.lng, m.lat]).addTo(instance.current);
          markerEntries.set(key, {
            engine,
            handle,
            el: node
          });
        }
      });
      for (const [key, entry] of markerEntries as any) {
        if (!seen.has(key)) {
          entry.handle.dispose();
          entry.engine.remove();
          markerEntries.delete(key);
        }
      }
    };

    // ─── REACTIVE MULTI-INSTANCE popup portal slot ──────────────────────────
    reconcilePopups.current = (list: any) => {
      if (!(props.renderPopup ?? props.slots?.["popup"])) return;
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
        const entry = popupEntries.get(key);
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
          }).setLngLat([p.lng, p.lat]).setDOMContent(node).addTo(instance.current);
          popupEntries.set(key, {
            engine,
            handle,
            el: node
          });
        }
      });
      for (const [key, entry] of popupEntries as any) {
        if (!seen.has(key)) {
          entry.handle.dispose();
          entry.engine.remove();
          popupEntries.delete(key);
        }
      }
    };

    // ─── layer-scoped feature mouseenter/mouseleave (needs a layer id) ───────
    reconcileInteractive.current = (ids: any) => {
      const want = (Array.isArray(ids) ? ids : []).filter(Boolean);
      for (const [id, l] of featureListeners as any) {
        if (!want.includes(id)) {
          instance.current.off('mouseenter', id, l.enter);
          instance.current.off('mouseleave', id, l.leave);
          featureListeners.delete(id);
        }
      }
      for (const id of want as any) {
        if (featureListeners.has(id)) continue;
        const enter = (e: any) => props.onMouseenter && props.onMouseenter(payload(e));
        const leave = (e: any) => props.onMouseleave && props.onMouseleave(payload(e));
        instance.current.on('mouseenter', id, enter);
        instance.current.on('mouseleave', id, leave);
        featureListeners.set(id, {
          enter,
          leave
        });
      }
    };

    // ─── mount-once custom CONTROL portal slot ──────────────────────────────
    if ((props.renderControl ?? props.slots?.["control"])) {
      const host = document.createElement('div');
      host.className = 'maplibregl-ctrl rozie-maplibre-control';
      customControl.current = {
        onAdd() {
          return host;
        },
        onRemove() {
          if (host.parentNode) host.parentNode.removeChild(host);
        }
      };
      instance.current.addControl(customControl.current, 'top-right');
      controlDispose.current = portals.control(host, {
        map: instance.current
      });
    }

    // standard controls + interaction toggles don't need style load.
    applyControls();
    applyInteractionToggles();

    // markers/popups/interactive are DOM/event overlays — no style-load gate.
    reconcileMarkers.current(_markersRef.current);
    reconcilePopups.current(_popupsRef.current);
    reconcileInteractive.current(_interactiveLayerIdsRef.current);

    // sources/layers need the style loaded.
    if (instance.current.isStyleLoaded()) applyLayers();else instance.current.on('load', applyLayers);
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      for (const [, entry] of markerEntries as any) {
        entry.handle.dispose();
        entry.engine.remove();
      }
      markerEntries.clear();
      for (const [, entry] of popupEntries as any) {
        entry.handle.dispose();
        entry.engine.remove();
      }
      popupEntries.clear();
      if (controlDispose.current) controlDispose.current();
      if (instance.current) instance.current.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = center;
    if (!instance.current || !Array.isArray(v) || v.length !== 2) return;
    const c = instance.current.getCenter();
    if (v[0] === c.lng && v[1] === c.lat) return;
    instance.current.easeTo({
      center: v,
      animate: false
    }, PROGRAMMATIC);
  }, [center]);
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    const v = zoom;
    if (!instance.current || typeof v !== 'number' || v === instance.current.getZoom()) return;
    instance.current.easeTo({
      zoom: v,
      animate: false
    }, PROGRAMMATIC);
  }, [zoom]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    const v = bearing;
    if (!instance.current || typeof v !== 'number' || v === instance.current.getBearing()) return;
    instance.current.easeTo({
      bearing: v,
      animate: false
    }, PROGRAMMATIC);
  }, [bearing]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = pitch;
    if (!instance.current || typeof v !== 'number' || v === instance.current.getPitch()) return;
    instance.current.easeTo({
      pitch: v,
      animate: false
    }, PROGRAMMATIC);
  }, [pitch]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = props.mapStyle;
    if (!instance.current) return;
    // a new style wipes imperatively-added sources/layers — reset the applied
    // tracking and re-apply once the new style loads.
    appliedLayerIds.current = [];
    appliedSourceIds.current = [];
    instance.current.setStyle(v ?? DEFAULT_STYLE);
    instance.current.once('styledata', () => applyLayers());
  }, [props.mapStyle]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.minZoom;
    if (instance.current && typeof v === 'number') instance.current.setMinZoom(v);
  }, [props.minZoom]);
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.maxZoom;
    if (instance.current && typeof v === 'number') instance.current.setMaxZoom(v);
  }, [props.maxZoom]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = props.maxBounds;
    if (instance.current) instance.current.setMaxBounds(v || null);
  }, [props.maxBounds]);
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    const v = props.markers;
    if (reconcileMarkers.current) reconcileMarkers.current(v);
  }, [props.markers]);
  useEffect(() => {
    if (_watch9First.current) { _watch9First.current = false; return; }
    const v = props.popups;
    if (reconcilePopups.current) reconcilePopups.current(v);
  }, [props.popups]);
  useEffect(() => {
    if (_watch10First.current) { _watch10First.current = false; return; }
    applyLayers();
  }, [props.sources]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch11First.current) { _watch11First.current = false; return; }
    applyLayers();
  }, [props.layers]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch12First.current) { _watch12First.current = false; return; }
    const v = props.interactiveLayerIds;
    if (reconcileInteractive.current) reconcileInteractive.current(v);
  }, [props.interactiveLayerIds]);
  useEffect(() => {
    if (_watch13First.current) { _watch13First.current = false; return; }
    applyControls();
  }, [props.controls]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch14First.current) { _watch14First.current = false; return; }
    applyInteractionToggles();
  }, [props.dragPan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch15First.current) { _watch15First.current = false; return; }
    applyInteractionToggles();
  }, [props.dragRotate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch16First.current) { _watch16First.current = false; return; }
    applyInteractionToggles();
  }, [props.scrollZoom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch17First.current) { _watch17First.current = false; return; }
    applyInteractionToggles();
  }, [props.doubleClickZoom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch18First.current) { _watch18First.current = false; return; }
    applyInteractionToggles();
  }, [props.boxZoom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch19First.current) { _watch19First.current = false; return; }
    applyInteractionToggles();
  }, [props.keyboard]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch20First.current) { _watch20First.current = false; return; }
    applyInteractionToggles();
  }, [props.touchZoomRotate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch21First.current) { _watch21First.current = false; return; }
    applyInteractionToggles();
  }, [props.touchPitch]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ getMap, flyTo, easeTo, jumpTo, fitBounds, getCenter, getZoom, resize }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className={"rozie-maplibre"} ref={containerEl} data-rozie-s-f1ee1082="" />






    </>
  );
});
export default MapLibre;
