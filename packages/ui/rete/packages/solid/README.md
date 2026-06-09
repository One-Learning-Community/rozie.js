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
| `nodes` | `Array` | `[]` |  |  |
| `connections` | `Array` | `[]` |  |  |
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

## Events

| Event | Description |
| --- | --- |
| `node-action` | |
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
| `removeNode` | Imperatively remove a node and its connections by id — `removeNode(id)`. Returns whether it existed. |
| `addConnection` | Imperatively add a connection — `addConnection({ id?, source, sourceOutput?, target, targetInput? })`. Returns the id. NOT reaped by the `connections` prop reconcile. |
| `removeConnection` | Imperatively remove a connection by id — `removeConnection(id)`. |
| `clear` | Remove every node and connection from the graph. |
| `zoomToFit` | Pan and zoom the viewport to fit all nodes (Rete `AreaExtensions.zoomAt`). |
| `zoomTo` | Set the zoom level — `zoomTo(k)`. Echoes the new level back into the two-way `zoom` model. |
| `getNodes` | Return a serialized snapshot of all nodes as `[{ id, label, x, y }]` (live positions from the area). |
| `getConnections` | Return a serialized snapshot of all connections as `[{ id, source, sourceOutput, target, targetInput }]`. |
| `getTransform` | Return the current viewport transform `{ x, y, k }` (pan offset + zoom), or null before mount. |

## Slots

| Slot | Params |
| --- | --- |
| node | node, selected, emit |
