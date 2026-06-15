<template>

<div class="rozie-maplibre" ref="containerElRef"></div>

<slot></slot>







</template>

<script setup lang="ts">
import { Fragment, h, onBeforeUnmount, onMounted, provide, ref, render, useSlots, watch } from 'vue';

const props = withDefaults(
  defineProps<{ mapStyle?: unknown; minZoom?: number; maxZoom?: number; maxBounds?: unknown; bounds?: unknown; fitBoundsOptions?: Record<string, any>; dragPan?: boolean; dragRotate?: boolean; scrollZoom?: boolean; doubleClickZoom?: boolean; boxZoom?: boolean; keyboard?: boolean; touchZoomRotate?: boolean; touchPitch?: boolean; markers?: any[]; popups?: any[]; sources?: any[]; layers?: any[]; interactiveLayerIds?: any[]; controls?: any[]; options?: Record<string, any> }>(),
  { mapStyle: undefined, minZoom: 0, maxZoom: 22, maxBounds: undefined, bounds: undefined, fitBoundsOptions: () => ({}), dragPan: true, dragRotate: true, scrollZoom: true, doubleClickZoom: true, boxZoom: true, keyboard: true, touchZoomRotate: true, touchPitch: true, markers: () => [], popups: () => [], sources: () => [], layers: () => [], interactiveLayerIds: () => [], controls: () => [], options: () => ({}) }
);

const center = defineModel<any[]>('center', { default: () => [0, 0] });
const zoom = defineModel<number>('zoom', { default: 1 });
const bearing = defineModel<number>('bearing', { default: 0 });
const pitch = defineModel<number>('pitch', { default: 0 });

const emit = defineEmits<{
  load: [...args: any[]];
  idle: [...args: any[]];
  move: [...args: any[]];
  rotate: [...args: any[]];
  dragstart: [...args: any[]];
  drag: [...args: any[]];
  dragend: [...args: any[]];
  click: [...args: any[]];
  dblclick: [...args: any[]];
  contextmenu: [...args: any[]];
  mousemove: [...args: any[]];
  error: [...args: any[]];
  styledata: [...args: any[]];
  sourcedata: [...args: any[]];
  moveend: [...args: any[]];
  zoomend: [...args: any[]];
  rotateend: [...args: any[]];
  pitchend: [...args: any[]];
  mouseenter: [...args: any[]];
  mouseleave: [...args: any[]];
}>();

defineSlots<{
  default(props: {  }): any;
  marker(props: { marker: any; index: any }): any;
  popup(props: { popup: any; index: any }): any;
  control(props: { map: any }): any;
}>();

const slots = useSlots();

const sourceReg = ref({});
const layerReg = ref({});

const containerElRef = ref<HTMLElement>();

import maplibregl from 'maplibre-gl';
let instance: any = null;

// MapLibre's official no-token demo tiles — the zero-config `mapStyle` fallback
// (the prop default is `undefined`; see the prop note).
// MapLibre's official no-token demo tiles — the zero-config `mapStyle` fallback
// (the prop default is `undefined`; see the prop note).
const DEFAULT_STYLE = 'https://demotiles.maplibre.org/style.json';

// The eventData merged onto programmatic camera ops so the camera-lifecycle echo
// handlers can ignore our own moves (the documented MapLibre echo-guard — robust
// across batched ops where Leaflet's single boolean would race).
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
// layer-scoped feature listeners, registered per interactiveLayerId so they can
// be unregistered on change. id → { enter, leave }.
const featureListeners = new Map();
// previously-applied source/layer ids (null-lets → `any`, [] in $onMount; same
// never[] reason as controlInstances) so a sources/layers prop change can remove
// the dropped ones.
// previously-applied source/layer ids (null-lets → `any`, [] in $onMount; same
// never[] reason as controlInstances) so a sources/layers prop change can remove
// the dropped ones.
let appliedLayerIds: any = null;
let appliedSourceIds: any = null;

// The $portals/$emit-capturing reconcilers are built INSIDE $onMount (a top-level
// $portals reference fails the bundled-leaf strict typecheck — the CM/TipTap
// portal discipline) and bridged here so the top-level $watch can call them.
// The $portals/$emit-capturing reconcilers are built INSIDE $onMount (a top-level
// $portals reference fails the bundled-leaf strict typecheck — the CM/TipTap
// portal discipline) and bridged here so the top-level $watch can call them.
let reconcileMarkers: any = null;
let reconcilePopups: any = null;
let reconcileInteractive: any = null;

// ─── pure helpers (no sigils → safe at top level) ───────────────────────────
// ─── pure helpers (no sigils → safe at top level) ───────────────────────────
const sameCenter = (a: any, b: any) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];

// structured pointer-event payload — stable across targets, avoids handing the
// raw engine event (with its circular `target: Map`) to consumers.
// structured pointer-event payload — stable across targets, avoids handing the
// raw engine event (with its circular `target: Map`) to consumers.
const payload = (e: any) => ({
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
const buildControl = (spec: any) => {
  const type = typeof spec === 'string' ? spec : spec.type;
  const opts = typeof spec === 'object' && spec.options || {};
  if (type === 'navigation') return new maplibregl.NavigationControl(opts);
  if (type === 'geolocate') return new maplibregl.GeolocateControl(opts);
  if (type === 'scale') return new maplibregl.ScaleControl(opts);
  if (type === 'fullscreen') return new maplibregl.FullscreenControl(opts);
  if (type === 'attribution') return new maplibregl.AttributionControl(opts);
  return null;
};

// Standard controls reconcile — no $portals/$emit, so top-level. Remove-all +
// re-add from the config (controls rarely change; cheap and order-correct).
// Standard controls reconcile — no $portals/$emit, so top-level. Remove-all +
// re-add from the config (controls rarely change; cheap and order-correct).
const applyControls = () => {
  if (!instance) return;
  for (const c of controlInstances as any) instance.removeControl(c);
  controlInstances = [];
  for (const spec of props.controls as any) {
    if (!spec) continue;
    const ctrl = buildControl(spec);
    if (!ctrl) continue;
    const position = typeof spec === 'object' && spec.position || undefined;
    instance.addControl(ctrl, position);
    controlInstances.push(ctrl);
  }
};

// Interaction-toggle reconcile — each toggle maps to a runtime handler object.
// Interaction-toggle reconcile — each toggle maps to a runtime handler object.
const applyInteractionToggles = () => {
  if (!instance) return;
  const set = (name: any, on: any) => {
    const handler = instance[name];
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
};

// Style-load-gated source/layer reconcile. Order matters: drop removed layers
// FIRST, then add/update sources, then add/update layers, then drop removed
// sources (after their layers are gone).
// Style-load-gated source/layer reconcile. Order matters: drop removed layers
// FIRST, then add/update sources, then add/update layers, then drop removed
// sources (after their layers are gone).
const applyLayers = () => {
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
  const mergedSources = mergeById(props.sources, sourceReg.value);
  const mergedLayers = mergeById(props.layers, layerReg.value);
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
};
// ─── imperative handle (Phase 21 $expose) ───────────────────────────────────
// 15 verbs. Collision-clear across all 3 classes: NOT a React model-setter
// (setCenter/setZoom/setBearing/setPitch are the auto-gen'd ones — none here);
// NOT a Lit lifecycle name (update/render/firstUpdated/updated/willUpdate/
// requestUpdate); NOT an emitted event name (move/zoom/rotate/pitch/drag/click/
// idle/error — getCenter/getZoom/resize/flyTo/easeTo/jumpTo/fitBounds/getMap all
// differ; zoomIn/zoomOut differ from the `zoomend` emit). The camera verbs
// deliberately omit PROGRAMMATIC so an imperative move echoes into $model (the
// prop $watch then no-ops, getCenter already matching).
//
// Camera control is well-covered above; the read/hit-test/projection family
// below is what a consumer needs to build custom controls, overlays, and click
// interactivity — none reachable via prop/model/event:
//   - queryRenderedFeatures: hit-test "what's under this pixel/box" (click-to-
//     inspect, selection beyond per-layer mouseenter/leave).
//   - project / unproject: convert geo<->screen for positioning framework DOM
//     overlays over map coordinates.
//   - getBounds: read the live visible viewport bbox (lazy-fetch data for the
//     current view) — distinct from the construction-only `bounds` prop.
//   - zoomIn / zoomOut / panBy: ergonomic nudges for a consumer's own controls.
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
function queryRenderedFeatures(geometry: any, options: any) {
  return instance ? instance.queryRenderedFeatures(geometry, options) : [];
}
function project(lngLat: any) {
  return instance ? instance.project(lngLat) : null;
}
function unproject(point: any) {
  return instance ? instance.unproject(point) : null;
}
function getBounds() {
  return instance ? instance.getBounds() : null;
}
function zoomIn(opts: any) {
  if (instance) instance.zoomIn(opts);
}
function zoomOut(opts: any) {
  if (instance) instance.zoomOut(opts);
}
function panBy(offset: any, opts: any) {
  if (instance) instance.panBy(offset, opts);
}

provide('maplibre:sources', {
  register: (id: any, spec: any) => {
    sourceReg.value = {
      ...sourceReg.value,
      [id]: spec
    };
  },
  update: (id: any, spec: any) => {
    sourceReg.value = {
      ...sourceReg.value,
      [id]: spec
    };
  },
  unregister: (id: any) => {
    const n = {
      ...sourceReg.value
    };
    delete n[id];
    sourceReg.value = n;
  }
});
provide('maplibre:layers', {
  register: (id: any, spec: any) => {
    layerReg.value = {
      ...layerReg.value,
      [id]: spec
    };
  },
  update: (id: any, spec: any) => {
    layerReg.value = {
      ...layerReg.value,
      [id]: spec
    };
  },
  unregister: (id: any) => {
    const n = {
      ...layerReg.value
    };
    delete n[id];
    layerReg.value = n;
  }
});

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
}
const portalContainers = new Set<HTMLElement>();
const portals = {
  marker: (container: HTMLElement, scope: { marker: unknown; index: unknown }): ReactivePortalHandle => {
    const slotFn = slots.marker;
    if (!slotFn) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // marker { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-marker', 'f1ee1082');
    const renderScope = (s: unknown): void => {
      render(h(Fragment, null, slotFn(s)), container);
    };
    renderScope(scope);
    portalContainers.add(container);
    return {
      update: (s: unknown): void => renderScope(s),
      dispose: (): void => {
        render(null, container);
        portalContainers.delete(container);
      },
    };
  },
  popup: (container: HTMLElement, scope: { popup: unknown; index: unknown }): ReactivePortalHandle => {
    const slotFn = slots.popup;
    if (!slotFn) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // popup { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-popup', 'f1ee1082');
    const renderScope = (s: unknown): void => {
      render(h(Fragment, null, slotFn(s)), container);
    };
    renderScope(scope);
    portalContainers.add(container);
    return {
      update: (s: unknown): void => renderScope(s),
      dispose: (): void => {
        render(null, container);
        portalContainers.delete(container);
      },
    };
  },
  control: (container: HTMLElement, scope: { map: unknown }): (() => void) => {
    const slotFn = slots.control;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // control { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-control', 'f1ee1082');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
};
onBeforeUnmount(() => {
  for (const container of portalContainers) render(null, container);
  portalContainers.clear();
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  const el = containerElRef.value;

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
    ...props.options,
    style: props.mapStyle ?? DEFAULT_STYLE,
    center: center.value,
    zoom: zoom.value,
    bearing: bearing.value,
    pitch: pitch.value,
    minZoom: props.minZoom,
    maxZoom: props.maxZoom,
    maxBounds: props.maxBounds,
    bounds: props.bounds,
    fitBoundsOptions: props.fitBoundsOptions,
    dragPan: props.dragPan,
    dragRotate: props.dragRotate,
    scrollZoom: props.scrollZoom,
    doubleClickZoom: props.doubleClickZoom,
    boxZoom: props.boxZoom,
    keyboard: props.keyboard,
    touchZoomRotate: props.touchZoomRotate,
    touchPitch: props.touchPitch
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
  instance.on('load', (e: any) => emit('load', e));
  instance.on('idle', (e: any) => emit('idle', e));
  instance.on('move', (e: any) => emit('move', e));
  instance.on('rotate', (e: any) => emit('rotate', e));
  instance.on('dragstart', (e: any) => emit('dragstart', e));
  instance.on('drag', (e: any) => emit('drag', e));
  instance.on('dragend', (e: any) => emit('dragend', e));
  instance.on('click', (e: any) => emit('click', payload(e)));
  instance.on('dblclick', (e: any) => emit('dblclick', payload(e)));
  instance.on('contextmenu', (e: any) => emit('contextmenu', payload(e)));
  instance.on('mousemove', (e: any) => emit('mousemove', payload(e)));
  instance.on('error', (e: any) => emit('error', e));
  instance.on('styledata', (e: any) => emit('styledata', e));
  instance.on('sourcedata', (e: any) => emit('sourcedata', e));

  // ─── camera-lifecycle + two-way echo (echo-guarded) ─────────────────────
  instance.on('moveend', (e: any) => {
    emit('moveend', e);
    if (e.rozieProgrammatic) return;
    const c = instance.getCenter();
    const next = [c.lng, c.lat];
    if (!sameCenter(next, center.value)) center.value = next;
    const z = instance.getZoom();
    if (z !== zoom.value) zoom.value = z;
  });
  instance.on('zoomend', (e: any) => {
    emit('zoomend', e);
    if (e.rozieProgrammatic) return;
    const z = instance.getZoom();
    if (z !== zoom.value) zoom.value = z;
  });
  instance.on('rotateend', (e: any) => {
    emit('rotateend', e);
    if (e.rozieProgrammatic) return;
    const b = instance.getBearing();
    if (b !== bearing.value) bearing.value = b;
  });
  instance.on('pitchend', (e: any) => {
    emit('pitchend', e);
    if (e.rozieProgrammatic) return;
    const p = instance.getPitch();
    if (p !== pitch.value) pitch.value = p;
  });

  // ─── REACTIVE MULTI-INSTANCE marker portal slot ─────────────────────────
  // One reactive portal handle per markers[] entry, reconciled keep/update/dispose
  // on prop change. Built here so $portals.marker is in the mount scope; bridged
  // to the top-level $watch via reconcileMarkers (CM rebuildGutterExt discipline).
  reconcileMarkers = (list: any) => {
    if (!slots.marker) return;
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
    if (!slots.popup) return;
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
      const enter = (e: any) => emit('mouseenter', payload(e));
      const leave = (e: any) => emit('mouseleave', payload(e));
      instance.on('mouseenter', id, enter);
      instance.on('mouseleave', id, leave);
      featureListeners.set(id, {
        enter,
        leave
      });
    }
  };

  // ─── mount-once custom CONTROL portal slot ──────────────────────────────
  if (slots.control) {
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
  reconcileMarkers(props.markers);
  reconcilePopups(props.popups);
  reconcileInteractive(props.interactiveLayerIds);

  // sources/layers need the style loaded.
  if (instance.isStyleLoaded()) applyLayers();else instance.on('load', applyLayers);
  _cleanup_0 = () => {
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
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => center.value, (v: any) => {
  if (!instance || !Array.isArray(v) || v.length !== 2) return;
  const c = instance.getCenter();
  if (v[0] === c.lng && v[1] === c.lat) return;
  instance.easeTo({
    center: v,
    animate: false
  }, PROGRAMMATIC);
});
watch(() => zoom.value, (v: any) => {
  if (!instance || typeof v !== 'number' || v === instance.getZoom()) return;
  instance.easeTo({
    zoom: v,
    animate: false
  }, PROGRAMMATIC);
});
watch(() => bearing.value, (v: any) => {
  if (!instance || typeof v !== 'number' || v === instance.getBearing()) return;
  instance.easeTo({
    bearing: v,
    animate: false
  }, PROGRAMMATIC);
});
watch(() => pitch.value, (v: any) => {
  if (!instance || typeof v !== 'number' || v === instance.getPitch()) return;
  instance.easeTo({
    pitch: v,
    animate: false
  }, PROGRAMMATIC);
});
watch(() => props.mapStyle, (v: any) => {
  if (!instance) return;
  // a new style wipes imperatively-added sources/layers — reset the applied
  // tracking and re-apply once the new style loads.
  appliedLayerIds = [];
  appliedSourceIds = [];
  instance.setStyle(v ?? DEFAULT_STYLE);
  instance.once('styledata', () => applyLayers());
});
watch(() => props.minZoom, (v: any) => {
  if (instance && typeof v === 'number') instance.setMinZoom(v);
});
watch(() => props.maxZoom, (v: any) => {
  if (instance && typeof v === 'number') instance.setMaxZoom(v);
});
watch(() => props.maxBounds, (v: any) => {
  if (instance) instance.setMaxBounds(v || null);
});
watch(() => props.markers, (v: any) => {
  if (reconcileMarkers) reconcileMarkers(v);
});
watch(() => props.popups, (v: any) => {
  if (reconcilePopups) reconcilePopups(v);
});
watch(() => props.sources, () => applyLayers());
watch(() => props.layers, () => applyLayers());
watch(() => sourceReg.value, () => applyLayers());
watch(() => layerReg.value, () => applyLayers());
watch(() => props.interactiveLayerIds, (v: any) => {
  if (reconcileInteractive) reconcileInteractive(v);
});
watch(() => props.controls, () => applyControls());
watch(() => props.dragPan, () => applyInteractionToggles());
watch(() => props.dragRotate, () => applyInteractionToggles());
watch(() => props.scrollZoom, () => applyInteractionToggles());
watch(() => props.doubleClickZoom, () => applyInteractionToggles());
watch(() => props.boxZoom, () => applyInteractionToggles());
watch(() => props.keyboard, () => applyInteractionToggles());
watch(() => props.touchZoomRotate, () => applyInteractionToggles());
watch(() => props.touchPitch, () => applyInteractionToggles());

defineExpose({ getMap, flyTo, easeTo, jumpTo, fitBounds, getCenter, getZoom, resize, queryRenderedFeatures, project, unproject, getBounds, zoomIn, zoomOut, panBy });
</script>

<style scoped>
.rozie-maplibre {
  width: 100%;
  height: 100%;
  min-height: 300px;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
}
</style>

<style>
.rozie-maplibre .rozie-maplibre-marker {
    cursor: pointer;
  }
.rozie-maplibre .rozie-maplibre-control {
    display: flex;
    flex-direction: column;
  }
</style>
