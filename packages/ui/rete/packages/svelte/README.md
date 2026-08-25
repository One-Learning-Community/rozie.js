# @rozie-ui/rete-svelte

Idiomatic **svelte** `FlowCanvas` — a cross-framework node-based flow / graph editor compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [Rete.js v2](https://retejs.org/). It follows the **controlled-graph** model: you bind ONE two-way `graph` object as the single source of truth and declare node **TYPE templates** with `<NodeType>` / `<Port>` children (render-by-type). The engine owns pan / zoom / drag / drag-to-connect, and the canvas writes layout (x/y on drag) and connections (on connect / disconnect) back through the model, so you never hand-reconcile. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/rete-svelte
```

Peer dependencies: the Rete engine (`rete` + `rete-area-plugin` + `rete-connection-plugin` + `rete-render-utils`, all `^2`) + `svelte`. Install them alongside this package.

Also installed: `@rozie/runtime-svelte` — Rozie's small, tree-shaken runtime helper package (controllable state, keyboard navigation, event modifiers, and safe interpolation). It arrives as a regular dependency, so npm pulls it for you. Your bundler keeps only the helpers this component actually uses — typically a few hundred bytes to a few KB, minified and gzipped. [What's in it and what it costs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md).

Rete ships no stylesheet — all node / socket / connection chrome is styled by this component, so there is no engine CSS to import.

## Usage

```svelte
<script lang="ts">
  import FlowCanvas, { NodeType, Port } from '@rozie-ui/rete-svelte';

  let graph = $state({
    nodes: [
      { id: 'a', type: 'source', x: 0,   y: 0,  data: { label: 'Source' } },
      { id: 'b', type: 'merge',  x: 280, y: 60, data: { label: 'Merge' } },
    ],
    connections: [{ source: 'a', sourceOutput: 'num', target: 'b', targetInput: 'num' }],
  });
  let zoom = $state(1);
</script>

<div style="height: 400px">
  <FlowCanvas
    bind:graph
    bind:zoom
    onconnectioncreated={(c) => console.log('connected', c)}
    onnodemoved={(e) => console.log('moved', e)}
  >
    <NodeType type="source">
      {#snippet body({ node })}<div>{node.data.label}</div>{/snippet}
      <Port output="num" type="number" />
    </NodeType>
    <NodeType type="merge">
      {#snippet body({ node })}<div>{node.data.label}</div>{/snippet}
      <Port input="num" type="number" multiple />
    </NodeType>
  </FlowCanvas>
</div>
```

## Theming

Every visual value the canvas renders is a `--rozie-flow-*` CSS custom property with a built-in inline `var(token, fallback)` default — it looks right zero-config and re-skins by overriding a token at any ancestor scope. Overriding just `--rozie-flow-accent` recolors every selected/active affordance at once: the selected-node border + ring, socket hover, the selected-edge stroke, the active control button, the marquee box, and the minimap selection.

**Dark mode is a zero-import, OS-driven default** — the component ships an `@media (prefers-color-scheme: dark)` block that applies when the OS requests dark. An app that explicitly opts into light at the document root (a `.light` class or `[data-theme="light"]`) keeps control: the OS-dark default stands down and the light render applies instead. On the Lit build specifically, the canvas lives inside a shadow root, where a document-root ancestor selector cannot be observed, so the light opt-out above is **not honored there** — Lit keeps following the OS scheme regardless. Lit consumers who need app-controlled theming should use the `.dark` / `[data-theme="dark"]` class strategy below instead, since custom properties inherit across the shadow boundary. Ready-made design-system bridges ship in the package:

```svelte
import '@rozie-ui/rete-svelte/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

The full token vocabulary — plus the `.dark` / `[data-theme="dark"]` class strategy for apps that toggle theme by a root class — lives in `@rozie-ui/rete-svelte/themes/base.css`.

Dragging a connection from a typed port dims type-mismatched target sockets on other nodes for the duration of the gesture. That hint is resolved from port **types only** — it never invokes the `canConnect` prop, which still runs once, as the override, at actual connection time.

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
| `background` | `String` | `"dots"` |  |  |
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

```svelte
<script>
  let flow;                 // component instance via bind:this
</script>

<FlowCanvas bind:this={flow} />
<button onclick={() => flow.zoomToFit()}>Fit</button>
```

| Method | Description |
| --- | --- |
| `getEditor` | Return the underlying Rete `NodeEditor` instance for direct graph-model access (the engine escape hatch). |
| `getArea` | Return the underlying Rete `AreaPlugin` instance (viewport transform, node views, pan/zoom). |
| `addNode` | Imperatively add a node — `addNode(spec)` where spec is `{ id, type, x, y, data? }`. The node's sockets come from its TYPE's `<Port>` schema (never a per-node port array) and its label from `data.label`. Returns the id. NOT reaped by the `graph` reconcile. |
| `removeNode` | Imperatively remove a node and its connections by id — `removeNode(id)`. Returns whether it existed. The engine-only escape hatch — NOT written back to the bound `graph` model (use `deleteNode` for the controlled-graph delete). |
| `deleteNode` | Remove a node and its incident connections from the CONTROLLED graph — `deleteNode(id)` writes a fresh `graph` object back through the two-way model (the blessed cascading delete; the `$watch(graph)` reconcile reaps the live engine node/edges). Returns whether a node was removed. Contrast `removeNode`, the engine-only imperative escape hatch. |
| `duplicateNode` | Clone a node in the CONTROLLED graph — `duplicateNode(id)` copies the node spec at a small offset with a FRESH unique id (never a colliding one), deep-cloning its `data` so the copy is independent of the source, and writes one fresh `graph` object back through the two-way model. Connections are NOT cloned — a duplicate is an isolated node (the React-Flow default). One history entry per duplicate. Returns the new id, or `null` for an unknown id. The same routine the NodeToolbar's Duplicate button and Ctrl/Cmd+D drive. |
| `addConnection` | Imperatively add a connection — `addConnection({ id?, source, sourceOutput?, target, targetInput? })`. Returns the id. NOT reaped by the `graph` reconcile. |
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
| `autoArrange` | Relayout the graph into a non-overlapping layered arrangement — `await autoArrange(opts?)` runs the elkjs-backed auto-layout, then reads the arranged node positions back through the two-way `graph` model (echo-guarded, one undoable gesture). Verb-only — never auto-triggered. `opts.options` forwards elk layout options (direction / spacing). No-op before mount. The engine (`rete-auto-arrange-plugin` + its 1.5 MB elkjs payload) is loaded by a dynamic import on the FIRST call and reused after — so it stays out of your bundle entirely unless you arrange, and the first call pays a chunk fetch. If the optional peer is not installed, the returned promise rejects rather than silently doing nothing. |
| `undo` | Undo the most recent graph edit (drag / connect / disconnect / delete) — `undo()` restores the previous snapshot through the two-way `graph` model (echo-guarded). Graph-only (nodes + connections), NOT the viewport. One gesture = one step. No-op when there is nothing to undo. Also bound to Ctrl/Cmd+Z. Opt out with `:history="false"`. |
| `redo` | Redo the edit most recently undone — `redo()` re-applies the snapshot through the `graph` model (echo-guarded). A fresh edit after an undo discards the redo branch. No-op when there is nothing to redo. Also bound to Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y. |
| `canUndo` | Return whether there is an edit to undo — `canUndo()` → boolean. |
| `canRedo` | Return whether there is an edit to redo — `canRedo()` → boolean. |
| `getSelectedNodes` | Return the currently-selected nodes as `[{ id, label, x, y }]` (the `getNodes()` shape, filtered to the live selection). Empty when nothing is selected. Complements the push-only `selection-change` event with an on-demand read. |
| `selectNode` | Programmatically select a node by id — `selectNode(id, accumulate?)` (accumulate=true adds to the selection; falsy replaces it). Drives selection from a sidebar/search. No-op when selection is disabled (readonly / !selectable). NOT named bare `select` (inherited HTMLElement method → Lit shadow). |
| `clearSelection` | Clear the current node selection (and any selected edge) — `clearSelection()`. |
| `selectAll` | Select every node — `selectAll()`. Also bound to Ctrl/Cmd+A from a focused canvas (the marquee only covers a dragged region). No-op when selection is disabled. |
| `centerOnNode` | Pan (and optionally zoom via `opts.zoom`) to center the viewport on a node by id — `await centerOnNode(id, opts?)`. Measures the node to find its center in graph coords. No-op before mount or for an unknown id. |

## Slots

| Slot | Params |
| --- | --- |
| node | node, selected, emit |
| toolbar | node, emit |
| (default) |  |
