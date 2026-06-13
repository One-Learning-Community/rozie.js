# @rozie-ui/rete-angular

Idiomatic **angular** `FlowCanvas` — a cross-framework node-based flow / graph editor compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [Rete.js v2](https://retejs.org/). The graph is driven by the `nodes` / `connections` config-array props; the engine owns pan / zoom / drag / drag-to-connect. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/rete-angular
```

Peer dependencies: the Rete engine (`rete` + `rete-area-plugin` + `rete-connection-plugin` + `rete-render-utils`, all `^2`) + `@angular/core + @angular/common`. Install them alongside this package.

Rete ships no stylesheet — all node / socket / connection chrome is styled by this component, so there is no engine CSS to import.

## Usage

```ts
import { Component } from '@angular/core';
import { FlowCanvas } from '@rozie-ui/rete-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [FlowCanvas],
  template: `
    <div style="height: 400px">
      <FlowCanvas
        [nodes]="nodes"
        [connections]="connections"
        [(zoom)]="zoom"
        (connection-created)="onConnect($event)"
        (node-moved)="onMoved($event)"
      />
    </div>
  `,
})
export class DemoComponent {
  zoom = 1;
  nodes = [
    { id: 'a', label: 'Source', x: 0,   y: 0,   outputs: [{ key: 'out' }] },
    { id: 'b', label: 'Sink',   x: 280, y: 60,  inputs:  [{ key: 'in' }] },
  ];
  connections = [{ source: 'a', sourceOutput: 'out', target: 'b', targetInput: 'in' }];
  onConnect(c: any) { console.log('connected', c); }
  onMoved(e: any) { console.log('moved', e); }
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

## Events

| Event | Description |
| --- | --- |
| `edge-click` | |
| `edge-selected` | |
| `selection-change` | |
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

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(FlowCanvas) flow!: FlowCanvas;  // or the viewChild() signal
  fit() { this.flow.zoomToFit(); }
  editor() { return this.flow.getEditor(); }
}
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
| `undo` | Undo the most recent graph edit (drag / connect / disconnect / delete) — `undo()` restores the previous snapshot through the two-way `graph` model (echo-guarded). Graph-only (nodes + connections), NOT the viewport. One gesture = one step. No-op when there is nothing to undo. Also bound to Ctrl/Cmd+Z. Opt out with `:history="false"`. |
| `redo` | Redo the edit most recently undone — `redo()` re-applies the snapshot through the `graph` model (echo-guarded). A fresh edit after an undo discards the redo branch. No-op when there is nothing to redo. Also bound to Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y. |
| `canUndo` | Return whether there is an edit to undo — `canUndo()` → boolean. |
| `canRedo` | Return whether there is an edit to redo — `canRedo()` → boolean. |

## Slots

| Slot | Params |
| --- | --- |
| node | node, selected, emit |
| (default) |  |
