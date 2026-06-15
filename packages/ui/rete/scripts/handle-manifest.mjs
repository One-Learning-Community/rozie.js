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
  undo: 'Undo the most recent graph edit (drag / connect / disconnect / delete) — `undo()` restores the previous snapshot through the two-way `graph` model (echo-guarded). Graph-only (nodes + connections), NOT the viewport. One gesture = one step. No-op when there is nothing to undo. Also bound to Ctrl/Cmd+Z. Opt out with `:history="false"`.',
  redo: 'Redo the edit most recently undone — `redo()` re-applies the snapshot through the `graph` model (echo-guarded). A fresh edit after an undo discards the redo branch. No-op when there is nothing to redo. Also bound to Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y.',
  canUndo: 'Return whether there is an edit to undo — `canUndo()` → boolean.',
  canRedo: 'Return whether there is an edit to redo — `canRedo()` → boolean.',
  autoArrange: 'Relayout the graph into a non-overlapping layered arrangement — `await autoArrange(opts?)` runs the elkjs-backed auto-layout, then reads the arranged node positions back through the two-way `graph` model (echo-guarded, one undoable gesture). Verb-only — never auto-triggered. `opts.options` forwards elk layout options (direction / spacing). No-op before mount.',
  getSelectedNodes: 'Return the currently-selected nodes as `[{ id, label, x, y }]` (the `getNodes()` shape, filtered to the live selection). Empty when nothing is selected. Complements the push-only `selection-change` event with an on-demand read.',
  selectNode: 'Programmatically select a node by id — `selectNode(id, accumulate?)` (accumulate=true adds to the selection; falsy replaces it). Drives selection from a sidebar/search. No-op when selection is disabled (readonly / !selectable). NOT named bare `select` (inherited HTMLElement method → Lit shadow).',
  clearSelection: 'Clear the current node selection (and any selected edge) — `clearSelection()`.',
  selectAll: 'Select every node — `selectAll()` (Ctrl+A is not bound; the marquee only covers a dragged region). No-op when selection is disabled.',
  centerOnNode: 'Pan (and optionally zoom via `opts.zoom`) to center the viewport on a node by id — `await centerOnNode(id, opts?)`. Measures the node to find its center in graph coords. No-op before mount or for an unknown id.',
};

export default handleManifest;
