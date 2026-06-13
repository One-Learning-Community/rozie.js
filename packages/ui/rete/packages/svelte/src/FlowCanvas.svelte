<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';
import { onMount, setContext, untrack } from 'svelte';

interface Props {
  graph?: any;
  validateTypes?: boolean;
  zoom?: number;
  pannable?: boolean;
  zoomable?: boolean;
  selectable?: boolean;
  readonly?: boolean;
  minZoom?: number;
  maxZoom?: number;
  snapGrid?: number;
  accumulateOnCtrl?: boolean;
  curvature?: number;
  fitOnMount?: boolean;
  controls?: boolean;
  minimap?: boolean;
  canConnect?: ((...args: any[]) => any) | null;
  history?: boolean;
  node?: Snippet<[{ node: any; selected: any; emit: any }]>;
  children?: Snippet;
  snippets?: Record<string, any>;
  onedgeclick?: (...args: unknown[]) => void;
  onedgeselected?: (...args: unknown[]) => void;
  onselectionchange?: (...args: unknown[]) => void;
  onnodeaction?: (...args: unknown[]) => void;
  onconnectionrejected?: (...args: unknown[]) => void;
  onconnectioncreated?: (...args: unknown[]) => void;
  onconnectionremoved?: (...args: unknown[]) => void;
  onnodepicked?: (...args: unknown[]) => void;
  onnodemoved?: (...args: unknown[]) => void;
  ontranslated?: (...args: unknown[]) => void;
  oncontextmenu?: (...args: unknown[]) => void;
}

let {
  graph = $bindable((() => ({
  nodes: [],
  connections: []
}))()),
  validateTypes = true,
  zoom = $bindable(1),
  pannable = true,
  zoomable = true,
  selectable = true,
  readonly = false,
  minZoom = 0.1,
  maxZoom = 4,
  snapGrid = 0,
  accumulateOnCtrl = true,
  curvature = 0.3,
  fitOnMount = true,
  controls = true,
  minimap = false,
  canConnect = null,
  history = true,
  node: __nodeProp,
  children: __childrenProp,
  snippets,
  onedgeclick,
  onedgeselected,
  onselectionchange,
  onnodeaction,
  onconnectionrejected,
  onconnectioncreated,
  onconnectionremoved,
  onnodepicked,
  onnodemoved,
  ontranslated,
  oncontextmenu
}: Props = $props();

const node = $derived(__nodeProp ?? snippets?.node);
const children = $derived(__childrenProp ?? snippets?.children);

let typeReg = $state({});
let portReg = $state({});

let canvasEl = $state<HTMLElement | undefined>(undefined);
let minimapEl = $state<HTMLElement | undefined>(undefined);

import { NodeEditor, ClassicPreset, Scope } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { getDOMSocketPosition, classicConnectionPath } from 'rete-render-utils';

// ── engine instances — null-lets so typeNeutralize types them `any` (the
// MapLibre `let instance = null` discipline). Rete's NodeEditor / AreaPlugin /
// ConnectionPlugin / DOMSocketPosition carry rich generic Schemes types that the
// loosely-typed .rozie props (any[]) don't satisfy under the strict react/solid/
// lit leaf tsc; routing every engine call through an `any` instance is the
// .rozie-native fix (no lang="ts", no codegen type-aid). These are top-level lets
// referenced from hooks → React auto-hoists each to a useRef. ──
// ── engine instances — null-lets so typeNeutralize types them `any` (the
// MapLibre `let instance = null` discipline). Rete's NodeEditor / AreaPlugin /
// ConnectionPlugin / DOMSocketPosition carry rich generic Schemes types that the
// loosely-typed .rozie props (any[]) don't satisfy under the strict react/solid/
// lit leaf tsc; routing every engine call through an `any` instance is the
// .rozie-native fix (no lang="ts", no codegen type-aid). These are top-level lets
// referenced from hooks → React auto-hoists each to a useRef. ──
let editor: any = null;
let area: any = null;
let connectionPlugin: any = null;
let socketWatcher: any = null;
let renderScope: any = null;
let selector: any = null;
// Win 1: the Delete/Backspace keydown listener + its host container. COMPONENT-scope
// (NOT $onMount-local) so the $onMount-returned teardown — which the Solid emitter
// hoists into a sibling onCleanup() OUTSIDE the mount IIFE — can still see them to
// removeEventListener (the same component-scope discipline as nodeInstances below).
// Win 1: the Delete/Backspace keydown listener + its host container. COMPONENT-scope
// (NOT $onMount-local) so the $onMount-returned teardown — which the Solid emitter
// hoists into a sibling onCleanup() OUTSIDE the mount IIFE — can still see them to
// removeEventListener (the same component-scope discipline as nodeInstances below).
let keydownContainer: any = null;
let onCanvasKeydown: any = null;

// Phase 42 MiniMap (opt-in :minimap) — the absolute SVG overlay host + its imperative
// SVG layer + the pointer-pan listeners. COMPONENT-scope (NOT $onMount-local) so the
// $onMount-returned teardown — which the Solid emitter hoists into a sibling
// onCleanup() OUTSIDE the mount IIFE — can still removeEventListener them (the same
// keydown / nodeInstances discipline). `minimapMap` is the live minimap-px ↔ graph-
// coord mapping the pointer-pan handlers read; `scheduleMinimapRedraw` is the bridge
// the top-level $watch + the engine pipes call (assigned inside $onMount, like the
// reconcilers). minimapRedrawRaf coalesces the viewport-rect redraw to one per frame
// (the drag-write-back discipline — the viewport rect redraws on every pan/zoom).
// Phase 42 MiniMap (opt-in :minimap) — the absolute SVG overlay host + its imperative
// SVG layer + the pointer-pan listeners. COMPONENT-scope (NOT $onMount-local) so the
// $onMount-returned teardown — which the Solid emitter hoists into a sibling
// onCleanup() OUTSIDE the mount IIFE — can still removeEventListener them (the same
// keydown / nodeInstances discipline). `minimapMap` is the live minimap-px ↔ graph-
// coord mapping the pointer-pan handlers read; `scheduleMinimapRedraw` is the bridge
// the top-level $watch + the engine pipes call (assigned inside $onMount, like the
// reconcilers). minimapRedrawRaf coalesces the viewport-rect redraw to one per frame
// (the drag-write-back discipline — the viewport rect redraws on every pan/zoom).
let minimapHost: any = null;
let minimapSvg: any = null;
let minimapRedrawRaf = 0;
let minimapMap: any = null;
let minimapPanning = false;
let onMinimapPointerDown: any = null;
let onMinimapPointerMove: any = null;
let onMinimapPointerUp: any = null;
let scheduleMinimapRedraw: any = null;

// MiniMap geometry (px) — MUST match the .rozie-flow-minimap CSS box below.
// MiniMap geometry (px) — MUST match the .rozie-flow-minimap CSS box below.
const MINIMAP_W = 200;
const MINIMAP_H = 150;
// Fallback node-rect dims when a node-view element isn't measurable yet (Lit async
// first paint, REQ-30) — re-measured on the next render (the render pipe re-schedules).
// Fallback node-rect dims when a node-view element isn't measurable yet (Lit async
// first paint, REQ-30) — re-measured on the next render (the render pipe re-schedules).
const MINIMAP_DEFAULT_NODE_W = 140;
const MINIMAP_DEFAULT_NODE_H = 52;
const SVGNS = 'http://www.w3.org/2000/svg';

// One Socket shared by every port (Rete sockets gate compatibility by identity;
// a single socket = "anything connects to anything", the common editor default).
// One Socket shared by every port (Rete sockets gate compatibility by identity;
// a single socket = "anything connects to anything", the common editor default).
const SOCKET = new ClassicPreset.Socket('flow');

// Live engine bookkeeping — COMPONENT-scope (NOT $onMount-local) so the
// $onMount-returned teardown, which the Solid emitter hoists into a sibling
// onCleanup() OUTSIDE the mount IIFE, keeps them in scope (the MapLibre
// markerEntries lesson).
//   nodeInstances : id → live ClassicPreset.Node          (engine truth)
//   nodeMeta      : id → the consumer's node spec object  (for the slot scope)
//   connInstances : id → live ClassicPreset.Connection    (engine truth)
//   nodeEntries   : id → { element, bodyHost, handle, socketDisposers }
//   connEntries   : id → { element, dispose }
// Live engine bookkeeping — COMPONENT-scope (NOT $onMount-local) so the
// $onMount-returned teardown, which the Solid emitter hoists into a sibling
// onCleanup() OUTSIDE the mount IIFE, keeps them in scope (the MapLibre
// markerEntries lesson).
//   nodeInstances : id → live ClassicPreset.Node          (engine truth)
//   nodeMeta      : id → the consumer's node spec object  (for the slot scope)
//   connInstances : id → live ClassicPreset.Connection    (engine truth)
//   nodeEntries   : id → { element, bodyHost, handle, socketDisposers }
//   connEntries   : id → { element, dispose }
const nodeInstances = new Map();
const nodeMeta = new Map();
const connInstances = new Map();
const nodeEntries = new Map();
const connEntries = new Map();
// connMeta : id → the consumer's connection spec ({ …, label?, stroke?, dashed? }) — the
// connection-side analog of nodeMeta, read by renderConnection for per-edge label/styling (F3).
// connMeta : id → the consumer's connection spec ({ …, label?, stroke?, dashed? }) — the
// connection-side analog of nodeMeta, read by renderConnection for per-edge label/styling (F3).
const connMeta = new Map();

// ids last applied FROM THE BOUND GRAPH, so reconcile removes only graph-managed
// entities — an imperative $expose addNode/addConnection is NOT auto-reaped on the
// next graph change (the power-user escape hatch stays alive). MapLibre reconciles
// every marker because markers are purely prop-driven; a flow editor also accepts
// imperative edits, so it tracks provenance. (Phase 41: nodes/connections now come
// ONLY from the single `graph` model — the per-instance declarative-children
// registries are gone; node TYPE templates + port schemas live in typeReg/portReg.)
// ids last applied FROM THE BOUND GRAPH, so reconcile removes only graph-managed
// entities — an imperative $expose addNode/addConnection is NOT auto-reaped on the
// next graph change (the power-user escape hatch stays alive). MapLibre reconciles
// every marker because markers are purely prop-driven; a flow editor also accepts
// imperative edits, so it tracks provenance. (Phase 41: nodes/connections now come
// ONLY from the single `graph` model — the per-instance declarative-children
// registries are gone; node TYPE templates + port schemas live in typeReg/portReg.)
let lastPropNodeIds: any = null;
let lastPropConnIds: any = null;

// Re-entrant suppression counter: while > 0 the editor/area event handlers skip
// echoing back into $emit / $model (our own programmatic add/remove/translate/
// zoom must not bounce out as if the user did it — the MapLibre PROGRAMMATIC
// eventData guard, in counter form so batched/nested ops never race).
// Re-entrant suppression counter: while > 0 the editor/area event handlers skip
// echoing back into $emit / $model (our own programmatic add/remove/translate/
// zoom must not bounce out as if the user did it — the MapLibre PROGRAMMATIC
// eventData guard, in counter form so batched/nested ops never race).
let programmatic = 0;

// Win 2: the last emitted selection id-set, joined to a stable string, so
// @selection-change fires ONLY on an actual change (a repeated identical pick/unpick
// set does not spam the consumer). `null` until the first emit (so the initial empty
// selection does not emit on mount). COMPONENT-scope so it survives across area events.
// Win 2: the last emitted selection id-set, joined to a stable string, so
// @selection-change fires ONLY on an actual change (a repeated identical pick/unpick
// set does not spam the consumer). `null` until the first emit (so the initial empty
// selection does not emit on mount). COMPONENT-scope so it survives across area events.
let lastSelectionIds: any = null;

// T1.1 — EDGE SELECTION (D-08). The currently-selected CONNECTION id, or null. Lives
// PURELY in component script (the selectedNodeIds echo-safety discipline) — NEVER
// written into $model.graph, so the controlled-graph write-back assertions are
// unaffected (Threat T-44-01-2: no spurious model write). COMPONENT-scope so it
// survives across area events + so the Solid-hoisted teardown can clear it. The
// `.is-selected` class is toggled imperatively on the engine-DOM __path; this id is the
// source of truth the Delete branch reads. `selectedPathEl` caches the live <path>
// element so a background-click clear (and re-select) can drop `.is-selected` without
// re-walking the DOM. `edgeClickGuard` is a one-shot flag the area-background pointerup
// branch checks so an edge click (which fires its own pointerup on the path AND lets the
// area's background pointerup run) does not immediately clear the selection it just made
// — reset on the next microtask, after the gesture settles.
// T1.1 — EDGE SELECTION (D-08). The currently-selected CONNECTION id, or null. Lives
// PURELY in component script (the selectedNodeIds echo-safety discipline) — NEVER
// written into $model.graph, so the controlled-graph write-back assertions are
// unaffected (Threat T-44-01-2: no spurious model write). COMPONENT-scope so it
// survives across area events + so the Solid-hoisted teardown can clear it. The
// `.is-selected` class is toggled imperatively on the engine-DOM __path; this id is the
// source of truth the Delete branch reads. `selectedPathEl` caches the live <path>
// element so a background-click clear (and re-select) can drop `.is-selected` without
// re-walking the DOM. `edgeClickGuard` is a one-shot flag the area-background pointerup
// branch checks so an edge click (which fires its own pointerup on the path AND lets the
// area's background pointerup run) does not immediately clear the selection it just made
// — reset on the next microtask, after the gesture settles.
let selectedConnId: any = null;
let selectedPathEl: any = null;
let edgeClickGuard = false;

// T1.3 — UNDO / REDO (D-02 on-by-default, D-03 per-gesture graph-only scope, D-04
// echo-guarded restore). A CAPPED snapshot stack over the BOUND GRAPH only — nodes
// (incl x/y) + connections — and explicitly NOT the viewport (pan/zoom is excluded,
// D-03). One entry is pushed per COMPLETED gesture: a drag = ONE entry (at the
// flushDragWriteBack commit, after the rAF coalesce — never per pointermove frame), a
// connect / disconnect / delete = one each. A push is gated on `!programmatic` so a
// restore-driven write (which runs INSIDE the programmatic guard) never re-enters the
// history (D-04). Pushing truncates any forward (redo) tail at the cursor and drops the
// oldest entry beyond the cap (Threat T-44-03-1: bounded memory). The cursor points at
// the index of the CURRENT graph in the stack; undo moves it back, redo moves it
// forward. Snapshots are `structuredClone` of the consumer's own serializable graph
// JSON (Pattern 7; the global is available on all 6 runtimes / Node 20+) — no external
// input, so the restore (T-44-03-2 accept) cannot loop (it rides the programmatic guard
// + the existing $watch(graph) reconcile). Undo is ALWAYS on for v1; `:history=false`
// (the `history` prop) is the cheap escape hatch that skips every push (the stack stays
// empty → undo/redo are no-ops). COMPONENT-scope so the stack survives across area
// events + the Solid-hoisted teardown.
// T1.3 — UNDO / REDO (D-02 on-by-default, D-03 per-gesture graph-only scope, D-04
// echo-guarded restore). A CAPPED snapshot stack over the BOUND GRAPH only — nodes
// (incl x/y) + connections — and explicitly NOT the viewport (pan/zoom is excluded,
// D-03). One entry is pushed per COMPLETED gesture: a drag = ONE entry (at the
// flushDragWriteBack commit, after the rAF coalesce — never per pointermove frame), a
// connect / disconnect / delete = one each. A push is gated on `!programmatic` so a
// restore-driven write (which runs INSIDE the programmatic guard) never re-enters the
// history (D-04). Pushing truncates any forward (redo) tail at the cursor and drops the
// oldest entry beyond the cap (Threat T-44-03-1: bounded memory). The cursor points at
// the index of the CURRENT graph in the stack; undo moves it back, redo moves it
// forward. Snapshots are `structuredClone` of the consumer's own serializable graph
// JSON (Pattern 7; the global is available on all 6 runtimes / Node 20+) — no external
// input, so the restore (T-44-03-2 accept) cannot loop (it rides the programmatic guard
// + the existing $watch(graph) reconcile). Undo is ALWAYS on for v1; `:history=false`
// (the `history` prop) is the cheap escape hatch that skips every push (the stack stays
// empty → undo/redo are no-ops). COMPONENT-scope so the stack survives across area
// events + the Solid-hoisted teardown.
const HISTORY_CAP = 100;
// Two-stack model (simpler + correct than a single cursor): `historyStack` holds
// PRE-gesture snapshots (the states to UNDO back to, newest last); `redoStack` holds
// snapshots an undo popped off (the states to REDO forward to, newest last). A new
// gesture (pushHistory) snapshots the PRE-gesture graph onto historyStack and CLEARS
// redoStack (a fresh edit discards the redo branch). undo() pops historyStack → pushes
// the CURRENT (pre-undo) graph onto redoStack → restores the popped snapshot. redo()
// pops redoStack → pushes the current graph back onto historyStack → restores it.
// Two-stack model (simpler + correct than a single cursor): `historyStack` holds
// PRE-gesture snapshots (the states to UNDO back to, newest last); `redoStack` holds
// snapshots an undo popped off (the states to REDO forward to, newest last). A new
// gesture (pushHistory) snapshots the PRE-gesture graph onto historyStack and CLEARS
// redoStack (a fresh edit discards the redo branch). undo() pops historyStack → pushes
// the CURRENT (pre-undo) graph onto redoStack → restores the popped snapshot. redo()
// pops redoStack → pushes the current graph back onto historyStack → restores it.
let historyStack = [];
let redoStack = [];

// ─── controlled-graph write-back (D4 — the central NEW capability) ─────────────
// On every drag/connect/disconnect the canvas emits a FRESH top-level
// `{ nodes, connections }` object via `$model.graph` — immutable React-Flow
// applyNodeChanges style (Wave-0-proven 6/6; in-place deep mutation is SILENT on
// React/Solid/Lit/Angular). Echo-guarded by the `programmatic` counter + the
// no-op-diff property: the write-back value already matches engine truth (the node
// is already at x/y; the edge already exists) so the consumer's re-bind →
// $watch(graph) → reconcile is a no-op diff.
//
// DRAG COALESCING (Pitfall 2): `nodetranslated` fires on every pointermove during a
// drag; emitting a fresh graph + full reconcile per frame is a rebuild storm. We
// accumulate the latest position per node (pendingDragPositions) and flush ONE fresh
// graph write per animation frame (dragFlushRaf), plus a final flush so the last
// position always lands. requestAnimationFrame coalesces multiple moves in a frame
// into a single $model.graph emit.
// ─── controlled-graph write-back (D4 — the central NEW capability) ─────────────
// On every drag/connect/disconnect the canvas emits a FRESH top-level
// `{ nodes, connections }` object via `$model.graph` — immutable React-Flow
// applyNodeChanges style (Wave-0-proven 6/6; in-place deep mutation is SILENT on
// React/Solid/Lit/Angular). Echo-guarded by the `programmatic` counter + the
// no-op-diff property: the write-back value already matches engine truth (the node
// is already at x/y; the edge already exists) so the consumer's re-bind →
// $watch(graph) → reconcile is a no-op diff.
//
// DRAG COALESCING (Pitfall 2): `nodetranslated` fires on every pointermove during a
// drag; emitting a fresh graph + full reconcile per frame is a rebuild storm. We
// accumulate the latest position per node (pendingDragPositions) and flush ONE fresh
// graph write per animation frame (dragFlushRaf), plus a final flush so the last
// position always lands. requestAnimationFrame coalesces multiple moves in a frame
// into a single $model.graph emit.
const pendingDragPositions = new Map(); // id → { x, y } (latest during a drag)
// id → { x, y } (latest during a drag)
let dragFlushRaf = 0;

// The current bound graph — NEVER mutated in place.
// The current bound graph — NEVER mutated in place.
const currentGraph = () => graph || {
  nodes: [],
  connections: []
};

// T1.3 — snapshot the PRE-gesture graph onto the undo stack, just BEFORE a gesture's
// write-back mutates `$model.graph` (D-03: one entry per gesture). MUST be called BEFORE
// the `$model.graph = …` write at each commit point so the captured snapshot is the
// state to UNDO back to. Gated on `!programmatic` (a restore-driven write runs INSIDE
// the guard → never pushes — D-04) and on the `history` prop (`:history=false` opts the
// whole feature out cheaply — the stacks stay empty, undo/redo no-op). A fresh gesture
// CLEARS the redo stack (a new edit discards the redo branch — standard editor
// semantics) and DROPS the oldest undo entry beyond HISTORY_CAP (Threat T-44-03-1:
// bounded memory). `structuredClone` is a global on all 6 target runtimes + Node 20+;
// the snapshot is decoupled from the live object so a later restore is stable.
// T1.3 — snapshot the PRE-gesture graph onto the undo stack, just BEFORE a gesture's
// write-back mutates `$model.graph` (D-03: one entry per gesture). MUST be called BEFORE
// the `$model.graph = …` write at each commit point so the captured snapshot is the
// state to UNDO back to. Gated on `!programmatic` (a restore-driven write runs INSIDE
// the guard → never pushes — D-04) and on the `history` prop (`:history=false` opts the
// whole feature out cheaply — the stacks stay empty, undo/redo no-op). A fresh gesture
// CLEARS the redo stack (a new edit discards the redo branch — standard editor
// semantics) and DROPS the oldest undo entry beyond HISTORY_CAP (Threat T-44-03-1:
// bounded memory). `structuredClone` is a global on all 6 target runtimes + Node 20+;
// the snapshot is decoupled from the live object so a later restore is stable.
const pushHistory = () => {
  if (programmatic) return;
  if (history === false) return;
  let snap;
  try {
    snap = structuredClone(currentGraph());
  } catch (e: any) {
    return;
  }
  historyStack.push(snap);
  if (historyStack.length > HISTORY_CAP) {
    historyStack = historyStack.slice(historyStack.length - HISTORY_CAP);
  }
  redoStack = [];
};

// T1.3 — restore a captured snapshot by writing a FRESH `{ nodes, connections }` via
// `$model.graph`, wrapped in the `programmatic` guard so the consumer's re-bind →
// $watch(graph) → reconcile applies it WITHOUT re-entering history (D-04 — pushHistory /
// the write-back helpers all bail while `programmatic` is raised). The snapshot is
// re-cloned on the way out so the live bound object never aliases a stack entry (a later
// consumer mutation of the graph can't corrupt the history). Graph-ONLY (D-03): the
// viewport transform is untouched.
// T1.3 — restore a captured snapshot by writing a FRESH `{ nodes, connections }` via
// `$model.graph`, wrapped in the `programmatic` guard so the consumer's re-bind →
// $watch(graph) → reconcile applies it WITHOUT re-entering history (D-04 — pushHistory /
// the write-back helpers all bail while `programmatic` is raised). The snapshot is
// re-cloned on the way out so the live bound object never aliases a stack entry (a later
// consumer mutation of the graph can't corrupt the history). Graph-ONLY (D-03): the
// viewport transform is untouched.
const restoreGraph = (snap: any) => {
  if (!snap) return;
  programmatic++;
  try {
    const fresh = {
      nodes: (snap.nodes || []).map((n: any) => ({
        ...n
      })),
      connections: (snap.connections || []).map((c: any) => ({
        ...c
      }))
    };
    graph = fresh;
  } finally {
    programmatic--;
  }
};

// undo() — pop the newest PRE-gesture snapshot, push the CURRENT graph onto the redo
// stack, and restore the snapshot. No-op when nothing to undo.
// undo() — pop the newest PRE-gesture snapshot, push the CURRENT graph onto the redo
// stack, and restore the snapshot. No-op when nothing to undo.
export const undo = () => {
  if (historyStack.length === 0) return;
  let cur;
  try {
    cur = structuredClone(currentGraph());
  } catch (e: any) {
    cur = null;
  }
  const snap = historyStack.pop();
  if (cur) redoStack.push(cur);
  restoreGraph(snap);
};

// redo() — pop the newest redo snapshot, push the CURRENT graph back onto the undo
// stack, and restore it. No-op when nothing to redo.
// redo() — pop the newest redo snapshot, push the CURRENT graph back onto the undo
// stack, and restore it. No-op when nothing to redo.
export const redo = () => {
  if (redoStack.length === 0) return;
  let cur;
  try {
    cur = structuredClone(currentGraph());
  } catch (e: any) {
    cur = null;
  }
  const snap = redoStack.pop();
  if (cur) historyStack.push(cur);
  restoreGraph(snap);
};
export const canUndo = () => historyStack.length > 0;
export const canRedo = () => redoStack.length > 0;

// Flush the coalesced drag positions: one fresh graph object with every pending
// node's x/y applied. Echo-guarded. Clears the pending map.
// Flush the coalesced drag positions: one fresh graph object with every pending
// node's x/y applied. Echo-guarded. Clears the pending map.
const flushDragWriteBack = () => {
  dragFlushRaf = 0;
  if (programmatic) {
    pendingDragPositions.clear();
    return;
  }
  if (pendingDragPositions.size === 0) return;
  const g = currentGraph();
  const nodes = (g.nodes || []).map((n: any) => {
    const p = n && n.id != null ? pendingDragPositions.get(n.id) : null;
    return p ? {
      ...n,
      x: p.x,
      y: p.y
    } : n;
  });
  pendingDragPositions.clear();
  // T1.3 — one history entry per DRAG gesture (the coalesced flush, NOT per frame).
  pushHistory();
  graph = {
    ...g,
    nodes
  };
};

// Schedule a coalesced drag write-back (rAF; falls back to a microtask where rAF is
// unavailable — e.g. a non-DOM test env).
// Schedule a coalesced drag write-back (rAF; falls back to a microtask where rAF is
// unavailable — e.g. a non-DOM test env).
const scheduleDragFlush = () => {
  if (dragFlushRaf) return;
  if (typeof requestAnimationFrame === 'function') {
    dragFlushRaf = requestAnimationFrame(flushDragWriteBack);
  } else {
    dragFlushRaf = 1;
    Promise.resolve().then(flushDragWriteBack);
  }
};

// CONNECT — append a fresh connection into a fresh graph object. Echo-guarded.
// CONNECT — append a fresh connection into a fresh graph object. Echo-guarded.
const writeBackConnectionCreated = (c: any) => {
  if (programmatic) return;
  const g = currentGraph();
  const conn = {
    id: c.id,
    source: c.source,
    sourceOutput: c.sourceOutput,
    target: c.target,
    targetInput: c.targetInput
  };
  // T1.3 — one history entry per CONNECT gesture.
  pushHistory();
  graph = {
    ...g,
    connections: [...(g.connections || []), conn]
  };
};

// DISCONNECT — filter the id out into a fresh graph object. Echo-guarded.
// DISCONNECT — filter the id out into a fresh graph object. Echo-guarded.
const writeBackConnectionRemoved = (id: any) => {
  if (programmatic) return;
  const g = currentGraph();
  // T1.3 — one history entry per DISCONNECT / edge-delete gesture.
  pushHistory();
  graph = {
    ...g,
    connections: (g.connections || []).filter((e: any) => e && e.id !== id)
  };
};

// T1.1 — EDGE SELECTION helpers (D-08). Selection state is kept PURELY in script
// (selectedConnId / selectedPathEl) and surfaced to the consumer via @edge-click /
// @edge-selected — never written into $model.graph (echo-safe like selectedNodeIds).
//
// `clearEdgeSelection` drops `.is-selected` from the live <path> (if still attached) and
// nulls the selection. `selectEdge` is invoked from the per-edge pointerup listener: it
// clears any prior selection, marks THIS path `.is-selected`, records the id + element,
// raises the one-shot `edgeClickGuard` (so the area's own background-pointerup branch
// does not immediately clear what this click just selected — the same pointerup gesture
// fires on the path AND lets the area pipe run), and emits BOTH @edge-click and
// @edge-selected ({ id }). The guard self-resets on the next microtask once the gesture
// has settled.
// T1.1 — EDGE SELECTION helpers (D-08). Selection state is kept PURELY in script
// (selectedConnId / selectedPathEl) and surfaced to the consumer via @edge-click /
// @edge-selected — never written into $model.graph (echo-safe like selectedNodeIds).
//
// `clearEdgeSelection` drops `.is-selected` from the live <path> (if still attached) and
// nulls the selection. `selectEdge` is invoked from the per-edge pointerup listener: it
// clears any prior selection, marks THIS path `.is-selected`, records the id + element,
// raises the one-shot `edgeClickGuard` (so the area's own background-pointerup branch
// does not immediately clear what this click just selected — the same pointerup gesture
// fires on the path AND lets the area pipe run), and emits BOTH @edge-click and
// @edge-selected ({ id }). The guard self-resets on the next microtask once the gesture
// has settled.
const clearEdgeSelection = () => {
  if (selectedPathEl && selectedPathEl.classList) {
    try {
      selectedPathEl.classList.remove('is-selected');
    } catch (e: any) {}
  }
  selectedConnId = null;
  selectedPathEl = null;
};
const selectEdge = (id: any, pathEl: any) => {
  if (id == null) return;
  clearEdgeSelection();
  selectedConnId = id;
  selectedPathEl = pathEl;
  if (pathEl && pathEl.classList) {
    try {
      pathEl.classList.add('is-selected');
    } catch (e: any) {}
  }
  edgeClickGuard = true;
  Promise.resolve().then(() => {
    edgeClickGuard = false;
  });
  onedgeclick?.({
    id
  });
  onedgeselected?.({
    id
  });
};

// CASCADING DELETE (the PUBLIC controlled-graph node delete — Win 1). Distinct from
// the engine-only `removeNode` $expose verb: `removeNode` operates directly on the
// editor and is NOT written back to the model (the provenance-tracked imperative
// escape hatch); `deleteNode` is the BLESSED controlled-graph delete — it filters the
// node AND every incident connection out of FRESH arrays and writes ONE fresh
// top-level `{ ...g, nodes, connections }` object via `$model.graph` (the Phase-41
// write-back contract — in-place mutation is silently dropped on React/Solid/Lit/
// Angular). The wrapper's own `$watch(graph)` reconcile then reaps the live engine
// node + edges — we do NOT call editor.removeNode here (a double-remove would race the
// reconcile into Rete's "cannot find node"; the controlled-model filter is the single
// removal path). NOT echo-guarded with `programmatic` — this is a CONSUMER-driven write
// that SHOULD update the bound model (mirrors the demo's per-node ✕ filter). Returns
// true if a node was removed. The id-coerce-to-String mirrors the demo's onRemoveClick.
// CASCADING DELETE (the PUBLIC controlled-graph node delete — Win 1). Distinct from
// the engine-only `removeNode` $expose verb: `removeNode` operates directly on the
// editor and is NOT written back to the model (the provenance-tracked imperative
// escape hatch); `deleteNode` is the BLESSED controlled-graph delete — it filters the
// node AND every incident connection out of FRESH arrays and writes ONE fresh
// top-level `{ ...g, nodes, connections }` object via `$model.graph` (the Phase-41
// write-back contract — in-place mutation is silently dropped on React/Solid/Lit/
// Angular). The wrapper's own `$watch(graph)` reconcile then reaps the live engine
// node + edges — we do NOT call editor.removeNode here (a double-remove would race the
// reconcile into Rete's "cannot find node"; the controlled-model filter is the single
// removal path). NOT echo-guarded with `programmatic` — this is a CONSUMER-driven write
// that SHOULD update the bound model (mirrors the demo's per-node ✕ filter). Returns
// true if a node was removed. The id-coerce-to-String mirrors the demo's onRemoveClick.
export const deleteNode = (id: any) => {
  if (id == null) return false;
  const g = currentGraph();
  const sid = String(id);
  const nodes = (g.nodes || []).filter((n: any) => n && String(n.id) !== sid);
  if (nodes.length === (g.nodes || []).length) return false;
  const connections = (g.connections || []).filter((c: any) => c && String(c.source) !== sid && String(c.target) !== sid);
  // T1.3 — one history entry per DELETE gesture (node + its incident edges = ONE undo).
  pushHistory();
  graph = {
    ...g,
    nodes,
    connections
  };
  return true;
};

// Collect the currently-SELECTED node ids from the live selector (Win 1 + Win 2). The
// AreaExtensions.selector() `entities` Map holds the picked entities ({ label, id });
// for selectable nodes each entity's `id` is the node id. Empty when nothing is picked
// or selection is disabled. Read-only — no $data / engine write.
// Collect the currently-SELECTED node ids from the live selector (Win 1 + Win 2). The
// AreaExtensions.selector() `entities` Map holds the picked entities ({ label, id });
// for selectable nodes each entity's `id` is the node id. Empty when nothing is picked
// or selection is disabled. Read-only — no $data / engine write.
const selectedNodeIds = () => {
  if (!selector || !selector.entities) return [];
  const ids = [];
  for (const e of selector.entities.values() as any) {
    if (e && e.id != null) ids.push(e.id);
  }
  return ids;
};

// Win 2: surface selection changes to the consumer via @selection-change ({ ids }).
// Computes the current selected-id set, dedupes against the last-emitted set (joined
// string), and emits only on an ACTUAL change. Echo-guarded by `programmatic` so a
// PROGRAMMATIC unselect (clear/deleteNode may unpick) does not surface as a user
// selection. Selection is kept PURELY in the emit — never written into the graph model
// — so the controlled-graph echo-safety (the drag write-back assertions) is unaffected.
// Sorted before joining so the dedup key is order-independent (the selector Map order
// is not guaranteed stable across pick/unpick).
// Win 2: surface selection changes to the consumer via @selection-change ({ ids }).
// Computes the current selected-id set, dedupes against the last-emitted set (joined
// string), and emits only on an ACTUAL change. Echo-guarded by `programmatic` so a
// PROGRAMMATIC unselect (clear/deleteNode may unpick) does not surface as a user
// selection. Selection is kept PURELY in the emit — never written into the graph model
// — so the controlled-graph echo-safety (the drag write-back assertions) is unaffected.
// Sorted before joining so the dedup key is order-independent (the selector Map order
// is not guaranteed stable across pick/unpick).
const maybeEmitSelectionChange = () => {
  if (programmatic) return;
  const ids = selectedNodeIds();
  const key = [...ids].map((x: any) => String(x)).sort().join(' ');
  if (key === lastSelectionIds) return;
  lastSelectionIds = key;
  onselectionchange?.({
    ids
  });
  // the selected set changed → repaint the minimap (selected nodes are highlighted).
  if (scheduleMinimapRedraw) scheduleMinimapRedraw();
};

// Schedule the selection recompute AFTER the engine's own async selection update has
// settled. AreaExtensions.selectableNodes does its pick / unselectAll via AWAITED
// area.update() calls, so a bare microtask can run before `selector.entities` reflects
// the new state. A microtask AND an rAF together guarantee we recompute once the engine
// chain has flushed (the dedup collapses the pair to at most one emit). Falls back to a
// double microtask where rAF is unavailable (non-DOM test env).
// Schedule the selection recompute AFTER the engine's own async selection update has
// settled. AreaExtensions.selectableNodes does its pick / unselectAll via AWAITED
// area.update() calls, so a bare microtask can run before `selector.entities` reflects
// the new state. A microtask AND an rAF together guarantee we recompute once the engine
// chain has flushed (the dedup collapses the pair to at most one emit). Falls back to a
// double microtask where rAF is unavailable (non-DOM test env).
const scheduleSelectionEmit = () => {
  Promise.resolve().then(maybeEmitSelectionChange);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(maybeEmitSelectionChange);
  } else {
    Promise.resolve().then(() => Promise.resolve().then(maybeEmitSelectionChange));
  }
};

// The $portals/$emit-capturing reconcilers are built INSIDE $onMount ($portals
// referenced at top level fails the bundled-leaf strict typecheck — the CM/
// TipTap/MapLibre portal discipline) and bridged here so the top-level $watch can
// call them.
// The $portals/$emit-capturing reconcilers are built INSIDE $onMount ($portals
// referenced at top level fails the bundled-leaf strict typecheck — the CM/
// TipTap/MapLibre portal discipline) and bridged here so the top-level $watch can
// call them.
let reconcileNodes: any = null;
let reconcileConnections: any = null;

// Re-entrancy guard for reconcileNodes. The declarative-children path can fire the
// node reconcile RE-ENTRANTLY on async-context targets (Lit): a <FlowNode>'s
// $onMount register starts reconcile #1, and its late-context $onUpdate registration
// (REQ-30) — or the registry $watch the register triggers — starts reconcile #2 while
// #1's awaits (editor.addNode / area.translate / area.update) are still pending. Two
// overlapping reconciles racing the same engine throw Rete's "cannot find node" (one
// updates/translates a node-view the other just rebuilt), which aborts the whole graph
// build (only the config-array `cfg` node survives on Lit). This flag serializes them:
// a reconcile requested while one is running sets a "run again" bit and returns; the
// in-flight reconcile re-runs once it finishes, so every registry mutation is folded
// into a fresh non-overlapping pass. The config-array-only path never re-enters (props
// change once per tick), so this is byte-transparent to its behavior.
// Re-entrancy guard for reconcileNodes. The declarative-children path can fire the
// node reconcile RE-ENTRANTLY on async-context targets (Lit): a <FlowNode>'s
// $onMount register starts reconcile #1, and its late-context $onUpdate registration
// (REQ-30) — or the registry $watch the register triggers — starts reconcile #2 while
// #1's awaits (editor.addNode / area.translate / area.update) are still pending. Two
// overlapping reconciles racing the same engine throw Rete's "cannot find node" (one
// updates/translates a node-view the other just rebuilt), which aborts the whole graph
// build (only the config-array `cfg` node survives on Lit). This flag serializes them:
// a reconcile requested while one is running sets a "run again" bit and returns; the
// in-flight reconcile re-runs once it finishes, so every registry mutation is folded
// into a fresh non-overlapping pass. The config-array-only path never re-enters (props
// change once per tick), so this is byte-transparent to its behavior.
let reconcileNodesRunning = false;
let reconcileNodesPending = false;

// ── pure helpers (no sigils → safe at top level) ──
// ── pure helpers (no sigils → safe at top level) ──
const serializeConn = (c: any) => ({
  id: c.id,
  source: c.source,
  sourceOutput: c.sourceOutput,
  target: c.target,
  targetInput: c.targetInput
});

// Resolve a node TYPE's port schema from the flat per-TYPE portReg — the entries
// whose key starts `type + '::'`. Returns { inputs:[{key,label,multiple,portType}],
// outputs:[…] }. Pure (no $data write) so buildNode / buildSocketRow can call it on
// every run regardless of the order the <NodeType> vs its <Port> children registered.
// Resolve a node TYPE's port schema from the flat per-TYPE portReg — the entries
// whose key starts `type + '::'`. Returns { inputs:[{key,label,multiple,portType}],
// outputs:[…] }. Pure (no $data write) so buildNode / buildSocketRow can call it on
// every run regardless of the order the <NodeType> vs its <Port> children registered.
const portSchemaForType = (type: any, portReg: any) => {
  const inputs = [];
  const outputs = [];
  if (type == null || !portReg) return {
    inputs,
    outputs
  };
  const prefix = type + '::';
  for (const k in portReg) {
    if (k.indexOf(prefix) !== 0) continue;
    const p = portReg[k];
    if (!p || p.key == null) continue;
    const entry = {
      key: p.key,
      label: p.label,
      multiple: p.multiple,
      portType: p.portType
    };
    if (p.side === 'input') inputs.push(entry);else outputs.push(entry);
  }
  return {
    inputs,
    outputs
  };
};

// Build a live Rete node from a graph-node spec ({ id, type, x, y, data }). The
// consumer's `id` is assigned onto the node so positions, portal keys, and
// connection source/target ids all align with the author's identifiers (Rete would
// otherwise auto-generate ids). Sockets come from the node's TYPE port schema
// (portReg keyed `type::side::key`) — a type's ports declared ONCE apply to every
// instance (render-by-type). The single shared SOCKET still gates compatibility by
// identity; the per-port `portType` drives typed VALIDATION, not socket identity.
// Build a live Rete node from a graph-node spec ({ id, type, x, y, data }). The
// consumer's `id` is assigned onto the node so positions, portal keys, and
// connection source/target ids all align with the author's identifiers (Rete would
// otherwise auto-generate ids). Sockets come from the node's TYPE port schema
// (portReg keyed `type::side::key`) — a type's ports declared ONCE apply to every
// instance (render-by-type). The single shared SOCKET still gates compatibility by
// identity; the per-port `portType` drives typed VALIDATION, not socket identity.
const buildNode = (spec: any, portReg: any) => {
  const label = spec.data && spec.data.label != null ? String(spec.data.label) : '';
  const node = new ClassicPreset.Node(label);
  node.id = spec.id;
  const {
    inputs,
    outputs
  } = portSchemaForType(spec.type, portReg);
  for (const inp of inputs as any) {
    if (!inp || inp.key == null) continue;
    node.addInput(inp.key, new ClassicPreset.Input(SOCKET, inp.label, inp.multiple === true));
  }
  for (const out of outputs as any) {
    if (!out || out.key == null) continue;
    node.addOutput(out.key, new ClassicPreset.Output(SOCKET, out.label, out.multiple !== false));
  }
  return node;
};

// NOTE: portTypeOf (the validation-pipe port-type resolver) is DEFINED INSIDE
// $onMount (next to the editor.addPipe that uses it), NOT here at top level. It reads
// $data.portReg, and a top-level definition lowers on React to a `useCallback` whose
// captured `portReg` is FROZEN at the snapshot when the validation pipe (set up once in
// the mount effect) was created — i.e. the INITIAL empty {} before any <Port> registered.
// A stale-empty portReg makes portTypeOf return null for every port, so the typed-socket
// validation `srcType != null && tgtType != null && srcType !== tgtType` check is SKIPPED
// and a cross-type connection is WRONGLY ALLOWED (the React-only "reject didn't fire" bug
// the advanced VR cell surfaced). Defined inside $onMount, the emitter lowers its
// $data.portReg read to the live `_portRegRef.current` (the same ref the reconcilers use),
// so validation always sees the current schema. The 5 non-React targets read live signals
// so they were correct either way; this is the React stale-closure fix (the MapLibre/PDF
// $watch-reroute lesson, here as a mount-scoped definition). ZERO emitter change.

// ─── per-TYPE registry (Phase 41 controlled-graph — the per-TYPE shift of the
// Phase 37 per-instance $provide/$inject dogfood) ────────────────────────────────
// The 'rete:canvas' registry API CONSUMED BY <NodeType>/<Port> (41-03). CRITICAL
// reactive-write discipline (Pitfall 1): every mutation WHOLE-OBJECT-REPLACES the
// registry so the watched $data.typeReg/$data.portReg reference changes exactly once
// per call — a bare in-place $data.typeReg[type] = spec is silent on React/Solid/
// Angular/Lit. THE CROSS-PLAN CONTRACT (41-03 calls EXACTLY these verbs):
//   registerType(type, spec)                            → type-template registry (<NodeType>)
//   unregisterType(type)                                → drop a type on <NodeType> unmount
//   addTypePort(type, side, key, portType, label, multiple) → per-TYPE port schema (<Port>)
//   bodyHostFor(nodeId)                                 → the engine `body` host div
//                                                          (render-by-type callback target)
// ─── imperative handle (Phase 21 $expose) ────────────────────────────────────
// Collision discipline (ROZ121/ROZ524/Lit-lifecycle):
//   - NO `setZoom` — `zoom` is a model prop, so React auto-generates a `setZoom`
//     state setter (the MapLibre setCenter/setZoom lesson); the verb is `zoomTo`.
//   - NONE equals a Lit reserved lifecycle name (update/render/firstUpdated/
//     updated/willUpdate/requestUpdate) — note `clear` and `getNodes` are safe.
//   - NONE equals an emitted event name (node-moved/node-picked/connection-*
//     /translated/context-menu/node-action) or a prop name.
// addNode/addConnection/removeNode/removeConnection operate on the engine
// directly and are NOT reaped by props reconcile (provenance-tracked).
export function getEditor() {
  return editor;
}
export function getArea() {
  return area;
}
export async function addNode(spec: any) {
  if (!editor || !spec || spec.id == null) return null;
  const node = buildNode(spec, portReg);
  nodeInstances.set(spec.id, node);
  nodeMeta.set(spec.id, spec);
  programmatic++;
  try {
    await editor.addNode(node);
    await area.translate(spec.id, {
      x: spec.x || 0,
      y: spec.y || 0
    });
  } finally {
    programmatic--;
  }
  return spec.id;
}
export async function removeNode(id: any) {
  if (!editor || id == null || !nodeInstances.has(id)) return false;
  programmatic++;
  try {
    for (const c of editor.getConnections() as any) {
      if (c.source === id || c.target === id) await editor.removeConnection(c.id);
    }
    await editor.removeNode(id);
  } finally {
    programmatic--;
  }
  nodeInstances.delete(id);
  nodeMeta.delete(id);
  return true;
}
export async function addConnection(spec: any) {
  if (!editor || !spec || spec.source == null || spec.target == null) return null;
  const srcOut = spec.sourceOutput != null ? spec.sourceOutput : 'out';
  const tgtIn = spec.targetInput != null ? spec.targetInput : 'in';
  const sourceNode = nodeInstances.get(spec.source);
  const targetNode = nodeInstances.get(spec.target);
  if (!sourceNode || !targetNode) return null;
  const conn = new ClassicPreset.Connection(sourceNode, srcOut, targetNode, tgtIn);
  if (spec.id != null) conn.id = spec.id;
  programmatic++;
  try {
    await editor.addConnection(conn);
  } finally {
    programmatic--;
  }
  connInstances.set(conn.id, conn);
  return conn.id;
}
export async function removeConnection(id: any) {
  if (!editor || id == null) return false;
  programmatic++;
  try {
    await editor.removeConnection(id);
  } finally {
    programmatic--;
  }
  connInstances.delete(id);
  return true;
}
export async function clear() {
  if (!editor) return;
  programmatic++;
  try {
    await editor.clear();
  } finally {
    programmatic--;
  }
  nodeInstances.clear();
  nodeMeta.clear();
  connInstances.clear();
  connMeta.clear();
  lastPropNodeIds = [];
  lastPropConnIds = [];
}
export async function zoomToFit() {
  if (!area || !editor) return;
  programmatic++;
  try {
    await AreaExtensions.zoomAt(area, editor.getNodes());
  } finally {
    programmatic--;
  }
  const k = area.area.transform.k;
  if (k !== zoom) zoom = k;
}
export async function zoomTo(k: any) {
  if (!area || typeof k !== 'number') return;
  programmatic++;
  try {
    await area.area.zoom(k);
  } finally {
    programmatic--;
  }
  if (k !== zoom) zoom = k;
}

// ─── viewport API (Phase 42 — the T11 gap + what the pannable minimap needs) ─────
// Both write the AreaPlugin transform via the CONFIRMED Rete v2 area API: with the
// origin omitted `area.area.zoom(k)` leaves x/y unchanged (transform.x += 0·d), and
// `area.area.translate(x, y)` sets the pan ABSOLUTELY (verified against rete-area-
// plugin@2.1.5). Echo-guarded with `programmatic` so the transform write doesn't loop
// back through the zoomed/nodetranslated write-back (the `translated` emit stays
// UNCONDITIONAL, so @translated still surfaces a programmatic recenter — a real
// viewport change the consumer asked for). After, echo `$model.zoom` (mirrors zoomTo).
// Collision discipline: setCenter/setViewport are NOT Lit lifecycle names, NOT emit
// names, NOT prop names, NOT React model-setters (`graph`/`zoom` → setGraph/setZoom),
// and NOT inherited DOM methods (the Embla scrollTo lesson) — clean on all 6.
//
// setViewport({ x, y, k }) — set the raw transform (any field omitted keeps its
// current value).
// ─── viewport API (Phase 42 — the T11 gap + what the pannable minimap needs) ─────
// Both write the AreaPlugin transform via the CONFIRMED Rete v2 area API: with the
// origin omitted `area.area.zoom(k)` leaves x/y unchanged (transform.x += 0·d), and
// `area.area.translate(x, y)` sets the pan ABSOLUTELY (verified against rete-area-
// plugin@2.1.5). Echo-guarded with `programmatic` so the transform write doesn't loop
// back through the zoomed/nodetranslated write-back (the `translated` emit stays
// UNCONDITIONAL, so @translated still surfaces a programmatic recenter — a real
// viewport change the consumer asked for). After, echo `$model.zoom` (mirrors zoomTo).
// Collision discipline: setCenter/setViewport are NOT Lit lifecycle names, NOT emit
// names, NOT prop names, NOT React model-setters (`graph`/`zoom` → setGraph/setZoom),
// and NOT inherited DOM methods (the Embla scrollTo lesson) — clean on all 6.
//
// setViewport({ x, y, k }) — set the raw transform (any field omitted keeps its
// current value).
export async function setViewport(vp: any) {
  if (!area || !vp || typeof vp !== 'object') return;
  const tf = area.area.transform;
  const k = typeof vp.k === 'number' ? vp.k : tf.k;
  const x = typeof vp.x === 'number' ? vp.x : tf.x;
  const y = typeof vp.y === 'number' ? vp.y : tf.y;
  programmatic++;
  try {
    if (k !== area.area.transform.k) await area.area.zoom(k);
    await area.area.translate(x, y);
  } finally {
    programmatic--;
  }
  if (k !== zoom) zoom = k;
}

// setCenter(x, y, opts?) — center the viewport on graph-coords (x, y), optionally
// setting zoom (`opts.zoom`). The transform that puts graph point (x,y) at the canvas
// center is tx = W/2 − x·k, ty = H/2 − y·k (screen = graph·k + transform). W/H are the
// engine container's pixel dims (area.container — public on AreaPlugin, no $refs read).
// setCenter(x, y, opts?) — center the viewport on graph-coords (x, y), optionally
// setting zoom (`opts.zoom`). The transform that puts graph point (x,y) at the canvas
// center is tx = W/2 − x·k, ty = H/2 − y·k (screen = graph·k + transform). W/H are the
// engine container's pixel dims (area.container — public on AreaPlugin, no $refs read).
export async function setCenter(x: any, y: any, opts: any) {
  if (!area || typeof x !== 'number' || typeof y !== 'number') return;
  const k = opts && typeof opts.zoom === 'number' ? opts.zoom : area.area.transform.k;
  const el = area.container;
  const cw = el && el.clientWidth ? el.clientWidth : 0;
  const ch = el && el.clientHeight ? el.clientHeight : 0;
  const tx = cw / 2 - x * k;
  const ty = ch / 2 - y * k;
  programmatic++;
  try {
    if (k !== area.area.transform.k) await area.area.zoom(k);
    await area.area.translate(tx, ty);
  } finally {
    programmatic--;
  }
  if (k !== zoom) zoom = k;
}

// ─── built-in Controls overlay handlers (Win 4) ──────────────────────────────
// Wired to the in-template zoom in / out / fit buttons (gated r-if="$props.controls").
// They REUSE the zoomTo / zoomToFit verbs (one implementation — no logic duplication),
// clamping the step to [minZoom, maxZoom] so a button never exceeds the restrictor
// bounds. Zoom/fit are view-only, so they stay enabled even when readonly (they do not
// edit the graph). A no-op before the area mounts.
// ─── built-in Controls overlay handlers (Win 4) ──────────────────────────────
// Wired to the in-template zoom in / out / fit buttons (gated r-if="$props.controls").
// They REUSE the zoomTo / zoomToFit verbs (one implementation — no logic duplication),
// clamping the step to [minZoom, maxZoom] so a button never exceeds the restrictor
// bounds. Zoom/fit are view-only, so they stay enabled even when readonly (they do not
// edit the graph). A no-op before the area mounts.
const ZOOM_STEP = 1.2;
const clampZoom = (k: any) => {
  let lo = typeof minZoom === 'number' && minZoom > 0 ? minZoom : 0.01;
  let hi = typeof maxZoom === 'number' && maxZoom > 0 ? maxZoom : 100;
  if (k < lo) return lo;
  if (k > hi) return hi;
  return k;
};
const controlZoomIn = () => {
  if (!area) return;
  zoomTo(clampZoom(area.area.transform.k * ZOOM_STEP));
};
const controlZoomOut = () => {
  if (!area) return;
  zoomTo(clampZoom(area.area.transform.k / ZOOM_STEP));
};
const controlFit = () => {
  zoomToFit();
};
export function getNodes() {
  if (!area) return [];
  const out = [];
  for (const [id, node] of nodeInstances as any) {
    const view = area.nodeViews.get(id);
    out.push({
      id,
      label: node.label,
      x: view ? view.position.x : 0,
      y: view ? view.position.y : 0
    });
  }
  return out;
}
export function getConnections() {
  return editor ? editor.getConnections().map(serializeConn) : [];
}
export function getTransform() {
  return area ? {
    x: area.area.transform.x,
    y: area.area.transform.y,
    k: area.area.transform.k
  } : null;
}

// screenToFlowPosition(clientX, clientY) → { x, y } in GRAPH coords (Phase 43 — the
// palette-drop / no-code-builder primitive, the React-Flow `screenToFlowPosition`
// parity). The INVERSE of the area transform: a graph point projects to the screen as
// `screen = containerOrigin + transform.{x,y} + graph·k`, so
// `graph = (client − containerOrigin − transform) / k`. `area.container` is public on
// the AreaPlugin (no $refs read). Returns null before the area mounts. The component
// owns ONLY this projection — the consumer owns the drag/drop (a palette item's
// `draggable` + the canvas `@dragover.prevent`/`@drop`) and writes the new node into the
// bound `graph` at the returned coords, exactly like React Flow (which does not own the
// palette either).
// screenToFlowPosition(clientX, clientY) → { x, y } in GRAPH coords (Phase 43 — the
// palette-drop / no-code-builder primitive, the React-Flow `screenToFlowPosition`
// parity). The INVERSE of the area transform: a graph point projects to the screen as
// `screen = containerOrigin + transform.{x,y} + graph·k`, so
// `graph = (client − containerOrigin − transform) / k`. `area.container` is public on
// the AreaPlugin (no $refs read). Returns null before the area mounts. The component
// owns ONLY this projection — the consumer owns the drag/drop (a palette item's
// `draggable` + the canvas `@dragover.prevent`/`@drop`) and writes the new node into the
// bound `graph` at the returned coords, exactly like React Flow (which does not own the
// palette either).
export function screenToFlowPosition(clientX: any, clientY: any) {
  if (!area || typeof clientX !== 'number' || typeof clientY !== 'number') return null;
  const el = area.container;
  const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
  if (!rect) return null;
  const t = area.area.transform;
  const k = t.k || 1;
  return {
    x: (clientX - rect.left - t.x) / k,
    y: (clientY - rect.top - t.y) / k
  };
}

setContext('rete:canvas', {
  // Register/replace a node TYPE template. `spec` carries an optional
  // `bodyRenderer(host, { node })` — the render-by-type projection (mounted per graph
  // node of this type into the engine body host, see renderNode). Whole-object replace.
  registerType: (type: any, spec: any) => {
    if (type != null) typeReg = {
      ...typeReg,
      [type]: spec
    };
  },
  // Drop a type on <NodeType> unmount (whole-object replace).
  unregisterType: (type: any) => {
    const t = {
      ...typeReg
    };
    delete t[type];
    typeReg = t;
  },
  // A <Port> registers a port against its TYPE + side. Stored in the flat portReg
  // under a UNIQUE per-port key `type::side::key` so registration is order-independent
  // AND concurrency-safe: two <Port>s of the same type addTypePort in one React commit,
  // and a pure `{ ...portReg, [uniqueKey]: port }` write (functional setState) merges
  // both (an array read-modify-write under one type key would clobber). buildNode reads
  // the type's portReg entries on every run regardless of mount order. The unique key
  // also makes a re-fired addTypePort (late Lit context) idempotent — same key, same value.
  // `side` is derived by <Port> from which of output=/input= is set (output⇒'output', input⇒'input');
  // `portType` carries the port type that drives validate-types + the typed-port color.
  // `position` (F2) is the socket's VISUAL placement (left|right|top|bottom; default by
  // side) — drives the render-pipe socket layout + the connection-anchor axis.
  addTypePort: (type: any, side: any, key: any, portType: any, label: any, multiple: any, position: any) => {
    if (type == null || key == null) return;
    const portKey = type + '::' + side + '::' + key;
    portReg = {
      ...portReg,
      [portKey]: {
        type,
        side,
        key,
        portType,
        label,
        multiple,
        position
      }
    };
  },
  // Render-by-type callback target. Returns the engine-created body host div for a
  // graph node (nodeEntries.get(nodeId).body). The render-by-type projection mounts
  // the node's TYPE template `#body` INTO this host via $portals — the Wave-0 A3
  // finding (a Lit child cannot relocate its own shadow <slot> across the boundary),
  // so the body is projected by the parent reusing the $portals host discipline.
  bodyHostFor: (nodeId: any) => {
    const entry = nodeEntries.get(nodeId);
    return entry ? entry.body : null;
  }
});

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
}
const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  node: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
    if (!node) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-node', 'cd396d6a');
    const inst = mount(PortalHostReactive, {
      target: container,
      props: { snippet: node, initialScope: scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return {
      update: (s: unknown): void => {
        (inst as unknown as { update(s: unknown): void }).update(s);
      },
      dispose: (): void => {
        unmount(inst as Parameters<typeof unmount>[0]);
        portalInstances.delete(inst as Record<string, unknown>);
      },
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
  const container = canvasEl;
  lastPropNodeIds = [];
  lastPropConnIds = [];
  editor = new NodeEditor();
  area = new AreaPlugin(container);
  connectionPlugin = new ConnectionPlugin();
  connectionPlugin.addPreset(ConnectionPresets.classic.setup());

  // Resolve a port's VISUAL position (F2) from the per-TYPE port schema (portReg, keyed
  // `type::side::key`), defaulting by DIRECTION (input → left, output → right) for exact
  // back-compat. DEFINED HERE inside $onMount (NOT top level) so its $data.portReg read
  // lowers on React to the live `_portRegRef.current`, not a stale-empty mount-time
  // closure (the portTypeOf discipline). Used by both the socket-anchor offset below and
  // renderNode's socket layout.
  const resolvePortPosition = (type: any, side: any, key: any) => {
    const entry = type != null && key != null ? portReg[type + '::' + side + '::' + key] : null;
    const p = entry && entry.position != null ? entry.position : null;
    if (p === 'left' || p === 'right' || p === 'top' || p === 'bottom') return p;
    return side === 'input' ? 'left' : 'right';
  };

  // DOM-based socket position watcher — feeds connection-path redraw + the
  // ConnectionPlugin's drag-to-connect hit-testing. A CUSTOM `offset` (F2): the rete
  // default shifts the anchor 12px OUTWARD on the X axis only (`x + 12·(input?−1:1)`) —
  // correct for left/right, wrong for top/bottom. We resolve each socket's visual
  // position and shift on the matching axis (±x for left/right — IDENTICAL to the default,
  // so the rete-flow-align cell stays green; ±y for top/bottom). The position is looked up
  // live via nodeMeta→type→portReg, so it tracks late-registered ports.
  const SOCKET_SHIFT = 12;
  const socketOffset = (position: any, nodeId: any, side: any, key: any) => {
    const meta = nodeMeta.get(nodeId);
    const p = meta ? resolvePortPosition(meta.type, side, key) : side === 'input' ? 'left' : 'right';
    if (p === 'top') return {
      x: position.x,
      y: position.y - SOCKET_SHIFT
    };
    if (p === 'bottom') return {
      x: position.x,
      y: position.y + SOCKET_SHIFT
    };
    if (p === 'left') return {
      x: position.x - SOCKET_SHIFT,
      y: position.y
    };
    return {
      x: position.x + SOCKET_SHIFT,
      y: position.y
    };
  };
  socketWatcher = getDOMSocketPosition({
    offset: socketOffset
  });
  editor.use(area);
  area.use(connectionPlugin);
  // The socket-position watcher (and, conceptually, our vanilla "render plugin")
  // must attach to a CHILD scope of the area — `attach` calls
  // `scope.parentScope(BaseAreaPlugin)`, which walks UP one level, so the scope's
  // parent must BE the area. Attaching to `area` itself fails ("actual parent is
  // not instance of type") because area's parent is the NodeEditor. So we add a
  // minimal child Scope and attach the watcher to it. Rete forwards every area
  // signal (render/nodetranslated/unmount/…) into this child's signal, so the
  // watcher sees socket renders + node moves and recomputes socket positions.
  renderScope = new Scope('rozie-vanilla-render');
  area.use(renderScope);
  socketWatcher.attach(renderScope);

  // ── selection (selectableNodes) ──
  if (selectable && !readonly) {
    selector = AreaExtensions.selector();
    AreaExtensions.selectableNodes(area, selector, {
      accumulating: accumulateOnCtrl ? AreaExtensions.accumulateOnCtrl() : {
        active: () => false
      }
    });
  }
  // raise the picked node above its siblings.
  AreaExtensions.simpleNodesOrder(area);

  // ── zoom clamp (restrictor) ──
  const min = typeof minZoom === 'number' && minZoom > 0 ? minZoom : 0;
  const max = typeof maxZoom === 'number' && maxZoom > 0 ? maxZoom : 0;
  if (min || max) {
    AreaExtensions.restrictor(area, {
      scaling: {
        min: min || 0.01,
        max: max || 100
      }
    });
  }

  // ── snap-to-grid ──
  if (typeof snapGrid === 'number' && snapGrid > 0) {
    AreaExtensions.snapGrid(area, {
      size: snapGrid,
      dynamic: true
    });
  }

  // ── interaction toggles ──
  if (!pannable) area.area.setDragHandler(null);
  if (!zoomable) area.area.setZoomHandler(null);

  // ── Delete / Backspace key → cascading delete of the selected node(s) (Win 1) ──
  // Attached to the engine container ($refs.canvasEl, which carries tabindex="0" in
  // the template so it can receive key focus) rather than `document`: the listener
  // lives INSIDE the Lit shadow root alongside the canvas, so a canvas-focused key
  // reaches it on Lit too (a `:target="document"` listener does not reliably see
  // shadow-scoped focus across all 6 — the canvas-element listener is the robust
  // cross-target path). Gated on selectable && !readonly. We guard against deleting
  // while focus is in a node-body text field (INPUT/TEXTAREA/contenteditable) so
  // typing in a node never nukes it. The listener is removed in the teardown.
  if (selectable && !readonly && container && typeof container.addEventListener === 'function') {
    onCanvasKeydown = (e: any) => {
      if (!e) return;
      const t = e.target;
      // Focus-guard (verbatim with the Delete branch): never act while focus is in a
      // node-body text field (INPUT/TEXTAREA/contenteditable) — Ctrl+Z must reach the
      // browser's native text undo there, and Delete must not nuke the node.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // ── T1.3 — Undo / Redo keybinds (D-02). Ctrl/Cmd+Z → undo; Ctrl/Cmd+Shift+Z and
      // Ctrl/Cmd+Y → redo. Gated on the SAME focus-guard as Delete. preventDefault so the
      // browser's page-level undo doesn't also fire. `metaKey` covers macOS Cmd. ──
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = typeof e.key === 'string' ? e.key.toLowerCase() : '';
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }
        if (k === 'z' && e.shiftKey || k === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const ids = selectedNodeIds();
      if (ids.length > 0) {
        e.preventDefault();
        for (const id of ids as any) deleteNode(id);
        return;
      }
      // T1.1 — EDGE DELETE (D-08). No node is picked but an edge is selected → remove
      // exactly that edge via the controlled-graph write-back (the disconnect path: a
      // fresh `{ ...g, connections: filtered }` object), then clear the selection. The
      // wrapper's own $watch(graph) reconcile reaps the live engine connection (the
      // single removal path — we do NOT also call editor.removeConnection, which would
      // race the reconcile into "cannot find connection", mirroring deleteNode). Node
      // delete takes precedence (handled above); this only runs when nothing's picked.
      if (selectedConnId != null) {
        e.preventDefault();
        const id = selectedConnId;
        clearEdgeSelection();
        writeBackConnectionRemoved(id);
      }
    };
    keydownContainer = container;
    container.addEventListener('keydown', onCanvasKeydown);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THE VANILLA RENDER PIPE. Intercepts the AreaPlugin's render/unmount signals.
  // ALWAYS returns context (returning undefined would halt the signal chain and
  // break the ConnectionPlugin / socket watcher downstream).
  // ─────────────────────────────────────────────────────────────────────────
  area.addPipe((context: any) => {
    if (!context || typeof context !== 'object' || !('type' in context)) return context;
    if (context.type === 'render') {
      const data = context.data;
      if (data.type === 'node') renderNode(data.element, data.payload);else if (data.type === 'connection') renderConnection(data.element, data.payload, data.start, data.end);
      // data.type === 'socket' (our own re-emitted signals) falls through
      // untouched so the ConnectionPlugin + socketWatcher consume them.
    } else if (context.type === 'unmount') {
      cleanupElement(context.data.element);
    }
    return context;
  });

  // ── node renderer ──
  // Fills the engine-created nodeView element with: input sockets, the body
  // (consumer `node` portal fragment OR default chrome), and output sockets.
  // Re-render (area.update('node', id)) reuses the same element → update in place.
  // NOTE: the engine-node parameter is `reteNode`, NOT `node` — on Svelte the
  // `$slots.node` slot lowers to a top-level `const node`, and a parameter named
  // `node` here would SHADOW it, so `if ($slots.node)` would read the (always-
  // truthy) engine node and wrongly take the portal branch even when the slot is
  // unfilled (dropping the default-chrome title). The cross-target slot-name ==
  // local-binding shadow trap.
  const renderNode = (element: any, reteNode: any) => {
    // a (re)render means node DOM exists / changed → refresh the minimap (its node
    // rects measure these elements; coalesced, so calling it on every render is cheap,
    // and it covers Lit's measure-after-first-paint).
    if (scheduleMinimapRedraw) scheduleMinimapRedraw();
    const id = reteNode.id;
    const meta = nodeMeta.get(id) || {
      id,
      type: undefined,
      data: {}
    };
    const existing = nodeEntries.get(id);
    const selected = reteNode.selected === true;
    // default-chrome fallback label (only when a node's type has no #body template).
    const chromeLabel = meta.data && meta.data.label != null ? String(meta.data.label) : meta.type != null ? String(meta.type) : '';
    if (existing && existing.element === element) {
      // in-place update — refresh chrome + reactive portal scope, leave sockets.
      existing.box.classList.toggle('is-selected', selected);
      if (existing.handle) {
        existing.handle.update({
          node: meta,
          selected,
          emit: existing.emit
        });
      } else if (existing.titleEl) {
        existing.titleEl.textContent = chromeLabel;
      }
      return;
    }

    // fresh build
    element.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'rozie-flow-node' + (selected ? ' is-selected' : '');
    const body = document.createElement('div');
    body.className = 'rozie-flow-node__body';

    // ── socket layout (F2: position-aware) ───────────────────────────────────────
    // Bucket the node's ports by VISUAL position (default input→left, output→right).
    // When NO port is top/bottom (every pre-F2 graph), render the EXACT classic
    // [inputsCol | body | outputsCol] 3-column structure — byte-identical DOM, so the
    // FlowCanvasScreenshot pixel baseline is untouched. A node that declares ANY top/
    // bottom port gets the 3-ROW structure (topRow / midRow[left|body|right] / bottomRow).
    const socketDisposers = [];
    const portEntries = [];
    for (const key of Object.keys(reteNode.inputs) as any) portEntries.push({
      side: 'input',
      key,
      position: resolvePortPosition(meta.type, 'input', key)
    });
    for (const key of Object.keys(reteNode.outputs) as any) portEntries.push({
      side: 'output',
      key,
      position: resolvePortPosition(meta.type, 'output', key)
    });
    const hasVertical = portEntries.some((p: any) => p.position === 'top' || p.position === 'bottom');
    if (!hasVertical) {
      // CLASSIC left/right layout — byte-for-byte identical to pre-F2 (pixel-baseline safe).
      const inputsCol = document.createElement('div');
      inputsCol.className = 'rozie-flow-node__col rozie-flow-node__col--in';
      const outputsCol = document.createElement('div');
      outputsCol.className = 'rozie-flow-node__col rozie-flow-node__col--out';
      box.appendChild(inputsCol);
      box.appendChild(body);
      box.appendChild(outputsCol);
      element.appendChild(box);
      for (const p of portEntries as any) {
        renderSocketInto(p.position === 'right' ? outputsCol : inputsCol, reteNode, p.side, p.key, p.position, socketDisposers);
      }
    } else {
      // VERTICAL-capable 3-row layout (only when a top/bottom port exists).
      box.classList.add('rozie-flow-node--rows');
      const topRow = document.createElement('div');
      topRow.className = 'rozie-flow-node__row rozie-flow-node__row--top';
      const midRow = document.createElement('div');
      midRow.className = 'rozie-flow-node__mid';
      const leftCol = document.createElement('div');
      leftCol.className = 'rozie-flow-node__col rozie-flow-node__col--in';
      const rightCol = document.createElement('div');
      rightCol.className = 'rozie-flow-node__col rozie-flow-node__col--out';
      const bottomRow = document.createElement('div');
      bottomRow.className = 'rozie-flow-node__row rozie-flow-node__row--bottom';
      midRow.appendChild(leftCol);
      midRow.appendChild(body);
      midRow.appendChild(rightCol);
      box.appendChild(topRow);
      box.appendChild(midRow);
      box.appendChild(bottomRow);
      element.appendChild(box);
      for (const p of portEntries as any) {
        const zone = p.position === 'top' ? topRow : p.position === 'bottom' ? bottomRow : p.position === 'right' ? rightCol : leftCol;
        renderSocketInto(zone, reteNode, p.side, p.key, p.position, socketDisposers);
      }
    }

    // emit per-node event helper handed to the slot scope so a consumer node body
    // can raise a custom event carrying its id (e.g. a delete button).
    const emit = (name: any, detail: any) => onnodeaction?.({
      id,
      name,
      detail
    });
    const entry = {
      element,
      box,
      body,
      handle: null,
      bodyHandle: null,
      titleEl: null,
      bodyMoved: false,
      emit,
      socketDisposers
    };

    // ── RENDER-BY-TYPE: select the body by `node.type` ──────────────────────────
    // 1) the node's TYPE template (typeReg[type].bodyRenderer) — the primary path
    //    (41-03 <NodeType><template #body>); 2) the low-level `#node` portal slot
    //    (consumer switches on node.type itself — escape hatch); 3) default chrome.
    const typeSpec = meta.type != null ? typeReg[meta.type] : null;
    if (typeSpec && typeof typeSpec.bodyRenderer === 'function') {
      // RENDER-BY-TYPE callback path. The <NodeType> cannot relocate its OWN <slot>
      // across the Lit shadow boundary (Wave-0 A3), so the PARENT projects the body
      // here from its own render scope: the type's registered bodyRenderer(host, scope)
      // mounts the type's `#body` portal INTO the engine `body` div (a FRESH render
      // root per node — no framework DOM relocation, the Phase-37 D-04 trap avoided).
      // nodeEntries must exist before the callback runs (bodyHostFor reads it), so
      // register first. The graph node's `data` flows in as scope → one template per
      // type renders every instance of that type.
      nodeEntries.set(id, entry);
      entry.bodyHandle = typeSpec.bodyRenderer(body, {
        node: meta,
        selected,
        emit
      });
      entry.bodyMoved = true;
      return;
    }
    if (node) {
      // reactive multi-instance portal — one handle per node, re-rendered in
      // place on meta change (the MapLibre marker discipline). Low-level escape
      // hatch: the consumer switches on node.type inside the single `#node` slot.
      entry.handle = portals.node(body, {
        node: meta,
        selected,
        emit
      });
    } else {
      // default chrome: a title bar (the type name / data.label).
      const title = document.createElement('div');
      title.className = 'rozie-flow-node__title';
      title.textContent = chromeLabel;
      body.appendChild(title);
      entry.titleEl = title;
    }
    nodeEntries.set(id, entry);
  };

  // Render ONE socket into a zone and, crucially, EMIT its render signal so the
  // ConnectionPlugin + position watcher register it. `position` is the socket's visual
  // placement (left|right|top|bottom). For left/right the DOM is byte-identical to pre-F2
  // (the classic horizontal port row); top/bottom get a vertical port (socket above its
  // label) + a `--<position>` socket class so the socket straddles the matching edge.
  const renderSocketInto = (zone: any, reteNode: any, side: any, key: any, position: any, socketDisposers: any) => {
    const port = (side === 'input' ? reteNode.inputs : reteNode.outputs)[key];
    if (!port) return;
    const vertical = position === 'top' || position === 'bottom';
    const row = document.createElement('div');
    row.className = 'rozie-flow-port rozie-flow-port--' + side + (vertical ? ' rozie-flow-port--vertical' : '');
    const socketEl = document.createElement('div');
    socketEl.className = 'rozie-flow-socket rozie-flow-socket--' + side + (vertical ? ' rozie-flow-socket--' + position : '');
    socketEl.setAttribute('data-testid', 'socket');
    const label = document.createElement('span');
    label.className = 'rozie-flow-port__label';
    label.textContent = port.label != null ? String(port.label) : key;

    // CLASSIC: inputs socket-first, outputs label-first (byte-identical to pre-F2).
    // VERTICAL: socket-first (the socket sits on the edge, label tucked inward).
    if (side === 'input' || vertical) {
      row.appendChild(socketEl);
      row.appendChild(label);
    } else {
      row.appendChild(label);
      row.appendChild(socketEl);
    }
    zone.appendChild(row);

    // LOAD-BEARING: announce the socket to the rest of the area's child plugins.
    // 'render' lets the ConnectionPlugin register the socket as a drag anchor.
    area.emit({
      type: 'render',
      data: {
        type: 'socket',
        side,
        key,
        nodeId: reteNode.id,
        element: socketEl,
        payload: {
          socket: port.socket
        }
      }
    });
    // ALSO LOAD-BEARING (the socket-position contract): getDOMSocketPosition measures +
    // stores a socket's DOM position ONLY on a 'rendered' socket signal — the render-plugin
    // lifecycle's post-mount phase. Our vanilla pipe creates + appends the socket DOM
    // synchronously, so we fire 'rendered' right after 'render'. WITHOUT IT the position
    // store stays empty, every socketWatcher.listen() callback reads null, and NO
    // connection path (committed OR drag preview) is ever drawn.
    area.emit({
      type: 'rendered',
      data: {
        type: 'socket',
        side,
        key,
        nodeId: reteNode.id,
        element: socketEl,
        payload: {
          socket: port.socket
        }
      }
    });
    socketDisposers.push(() => {
      area.emit({
        type: 'unmount',
        data: {
          element: socketEl
        }
      });
    });
  };

  // ── hand-written edge-type path generators (T1.2, D-01) ───────────────────────
  // `rete-render-utils` ships ONLY `classicConnectionPath` (bezier) + `loopConnectionPath`;
  // step/smoothstep/straight do NOT exist in any installed rete package, so they are
  // hand-written here matching React-Flow's `step|smoothstep|straight` semantics. Each is a
  // PURE `(start, end) → d-string` function over `{x,y}` graph-screen points; the `d` is
  // composed from numeric coords + literal SVG commands and written via setAttribute (never
  // innerHTML — no injection, T-44-02-2 accept). The default branch stays
  // `classicConnectionPath` → byte-identical bezier (pixel-baseline safe).
  // straight: a single line, no curvature.
  const straightPath = (s: any, e: any) => `M ${s.x} ${s.y} L ${e.x} ${e.y}`;
  // step: orthogonal HV-VH with a mid-X break.
  const stepPath = (s: any, e: any) => {
    const mx = (s.x + e.x) / 2;
    return `M ${s.x} ${s.y} L ${mx} ${s.y} L ${mx} ${e.y} L ${e.x} ${e.y}`;
  };
  // smoothstep: step with rounded corners (radius r, clamped to half the shorter leg).
  const smoothstepPath = (s: any, e: any, r = 8) => {
    const mx = (s.x + e.x) / 2;
    const dir = e.y >= s.y ? 1 : -1;
    const rr = Math.min(r, Math.abs(mx - s.x), Math.abs(e.y - s.y) / 2);
    return [`M ${s.x} ${s.y}`, `L ${mx - rr} ${s.y}`, `Q ${mx} ${s.y} ${mx} ${s.y + dir * rr}`, `L ${mx} ${e.y - dir * rr}`, `Q ${mx} ${e.y} ${mx + rr} ${e.y}`, `L ${e.x} ${e.y}`].join(' ');
  };

  // ── connection renderer ──
  // Mounts an <svg><path> and redraws it whenever either endpoint socket moves
  // (real connection) OR the dragged pointer moves (user drag-to-connect pseudo).
  //
  // A USER DRAG renders a *pseudo-connection* (rete-connection-plugin): the render
  // signal carries a literal pointer coordinate (`endPointer`/`data.end` when
  // dragging FROM an output, `startPointer`/`data.start` when dragging FROM an
  // input) alongside a payload with ONE DANGLING endpoint — `target:''`/
  // `targetInput:''` (output-side drag) or `source:''`/`sourceOutput:''`
  // (input-side drag). The dangling side has no socket to watch, so its coordinate
  // MUST come from the pointer; the live side stays watcher-driven. The
  // ConnectionPlugin re-emits this render on EVERY pointermove with a fresh pointer
  // — so the same pseudo element is re-rendered repeatedly and the dangling
  // coordinate must update in place (no SVG rebuild, no listener re-subscribe).
  const renderConnection = (element: any, connection: any, startPointer: any, endPointer: any) => {
    const id = connection.id;
    // A side is dangling when its node id OR its port key is empty/nullish.
    const srcDangling = !connection.source || !connection.sourceOutput;
    const tgtDangling = !connection.target || !connection.targetInput;

    // RE-RENDER of the SAME element (the pseudo on each pointermove): do NOT rebuild
    // the SVG or re-subscribe listeners (would leak) — just update the dangling
    // side's coordinate and redraw. This replaces the old unconditional early-return
    // that froze the preview line. For a REAL connection updatePointer is a no-op,
    // so a re-render of a committed edge is byte-for-byte the old early-return.
    const prev = connEntries.get(id);
    if (prev && prev.element === element) {
      prev.updatePointer(startPointer, endPointer);
      return;
    }
    element.innerHTML = '';
    element.classList.add('rozie-flow-connection');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'rozie-flow-connection__svg');

    // ── direction arrowhead (Win 3) ─────────────────────────────────────────────
    // A <defs><marker> in THIS connection's own <svg>, referenced by `marker-end` so
    // the triangle sits at the path END (the input socket — the path runs output→input,
    // so marker-end points INTO the target). The marker id is UNIQUE per connection
    // (`rozie-arrow-<id>`) so two edges' markers never collide on a shared document id
    // (url(#id) resolves to the first match otherwise). The def lives in the SAME
    // per-edge <svg> inside the SAME shadow root as the path, so url(#id) resolves
    // within that root — no cross-root reference (Lit-safe). markerUnits="userSpaceOnUse"
    // keeps a constant pixel size under the area zoom transform. Inline fill (#64748b,
    // matching the connection stroke) is the cross-target-safe choice — no scoped-CSS /
    // :root rule needed for the marker DOM. The marker is purely decorative — it does
    // NOT touch the path `d` / socket alignment (the rete-flow-align cell stays green).
    const markerId = 'rozie-arrow-' + String(id);
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('class', 'rozie-flow-connection__arrow');
    arrow.setAttribute('d', 'M0,0 L6,3 L0,6 Z');
    arrow.setAttribute('fill', '#64748b');
    marker.appendChild(arrow);
    defs.appendChild(marker);
    svg.appendChild(defs);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'rozie-flow-connection__path');
    path.setAttribute('marker-end', 'url(#' + markerId + ')');
    svg.appendChild(path);

    // ── T1.1 edge-select listener (D-08) ─────────────────────────────────────────
    // Attach an IMPERATIVE pointerup listener on the engine-DOM <path> (NOT a template
    // `@` — the path is engine-created; NOT click — Rete swallows it; NOT pointerdown —
    // Rete stopPropagations it: the Phase-41 connector landmine, playbook §6a item 7).
    // Gated on `selectable && !readonly` (mirrors node delete) and ONLY for COMMITTED
    // edges — a drag-to-connect pseudo (either side dangling) carries no stable id and
    // must not be selectable. `selectEdge` reads the id back off the closure (the
    // committed connection.id == the graph connection id — conn.id = spec.id at build),
    // so it always matches what `writeBackConnectionRemoved` filters. `.stop` keeps the
    // pointerup from reaching the area's pan/background handling beneath the path.
    if (selectable && !readonly && !srcDangling && !tgtDangling) {
      path.style.cursor = 'pointer';
      path.addEventListener('pointerup', (e: any) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        selectEdge(connection.id, path);
      });
    }

    // ── per-edge label + styling (F3) ────────────────────────────────────────────
    // The consumer's connection spec ({ id, source, …, label?, stroke?, dashed? }) is kept
    // in connMeta keyed by id (the connection-side analog of nodeMeta). A committed edge
    // resolves its label/style here; a drag-preview pseudo (no committed id) has none.
    // Styling is applied as INLINE attributes (the arrowhead-marker discipline — engine DOM
    // carries no scope attr); a `label` renders an SVG <text> at the path midpoint (white
    // halo via paint-order for legibility over the line), repositioned in redraw().
    const emeta = connMeta.get(connection.id) || null;
    if (emeta) {
      if (emeta.stroke != null) {
        const s = String(emeta.stroke);
        path.setAttribute('stroke', s);
        arrow.setAttribute('fill', s);
      }
      if (emeta.dashed === true) path.setAttribute('stroke-dasharray', '7 5');
    }
    // ── resolved edge type (T1.2) ────────────────────────────────────────────────
    // The consumer-supplied `connection.type` selects a path generator. ALLOWLIST it
    // (`bezier|step|smoothstep|straight`); any other/absent value falls through to the
    // bezier default — no dynamic path-fn lookup keyed on the raw string, no eval
    // (T-44-02-1 mitigate). A dangling drag-preview pseudo has no committed connMeta
    // entry, so it stays bezier too.
    const rawType = emeta && emeta.type != null ? String(emeta.type) : 'bezier';
    const edgeType = rawType === 'step' || rawType === 'smoothstep' || rawType === 'straight' ? rawType : 'bezier';
    let labelEl: any = null;
    const edgeLabel = emeta && emeta.label != null ? String(emeta.label) : null;
    if (edgeLabel) {
      labelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelEl.setAttribute('class', 'rozie-flow-connection__label');
      labelEl.setAttribute('text-anchor', 'middle');
      labelEl.setAttribute('dominant-baseline', 'middle');
      labelEl.textContent = edgeLabel;
      svg.appendChild(labelEl);
    }
    element.appendChild(svg);
    let start: any = null;
    let end: any = null;
    const curvature$local = typeof curvature === 'number' ? curvature : 0.3;
    const redraw = () => {
      if (!start || !end) return;
      // branch on the resolved edge type; default (bezier/unknown) stays
      // classicConnectionPath UNCHANGED → byte-identical bezier output.
      const d = edgeType === 'step' ? stepPath(start, end) : edgeType === 'smoothstep' ? smoothstepPath(start, end) : edgeType === 'straight' ? straightPath(start, end) : classicConnectionPath([start, end], curvature$local);
      path.setAttribute('d', d);
      if (labelEl) {
        labelEl.setAttribute('x', String((start.x + end.x) / 2));
        labelEl.setAttribute('y', String((start.y + end.y) / 2));
      }
    };

    // Seed the DANGLING side's coordinate from the pointer FIRST — socketWatcher
    // .listen() synchronously replays the current socket snapshot on subscribe, so
    // seeding before subscribing the live side means redraw() already has the
    // dangling coordinate and the preview line draws immediately on the first render.
    if (srcDangling && startPointer) start = startPointer;
    if (tgtDangling && endPointer) end = endPointer;

    // LIVE endpoints stay watcher-driven (exactly as before the fix — committed
    // connections behave byte-for-byte). DANGLING endpoints subscribe NO listener
    // (it would never fire — there is no socket); their coordinate is the pointer.
    let un1: any = null;
    let un2: any = null;
    if (!srcDangling) un1 = socketWatcher.listen(connection.source, 'output', connection.sourceOutput, (p: any) => {
      start = p;
      redraw();
    });
    if (!tgtDangling) un2 = socketWatcher.listen(connection.target, 'input', connection.targetInput, (p: any) => {
      end = p;
      redraw();
    });

    // Update only the DANGLING side(s) from a fresh pointer on each subsequent
    // render call. For a REAL connection (neither side dangling) this is a no-op,
    // so committed connections never have a pointer override and keep behaving
    // exactly as before.
    const updatePointer = (sp: any, ep: any) => {
      let moved = false;
      if (srcDangling && sp) {
        start = sp;
        moved = true;
      }
      if (tgtDangling && ep) {
        end = ep;
        moved = true;
      }
      if (moved) redraw();
    };

    // Draw once now: a pseudo seeded with an initial pointer (+ its live side
    // already replayed) draws immediately; a real connection whose sockets are
    // already known also draws (idempotent — same `d` the listeners just set).
    redraw();
    connEntries.set(id, {
      element,
      updatePointer,
      dispose: () => {
        try {
          un1 && un1();
        } catch (e: any) {}
        try {
          un2 && un2();
        } catch (e: any) {}
      }
    });
  };

  // ── unmount cleanup (keyed by the engine element area hands back) ──
  const cleanupElement = (element: any) => {
    for (const [id, entry] of nodeEntries as any) {
      if (entry.element === element) {
        if (entry.handle) entry.handle.dispose();
        if (entry.bodyHandle && entry.bodyHandle.dispose) {
          try {
            entry.bodyHandle.dispose();
          } catch (e: any) {}
        }
        for (const d of entry.socketDisposers as any) {
          try {
            d();
          } catch (e: any) {}
        }
        nodeEntries.delete(id);
        return;
      }
    }
    for (const [id, entry] of connEntries as any) {
      if (entry.element === element) {
        entry.dispose();
        connEntries.delete(id);
        return;
      }
    }
  };

  // Resolve a single port's TYPE for the validation pipe: look up the live node's
  // `type` (via nodeMeta) then the portReg entry keyed `type::side::key`. Returns the
  // portType string or null (null on either side ⇒ no type constraint ⇒ allow). DEFINED
  // HERE (inside $onMount) — NOT at top level — so its $data.portReg read lowers on React
  // to the live `_portRegRef.current` rather than a stale-empty closure snapshot captured
  // when this once-only mount effect first ran (the cross-type-reject-didn't-fire bug).
  const portTypeOf = (nodeId: any, side: any, key: any) => {
    const meta = nodeMeta.get(nodeId);
    if (!meta || meta.type == null || key == null) return null;
    const entry = portReg[meta.type + '::' + side + '::' + key];
    return entry ? entry.portType : null;
  };

  // ─── connection-validation gate (D2/D3 — typed-socket validation + override) ──
  // Cancels Rete's cancellable `connectioncreate` pre-event when the connection is
  // rejected. TWO independent reject paths, both surfacing `connection-rejected`:
  //   1. AUTOMATIC typed validation (`:validate-types`, default ON, D3 option a):
  //      resolve src/tgt port TYPE from the per-TYPE port schema (via each endpoint
  //      node's `type`); if both are non-null and UNEQUAL → reject. A null on either
  //      side (untyped port / unknown type) imposes no constraint → allow.
  //   2. `canConnect` OVERRIDE (Phase-40 contract, SURVIVES): a consumer custom rule;
  //      runs IN ADDITION to (after) the automatic check; returning false rejects.
  // Cancelling makes editor.addConnection return false WITHOUT pushing the connection
  // or emitting `connectioncreated` — no ghost edge, no `connection-created`. Gates
  // drag-to-connect, imperative addConnection, and reconcile uniformly. Both predicates
  // are PURE (no $data write / engine call) — reads only. The block (return undefined)
  // stays UNCONDITIONAL so rejection is enforced on every path; only the EMIT is
  // echo-guarded (a programmatic reconcile the rule would reject must not surface as a
  // user-facing rejection — mirrors connection-created/connection-removed).
  editor.addPipe((context: any) => {
    if (!context || typeof context !== 'object' || !('type' in context)) return context;
    if (context.type === 'connectioncreate') {
      const c = context.data;
      // ClassicPreset.Connection fields: { id, source, sourceOutput, target, targetInput }.
      // Same shape as serializeConn minus the engine-assigned `id` (never created).
      const conn = {
        source: c.source,
        sourceOutput: c.sourceOutput,
        target: c.target,
        targetInput: c.targetInput
      };
      // 1. AUTOMATIC typed validation (default ON; opt out via :validate-types="false").
      if (validateTypes !== false) {
        const srcType = portTypeOf(c.source, 'output', c.sourceOutput);
        const tgtType = portTypeOf(c.target, 'input', c.targetInput);
        if (srcType != null && tgtType != null && srcType !== tgtType) {
          if (!programmatic) onconnectionrejected?.(conn);
          return undefined; // ← CANCEL: type mismatch
        }
      }
      // 2. canConnect OVERRIDE (Phase-40 contract — custom rule, in addition).
      if (typeof canConnect === 'function' && canConnect(conn) === false) {
        if (!programmatic) onconnectionrejected?.(conn);
        return undefined; // ← CANCEL: Signal.emit halts, addConnection returns false
      }
    }
    return context;
  });

  // ─── forward engine events (echo-guarded via `programmatic`) ───────────────
  editor.addPipe((context: any) => {
    if (!context || typeof context !== 'object' || !('type' in context)) return context;
    if (context.type === 'connectioncreated') {
      // keep engine truth in sync so reconcile diffs correctly — a user-drawn
      // connection (auto id) must register here or the next graph pass re-adds it.
      connInstances.set(context.data.id, context.data);
      if (!programmatic) {
        // WRITE-BACK: append the new connection into a fresh graph object (D4).
        writeBackConnectionCreated(context.data);
        // keep the discrete event too (back-compat).
        onconnectioncreated?.(serializeConn(context.data));
      }
    } else if (context.type === 'connectionremoved') {
      connInstances.delete(context.data.id);
      connMeta.delete(context.data.id);
      if (!programmatic) {
        // WRITE-BACK: filter the removed connection out of a fresh graph object (D4).
        writeBackConnectionRemoved(context.data.id);
        onconnectionremoved?.({
          id: context.data.id
        });
      }
    }
    return context;
  });
  area.addPipe((context: any) => {
    if (!context || typeof context !== 'object' || !('type' in context)) return context;
    if (context.type === 'nodepicked') {
      onnodepicked?.({
        id: context.data.id
      });
      // Win 2: a pick changed the selection — surface @selection-change after the
      // engine's awaited select() for THIS pick has flushed the selector entities.
      scheduleSelectionEmit();
    } else if (context.type === 'pointerup') {
      // Win 2: AreaExtensions.selectableNodes UNSELECTS all on a click-like background
      // pointerUP (its `twitch < 4` deselect — NOT on pointerdown, verified against
      // rete-area-plugin's selectable pipe). Its unselectAll() is async and its pipe
      // runs before ours, so recompute AFTER its awaited unselectAll() flushes (the
      // microtask + rAF schedule). The dedup makes a no-op when nothing changed (e.g. a
      // pointerup that ended a node pick — already surfaced by the nodepicked branch).
      scheduleSelectionEmit();
      // T1.1: a background pointerup (anywhere not on a connection path) clears the edge
      // selection — UNLESS this same gesture just selected an edge (the path's own
      // pointerup ran in the same tick and raised `edgeClickGuard`; the guard self-resets
      // on the next microtask). Mirrors the node selectable's click-to-deselect.
      if (!edgeClickGuard && selectedConnId != null) clearEdgeSelection();
    } else if (context.type === 'nodetranslated') {
      if (!programmatic) {
        const id = context.data.id;
        const pos = context.data.position;
        const meta = nodeMeta.get(id);
        if (meta) {
          meta.x = pos.x;
          meta.y = pos.y;
        }
        // WRITE-BACK (coalesced): accumulate the latest position for this node and
        // flush ONE fresh graph object per animation frame (Pitfall 2 — the drag
        // storm). The discrete `node-moved` emit stays per-translate (back-compat).
        pendingDragPositions.set(id, {
          x: pos.x,
          y: pos.y
        });
        scheduleDragFlush();
        onnodemoved?.({
          id,
          x: pos.x,
          y: pos.y
        });
      }
      // a node moved → its minimap rect moves (works during a programmatic translate too).
      if (scheduleMinimapRedraw) scheduleMinimapRedraw();
    } else if (context.type === 'translated') {
      ontranslated?.({
        x: context.data.position.x,
        y: context.data.position.y
      });
      // the viewport window moved → redraw the minimap viewport rect + mask.
      if (scheduleMinimapRedraw) scheduleMinimapRedraw();
    } else if (context.type === 'zoomed') {
      if (!programmatic) {
        const k = area.area.transform.k;
        if (k !== zoom) zoom = k;
      }
      // the viewport window resized (zoom) → redraw the minimap viewport rect + mask.
      if (scheduleMinimapRedraw) scheduleMinimapRedraw();
    } else if (context.type === 'contextmenu') {
      // suppress the native browser menu over the canvas; surface a hook instead.
      context.data.event.preventDefault();
      const ctx = context.data.context;
      oncontextmenu?.({
        id: ctx && ctx.id ? ctx.id : null
      });
    }
    return context;
  });

  // ─── reconciler off the bound graph, bridged to the top-level $watch ──────────
  // Nodes come ONLY from `$props.graph.nodes` (the single source of truth, D1/D2);
  // sockets come from each node's TYPE port schema (portReg keyed `type::side::key`).
  // A port-schema change ($data.portReg, when a <Port> registers late on Lit) ALSO
  // drives this reconcile so a node whose type just gained ports re-renders. An
  // imperative $expose addNode (provenance NOT in lastPropNodeIds) survives the reaper.
  // Wrapped by reconcileNodes (below) with a re-entrancy guard so two passes never
  // race the engine (the Lit "cannot find node" fix).
  const reconcileNodesPass = async () => {
    if (!editor || !area) return;
    const graphNodes = Array.isArray(graph && graph.nodes) ? graph.nodes : [];
    const want = [];
    programmatic++;
    try {
      for (const spec of graphNodes as any) {
        if (!spec || spec.id == null) continue;
        want.push(spec.id);
        nodeMeta.set(spec.id, spec);
        let node = nodeInstances.get(spec.id);
        if (!node) {
          node = buildNode(spec, portReg);
          nodeInstances.set(spec.id, node);
          await editor.addNode(node);
          await area.translate(spec.id, {
            x: spec.x || 0,
            y: spec.y || 0
          });
        } else {
          // Sync any ports this node's TYPE gained AFTER the node was first built —
          // a nested <Port>'s addTypePort can land after reconcileNodes already
          // created the node (the node registered before its ports on some targets,
          // or a <Port> registered late on Lit). buildNode only runs for NEW nodes,
          // so add the missing inputs/outputs onto the live instance here from the
          // TYPE schema, then re-render.
          let portsAdded = false;
          const {
            inputs: wantIn,
            outputs: wantOut
          } = portSchemaForType(spec.type, portReg);
          for (const inp of wantIn as any) {
            if (!inp || inp.key == null || node.inputs[inp.key]) continue;
            node.addInput(inp.key, new ClassicPreset.Input(SOCKET, inp.label, inp.multiple === true));
            portsAdded = true;
          }
          for (const out of wantOut as any) {
            if (!out || out.key == null || node.outputs[out.key]) continue;
            node.addOutput(out.key, new ClassicPreset.Output(SOCKET, out.label, out.multiple !== false));
            portsAdded = true;
          }
          const view = area.nodeViews.get(spec.id);
          if (view && spec.x != null && spec.y != null && (view.position.x !== spec.x || view.position.y !== spec.y)) {
            await area.translate(spec.id, {
              x: spec.x,
              y: spec.y
            });
          }
          if (portsAdded) {
            // renderNode's in-place branch deliberately leaves existing sockets
            // untouched; to render the NEW sockets, drop this node's render entry so
            // area.update takes the fresh-build path (re-runs buildSocketRow + re-
            // emits the socket render signals the ConnectionPlugin/watcher need). The
            // render-by-type body host is re-projected by the type's bodyRenderer
            // (mounts a fresh portal root into the same host — idempotent).
            const entry = nodeEntries.get(spec.id);
            if (entry) {
              if (entry.handle) entry.handle.dispose();
              if (entry.bodyHandle && entry.bodyHandle.dispose) {
                try {
                  entry.bodyHandle.dispose();
                } catch (e: any) {}
              }
              for (const d of entry.socketDisposers as any) {
                try {
                  d();
                } catch (e: any) {}
              }
              nodeEntries.delete(spec.id);
            }
          }
          await area.update('node', spec.id);
          // a port change must re-run connections — an edge that was skipped because
          // its endpoint port didn't exist yet can now be drawn.
          if (portsAdded && reconcileConnections) await reconcileConnections();
        }
      }
      // remove dropped GRAPH-managed nodes (+ their connections) — imperatively added
      // nodes (NOT in lastPropNodeIds) survive (the power-user escape hatch).
      const tracked = new Set(lastPropNodeIds);
      for (const id of tracked as any) {
        if (!want.includes(id) && nodeInstances.has(id)) {
          for (const c of editor.getConnections() as any) {
            if (c.source === id || c.target === id) await editor.removeConnection(c.id);
          }
          await editor.removeNode(id);
          nodeInstances.delete(id);
          nodeMeta.delete(id);
        }
      }
      lastPropNodeIds = want;
    } finally {
      programmatic--;
    }
  };

  // Re-entrancy-guarded entry point. If a pass is already running, mark a re-run and
  // return — the in-flight pass loops until no further request is pending. Serializing
  // overlapping reconciles is what stops the Lit async-context cascade from racing the
  // engine into "cannot find node" (which otherwise aborts the declarative graph build).
  reconcileNodes = async () => {
    if (reconcileNodesRunning) {
      reconcileNodesPending = true;
      return;
    }
    reconcileNodesRunning = true;
    try {
      do {
        reconcileNodesPending = false;
        await reconcileNodesPass();
      } while (reconcileNodesPending);
    } finally {
      reconcileNodesRunning = false;
    }
  };
  reconcileConnections = async () => {
    if (!editor) return;
    // Edges come ONLY from the bound graph's `connections` (the single source of
    // truth — declarative <Connection> children are gone). Normalize id-defaulting
    // (a connection authored without an id gets a stable derived id) so an edge the
    // canvas wrote back (carrying the engine id) and a hand-authored edge dedup.
    const graphConns = Array.isArray(graph && graph.connections) ? graph.connections : [];
    const norm = (spec: any) => {
      if (!spec || spec.source == null || spec.target == null) return null;
      const srcOut = spec.sourceOutput != null ? spec.sourceOutput : 'out';
      const tgtIn = spec.targetInput != null ? spec.targetInput : 'in';
      const id = spec.id != null ? spec.id : `${spec.source}:${srcOut}->${spec.target}:${tgtIn}`;
      // carry the optional per-edge label/style (F3) through to connMeta → renderConnection.
      return {
        id,
        source: spec.source,
        sourceOutput: srcOut,
        target: spec.target,
        targetInput: tgtIn,
        label: spec.label,
        stroke: spec.stroke,
        dashed: spec.dashed,
        type: spec.type
      };
    };
    // cheap style signature so a label/style/type change on an EXISTING edge re-renders it.
    const edgeStyleSig = (s: any) => s ? String(s.label) + '|' + String(s.stroke) + '|' + String(s.dashed) + '|' + String(s.type) : '';
    const merged = graphConns.map(norm).filter(Boolean);
    const want = [];
    programmatic++;
    try {
      for (const spec of merged as any) {
        if (!spec || spec.id == null) continue;
        want.push(spec.id);
        if (connInstances.has(spec.id)) {
          // existing edge — relabel/restyle in place if its label/style changed (the
          // controlled-graph expectation: edit the bound graph → see the change). Drop the
          // render entry so area.update takes the fresh-build path (re-applies label/style).
          const changed = edgeStyleSig(connMeta.get(spec.id)) !== edgeStyleSig(spec);
          connMeta.set(spec.id, spec);
          if (changed) {
            const entry = connEntries.get(spec.id);
            if (entry) {
              entry.dispose();
              connEntries.delete(spec.id);
            }
            await area.update('connection', spec.id);
          }
          continue;
        }
        const sourceNode = nodeInstances.get(spec.source);
        const targetNode = nodeInstances.get(spec.target);
        if (!sourceNode || !targetNode) continue;
        // DEFENSIVE: the referenced output/input ports must exist on the live node
        // instances before addConnection (Rete throws "source node doesn't have
        // output with a key out" otherwise, aborting the loop). An edge may reference
        // a port the node's TYPE schema has not flushed yet (a <Port> registered
        // after the <NodeType>); skip until the ports exist — reconcileNodes re-runs
        // reconcileConnections after a port-schema change, so the edge lands later.
        if (!sourceNode.outputs || !sourceNode.outputs[spec.sourceOutput]) continue;
        if (!targetNode.inputs || !targetNode.inputs[spec.targetInput]) continue;
        const conn = new ClassicPreset.Connection(sourceNode, spec.sourceOutput, targetNode, spec.targetInput);
        conn.id = spec.id;
        connInstances.set(spec.id, conn);
        // seed connMeta BEFORE addConnection so renderConnection sees the label/style on
        // its first render (the render fires synchronously inside addConnection's pipe).
        connMeta.set(spec.id, spec);
        await editor.addConnection(conn);
      }
      // remove dropped GRAPH-managed edges — imperatively added edges survive.
      const tracked = new Set(lastPropConnIds);
      for (const id of tracked as any) {
        if (!want.includes(id) && connInstances.has(id)) {
          await editor.removeConnection(id);
          connInstances.delete(id);
          connMeta.delete(id);
        }
      }
      lastPropConnIds = want;
    } finally {
      programmatic--;
    }
  };

  // ─── built-in MiniMap (opt-in :minimap, Phase 42) ────────────────────────────
  // An absolute light-DOM SVG overlay (bottom-right) showing a scaled map of every
  // node + the current viewport window (outside dimmed), PANNABLE (drag recenters via
  // setCenter). The host div is COMPONENT-template DOM (carries the [data-rozie-s-*]
  // scope attr → plain scoped CSS positions it); its SVG children are built
  // IMPERATIVELY with createElementNS (the connection-renderer discipline) so SVG
  // namespacing is identical on all 6 (no SVG-in-template cross-target risk) and styled
  // with INLINE attributes (the arrowhead-marker lesson — no scoped-CSS / :root rule
  // needed for engine-style DOM). Node dims come from the MEASURED engine node-view
  // elements (area.nodeViews.get(id).element offsetW/H — target-agnostic, like the
  // render pipe) with a default-rect fallback for Lit's unmeasured first paint.
  const measureNodeSize = (id: any) => {
    const view = area && area.nodeViews ? area.nodeViews.get(id) : null;
    const el = view && view.element ? view.element : null;
    const w = el && el.offsetWidth ? el.offsetWidth : MINIMAP_DEFAULT_NODE_W;
    const h = el && el.offsetHeight ? el.offsetHeight : MINIMAP_DEFAULT_NODE_H;
    return {
      w,
      h
    };
  };
  const mkMinimapRect = (x: any, y: any, w: any, h: any, cls: any, fill: any, stroke: any, strokeW: any) => {
    const r = document.createElementNS(SVGNS, 'rect');
    r.setAttribute('class', cls);
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(Math.max(w, 0)));
    r.setAttribute('height', String(Math.max(h, 0)));
    if (fill) r.setAttribute('fill', fill);
    if (stroke) {
      r.setAttribute('stroke', stroke);
      r.setAttribute('stroke-width', String(strokeW || 1));
    }
    return r;
  };

  // Rebuild the minimap SVG: node rects (selected highlighted) + a dim mask outside the
  // viewport (evenodd punch-out) + the viewport window outline. The bounds union the
  // node rects AND the viewport window so the viewport indicator stays in-frame even
  // when panned past the nodes. Stores `minimapMap` (the px↔graph mapping the pointer-
  // pan handlers read). Cheap (a handful of rects) → a full rebuild per frame is fine.
  const redrawMinimap = () => {
    minimapRedrawRaf = 0;
    if (!minimap || !minimapSvg || !area || !container) return;
    const t = area.area.transform;
    const k = t.k || 1;
    const cw = container.clientWidth || MINIMAP_W;
    const ch = container.clientHeight || MINIMAP_H;
    // viewport window in GRAPH coords (screen [0,cw]×[0,ch] → graph).
    const vx = -t.x / k,
      vy = -t.y / k,
      vw = cw / k,
      vh = ch / k;
    const graphNodes = currentGraph().nodes || [];
    const selIds = new Set(selectedNodeIds().map((s: any) => String(s)));
    const rects = [];
    for (const n of graphNodes as any) {
      if (!n || n.id == null) continue;
      const view = area.nodeViews.get(n.id);
      const gx = view ? view.position.x : n.x || 0;
      const gy = view ? view.position.y : n.y || 0;
      const sz = measureNodeSize(n.id);
      rects.push({
        gx,
        gy,
        gw: sz.w,
        gh: sz.h,
        selected: selIds.has(String(n.id))
      });
    }
    let minX = vx,
      minY = vy,
      maxX = vx + vw,
      maxY = vy + vh;
    for (const r of rects as any) {
      if (r.gx < minX) minX = r.gx;
      if (r.gy < minY) minY = r.gy;
      if (r.gx + r.gw > maxX) maxX = r.gx + r.gw;
      if (r.gy + r.gh > maxY) maxY = r.gy + r.gh;
    }
    const padX = (maxX - minX) * 0.1 || 20;
    const padY = (maxY - minY) * 0.1 || 20;
    minX -= padX;
    minY -= padY;
    maxX += padX;
    maxY += padY;
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const scale = Math.min(MINIMAP_W / bw, MINIMAP_H / bh);
    const offX = (MINIMAP_W - bw * scale) / 2;
    const offY = (MINIMAP_H - bh * scale) / 2;
    minimapMap = {
      minX,
      minY,
      scale,
      offX,
      offY
    };
    const toMMx = (gx: any) => (gx - minX) * scale + offX;
    const toMMy = (gy: any) => (gy - minY) * scale + offY;
    minimapSvg.innerHTML = '';
    for (const r of rects as any) {
      const fill = r.selected ? '#3b82f6' : '#94a3b8';
      minimapSvg.appendChild(mkMinimapRect(toMMx(r.gx), toMMy(r.gy), r.gw * scale, r.gh * scale, 'rozie-flow-minimap__node', fill, null, 0));
    }
    // dim mask OUTSIDE the viewport: full minimap rect with the viewport rect punched
    // out (both subpaths same winding → fill-rule:evenodd leaves the viewport a hole).
    const mvx = toMMx(vx),
      mvy = toMMy(vy),
      mvw = vw * scale,
      mvh = vh * scale;
    const mask = document.createElementNS(SVGNS, 'path');
    mask.setAttribute('class', 'rozie-flow-minimap__mask');
    mask.setAttribute('fill-rule', 'evenodd');
    mask.setAttribute('fill', 'rgba(15, 23, 42, 0.18)');
    mask.setAttribute('d', 'M0 0 H' + MINIMAP_W + ' V' + MINIMAP_H + ' H0 Z ' + 'M' + mvx + ' ' + mvy + ' h' + mvw + ' v' + mvh + ' h' + -mvw + ' Z');
    minimapSvg.appendChild(mask);
    minimapSvg.appendChild(mkMinimapRect(mvx, mvy, mvw, mvh, 'rozie-flow-minimap__viewport', 'none', '#3b82f6', 1.5));
  };

  // rAF-coalesced scheduler (bridged to the top-level $watch + the engine pipes). No-op
  // when :minimap is off (the bridge stays callable everywhere, cheap).
  scheduleMinimapRedraw = () => {
    if (!minimap || minimapRedrawRaf) return;
    if (typeof requestAnimationFrame === 'function') {
      minimapRedrawRaf = requestAnimationFrame(redrawMinimap);
    } else {
      minimapRedrawRaf = 1;
      Promise.resolve().then(redrawMinimap);
    }
  };

  // Map a minimap pointer event → graph coords (via the stored minimapMap) → setCenter.
  // Pan is a view op → allowed even when readonly, but gated by `pannable` (mirror the
  // main-canvas pannable gate). Pointer capture keeps the drag tracking off the box.
  const minimapPointerToGraph = (e: any) => {
    if (!minimapMap || !minimapHost) return null;
    const box = minimapHost.getBoundingClientRect();
    const rw = box.width || MINIMAP_W;
    const rh = box.height || MINIMAP_H;
    const mx = (e.clientX - box.left) * (MINIMAP_W / rw);
    const my = (e.clientY - box.top) * (MINIMAP_H / rh);
    return {
      gx: minimapMap.minX + (mx - minimapMap.offX) / minimapMap.scale,
      gy: minimapMap.minY + (my - minimapMap.offY) / minimapMap.scale
    };
  };
  if (minimap && minimapEl) {
    minimapHost = minimapEl;
    minimapSvg = document.createElementNS(SVGNS, 'svg');
    minimapSvg.setAttribute('class', 'rozie-flow-minimap__svg');
    minimapSvg.setAttribute('viewBox', '0 0 ' + MINIMAP_W + ' ' + MINIMAP_H);
    minimapSvg.setAttribute('preserveAspectRatio', 'none');
    minimapHost.appendChild(minimapSvg);
    onMinimapPointerDown = (e: any) => {
      if (!pannable) return;
      const g = minimapPointerToGraph(e);
      if (!g) return;
      minimapPanning = true;
      try {
        if (e.target && e.target.setPointerCapture && e.pointerId != null) e.target.setPointerCapture(e.pointerId);
      } catch (err: any) {}
      e.preventDefault();
      e.stopPropagation();
      setCenter(g.gx, g.gy, null);
    };
    onMinimapPointerMove = (e: any) => {
      if (!minimapPanning || !pannable) return;
      const g = minimapPointerToGraph(e);
      if (!g) return;
      e.preventDefault();
      setCenter(g.gx, g.gy, null);
    };
    onMinimapPointerUp = (e: any) => {
      if (!minimapPanning) return;
      minimapPanning = false;
      try {
        if (e.target && e.target.releasePointerCapture && e.pointerId != null) e.target.releasePointerCapture(e.pointerId);
      } catch (err: any) {}
    };
    minimapHost.addEventListener('pointerdown', onMinimapPointerDown);
    minimapHost.addEventListener('pointermove', onMinimapPointerMove);
    minimapHost.addEventListener('pointerup', onMinimapPointerUp);
  }

  // ─── initial graph: nodes first, then connections (connections reference live
  // node instances), then optional fit. Sequenced via an async IIFE so the
  // $onMount-returned teardown stays synchronous. ──────────────────────────────
  ;
  (async () => {
    await reconcileNodes();
    await reconcileConnections();
    if (typeof zoom === 'number' && zoom !== 1) {
      programmatic++;
      try {
        await area.area.zoom(zoom);
      } finally {
        programmatic--;
      }
    }
    if (fitOnMount && editor.getNodes().length) {
      programmatic++;
      try {
        await AreaExtensions.zoomAt(area, editor.getNodes());
      } finally {
        programmatic--;
      }
      if (area) {
        const k = area.area.transform.k;
        if (k !== zoom) zoom = k;
      }
    }
    // draw the minimap once the graph + fit have settled (also redrawn on every
    // render / pan / zoom / drag / selection / graph change below).
    if (scheduleMinimapRedraw) scheduleMinimapRedraw();
  })();
  return () => {
    if (onCanvasKeydown && keydownContainer && typeof keydownContainer.removeEventListener === 'function') {
      try {
        keydownContainer.removeEventListener('keydown', onCanvasKeydown);
      } catch (e: any) {}
    }
    if (dragFlushRaf && typeof cancelAnimationFrame === 'function') {
      try {
        cancelAnimationFrame(dragFlushRaf);
      } catch (e: any) {}
    }
    dragFlushRaf = 0;
    pendingDragPositions.clear();
    // T1.1: drop the edge-selection state + its cached <path> reference on teardown.
    clearEdgeSelection();
    // MiniMap teardown — remove the pointer-pan listeners + cancel a pending redraw.
    if (minimapHost) {
      if (onMinimapPointerDown) {
        try {
          minimapHost.removeEventListener('pointerdown', onMinimapPointerDown);
        } catch (e: any) {}
      }
      if (onMinimapPointerMove) {
        try {
          minimapHost.removeEventListener('pointermove', onMinimapPointerMove);
        } catch (e: any) {}
      }
      if (onMinimapPointerUp) {
        try {
          minimapHost.removeEventListener('pointerup', onMinimapPointerUp);
        } catch (e: any) {}
      }
    }
    if (minimapRedrawRaf && typeof cancelAnimationFrame === 'function') {
      try {
        cancelAnimationFrame(minimapRedrawRaf);
      } catch (e: any) {}
    }
    minimapRedrawRaf = 0;
    for (const [, entry] of nodeEntries as any) {
      if (entry.handle) entry.handle.dispose();
      if (entry.bodyHandle && entry.bodyHandle.dispose) {
        try {
          entry.bodyHandle.dispose();
        } catch (e: any) {}
      }
      for (const d of entry.socketDisposers as any) {
        try {
          d();
        } catch (e: any) {}
      }
    }
    nodeEntries.clear();
    for (const [, entry] of connEntries as any) entry.dispose();
    connEntries.clear();
    if (area) area.destroy();
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { (() => graph)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (reconcileNodes) {
    Promise.resolve(reconcileNodes()).then(() => {
      if (reconcileConnections) reconcileConnections();
    });
  }
  // graph changed (nodes added/removed/moved) → refresh the minimap node rects.
  if (scheduleMinimapRedraw) scheduleMinimapRedraw();
})(); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => portReg)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => {
  if (reconcileNodes) {
    Promise.resolve(reconcileNodes()).then(() => {
      if (reconcileConnections) reconcileConnections();
    });
  }
})(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => typeReg)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => {
  if (reconcileNodes) reconcileNodes();
})(); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { const __watchVal = (() => zoom)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } ((v: any) => {
  if (!area || typeof v !== 'number') return;
  if (v === area.area.transform.k) return;
  programmatic++;
  Promise.resolve(area.area.zoom(v)).finally(() => {
    programmatic--;
  });
})(__watchVal); }); });
</script>

<div class="rozie-flow-canvas" bind:this={canvasEl} tabindex="0" data-rozie-s-cd396d6a>{#if controls}<div class="rozie-flow-controls" data-rozie-s-cd396d6a><button type="button" class="rozie-flow-controls__btn" data-testid="flow-zoom-in" aria-label="Zoom in" onclick={controlZoomIn} data-rozie-s-cd396d6a>+</button><button type="button" class="rozie-flow-controls__btn" data-testid="flow-zoom-out" aria-label="Zoom out" onclick={controlZoomOut} data-rozie-s-cd396d6a>&#8722;</button><button type="button" class="rozie-flow-controls__btn" data-testid="flow-fit" aria-label="Fit view" onclick={controlFit} data-rozie-s-cd396d6a>&#9744;</button></div>{/if}{#if minimap}<div class="rozie-flow-minimap" bind:this={minimapEl} data-testid="flow-minimap" data-rozie-s-cd396d6a></div>{/if}</div>{@render children?.()}

<style>
:global {
  .rozie-flow-canvas[data-rozie-s-cd396d6a] {
    width: 100%;
    height: 100%;
    min-height: 360px;
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    background:
      radial-gradient(circle, rgba(0, 0, 0, 0.08) 1px, transparent 1px) 0 0 / 20px 20px,
      #f7f8fa;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
  .rozie-flow-controls[data-rozie-s-cd396d6a] {
    position: absolute;
    left: 10px;
    bottom: 10px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 2px;
    pointer-events: none;
  }
  .rozie-flow-controls__btn[data-rozie-s-cd396d6a] {
    pointer-events: auto;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font: 600 16px/1 system-ui, sans-serif;
    color: #334155;
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.16);
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
    cursor: pointer;
    user-select: none;
  }
  .rozie-flow-controls__btn[data-rozie-s-cd396d6a]:hover { background: #f1f5f9; }
  .rozie-flow-controls__btn[data-rozie-s-cd396d6a]:active { background: #e2e8f0; }
  .rozie-flow-minimap[data-rozie-s-cd396d6a] {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 10;
    width: 200px;
    height: 150px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(0, 0, 0, 0.16);
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
    overflow: hidden;
    cursor: pointer;
    touch-action: none;
  }
  .rozie-flow-minimap__svg[data-rozie-s-cd396d6a] { display: block; width: 100%; height: 100%; }
}

:global {
  .rozie-flow-canvas .rozie-flow-node {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: stretch;
      min-width: 140px;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.16);
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      user-select: none;
      cursor: grab;
      font: 13px/1.4 system-ui, sans-serif;
    }
  .rozie-flow-canvas .rozie-flow-node.is-selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 2px 8px rgba(0, 0, 0, 0.15);
    }
  .rozie-flow-canvas .rozie-flow-node__title {
      padding: 0.5rem 0.75rem;
      font-weight: 600;
      color: #1f2937;
      white-space: nowrap;
    }
  .rozie-flow-canvas .rozie-flow-node__body { min-width: 0; }
  .rozie-flow-canvas .rozie-flow-node__col {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.5rem 0;
    }
  .rozie-flow-canvas .rozie-flow-port {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: #6b7280;
    }
  .rozie-flow-canvas .rozie-flow-port--output { justify-content: flex-end; }
  .rozie-flow-canvas .rozie-flow-socket {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #94a3b8;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
      cursor: crosshair;
      flex: none;
    }
  .rozie-flow-canvas .rozie-flow-socket--input { margin-left: -6px; }
  .rozie-flow-canvas .rozie-flow-socket--output { margin-right: -6px; }
  .rozie-flow-canvas .rozie-flow-socket:hover { background: #3b82f6; }
  .rozie-flow-canvas .rozie-flow-node--rows {
      display: flex;
      flex-direction: column;
    }
  .rozie-flow-canvas .rozie-flow-node__mid {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: stretch;
    }
  .rozie-flow-canvas .rozie-flow-node__row {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.75rem;
      padding: 0 0.5rem;
    }
  .rozie-flow-canvas .rozie-flow-port--vertical {
      flex-direction: column;
      align-items: center;
      gap: 0.125rem;
      font-size: 0.7rem;
    }
  .rozie-flow-canvas .rozie-flow-socket--top,
    .rozie-flow-canvas .rozie-flow-socket--bottom { margin-left: 0; margin-right: 0; }
  .rozie-flow-canvas .rozie-flow-socket--top { margin-top: -6px; }
  .rozie-flow-canvas .rozie-flow-socket--bottom { margin-bottom: -6px; }
  .rozie-flow-canvas .rozie-flow-connection { position: absolute; }
  .rozie-flow-canvas .rozie-flow-connection__svg {
      /* display:block is LOAD-BEARING, not cosmetic. An <svg> is display:inline by
         default, so the 1px-tall connection SVG sits on the connection element's TEXT
         BASELINE — which, with the engine container's default line-height, pushes the
         whole path DOWN ~14px. That offset is in screen space (the connection element
         is the area-transform origin), so EVERY connection endpoint lands ~14px below
         its socket — visibly anchoring connectors at the BOTTOM of each node instead
         of on the socket. The socket positions reported by getDOMSocketPosition are
         already correct (offsetTop/offsetLeft within the node-view); the inline
         baseline is the sole cause of the vertical drift. block (or equivalently
         line-height:0 / vertical-align:top on the inline box) removes the baseline gap
         so the path renders at its true coordinates. Verified: drops the endpoint→
         socket vertical offset from ~13.9px to ~0.1px on all 6 targets. */
      display: block;
      overflow: visible;
      width: 1px;
      height: 1px;
      pointer-events: none;
    }
  .rozie-flow-canvas .rozie-flow-connection__path {
      fill: none;
      stroke: #64748b;
      stroke-width: 3px;
      pointer-events: auto;
    }
  .rozie-flow-canvas .rozie-flow-connection__path.is-selected {
      stroke: #3b82f6;
      stroke-width: 4px;
    }
  .rozie-flow-canvas .rozie-flow-connection__label {
      font: 600 11px system-ui, sans-serif;
      fill: #334155;
      paint-order: stroke;
      stroke: #ffffff;
      stroke-width: 3px;
      stroke-linejoin: round;
      pointer-events: none;
      user-select: none;
    }
}
</style>
