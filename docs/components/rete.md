# FlowCanvas — the cross-framework node-flow editor

`FlowCanvas` is a data-bound port of [Rete.js v2](https://retejs.org/), the framework-agnostic visual-programming engine whose core owns the graph model and all pointer interaction (pan, zoom, node drag, drag-to-connect). It ships as React, Vue, Svelte, Angular, Solid, and Lit components with the same API.

This fills a genuine cross-framework gap. No other node-flow editor ships all six idiomatically:

- [@xyflow/react](https://reactflow.dev/) (React Flow) + [@xyflow/svelte](https://svelteflow.dev/) (Svelte Flow) — React & Svelte only
- [@vue-flow/core](https://vueflow.dev/) — a **separate** Vue reimplementation, not a shared core
- [@foblex/flow](https://flow.foblex.com/) / ngx-graph — Angular only
- Solid has only a single-author experiment; **Lit has nothing**

Rete.js ships render plugins for React/Vue/Angular/Svelte/Lit (five divergent codebases, no Solid). `FlowCanvas` replaces all of them with a single vanilla render layer, and Solid (plus a far thinner Lit) gets a category-leading node editor.

The full source for `FlowCanvas.rozie` lives in the [`@rozie-ui/rete` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/src/FlowCanvas.rozie).

## The `@rozie-ui/rete` packages

`FlowCanvas` ships as six pre-compiled, per-framework packages. Install the one for your framework; no build step is required:

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

- **`<NodeType type="…">`** — declares a node TYPE **once**: its visible body (a named `#body` slot, scoped `{ node, selected, emit }`) plus its port schema (nested `<Port>` children). **Every** graph node whose `type` matches renders this template (render-by-type) and uses its ports. A `<NodeType>` carries **no** `id`/`x`/`y` — instance identity and position live in the bound `graph`, not on the tag. It also carries the type-level sizing props: **`width`** / **`height`** fix the box for every node of the type (the design-consistency knob — a node then does not resize as its `#body` content changes), **`minWidth`** / **`minHeight`** / **`maxWidth`** / **`maxHeight`** clamp the rendered box whatever its size came from (auto-sized body content, an authored `width`, or a resize drag), and the opt-in **`resizable`** adds the [Node resizer](/components/rete-editing#node-resizer) corner handles. Precedence: a node instance's own `width`/`height` in the bound `graph` beats the type's, and the min/max clamp applies to whichever wins. An explicit width also lowers the default 140px node floor, so a value below it renders as authored.
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
        <NodeType type="source" renderBody={({ node }) => <div>{node.data.label}</div>}>
          <Port output="num" type="number" />
        </NodeType>
        <NodeType type="merge" renderBody={({ node }) => <div>{node.data.label}</div>}>
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

## API

### Props

`graph` and `zoom` are **two-way** (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onGraphChange` / `onZoomChange`). The single bound `graph` object is the source of truth; dragging a node writes its new `x`/`y` back into a fresh `graph`, and drawing / removing a connection writes a fresh `connections` array — reconciled into the live engine on change, no remount.

| Name | Type | Default | Two-way (model) | Description |
| --- | --- | --- | :---: | --- |
| `graph` | `Object` | `{…}` | ✓ | The single source of truth — `{ nodes: [{ id, type, x, y, data?, width?, height? }], connections: [{ id?, source, sourceOutput?, target, targetInput?, type?, label?, stroke?, dashed?, waypoints? }] }`. A node's `type` selects the node's `<NodeType>` template (render-by-type + its `<Port>` schema); `data` is the opaque payload handed to the type's `#body` scope. A connection may carry an optional **`label`** (rendered at the edge midpoint), **`stroke`** (CSS color), and **`dashed`** (Boolean) — per-edge label / styling for conditional & labeled edges (editing them on the bound graph re-renders the edge), plus an optional **`type`** — `'bezier'` (default) \| `'step'` \| `'smoothstep'` \| `'straight'` — selecting the path shape (see [Edge types](#edge-types)). A connection may also carry an optional **`waypoints`** (`{x,y}[]`) — the route the [Auto-layout](/components/rete-editing#auto-layout) verb writes for an edge it routed around an intermediate node; additive and optional, so an edge without one renders exactly as before. A node may carry an explicit **`width`** / **`height`**: the fixed box a `<NodeType resizable>` corner-drag persists, overriding auto-sizing for that instance (see [Node resizer](#node-resizer)). **Two-way**: the canvas writes back a fresh top-level object on every drag (x/y) and connect / disconnect (connections) — immutable applyNodeChanges style. `sourceOutput`/`targetInput` default to `'out'`/`'in'`; a missing connection `id` is derived from the endpoints. |
| `validateTypes` | `Boolean` | `true` | | Automatic typed-socket validation (default ON). When `true`, the canvas resolves each endpoint's port TYPE from the per-`<NodeType>` `<Port type>` schema and auto-rejects a type-mismatched connection (firing `connection-rejected`). `canConnect` survives as the optional custom-rule override (runs in addition). Set `false` for pure-`canConnect` (type as metadata only). |
| `zoom` | `Number` | `1` | ✓ | The viewport zoom level. Two-way: scroll / pinch writes the new zoom back through the model (echo-guarded against the wrapper's own programmatic zooms); a consumer write zooms the live area. |
| `pannable` | `Boolean` | `true` | | Whether the canvas can be panned (drag the background). **Applied live** — flipping it after mount takes effect on the next gesture. |
| `zoomable` | `Boolean` | `true` | | Whether the canvas can be zoomed (scroll / pinch). **Applied live** — flipping it after mount takes effect on the next gesture. |
| `selectable` | `Boolean` | `true` | | Whether nodes can be selected (click; ctrl-click to accumulate). Reflected as the `selected` flag in the `<NodeType>` `#body` scope, and surfaced to the consumer via the `@selection-change` event. **Applied live** — turning it off clears the current selection. |
| `readonly` | `Boolean` | `false` | | Read-only viewer mode — no node drag, no connection editing, no selection. **Applied live.** |
| `minZoom` | `Number` | `0.1` | | Minimum zoom level (the lower bound of the area's zoom restrictor). `0` disables the bound. |
| `maxZoom` | `Number` | `4` | | Maximum zoom level (the upper bound of the area's zoom restrictor). `0` disables the bound. |
| `snapGrid` | `Number` | `0` | | Snap-to-grid size in pixels for node dragging. `0` turns snapping off. **Applied live**; user drags only — positions applied from the bound `graph` are not snapped. |
| `accumulateOnCtrl` | `Boolean` | `true` | | When selectable, hold Ctrl to add to the current selection instead of replacing it. |
| `curvature` | `Number` | `0.3` | | The bezier curvature of connection paths (`classicConnectionPath`). |
| `fitOnMount` | `Boolean` | `true` | | After the initial graph mounts, pan/zoom the viewport to fit all nodes (`AreaExtensions.zoomAt`). |
| `controls` | `Boolean` | `true` | | Render the built-in **Controls overlay** — a zoom in / zoom out / fit-view button cluster over the canvas (the React Flow `<Controls/>` parity). The buttons drive the same zoom/fit path as the `zoomTo` / `zoomToFit` handle verbs (clamped to `minZoom`/`maxZoom`) and stay enabled in `readonly` (zoom/fit are view-only). Opt out with `:controls="false"`. |
| `minimap` | `Boolean` | `false` | | Render the built-in **MiniMap overlay** — an absolute SVG panel (bottom-right) showing a scaled map of every node (sized from the **measured** engine node-view dims) plus the current viewport window (the area outside dimmed). **Pannable**: drag the minimap to recenter the main viewport (via `setCenter`). Opt-in (default OFF) — the React Flow `<MiniMap/>` parity. Evaluated at construction; set it at mount time. |
| `canConnect` | `Function` | `null` | | Connection-validation predicate `(conn: { source, sourceOutput, target, targetInput }) => boolean`. Return `false` to REJECT a connection — no edge is committed, no ghost path is drawn, and `connection-rejected` fires. Runs in **addition** to the automatic `:validate-types` check (the custom-rule override). Gates ALL connection paths uniformly (drag-to-connect, imperative `addConnection`, graph reconcile). Absent / `null` imposes no custom rule. |
| `history` | `Boolean` | `true` | | **Undo / redo**, on by default. Every gesture — drag, connect, disconnect, delete — pushes ONE capped (~100) snapshot of the bound graph (nodes incl. x/y + connections; **not** the viewport), and `undo()` / `redo()` + **Ctrl/Cmd+Z** · **Ctrl/Cmd+Shift+Z** · **Ctrl/Cmd+Y** restore it through the two-way `graph` model (echo-guarded). One gesture = one undo step; a fresh edit after an undo discards the redo branch. Opt out with `:history="false"` (the snapshot stack stays empty; the verbs no-op). |
| `mode` | `String` | `"pan"` | ✓ | **Two-way interaction mode** — the Figma-style pan ↔ select toggle. `'pan'` (default) PANS the viewport on an empty-canvas drag (UNCHANGED). `'select'` draws a rubber-band **marquee** box on an empty-canvas drag that multi-selects the intersecting nodes (surfacing `selection-change`). A node drag still drags the node in BOTH modes. Bind with `r-model:mode`; the canvas writes it back when the built-in mode button (see `marquee`) toggles. |
| `marquee` | `Boolean` | `false` | | Render the **4th Controls button** — the pan ↔ select mode toggle (two-way-writes `mode`). Default OFF so the default Controls overlay keeps its 3 buttons (the `FlowCanvasScreenshot` pixel baseline is byte-identical). The marquee BEHAVIOR works whenever `mode === 'select'` regardless of this flag (a consumer can drive `mode` directly); this only governs the built-in button. |
| `nodeToolbar` | `Boolean` | `false` | | Render the opt-in **NodeToolbar** — a floating toolbar over the **single selected** node (positioned from the engine node-view rect + the area transform, re-tracked on pan / zoom / drag). Default content = **Delete** (cascading controlled-graph `deleteNode`) + **Duplicate** (clone the node spec at an offset with a new id into a fresh `graph` object); both fire `node-action` (`name: 'delete' | 'duplicate'`). Override the content by filling the `#toolbar` reactive slot (scope `{ node, emit }`). Default OFF — existing canvases are pixel-identical (selecting a node pops nothing). |
| `background` | `String` | `"dots"` | | Canvas **background pattern** — `'dots'` (default, today's grid) \| `'lines'` \| `'cross'` \| `'none'` (the React Flow `<Background variant>` parity). One-way (not a model). Gap / size / color stay CSS custom properties (`--rozie-flow-grid-size`, `--rozie-flow-grid-dot-color`, `--rozie-flow-bg`) — not separate props. |

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `node-moved` | `{ id, x, y }` | A node finished a user drag to a new position. |
| `node-picked` | `{ id }` | A node was picked (pointer-down). |
| `selection-change` | `{ ids }` | The set of selected node ids changed — fired on pick / re-pick / deselect (background click clears it). Deduped (only on an actual change) and echo-guarded against the wrapper's own programmatic unselects. The #1 hook for an inspector panel. Selection is surfaced purely via this event — it is **not** written into the bound `graph`. |
| `edge-click` | `{ id }` | A committed connection's path was clicked. Fired only when `selectable && !readonly`. The raw click intent — pair with `edge-selected` (which both fire on the same gesture). |
| `edge-selected` | `{ id }` | The selected edge changed to `id` (the edge analogue of `selection-change`). Edge selection is kept purely in the wrapper and surfaced via this event — **not** written into the bound `graph`. The hook for an edge inspector / "delete this edge" UI. |
| `node-action` | `{ id, name, detail }` | A `<NodeType>` `#body` fill called its `emit(name, detail)` helper (e.g. an in-node button), or a default **NodeToolbar** button fired (`name: 'delete' | 'duplicate'`). |
| `connection-created` | `{ id, source, sourceOutput, target, targetInput }` | A user drew a new connection (not fired for programmatic / props-driven adds). |
| `connection-removed` | `{ id }` | A connection was removed (not fired for programmatic / props-driven removes). |
| `connection-rejected` | `{ source, sourceOutput, target, targetInput, reason }` | A connection was rejected (no edge committed). `reason` names the rule that rejected it: **`'type-mismatch'`** = the automatic `:validate-types` port-type check (the `<Port type>` schema on each endpoint), **`'can-connect'`** = the consumer's `canConnect` override. Fired for a user drag **and** for an explicit `addConnection()` handle call that a rule rejects (the verb also returns `null`). Not fired for props-driven reconcile — an edge in the bound `graph` that a rule rejects is the canvas echoing its own pass, not a user-facing rejection; it logs a one-time console warning instead. |
| `connect-end` | `{ source, sourceOutput, position }` | A connection drag started at an **output** socket and ended on **empty canvas** (no target socket, no edge created). `position` is `{ x, y }` in graph coordinates. A **pure signal** — the canvas creates no node and shows no menu; the consumer owns what happens next (a "create node here" picker, a quick-add menu). The React Flow `onConnectEnd` parity. |
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
| `duplicateNode(id)` | Clone a node in the controlled graph: copies the node spec at a small offset with a **fresh unique id**, deep-cloning its `data` so the copy is independent, and writes one fresh `graph` object back through the two-way model. Connections are **not** cloned — a duplicate is an isolated node. One history entry per duplicate. Returns the new id, or `null` for an unknown id. The same routine the NodeToolbar's Duplicate button and **Ctrl/Cmd+D** drive. |
| `addConnection(spec)` | Imperatively add a connection. NOT reaped by the `graph` reconcile. Returns the connection id, or `null` if the edge could not be placed — a rule rejected it (`connection-rejected` also fires) or an endpoint has no such port key; either way a console warning names the edge, and no phantom entry is left behind. |
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
| `undo()` | Undo the most recent graph edit (drag / connect / disconnect / delete), restoring the previous snapshot through the `graph` model (echo-guarded; graph-only, not the viewport). One gesture = one step. No-op when there's nothing to undo. Also **Ctrl/Cmd+Z**. Opt out with `:history="false"`. |
| `redo()` | Re-apply the edit most recently undone. A fresh edit after an undo discards the redo branch. No-op when there's nothing to redo. Also **Ctrl/Cmd+Shift+Z** and **Ctrl/Cmd+Y**. |
| `canUndo()` | Whether there is an edit to undo → `boolean`. |
| `canRedo()` | Whether there is an edit to redo → `boolean`. |
| `autoArrange(opts?)` | Relayout the graph into a non-overlapping layered arrangement (elkjs-backed), then read the arranged node positions back through the two-way `graph` model (echo-guarded, one undoable gesture). **Verb-only — never auto-triggered.** `await`-able; `opts.options` forwards elk layout options (direction / spacing). No-op before mount. The engine is **lazily imported on the first call**, so it never enters your bundle unless you arrange. |
| `getSelectedNodes()` | The currently-selected nodes as `[{ id, label, x, y }]` — the `getNodes()` shape filtered to the live selection (empty when nothing is selected). The on-demand read that complements the push-only `selection-change` event. |
| `selectNode(id, accumulate?)` | Programmatically select a node by id (`accumulate: true` adds to the selection; falsy replaces it) — drive selection from a sidebar or search. No-op when selection is disabled (`readonly` / `!selectable`). Named `selectNode`, not bare `select`, which is an inherited `HTMLElement` method. |
| `clearSelection()` | Clear the current node selection (and any selected edge). |
| `selectAll()` | Select every node. Also **Ctrl/Cmd+A** from a focused canvas. No-op when selection is disabled. |
| `centerOnNode(id, opts?)` | Pan — and optionally zoom via `opts.zoom` — to center the viewport on a node by id. `await`-able; measures the node to find its center in graph coordinates. No-op before mount or for an unknown id. |

> The method is `zoomTo`, not `setZoom` — `zoom` is a model prop, so React auto-generates a `setZoom` state setter that a `setZoom` verb would collide with (the same collision discipline as the rest of `@rozie-ui`).

### Slots

| Slot | Params | Notes |
| --- | --- | --- |
| (default) | — | Hosts the declarative `<NodeType>` / `<Port>` TYPE-template children. The normal authoring path. |
| `node` | `{ node, selected, emit }` | Reactive portal slot — the **low-level per-node escape hatch**: invoked per graph node whose `type` has no `<NodeType>` template, so the consumer switches on `node.type` inside one `#node` fill. Prefer `<NodeType>`. |
| `toolbar` | `{ node, emit }` | Reactive portal slot — replaces the default NodeToolbar buttons when `:node-toolbar="true"`. |

## Editing the graph

`FlowCanvas` is an **editor**, not just a viewer: selection, deletion, undo/redo, edge styling, reconnection, marquee selection, a per-node toolbar, a node resizer, and auto-layout all ship in the box, every edit flowing through the same controlled-graph contract as drag and connect (the canvas writes a fresh `graph` object back through the two-way model, and `:readonly="true"` turns the whole canvas into a static viewer). The full feature reference (keyboard shortcuts, edge selection and types, undo/redo, marquee mode, reconnectable edges, the node toolbar, the node resizer, auto-layout, quick-add menus, and palette drag-drop) lives on [Editing the graph](/components/rete-editing).

### Edge types {#edge-types}

Each connection may carry a per-edge `type` on the bound graph (`'bezier'`, `'step'`, `'smoothstep'`, or `'straight'`) selecting the path shape. See [Edge types](/components/rete-editing#edge-types).

### Node resizer {#node-resizer}

`<NodeType resizable>` opts a node TYPE into corner-handle resizing that persists an explicit `width` / `height` back through the two-way `graph` model. See [Node resizer](/components/rete-editing#node-resizer). A type that also declares a `width`/`height` uses it as the default box: a corner-drag overrides it for that instance, and a handle double-click resets back to the TYPE's size rather than to auto.

## Theming

Rete ships no stylesheet, and `FlowCanvas` needs **no engine CSS import** — every node / socket / connection / control value it renders is a `--rozie-flow-*` CSS custom property with a built-in inline `var(token, fallback)` default. It looks right zero-config yet is completely re-skinnable: override tokens at any ancestor scope. As a shortcut, overriding just `--rozie-flow-accent` recolors every "selected/active" affordance at once — the selected-node border + ring, socket hover, selected-edge stroke, the active control button, the marquee box, and the minimap's selected node + viewport window all fall back to it.

```css
/* on :root, a wrapper, or the .rozie-flow-canvas element */
.rozie-flow-canvas {
  --rozie-flow-accent: #16a34a;      /* every selection cue */
  --rozie-flow-bg: #fbfaf7;          /* canvas surface */
  --rozie-flow-node-bg: #ffffff;
  --rozie-flow-node-radius: 12px;
  --rozie-flow-connection-stroke: #a3a3a3;
}
```

The imperative overlays that draw with SVG attributes (the minimap fills, the connection arrowhead) read these same tokens at draw time, so a token override re-skins them too.

**Dark mode is a zero-import, OS-driven default.** The component ships an
`@media (prefers-color-scheme: dark)` block that re-skins the color tokens when the OS
requests dark — no import, no config. An app that explicitly opts into light at the
document root (a `.light` class or `[data-theme="light"]`) keeps control: the OS-dark
default stands down and the light render applies instead, on the five **light-DOM**
targets (React, Vue, Svelte, Angular, Solid). The light render itself is untouched by any
of this (the query only matches in a dark context), so nothing changes for light-mode
consumers.

**Lit is the one documented exception.** Its canvas lives inside a shadow root, where a
document-root ancestor selector cannot be observed — the `.light` / `[data-theme="light"]`
opt-out above is **not honored there**, and the Lit build keeps following the OS scheme
regardless. This is a real limitation of the shadow-DOM boundary, not an oversight:
`:host-context()` was considered and rejected because it is Chromium-only and a silent
no-op in Firefox/Safari. Lit consumers who need app-controlled theming should use the
`.dark` / `[data-theme="dark"]` class strategy below instead.

For apps that toggle theme by a **root class** rather than the OS setting, import
`themes/base.css` — it adds the `.dark` / `[data-theme="dark"]` strategy. On the five
light-DOM targets a class ancestor drives the switch; Lit's shadow boundary blocks a
descendant class too, but custom properties inherit across shadow boundaries, so the
class strategy still reaches Lit even though the OS-dark opt-out above cannot.

The complete token table and the design-system bridges live on the [dedicated theming page](/components/rete-theming).
