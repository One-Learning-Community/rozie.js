---
surface_hash: fdf504a945a4
---

# Node-flow editor libraries comparison

How `@rozie-ui/rete` (`FlowCanvas`) compares to the existing per-framework node-flow / graph editor libraries. A node editor's hard parts — the graph model, viewport pan/zoom, node drag, and drag-to-connect — are inherently framework-agnostic; [Rete.js v2](https://retejs.org/) is the engine that owns all of them and delegates only *rendering* to a swappable layer. The per-framework editors each re-solve those hard parts from scratch, which is why the ecosystem is **siloed**: React and Svelte are well-served, Vue has a separate reimplementation, Angular has a couple of options, and **Solid has only an experiment while Lit has nothing**. Rozie ships one source to all six by wrapping the agnostic engine with a single vanilla render layer.

> Research snapshot: 2026-06-08. Versions and the landscape move; treat them as of that date. The full audit is in [`node-flow-editor-feasibility.md`](https://github.com/One-Learning-Community/rozie.js/blob/main/.planning/research/node-flow-editor-feasibility.md).

## The libraries at a glance

| Library | Package | Frameworks | Rendering | State model | Verdict |
| --- | --- | --- | --- | --- | --- |
| **React Flow** | `@xyflow/react` | **React only** | SVG edges + DOM nodes | internal Zustand store | mature, deep — the category leader on React |
| **Svelte Flow** | `@xyflow/svelte` | **Svelte only** | SVG + DOM | Svelte 5 runes | mature; shares `@xyflow/system` core with React Flow |
| **Vue Flow** | `@vue-flow/core` | **Vue only** | SVG + DOM | own Vue store | mature, but a **separate** codebase — not xyflow's shared core |
| **Foblex Flow** | `@foblex/flow` | **Angular only** | DOM + SVG | Angular signals | active; Angular-only |
| **ngx-graph** | `@swimlane/ngx-graph` | **Angular only** | SVG (D3 + dagre) | RxJS | graph-viz-first, less an interactive editor |
| **solid-flow** | `solid-flow` | Solid | SVG + DOM | signals | **single-author experiment**, not production-grade |
| **Lit** | — | — | — | — | **no standalone library exists** |
| **Rozie** | `@rozie-ui/rete-*` | **all 6** | DOM + SVG (vanilla render layer) | Rete `NodeEditor` (the engine owns it) | one source → React/Vue/Svelte/Angular/Solid/Lit |

The big-framework editors above are **excellent, mature libraries** — for a single-React app, React Flow is the obvious pick, and Rozie does not claim to out-feature it on its home framework. The wedge is breadth: **no single library ships all six**, and two targets are essentially unserved. xyflow — the strongest brand — publishes only `@xyflow/react` and `@xyflow/svelte` (its shared `@xyflow/system` core has **no** Vue/Solid/Angular/Lit wrapper); Vue Flow is a wholly separate project; **Solid** has only a single-author `solid-flow` experiment; and **Lit / web-components has nothing at all**. The one ecosystem that even approaches breadth is **Rete.js**, whose render plugins cover React/Vue/Angular/Svelte/Lit — five divergent codebases, and still no Solid. Rozie replaces those five plugins with **one `.rozie` source and one vanilla render layer**, and adds the missing Solid (and a far thinner Lit) for free.

## Why wrap Rete.js

A Rete render plugin's only job is to (a) fill each engine-created node element with DOM, (b) draw each connection's SVG path, and (c) tell the connection plugin where the sockets are. The official plugins do (a)+(b) with a framework's component tree — that *is* the per-framework coupling. `FlowCanvas` does all three with a **vanilla render pipe** (`area.addPipe`), emitting `render` socket signals the `ConnectionPlugin` + `getDOMSocketPosition` watcher consume, and drawing connection paths with `classicConnectionPath`. The engine (`NodeEditor` + `AreaPlugin` + `ConnectionPlugin`) owns graph state and all pointer interaction; the Rozie component is a thin view over it, so the same source behaves identically on every target.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / experimental / consumer-glue-required.

| Capability | React Flow | Vue Flow | Svelte Flow | Foblex (Angular) | solid-flow | Lit (none) | **`@rozie-ui/rete`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount canvas | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ |
| Pan / zoom viewport | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ (engine-owned) |
| Node drag | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ (engine-owned) |
| **Drag-to-connect** (sockets) | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ (socket render-signal bridge) |
| **Custom node bodies** (framework component) | ✅ node types | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ render-by-type `#body` portal (all 6) |
| **Node TYPE templates** (declare once, render-by-type) | ✅ `nodeTypes` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ `<NodeType type>` + nested `<Port>` |
| **Controlled graph** (bound state, canvas writes back) | ✅ `nodes`/`edges` + `onNodesChange` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ one `r-model:graph` (write-back on drag/connect) |
| **Typed-socket validation** (auto-reject mismatch) | ⚠️ consumer-glue | ⚠️ | ⚠️ | ⚠️ | ⚠️ | hand-roll | ✅ `:validate-types` from `<Port type>` + `canConnect` override |
| Two-way zoom binding | ⚠️ controlled | ⚠️ | ⚠️ | ⚠️ | ⚠️ | hand-roll | ✅ `r-model:zoom` (echo-guarded) |
| Graph events (moved / connected / picked) | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ 8 structured events |
| Imperative handle | ✅ `useReactFlow` | ✅ `useVueFlow` | ✅ | ✅ service | ⚠️ | hand-roll | ✅ uniform 26-verb `$expose` |
| Selection surfaced + cascading delete | ✅ `onSelectionChange` / `deleteElements` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `@selection-change` + `deleteNode` verb / Delete key |
| Direction arrowheads | ✅ `markerEnd` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ per-edge SVG `marker-end` |
| **Controls** overlay (zoom / fit) | ✅ `<Controls/>` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ built-in (`:controls`, opt-out) |
| **MiniMap** (measured nodes + pannable) | ✅ `<MiniMap/>` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ built-in (`:minimap`, opt-in) — all 6 incl. Lit/Solid |
| Viewport API (`setCenter` / `setViewport`) | ✅ `useReactFlow` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `setCenter` / `setViewport` verbs |
| **Palette drag-drop** (`screenToFlowPosition`) | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `screenToFlowPosition` verb |
| **Handle positioning** (top/bottom) | ✅ `<Handle position>` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `<Port position="top\|bottom\|left\|right">` |
| **Edge labels + per-edge styling** | ✅ `edge.label` / `style` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `connection.label` / `stroke` / `dashed` |
| Custom edge RENDERING (step/smooth/bezier types) | ✅ `edgeTypes` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ bezier only (deferred) |
| Background variants / NodeToolbar / NodeResizer | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ deferred (see below) |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| Zero-config styling, re-skinnable | ⚠️ import CSS + vars | ⚠️ | ⚠️ | ⚠️ | ⚠️ | hand-roll | ✅ `--rozie-flow-*` tokens + shadcn/Material/Bootstrap bridges + opt-in dark |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the two frameworks the ecosystem leaves out entirely: **Solid** (only a single-author experiment) and **Lit** (nothing). Those consumers get a real node editor they otherwise cannot have, from the same source that produces the four big-framework packages.
- **A controlled-graph authoring model on all six** — the consumer binds **one `r-model:graph` object** and declares a couple of **`<NodeType type>` templates** (each with a `#body` and a typed `<Port>` schema); the canvas renders every node by its type and **writes layout + connections back** into the bound object, so there is no hand-reconciling. It is the xyflow `nodeTypes` + controlled-state mental model, Vue-natural — and it is the *same* model on Solid and Lit, which have no such library at all.
- **Framework-native node bodies on all six** — each `<NodeType>`'s `#body` is a **reactive multi-instance portal**: one handle mounts per graph node of that type, rendering a real framework fragment (any component, any reactivity), re-rendered in place as the node's data / selection changes.
- **Automatic typed-socket validation on all six** — port `type` lives on the `<Port>` schema, so the canvas auto-rejects type-mismatched connections (`:validate-types`, default on) with `canConnect` as the optional custom-rule override — a feature the standalone editors leave to consumer glue.
- **The engine owns interaction, so behavior is identical by construction** — pan/zoom transform, node drag, edge drawing, and connection-handle hit-testing all live in Rete's `AreaPlugin` + `ConnectionPlugin`. Rozie never re-implements pointer math per target, so there is no cross-framework drift in *how the editor feels*.
- **Built-in chrome on all six** — a **Controls** overlay (zoom in / out / fit, opt out with `:controls="false"`) and an opt-in **MiniMap** (`:minimap="true"`): an SVG overview that maps every node at its **measured** size + the current viewport window (outside dimmed) and is **pannable** (drag to recenter via `setCenter`). React Flow ships `<Controls/>` / `<MiniMap/>` only on React; here Solid and Lit — which have no node editor at all — get them too, pixel-identical.
- **Workflow-builder essentials on all six** — **palette drag-drop** (`screenToFlowPosition` projects a drop point to graph coords so a sidebar item lands under the pointer), **top/bottom handle positioning** (`<Port position>` for vertical flows — decision trees, top-down pipelines), and **labeled / styled edges** (`connection.label` / `stroke` / `dashed` for conditional edges). The interactions that actually define a no-code / workflow builder, idiomatic on Solid and Lit too.
- **A uniform 26-verb imperative handle** (`getEditor` / `getArea` / `addNode` / `removeNode` / `deleteNode` / `addConnection` / `removeConnection` / `clear` / `clearSelection` / `selectAll` / `selectNode` / `getSelectedNodes` / `centerOnNode` / `autoArrange` / `undo` / `redo` / `canUndo` / `canRedo` / `zoomToFit` / `zoomTo` / `setCenter` / `setViewport` / `screenToFlowPosition` / `getNodes` / `getConnections` / `getTransform`) grabbed with each framework's native ref — versus "however this library happens to expose its instance" (a hook, a service, a ref).
- **`getEditor()` / `getArea()` are always one hop from the raw engine**, so the full Rete API (custom plugins, `rete-engine` dataflow, `rete-auto-arrange-plugin`, …) is reachable on any target when the curated surface doesn't cover something.
- **Zero-config styling that re-skins to any design system.** Rete ships *no* stylesheet, so the incumbents leave node / socket / connection chrome to consumer CSS. `@rozie-ui/rete` styles every value as a `--rozie-flow-*` CSS custom property with a built-in fallback — it looks right on drop-in, yet one `--rozie-flow-accent` override recolors every selection cue, and ready-made `themes/{base,shadcn,material,bootstrap}.css` bridges map it onto a design system. `themes/base.css` also adds dark mode (OS `prefers-color-scheme` **and** app-toggled `.dark`), reaching Lit's shadow DOM too. Same tokens on all six targets.

## The controlled-graph + `<NodeType>` / `<Port>` model {#controlled-graph}

`FlowCanvas` follows the **controlled-graph** mental model (xyflow's `nodeTypes` +
controlled `nodes`/`edges`, made Vue-natural with `r-model`): the consumer binds **one
`graph` object** and declares node **TYPE templates** — nothing more. The canvas is the
middleware: it renders each node by its `type` (render-by-type), owns drag / zoom / connect
/ validation, and **writes layout (`x`/`y` on drag) and connections (on connect /
disconnect) back** into the bound object, so the developer never hand-reconciles.

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

with `$data.graph = { nodes: [{ id, type, x, y, data }], connections: [...] }` — the
**single source of truth**.

- **`<NodeType type>` declares a node TYPE once** (a `#body` template scoped `{ node, selected, emit }` + a nested `<Port>` schema). Every graph node whose `type` matches renders this template; a `<NodeType>` has **no** `id`/`x`/`y` — instance identity + position live in the bound `graph`, not on the tag. This cleanly separates "what a `source` looks like" from "this source exists at x,y" — the disjoint the old instance-children model (`<FlowNode id>`) conflated.
- **`<Port output=|input= type= [multiple]>` declares one typed directional port** on its `<NodeType>`. Direction is the attribute name (`output` / `input`); `type` drives automatic validation. _(The attrs are `input`/`output`, not `in`/`out` — `in` is a JS reserved word that the Svelte `$props()` destructure rejects.)_
- **Edges live ONLY in `graph.connections`.** There is no flat `<Connection>` child — drawing or removing an edge writes a fresh `connections` array back through the `graph` model.

**Why the node body is a named `#body` slot, not bare children.** A node body has to *teleport* into the node element the Rete engine creates — it doesn't render in the normal component tree. Rozie mounts that body through a portal (`$portals.body`), which gives it a fresh framework render-root inside the engine-owned host. But a portal render-root has no tree ancestor, so context-consuming children placed inside it would not resolve their `$inject` on five of six targets (context is tree-scoped on React/Vue/Svelte/Solid/Lit). Separating the teleported body (`<template #body>`) from the context-consuming `<Port>` children (which stay in the normal child position) is therefore the robust cross-framework shape: the body teleports, the ports keep their tree scope and inject correctly. Verified behaviorally across all six targets (including the Angular real-build).

This was built by dogfooding Rozie's own cross-component context primitive (`$provide` / `$inject`): `<FlowCanvas>` provides a per-TYPE registry, `<NodeType>` provides a nested per-type sub-context, and `<Port>` injects it.

## What Rozie defers {#what-rozie-defers}

This page concedes where the standalone libraries are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's roadmap.

- **Background variants / NodeToolbar / NodeResizer.** React Flow ships these as first-class components. `FlowCanvas` now covers the canvas + nodes + sockets + connections + a dotted background + a built-in **Controls** overlay + an opt-in **MiniMap**; the remaining second-tier chrome (background variants, node toolbar, node resizer) is on the roadmap (config-prop first, the MapLibre stance).
- **Big-framework depth on the home framework.** React Flow (Zustand store, deep node/edge-type catalogs, helper hooks, layouting integrations) is a mature, multi-year library; on React it exposes more surface than Rozie's curated set. Rozie's value is **not** "more than React Flow on React" — it's the **same idiomatic editor on all six frameworks from one source**, with the unserved **Solid and Lit** finally covered.
- **`@rozie-ui/rete` is `0.1.0`.** The surface (20 props / 12 events / 26-verb handle / `<NodeType>` render-by-type body portal + typed `<Port>` schema with top/bottom positioning + built-in Controls & MiniMap + labeled/styled edges + palette drag-drop) is stable and gate-verified (behavioral parity across all six targets), but it is younger than the incumbents.

## Try it

The [`@rozie-ui/rete` showcase + API reference](/components/rete) documents the `@rozie-ui/rete-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/rete-react rete rete-area-plugin rete-connection-plugin rete-render-utils`, etc.). Rete ships no stylesheet, and there is **no engine CSS to import** — all node / socket / connection chrome ships scoped and fully-tokenised inside the component. Every rendered value is a `--rozie-flow-*` custom property with an inline fallback, so it works zero-config yet re-skins by overriding a token; opt into dark mode or a design-system look with a one-line `themes/{base,shadcn,material,bootstrap}.css` import.

## Cross-references

- [FlowCanvas — showcase & API](/components/rete) — the full `@rozie-ui/rete` surface, quick starts, and the `<NodeType>` / `<Port>` type-template recipe.
- [`FlowCanvas.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/src/FlowCanvas.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `<NodeType>` `#body` render-by-type portal builds on.
