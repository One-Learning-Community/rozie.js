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

`FlowCanvas` follows the **controlled-graph** mental model (the xyflow `nodeTypes` + controlled-state shape, Vue-natural): the consumer binds **one `graph` object** and declares node **TYPE templates**. The canvas is the middleware — it renders each node by its `type`, owns drag / zoom / connect / validation, and **writes back** layout (`x`/`y` on drag) and connections (on connect / disconnect) into the bound `r-model` object so the developer never hand-reconciles.

```html
<FlowCanvas r-model:graph="$data.graph" :validate-types="true" @connection-rejected="onReject">
  <NodeType type="source">
    <template #body="{ node }">{{ node.data.label }}</template>
    <Port output="num" type="number" />
    <Port output="str" type="string" />
  </NodeType>
  <NodeType type="merge">
    <template #body="{ node }">Merge</template>
    <Port input="num" type="number" multiple />
    <Port input="str" type="string" multiple />
  </NodeType>
</FlowCanvas>
```

with `$data.graph = { nodes: [{ id, type, x, y, data }], connections: [{ id?, source, sourceOutput, target, targetInput }] }` — the **single source of truth**. Dragging a node writes a fresh `graph` object (x/y); drawing / removing an edge writes a fresh `graph` object (connections). A type-mismatched connection is auto-rejected (`:validate-types`) and surfaces `@connection-rejected`.

### Node TYPE templates

- **`<NodeType type="…">`** — declares a node TYPE **once**: its visible body (a named `#body` slot, scoped `{ node, selected, emit }`) plus its port schema (nested `<Port>` children). **Every** graph node whose `type` matches renders this template (render-by-type) and uses its ports. A `<NodeType>` carries **no** `id`/`x`/`y` — instance identity and position live in the bound `graph`, not on the tag.
- **`<Port output="KEY" type="T" [multiple] [position]>` / `<Port input="KEY" type="T" [multiple] [position]>`** — declares one typed directional port on its enclosing `<NodeType>`. The **direction is derived from which attribute is set** (`output` ⇒ output port, `input` ⇒ input port), the key is its value, and `type` drives `:validate-types` (a type-mismatched connection is auto-rejected). Optional `label` / `multiple`. **`position="left|right|top|bottom"`** places the socket on that edge (default `input` → left, `output` → right); **`top`/`bottom` enable vertical flows** (decision trees, top-down pipelines) — the connection anchor tracks the chosen edge. Nests inside its `<NodeType>` and auto-binds via injected context (no type to wire by hand). _(The attrs are `input`/`output`, not `in`/`out` — `in` is a JS reserved word that Svelte's `$props()` destructure rejects.)_

**Why the node body is a named `#body` slot, not bare children.** A node body has to *teleport* into the node element the Rete engine creates — it does not render in the normal component tree. Rozie mounts it through a portal, which gives it a fresh render-root inside the engine-owned host. A portal render-root has no tree ancestor, so context-consuming children placed inside it would not resolve their `$inject` on five of six targets (context is tree-scoped on React/Vue/Svelte/Solid/Lit). Separating the teleported body (`<template #body>`) from the context-consuming `<Port>` children (which stay in the normal child position) is therefore the correct cross-framework shape — so the body must be the `#body` slot, not a bare default-slot child.

The authoring shape **dogfoods Rozie's own cross-component context primitive** (`$provide` / `$inject`): `<FlowCanvas>` provides a per-TYPE registry, `<NodeType>` provides a nested per-type sub-context, and `<Port>` injects it.

## Quick start

The `zoom` level is two-way bound (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onZoomChange`). Note there is deliberately **no `zoom` event** — a same-named emit would collide with the model on Vue and Angular; the two-way binding carries the value, and `@translated` reports panning.

### React

```tsx
import { useState } from 'react';
import { FlowCanvas, NodeType, Port } from '@rozie-ui/rete-react';

export function Demo() {
  const [graph, setGraph] = useState({
    nodes: [
      { id: 'a', type: 'source', x: 0, y: 0, data: { label: 'Source' } },
      { id: 'b', type: 'merge', x: 280, y: 60, data: { label: 'Merge' } },
    ],
    connections: [{ source: 'a', sourceOutput: 'num', target: 'b', targetInput: 'num' }],
  });
  return (
    <div style={{ height: 400 }}>
      <FlowCanvas graph={graph} onGraphChange={setGraph} validateTypes>
        <NodeType type="source">
          {({ node }) => <div>{node.data.label}</div>}
          <Port output="num" type="number" />
        </NodeType>
        <NodeType type="merge">
          {({ node }) => <div>{node.data.label}</div>}
          <Port input="num" type="number" multiple />
        </NodeType>
      </FlowCanvas>
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import FlowCanvas, { NodeType, Port } from '@rozie-ui/rete-vue';

const graph = ref({
  nodes: [
    { id: 'a', type: 'source', x: 0, y: 0, data: { label: 'Source' } },
    { id: 'b', type: 'merge', x: 280, y: 60, data: { label: 'Merge' } },
  ],
  connections: [{ source: 'a', sourceOutput: 'num', target: 'b', targetInput: 'num' }],
});
</script>

<template>
  <div style="height: 400px">
    <FlowCanvas v-model:graph="graph" :validate-types="true" @connection-rejected="onReject">
      <NodeType type="source">
        <template #body="{ node }">{{ node.data.label }}</template>
        <Port output="num" type="number" />
      </NodeType>
      <NodeType type="merge">
        <template #body="{ node }">{{ node.data.label }}</template>
        <Port input="num" type="number" multiple />
      </NodeType>
    </FlowCanvas>
  </div>
</template>
```

### Custom node bodies — the `#body` template

Each `<NodeType>`'s `#body` is a **reactive portal template**: one portal handle mounts per graph node of that type, re-rendered in place as the node's data or selection changes. The scope receives `{ node, selected, emit }` — `node` is the graph node (with its `data`), `selected` tracks engine selection, and `emit(name, detail)` raises a `@node-action` carrying the node id (e.g. a delete button inside a node). When a node's type has no template, it renders default chrome (a title bar) plus its sockets.

```vue
<FlowCanvas v-model:graph="graph">
  <NodeType type="card">
    <template #body="{ node, selected }">
      <MyNodeCard :title="node.data.label" :payload="node.data" :active="selected" />
    </template>
    <Port output="out" type="any" />
  </NodeType>
</FlowCanvas>
```

The sockets (connection anchors) come from each type's `<Port>` schema and are rendered by the engine layer — drag from an output socket to an input socket to connect.

### Props

`graph` and `zoom` are **two-way** (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onGraphChange` / `onZoomChange`). The single bound `graph` object is the source of truth; dragging a node writes its new `x`/`y` back into a fresh `graph`, and drawing / removing a connection writes a fresh `connections` array — reconciled into the live engine on change, no remount.

| Name | Type | Default | Two-way (model) | Description |
| --- | --- | --- | :---: | --- |
| `graph` | `Object` | `{…}` | ✓ | The single source of truth — `{ nodes: [{ id, type, x, y, data? }], connections: [{ id?, source, sourceOutput?, target, targetInput? }] }`. `type` selects the node's `<NodeType>` template (render-by-type + its `<Port>` schema); `data` is the opaque payload handed to the type's `#body` scope. **Two-way**: the canvas writes back a fresh top-level object on every drag (x/y) and connect / disconnect (connections) — immutable applyNodeChanges style. `sourceOutput`/`targetInput` default to `'out'`/`'in'`; a missing connection `id` is derived from the endpoints. |
| `validateTypes` | `Boolean` | `true` | | Automatic typed-socket validation (default ON). When `true`, the canvas resolves each endpoint's port TYPE from the per-`<NodeType>` `<Port type>` schema and auto-rejects a type-mismatched connection (firing `connection-rejected`). `canConnect` survives as the optional custom-rule override (runs in addition). Set `false` for pure-`canConnect` (type as metadata only). |
| `zoom` | `Number` | `1` | ✓ | The viewport zoom level. Two-way: scroll / pinch writes the new zoom back through the model (echo-guarded against the wrapper's own programmatic zooms); a consumer write zooms the live area. |
| `pannable` | `Boolean` | `true` | | Whether the canvas can be panned (drag the background). Disabling detaches the area's drag handler. |
| `zoomable` | `Boolean` | `true` | | Whether the canvas can be zoomed (scroll / pinch). Disabling detaches the area's zoom handler. |
| `selectable` | `Boolean` | `true` | | Whether nodes can be selected (click; ctrl-click to accumulate). Reflected as the `selected` flag in the `<NodeType>` `#body` scope, and surfaced to the consumer via the `@selection-change` event. |
| `readonly` | `Boolean` | `false` | | Read-only viewer mode — no node drag, no connection editing, no selection. |
| `minZoom` | `Number` | `0.1` | | Minimum zoom level (the lower bound of the area's zoom restrictor). `0` disables the bound. |
| `maxZoom` | `Number` | `4` | | Maximum zoom level (the upper bound of the area's zoom restrictor). `0` disables the bound. |
| `snapGrid` | `Number` | `0` | | Snap-to-grid size in pixels for node dragging. `0` turns snapping off. |
| `accumulateOnCtrl` | `Boolean` | `true` | | When selectable, hold Ctrl to add to the current selection instead of replacing it. |
| `curvature` | `Number` | `0.3` | | The bezier curvature of connection paths (`classicConnectionPath`). |
| `fitOnMount` | `Boolean` | `true` | | After the initial graph mounts, pan/zoom the viewport to fit all nodes (`AreaExtensions.zoomAt`). |
| `controls` | `Boolean` | `true` | | Render the built-in **Controls overlay** — a zoom in / zoom out / fit-view button cluster over the canvas (the React Flow `<Controls/>` parity). The buttons drive the same zoom/fit path as the `zoomTo` / `zoomToFit` handle verbs (clamped to `minZoom`/`maxZoom`) and stay enabled in `readonly` (zoom/fit are view-only). Opt out with `:controls="false"`. |
| `minimap` | `Boolean` | `false` | | Render the built-in **MiniMap overlay** — an absolute SVG panel (bottom-right) showing a scaled map of every node (sized from the **measured** engine node-view dims) plus the current viewport window (the area outside dimmed). **Pannable**: drag the minimap to recenter the main viewport (via `setCenter`). Opt-in (default OFF) — the React Flow `<MiniMap/>` parity. Evaluated at construction (like `pannable` / `zoomable` / `controls`); set it at mount time. |
| `canConnect` | `Function` | `null` | | Connection-validation predicate `(conn: { source, sourceOutput, target, targetInput }) => boolean`. Return `false` to REJECT a connection — no edge is committed, no ghost path is drawn, and `connection-rejected` fires. Runs in **addition** to the automatic `:validate-types` check (the custom-rule override). Gates ALL connection paths uniformly (drag-to-connect, imperative `addConnection`, graph reconcile). Absent / `null` imposes no custom rule. |

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `node-moved` | `{ id, x, y }` | A node finished a user drag to a new position. |
| `node-picked` | `{ id }` | A node was picked (pointer-down). |
| `selection-change` | `{ ids }` | The set of selected node ids changed — fired on pick / re-pick / deselect (background click clears it). Deduped (only on an actual change) and echo-guarded against the wrapper's own programmatic unselects. The #1 hook for an inspector panel. Selection is surfaced purely via this event — it is **not** written into the bound `graph`. |
| `node-action` | `{ id, name, detail }` | A `<NodeType>` `#body` fill called its `emit(name, detail)` helper (e.g. an in-node button). |
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
| `addNode(spec)` | Imperatively add a node. NOT reaped by the `graph` reconcile. |
| `removeNode(id)` | Remove a node and its connections directly on the engine — the imperative **escape hatch**, NOT written back to the bound `graph`. (Use `deleteNode` for the controlled-graph delete.) |
| `deleteNode(id)` | Cascading controlled-graph delete: removes the node **and its incident connections**, writing a fresh `graph` object back through the two-way model (the `$watch(graph)` reconcile reaps the live engine node/edges). The blessed delete — matches the Delete / Backspace key. Returns whether a node was removed. |
| `addConnection(spec)` | Imperatively add a connection. NOT reaped by the `graph` reconcile. |
| `removeConnection(id)` | Remove a connection by id. |
| `clear()` | Remove every node and connection. |
| `zoomToFit()` | Pan/zoom to fit all nodes. |
| `zoomTo(k)` | Set the zoom level (echoes into the `zoom` model). |
| `setCenter(x, y, opts?)` | Center the viewport on graph coordinates `(x, y)`; `opts.zoom` optionally sets the zoom. Echoes the level into the `zoom` model and fires `translated`. Powers the pannable MiniMap. |
| `setViewport({ x, y, k })` | Set the raw viewport transform (any field omitted keeps its current value). Echoes `k` into the `zoom` model and fires `translated`. |
| `screenToFlowPosition(clientX, clientY)` | Project a screen/client coordinate to graph coordinates `{ x, y }` (or `null` before mount). The **palette drag-drop** primitive — on a canvas `@drop`, call it with the event's client coords and push a fresh node into the bound `graph` at the result. The consumer owns the drag/drop; the canvas owns the projection. |
| `getNodes()` | Serialized snapshot `[{ id, label, x, y }]` with live positions. |
| `getConnections()` | Serialized snapshot `[{ id, source, sourceOutput, target, targetInput }]`. |
| `getTransform()` | The viewport transform `{ x, y, k }`. |

> The method is `zoomTo`, not `setZoom` — `zoom` is a model prop, so React auto-generates a `setZoom` state setter that a `setZoom` verb would collide with (the same collision discipline as the rest of `@rozie-ui`).

### Palette drag-drop (`screenToFlowPosition`)

Dropping a node from a sidebar palette onto the canvas — the bread-and-butter no-code-builder interaction — works like React Flow: **you own the drag/drop, the canvas owns the projection.** Grab the canvas handle, mark a palette item `draggable`, and on the canvas `@drop` translate the pointer to graph coordinates and append a node into the bound `graph`:

```html
<!-- palette item -->
<div draggable="true">＋ New node</div>

<!-- canvas wrapper owns dragover/drop -->
<div @dragover.prevent @drop.prevent="onDrop">
  <FlowCanvas ref="flow" r-model:graph="$data.graph">
    <NodeType type="task"><template #body="{ node }">{{ node.data.label }}</template></NodeType>
  </FlowCanvas>
</div>
```

```js
const onDrop = (e) => {
  // name the local anything BUT `flow` — `const flow = $refs.flow` self-shadows the ref.
  const canvas = $refs.flow
  const pos = canvas?.screenToFlowPosition(e.clientX, e.clientY)
  if (!pos) return
  // controlled-graph write-back: a FRESH graph object (in-place mutation is dropped on 4/6).
  $data.graph = { ...$data.graph, nodes: [...$data.graph.nodes,
    { id: crypto.randomUUID(), type: 'task', x: pos.x, y: pos.y, data: { label: 'New' } }] }
}
```

`screenToFlowPosition(clientX, clientY)` inverts the viewport transform (pan + zoom), so a node placed at the result renders exactly under the drop point regardless of how the canvas is panned or zoomed.

> **Angular consumers:** reach the handle with a native `@ViewChild(FlowCanvas)` query (`this.flow.screenToFlowPosition(...)`). Rozie's `$refs` to a child *component* resolves to the host element on Angular (a documented parity edge), so the in-template `$refs.flow` path above is for the other five targets.
