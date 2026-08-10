---
surface_hash: 0af9f90c05e2
---

# Node-flow editor libraries comparison

How `@rozie-ui/rete` (`FlowCanvas`) compares to the existing per-framework node-flow / graph editor libraries. A node editor's hard parts — the graph model, viewport pan/zoom, node drag, and drag-to-connect — are inherently framework-agnostic; [Rete.js v2](https://retejs.org/) is the engine that owns all of them and delegates only *rendering* to a swappable layer. The per-framework editors each re-solve those hard parts from scratch, which is why the ecosystem is siloed: React and Svelte are well-served, Vue has a separate reimplementation, Angular has a couple of options, and Solid has only an experiment while Lit has nothing. Rozie wraps the agnostic engine with a single vanilla render layer and delivers the same idiomatic `<FlowCanvas>`, with the same graph model, events, and handle, on all six frameworks as pre-compiled per-framework packages.

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
| **Rozie** | `@rozie-ui/rete-*` | **all 6** | DOM + SVG (vanilla render layer) | Rete `NodeEditor` (the engine owns it) | same API on React/Vue/Svelte/Angular/Solid/Lit |

On its home framework each of these is a solid pick; for a single-React app, React Flow is the obvious choice. The case for Rozie is breadth: no single library ships all six frameworks, and two targets are essentially unserved. xyflow, the strongest brand, publishes only `@xyflow/react` and `@xyflow/svelte` (its shared `@xyflow/system` core has no Vue/Solid/Angular/Lit wrapper); Vue Flow is a wholly separate project; Solid has only a single-author `solid-flow` experiment; and Lit / web components have nothing at all. The one ecosystem that even approaches breadth is Rete.js, whose render plugins cover React/Vue/Angular/Svelte/Lit in five divergent codebases, still with no Solid. `@rozie-ui/rete` covers all six with one API, including Solid and Lit.

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
| Imperative handle | ✅ `useReactFlow` | ✅ `useVueFlow` | ✅ | ✅ service | ⚠️ | hand-roll | ✅ uniform `$expose` handle |
| Selection surfaced + cascading delete | ✅ `onSelectionChange` / `deleteElements` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `@selection-change` + `deleteNode` verb / Delete key |
| Direction arrowheads | ✅ `markerEnd` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ per-edge SVG `marker-end` |
| **Controls** overlay (zoom / fit) | ✅ `<Controls/>` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ built-in (`:controls`, opt-out) |
| **MiniMap** (measured nodes + pannable) | ✅ `<MiniMap/>` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ built-in (`:minimap`, opt-in) — all 6 incl. Lit/Solid |
| Viewport API (`setCenter` / `setViewport`) | ✅ `useReactFlow` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `setCenter` / `setViewport` verbs |
| **Palette drag-drop** (`screenToFlowPosition`) | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `screenToFlowPosition` verb |
| **Handle positioning** (top/bottom) | ✅ `<Handle position>` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `<Port position="top\|bottom\|left\|right">` |
| **Edge labels + per-edge styling** | ✅ `edge.label` / `style` | ✅ | ✅ | ⚠️ | ⚠️ | hand-roll | ✅ `connection.label` / `stroke` / `dashed` |
| Custom edge RENDERING (step/smooth/bezier types) | ✅ `edgeTypes` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ `edgeTypes` (step/smoothstep/straight/bezier) |
| **Background variants** (dots/lines/cross/none) | ✅ `<Background variant>` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ `:background` prop |
| **NodeToolbar** (per-node contextual actions) | ✅ `<NodeToolbar/>` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ `#toolbar` slot (opt-in) |
| **NodeResizer** (drag-to-resize) | ✅ `<NodeResizer/>` | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ `<NodeType resizable>` corner handles |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| Zero-config styling, re-skinnable | ⚠️ import CSS + vars | ⚠️ | ⚠️ | ⚠️ | ⚠️ | hand-roll | ✅ `--rozie-flow-*` tokens + shadcn/Material/Bootstrap bridges + zero-import dark |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **First-class packages for all six frameworks**, including the two the ecosystem leaves out entirely: Solid (only a single-author experiment) and Lit (nothing).
- **A controlled-graph model with the same API everywhere.** The consumer binds one `r-model:graph` object and declares `<NodeType type>` templates, each with a `#body` and a typed `<Port>` schema; the canvas renders every node by its type and writes layout and connections back into the bound object, so there is no hand-reconciling. Node bodies are real framework fragments (any component, any reactivity) mounted per node and re-rendered as data / selection changes, and typed-socket validation auto-rejects mismatched connections (`:validate-types`, default on; `canConnect` overrides). The full [`<NodeType>` / `<Port>` recipe lives on the showcase page](/components/rete).
- **The engine owns interaction, so behavior is identical by construction.** Pan/zoom transform, node drag, edge drawing, and connection-handle hit-testing all live in Rete's `AreaPlugin` + `ConnectionPlugin`. Rozie never re-implements pointer math per target, so there is no cross-framework drift in how the editor feels.
- **Built-in chrome and workflow essentials on all six.** A Controls overlay (zoom in / out / fit), an opt-in MiniMap (measured node overview, pannable viewport window), palette drag-drop (`screenToFlowPosition` projects a drop point to graph coords), top/bottom port positioning for vertical flows, and labeled / styled edges (`connection.label` / `stroke` / `dashed`). React Flow ships its `<Controls/>` / `<MiniMap/>` only on React; here Solid and Lit get them too.
- **A uniform imperative handle, one hop from the raw engine.** Node, connection, selection, viewport, and history verbs (`addNode`, `deleteNode`, `duplicateNode`, `undo` / `redo`, `zoomToFit`, `screenToFlowPosition`, and more) come through each framework's native ref, and `getEditor()` / `getArea()` expose the full Rete API (custom plugins, `rete-engine` dataflow, `rete-auto-arrange-plugin`, …) when the curated surface doesn't cover something. The full handle table is in the [API reference](/components/rete).
- **Zero-config styling that re-skins to any design system.** Rete ships no stylesheet, so the incumbents leave node / socket / connection chrome to consumer CSS. `@rozie-ui/rete` styles every value as a `--rozie-flow-*` CSS custom property with a built-in fallback; one `--rozie-flow-accent` override recolors every selection cue, ready-made `themes/{base,shadcn,material,bootstrap}.css` bridges map it onto a design system, and dark mode works with zero import (a built-in `prefers-color-scheme` default on all six, Lit included).

## What Rozie defers {#what-rozie-defers}

- **NodeResizer aspect-ratio lock, plus assorted second-tier chrome.** NodeResizer is free-form width/height only; a `keepAspectRatio` lock is deferred out of v1. Also still deferred: subflows/grouping, copy/paste across canvases, export-to-PNG/SVG, controlled selection (bound selected-ids), and per-node locked/draggable/deletable flags.
- **Big-framework depth on the home framework.** React Flow (Zustand store, deep node/edge-type catalogs, helper hooks, layouting integrations) is a mature, multi-year library; on React it exposes more surface than Rozie's curated set. Rozie's value is the same idiomatic editor on all six frameworks, including the otherwise unserved Solid and Lit.
- **`@rozie-ui/rete` is pre-1.0.** The surface is stable and gate-verified with behavioral parity across all six targets, but it is younger than the multi-year incumbents. The full prop, event, and handle tables live in the [showcase + API reference](/components/rete).

## Try it

The [`@rozie-ui/rete` showcase + API reference](/components/rete) documents the `@rozie-ui/rete-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/rete-react rete rete-area-plugin rete-connection-plugin rete-render-utils`, etc.). Rete ships no stylesheet, and there is no engine CSS to import: all node / socket / connection chrome ships scoped and fully-tokenised inside the component. Every rendered value is a `--rozie-flow-*` custom property with an inline fallback, so it works zero-config yet re-skins by overriding a token, and dark mode is on by default (a built-in `prefers-color-scheme` block, all six targets). Add a design-system look or an app-toggled `.dark` class strategy with a one-line `themes/{base,shadcn,material,bootstrap}.css` import.

## Cross-references

- [FlowCanvas — showcase & API](/components/rete) — the full `@rozie-ui/rete` surface, quick starts, and the `<NodeType>` / `<Port>` type-template recipe.
- [`FlowCanvas.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/rete/src/FlowCanvas.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `<NodeType>` `#body` render-by-type portal builds on.
