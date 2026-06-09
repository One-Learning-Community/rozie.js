/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/rete.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (the Phase 21 `$expose({ ... })` call in FlowCanvas.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here. KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every
 * exposed method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121/ROZ524/Lit-lifecycle): none of these verbs
 * collides with a declared prop name, an emitted event name, a React
 * model-setter (`setZoom` is the auto-gen'd one for the `zoom` model — hence the
 * verb is `zoomTo`, not `setZoom`), or a Lit reserved lifecycle name
 * (`update`/`render`/`firstUpdated`/`updated`/`willUpdate`/`requestUpdate`).
 */
export const handleManifest = {
  getEditor: 'Return the underlying Rete `NodeEditor` instance for direct graph-model access (the engine escape hatch).',
  getArea: 'Return the underlying Rete `AreaPlugin` instance (viewport transform, node views, pan/zoom).',
  addNode: 'Imperatively add a node — `addNode(spec)` where spec is `{ id, label?, x, y, inputs?, outputs?, data? }`. Returns the id. NOT reaped by the `nodes` prop reconcile.',
  removeNode: 'Imperatively remove a node and its connections by id — `removeNode(id)`. Returns whether it existed.',
  addConnection: 'Imperatively add a connection — `addConnection({ id?, source, sourceOutput?, target, targetInput? })`. Returns the id. NOT reaped by the `connections` prop reconcile.',
  removeConnection: 'Imperatively remove a connection by id — `removeConnection(id)`.',
  clear: 'Remove every node and connection from the graph.',
  zoomToFit: 'Pan and zoom the viewport to fit all nodes (Rete `AreaExtensions.zoomAt`).',
  zoomTo: 'Set the zoom level — `zoomTo(k)`. Echoes the new level back into the two-way `zoom` model.',
  getNodes: 'Return a serialized snapshot of all nodes as `[{ id, label, x, y }]` (live positions from the area).',
  getConnections: 'Return a serialized snapshot of all connections as `[{ id, source, sourceOutput, target, targetInput }]`.',
  getTransform: 'Return the current viewport transform `{ x, y, k }` (pan offset + zoom), or null before mount.',
};

export default handleManifest;
