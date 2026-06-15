# @rozie-ui/rete-solid

Idiomatic **solid** `FlowCanvas` — a cross-framework node-based flow / graph editor compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [Rete.js v2](https://retejs.org/). The graph is driven by the `nodes` / `connections` config-array props; the engine owns pan / zoom / drag / drag-to-connect. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/rete-solid
```

Peer dependencies: the Rete engine (`rete` + `rete-area-plugin` + `rete-connection-plugin` + `rete-render-utils`, all `^2`) + `solid-js`. Install them alongside this package.

Rete ships no stylesheet — all node / socket / connection chrome is styled by this component, so there is no engine CSS to import.

## Usage

```tsx
import { createSignal } from 'solid-js';
import { FlowCanvas } from '@rozie-ui/rete-solid';

export function Demo() {
  const [zoom, setZoom] = createSignal(1);
  const nodes = [
    { id: 'a', label: 'Source', x: 0,   y: 0,   outputs: [{ key: 'out' }] },
    { id: 'b', label: 'Sink',   x: 280, y: 60,  inputs:  [{ key: 'in' }] },
  ];
  const connections = [{ source: 'a', sourceOutput: 'out', target: 'b', targetInput: 'in' }];
  return (
    <div style={{ height: '400px' }}>
      <FlowCanvas
        nodes={nodes}
        connections={connections}
        zoom={zoom()}
        onZoomChange={setZoom}
        onConnectionCreated={(c) => console.log('connected', c)}
        onNodeMoved={(e) => console.log('moved', e)}
      />
    </div>
  );
}
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `graph` | `Object` | `{…}` | ✓ |  |
| `validateTypes` | `Boolean` | `true` |  |  |
| `zoom` | `Number` | `1` | ✓ |  |
| `pannable` | `Boolean` | `true` |  |  |
| `zoomable` | `Boolean` | `true` |  |  |
| `selectable` | `Boolean` | `true` |  |  |
| `readonly` | `Boolean` | `false` |  |  |
| `minZoom` | `Number` | `0.1` |  |  |
| `maxZoom` | `Number` | `4` |  |  |
| `snapGrid` | `Number` | `0` |  |  |
| `accumulateOnCtrl` | `Boolean` | `true` |  |  |
| `curvature` | `Number` | `0.3` |  |  |
| `fitOnMount` | `Boolean` | `true` |  |  |
| `controls` | `Boolean` | `true` |  |  |
| `minimap` | `Boolean` | `false` |  |  |
| `canConnect` | `Function` | `null` |  |  |
| `history` | `Boolean` | `true` |  |  |
| `mode` | `String` | `"pan"` | ✓ |  |
| `marquee` | `Boolean` | `false` |  |  |
| `nodeToolbar` | `Boolean` | `false` |  |  |

## Events

| Event | Description |
| --- | --- |
| `edge-click` | |
| `edge-selected` | |
| `selection-change` | |
| `connect-end` | |
| `node-action` | |
| `connection-rejected` | |
| `connection-created` | |
| `connection-removed` | |
| `node-picked` | |
| `node-moved` | |
| `translated` | |
| `context-menu` | |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```tsx
import { FlowCanvas, type FlowCanvasHandle } from '@rozie-ui/rete-solid';

let handle: FlowCanvasHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<FlowCanvas ref={(h) => (handle = h)} />;
handle?.zoomToFit();
const editor = handle?.getEditor();
```

| Method | Description |
| --- | --- |
| `getEditor` | Return the underlying Rete `NodeEditor` instance for direct graph-model access (the engine escape hatch). |
| `getArea` | Return the underlying Rete `AreaPlugin` instance (viewport transform, node views, pan/zoom). |
| `addNode` | Imperatively add a node — `addNode(spec)` where spec is `{ id, label?, x, y, inputs?, outputs?, data? }`. Returns the id. NOT reaped by the `nodes` prop reconcile. |
| `removeNode` | Imperatively remove a node and its connections by id — `removeNode(id)`. Returns whether it existed. The engine-only escape hatch — NOT written back to the bound `graph` model (use `deleteNode` for the controlled-graph delete). |
| `deleteNode` | Remove a node and its incident connections from the CONTROLLED graph — `deleteNode(id)` writes a fresh `graph` object back through the two-way model (the blessed cascading delete; the `$watch(graph)` reconcile reaps the live engine node/edges). Returns whether a node was removed. Contrast `removeNode`, the engine-only imperative escape hatch. |
| `addConnection` | Imperatively add a connection — `addConnection({ id?, source, sourceOutput?, target, targetInput? })`. Returns the id. NOT reaped by the `connections` prop reconcile. |
| `removeConnection` | Imperatively remove a connection by id — `removeConnection(id)`. |
| `clear` | Remove every node and connection from the graph. |
| `zoomToFit` | Pan and zoom the viewport to fit all nodes (Rete `AreaExtensions.zoomAt`). |
| `zoomTo` | Set the zoom level — `zoomTo(k)`. Echoes the new level back into the two-way `zoom` model. |
| `setCenter` | Center the viewport on graph coordinates — `setCenter(x, y, { zoom? })`. Optionally sets the zoom. Echoes the level into the `zoom` model and fires `translated`. Powers the pannable built-in MiniMap. |
| `setViewport` | Set the raw viewport transform — `setViewport({ x, y, k })` (any field omitted keeps its current value). Echoes `k` into the `zoom` model and fires `translated`. |
| `screenToFlowPosition` | Project a screen/client coordinate to graph coordinates — `screenToFlowPosition(clientX, clientY)` → `{ x, y }` (or null before mount). The palette drag-drop primitive: on a canvas `@drop`, call it with the event client coords and push a fresh node into the bound `graph` at the result. The consumer owns the drag/drop; the canvas owns the projection. |
| `getNodes` | Return a serialized snapshot of all nodes as `[{ id, label, x, y }]` (live positions from the area). |
| `getConnections` | Return a serialized snapshot of all connections as `[{ id, source, sourceOutput, target, targetInput }]`. |
| `getTransform` | Return the current viewport transform `{ x, y, k }` (pan offset + zoom), or null before mount. |
| `autoArrange` | Relayout the graph into a non-overlapping layered arrangement — `await autoArrange(opts?)` runs the elkjs-backed auto-layout, then reads the arranged node positions back through the two-way `graph` model (echo-guarded, one undoable gesture). Verb-only — never auto-triggered. `opts.options` forwards elk layout options (direction / spacing). No-op before mount. |
| `undo` | Undo the most recent graph edit (drag / connect / disconnect / delete) — `undo()` restores the previous snapshot through the two-way `graph` model (echo-guarded). Graph-only (nodes + connections), NOT the viewport. One gesture = one step. No-op when there is nothing to undo. Also bound to Ctrl/Cmd+Z. Opt out with `:history="false"`. |
| `redo` | Redo the edit most recently undone — `redo()` re-applies the snapshot through the `graph` model (echo-guarded). A fresh edit after an undo discards the redo branch. No-op when there is nothing to redo. Also bound to Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y. |
| `canUndo` | Return whether there is an edit to undo — `canUndo()` → boolean. |
| `canRedo` | Return whether there is an edit to redo — `canRedo()` → boolean. |
| `getSelectedNodes` | Return the currently-selected nodes as `[{ id, label, x, y }]` (the `getNodes()` shape, filtered to the live selection). Empty when nothing is selected. Complements the push-only `selection-change` event with an on-demand read. |
| `selectNode` | Programmatically select a node by id — `selectNode(id, accumulate?)` (accumulate=true adds to the selection; falsy replaces it). Drives selection from a sidebar/search. No-op when selection is disabled (readonly / !selectable). NOT named bare `select` (inherited HTMLElement method → Lit shadow). |
| `clearSelection` | Clear the current node selection (and any selected edge) — `clearSelection()`. |
| `selectAll` | Select every node — `selectAll()` (Ctrl+A is not bound; the marquee only covers a dragged region). No-op when selection is disabled. |
| `centerOnNode` | Pan (and optionally zoom via `opts.zoom`) to center the viewport on a node by id — `await centerOnNode(id, opts?)`. Measures the node to find its center in graph coords. No-op before mount or for an unknown id. |

## Slots

| Slot | Params |
| --- | --- |
| node | node, selected, emit |
| toolbar | node, emit |
| (default) |  |
