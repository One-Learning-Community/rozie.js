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
| **Custom node bodies** (framework component) | ✅ node types | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ `node` reactive portal slot (all 6) |
| Two-way zoom binding | ⚠️ controlled | ⚠️ | ⚠️ | ⚠️ | ⚠️ | hand-roll | ✅ `r-model:zoom` (echo-guarded) |
| Graph events (moved / connected / picked) | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ 7 structured events |
| Imperative handle | ✅ `useReactFlow` | ✅ `useVueFlow` | ✅ | ✅ service | ⚠️ | hand-roll | ✅ uniform 12-verb `$expose` |
| Config-array graph (`:nodes` / `:connections`) | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ reconciled live, no remount |
| MiniMap / Background / Controls | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ deferred (see below) |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the two frameworks the ecosystem leaves out entirely: **Solid** (only a single-author experiment) and **Lit** (nothing). Those consumers get a real node editor they otherwise cannot have, from the same source that produces the four big-framework packages.
- **Framework-native node bodies on all six** — the `node` **reactive multi-instance portal slot** renders a real framework fragment (any component, any reactivity) as a graph node, re-rendered in place as the node's data / selection changes, reconciled off the `nodes` data array.
- **The engine owns interaction, so behavior is identical by construction** — pan/zoom transform, node drag, edge drawing, and connection-handle hit-testing all live in Rete's `AreaPlugin` + `ConnectionPlugin`. Rozie never re-implements pointer math per target, so there is no cross-framework drift in *how the editor feels*.
- **A uniform 12-verb imperative handle** (`getEditor` / `getArea` / `addNode` / `removeNode` / `addConnection` / `removeConnection` / `clear` / `zoomToFit` / `zoomTo` / `getNodes` / `getConnections` / `getTransform`) grabbed with each framework's native ref — versus "however this library happens to expose its instance" (a hook, a service, a ref).
- **`getEditor()` / `getArea()` are always one hop from the raw engine**, so the full Rete API (custom plugins, `rete-engine` dataflow, `rete-auto-arrange-plugin`, …) is reachable on any target when the curated surface doesn't cover something.

## What Rozie defers {#what-rozie-defers}

This page concedes where the standalone libraries are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's roadmap.

- **Declarative `<Node>` / `<Edge>` *children*.** React Flow et al. let you compose a graph as JSX/children with per-type node components registered up front. Rozie v1 takes a different authoring shape: the **`:nodes` / `:connections` config-array props** (reconciled into the live editor), with per-node bodies supplied through the `node` slot. It is the **same `addNode` / `addConnection` runtime** and reaches the same result, but the authoring model is a config array, not nested children. True declarative graph children — deeply-nested `<Node>`/`<Handle>` elements reading shared graph state (selection, viewport, neighbors) without prop-drilling — need a **cross-component context primitive** that Rozie deliberately defers (the same primitive MapLibre's `:sources` / `:layers` deferral is waiting on). The wrap-a-vanilla-engine strategy sidesteps it entirely: the **engine** owns the store, and node bodies reach it through portal scope.
- **MiniMap / Background variants / NodeToolbar / NodeResizer.** React Flow ships these as first-class components. `FlowCanvas` v1 covers the canvas + nodes + sockets + connections + a dotted background; the second-tier chrome is on the roadmap (config-prop first, the MapLibre stance).
- **Big-framework depth on the home framework.** React Flow (Zustand store, deep node/edge-type catalogs, helper hooks, layouting integrations) is a mature, multi-year library; on React it exposes more surface than Rozie's curated set. Rozie's value is **not** "more than React Flow on React" — it's the **same idiomatic editor on all six frameworks from one source**, with the unserved **Solid and Lit** finally covered.
- **`@rozie-ui/rete` is `0.1.0`.** The surface (13 props / 7 events / 12-verb handle / `node` reactive slot) is stable and gate-verified (behavioral parity across all six targets), but it is younger than the incumbents.

## Try it

The [`@rozie-ui/rete` showcase + API reference](/guide/rete) documents the `@rozie-ui/rete-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/rete-react rete rete-area-plugin rete-connection-plugin rete-render-utils`, etc.). Rete ships no stylesheet, so there is no engine CSS to import — all node / socket / connection chrome is styled by the component.

## Cross-references

- [FlowCanvas — showcase & API](/guide/rete) — the full `@rozie-ui/rete` surface, quick starts, and the `node` slot recipe.
- [`FlowCanvas.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/src/FlowCanvas.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `node` reactive slot builds on.
