/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/maplibre.
 *
 * The exposed methods are derived structurally from the source via
 * `ir.expose` (`getMap`, `flyTo`, `easeTo`, `jumpTo`, `fitBounds`, `getCenter`,
 * `getZoom`, `resize` — the Phase 21 `$expose({ ... })` call in MapLibre.rozie),
 * but their human-readable descriptions have no first-class IR source — so the
 * prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every
 * exposed method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121/ROZ524/Lit-lifecycle): none of these 15 verbs
 * collides with a declared prop name, an emitted event name (zoomIn/zoomOut
 * differ from the `zoomend` emit), a React
 * model-setter (`setCenter`/`setZoom`/`setBearing`/`setPitch` are the auto-gen'd
 * ones — none here), or a Lit reserved lifecycle name (`update`/`render`/
 * `firstUpdated`/`updated`/`willUpdate`/`requestUpdate`). The camera verbs
 * deliberately omit the PROGRAMMATIC echo-guard eventData so an imperative move
 * echoes back into `$model` (the prop `$watch` then no-ops because `getCenter`
 * already matches).
 */
export const handleManifest = {
  getMap: 'Return the underlying MapLibre GL `Map` instance for direct API access (the engine escape hatch).',
  flyTo: 'Animate the camera along a curved flight path — `flyTo(opts)` (MapLibre `FlyToOptions`).',
  easeTo: 'Animate the camera with an eased transition — `easeTo(opts)` (MapLibre `EaseToOptions`).',
  jumpTo: 'Move the camera instantly with no animation — `jumpTo(opts)` (MapLibre `JumpToOptions`).',
  fitBounds: 'Pan and zoom to contain the given bounds — `fitBounds(bounds, opts)`.',
  getCenter: 'Return the current map center as `[lng, lat]` (lng FIRST), or null before mount.',
  getZoom: 'Return the current zoom level as a number, or null before mount.',
  resize: 'Re-read the container size and resize the map — call after a layout change reveals the container.',
  queryRenderedFeatures:
    'Hit-test rendered features at a point/box (or the whole viewport) — `queryRenderedFeatures(geometry?, options?)`. Click-to-inspect, selection, custom tooltips. `[]` before mount.',
  project:
    'Project a geographic `[lng, lat]` / `LngLat` to pixel `{ x, y }` container coordinates — for positioning framework DOM overlays. null before mount.',
  unproject:
    'Unproject pixel `[x, y]` / `Point` container coordinates back to a geographic `LngLat`. null before mount.',
  getBounds:
    'Return the current visible viewport as a `LngLatBounds` (lazy-fetch data for the live view) — distinct from the construction-only `bounds` prop. null before mount.',
  zoomIn: 'Increase the zoom by one level with animation — `zoomIn(opts?)` (for a consumer’s own zoom control).',
  zoomOut: 'Decrease the zoom by one level with animation — `zoomOut(opts?)`.',
  panBy: 'Pan the map by a pixel offset — `panBy([x, y], opts?)` — not expressible through the absolute-center model.',
};

export default handleManifest;
