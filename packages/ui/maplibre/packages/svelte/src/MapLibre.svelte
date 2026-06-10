<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';
import { onMount, setContext, untrack } from 'svelte';

interface Props {
  center?: any[];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  mapStyle?: unknown;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: unknown;
  bounds?: unknown;
  fitBoundsOptions?: any;
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
  options?: any;
  children?: Snippet;
  marker?: Snippet<[{ marker: any; index: any }]>;
  popup?: Snippet<[{ popup: any; index: any }]>;
  control?: Snippet<[{ map: any }]>;
  snippets?: Record<string, any>;
  onload?: (...args: unknown[]) => void;
  onidle?: (...args: unknown[]) => void;
  onmove?: (...args: unknown[]) => void;
  onrotate?: (...args: unknown[]) => void;
  ondragstart?: (...args: unknown[]) => void;
  ondrag?: (...args: unknown[]) => void;
  ondragend?: (...args: unknown[]) => void;
  onclick?: (...args: unknown[]) => void;
  ondblclick?: (...args: unknown[]) => void;
  oncontextmenu?: (...args: unknown[]) => void;
  onmousemove?: (...args: unknown[]) => void;
  onerror?: (...args: unknown[]) => void;
  onstyledata?: (...args: unknown[]) => void;
  onsourcedata?: (...args: unknown[]) => void;
  onmoveend?: (...args: unknown[]) => void;
  onzoomend?: (...args: unknown[]) => void;
  onrotateend?: (...args: unknown[]) => void;
  onpitchend?: (...args: unknown[]) => void;
  onmouseenter?: (...args: unknown[]) => void;
  onmouseleave?: (...args: unknown[]) => void;
}

let __defaultFitBoundsOptions = (() => ({}))();
let __defaultMarkers = (() => [])();
let __defaultPopups = (() => [])();
let __defaultSources = (() => [])();
let __defaultLayers = (() => [])();
let __defaultInteractiveLayerIds = (() => [])();
let __defaultControls = (() => [])();
let __defaultOptions = (() => ({}))();

let {
  center = $bindable((() => [0, 0])()),
  zoom = $bindable(1),
  bearing = $bindable(0),
  pitch = $bindable(0),
  mapStyle = undefined,
  minZoom = 0,
  maxZoom = 22,
  maxBounds = undefined,
  bounds = undefined,
  fitBoundsOptions = __defaultFitBoundsOptions,
  dragPan = true,
  dragRotate = true,
  scrollZoom = true,
  doubleClickZoom = true,
  boxZoom = true,
  keyboard = true,
  touchZoomRotate = true,
  touchPitch = true,
  markers = __defaultMarkers,
  popups = __defaultPopups,
  sources = __defaultSources,
  layers = __defaultLayers,
  interactiveLayerIds = __defaultInteractiveLayerIds,
  controls = __defaultControls,
  options = __defaultOptions,
  children: __childrenProp,
  marker: __markerProp,
  popup: __popupProp,
  control: __controlProp,
  snippets,
  onload,
  onidle,
  onmove,
  onrotate,
  ondragstart,
  ondrag,
  ondragend,
  onclick,
  ondblclick,
  oncontextmenu,
  onmousemove,
  onerror,
  onstyledata,
  onsourcedata,
  onmoveend,
  onzoomend,
  onrotateend,
  onpitchend,
  onmouseenter,
  onmouseleave
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);
const marker = $derived(__markerProp ?? snippets?.marker);
const popup = $derived(__popupProp ?? snippets?.popup);
const control = $derived(__controlProp ?? snippets?.control);

let sourceReg = $state({});
let layerReg = $state({});

let containerEl = $state<HTMLElement | undefined>(undefined);

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
  for (const spec of controls as any) {
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
  set('dragPan', dragPan);
  set('dragRotate', dragRotate);
  set('scrollZoom', scrollZoom);
  set('doubleClickZoom', doubleClickZoom);
  set('boxZoom', boxZoom);
  set('keyboard', keyboard);
  set('touchZoomRotate', touchZoomRotate);
  set('touchPitch', touchPitch);
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
  const mergedSources = mergeById(sources, sourceReg);
  const mergedLayers = mergeById(layers, layerReg);
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
    if (!existing) instance.addSource(s.id, $state.snapshot(spec));else if (spec.type === 'geojson' && spec.data) existing.setData($state.snapshot(spec.data));
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
        instance.addLayer($state.snapshot(clean), l.beforeId);
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
// 8 verbs. Collision-clear across all 3 classes: NOT a React model-setter
// (setCenter/setZoom/setBearing/setPitch are the auto-gen'd ones — none here);
// NOT a Lit lifecycle name (update/render/firstUpdated/updated/willUpdate/
// requestUpdate); NOT an emitted event name (move/zoom/rotate/pitch/drag/click/
// idle/error — getCenter/getZoom/resize/flyTo/easeTo/jumpTo/fitBounds/getMap all
// differ). The camera verbs deliberately omit PROGRAMMATIC so an imperative move
// echoes into $model (the prop $watch then no-ops, getCenter already matching).
export function getMap() {
  return instance;
}
export function flyTo(opts: any) {
  if (instance) instance.flyTo(opts);
}
export function easeTo(opts: any) {
  if (instance) instance.easeTo(opts);
}
export function jumpTo(opts: any) {
  if (instance) instance.jumpTo(opts);
}
export function fitBounds(bounds: any, opts: any) {
  if (instance) instance.fitBounds(bounds, opts);
}
export function getCenter() {
  if (!instance) return null;
  const c = instance.getCenter();
  return [c.lng, c.lat];
}
export function getZoom() {
  return instance ? instance.getZoom() : null;
}
export function resize() {
  if (instance) instance.resize();
}

setContext('maplibre:sources', {
  register: (id: any, spec: any) => {
    sourceReg = {
      ...sourceReg,
      [id]: spec
    };
  },
  update: (id: any, spec: any) => {
    sourceReg = {
      ...sourceReg,
      [id]: spec
    };
  },
  unregister: (id: any) => {
    const n = {
      ...sourceReg
    };
    delete n[id];
    sourceReg = n;
  }
});
setContext('maplibre:layers', {
  register: (id: any, spec: any) => {
    layerReg = {
      ...layerReg,
      [id]: spec
    };
  },
  update: (id: any, spec: any) => {
    layerReg = {
      ...layerReg,
      [id]: spec
    };
  },
  unregister: (id: any) => {
    const n = {
      ...layerReg
    };
    delete n[id];
    layerReg = n;
  }
});

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
}
const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  marker: (container: HTMLElement, scope: { marker: unknown; index: unknown }): ReactivePortalHandle => {
    if (!marker) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-marker', 'f1ee1082');
    const inst = mount(PortalHostReactive, {
      target: container,
      props: { snippet: marker, initialScope: scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return {
      update: (s: unknown): void => {
        (inst as unknown as { update(s: unknown): void }).update(s);
      },
      dispose: (): void => {
        unmount(inst as Parameters<typeof unmount>[0]);
        portalInstances.delete(inst as Record<string, unknown>);
      },
    };
  },
  popup: (container: HTMLElement, scope: { popup: unknown; index: unknown }): ReactivePortalHandle => {
    if (!popup) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-popup', 'f1ee1082');
    const inst = mount(PortalHostReactive, {
      target: container,
      props: { snippet: popup, initialScope: scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return {
      update: (s: unknown): void => {
        (inst as unknown as { update(s: unknown): void }).update(s);
      },
      dispose: (): void => {
        unmount(inst as Parameters<typeof unmount>[0]);
        portalInstances.delete(inst as Record<string, unknown>);
      },
    };
  },
  control: (container: HTMLElement, scope: { map: unknown }): (() => void) => {
    if (!control) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-control', 'f1ee1082');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: control, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
  const el = containerEl;

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
    ...$state.snapshot(options),
    style: $state.snapshot(mapStyle) ?? DEFAULT_STYLE,
    center: center,
    zoom: zoom,
    bearing: bearing,
    pitch: pitch,
    minZoom: minZoom,
    maxZoom: maxZoom,
    maxBounds: $state.snapshot(maxBounds),
    bounds: $state.snapshot(bounds),
    fitBoundsOptions: $state.snapshot(fitBoundsOptions),
    dragPan: dragPan,
    dragRotate: dragRotate,
    scrollZoom: scrollZoom,
    doubleClickZoom: doubleClickZoom,
    boxZoom: boxZoom,
    keyboard: keyboard,
    touchZoomRotate: touchZoomRotate,
    touchPitch: touchPitch
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
  instance.on('load', (e: any) => onload?.(e));
  instance.on('idle', (e: any) => onidle?.(e));
  instance.on('move', (e: any) => onmove?.(e));
  instance.on('rotate', (e: any) => onrotate?.(e));
  instance.on('dragstart', (e: any) => ondragstart?.(e));
  instance.on('drag', (e: any) => ondrag?.(e));
  instance.on('dragend', (e: any) => ondragend?.(e));
  instance.on('click', (e: any) => onclick?.(payload(e)));
  instance.on('dblclick', (e: any) => ondblclick?.(payload(e)));
  instance.on('contextmenu', (e: any) => oncontextmenu?.(payload(e)));
  instance.on('mousemove', (e: any) => onmousemove?.(payload(e)));
  instance.on('error', (e: any) => onerror?.(e));
  instance.on('styledata', (e: any) => onstyledata?.(e));
  instance.on('sourcedata', (e: any) => onsourcedata?.(e));

  // ─── camera-lifecycle + two-way echo (echo-guarded) ─────────────────────
  instance.on('moveend', (e: any) => {
    onmoveend?.(e);
    if (e.rozieProgrammatic) return;
    const c = instance.getCenter();
    const next = [c.lng, c.lat];
    if (!sameCenter(next, center)) center = next;
    const z = instance.getZoom();
    if (z !== zoom) zoom = z;
  });
  instance.on('zoomend', (e: any) => {
    onzoomend?.(e);
    if (e.rozieProgrammatic) return;
    const z = instance.getZoom();
    if (z !== zoom) zoom = z;
  });
  instance.on('rotateend', (e: any) => {
    onrotateend?.(e);
    if (e.rozieProgrammatic) return;
    const b = instance.getBearing();
    if (b !== bearing) bearing = b;
  });
  instance.on('pitchend', (e: any) => {
    onpitchend?.(e);
    if (e.rozieProgrammatic) return;
    const p = instance.getPitch();
    if (p !== pitch) pitch = p;
  });

  // ─── REACTIVE MULTI-INSTANCE marker portal slot ─────────────────────────
  // One reactive portal handle per markers[] entry, reconciled keep/update/dispose
  // on prop change. Built here so $portals.marker is in the mount scope; bridged
  // to the top-level $watch via reconcileMarkers (CM rebuildGutterExt discipline).
  reconcileMarkers = (list: any) => {
    if (!marker) return;
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
    if (!popup) return;
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
      const enter = (e: any) => onmouseenter?.(payload(e));
      const leave = (e: any) => onmouseleave?.(payload(e));
      instance.on('mouseenter', id, enter);
      instance.on('mouseleave', id, leave);
      featureListeners.set(id, {
        enter,
        leave
      });
    }
  };

  // ─── mount-once custom CONTROL portal slot ──────────────────────────────
  if (control) {
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
  reconcileMarkers(markers);
  reconcilePopups(popups);
  reconcileInteractive(interactiveLayerIds);

  // sources/layers need the style loaded.
  if (instance.isStyleLoaded()) applyLayers();else instance.on('load', applyLayers);
  return () => {
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

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => center)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (!instance || !Array.isArray(v) || v.length !== 2) return;
  const c = instance.getCenter();
  if (v[0] === c.lng && v[1] === c.lat) return;
  instance.easeTo({
    center: v,
    animate: false
  }, PROGRAMMATIC);
})(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { const __watchVal = (() => zoom)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } ((v: any) => {
  if (!instance || typeof v !== 'number' || v === instance.getZoom()) return;
  instance.easeTo({
    zoom: v,
    animate: false
  }, PROGRAMMATIC);
})(__watchVal); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { const __watchVal = (() => bearing)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } ((v: any) => {
  if (!instance || typeof v !== 'number' || v === instance.getBearing()) return;
  instance.easeTo({
    bearing: v,
    animate: false
  }, PROGRAMMATIC);
})(__watchVal); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { const __watchVal = (() => pitch)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } ((v: any) => {
  if (!instance || typeof v !== 'number' || v === instance.getPitch()) return;
  instance.easeTo({
    pitch: v,
    animate: false
  }, PROGRAMMATIC);
})(__watchVal); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { const __watchVal = (() => mapStyle)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } ((v: any) => {
  if (!instance) return;
  // a new style wipes imperatively-added sources/layers — reset the applied
  // tracking and re-apply once the new style loads.
  appliedLayerIds = [];
  appliedSourceIds = [];
  instance.setStyle($state.snapshot(v) ?? DEFAULT_STYLE);
  instance.once('styledata', () => applyLayers());
})(__watchVal); }); });
let __rozieWatchInitial_5 = true;
$effect(() => { const __watchVal = (() => minZoom)(); untrack(() => { if (__rozieWatchInitial_5) { __rozieWatchInitial_5 = false; return; } ((v: any) => {
  if (instance && typeof v === 'number') instance.setMinZoom(v);
})(__watchVal); }); });
let __rozieWatchInitial_6 = true;
$effect(() => { const __watchVal = (() => maxZoom)(); untrack(() => { if (__rozieWatchInitial_6) { __rozieWatchInitial_6 = false; return; } ((v: any) => {
  if (instance && typeof v === 'number') instance.setMaxZoom(v);
})(__watchVal); }); });
let __rozieWatchInitial_7 = true;
$effect(() => { const __watchVal = (() => maxBounds)(); untrack(() => { if (__rozieWatchInitial_7) { __rozieWatchInitial_7 = false; return; } ((v: any) => {
  if (instance) instance.setMaxBounds($state.snapshot(v) || null);
})(__watchVal); }); });
let __rozieWatchInitial_8 = true;
$effect(() => { const __watchVal = (() => markers)(); untrack(() => { if (__rozieWatchInitial_8) { __rozieWatchInitial_8 = false; return; } ((v: any) => {
  if (reconcileMarkers) reconcileMarkers(v);
})(__watchVal); }); });
let __rozieWatchInitial_9 = true;
$effect(() => { const __watchVal = (() => popups)(); untrack(() => { if (__rozieWatchInitial_9) { __rozieWatchInitial_9 = false; return; } ((v: any) => {
  if (reconcilePopups) reconcilePopups(v);
})(__watchVal); }); });
let __rozieWatchInitial_10 = true;
$effect(() => { (() => sources)(); untrack(() => { if (__rozieWatchInitial_10) { __rozieWatchInitial_10 = false; return; } (() => applyLayers())(); }); });
let __rozieWatchInitial_11 = true;
$effect(() => { (() => layers)(); untrack(() => { if (__rozieWatchInitial_11) { __rozieWatchInitial_11 = false; return; } (() => applyLayers())(); }); });
let __rozieWatchInitial_12 = true;
$effect(() => { (() => sourceReg)(); untrack(() => { if (__rozieWatchInitial_12) { __rozieWatchInitial_12 = false; return; } (() => applyLayers())(); }); });
let __rozieWatchInitial_13 = true;
$effect(() => { (() => layerReg)(); untrack(() => { if (__rozieWatchInitial_13) { __rozieWatchInitial_13 = false; return; } (() => applyLayers())(); }); });
let __rozieWatchInitial_14 = true;
$effect(() => { const __watchVal = (() => interactiveLayerIds)(); untrack(() => { if (__rozieWatchInitial_14) { __rozieWatchInitial_14 = false; return; } ((v: any) => {
  if (reconcileInteractive) reconcileInteractive(v);
})(__watchVal); }); });
let __rozieWatchInitial_15 = true;
$effect(() => { (() => controls)(); untrack(() => { if (__rozieWatchInitial_15) { __rozieWatchInitial_15 = false; return; } (() => applyControls())(); }); });
let __rozieWatchInitial_16 = true;
$effect(() => { (() => dragPan)(); untrack(() => { if (__rozieWatchInitial_16) { __rozieWatchInitial_16 = false; return; } (() => applyInteractionToggles())(); }); });
let __rozieWatchInitial_17 = true;
$effect(() => { (() => dragRotate)(); untrack(() => { if (__rozieWatchInitial_17) { __rozieWatchInitial_17 = false; return; } (() => applyInteractionToggles())(); }); });
let __rozieWatchInitial_18 = true;
$effect(() => { (() => scrollZoom)(); untrack(() => { if (__rozieWatchInitial_18) { __rozieWatchInitial_18 = false; return; } (() => applyInteractionToggles())(); }); });
let __rozieWatchInitial_19 = true;
$effect(() => { (() => doubleClickZoom)(); untrack(() => { if (__rozieWatchInitial_19) { __rozieWatchInitial_19 = false; return; } (() => applyInteractionToggles())(); }); });
let __rozieWatchInitial_20 = true;
$effect(() => { (() => boxZoom)(); untrack(() => { if (__rozieWatchInitial_20) { __rozieWatchInitial_20 = false; return; } (() => applyInteractionToggles())(); }); });
let __rozieWatchInitial_21 = true;
$effect(() => { (() => keyboard)(); untrack(() => { if (__rozieWatchInitial_21) { __rozieWatchInitial_21 = false; return; } (() => applyInteractionToggles())(); }); });
let __rozieWatchInitial_22 = true;
$effect(() => { (() => touchZoomRotate)(); untrack(() => { if (__rozieWatchInitial_22) { __rozieWatchInitial_22 = false; return; } (() => applyInteractionToggles())(); }); });
let __rozieWatchInitial_23 = true;
$effect(() => { (() => touchPitch)(); untrack(() => { if (__rozieWatchInitial_23) { __rozieWatchInitial_23 = false; return; } (() => applyInteractionToggles())(); }); });
</script>

<div class="rozie-maplibre" bind:this={containerEl} data-rozie-s-f1ee1082></div>{@render children?.()}

<style>
:global {
  .rozie-maplibre[data-rozie-s-f1ee1082] {
    width: 100%;
    height: 100%;
    min-height: 300px;
    position: relative;
    overflow: hidden;
    border-radius: 6px;
  }
}

:global {
  .rozie-maplibre .rozie-maplibre-marker {
      cursor: pointer;
    }
  .rozie-maplibre .rozie-maplibre-control {
      display: flex;
      flex-direction: column;
    }
}
</style>
