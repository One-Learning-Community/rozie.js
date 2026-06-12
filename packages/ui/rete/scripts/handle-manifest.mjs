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
  removeNode: 'Imperatively remove a node and its connections by id — `removeNode(id)`. Returns whether it existed. The engine-only escape hatch — NOT written back to the bound `graph` model (use `deleteNode` for the controlled-graph delete).',
  deleteNode: 'Remove a node and its incident connections from the CONTROLLED graph — `deleteNode(id)` writes a fresh `graph` object back through the two-way model (the blessed cascading delete; the `$watch(graph)` reconcile reaps the live engine node/edges). Returns whether a node was removed. Contrast `removeNode`, the engine-only imperative escape hatch.',
  addConnection: 'Imperatively add a connection — `addConnection({ id?, source, sourceOutput?, target, targetInput? })`. Returns the id. NOT reaped by the `connections` prop reconcile.',
  removeConnection: 'Imperatively remove a connection by id — `removeConnection(id)`.',
  clear: 'Remove every node and connection from the graph.',
  zoomToFit: 'Pan and zoom the viewport to fit all nodes (Rete `AreaExtensions.zoomAt`).',
  zoomTo: 'Set the zoom level — `zoomTo(k)`. Echoes the new level back into the two-way `zoom` model.',
  setCenter: 'Center the viewport on graph coordinates — `setCenter(x, y, { zoom? })`. Optionally sets the zoom. Echoes the level into the `zoom` model and fires `translated`. Powers the pannable built-in MiniMap.',
  setViewport: 'Set the raw viewport transform — `setViewport({ x, y, k })` (any field omitted keeps its current value). Echoes `k` into the `zoom` model and fires `translated`.',
  screenToFlowPosition: 'Project a screen/client coordinate to graph coordinates — `screenToFlowPosition(clientX, clientY)` → `{ x, y }` (or null before mount). The palette drag-drop primitive: on a canvas `@drop`, call it with the event client coords and push a fresh node into the bound `graph` at the result. The consumer owns the drag/drop; the canvas owns the projection.',
  getNodes: 'Return a serialized snapshot of all nodes as `[{ id, label, x, y }]` (live positions from the area).',
  getConnections: 'Return a serialized snapshot of all connections as `[{ id, source, sourceOutput, target, targetInput }]`.',
  getTransform: 'Return the current viewport transform `{ x, y, k }` (pan offset + zoom), or null before mount.',
};

export default handleManifest;
