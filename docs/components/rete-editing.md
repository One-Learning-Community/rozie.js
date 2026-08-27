# Editing the graph

The editing feature reference for [`FlowCanvas`](/components/rete): everything beyond drag and connect that ships in the box.

`FlowCanvas` is an **editor**, not just a viewer. Selection, deletion, undo/redo, edge styling, reconnection, marquee selection, a per-node toolbar, and auto-layout all ship in the box, and every edit flows through the **same controlled-graph contract** as drag and connect: the canvas writes a fresh `graph` object back through the two-way model, and the consumer never hand-reconciles. The full bundle is on by default behind the existing gates — `:readonly="true"` turns the whole canvas into a static viewer (no selection, no delete, no editing), and the individual opt-outs / opt-ins below let you trim it to taste.

## Keyboard shortcuts

A focused canvas (it carries `tabindex="0"`) binds four shortcuts, all gated on `selectable && !readonly` — evaluated **live, per keystroke**, so toggling either prop takes effect immediately — and all suppressed while focus is inside a node-body text field (`input` / `textarea` / `contenteditable`), so typing in a node never triggers them. The gate covers the **keyboard shortcuts** only: `undo()` / `redo()` as handle verbs are never gated, so a read-only canvas can still be driven by its consumer:

| Keys | Action |
| --- | --- |
| **Delete** / **Backspace** | Delete the selected node(s) and their incident edges — or, when no node is picked, the selected edge. |
| **Ctrl/Cmd+Z** · **Ctrl/Cmd+Shift+Z** / **Ctrl/Cmd+Y** | Undo · redo. |
| **Ctrl/Cmd+A** | Select every node (`selectAll()`). |
| **Ctrl/Cmd+D** | Duplicate the current selection (`duplicateNode` per node) — **one** undo step for the whole gesture, however many nodes are selected. |

## Selecting and deleting edges

Clicking a committed connection's path selects it (the edge gets an `.is-selected` class you can style through the `:root {}` engine-DOM hatch) and fires `@edge-click` + `@edge-selected` with `{ id }`. With an edge selected, **Delete** / **Backspace** removes it — written back through the bound `graph` as a fresh `connections` array. Node deletion takes precedence: if a node is selected, the key deletes the node (and its incident edges) first. Edge selection is gated `selectable && !readonly` and, like node selection, is surfaced purely via events — it is never written into `graph`.

```html
<FlowCanvas r-model:graph="$data.graph" @edge-selected="onEdgeSelected" />
```

## Edge types — step / smoothstep / straight {#edge-types}

Each connection carries an optional **`type`** on the bound graph — `'bezier'` (default), `'step'`, `'smoothstep'`, or `'straight'` — selecting the path shape, matching React Flow's edge types. It is a per-edge property, so a single graph can mix orthogonal routing for some edges and curves for others; editing `connection.type` on the bound graph re-renders just that edge in place (the same restyle path as `label` / `stroke` / `dashed`). An unknown value falls back to the unchanged bezier.

```js
$data.graph = {
  nodes: [/* … */],
  connections: [
    { source: 'a', sourceOutput: 'out', target: 'b', targetInput: 'in', type: 'smoothstep' },
  ],
}
```

## Undo / redo

On by default (`history` prop). Every gesture — drag, connect, disconnect, delete, reconnect, auto-arrange — pushes **one** capped (~100) snapshot of the bound graph (nodes incl. `x`/`y` + connections; **not** the viewport). **Ctrl/Cmd+Z** undoes, **Ctrl/Cmd+Shift+Z** / **Ctrl/Cmd+Y** redo, and the `undo()` / `redo()` / `canUndo()` / `canRedo()` handle verbs drive the same stack from your own toolbar. One gesture = one step; a fresh edit after an undo discards the redo branch. Restores are echo-guarded through the `graph` model. Opt out with `:history="false"` (the stack stays empty; the verbs no-op).

> **Snapshotting note (cross-framework):** the wrapper clones graph snapshots JSON-first — a bare `structuredClone()` throws on Vue's `reactive()` and Svelte's `$state` proxies, so it is never used on the bound graph. If you keep your own history outside the component, clone the same way.

## Marquee selection and the pan ↔ select mode

The two-way **`mode`** prop is a Figma-style toggle. `'pan'` (default) pans the viewport on an empty-canvas drag — unchanged. `'select'` draws a rubber-band **marquee** box on an empty-canvas drag and multi-selects the intersecting nodes (surfacing `@selection-change`); a node drag still drags the node in both modes. Bind it with `r-model:mode` and drive it from your own UI, or set **`:marquee="true"`** to render a built-in 4th Controls button that toggles the mode for you. `marquee` defaults OFF so the default Controls overlay keeps its three buttons (the screenshot baseline is byte-identical); the marquee *behavior* works whenever `mode === 'select'`, independent of the button.

```html
<FlowCanvas r-model:graph="$data.graph" r-model:mode="$data.mode" :marquee="true" />
```

## Reconnectable edges

Dragging an existing edge's endpoint onto a different compatible socket **rewrites** that connection rather than dropping it — the edge count is unchanged and it counts as **one** undoable gesture (the internal remove + add are coalesced into a single history snapshot). Reconnection is on whenever `!readonly` — evaluated **live**, so toggling `readonly` mid-session takes effect immediately (a read-only canvas refuses the endpoint grab outright, drawing no ghost path) — and honors the same `:validate-types` / `canConnect` rules as drawing a fresh edge.

## Node toolbar

Set **`:node-toolbar="true"`** to float a small toolbar over the single selected node (positioned from the engine node-view rect + the area transform, re-tracked on pan / zoom / drag). The default content is **Delete** (cascading controlled-graph `deleteNode`) and **Duplicate** (clone the node spec at an offset with a new id into a fresh `graph`); both fire `@node-action` with `name: 'delete' | 'duplicate'`. Fill the **`#toolbar`** reactive slot (scope `{ node, emit }`) to replace the buttons with your own. Default OFF, so existing canvases are pixel-identical — selecting a node pops nothing until you opt in.

```html
<FlowCanvas r-model:graph="$data.graph" :node-toolbar="true">
  <template #toolbar="{ node, emit }">
    <button @click="emit('rename', { id: node.id })">Rename</button>
    <button @click="emit('delete')">✕</button>
  </template>
</FlowCanvas>
```

## Node resizer

Opt a node **TYPE** into corner-handle resizing (the React Flow `<NodeResizer/>` parity) with **`<NodeType resizable>`**:

```html
<FlowCanvas r-model:graph="$data.graph">
  <NodeType type="card" resizable :min-width="160" :min-height="80" :max-width="480">
    <template #body="{ node }">{{ node.data.label }}</template>
    <Port output="out" type="any" />
  </NodeType>
</FlowCanvas>
```

Selecting a node of a `resizable` type shows **4 corner drag handles**. Dragging one persists an explicit `node.width` / `node.height` (a fixed box that overrides the node's normal auto-sizing) back through the two-way `graph` model, coalesced through the same `rAF`-batched write-back path as everything else. Each corner resizes **anchored on the opposite corner** — dragging `se` (bottom-right) grows the node while the top-left corner stays put; dragging `nw` grows it while the bottom-right corner stays put (and so on for `ne` / `sw`), matching the React Flow `NodeResizer` semantics.

`<NodeType>` accepts four optional bound props to constrain the drag:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `resizable` | `Boolean` | `false` | Opt this node TYPE into corner-handle resizing. Default OFF — zero drift for every existing `<NodeType>` that never declares it. |
| `minWidth` | `Number` | `null` | Minimum width (px) a resize gesture may shrink this type to. Falls back to a small sane default (**40px**) when `resizable` is true and this is unset, so a node can never be dragged to 0px. |
| `minHeight` | `Number` | `null` | Minimum height (px) a resize gesture may shrink this type to. Same 40px fallback. |
| `maxWidth` | `Number` | `null` | Maximum width (px) a resize gesture may grow this type to. Unset = unbounded growth. |
| `maxHeight` | `Number` | `null` | Maximum height (px) a resize gesture may grow this type to. Unset = unbounded growth. |

A misconfigured `maxWidth` / `maxHeight` **below** the effective `minWidth` / `minHeight` never wins silently — the min bound always takes precedence, and the component logs a one-time `console.warn` per type so the misconfiguration is visible during development.

**Double-click a handle to reset** a node back to auto-size, clearing its explicit `width` / `height` so the node returns to its natural content-driven size on the next render. (Rete swallows native `click`/`dblclick` events during node interaction, so this is detected by timing two stationary handle releases within 400ms — a genuine drag never counts as a "click".) Like every other edit, the reset goes through the same controlled-graph write-back path and is one undoable gesture (`:history`-gated).

```js
$data.graph = {
  nodes: [{ id: 'n1', type: 'card', x: 0, y: 0, width: 320, height: 180, data: { label: 'Card' } }],
  connections: [],
}
```

## Auto-layout

The **`autoArrange(opts?)`** handle verb relayouts the whole graph into a non-overlapping layered arrangement (elkjs-backed) and writes the arranged positions back through the two-way `graph` model as one undoable gesture. It is **verb-only and never auto-triggered** — nothing reflows unless you call it (e.g. from a "Tidy up" button). It is `await`-able, and `opts.options` forwards elk layout options (direction, spacing).

The three layout packages (`rete-auto-arrange-plugin`, `elkjs`, `web-worker`) are **optional peers**, and they are optional in the way that actually matters: `<FlowCanvas>` reaches them through a **dynamic import on the first `autoArrange()` call**, so if you never arrange, elkjs — 1.5 MB in one non-tree-shakeable blob — never enters your bundle. The first call pays a chunk fetch; later calls reuse the loaded engine. If the peers are not installed, the returned promise rejects rather than silently doing nothing.

```js
await $refs.flow.autoArrange()
// or with options:
await $refs.flow.autoArrange({ options: { 'elk.direction': 'RIGHT' } })
```

### Edge routing

`autoArrange()` now writes a **route** onto every connection it bent around an intermediate node — an optional `waypoints` field (`{x,y}[]`) on the bound `graph`'s connection object (see the [`graph` prop](/components/rete#props)). A straight edge stays a straight edge; a bent one renders as a multi-segment polyline through the points ELK actually computed, instead of a bezier chord cutting through whatever sits between its endpoints. The route lives in your own `graph` object, so it **persists across a reload** exactly like node positions do.

A route is only ever as good as the layout it was computed against: dragging or resizing a node drops the stored route from every edge attached to it, and that edge falls back to its plain chord until the next `autoArrange()` call recomputes it.

Restore the previous (unrouted) behavior per call via the same `opts.options` escape hatch:

```js
await $refs.flow.autoArrange({ options: { 'elk.edgeRouting': 'POLYLINE' } })
```

## Connect-end-on-pane (quick-add menus)

When a connection drag starts at an **output** socket and ends on **empty canvas** (no target socket), `FlowCanvas` fires **`@connect-end`** with `{ source, sourceOutput, position }` — `position` in graph coordinates. This is a **pure signal**, the React Flow `onConnectEnd` parity: the canvas creates no node and shows no menu. The consumer decides what happens — pop a node picker at `position`, quick-add a default node, or ignore the drop. Because `position` is already in graph space, a node you push into `graph` at that point lands exactly where the drag ended.

```js
const onConnectEnd = ({ source, sourceOutput, position }) => {
  // open your own "create node" menu at `position`, then write the new node
  // (and an edge from source/sourceOutput) back into $data.graph.
}
```

## Palette drag-drop (`screenToFlowPosition`)

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

## See also

- [FlowCanvas showcase & API](/components/rete): the full props / events / imperative-handle reference and the `<NodeType>` / `<Port>` authoring model.
- [FlowCanvas live demo](/components/rete-demo): the editor running in the page.
- [Node-flow editor comparison](/components/rete-comparison): how the editing bundle stacks up against the per-framework incumbents.
