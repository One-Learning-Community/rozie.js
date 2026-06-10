import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal, rozieContext } from '@rozie/runtime-solid';
import maplibregl from 'maplibre-gl';

__rozieInjectStyle('MapLibre-f1ee1082', `.rozie-maplibre[data-rozie-s-f1ee1082] {
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
  }`);

interface MarkerSlotCtx { marker: any; index: any; }

interface PopupSlotCtx { popup: any; index: any; }

interface ControlSlotCtx { map: any; }

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
  onLoad?: (...args: unknown[]) => void;
  onIdle?: (...args: unknown[]) => void;
  onMove?: (...args: unknown[]) => void;
  onRotate?: (...args: unknown[]) => void;
  onDragstart?: (...args: unknown[]) => void;
  onDrag?: (...args: unknown[]) => void;
  onDragend?: (...args: unknown[]) => void;
  onClick?: (...args: unknown[]) => void;
  onDblclick?: (...args: unknown[]) => void;
  onContextmenu?: (...args: unknown[]) => void;
  onMousemove?: (...args: unknown[]) => void;
  onError?: (...args: unknown[]) => void;
  onStyledata?: (...args: unknown[]) => void;
  onSourcedata?: (...args: unknown[]) => void;
  onMoveend?: (...args: unknown[]) => void;
  onZoomend?: (...args: unknown[]) => void;
  onRotateend?: (...args: unknown[]) => void;
  onPitchend?: (...args: unknown[]) => void;
  onMouseenter?: (...args: unknown[]) => void;
  onMouseleave?: (...args: unknown[]) => void;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  markerSlot?: (ctx: () => MarkerSlotCtx) => JSX.Element;
  popupSlot?: (ctx: () => PopupSlotCtx) => JSX.Element;
  controlSlot?: (ctx: ControlSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: MapLibreHandle) => void;
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

export default function MapLibre(_props: MapLibreProps): JSX.Element {
  const _merged = mergeProps({ mapStyle: undefined, minZoom: 0, maxZoom: 22, maxBounds: undefined, bounds: undefined, fitBoundsOptions: (() => ({}))(), dragPan: true, dragRotate: true, scrollZoom: true, doubleClickZoom: true, boxZoom: true, keyboard: true, touchZoomRotate: true, touchPitch: true, markers: (() => [])(), popups: (() => [])(), sources: (() => [])(), layers: (() => [])(), interactiveLayerIds: (() => [])(), controls: (() => [])(), options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['center', 'zoom', 'bearing', 'pitch', 'mapStyle', 'minZoom', 'maxZoom', 'maxBounds', 'bounds', 'fitBoundsOptions', 'dragPan', 'dragRotate', 'scrollZoom', 'doubleClickZoom', 'boxZoom', 'keyboard', 'touchZoomRotate', 'touchPitch', 'markers', 'popups', 'sources', 'layers', 'interactiveLayerIds', 'controls', 'options', 'children', 'ref']);
  const resolved = () => local.children;
  onMount(() => { local.ref?.({ getMap, flyTo, easeTo, jumpTo, fitBounds, getCenter, getZoom, resize }); });

  const __ctx_maplibre_sources = rozieContext("maplibre:sources");
  const __ctx_maplibre_layers = rozieContext("maplibre:layers");
  const [center, setCenter] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'center', (() => [0, 0])());
  const [zoom, setZoom] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'zoom', 1);
  const [bearing, setBearing] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'bearing', 0);
  const [pitch, setPitch] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'pitch', 0);
  const [sourceReg, setSourceReg] = createSignal({});
  const [layerReg, setLayerReg] = createSignal({});
  interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portalDisposers = new Set<() => void>();
  const portals = {
    marker: (container: HTMLElement, scope: { marker: unknown; index: unknown }): ReactivePortalHandle => {
      const slot = _props.markerSlot ?? _props.slots?.['marker'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-marker', 'f1ee1082');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { marker: unknown; index: unknown })), container);
      portalDisposers.add(dispose);
      return {
        update: (s: unknown): void => {
          setScopeSig(s);
        },
        dispose: (): void => {
          dispose();
          portalDisposers.delete(dispose);
        },
      };
    },
    popup: (container: HTMLElement, scope: { popup: unknown; index: unknown }): ReactivePortalHandle => {
      const slot = _props.popupSlot ?? _props.slots?.['popup'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-popup', 'f1ee1082');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { popup: unknown; index: unknown })), container);
      portalDisposers.add(dispose);
      return {
        update: (s: unknown): void => {
          setScopeSig(s);
        },
        dispose: (): void => {
          dispose();
          portalDisposers.delete(dispose);
        },
      };
    },
    control: (container: HTMLElement, scope: { map: unknown }): (() => void) => {
      const slot = _props.controlSlot ?? _props.slots?.['control'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-control', 'f1ee1082');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
  };
  onCleanup(() => {
    for (const dispose of portalDisposers) dispose();
    portalDisposers.clear();
  });
  onMount(() => {
    const _cleanup = (() => {
    const el = containerElRef;

    // seed the null-let tracking arrays (declared null so typeNeutralize types them
    // `any`; the reconcile/teardown code only runs after this mount init).
    controlInstances = [];
    appliedLayerIds = [];
    appliedSourceIds = [];

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
      ...local.options,
      style: local.mapStyle ?? DEFAULT_STYLE,
      center: center(),
      zoom: zoom(),
      bearing: bearing(),
      pitch: pitch(),
      minZoom: local.minZoom,
      maxZoom: local.maxZoom,
      maxBounds: local.maxBounds,
      bounds: local.bounds,
      fitBoundsOptions: local.fitBoundsOptions,
      dragPan: local.dragPan,
      dragRotate: local.dragRotate,
      scrollZoom: local.scrollZoom,
      doubleClickZoom: local.doubleClickZoom,
      boxZoom: local.boxZoom,
      keyboard: local.keyboard,
      touchZoomRotate: local.touchZoomRotate,
      touchPitch: local.touchPitch
    };
    instance = new maplibregl.Map(mapOptions);

    // ─── forward map events ─────────────────────────────────────────────────
    // NOTE: the CONTINUOUS `zoom` and `pitch` events are deliberately NOT forwarded
    // — `zoom` and `pitch` are also two-way `model: true` camera props, and a same-
    // named emit collides with the model on Vue (defineModel vs defineEmits) and
    // Angular (ModelSignal vs OutputEmitterRef). The two-way binding already conveys
    // zoom/pitch changes; consumers wanting an event get the terminal `zoomend` /
    // `pitchend` below. `move`/`rotate` have no such clash (the models are `center`
    // and `bearing`, not `move`/`rotate`), so those continuous events stay.
    instance.on('load', (e: any) => _props.onLoad?.(e));
    instance.on('idle', (e: any) => _props.onIdle?.(e));
    instance.on('move', (e: any) => _props.onMove?.(e));
    instance.on('rotate', (e: any) => _props.onRotate?.(e));
    instance.on('dragstart', (e: any) => _props.onDragstart?.(e));
    instance.on('drag', (e: any) => _props.onDrag?.(e));
    instance.on('dragend', (e: any) => _props.onDragend?.(e));
    instance.on('click', (e: any) => _props.onClick?.(payload(e)));
    instance.on('dblclick', (e: any) => _props.onDblclick?.(payload(e)));
    instance.on('contextmenu', (e: any) => _props.onContextmenu?.(payload(e)));
    instance.on('mousemove', (e: any) => _props.onMousemove?.(payload(e)));
    instance.on('error', (e: any) => _props.onError?.(e));
    instance.on('styledata', (e: any) => _props.onStyledata?.(e));
    instance.on('sourcedata', (e: any) => _props.onSourcedata?.(e));

    // ─── camera-lifecycle + two-way echo (echo-guarded) ─────────────────────
    instance.on('moveend', (e: any) => {
      _props.onMoveend?.(e);
      if (e.rozieProgrammatic) return;
      const c = instance.getCenter();
      const next = [c.lng, c.lat];
      if (!sameCenter(next, center())) setCenter(next);
      const z = instance.getZoom();
      if (z !== zoom()) setZoom(z);
    });
    instance.on('zoomend', (e: any) => {
      _props.onZoomend?.(e);
      if (e.rozieProgrammatic) return;
      const z = instance.getZoom();
      if (z !== zoom()) setZoom(z);
    });
    instance.on('rotateend', (e: any) => {
      _props.onRotateend?.(e);
      if (e.rozieProgrammatic) return;
      const b = instance.getBearing();
      if (b !== bearing()) setBearing(b);
    });
    instance.on('pitchend', (e: any) => {
      _props.onPitchend?.(e);
      if (e.rozieProgrammatic) return;
      const p = instance.getPitch();
      if (p !== pitch()) setPitch(p);
    });

    // ─── REACTIVE MULTI-INSTANCE marker portal slot ─────────────────────────
    // One reactive portal handle per markers[] entry, reconciled keep/update/dispose
    // on prop change. Built here so $portals.marker is in the mount scope; bridged
    // to the top-level $watch via reconcileMarkers (CM rebuildGutterExt discipline).
    reconcileMarkers = (list: any) => {
      if (!(_props.markerSlot ?? _props.slots?.["marker"])) return;
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
          }).setLngLat([m.lng, m.lat]).addTo(instance);
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
    reconcilePopups = (list: any) => {
      if (!(_props.popupSlot ?? _props.slots?.["popup"])) return;
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
          }).setLngLat([p.lng, p.lat]).setDOMContent(node).addTo(instance);
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
    reconcileInteractive = (ids: any) => {
      const want = (Array.isArray(ids) ? ids : []).filter(Boolean);
      for (const [id, l] of featureListeners as any) {
        if (!want.includes(id)) {
          instance.off('mouseenter', id, l.enter);
          instance.off('mouseleave', id, l.leave);
          featureListeners.delete(id);
        }
      }
      for (const id of want as any) {
        if (featureListeners.has(id)) continue;
        const enter = (e: any) => _props.onMouseenter?.(payload(e));
        const leave = (e: any) => _props.onMouseleave?.(payload(e));
        instance.on('mouseenter', id, enter);
        instance.on('mouseleave', id, leave);
        featureListeners.set(id, {
          enter,
          leave
        });
      }
    };

    // ─── mount-once custom CONTROL portal slot ──────────────────────────────
    if ((_props.controlSlot ?? _props.slots?.["control"])) {
      const host = document.createElement('div');
      host.className = 'maplibregl-ctrl rozie-maplibre-control';
      customControl = {
        onAdd() {
          return host;
        },
        onRemove() {
          if (host.parentNode) host.parentNode.removeChild(host);
        }
      };
      instance.addControl(customControl, 'top-right');
      controlDispose = portals.control(host, {
        map: instance
      });
    }

    // standard controls + interaction toggles don't need style load.
    applyControls();
    applyInteractionToggles();

    // markers/popups/interactive are DOM/event overlays — no style-load gate.
    reconcileMarkers(local.markers);
    reconcilePopups(local.popups);
    reconcileInteractive(local.interactiveLayerIds);

    // sources/layers need the style loaded.
    if (instance.isStyleLoaded()) applyLayers();else instance.on('load', applyLayers);
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
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
    if (controlDispose) controlDispose();
    if (instance) instance.remove();
  });
  });
  createEffect(on(() => (() => center())(), (v) => untrack(() => ((v: any) => {
    if (!instance || !Array.isArray(v) || v.length !== 2) return;
    const c = instance.getCenter();
    if (v[0] === c.lng && v[1] === c.lat) return;
    instance.easeTo({
      center: v,
      animate: false
    }, PROGRAMMATIC);
  })(v)), { defer: true }));
  createEffect(on(() => (() => zoom())(), (v) => untrack(() => ((v: any) => {
    if (!instance || typeof v !== 'number' || v === instance.getZoom()) return;
    instance.easeTo({
      zoom: v,
      animate: false
    }, PROGRAMMATIC);
  })(v)), { defer: true }));
  createEffect(on(() => (() => bearing())(), (v) => untrack(() => ((v: any) => {
    if (!instance || typeof v !== 'number' || v === instance.getBearing()) return;
    instance.easeTo({
      bearing: v,
      animate: false
    }, PROGRAMMATIC);
  })(v)), { defer: true }));
  createEffect(on(() => (() => pitch())(), (v) => untrack(() => ((v: any) => {
    if (!instance || typeof v !== 'number' || v === instance.getPitch()) return;
    instance.easeTo({
      pitch: v,
      animate: false
    }, PROGRAMMATIC);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.mapStyle)(), (v) => untrack(() => ((v: any) => {
    if (!instance) return;
    // a new style wipes imperatively-added sources/layers — reset the applied
    // tracking and re-apply once the new style loads.
    appliedLayerIds = [];
    appliedSourceIds = [];
    instance.setStyle(v ?? DEFAULT_STYLE);
    instance.once('styledata', () => applyLayers());
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.minZoom)(), (v) => untrack(() => ((v: any) => {
    if (instance && typeof v === 'number') instance.setMinZoom(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.maxZoom)(), (v) => untrack(() => ((v: any) => {
    if (instance && typeof v === 'number') instance.setMaxZoom(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.maxBounds)(), (v) => untrack(() => ((v: any) => {
    if (instance) instance.setMaxBounds(v || null);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.markers)(), (v) => untrack(() => ((v: any) => {
    if (reconcileMarkers) reconcileMarkers(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.popups)(), (v) => untrack(() => ((v: any) => {
    if (reconcilePopups) reconcilePopups(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.sources)(), (v) => untrack(() => (() => applyLayers())()), { defer: true }));
  createEffect(on(() => (() => local.layers)(), (v) => untrack(() => (() => applyLayers())()), { defer: true }));
  createEffect(on(() => (() => sourceReg())(), (v) => untrack(() => (() => applyLayers())()), { defer: true }));
  createEffect(on(() => (() => layerReg())(), (v) => untrack(() => (() => applyLayers())()), { defer: true }));
  createEffect(on(() => (() => local.interactiveLayerIds)(), (v) => untrack(() => ((v: any) => {
    if (reconcileInteractive) reconcileInteractive(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.controls)(), (v) => untrack(() => (() => applyControls())()), { defer: true }));
  createEffect(on(() => (() => local.dragPan)(), (v) => untrack(() => (() => applyInteractionToggles())()), { defer: true }));
  createEffect(on(() => (() => local.dragRotate)(), (v) => untrack(() => (() => applyInteractionToggles())()), { defer: true }));
  createEffect(on(() => (() => local.scrollZoom)(), (v) => untrack(() => (() => applyInteractionToggles())()), { defer: true }));
  createEffect(on(() => (() => local.doubleClickZoom)(), (v) => untrack(() => (() => applyInteractionToggles())()), { defer: true }));
  createEffect(on(() => (() => local.boxZoom)(), (v) => untrack(() => (() => applyInteractionToggles())()), { defer: true }));
  createEffect(on(() => (() => local.keyboard)(), (v) => untrack(() => (() => applyInteractionToggles())()), { defer: true }));
  createEffect(on(() => (() => local.touchZoomRotate)(), (v) => untrack(() => (() => applyInteractionToggles())()), { defer: true }));
  createEffect(on(() => (() => local.touchPitch)(), (v) => untrack(() => (() => applyInteractionToggles())()), { defer: true }));
  let containerElRef: HTMLElement | null = null;

  let instance: any = null;

  // MapLibre's official no-token demo tiles — the zero-config `mapStyle` fallback
  // (the prop default is `undefined`; see the prop note).
  const DEFAULT_STYLE = 'https://demotiles.maplibre.org/style.json';

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
  const markerEntries = new Map();
  const popupEntries = new Map();

  // ─── declarative-children registry (Phase 37 $provide/$inject dogfood) ───────
  // Publish the source/layer register-API the <Source>/<Layer> children $inject and
  // self-register into. EVERY method uses WHOLE-OBJECT REPLACEMENT (spread / clone-
  // and-delete) so the watched $data.sourceReg/$data.layerReg reference changes once
  // per mutation and the parent $watch fires on all 6 targets (D-3 / Pitfall 1 — an
  // in-place `$data.sourceReg[id] = spec` is silent on React/Solid/Angular/Lit). The
  // register surface mirrors the SHIPPED Tabs.rozie $provide('tabs', { … }) shape;
  // register/update share a body (both upsert by id). The values feed the SAME
  // applyLayers() reconcile + appliedSourceIds/appliedLayerIds provenance as the
  // config-array props, so registry-managed sources/layers are reaped on unregister
  // exactly like prop-managed ones (D37-08).

  // standard-control instances (so a controls-prop change can remove + re-add) and
  // the mount-once custom-control portal dispose. controlInstances is a null-let
  // (→ typeNeutralize `any`) initialized to [] in $onMount: a bare `let x = []`
  // infers `never[]` under the strict framework-typecheck harness and rejects the
  // `any` control instances pushed into it.
  let controlInstances: any = null;
  let controlDispose: any = null;
  let customControl: any = null;
  // layer-scoped feature listeners, registered per interactiveLayerId so they can
  // be unregistered on change. id → { enter, leave }.
  const featureListeners = new Map();
  // previously-applied source/layer ids (null-lets → `any`, [] in $onMount; same
  // never[] reason as controlInstances) so a sources/layers prop change can remove
  // the dropped ones.
  let appliedLayerIds: any = null;
  let appliedSourceIds: any = null;

  // The $portals/$emit-capturing reconcilers are built INSIDE $onMount (a top-level
  // $portals reference fails the bundled-leaf strict typecheck — the CM/TipTap
  // portal discipline) and bridged here so the top-level $watch can call them.
  let reconcileMarkers: any = null;
  let reconcilePopups: any = null;
  let reconcileInteractive: any = null;

  // ─── pure helpers (no sigils → safe at top level) ───────────────────────────
  function sameCenter(a: any, b: any) {
    return Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
  }

  // structured pointer-event payload — stable across targets, avoids handing the
  // raw engine event (with its circular `target: Map`) to consumers.
  function payload(e: any) {
    return {
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
    };
  }
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

  // Standard controls reconcile — no $portals/$emit, so top-level. Remove-all +
  // re-add from the config (controls rarely change; cheap and order-correct).
  function applyControls() {
    if (!instance) return;
    for (const c of controlInstances as any) instance.removeControl(c);
    controlInstances = [];
    for (const spec of local.controls as any) {
      if (!spec) continue;
      const ctrl = buildControl(spec);
      if (!ctrl) continue;
      const position = typeof spec === 'object' && spec.position || undefined;
      instance.addControl(ctrl, position);
      controlInstances.push(ctrl);
    }
  }

  // Interaction-toggle reconcile — each toggle maps to a runtime handler object.
  function applyInteractionToggles() {
    if (!instance) return;
    const set = (name: any, on: any) => {
      const handler = instance[name];
      if (handler) on ? handler.enable() : handler.disable();
    };
    set('dragPan', local.dragPan);
    set('dragRotate', local.dragRotate);
    set('scrollZoom', local.scrollZoom);
    set('doubleClickZoom', local.doubleClickZoom);
    set('boxZoom', local.boxZoom);
    set('keyboard', local.keyboard);
    set('touchZoomRotate', local.touchZoomRotate);
    set('touchPitch', local.touchPitch);
  }

  // Style-load-gated source/layer reconcile. Order matters: drop removed layers
  // FIRST, then add/update sources, then add/update layers, then drop removed
  // sources (after their layers are gone).
  function applyLayers() {
    if (!instance || !instance.isStyleLoaded()) return;

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
    const mergedSources = mergeById(local.sources, sourceReg());
    const mergedLayers = mergeById(local.layers, layerReg());
    const wantLayerIds = mergedLayers.map((l: any) => l && l.id).filter(Boolean);
    const wantSourceIds = mergedSources.map((s: any) => s && s.id).filter(Boolean);

    // 1. drop removed layers
    for (const id of appliedLayerIds as any) {
      if (!wantLayerIds.includes(id) && instance.getLayer(id)) instance.removeLayer(id);
    }
    // 2. add/update sources
    for (const s of mergedSources as any) {
      if (!s || !s.id) continue;
      const spec = s.spec || s;
      const existing = instance.getSource(s.id);
      if (!existing) instance.addSource(s.id, spec);else if (spec.type === 'geojson' && spec.data) existing.setData(spec.data);
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
      if (!instance.getLayer(l.id)) {
        const needsSource = l.type !== 'background';
        if (needsSource && (l.source == null || !instance.getSource(l.source))) continue;
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
          instance.addLayer(clean, l.beforeId);
        } catch (e: any) {
          // surfaced via the `error` emit path; skip so later layers still apply.
        }
      } else {
        if (l.paint) for (const k in l.paint) instance.setPaintProperty(l.id, k, l.paint[k]);
        if (l.layout) for (const k in l.layout) instance.setLayoutProperty(l.id, k, l.layout[k]);
      }
    }
    // 4. drop removed sources (their layers are gone)
    for (const id of appliedSourceIds as any) {
      if (!wantSourceIds.includes(id) && instance.getSource(id)) instance.removeSource(id);
    }
    appliedLayerIds = wantLayerIds;
    appliedSourceIds = wantSourceIds;
  }
  // ─── imperative handle (Phase 21 $expose) ───────────────────────────────────
  // 8 verbs. Collision-clear across all 3 classes: NOT a React model-setter
  // (setCenter/setZoom/setBearing/setPitch are the auto-gen'd ones — none here);
  // NOT a Lit lifecycle name (update/render/firstUpdated/updated/willUpdate/
  // requestUpdate); NOT an emitted event name (move/zoom/rotate/pitch/drag/click/
  // idle/error — getCenter/getZoom/resize/flyTo/easeTo/jumpTo/fitBounds/getMap all
  // differ). The camera verbs deliberately omit PROGRAMMATIC so an imperative move
  // echoes into $model (the prop $watch then no-ops, getCenter already matching).
  function getMap() {
    return instance;
  }
  function flyTo(opts: any) {
    if (instance) instance.flyTo(opts);
  }
  function easeTo(opts: any) {
    if (instance) instance.easeTo(opts);
  }
  function jumpTo(opts: any) {
    if (instance) instance.jumpTo(opts);
  }
  function fitBounds(bounds: any, opts: any) {
    if (instance) instance.fitBounds(bounds, opts);
  }
  function getCenter() {
    if (!instance) return null;
    const c = instance.getCenter();
    return [c.lng, c.lat];
  }
  function getZoom() {
    return instance ? instance.getZoom() : null;
  }
  function resize() {
    if (instance) instance.resize();
  }

  return (
    <__ctx_maplibre_sources.Provider value={{
  register: (id: any, spec: any) => {
    setSourceReg({
      ...sourceReg(),
      [id]: spec
    });
  },
  update: (id: any, spec: any) => {
    setSourceReg({
      ...sourceReg(),
      [id]: spec
    });
  },
  unregister: (id: any) => {
    const n = {
      ...sourceReg()
    };
    delete n[id];
    setSourceReg(n);
  }
}}>
    <__ctx_maplibre_layers.Provider value={{
  register: (id: any, spec: any) => {
    setLayerReg({
      ...layerReg(),
      [id]: spec
    });
  },
  update: (id: any, spec: any) => {
    setLayerReg({
      ...layerReg(),
      [id]: spec
    });
  },
  unregister: (id: any) => {
    const n = {
      ...layerReg()
    };
    delete n[id];
    setLayerReg(n);
  }
}}>
    <>
    <div class={"rozie-maplibre"} ref={(el) => { containerElRef = el as HTMLElement; }} data-rozie-s-f1ee1082="" />

    {resolved()}






    </>
    </__ctx_maplibre_layers.Provider>
    </__ctx_maplibre_sources.Provider>
  );
}
