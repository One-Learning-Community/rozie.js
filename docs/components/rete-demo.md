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
