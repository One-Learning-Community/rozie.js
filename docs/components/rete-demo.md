---
title: FlowCanvas — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import FlowCanvas from '@rozie-ui/rete-vue';

// A small, fixed graph. `nodes` / `connections` are plain config arrays — the
// same shape that compiles to all six frameworks. Each node declares its
// input/output socket keys; connections reference nodes + socket keys by id.
const INITIAL_NODES = [
  { id: 'input',  label: 'Input',     x: 20,  y: 40,  data: { kind: 'in' },  outputs: [{ key: 'out', label: 'value' }] },
  { id: 'filter', label: 'Transform', x: 280, y: 40,  data: { kind: 'op' },  inputs: [{ key: 'in', label: 'in' }], outputs: [{ key: 'out', label: 'out' }] },
  { id: 'output', label: 'Output',    x: 540, y: 140, data: { kind: 'out' }, inputs: [{ key: 'in', label: 'result' }] },
];
const INITIAL_EDGES = [
  { id: 'e1', source: 'input',  sourceOutput: 'out', target: 'filter', targetInput: 'in' },
  { id: 'e2', source: 'filter', sourceOutput: 'out', target: 'output', targetInput: 'in' },
];

const flow = ref();
const zoom = ref(1);
const nodes = ref(INITIAL_NODES.map((n) => ({ ...n })));
const connections = ref(INITIAL_EDGES.map((e) => ({ ...e })));
let next = 1;

function addNode() {
  const id = 'n' + next++;
  nodes.value = [
    ...nodes.value,
    { id, label: 'Node ' + id, x: 120 + nodes.value.length * 24, y: 240, data: { kind: 'op' }, inputs: [{ key: 'in' }], outputs: [{ key: 'out' }] },
  ];
}
function reset() {
  next = 1;
  nodes.value = INITIAL_NODES.map((n) => ({ ...n }));
  connections.value = INITIAL_EDGES.map((e) => ({ ...e }));
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
      :nodes="nodes"
      :connections="connections"
      v-model:zoom="zoom"
      style="width: 100%; height: 380px;"
    >
      <template #node="{ node, selected }">
        <div class="flow-live__node" :class="{ 'is-selected': selected }" :data-kind="node.data?.kind">
          <strong>{{ node.label }}</strong>
        </div>
      </template>
    </FlowCanvas>
  </div>

  <div class="flow-live__readout">
    <code>{{ nodes.length }} nodes · {{ connections.length }} connections · zoom {{ zoom.toFixed(2) }}</code>
  </div>
</div>
</ClientOnly>

The graph is a pair of plain config arrays (`:nodes` / `:connections`); **Add node** pushes onto `nodes` and the wrapper reconciles it into the live editor with no remount. `zoom` is **two-way bound** with `v-model:zoom` — the readout tracks it as you scroll, and **Fit** drives the imperative handle (`zoomToFit()`), which echoes the new zoom back into the binding. Each node body is your own `<template #node>` fragment, rendered per node through the reactive `node` portal slot. See the [full API](/components/rete) for the complete prop / event / handle surface.

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

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component with `model()` signals, a Solid component, and a Lit custom element. Same props, same 7 events, same 12-verb imperative handle, same reactive `node` portal slot, all from the one source above — and the engine (graph model, pan/zoom/drag, drag-to-connect) is Rete.js on every target.

## Typed-socket connection validation

The graph above lets **any** socket connect to any other. Real node editors usually
need rules — a `number` output should not feed a `string` input. `FlowCanvas` gives
you that with a single prop: **`canConnect`**, a connection-validation predicate that
runs before any edge is committed. Return `false` and the edge is rejected — no path
is drawn, no `connection-created` fires — and a **`connection-rejected`** event reports
the attempt so you can surface it. (See the [`canConnect` prop](/components/rete#props)
and the [`connection-rejected` event](/components/rete#events) rows in the API reference.)

`canConnect` gates **all three** connection paths uniformly — drag-to-connect, the
imperative `addConnection()` handle, and the config-array `connections` reconcile — so
one predicate enforces your rules everywhere. When the prop is absent or `null`, every
connection is allowed exactly as before (it is fully back-compatible).

### The typed data-pipeline demo

`examples/demos/FlowCanvasAdvancedDemo.rozie` is a small **typed data pipeline** that
puts the feature through its paces. Five nodes — a Number Source, a Text Source, a Math
transform, a Format transform, and a multi-input Merge — each carry a port **type tag**
(`number` or `string`) in their `data`. Typed ports render with color: **`number` ports
blue** (`#3b82f6`), **`string` ports green** (`#10b981`). The rule is **same-type-only**:

```js
// Each node carries data.portTypes keyed by port key ('out' / 'in').
const typeOf = (nodeId, key) => {
  const n = $data.nodes.find((x) => x.id === nodeId);
  return n?.data?.portTypes?.[key];
};

// PURE predicate — resolves the source-output type and the target-input type
// from the node model and allows only a same-type match. It must NOT mutate
// $data or call any engine method: it runs synchronously inside Rete's
// connectioncreate signal chain, where a write risks engine re-entrancy.
const canConnect = (c) => {
  const srcT = typeOf(c.source, c.sourceOutput);
  const tgtT = typeOf(c.target, c.targetInput);
  return srcT != null && srcT === tgtT;
};
```

Drag a `number` output onto a `string` input and the connection is **rejected**: no edge
appears, the accepted-count stays put, and a live readout shows the attempted types
(e.g. `number → string`). Drag a `number` output onto a `number` input and the edge
commits and the count climbs. The rejected-types readout is written **only** in the
`@connection-rejected` handler — never inside `canConnect` — so the predicate stays
pure (and programmatic-reconcile rejections never spuriously update the user-facing
readout):

```js
// SOLE writer of the rejected readout — the @connection-rejected handler.
const onReject = (c) => {
  const srcT = typeOf(c.source, c.sourceOutput);
  const tgtT = typeOf(c.target, c.targetInput);
  $data.lastRejected = (srcT ?? '?') + ' → ' + (tgtT ?? '?');
};
```

> **Try it in the playground.** The demo is registered as `bundle/FlowCanvasAdvancedDemo`
> in the Rozie playground (`pnpm --filter rozie-playground dev`) — open the **Compare all
> targets** grid to see the same typed pipeline (and its port colors) rendered by all six
> frameworks side by side.

### Passing a function prop across all six targets

`canConnect` is a **function-typed prop** — a slightly different pattern from the
data-and-events props elsewhere in `@rozie-ui`. It binds idiomatically on every target;
the only one that needs care is **Lit**, where a function must go through a **property**
binding (a function cannot be serialized to an HTML attribute):

::: code-group

```tsx [React]
<FlowCanvas nodes={nodes} canConnect={canConnect} onConnectionRejected={onReject} />
```

```vue [Vue]
<FlowCanvas :nodes="nodes" :can-connect="canConnect" @connection-rejected="onReject" />
```

```svelte [Svelte]
<FlowCanvas {nodes} canConnect={canConnect} on:connection-rejected={onReject} />
```

```html [Angular]
<rozie-flow-canvas [nodes]="nodes" [canConnect]="canConnect" (connectionRejected)="onReject($event)" />
```

```tsx [Solid]
<FlowCanvas nodes={nodes} canConnect={canConnect} onConnectionRejected={onReject} />
```

```ts [Lit]
// Function props MUST use a PROPERTY binding (the leading dot) — Lit cannot
// serialize a function to an attribute. The generated element declares the
// prop attribute:false so it is never reflected.
html`<rozie-flow-canvas .nodes=${nodes} .canConnect=${canConnect}
  @connection-rejected=${onReject}></rozie-flow-canvas>`
```

:::

Port colors are styled through the **`:root {}` engine-DOM escape hatch** (the node chrome
teleports into the engine-created node element, which on Lit lives inside the custom
element's shadow root — a plain scoped rule never reaches it). That is the same escape
hatch the [styling note](/components/rete) describes for engine-rendered DOM.

### Per-node actions

Each node body also carries a **✕ remove** button. The demo drives it with a
**top-level `@pointerup` handler** that reads the node id off a `:data-id` attribute bind
(`e.target.closest('[data-id]')`) and filters it out of `$data.nodes` — a pattern that
works on all six targets including Solid. (`@pointerup` rather than `@click` because Rete
starts a node-drag on pointer-down and the browser never synthesizes a `click` from the
drag gesture.) Separately, `FlowCanvas` also offers a built-in **`node-action`** emit:
a `node` slot fill can call its `emit(name, detail)` helper to raise `@node-action` with
the node id, which is the idiomatic route for in-node buttons that want a typed event
round-trip. This demo's ✕ deliberately takes the DOM-attribute route instead, but
`node-action` remains a first-class capability for consumers who want it.

## See also

- [FlowCanvas — showcase & API](/components/rete) — install, quick starts for all six frameworks, the events, the two-way zoom binding, the imperative handle, and the `node` slot.
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
