---
title: FlowCanvas — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import FlowCanvas from '@rozie-ui/rete-vue';
// NodeType / Port ship in the same @rozie-ui/rete-vue package; this VitePress page
// pulls them from the workspace source directly (the published package exposes them
// as named exports — see the Vue quick start in the API reference).
import NodeType from '../../packages/ui/rete/packages/vue/src/NodeType.vue';
import Port from '../../packages/ui/rete/packages/vue/src/Port.vue';

// ONE controlled graph object — the single source of truth (the xyflow
// `nodes`/`edges` mental model). Each node carries its `type` (which selects a
// `<NodeType>` template below) + its `x`/`y` + an opaque `data` payload. The
// canvas writes layout (x/y on drag) and connections (on connect/disconnect)
// BACK into this object via `v-model:graph` — the consumer never hand-reconciles.
const INITIAL_GRAPH = {
  nodes: [
    { id: 'input',  type: 'in',  x: 20,  y: 40,  data: { label: 'Input' } },
    { id: 'filter', type: 'op',  x: 280, y: 40,  data: { label: 'Transform' } },
    { id: 'output', type: 'out', x: 540, y: 140, data: { label: 'Output' } },
  ],
  connections: [
    { id: 'e1', source: 'input',  sourceOutput: 'out', target: 'filter', targetInput: 'in' },
    { id: 'e2', source: 'filter', sourceOutput: 'out', target: 'output', targetInput: 'in' },
  ],
};

const flow = ref();
const zoom = ref(1);
const graph = ref(structuredClone(INITIAL_GRAPH));
let next = 1;

function addNode() {
  const id = 'n' + next++;
  // Controlled-model add: write a FRESH graph object (in-place deep mutation is
  // silently dropped on React/Solid/Lit/Angular). The canvas reconciles it live.
  graph.value = {
    ...graph.value,
    nodes: [
      ...graph.value.nodes,
      { id, type: 'op', x: 120 + graph.value.nodes.length * 24, y: 240, data: { label: 'Node ' + id } },
    ],
  };
}
function reset() {
  next = 1;
  graph.value = structuredClone(INITIAL_GRAPH);
  zoom.value = 1;
}
</script>

# FlowCanvas — live demo

This is the **real `@rozie-ui/rete-vue` package** running on this page (VitePress is itself a Vue app) — driving an actual [Rete.js v2](https://retejs.org/) node editor. **Drag a node**, **drag from one socket to another to connect them**, scroll to zoom, or use the controls below. Everything is driven by the same `FlowCanvas.rozie` source that compiles to all six frameworks, through a **vanilla render layer** (no framework-specific Rete render plugin). Rete ships no stylesheet — every node, socket, and connection you see is styled by the component itself.

<ClientOnly>
<div class="flow-live">
  <div class="flow-live__controls">
    <button @click="addNode">Add node ＋</button>
    <button @click="zoom = Math.min(Math.round((zoom + 0.25) * 100) / 100, 4)">Zoom in ＋</button>
    <button @click="zoom = Math.max(Math.round((zoom - 0.25) * 100) / 100, 0.2)">Zoom out －</button>
    <button @click="flow?.zoomToFit()">Fit ▣</button>
    <span class="flow-live__sep" />
    <button class="flow-live__primary" @click="reset">Reset ▸</button>
  </div>

  <div class="flow-live__stage">
    <FlowCanvas
      ref="flow"
      v-model:graph="graph"
      v-model:zoom="zoom"
      style="width: 100%; height: 380px;"
    >
      <NodeType type="in">
        <template #body="{ node }">
          <div class="flow-live__node" data-kind="in"><strong>{{ node.data.label }}</strong></div>
        </template>
        <Port output="out" type="value" label="value" />
      </NodeType>
      <NodeType type="op">
        <template #body="{ node }">
          <div class="flow-live__node" data-kind="op"><strong>{{ node.data.label }}</strong></div>
        </template>
        <Port input="in" type="value" label="in" />
        <Port output="out" type="value" label="out" />
      </NodeType>
      <NodeType type="out">
        <template #body="{ node }">
          <div class="flow-live__node" data-kind="out"><strong>{{ node.data.label }}</strong></div>
        </template>
        <Port input="in" type="value" label="result" multiple />
      </NodeType>
    </FlowCanvas>
  </div>

  <div class="flow-live__readout">
    <code>{{ graph.nodes.length }} nodes · {{ graph.connections.length }} connections · zoom {{ zoom.toFixed(2) }}</code>
  </div>
</div>
</ClientOnly>

The graph is **one controlled object** (`v-model:graph`) — the single source of truth, shaped `{ nodes: [{ id, type, x, y, data }], connections: [...] }`. Each node's `type` selects a `<NodeType>` template; the canvas renders every node from its type (render-by-type) and **writes back** into the bound object: dragging a node rewrites its `x`/`y`, and drawing or removing an edge rewrites `connections` — you never hand-reconcile. **Add node** writes a fresh `graph` object and the wrapper reconciles it into the live editor with no remount. `zoom` is **two-way bound** with `v-model:zoom` — the readout tracks it as you scroll, and **Fit** drives the imperative handle (`zoomToFit()`), which echoes the new zoom back into the binding. Each node body is your own `<NodeType>`'s `#body` template, rendered per node through the reactive body portal. See the [full API](/components/rete) for the complete prop / event / handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/rete/src/FlowCanvas.rozie{html}[FlowCanvas.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/rete-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/rete/packages/react/src/FlowCanvas.tsx[React]
<<< ../../packages/ui/rete/packages/vue/src/FlowCanvas.vue[Vue]
<<< ../../packages/ui/rete/packages/svelte/src/FlowCanvas.svelte[Svelte]
<<< ../../packages/ui/rete/packages/angular/src/FlowCanvas.ts[Angular]
<<< ../../packages/ui/rete/packages/solid/src/FlowCanvas.tsx[Solid]
<<< ../../packages/ui/rete/packages/lit/src/FlowCanvas.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component with `model()` signals, a Solid component, and a Lit custom element. Same props, same events, same imperative handle, same render-by-type body portal, all from the one source above — and the engine (graph model, pan/zoom/drag, drag-to-connect) is Rete.js on every target.

The companion `<NodeType>` and `<Port>` type-template tags compile the same way:

::: code-group

<<< ../../packages/ui/rete/packages/vue/src/NodeType.vue[NodeType — Vue]
<<< ../../packages/ui/rete/packages/vue/src/Port.vue[Port — Vue]

:::

## Typed-socket connection validation

The canvas knows each `<NodeType>`'s port **types** (from the nested `<Port type>`
schema), so it can refuse a type-mismatched connection **automatically** — a `number`
output should not feed a `string` input. That is the **`validateTypes`** prop
(`:validate-types`, **default ON**): before any edge is committed the canvas resolves
each endpoint's port type from the type templates and rejects a mismatch — no path is
drawn, no `connection-created` fires — and a **`connection-rejected`** event reports the
attempt so you can surface it. (See the [`validateTypes` prop](/components/rete#props)
and the [`connection-rejected` event](/components/rete#events) rows in the API reference.)

For rules the type system can't express, **`canConnect`** is the optional custom-rule
**override** — a predicate `(conn) => boolean` that runs **in addition** to the automatic
typed check. Return `false` and the edge is rejected just the same (`connection-rejected`
fires). It gates **all** connection paths uniformly — drag-to-connect, the imperative
`addConnection()` handle, and the `graph.connections` reconcile — so one predicate
enforces your rules everywhere. Set `:validate-types="false"` to disable the automatic
check and treat `type` as metadata only (pure-`canConnect`).

### The typed data-pipeline demo

`examples/demos/FlowCanvasAdvancedDemo.rozie` is a small **typed data pipeline** that
puts the feature through its paces. Five nodes across four **types** — a `source` (BOTH a
number AND a string OUTPUT port, Dan's multi-port ask), a `numTx` (number → number), a
`strTx` (number → string), and a `merge` (BOTH a number AND a string INPUT port, both
`multiple`). The port **type** lives on each `<Port type>` declaration, so the canvas
validates connections itself — **no per-edge predicate needed for the common case**.
Typed ports render with color: **`number` ports blue** (`#3b82f6`), **`string` ports
green** (`#10b981`). The whole consumer is **one `r-model:graph` object + a handful of
type templates**:

```html
<FlowCanvas r-model:graph="$data.graph" :validate-types="true"
            :can-connect="canConnect" @connection-rejected="onReject">
  <!-- source: ONE type, BOTH a number AND a string OUTPUT port -->
  <NodeType type="source">
    <template #body="{ node }">{{ node.data.label }}</template>
    <Port output="num" type="number" label="number" />
    <Port output="str" type="string" label="string" />
  </NodeType>
  <!-- merge: ONE type, BOTH a number AND a string INPUT port (both multiple) -->
  <NodeType type="merge">
    <template #body="{ node }">Merge</template>
    <Port input="num" type="number" label="number" multiple />
    <Port input="str" type="string" label="string" multiple />
  </NodeType>
</FlowCanvas>
```

Drag a `number` output onto a `string` input and the connection is **rejected
automatically** by `:validate-types` (the canvas knows the port types): no edge appears,
the accepted-count stays put, and a live readout shows the attempted endpoints. Drag a
`number` output onto a `number` input and the edge commits — the canvas **writes it back**
into `$data.graph.connections` (the connection-count readout reflects it) and
`@connection-created` fires.

The demo also layers a tiny `canConnect` **override** on top of the automatic check — a
self-loop rule (`c.source !== c.target`) — proving a consumer rule runs **in addition** to
the typed validation. It is a **pure** predicate: it must NOT mutate `$data` or call any
engine method (it runs synchronously inside Rete's connectioncreate signal chain, where a
write risks engine re-entrancy). The rejected-types readout is written **only** in the
`@connection-rejected` handler — never inside `canConnect`:

```js
// PURE override — the optional custom rule, layered on the automatic typed check.
const canConnect = (c) => c.source !== c.target;

// SOLE writer of the rejected readout — the @connection-rejected handler.
const onReject = (c) => {
  const from = (c.source ?? '?') + ':' + (c.sourceOutput ?? '?');
  const to = (c.target ?? '?') + ':' + (c.targetInput ?? '?');
  $data.lastRejected = from + ' → ' + to;
};
```

> **Try it in the playground.** The demo is registered as `bundle/FlowCanvasAdvancedDemo`
> in the Rozie playground (`pnpm --filter rozie-playground dev`) — open the **Compare all
> targets** grid to see the same controlled-graph typed pipeline (and its port colors)
> rendered by all six frameworks side by side.

### Passing a function prop across all six targets

`canConnect` is a **function-typed prop** — a slightly different pattern from the
data-and-events props elsewhere in `@rozie-ui`. It binds idiomatically on every target;
the only one that needs care is **Lit**, where a function must go through a **property**
binding (a function cannot be serialized to an HTML attribute):

::: code-group

```tsx [React]
<FlowCanvas graph={graph} onGraphChange={setGraph} canConnect={canConnect} onConnectionRejected={onReject} />
```

```vue [Vue]
<FlowCanvas v-model:graph="graph" :can-connect="canConnect" @connection-rejected="onReject" />
```

```svelte [Svelte]
<FlowCanvas bind:graph canConnect={canConnect} on:connection-rejected={onReject} />
```

```html [Angular]
<rozie-flow-canvas [(graph)]="graph" [canConnect]="canConnect" (connectionRejected)="onReject($event)" />
```

```tsx [Solid]
<FlowCanvas graph={graph} onGraphChange={setGraph} canConnect={canConnect} onConnectionRejected={onReject} />
```

```ts [Lit]
// Function props MUST use a PROPERTY binding (the leading dot) — Lit cannot
// serialize a function to an attribute. The generated element declares the
// prop attribute:false so it is never reflected.
html`<rozie-flow-canvas .graph=${graph} .canConnect=${canConnect}
  @connection-rejected=${onReject}></rozie-flow-canvas>`
```

:::

Port colors are styled through the **`:root {}` engine-DOM escape hatch** (the node chrome
teleports into the engine-created node element, which on Lit lives inside the custom
element's shadow root — a plain scoped rule never reaches it). That is the same escape
hatch the [styling note](/components/rete) describes for engine-rendered DOM.

### Per-node actions

Each `<NodeType>`'s `#body` template carries a **✕ remove** button. The demo drives it
with a **top-level `@pointerup` handler** that reads the node id off a `:data-id` attribute
bind (`e.target.closest('[data-id]')`) and filters it out of `$data.graph.nodes` into a
**fresh graph object** assigned back to `$data.graph` (controlled-model remove — the
canvas reconciles the engine node away) — a pattern that works on all six targets
including Solid. (`@pointerup` rather than `@click` because Rete starts a node-drag on
pointer-down and the browser never synthesizes a `click` from the drag gesture; and
`@pointerup` over `@pointerdown` because Rete's drag handler `stopPropagation`s pointerdown
at the node element, which on Solid's delegated handler blocks it.) Separately,
`FlowCanvas` also offers a built-in **`node-action`** emit: a `#body` fill can call its
`emit(name, detail)` helper to raise `@node-action` with the node id, which is the
idiomatic route for in-node buttons that want a typed event round-trip. This demo's ✕
deliberately takes the DOM-attribute route instead (the slot-scope `emit`/`node` are not
accessor-rewritten inside an `@event` body on Solid — the foreign-slot accessor
limitation), but `node-action` remains a first-class capability for consumers who want it.

## See also

- [FlowCanvas — showcase & API](/components/rete) — install, quick starts for all six frameworks, the controlled `r-model:graph` binding, the `<NodeType>` / `<Port>` type templates, the events, the two-way zoom binding, and the imperative handle.
- [Node-flow editor libraries comparison](/components/rete-comparison) — how `@rozie-ui/rete` stacks up against React Flow / Vue Flow / Svelte Flow / Foblex (and the Solid / Lit gap it closes).

<style scoped>
.flow-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.flow-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.flow-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.flow-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.flow-live__controls button.flow-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.flow-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.flow-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  overflow: hidden;
}
.flow-live__node {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--vp-c-text-1);
}
.flow-live__node[data-kind="in"] strong { color: #047857; }
.flow-live__node[data-kind="out"] strong { color: #b91c1c; }
.flow-live__node.is-selected { background: rgba(59, 130, 246, 0.1); }
.flow-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
</style>
