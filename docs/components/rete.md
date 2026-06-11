# FlowCanvas — the cross-framework node-flow editor

`FlowCanvas` is Rozie's data-bound port of [Rete.js v2](https://retejs.org/) — the framework-agnostic visual-programming engine whose core owns the graph model and **all** pointer interaction (pan, zoom, node drag, drag-to-connect). One `.rozie` source ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers from a single wrapper.

This fills a **genuine cross-framework gap**. No other node-flow editor ships all six idiomatically:

- [@xyflow/react](https://reactflow.dev/) (React Flow) + [@xyflow/svelte](https://svelteflow.dev/) (Svelte Flow) — React & Svelte only
- [@vue-flow/core](https://vueflow.dev/) — a **separate** Vue reimplementation, not a shared core
- [@foblex/flow](https://flow.foblex.com/) / ngx-graph — Angular only
- Solid has only a single-author experiment; **Lit has nothing**

Rete.js ships render plugins for React/Vue/Angular/Svelte/Lit (five divergent codebases, no Solid). Rozie replaces all of them with **one source and one vanilla render layer** — and Solid (plus a far thinner Lit) gets a category-leading node editor for free.

The full source for `FlowCanvas.rozie` lives in the [`@rozie-ui/rete` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/src/FlowCanvas.rozie).

## The `@rozie-ui/rete` packages

`FlowCanvas` ships as six pre-compiled, per-framework packages generated from a single `FlowCanvas.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/rete-react` | `npm i @rozie-ui/rete-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/packages/react/README.md) |
| `@rozie-ui/rete-vue` | `npm i @rozie-ui/rete-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/packages/vue/README.md) |
| `@rozie-ui/rete-svelte` | `npm i @rozie-ui/rete-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/packages/svelte/README.md) |
| `@rozie-ui/rete-angular` | `npm i @rozie-ui/rete-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/packages/angular/README.md) |
| `@rozie-ui/rete-solid` | `npm i @rozie-ui/rete-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/packages/solid/README.md) |
| `@rozie-ui/rete-lit` | `npm i @rozie-ui/rete-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/packages/lit/README.md) |

Each package carries the **Rete engine peers** — `rete`, `rete-area-plugin`, `rete-connection-plugin`, and `rete-render-utils` (all `^2`) — plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). Install the engine peers alongside the framework package:

```bash
npm i @rozie-ui/rete-react rete rete-area-plugin rete-connection-plugin rete-render-utils
```

Rete ships **no stylesheet** — every node, socket, and connection is styled by the component itself (the scoped `<style>` plus the `:root {}` engine-DOM escape hatch that reaches the engine-created node/connection DOM). There is no engine CSS to import.

## Authoring model

The graph can be authored two ways — via **config-array props** (`nodes` / `connections`) or via **declarative child components** (`<FlowNode>` / `<Handle>` / `<Connection>`). Both are fully supported, and when both are supplied on the same canvas they **union-merge by id (last-writer-wins)** into the same engine registry. The engine still owns the store and reconciles the live graph either way; pick whichever shape suits the consumer.

### Config-array props

- **`nodes`** — `[{ id, label?, x, y, inputs?, outputs?, data? }]`. `inputs`/`outputs` are `[{ key, label?, multiple? }]`; `key` is the socket id used by connections. `data` is an opaque payload handed to the `node` slot scope.
- **`connections`** — `[{ id?, source, sourceOutput?, target, targetInput? }]`. `source`/`target` are node ids; `sourceOutput`/`targetInput` default to `'out'`/`'in'`.

The engine owns pan/zoom/drag/drag-to-connect; changing the arrays reconciles the live graph (add / move / remove) with no remount. User-drawn connections fire `@connection-created`; dragged nodes fire `@node-moved`.

### Declarative children

The declarative shape follows **Rete's own vocabulary**, not React Flow's: `<FlowNode>` is a node, `<Handle>` is a **port / socket** (nested inside its node — *not* an edge), and `<Connection>` is an **edge** (a flat child of the canvas, since an edge spans two nodes and cannot nest inside one):

```html
<FlowCanvas>
  <FlowNode id="a" :x="40" :y="60">
    <template #body><MyCard /></template>
    <Handle side="output" port="out" />
  </FlowNode>
  <FlowNode id="b" :x="320" :y="60">
    <template #body><MyCard /></template>
    <Handle side="input" port="in" />
  </FlowNode>
  <Connection source="a" target="b" sourceOutput="out" targetInput="in" />
</FlowCanvas>
```

- **`<FlowNode>`** — `id` (required) plus `:x` / `:y` (position) and an optional `label`. Its visible body is authored via a **named `#body` slot**, not bare children.
- **`<Handle>`** — `side` (`'input'` | `'output'`) + `port` (the socket key), optional `label` / `multiple`. Nests inside its `<FlowNode>` and auto-binds to that node via injected context (no `nodeId` to wire by hand).
- **`<Connection>`** — `source` / `target` (node ids) + optional `sourceOutput` / `targetInput` (handle keys, default `'out'` / `'in'`). A flat child of `<FlowCanvas>`.

Children feed the **same id-keyed registry** the config arrays do, through the same `addNode` / `addConnection` reconcile — so a config array and declarative children coexist, and on an id collision the declarative child wins (last-writer-wins).

**Why the node body is a named `#body` slot, not bare children.** A FlowNode's visible body has to *teleport* into the node element the Rete engine creates — it does not render in the normal component tree. Rozie mounts it through a portal, which gives it a fresh render-root inside the engine-owned host. A portal render-root has no tree ancestor, so context-consuming children placed inside it would not resolve their `$inject` on five of six targets (context is tree-scoped on React/Vue/Svelte/Solid/Lit). Separating the teleported body (`<template #body>`) from the context-consuming config children (`<Handle>` / `<Connection>`, which stay in the normal child position) is therefore the correct cross-framework shape — so the body must be the `#body` slot, not a bare default-slot child.

The declarative shape **dogfoods Rozie's own cross-component context primitive** (`$provide` / `$inject`): `<FlowCanvas>` provides an id-keyed registry, and each child injects it.

## Quick start

The `zoom` level is two-way bound (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onZoomChange`). Note there is deliberately **no `zoom` event** — a same-named emit would collide with the model on Vue and Angular; the two-way binding carries the value, and `@translated` reports panning.

### React

```tsx
import { useState } from 'react';
import { FlowCanvas } from '@rozie-ui/rete-react';

export function Demo() {
  const [zoom, setZoom] = useState(1);
  const nodes = [
    { id: 'a', label: 'Source', x: 0, y: 0, outputs: [{ key: 'out' }] },
    { id: 'b', label: 'Sink', x: 280, y: 60, inputs: [{ key: 'in' }] },
  ];
  const connections = [{ source: 'a', sourceOutput: 'out', target: 'b', targetInput: 'in' }];
  return (
    <div style={{ height: 400 }}>
      <FlowCanvas
        nodes={nodes}
        connections={connections}
        zoom={zoom}
        onZoomChange={setZoom}
        onConnectionCreated={(c) => console.log('connected', c)}
        onNodeMoved={(e) => console.log('moved', e)}
      />
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import FlowCanvas from '@rozie-ui/rete-vue';

const zoom = ref(1);
const nodes = [
  { id: 'a', label: 'Source', x: 0, y: 0, outputs: [{ key: 'out' }] },
  { id: 'b', label: 'Sink', x: 280, y: 60, inputs: [{ key: 'in' }] },
];
const connections = [{ source: 'a', sourceOutput: 'out', target: 'b', targetInput: 'in' }];
</script>

<template>
  <div style="height: 400px">
    <FlowCanvas :nodes="nodes" :connections="connections" v-model:zoom="zoom" @connection-created="onConnect" />
  </div>
</template>
```

### Custom node bodies — the `node` slot

`node` is a **reactive multi-instance portal slot**: one portal handle mounts per node, re-rendered in place as the node's data or selection changes. The fill receives `{ node, selected, emit }` — `node` is your spec entry (with its `data`), `selected` tracks engine selection, and `emit(name, detail)` raises a `@node-action` carrying the node id (e.g. a delete button inside a node). When the slot is unfilled, each node renders default chrome (a title bar) plus its sockets.

```vue
<FlowCanvas :nodes="nodes" :connections="edges">
  <template #node="{ node, selected }">
    <MyNodeCard :title="node.label" :payload="node.data" :active="selected" />
  </template>
</FlowCanvas>
```

The sockets (connection anchors) are always rendered by the engine layer regardless of the slot — drag from an output socket to an input socket to connect.

### Props

`zoom` is **two-way** (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onZoomChange`). The `nodes` / `connections` arrays reconcile into the live graph on change — no remount.

| Name | Type | Default | Two-way (model) | Description |
| --- | --- | --- | :---: | --- |
| `nodes` | `Array` | `[]` | | The graph nodes — `[{ id, label?, x, y, inputs?, outputs?, data? }]`. `inputs`/`outputs` are `[{ key, label?, multiple? }]`. Reconciled live (add / move / remove) on change; the consumer's `id` is used throughout so positions and connections align with your identifiers. |
| `connections` | `Array` | `[]` | | The graph connections — `[{ id?, source, sourceOutput?, target, targetInput? }]`. `source`/`target` are node ids; `sourceOutput`/`targetInput` default to `'out'`/`'in'`. Reconciled live; a missing `id` is derived from the endpoints. |
| `zoom` | `Number` | `1` | ✓ | The viewport zoom level. Two-way: scroll / pinch writes the new zoom back through the model (echo-guarded against the wrapper's own programmatic zooms); a consumer write zooms the live area. |
| `pannable` | `Boolean` | `true` | | Whether the canvas can be panned (drag the background). Disabling detaches the area's drag handler. |
| `zoomable` | `Boolean` | `true` | | Whether the canvas can be zoomed (scroll / pinch). Disabling detaches the area's zoom handler. |
| `selectable` | `Boolean` | `true` | | Whether nodes can be selected (click; ctrl-click to accumulate). Reflected as the `selected` flag in the `node` slot scope. |
| `readonly` | `Boolean` | `false` | | Read-only viewer mode — no node drag, no connection editing, no selection. |
| `minZoom` | `Number` | `0.1` | | Minimum zoom level (the lower bound of the area's zoom restrictor). `0` disables the bound. |
| `maxZoom` | `Number` | `4` | | Maximum zoom level (the upper bound of the area's zoom restrictor). `0` disables the bound. |
| `snapGrid` | `Number` | `0` | | Snap-to-grid size in pixels for node dragging. `0` turns snapping off. |
| `accumulateOnCtrl` | `Boolean` | `true` | | When selectable, hold Ctrl to add to the current selection instead of replacing it. |
| `curvature` | `Number` | `0.3` | | The bezier curvature of connection paths (`classicConnectionPath`). |
| `fitOnMount` | `Boolean` | `true` | | After the initial graph mounts, pan/zoom the viewport to fit all nodes (`AreaExtensions.zoomAt`). |
| `canConnect` | `Function` | `null` | | Connection-validation predicate `(conn: { source, sourceOutput, target, targetInput }) => boolean`. Return `false` to REJECT a connection — no edge is committed, no ghost path is drawn, and `connection-rejected` fires. Gates ALL connection paths uniformly (drag-to-connect, imperative `addConnection`, config-array `connections` reconcile). Absent / `null` allows every connection (back-compat — zero behavioral change for existing demos). |

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `node-moved` | `{ id, x, y }` | A node finished a user drag to a new position. |
| `node-picked` | `{ id }` | A node was picked (pointer-down). |
| `node-action` | `{ id, name, detail }` | A `node` slot fill called its `emit(name, detail)` helper (e.g. an in-node button). |
| `connection-created` | `{ id, source, sourceOutput, target, targetInput }` | A user drew a new connection (not fired for programmatic / props-driven adds). |
| `connection-removed` | `{ id }` | A connection was removed (not fired for programmatic / props-driven removes). |
| `connection-rejected` | `{ source, sourceOutput, target, targetInput }` | A connection was rejected by `canConnect` (no edge committed). Not fired for programmatic / props-driven adds. |
| `translated` | `{ x, y }` | The viewport was panned. |
| `context-menu` | `{ id }` | Right-click on the canvas (`id` is the node id, or `null` for the background). The native browser menu is suppressed. |

### Imperative handle

Beyond props, `FlowCanvas` exposes imperative methods via `$expose`. Grab a handle with your framework's native ref mechanism (`useRef` / template ref / `bind:this` / `@ViewChild` / Solid `ref` callback / the Lit element itself):

| Method | Description |
| --- | --- |
| `getEditor()` | The underlying Rete `NodeEditor` (the graph-model escape hatch). |
| `getArea()` | The underlying Rete `AreaPlugin` (viewport transform, node views). |
| `addNode(spec)` | Imperatively add a node. NOT reaped by the `nodes` prop reconcile. |
| `removeNode(id)` | Remove a node and its connections. |
| `addConnection(spec)` | Imperatively add a connection. NOT reaped by the `connections` prop reconcile. |
| `removeConnection(id)` | Remove a connection by id. |
| `clear()` | Remove every node and connection. |
| `zoomToFit()` | Pan/zoom to fit all nodes. |
| `zoomTo(k)` | Set the zoom level (echoes into the `zoom` model). |
| `getNodes()` | Serialized snapshot `[{ id, label, x, y }]` with live positions. |
| `getConnections()` | Serialized snapshot `[{ id, source, sourceOutput, target, targetInput }]`. |
| `getTransform()` | The viewport transform `{ x, y, k }`. |

> The method is `zoomTo`, not `setZoom` — `zoom` is a model prop, so React auto-generates a `setZoom` state setter that a `setZoom` verb would collide with (the same collision discipline as the rest of `@rozie-ui`).
