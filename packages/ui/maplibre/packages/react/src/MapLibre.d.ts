import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface MapLibreProps {
  /**
   * The map center as `[lng, lat]` — **longitude first** (MapLibre's convention, not Leaflet's `[lat, lng]`). Two-way: panning the map writes the new center back through the model path (echo-guarded), and a consumer write `easeTo`s the live map. The `moveend` echo reads `getCenter()` as `[lng, lat]`.
   * @example
   * <MapLibre r-model:center="center" r-model:zoom="zoom" />
   */
  center?: unknown[];
  defaultCenter?: unknown[];
  onCenterChange?: (next: unknown[]) => void;
  /**
   * The zoom level. Two-way: scroll / pinch writes the new zoom back, and a consumer write `easeTo`s the camera. Echo-guarded against the wrapper's own programmatic moves.
   */
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (next: number) => void;
  /**
   * The map rotation (bearing) in degrees. Two-way via the `rotateend` echo and the `easeTo` reconcile.
   */
  bearing?: number;
  defaultBearing?: number;
  onBearingChange?: (next: number) => void;
  /**
   * The map tilt (pitch) in degrees. Two-way via the `pitchend` echo and the `easeTo` reconcile.
   */
  pitch?: number;
  defaultPitch?: number;
  onPitchChange?: (next: number) => void;
  /**
   * The map style — a `StyleSpecification` object **or** a style-URL string. Named `mapStyle` (not `style`) because `style` is a reserved attribute across the targets — `react-map-gl` and `vue-maplibre-gl` use the same name for the same reason. Defaults to MapLibre's official no-token demo tiles, so the component "just works" with zero config. Changing it calls `setStyle` and re-applies your `sources` / `layers` once the new style loads.
   */
  mapStyle?: unknown;
  /**
   * Minimum zoom level. Applied at construction and via `setMinZoom` on change.
   */
  minZoom?: number;
  /**
   * Maximum zoom level. Applied at construction and via `setMaxZoom` on change.
   */
  maxZoom?: number;
  /**
   * A `LngLatBoundsLike` the camera is constrained to. Applied via `setMaxBounds` on change (pass `undefined` to clear).
   */
  maxBounds?: unknown;
  /**
   * **Construction-only** initial fit — a `LngLatBoundsLike` the map fits to on mount (overrides `center` / `zoom` when set). Pair with `fitBoundsOptions`.
   */
  bounds?: unknown;
  /**
   * **Construction-only** options for the initial `bounds` fit (padding, max-zoom, etc.).
   */
  fitBoundsOptions?: Record<string, unknown>;
  /**
   * Toggle drag-to-pan. Applied at construction and reconciled live via the handler's `enable()` / `disable()`.
   */
  dragPan?: boolean;
  /**
   * Toggle right-drag / ctrl-drag rotation. Applied at construction and reconciled live.
   */
  dragRotate?: boolean;
  /**
   * Toggle scroll-wheel zoom. Applied at construction and reconciled live.
   */
  scrollZoom?: boolean;
  /**
   * Toggle double-click zoom. Applied at construction and reconciled live.
   */
  doubleClickZoom?: boolean;
  /**
   * Toggle shift-drag box zoom. Applied at construction and reconciled live.
   */
  boxZoom?: boolean;
  /**
   * Toggle keyboard navigation. Applied at construction and reconciled live.
   */
  keyboard?: boolean;
  /**
   * Toggle touch pinch-zoom + rotate. Applied at construction and reconciled live.
   */
  touchZoomRotate?: boolean;
  /**
   * Toggle two-finger touch pitch. Applied at construction and reconciled live.
   */
  touchPitch?: boolean;
  /**
   * The marker data that drives the reactive multi-instance `marker` slot — one entry per marker (`{ lng, lat, id?, anchor?, offset?, draggable?, ... }`). One portal handle mounts per entry; changing the array reconciles markers keep / update / dispose with no remount. Only meaningful when the `marker` slot is filled.
   */
  markers?: unknown[];
  /**
   * The popup data that drives the reactive multi-instance `popup` slot — one entry per popup (`{ lng, lat, id?, anchor?, offset?, closeButton?, closeOnClick?, ... }`). One portal handle mounts per entry. Only meaningful when the `popup` slot is filled.
   */
  popups?: unknown[];
  /**
   * Declarative GeoJSON / vector / raster sources — `[{ id, spec }]` (or a bare `SourceSpecification` carrying an `id`). Reconciled into the live style (add / `setData` / remove) once the style has loaded. The config-array authoring shape for sources; declarative `<Source>` / `<Layer>` children are the alternative shape (both feed the same registry).
   */
  sources?: unknown[];
  /**
   * Declarative layers — `LayerSpecification[]` (each with an `id`). Reconciled into the live style (add / `setPaintProperty` / `setLayoutProperty` / remove) once the style has loaded; `beforeId` controls draw order.
   */
  layers?: unknown[];
  /**
   * Layer ids whose feature `mouseenter` / `mouseleave` fire the `@mouseenter` / `@mouseleave` events (populating `e.features`). Registered / unregistered per id on change.
   */
  interactiveLayerIds?: unknown[];
  /**
   * Standard map controls — strings (`'navigation'` / `'geolocate'` / `'scale'` / `'fullscreen'` / `'attribution'`) or `{ type, position?, options? }` objects. Reconciled (remove-all + re-add) on change.
   */
  controls?: unknown[];
  /**
   * The raw `MapOptions` passthrough — spread into the `Map` constructor **before** the curated keys, so explicit props win. The MapLibre analog of an options bag for anything the curated surface doesn't special-case.
   */
  options?: Record<string, unknown>;
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
  children?: ReactNode;
  renderMarker?: (params: { marker: () => void; index: () => void }) => ReactNode;
  renderPopup?: (params: { popup: () => void; index: () => void }) => ReactNode;
  renderControl?: (params: { map: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
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
  queryRenderedFeatures: (...args: any[]) => any;
  project: (...args: any[]) => any;
  unproject: (...args: any[]) => any;
  getBounds: (...args: any[]) => any;
  zoomIn: (...args: any[]) => any;
  zoomOut: (...args: any[]) => any;
  panBy: (...args: any[]) => any;
}

declare const MapLibre: React.ForwardRefExoticComponent<MapLibreProps & React.RefAttributes<MapLibreHandle>>;
export default MapLibre;
