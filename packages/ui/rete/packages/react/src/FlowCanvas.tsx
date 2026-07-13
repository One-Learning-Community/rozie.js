import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { clsx, rozieAttr, rozieContext, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './FlowCanvas.css';
import './FlowCanvas.global.css';
import { NodeEditor, ClassicPreset, Scope } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { getDOMSocketPosition, classicConnectionPath } from 'rete-render-utils';
// T2.6 — auto-layout (D-08, verb-only). The 3 deps (rete-auto-arrange-plugin / elkjs
// @0.8.2 / web-worker) are OPTIONAL leaf peers, installed + bundle-smoked on all 6 in
// Plan 00 (the Vite/Angular-AOT/Lit rollup build resolves elkjs to the SYNCHRONOUS
// elk.bundled.js entry — no web-worker resolution error, no manual fallback switch). Only
// a consumer calling autoArrange() pulls these in.
// T2.6 — auto-layout (D-08, verb-only). The 3 deps (rete-auto-arrange-plugin / elkjs
// @0.8.2 / web-worker) are OPTIONAL leaf peers, installed + bundle-smoked on all 6 in
// Plan 00 (the Vite/Angular-AOT/Lit rollup build resolves elkjs to the SYNCHRONOUS
// elk.bundled.js entry — no web-worker resolution error, no manual fallback switch). Only
// a consumer calling autoArrange() pulls these in.
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin';

// ── engine instances — null-lets so typeNeutralize types them `any` (the
// MapLibre `let instance = null` discipline). Rete's NodeEditor / AreaPlugin /
// ConnectionPlugin / DOMSocketPosition carry rich generic Schemes types that the
// loosely-typed .rozie props (any[]) don't satisfy under the strict react/solid/
// lit leaf tsc; routing every engine call through an `any` instance is the
// .rozie-native fix (no lang="ts", no codegen type-aid). These are top-level lets
// referenced from hooks → React auto-hoists each to a useRef. ──

interface NodeCtx { node: any; selected: any; emit: any; }

interface ToolbarCtx { node: any; emit: any; }

interface FlowCanvasProps {
  /**
   * The single source of truth (two-way `r-model`) — `{ nodes: [{ id, type, x, y, data? }], connections: [{ id?, source, sourceOutput?, target, targetInput?, label?, stroke?, dashed? }] }`. A node's `type` selects its `<NodeType>` template (render-by-type + port schema); `data` is the opaque payload handed to that type's `#body` scope. The canvas writes back a FRESH top-level object on every drag (x/y) and connect/disconnect (connections) — immutable applyNodeChanges style. `sourceOutput`/`targetInput` default to `out`/`in`; a missing connection `id` is derived from the endpoints.
   * @example
   * <FlowCanvas r-model:graph="graph" :validate-types="true" />
   */
  graph?: Record<string, any>;
  defaultGraph?: Record<string, any>;
  onGraphChange?: (graph: Record<string, any>) => void;
  /**
   * Automatic typed-socket validation (default ON). When `true`, the canvas resolves each endpoint's port type from the per-`<NodeType>` `<Port type>` schema and auto-rejects a type-mismatched connection (firing `connection-rejected`). `canConnect` survives as the optional custom-rule override that runs in addition. Set `false` for pure-`canConnect` (type as metadata only).
   */
  validateTypes?: boolean;
  /**
   * The viewport zoom level (two-way `r-model`). Scroll/pinch writes the new zoom back through the model (echo-guarded against the wrapper's own programmatic zooms); a consumer write zooms the live area. There is deliberately no `zoom`/`zoomed` emit — a same-named emit collides with the model on Vue and Angular — so the two-way binding is the channel for zoom changes.
   */
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (zoom: number) => void;
  /**
   * Whether the canvas can be panned by dragging the background (applied at construction). Set `false` to detach the area's drag handler.
   */
  pannable?: boolean;
  /**
   * Whether the canvas can be zoomed by scroll/pinch (applied at construction). Set `false` to detach the area's zoom handler.
   */
  zoomable?: boolean;
  /**
   * Whether nodes can be selected (click; ctrl-click to accumulate). Reflected as the `selected` flag in the `<NodeType>` `#body` scope and surfaced to the consumer via the `@selection-change` event.
   */
  selectable?: boolean;
  /**
   * Read-only viewer mode — no node drag, no connection editing, and no selection. View-only zoom/fit (Controls, the `zoomTo`/`zoomToFit` verbs) stay enabled.
   */
  readonly?: boolean;
  /**
   * Minimum zoom level — the lower bound of the area's zoom restrictor. `0` disables the bound.
   */
  minZoom?: number;
  /**
   * Maximum zoom level — the upper bound of the area's zoom restrictor. `0` disables the bound.
   */
  maxZoom?: number;
  /**
   * Snap-to-grid size in pixels for node dragging. `0` turns snapping off.
   */
  snapGrid?: number;
  /**
   * When selectable, hold Ctrl to add to the current selection instead of replacing it.
   */
  accumulateOnCtrl?: boolean;
  /**
   * The bezier curvature of connection paths (`classicConnectionPath`).
   */
  curvature?: number;
  /**
   * After the initial graph mounts, pan/zoom the viewport to fit all nodes (`AreaExtensions.zoomAt`).
   */
  fitOnMount?: boolean;
  /**
   * Render the built-in Controls overlay — a zoom in / zoom out / fit-view button cluster (the React Flow `<Controls/>` parity). The buttons drive the same zoom/fit path as the `zoomTo`/`zoomToFit` handle verbs (clamped to `minZoom`/`maxZoom`) and stay enabled in `readonly`. Opt out with `:controls="false"`.
   */
  controls?: boolean;
  /**
   * Render the built-in MiniMap overlay (opt-in, default OFF — the React Flow `<MiniMap/>` parity) — an absolute SVG panel (bottom-right) showing a scaled map of every node (sized from the measured engine node-view dims) plus the current viewport window (the area outside dimmed). It is pannable: dragging the minimap recenters the main viewport (via `setCenter`). Evaluated at construction, like `pannable`/`zoomable`/`controls` — set it at mount time.
   */
  minimap?: boolean;
  /**
   * Canvas background pattern — 'dots' (default, today's grid) | 'lines' | 'cross' | 'none' (the React Flow <Background variant> parity). Gap/size/color stay CSS custom properties (--rozie-flow-grid-size, --rozie-flow-grid-dot-color, --rozie-flow-bg) — not separate props.
   */
  background?: string;
  /**
   * Connection-validation predicate `(conn) => boolean`, receiving the normalized candidate connection `{ source, sourceOutput, target, targetInput }`. Return `false` to reject the connection — no edge is committed, no ghost path is drawn, and `connection-rejected` fires. Runs in addition to the automatic `:validate-types` check (the custom-rule override) and gates all connection paths uniformly (drag-to-connect, imperative `addConnection`, graph reconcile). Absent/`null` imposes no custom rule.
   */
  canConnect?: ((...args: any[]) => any) | null;
  /**
   * Undo/redo, on by default. Every gesture (drag, connect, disconnect, delete) pushes ONE capped (~100) snapshot of the bound graph (nodes incl. x/y + connections; not the viewport), and `undo()`/`redo()` plus Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y restore it through the two-way `graph` model (echo-guarded). One gesture = one undo step; a fresh edit after an undo discards the redo branch. Opt out with `:history="false"` (the snapshot stack stays empty and the verbs no-op).
   */
  history?: boolean;
  /**
   * Two-way interaction mode (`r-model`) — the Figma-style pan ↔ select toggle, `'pan'` (default) or `'select'`. In `'pan'` an empty-canvas drag pans the viewport (unchanged). In `'select'` an empty-canvas drag draws a rubber-band marquee box that multi-selects the intersecting nodes (surfacing `@selection-change`). A node drag still drags the node in both modes — only the empty-canvas drag changes. The canvas writes it back when the built-in mode button toggles (see `marquee`).
   */
  mode?: string;
  defaultMode?: string;
  onModeChange?: (mode: string) => void;
  /**
   * Render the 4th Controls button — the pan ↔ select mode toggle (it two-way-writes `mode`). Default OFF so the default Controls overlay keeps its three buttons. The marquee behavior works whenever `mode === 'select'` regardless of this flag (a consumer can drive `mode` directly); this only governs the built-in button.
   */
  marquee?: boolean;
  /**
   * Render the opt-in NodeToolbar (default OFF) — a floating toolbar over the single selected node (positioned from the engine node-view rect + the area transform, re-tracked on pan/zoom/drag). Default content is Delete (cascading controlled-graph `deleteNode`) + Duplicate (clone the node spec at an offset with a new id into a fresh `graph` object); both fire `@node-action` (`name: 'delete' | 'duplicate'`). Override the content by filling the `#toolbar` reactive slot.
   */
  nodeToolbar?: boolean;
  onEdgeClick?: (...args: any[]) => void;
  onEdgeSelected?: (...args: any[]) => void;
  onSelectionChange?: (...args: any[]) => void;
  onConnectEnd?: (...args: any[]) => void;
  onNodeAction?: (...args: any[]) => void;
  onConnectionRejected?: (...args: any[]) => void;
  onConnectionCreated?: (...args: any[]) => void;
  onConnectionRemoved?: (...args: any[]) => void;
  onNodePicked?: (...args: any[]) => void;
  onNodeMoved?: (...args: any[]) => void;
  onTranslated?: (...args: any[]) => void;
  onContextMenu?: (...args: any[]) => void;
  renderNode?: (ctx: NodeCtx) => ReactNode;
  renderToolbar?: (ctx: ToolbarCtx) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface FlowCanvasHandle {
  getEditor: (...args: any[]) => any;
  getArea: (...args: any[]) => any;
  addNode: (...args: any[]) => any;
  removeNode: (...args: any[]) => any;
  deleteNode: (...args: any[]) => any;
  addConnection: (...args: any[]) => any;
  removeConnection: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  zoomToFit: (...args: any[]) => any;
  zoomTo: (...args: any[]) => any;
  setCenter: (...args: any[]) => any;
  setViewport: (...args: any[]) => any;
  screenToFlowPosition: (...args: any[]) => any;
  getNodes: (...args: any[]) => any;
  getConnections: (...args: any[]) => any;
  getTransform: (...args: any[]) => any;
  autoArrange: (...args: any[]) => any;
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  canUndo: (...args: any[]) => any;
  canRedo: (...args: any[]) => any;
  getSelectedNodes: (...args: any[]) => any;
  selectNode: (...args: any[]) => any;
  clearSelection: (...args: any[]) => any;
  selectAll: (...args: any[]) => any;
  centerOnNode: (...args: any[]) => any;
}

const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(function FlowCanvas(_props: FlowCanvasProps, ref): JSX.Element {
  const __ctx_rete_canvas = rozieContext("rete:canvas");
  const portalRoots = useRef<Set<Root>>(new Set());
  const props: Omit<FlowCanvasProps, 'validateTypes' | 'pannable' | 'zoomable' | 'selectable' | 'readonly' | 'minZoom' | 'maxZoom' | 'snapGrid' | 'accumulateOnCtrl' | 'curvature' | 'fitOnMount' | 'controls' | 'minimap' | 'background' | 'canConnect' | 'history' | 'marquee' | 'nodeToolbar'> & { validateTypes: boolean; pannable: boolean; zoomable: boolean; selectable: boolean; readonly: boolean; minZoom: number; maxZoom: number; snapGrid: number; accumulateOnCtrl: boolean; curvature: number; fitOnMount: boolean; controls: boolean; minimap: boolean; background: string; canConnect: ((...args: any[]) => any) | null; history: boolean; marquee: boolean; nodeToolbar: boolean } = {
    ..._props,
    validateTypes: _props.validateTypes ?? true,
    pannable: _props.pannable ?? true,
    zoomable: _props.zoomable ?? true,
    selectable: _props.selectable ?? true,
    readonly: _props.readonly ?? false,
    minZoom: _props.minZoom ?? 0.1,
    maxZoom: _props.maxZoom ?? 4,
    snapGrid: _props.snapGrid ?? 0,
    accumulateOnCtrl: _props.accumulateOnCtrl ?? true,
    curvature: _props.curvature ?? 0.3,
    fitOnMount: _props.fitOnMount ?? true,
    controls: _props.controls ?? true,
    minimap: _props.minimap ?? false,
    background: _props.background ?? 'dots',
    canConnect: _props.canConnect ?? null,
    history: _props.history ?? true,
    marquee: _props.marquee ?? false,
    nodeToolbar: _props.nodeToolbar ?? false,
  };
  const _renderNodeRef = useRef(props.renderNode);
  _renderNodeRef.current = props.renderNode;
  const _renderToolbarRef = useRef(props.renderToolbar);
  _renderToolbarRef.current = props.renderToolbar;
  const lastPropNodeIds = useRef<any>(null);
  const lastPropConnIds = useRef<any>(null);
  const editor = useRef<any>(null);
  const area = useRef<any>(null);
  const connectionPlugin = useRef<any>(null);
  const socketWatcher = useRef<any>(null);
  const programmatic = useRef(0);
  const reconnectInFlight = useRef(0);
  const reconnectPreSnapshot = useRef<any>(null);
  const reconnectDidWriteBack = useRef(false);
  const reconnectCloseScheduled = useRef(false);
  const renderScope = useRef<any>(null);
  const arrange = useRef<any>(null);
  const selector = useRef<any>(null);
  const nodeSelectApi = useRef<any>(null);
  const onCanvasKeydown = useRef<any>(null);
  const selectedConnId = useRef<any>(null);
  const keydownContainer = useRef<any>(null);
  const scheduleMinimapRedraw = useRef<any>(null);
  const dragGestureActive = useRef(false);
  const pendingDragSnapshot = useRef<any>(null);
  const edgeClickGuard = useRef(false);
  const scheduleToolbarTrack = useRef<any>(null);
  const reconcileConnections = useRef<any>(null);
  const reconcileNodes = useRef<any>(null);
  const reconcileNodesRunning = useRef(false);
  const reconcileNodesPending = useRef(false);
  const minimapRedrawRaf = useRef(0);
  const minimapSvg = useRef<any>(null);
  const minimapMap = useRef<any>(null);
  const minimapHost = useRef<any>(null);
  const onMinimapPointerDown = useRef<any>(null);
  const minimapPanning = useRef(false);
  const onMinimapPointerMove = useRef<any>(null);
  const onMinimapPointerUp = useRef<any>(null);
  const toolbarTrackRaf = useRef(0);
  const toolbarHost = useRef<any>(null);
  const toolbarSelectedId = useRef<any>(null);
  const toolbarHandle = useRef<any>(null);
  const syncToolbarSelection = useRef<any>(null);
  const toolbarDeleteBtn = useRef<any>(null);
  const toolbarDuplicateBtn = useRef<any>(null);
  const onToolbarDelete = useRef<any>(null);
  const onToolbarDup = useRef<any>(null);
  const marqueeBox = useRef<any>(null);
  const marqueeStart = useRef<any>(null);
  const marqueeCur = useRef<any>(null);
  const marqueeActive = useRef(false);
  const onCanvasPointerDownCapture = useRef<any>(null);
  const onMarqueePointerMove = useRef<any>(null);
  const onMarqueePointerUp = useRef<any>(null);
  const lastWrittenGraph = useRef<any>(null);
  const historyStack = useRef([]);
  const redoStack = useRef([]);
  const dragFlushRaf = useRef(0);
  const selfWriteInFlight = useRef(false);
  const selectedPathEl = useRef<any>(null);
  const lastSelectionIds = useRef<any>(null);
  const [graph, setGraph] = useControllableState({
    value: props.graph,
    defaultValue: props.defaultGraph ?? (() => ({
    nodes: [],
    connections: []
  }))(),
    onValueChange: props.onGraphChange,
  });
  const [zoom, setZoom] = useControllableState({
    value: props.zoom,
    defaultValue: props.defaultZoom ?? 1,
    onValueChange: props.onZoomChange,
  });
  const [mode, setMode] = useControllableState({
    value: props.mode,
    defaultValue: props.defaultMode ?? 'pan',
    onValueChange: props.onModeChange,
  });
  const _graphRef = useRef(graph);
  _graphRef.current = graph;
  const _modeRef = useRef(mode);
  _modeRef.current = mode;
  const _zoomRef = useRef(zoom);
  _zoomRef.current = zoom;
  const [typeReg, setTypeReg] = useState<Record<string, any>>({});
  const [portReg, setPortReg] = useState<Record<string, any>>({});
  const _portRegRef = useRef(portReg);
  _portRegRef.current = portReg;
  const _typeRegRef = useRef(typeReg);
  _typeRegRef.current = typeReg;
  const canvasEl = useRef<HTMLDivElement | null>(null);
  const minimapEl = useRef<HTMLDivElement | null>(null);
  const marqueeEl = useRef<HTMLDivElement | null>(null);
  const toolbarEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);

  const MINIMAP_W = useMemo(() => 200, []);
  const MINIMAP_H = useMemo(() => 150, []);
  const MINIMAP_DEFAULT_NODE_W = useMemo(() => 140, []);
  const MINIMAP_DEFAULT_NODE_H = useMemo(() => 52, []);
  const SVGNS = useMemo(() => 'http://www.w3.org/2000/svg', []);
  const SOCKET = useMemo(() => new ClassicPreset.Socket('flow'), []);
  const nodeInstances = useMemo(() => new Map(), []);
  const nodeMeta = useMemo(() => new Map(), []);
  const connInstances = useMemo(() => new Map(), []);
  const nodeEntries = useMemo(() => new Map(), []);
  const connEntries = useMemo(() => new Map(), []);
  const connMeta = useMemo(() => new Map(), []);
  // T1.3 — UNDO / REDO (D-02 on-by-default, D-03 per-gesture graph-only scope, D-04
  // echo-guarded restore). A CAPPED snapshot stack over the BOUND GRAPH only — nodes
  // (incl x/y) + connections — and explicitly NOT the viewport (pan/zoom is excluded,
  // D-03). One entry is pushed per COMPLETED gesture: a drag = ONE entry (snapshot taken
  // on pointer-down, committed on the first translate — never per pointermove frame), a
  // connect / disconnect / delete = one each. A push is gated on `!programmatic` so a
  // restore-driven write (which runs INSIDE the programmatic guard) never re-enters the
  // history (D-04). Pushing clears the redo branch and drops the oldest entry beyond the
  // cap (Threat T-44-03-1: bounded memory). Snapshots are deep clones of the consumer's own
  // serializable graph JSON (Pattern 7; the `$clone` sigil — a deep, de-proxied copy
  // that strips the Vue/Svelte reactivity Proxy that a bare `structuredClone` THROWS
  // on) — no external input, so the restore (T-44-03-2 accept)
  // cannot loop (it rides the programmatic guard + the existing $watch(graph) reconcile).
  // Undo is ALWAYS on for v1; `:history=false` (the `history` prop) is the cheap escape
  // hatch that skips every push (the stacks stay empty → undo/redo are no-ops).
  // COMPONENT-scope so the stack survives across area events + the Solid-hoisted teardown.
  const HISTORY_CAP = 100;
  // Two-stack model (simpler + correct than a single cursor): `historyStack` holds
  // PRE-gesture snapshots (the states to UNDO back to, newest last); `redoStack` holds
  // snapshots an undo popped off (the states to REDO forward to, newest last). A new
  // gesture (pushHistory) snapshots the PRE-gesture graph onto historyStack and CLEARS
  // redoStack (a fresh edit discards the redo branch). undo() pops historyStack → pushes
  // the CURRENT (pre-undo) graph onto redoStack → restores the popped snapshot. redo()
  // pops redoStack → pushes the current graph back onto historyStack → restores it.
  const pendingDragPositions = useMemo(() => new Map(), []);
  const currentGraph = useCallback(() => graph || {
    nodes: [],
    connections: []
  }, [graph]);
  function commitGraph(g: any) {
    const c = structuredClone(g);
    lastWrittenGraph.current = c != null ? c : g;
    selfWriteInFlight.current = true;
    setGraph(g);
  }
  const snapshotCurrent = useCallback(() => {
    const src = lastWrittenGraph.current != null ? lastWrittenGraph.current : currentGraph();
    return structuredClone(src);
  }, [currentGraph]);
  function baseGraph() {
    return lastWrittenGraph.current != null ? lastWrittenGraph.current : currentGraph();
  }
  const pushHistorySnapshot = useCallback((snap: any) => {
    if (props.history === false) return;
    if (!snap) return;
    historyStack.current.push(snap);
    if (historyStack.current.length > HISTORY_CAP) {
      historyStack.current = historyStack.current.slice(historyStack.current.length - HISTORY_CAP);
    }
    redoStack.current = [];
  }, [props.history]);
  function pushHistory() {
    if (programmatic.current) return;
    if (props.history === false) return;
    pushHistorySnapshot(snapshotCurrent());
  }
  function closeReconnectGesture() {
    if (!reconnectCloseScheduled.current) return;
    reconnectCloseScheduled.current = false;
    if (reconnectInFlight.current > 0) reconnectInFlight.current = 0;
    if (!programmatic.current && props.history !== false && reconnectDidWriteBack.current && reconnectPreSnapshot.current) {
      pushHistorySnapshot(reconnectPreSnapshot.current);
    }
    reconnectPreSnapshot.current = null;
    reconnectDidWriteBack.current = false;
  }
  const scheduleReconnectClose = useCallback(() => {
    if (reconnectCloseScheduled.current) return;
    reconnectCloseScheduled.current = true;
    if (typeof setTimeout === 'function') setTimeout(closeReconnectGesture, 0);else Promise.resolve().then(closeReconnectGesture);
  }, [closeReconnectGesture]);
  function restoreGraph(snap: any) {
    if (!snap) return;
    // Cancel any in-flight drag write-back so a queued frame can't clobber the restore with
    // a stale position after the programmatic guard releases.
    pendingDragPositions.clear();
    if (dragFlushRaf.current) {
      if (typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(dragFlushRaf.current);
        } catch (e: any) {}
      }
      dragFlushRaf.current = 0;
    }
    programmatic.current++;
    try {
      const fresh = {
        nodes: (snap.nodes || []).map((n: any) => ({
          ...n
        })),
        connections: (snap.connections || []).map((c: any) => ({
          ...c
        }))
      };
      commitGraph(fresh);
    } finally {
      programmatic.current--;
    }
  }
  const undo = useCallback(() => {
    if (historyStack.current.length === 0) return;
    const cur = snapshotCurrent();
    const snap = historyStack.current.pop();
    if (cur) redoStack.current.push(cur);
    restoreGraph(snap);
  }, [restoreGraph, snapshotCurrent]);
  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const cur = snapshotCurrent();
    const snap = redoStack.current.pop();
    if (cur) historyStack.current.push(cur);
    restoreGraph(snap);
  }, [restoreGraph, snapshotCurrent]);
  function canUndo() {
    return historyStack.current.length > 0;
  }
  function canRedo() {
    return redoStack.current.length > 0;
  }
  function flushDragWriteBack() {
    dragFlushRaf.current = 0;
    if (programmatic.current) {
      pendingDragPositions.clear();
      return;
    }
    if (pendingDragPositions.size === 0) return;
    const g = baseGraph();
    const nodes = (g.nodes || []).map((n: any) => {
      const p = n && n.id != null ? pendingDragPositions.get(n.id) : null;
      return p ? {
        ...n,
        x: p.x,
        y: p.y
      } : n;
    });
    pendingDragPositions.clear();
    commitGraph({
      ...g,
      nodes
    });
  }
  const scheduleDragFlush = useCallback(() => {
    if (dragFlushRaf.current) return;
    if (typeof requestAnimationFrame === 'function') {
      dragFlushRaf.current = requestAnimationFrame(flushDragWriteBack);
    } else {
      dragFlushRaf.current = 1;
      Promise.resolve().then(flushDragWriteBack);
    }
  }, [flushDragWriteBack]);
  const writeBackConnectionCreated = useCallback((c: any) => {
    if (programmatic.current) return;
    // T1.3 — one history entry per CONNECT gesture (BEFORE the write so the snapshot is the
    // pre-connect state — snapshotCurrent reads lastWrittenGraph, still the pre-connect value).
    // T2.5 — SUPPRESS while a reconnect is in flight: the paired remove+add of a reconnect
    // (and a plain new-connection drag, which also rides connectionpick/drop) push ONE
    // coalesced snapshot on connectiondrop instead (D-03 one-gesture-one-entry).
    if (reconnectInFlight.current) reconnectDidWriteBack.current = true;else pushHistory();
    const g = baseGraph();
    const conn = {
      id: c.id,
      source: c.source,
      sourceOutput: c.sourceOutput,
      target: c.target,
      targetInput: c.targetInput
    };
    commitGraph({
      ...g,
      connections: [...(g.connections || []), conn]
    });
  }, [baseGraph, commitGraph, pushHistory]);
  const writeBackConnectionRemoved = useCallback((id: any) => {
    if (programmatic.current) return;
    // T1.3 — one history entry per DISCONNECT / edge-delete gesture (BEFORE the write).
    // T2.5 — SUPPRESS while a reconnect is in flight: the remove half of a reconnect is
    // coalesced with its paired add into ONE snapshot pushed on connectiondrop (D-03).
    if (reconnectInFlight.current) reconnectDidWriteBack.current = true;else pushHistory();
    const g = baseGraph();
    commitGraph({
      ...g,
      connections: (g.connections || []).filter((e: any) => e && e.id !== id)
    });
  }, [baseGraph, commitGraph, pushHistory]);
  const clearEdgeSelection = useCallback(() => {
    if (selectedPathEl.current && selectedPathEl.current.classList) {
      try {
        selectedPathEl.current.classList.remove('is-selected');
      } catch (e: any) {}
    }
    selectedConnId.current = null;
    selectedPathEl.current = null;
  }, []);
  const { onEdgeClick: _rozieProp_onEdgeClick, onEdgeSelected: _rozieProp_onEdgeSelected } = props;
    const selectEdge = useCallback((id: any, pathEl: any) => {
    if (id == null) return;
    clearEdgeSelection();
    selectedConnId.current = id;
    selectedPathEl.current = pathEl;
    if (pathEl && pathEl.classList) {
      try {
        pathEl.classList.add('is-selected');
      } catch (e: any) {}
    }
    edgeClickGuard.current = true;
    Promise.resolve().then(() => {
      edgeClickGuard.current = false;
    });
    _rozieProp_onEdgeClick && _rozieProp_onEdgeClick({
      id
    });
    _rozieProp_onEdgeSelected && _rozieProp_onEdgeSelected({
      id
    });
  }, [_rozieProp_onEdgeClick, _rozieProp_onEdgeSelected, clearEdgeSelection]);
  const deleteNode = useCallback((id: any) => {
    if (id == null) return false;
    const g = baseGraph();
    const sid = String(id);
    const nodes = (g.nodes || []).filter((n: any) => n && String(n.id) !== sid);
    if (nodes.length === (g.nodes || []).length) return false;
    const connections = (g.connections || []).filter((c: any) => c && String(c.source) !== sid && String(c.target) !== sid);
    // T1.3 — one history entry per DELETE gesture (node + its incident edges = ONE undo).
    pushHistory();
    commitGraph({
      ...g,
      nodes,
      connections
    });
    return true;
  }, [baseGraph, commitGraph, pushHistory]);
  function freshNodeId(baseId: any, existing: any) {
    const taken = new Set((existing || []).map((n: any) => n && n.id != null ? String(n.id) : ''));
    const root = baseId != null ? String(baseId) : 'node';
    let i = 1;
    let candidate = root + '-copy';
    while (taken.has(candidate)) {
      i++;
      candidate = root + '-copy-' + i;
    }
    return candidate;
  }
  const duplicateNode = useCallback((id: any) => {
    if (id == null) return null;
    const g = baseGraph();
    const sid = String(id);
    const src = (g.nodes || []).find((n: any) => n && String(n.id) === sid);
    if (!src) return null;
    const newId = freshNodeId(src.id, g.nodes);
    // Phase 45-07 (WR-02/WR-06): `$clone` is now a recursive proxy-safe deep clone
    // on every target (Vue's lowering de-proxies nested reactive members via the
    // `rozieDeepClone` runtime helper). The historical `$clone({ d: src.data }).d`
    // object-literal wrapper — which never actually dodged the old single-toRaw
    // throw on a live nested proxy — is no longer needed; clone `src.data` directly.
    const clonedData = src.data != null ? structuredClone(src.data) : undefined;
    const clone = {
      ...src,
      id: newId,
      x: (typeof src.x === 'number' ? src.x : 0) + 28,
      y: (typeof src.y === 'number' ? src.y : 0) + 28,
      data: clonedData
    };
    pushHistory();
    commitGraph({
      ...g,
      nodes: [...(g.nodes || []), clone]
    });
    return newId;
  }, [baseGraph, commitGraph, freshNodeId, pushHistory]);
  const selectedNodeIds = useCallback(() => {
    if (!selector.current || !selector.current.entities) return [];
    const ids = [];
    for (const e of selector.current.entities.values() as any) {
      if (e && e.id != null) ids.push(e.id);
    }
    return ids;
  }, []);
  function maybeEmitSelectionChange() {
    if (programmatic.current) return;
    const ids = selectedNodeIds();
    const key = [...ids].map((x: any) => String(x)).sort().join(' ');
    if (key === lastSelectionIds.current) return;
    lastSelectionIds.current = key;
    props.onSelectionChange && props.onSelectionChange({
      ids
    });
    // the selected set changed → repaint the minimap (selected nodes are highlighted).
    if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
    // T2.8 — the selection changed → re-track the NodeToolbar (it follows the single
    // selected node; hides on multi-select / empty selection). No-op when :node-toolbar off.
    if (syncToolbarSelection.current) syncToolbarSelection.current();
  }
  const scheduleSelectionEmit = useCallback(() => {
    Promise.resolve().then(maybeEmitSelectionChange);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(maybeEmitSelectionChange);
    } else {
      Promise.resolve().then(() => Promise.resolve().then(maybeEmitSelectionChange));
    }
  }, [maybeEmitSelectionChange]);
  const serializeConn = useCallback((c: any) => ({
    id: c.id,
    source: c.source,
    sourceOutput: c.sourceOutput,
    target: c.target,
    targetInput: c.targetInput
  }), []);
  const portSchemaForType = useCallback((type: any, portReg: any) => {
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
  }, [portReg]);
  const buildNode = useCallback((spec: any, portReg: any) => {
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
  }, [portReg, portSchemaForType]);
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
  function getEditor() {
    return editor.current;
  }
  function getArea() {
    return area.current;
  }
  async function addNode(spec: any) {
    if (!editor.current || !spec || spec.id == null) return null;
    const node = buildNode(spec, portReg);
    nodeInstances.set(spec.id, node);
    nodeMeta.set(spec.id, spec);
    programmatic.current++;
    try {
      await editor.current.addNode(node);
      await area.current.translate(spec.id, {
        x: spec.x || 0,
        y: spec.y || 0
      });
    } finally {
      programmatic.current--;
    }
    return spec.id;
  }
  async function removeNode(id: any) {
    if (!editor.current || id == null || !nodeInstances.has(id)) return false;
    programmatic.current++;
    try {
      for (const c of editor.current.getConnections() as any) {
        if (c.source === id || c.target === id) await editor.current.removeConnection(c.id);
      }
      await editor.current.removeNode(id);
    } finally {
      programmatic.current--;
    }
    nodeInstances.delete(id);
    nodeMeta.delete(id);
    return true;
  }
  async function addConnection(spec: any) {
    if (!editor.current || !spec || spec.source == null || spec.target == null) return null;
    const srcOut = spec.sourceOutput != null ? spec.sourceOutput : 'out';
    const tgtIn = spec.targetInput != null ? spec.targetInput : 'in';
    const sourceNode = nodeInstances.get(spec.source);
    const targetNode = nodeInstances.get(spec.target);
    if (!sourceNode || !targetNode) return null;
    const conn = new ClassicPreset.Connection(sourceNode, srcOut, targetNode, tgtIn);
    if (spec.id != null) conn.id = spec.id;
    programmatic.current++;
    try {
      await editor.current.addConnection(conn);
    } finally {
      programmatic.current--;
    }
    connInstances.set(conn.id, conn);
    return conn.id;
  }
  async function removeConnection(id: any) {
    if (!editor.current || id == null) return false;
    programmatic.current++;
    try {
      await editor.current.removeConnection(id);
    } finally {
      programmatic.current--;
    }
    connInstances.delete(id);
    return true;
  }
  async function clear() {
    if (!editor.current) return;
    programmatic.current++;
    try {
      await editor.current.clear();
    } finally {
      programmatic.current--;
    }
    nodeInstances.clear();
    nodeMeta.clear();
    connInstances.clear();
    connMeta.clear();
    lastPropNodeIds.current = [];
    lastPropConnIds.current = [];
  }
  async function zoomToFit() {
    if (!area.current || !editor.current) return;
    programmatic.current++;
    try {
      await AreaExtensions.zoomAt(area.current, editor.current.getNodes());
    } finally {
      programmatic.current--;
    }
    const k = area.current.area.transform.k;
    if (k !== zoom) setZoom(k);
  }
  async function zoomTo(k: any) {
    if (!area.current || typeof k !== 'number') return;
    programmatic.current++;
    try {
      await area.current.area.zoom(k);
    } finally {
      programmatic.current--;
    }
    if (k !== zoom) setZoom(k);
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
  async function setViewport(vp: any) {
    if (!area.current || !vp || typeof vp !== 'object') return;
    const tf = area.current.area.transform;
    const k = typeof vp.k === 'number' ? vp.k : tf.k;
    const x = typeof vp.x === 'number' ? vp.x : tf.x;
    const y = typeof vp.y === 'number' ? vp.y : tf.y;
    programmatic.current++;
    try {
      if (k !== area.current.area.transform.k) await area.current.area.zoom(k);
      await area.current.area.translate(x, y);
    } finally {
      programmatic.current--;
    }
    if (k !== zoom) setZoom(k);
  }

  // setCenter(x, y, opts?) — center the viewport on graph-coords (x, y), optionally
  // setting zoom (`opts.zoom`). The transform that puts graph point (x,y) at the canvas
  // center is tx = W/2 − x·k, ty = H/2 − y·k (screen = graph·k + transform). W/H are the
  // engine container's pixel dims (area.container — public on AreaPlugin, no $refs read).
  // setCenter(x, y, opts?) — center the viewport on graph-coords (x, y), optionally
  // setting zoom (`opts.zoom`). The transform that puts graph point (x,y) at the canvas
  // center is tx = W/2 − x·k, ty = H/2 − y·k (screen = graph·k + transform). W/H are the
  // engine container's pixel dims (area.container — public on AreaPlugin, no $refs read).
  async function setCenter(x: any, y: any, opts: any) {
    if (!area.current || typeof x !== 'number' || typeof y !== 'number') return;
    const k = opts && typeof opts.zoom === 'number' ? opts.zoom : area.current.area.transform.k;
    const el = area.current.container;
    const cw = el && el.clientWidth ? el.clientWidth : 0;
    const ch = el && el.clientHeight ? el.clientHeight : 0;
    const tx = cw / 2 - x * k;
    const ty = ch / 2 - y * k;
    programmatic.current++;
    try {
      if (k !== area.current.area.transform.k) await area.current.area.zoom(k);
      await area.current.area.translate(tx, ty);
    } finally {
      programmatic.current--;
    }
    if (k !== zoom) setZoom(k);
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
  function clampZoom(k: any) {
    let lo = typeof props.minZoom === 'number' && props.minZoom > 0 ? props.minZoom : 0.01;
    let hi = typeof props.maxZoom === 'number' && props.maxZoom > 0 ? props.maxZoom : 100;
    if (k < lo) return lo;
    if (k > hi) return hi;
    return k;
  }
  const controlZoomIn = useCallback(() => {
    if (!area.current) return;
    zoomTo(clampZoom(area.current.area.transform.k * ZOOM_STEP));
  }, [clampZoom, zoomTo]);
  const controlZoomOut = useCallback(() => {
    if (!area.current) return;
    zoomTo(clampZoom(area.current.area.transform.k / ZOOM_STEP));
  }, [clampZoom, zoomTo]);
  const controlFit = useCallback(() => {
    zoomToFit();
  }, [zoomToFit]);
  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'select' ? 'pan' : 'select');
  }, [setMode]);
  function getNodes() {
    if (!area.current) return [];
    const out = [];
    for (const [id, node] of nodeInstances as any) {
      const view = area.current.nodeViews.get(id);
      out.push({
        id,
        label: node.label,
        x: view ? view.position.x : 0,
        y: view ? view.position.y : 0
      });
    }
    return out;
  }
  function getConnections() {
    return editor.current ? editor.current.getConnections().map(serializeConn) : [];
  }
  function getTransform() {
    return area.current ? {
      x: area.current.area.transform.x,
      y: area.current.area.transform.y,
      k: area.current.area.transform.k
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
  function screenToFlowPosition(clientX: any, clientY: any) {
    if (!area.current || typeof clientX !== 'number' || typeof clientY !== 'number') return null;
    const el = area.current.container;
    const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
    if (!rect) return null;
    const t = area.current.area.transform;
    const k = t.k || 1;
    return {
      x: (clientX - rect.left - t.x) / k,
      y: (clientY - rect.top - t.y) / k
    };
  }

  // T2.6 — autoArrange(opts?) — relayout the graph into a non-overlapping LAYERED arrangement
  // (D-08, verb-only, NO auto-trigger — the MapLibre verb-first stance). Runs the
  // AutoArrangePlugin (elkjs classic preset), then READS the arranged positions BACK into a
  // FRESH `{ nodes, connections }` object written through `$model.graph` (the controlled-graph
  // contract — the engine is never the source of truth, mirroring the drag write-back).
  //
  // PITFALL 3 (Plan 00 / RESEARCH): elkjs needs each node's `width`/`height`; our nodes are
  // plain `ClassicPreset.Node` with no dimensions, so without dims the classic preset collapses
  // every node to (0,0). We set `node.width`/`node.height` from the MEASURED engine node-view
  // element (area.nodeViews.get(id).element offsetW/H — target-agnostic, the measureNodeSize
  // discipline) BEFORE layout, falling back to MINIMAP_DEFAULT_NODE_W/H for Lit's unmeasured
  // first paint. (measureNodeSize itself is $onMount-local; the verb is top-level, so the same
  // measure is inlined here over the component-scope `area` + `nodeInstances`.)
  //
  // Echo-guarded (programmatic++ around layout AND the write-back) so the engine relayout and
  // the resulting $model.graph re-bind → $watch(graph) → reconcile don't re-enter; ONE history
  // snapshot is pushed for the whole gesture (D-03, gated on !programmatic + history). The
  // optional `opts.options` (elk layout options — direction/spacing) is forwarded to
  // arrange.layout() (D-01 discretion — default-only is fine; the arg stays optional).
  //
  // Collision discipline: `autoArrange` is NOT a Lit lifecycle name (update/render/firstUpdated/
  // updated/willUpdate/requestUpdate), NOT an inherited DOM method (the Embla scrollTo lesson),
  // NOT an emit (node-*/connection-*/translated/context-menu/selection-change/edge-*/node-action),
  // NOT a prop, NOT a React model-setter (graph/zoom → setGraph/setZoom) — clean on all 6.
  // T2.6 — autoArrange(opts?) — relayout the graph into a non-overlapping LAYERED arrangement
  // (D-08, verb-only, NO auto-trigger — the MapLibre verb-first stance). Runs the
  // AutoArrangePlugin (elkjs classic preset), then READS the arranged positions BACK into a
  // FRESH `{ nodes, connections }` object written through `$model.graph` (the controlled-graph
  // contract — the engine is never the source of truth, mirroring the drag write-back).
  //
  // PITFALL 3 (Plan 00 / RESEARCH): elkjs needs each node's `width`/`height`; our nodes are
  // plain `ClassicPreset.Node` with no dimensions, so without dims the classic preset collapses
  // every node to (0,0). We set `node.width`/`node.height` from the MEASURED engine node-view
  // element (area.nodeViews.get(id).element offsetW/H — target-agnostic, the measureNodeSize
  // discipline) BEFORE layout, falling back to MINIMAP_DEFAULT_NODE_W/H for Lit's unmeasured
  // first paint. (measureNodeSize itself is $onMount-local; the verb is top-level, so the same
  // measure is inlined here over the component-scope `area` + `nodeInstances`.)
  //
  // Echo-guarded (programmatic++ around layout AND the write-back) so the engine relayout and
  // the resulting $model.graph re-bind → $watch(graph) → reconcile don't re-enter; ONE history
  // snapshot is pushed for the whole gesture (D-03, gated on !programmatic + history). The
  // optional `opts.options` (elk layout options — direction/spacing) is forwarded to
  // arrange.layout() (D-01 discretion — default-only is fine; the arg stays optional).
  //
  // Collision discipline: `autoArrange` is NOT a Lit lifecycle name (update/render/firstUpdated/
  // updated/willUpdate/requestUpdate), NOT an inherited DOM method (the Embla scrollTo lesson),
  // NOT an emit (node-*/connection-*/translated/context-menu/selection-change/edge-*/node-action),
  // NOT a prop, NOT a React model-setter (graph/zoom → setGraph/setZoom) — clean on all 6.
  async function autoArrange(opts: any) {
    if (!arrange.current || !area.current) return;
    // Set elkjs dimensions on every live node instance from its measured node-view element
    // (Pitfall 3) — without dims the classic preset stacks all nodes at (0,0).
    for (const [id, node] of nodeInstances as any) {
      const view = area.current.nodeViews ? area.current.nodeViews.get(id) : null;
      const el = view && view.element ? view.element : null;
      node.width = el && el.offsetWidth ? el.offsetWidth : MINIMAP_DEFAULT_NODE_W;
      node.height = el && el.offsetHeight ? el.offsetHeight : MINIMAP_DEFAULT_NODE_H;
    }
    // ONE history entry for the arrange gesture, captured BEFORE the write (pushHistory reads
    // lastWrittenGraph, still the pre-arrange state). Gated on !programmatic + history.
    pushHistory();
    programmatic.current++;
    try {
      await arrange.current.layout(opts && opts.options ? {
        options: opts.options
      } : undefined);
    } finally {
      programmatic.current--;
    }
    // Read the arranged positions back into a FRESH graph object (controlled-graph contract).
    // Echo-guarded: commitGraph → $model.graph re-bind must not re-enter the reconcile as a new
    // gesture. (The arrange already moved the engine to these coords, so the reconcile is a
    // no-op diff; the guard is belt-and-braces + suppresses any history re-entry.)
    programmatic.current++;
    try {
      const g = baseGraph();
      const nodes = (g.nodes || []).map((n: any) => {
        const v = n && n.id != null && area.current.nodeViews ? area.current.nodeViews.get(n.id) : null;
        return v && v.position ? {
          ...n,
          x: v.position.x,
          y: v.position.y
        } : n;
      });
      commitGraph({
        ...g,
        nodes
      });
    } finally {
      programmatic.current--;
    }
  }

  // ─── imperative selection control ────────────────────────────────────────────
  // Selection was previously PUSH-ONLY (the `selection-change` emit fires on change,
  // but a consumer couldn't READ or DRIVE selection). These reuse the internal
  // `selector` / `nodeSelectApi` (AreaExtensions.selector + selectableNodes) already
  // wired for the marquee — no new engine state. All no-op when selection is off
  // (readonly / !selectable, when `nodeSelectApi` is null). Each schedules the same
  // post-settle `selection-change` recompute the marquee uses, so an imperative
  // select keeps the consumer's bound state in sync (the zoomTo→$model.zoom echo
  // stance). Collision discipline: `selectNode` is NOT bare `select` — `select` is
  // an inherited HTMLElement method (Lit shadow, the Embla scrollTo lesson) AND a
  // FullCalendar-style emit hazard; getSelectedNodes/clearSelection/selectAll/
  // centerOnNode are NOT emits (selection-change/node-*/edge-*), NOT props, NOT
  // React model-setters (graph/zoom → setGraph/setZoom), NOT Lit lifecycle.
  //
  // getSelectedNodes() — the currently-selected nodes as { id, label, x, y } (the
  // getNodes() shape, filtered to the live selection). Empty when nothing selected.
  // ─── imperative selection control ────────────────────────────────────────────
  // Selection was previously PUSH-ONLY (the `selection-change` emit fires on change,
  // but a consumer couldn't READ or DRIVE selection). These reuse the internal
  // `selector` / `nodeSelectApi` (AreaExtensions.selector + selectableNodes) already
  // wired for the marquee — no new engine state. All no-op when selection is off
  // (readonly / !selectable, when `nodeSelectApi` is null). Each schedules the same
  // post-settle `selection-change` recompute the marquee uses, so an imperative
  // select keeps the consumer's bound state in sync (the zoomTo→$model.zoom echo
  // stance). Collision discipline: `selectNode` is NOT bare `select` — `select` is
  // an inherited HTMLElement method (Lit shadow, the Embla scrollTo lesson) AND a
  // FullCalendar-style emit hazard; getSelectedNodes/clearSelection/selectAll/
  // centerOnNode are NOT emits (selection-change/node-*/edge-*), NOT props, NOT
  // React model-setters (graph/zoom → setGraph/setZoom), NOT Lit lifecycle.
  //
  // getSelectedNodes() — the currently-selected nodes as { id, label, x, y } (the
  // getNodes() shape, filtered to the live selection). Empty when nothing selected.
  function getSelectedNodes() {
    const sel = new Set(selectedNodeIds().map((x: any) => String(x)));
    return getNodes().filter((n: any) => sel.has(String(n.id)));
  }
  // selectNode(id, accumulate?) — programmatically select a node (sidebar/search →
  // highlight). accumulate=true adds to the current selection; falsy replaces it.
  // selectNode(id, accumulate?) — programmatically select a node (sidebar/search →
  // highlight). accumulate=true adds to the current selection; falsy replaces it.
  function selectNode(id: any, accumulate: any) {
    if (!nodeSelectApi.current || id == null) return;
    nodeSelectApi.current.select(id, !!accumulate);
    scheduleSelectionEmit();
  }
  // clearSelection() — unselect every selected node (and any selected edge).
  // clearSelection() — unselect every selected node (and any selected edge).
  function clearSelection() {
    if (nodeSelectApi.current) {
      for (const id of selectedNodeIds() as any) nodeSelectApi.current.unselect(id);
    }
    clearEdgeSelection();
    scheduleSelectionEmit();
  }
  // selectAll() — select every node (Ctrl+A is not bound; marquee only covers a
  // dragged region). Mirrors the marquee's first-replaces / rest-accumulate pattern.
  // selectAll() — select every node (Ctrl+A is not bound; marquee only covers a
  // dragged region). Mirrors the marquee's first-replaces / rest-accumulate pattern.
  function selectAll() {
    if (!nodeSelectApi.current) return;
    let first = true;
    for (const n of getNodes() as any) {
      nodeSelectApi.current.select(n.id, !first);
      first = false;
    }
    scheduleSelectionEmit();
  }
  // centerOnNode(id, opts?) — pan (and optionally zoom via opts.zoom) to center the
  // viewport on a node by id. setCenter is coordinate-based; this measures the node
  // to compute its center in GRAPH coords (position is the top-left; offsetW/H are
  // unscaled graph units), falling back to the minimap default dims pre-measure.
  // centerOnNode(id, opts?) — pan (and optionally zoom via opts.zoom) to center the
  // viewport on a node by id. setCenter is coordinate-based; this measures the node
  // to compute its center in GRAPH coords (position is the top-left; offsetW/H are
  // unscaled graph units), falling back to the minimap default dims pre-measure.
  async function centerOnNode(id: any, opts: any) {
    if (!area.current || id == null) return;
    const view = area.current.nodeViews ? area.current.nodeViews.get(id) : null;
    if (!view || !view.position) return;
    const el = view.element;
    const w = el && el.offsetWidth ? el.offsetWidth : MINIMAP_DEFAULT_NODE_W;
    const h = el && el.offsetHeight ? el.offsetHeight : MINIMAP_DEFAULT_NODE_H;
    await setCenter(view.position.x + w / 2, view.position.y + h / 2, opts);
  }

  useEffect(() => {
    interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portals = {
    node: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
      const slot = _renderNodeRef.current ?? props.slots?.['node'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal node { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-node', 'cd396d6a');
      const root = createRoot(container);
      const renderScope = (s: { node: unknown; selected: unknown; emit: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { node: unknown; selected: unknown; emit: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
    toolbar: (container: HTMLElement, scope: { node: unknown; emit: unknown }): ReactivePortalHandle => {
      const slot = _renderToolbarRef.current ?? props.slots?.['toolbar'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal toolbar { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-toolbar', 'cd396d6a');
      const root = createRoot(container);
      const renderScope = (s: { node: unknown; emit: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { node: unknown; emit: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
  };
    const container = canvasEl.current;

    // Resolve a `--rozie-flow-*` token off the live canvas element for the imperative
    // SVG attributes that can't take a raw `var()` (the arrowhead fill + the minimap
    // node/mask/viewport colors). Reads post-mount (container is live here → ROZ123-safe)
    // via getComputedStyle; the custom property inherits onto `.rozie-flow-canvas` from
    // any theme import (themes/base.css dark overrides, the shadcn/material/bootstrap
    // bridges) or `:root` override, and falls back to the historical literal when unset —
    // so the zero-import light default stays byte-identical while an imported dark theme
    // + design-system bridges track automatically.
    const flowToken = (name: any, fallback: any) => {
      try {
        const v = container ? getComputedStyle(container).getPropertyValue(name) : '';
        return v && v.trim() || fallback;
      } catch (e: any) {
        return fallback;
      }
    };
    lastPropNodeIds.current = [];
    lastPropConnIds.current = [];
    editor.current = new NodeEditor();
    area.current = new AreaPlugin(container);
    connectionPlugin.current = new ConnectionPlugin();
    connectionPlugin.current.addPreset(ConnectionPresets.classic.setup());

    // Resolve a port's VISUAL position (F2) from the per-TYPE port schema (portReg, keyed
    // `type::side::key`), defaulting by DIRECTION (input → left, output → right) for exact
    // back-compat. DEFINED HERE inside $onMount (NOT top level) so its $data.portReg read
    // lowers on React to the live `_portRegRef.current`, not a stale-empty mount-time
    // closure (the portTypeOf discipline). Used by both the socket-anchor offset below and
    // renderNode's socket layout.
    const resolvePortPosition = (type: any, side: any, key: any) => {
      const entry = type != null && key != null ? _portRegRef.current[type + '::' + side + '::' + key] : null;
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
    socketWatcher.current = getDOMSocketPosition({
      offset: socketOffset
    });
    editor.current.use(area.current);
    area.current.use(connectionPlugin.current);

    // ── T2.5 RECONNECT coalescing pipe (D-08 reconnectable edges, D-03 one-gesture-one-entry) ──
    // `connectionpick` / `connectiondrop` are emitted on the ConnectionPlugin's OWN scope (they
    // are NOT editor signals like connectioncreated/removed, nor area signals like nodepicked),
    // so they must be observed via a pipe attached DIRECTLY to `connectionPlugin` — they do not
    // propagate into editor.addPipe / area.addPipe. Grabbing an already-connected input socket
    // fires connectionpick, then the classic preset removes the old edge + (on drop over a new
    // socket) adds a new one — a remove+add pair that would push TWO history entries (Pitfall 2).
    // We open a reconnect-in-flight window on connectionpick (capturing the PRE-gesture snapshot
    // ONCE) and close it on connectiondrop (pushing that single snapshot iff the gesture actually
    // changed the graph) — so the whole reconnect is ONE undoable step.
    connectionPlugin.current.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'connectionpick') {
        // Open the coalesce window + capture the pre-gesture snapshot once. Gated on
        // !programmatic + history (a restore-driven engine op must not record history). A
        // re-pick while a close is pending cancels the pending close (the gesture continues).
        if (!programmatic.current && props.history !== false) {
          reconnectInFlight.current++;
          reconnectPreSnapshot.current = snapshotCurrent();
          reconnectDidWriteBack.current = false;
          reconnectCloseScheduled.current = false;
        }
      } else if (context.type === 'connectiondrop') {
        // The gesture ended. CRITICAL ORDERING: the classic preset emits `connectiondrop`
        // BEFORE the editor's `connectionremoved` / `connectioncreated` signals fire (the
        // pseudo-connection is dropped, THEN the real add/remove run — verified in the event
        // trace: drop → connectioncreate → connectioncreated → connectionremove →
        // connectionremoved). So we must NOT close the window synchronously here, or the
        // trailing writeBacks would run with inFlight=0 and each push its own (wrong) history
        // entry. Instead DEFER the close to a macrotask (setTimeout 0), which runs after all
        // the synchronous + microtask writeBack signals have settled. The window stays open
        // across the remove+add (both suppress their per-event push, setting
        // reconnectDidWriteBack), then closeReconnectGesture pushes the SINGLE pre-gesture
        // snapshot iff the graph actually changed. Re-entrant picks can't desync because the
        // close is gated on a one-shot scheduled flag.
        scheduleReconnectClose();

        // ── T2.7 CONNECT-END-ON-PANE (D-07, pure emit) ──
        // A drag that STARTED on an output socket and ENDED on empty canvas (no target
        // socket, no connection created) surfaces `@connect-end { source, sourceOutput,
        // position }` so the consumer can run its OWN node-picker / create-node flow at the
        // drop point (the n8n "drag off a port → drop on the pane → pick a node" UX). The
        // component owns ONLY this hook — it creates NO node and shows NO picker (D-07,
        // consumer-owns-creation, exactly like screenToFlowPosition + the palette drop).
        // Detection: `socket == null` (released over the pane, not a socket) && `created ==
        // false` (no edge was made) && `initial.side === 'output'` (we only surface OUTPUT-
        // started drags — an input-started drag off the pane has no "source output" to seed
        // a downstream node from, and the reconnect path already owns input-endpoint drags).
        // Position = `area.area.pointer` (the AreaPlugin's live pointer, ALREADY in graph
        // coords — the same origin screenToFlowPosition projects into), so no client→graph
        // projection is needed; we still fall back to screenToFlowPosition over a raw
        // clientX/clientY if a future plugin build stops tracking area.area.pointer. Gated on
        // !programmatic so a restore/imperative-driven drop never emits. NO node is created.
        const cd = context.data;
        if (cd && !cd.socket && cd.created === false && cd.initial && cd.initial.side === 'output' && !programmatic.current) {
          let pos: any = null;
          const inner = area.current && area.current.area ? area.current.area : null;
          if (inner && inner.pointer && typeof inner.pointer.x === 'number' && typeof inner.pointer.y === 'number') {
            pos = {
              x: inner.pointer.x,
              y: inner.pointer.y
            };
          }
          if ((!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') && cd.initial && cd.initial.element && typeof cd.initial.element.getBoundingClientRect === 'function') {
            // Fallback: project the last-known pointer client coords through the shipped
            // screenToFlowPosition (graph-coord inverse of the area transform). The drop event
            // carries no pointer; use the source socket element's center as a degraded anchor.
            const r = cd.initial.element.getBoundingClientRect();
            pos = screenToFlowPosition(r.left + r.width / 2, r.top + r.height / 2);
          }
          if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
            props.onConnectEnd && props.onConnectEnd({
              source: cd.initial.nodeId,
              sourceOutput: cd.initial.key,
              position: {
                x: pos.x,
                y: pos.y
              }
            });
          }
        }
      }
      return context;
    });
    // The socket-position watcher (and, conceptually, our vanilla "render plugin")
    // must attach to a CHILD scope of the area — `attach` calls
    // `scope.parentScope(BaseAreaPlugin)`, which walks UP one level, so the scope's
    // parent must BE the area. Attaching to `area` itself fails ("actual parent is
    // not instance of type") because area's parent is the NodeEditor. So we add a
    // minimal child Scope and attach the watcher to it. Rete forwards every area
    // signal (render/nodetranslated/unmount/…) into this child's signal, so the
    // watcher sees socket renders + node moves and recomputes socket positions.
    renderScope.current = new Scope('rozie-vanilla-render');
    area.current.use(renderScope.current);
    socketWatcher.current.attach(renderScope.current);

    // ── T2.6 auto-layout (D-08, verb-only) ──
    // Wire the AutoArrangePlugin (elkjs classic preset) so the top-level autoArrange() verb
    // can run a layered relayout on demand. area.use(arrange) installs it as an area-scope
    // plugin; arrange.layout() mutates the engine node positions directly (calls area.translate
    // internally). The verb reads the arranged positions BACK into a FRESH $model.graph (the
    // controlled-graph contract — the engine is never the source of truth). NO auto-trigger —
    // the consumer calls autoArrange() (the MapLibre verb-first stance).
    arrange.current = new AutoArrangePlugin();
    arrange.current.addPreset(ArrangePresets.classic.setup());
    area.current.use(arrange.current);

    // ── selection (selectableNodes) ──
    // Capture the returned handle ({ select(id, accumulate), unselect(id) }) so the T2.4
    // marquee can PROGRAMMATICALLY select each intersecting node (select(id, true) =
    // accumulate). The handle is null when selection is off (readonly / !selectable), in
    // which case the marquee branch no-ops.
    if (props.selectable && !props.readonly) {
      selector.current = AreaExtensions.selector();
      nodeSelectApi.current = AreaExtensions.selectableNodes(area.current, selector.current, {
        accumulating: props.accumulateOnCtrl ? AreaExtensions.accumulateOnCtrl() : {
          active: () => false
        }
      });
    }
    // raise the picked node above its siblings.
    AreaExtensions.simpleNodesOrder(area.current);

    // ── zoom clamp (restrictor) ──
    const min = typeof props.minZoom === 'number' && props.minZoom > 0 ? props.minZoom : 0;
    const max = typeof props.maxZoom === 'number' && props.maxZoom > 0 ? props.maxZoom : 0;
    if (min || max) {
      AreaExtensions.restrictor(area.current, {
        scaling: {
          min: min || 0.01,
          max: max || 100
        }
      });
    }

    // ── snap-to-grid ──
    if (typeof props.snapGrid === 'number' && props.snapGrid > 0) {
      AreaExtensions.snapGrid(area.current, {
        size: props.snapGrid,
        dynamic: true
      });
    }

    // ── interaction toggles ──
    if (!props.pannable) area.current.area.setDragHandler(null);
    if (!props.zoomable) area.current.area.setZoomHandler(null);

    // ── Delete / Backspace key → cascading delete of the selected node(s) (Win 1) ──
    // Attached to the engine container ($refs.canvasEl, which carries tabindex="0" in
    // the template so it can receive key focus) rather than `document`: the listener
    // lives INSIDE the Lit shadow root alongside the canvas, so a canvas-focused key
    // reaches it on Lit too (a `:target="document"` listener does not reliably see
    // shadow-scoped focus across all 6 — the canvas-element listener is the robust
    // cross-target path). Gated on selectable && !readonly. We guard against deleting
    // while focus is in a node-body text field (INPUT/TEXTAREA/contenteditable) so
    // typing in a node never nukes it. The listener is removed in the teardown.
    if (props.selectable && !props.readonly && container && typeof container.addEventListener === 'function') {
      onCanvasKeydown.current = (e: any) => {
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
        if (selectedConnId.current != null) {
          e.preventDefault();
          const id = selectedConnId.current;
          clearEdgeSelection();
          writeBackConnectionRemoved(id);
        }
      };
      keydownContainer.current = container;
      container.addEventListener('keydown', onCanvasKeydown.current);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // THE VANILLA RENDER PIPE. Intercepts the AreaPlugin's render/unmount signals.
    // ALWAYS returns context (returning undefined would halt the signal chain and
    // break the ConnectionPlugin / socket watcher downstream).
    // ─────────────────────────────────────────────────────────────────────────
    area.current.addPipe((context: any) => {
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
    // The engine-node parameter is named `node` (matching the `node` portal slot) —
    // a script-side `$slots.node` read inside a helper whose OWN parameter also
    // shadows `node` is now AUTO-FIXED by the Svelte emitter (Phase 73 item #1):
    // `findRForSlotNameCollisions` detects the script/param-scope shadow and renames
    // the lowered slot-merge binding to `node$$slot` everywhere it's referenced
    // (including this function's own `$slots.node` read below), so `if ($slots.node)`
    // resolves to the true slot-presence check, never this local parameter.
    const renderNode = (element: any, node: any) => {
      // a (re)render means node DOM exists / changed → refresh the minimap (its node
      // rects measure these elements; coalesced, so calling it on every render is cheap,
      // and it covers Lit's measure-after-first-paint).
      if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
      const id = node.id;
      const meta = nodeMeta.get(id) || {
        id,
        type: undefined,
        data: {}
      };
      const existing = nodeEntries.get(id);
      const selected = node.selected === true;
      // default-chrome fallback label (only when a node's type has no #body template).
      const chromeLabel = meta.data && meta.data.label != null ? String(meta.data.label) : meta.type != null ? String(meta.type) : '';
      if (existing && existing.element === element) {
        // in-place update — refresh chrome + reactive portal scope, leave sockets.
        existing.box.classList.toggle('is-selected', selected);
        // NodeResizer (D-06/D-07): re-apply an explicit width/height as a fixed CSS
        // box on every re-render; clear back to '' (auto-size) when meta no longer
        // carries a size, so a double-click-reset (74-03) reverts a previously
        // sized box on the very next render.
        existing.box.style.width = meta.width != null ? meta.width + 'px' : '';
        existing.box.style.height = meta.height != null ? meta.height + 'px' : '';
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
      // NodeResizer (D-06/D-07): a graph node with an explicit width/height renders
      // at that EXACT fixed CSS box size instead of auto-sizing from #body content.
      // undefined/null (the default, never-resized state) skips the assignment
      // entirely — CSS width/height stay `auto`, today's behavior unchanged.
      if (meta.width != null) box.style.width = meta.width + 'px';
      if (meta.height != null) box.style.height = meta.height + 'px';
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
      for (const key of Object.keys(node.inputs) as any) portEntries.push({
        side: 'input',
        key,
        position: resolvePortPosition(meta.type, 'input', key)
      });
      for (const key of Object.keys(node.outputs) as any) portEntries.push({
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
          renderSocketInto(p.position === 'right' ? outputsCol : inputsCol, node, p.side, p.key, p.position, socketDisposers);
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
          renderSocketInto(zone, node, p.side, p.key, p.position, socketDisposers);
        }
      }

      // emit per-node event helper handed to the slot scope so a consumer node body
      // can raise a custom event carrying its id (e.g. a delete button).
      const emit = (name: any, detail: any) => props.onNodeAction && props.onNodeAction({
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
      const typeSpec = meta.type != null ? _typeRegRef.current[meta.type] : null;
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
      if ((props.renderNode ?? props.slots?.["node"])) {
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
    const renderSocketInto = (zone: any, node: any, side: any, key: any, position: any, socketDisposers: any) => {
      const port = (side === 'input' ? node.inputs : node.outputs)[key];
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
      area.current.emit({
        type: 'render',
        data: {
          type: 'socket',
          side,
          key,
          nodeId: node.id,
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
      area.current.emit({
        type: 'rendered',
        data: {
          type: 'socket',
          side,
          key,
          nodeId: node.id,
          element: socketEl,
          payload: {
            socket: port.socket
          }
        }
      });
      socketDisposers.push(() => {
        area.current.emit({
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
      // keeps a constant pixel size under the area zoom transform. Inline fill (the
      // `--rozie-flow-connection-stroke` token via flowToken(), default #64748b — matching
      // the connection stroke) is the cross-target-safe choice — no scoped-CSS / :root rule
      // needed for the marker DOM. The marker does NOT change the path `d`
      // or the socket geometry (the rete-flow-align cell stays green) — redraw() only
      // sets the head's `orient` and a `stroke-dasharray` that visually trims the last
      // ARROW_LEN of the stroke so the line meets the head without poking through it.
      const markerId = 'rozie-arrow-' + String(id);
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', markerId);
      // Sized in userSpaceOnUse (constant pixels under zoom). A 12×10 head reads
      // clearly at default zoom (the old 6×6 was barely visible). refX=12 sits the
      // TIP exactly at the path-end vertex (the socket); refY=5 centers it. `orient`
      // is recomputed per-redraw from the path's final-segment tangent, and the
      // visible stroke is trimmed back to the arrow base, so the head points along
      // the edge's actual approach AND the line meets it cleanly — see redraw().
      marker.setAttribute('markerWidth', '13');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '12');
      marker.setAttribute('refY', '5');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerUnits', 'userSpaceOnUse');
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrow.setAttribute('class', 'rozie-flow-connection__arrow');
      arrow.setAttribute('d', 'M0,0 L12,5 L0,10 Z');
      arrow.setAttribute('fill', flowToken('--rozie-flow-connection-stroke', '#64748b'));
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
      if (props.selectable && !props.readonly && !srcDangling && !tgtDangling) {
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
      // Arrowhead geometry (redraw): the head is oriented along the path's tangent
      // over its LAST `ARROW_LEN` (angled for a descending edge, aligned with where
      // the line actually meets the head — unlike the chord, which diverges from the
      // bezier's flattened end tangent), and the visible stroke is trimmed back to
      // the arrow base on SOLID edges so the line's width can't poke past the
      // tapering tip (the "square tip"). Dashed edges keep their pattern untrimmed.
      const ARROW_LEN = 12;
      const isDashed = !!(emeta && emeta.dashed === true);
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
      const curvature = typeof props.curvature === 'number' ? props.curvature : 0.3;
      const redraw = () => {
        if (!start || !end) return;
        // branch on the resolved edge type; default (bezier/unknown) stays
        // classicConnectionPath UNCHANGED → byte-identical bezier output.
        const d = edgeType === 'step' ? stepPath(start, end) : edgeType === 'smoothstep' ? smoothstepPath(start, end) : edgeType === 'straight' ? straightPath(start, end) : classicConnectionPath([start, end], curvature);
        path.setAttribute('d', d);
        // Orient the head and trim the visible stroke back to the arrow base (solid
        // edges) so the line meets the head without poking through the tip.
        // getTotalLength/getPointAtLength are SVGGeometryElement methods unavailable
        // in a non-rendering env (jsdom) → guard and fall back to orient='auto' / untrimmed.
        let pathLen = 0;
        try {
          pathLen = path.getTotalLength();
        } catch (e: any) {
          pathLen = 0;
        }
        if (pathLen > ARROW_LEN + 1) {
          // BACKWARD edge (target socket left of the source socket): the classic
          // bezier overshoots both control points, looping the curve into tight
          // u-turns right at the sockets, so a sampled local tangent is unstable and
          // the head curls. Use the path's TRUE end tangent (orient='auto' — the
          // horizontal entry into the input) for a stable, standard arrow. FORWARD
          // edges keep the final-ARROW_LEN tangent, which follows a descending edge
          // AND aligns with where the line meets the head.
          if (end.x < start.x) {
            marker.setAttribute('orient', 'auto');
          } else {
            const tip = path.getPointAtLength(pathLen);
            const back = path.getPointAtLength(pathLen - ARROW_LEN);
            marker.setAttribute('orient', String(Math.atan2(tip.y - back.y, tip.x - back.x) * 180 / Math.PI));
          }
          if (!isDashed) path.setAttribute('stroke-dasharray', pathLen - ARROW_LEN + ' ' + pathLen);
        } else {
          marker.setAttribute('orient', 'auto');
          if (!isDashed) path.removeAttribute('stroke-dasharray');
        }
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
      if (!srcDangling) un1 = socketWatcher.current.listen(connection.source, 'output', connection.sourceOutput, (p: any) => {
        start = p;
        redraw();
      });
      if (!tgtDangling) un2 = socketWatcher.current.listen(connection.target, 'input', connection.targetInput, (p: any) => {
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
      const entry = _portRegRef.current[meta.type + '::' + side + '::' + key];
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
    editor.current.addPipe((context: any) => {
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
        if (props.validateTypes !== false) {
          const srcType = portTypeOf(c.source, 'output', c.sourceOutput);
          const tgtType = portTypeOf(c.target, 'input', c.targetInput);
          if (srcType != null && tgtType != null && srcType !== tgtType) {
            if (!programmatic.current) props.onConnectionRejected && props.onConnectionRejected(conn);
            return undefined; // ← CANCEL: type mismatch
          }
        }
        // 2. canConnect OVERRIDE (Phase-40 contract — custom rule, in addition).
        if (typeof props.canConnect === 'function' && props.canConnect(conn) === false) {
          if (!programmatic.current) props.onConnectionRejected && props.onConnectionRejected(conn);
          return undefined; // ← CANCEL: Signal.emit halts, addConnection returns false
        }
      }
      return context;
    });

    // ─── forward engine events (echo-guarded via `programmatic`) ───────────────
    editor.current.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'connectioncreated') {
        // keep engine truth in sync so reconcile diffs correctly — a user-drawn
        // connection (auto id) must register here or the next graph pass re-adds it.
        connInstances.set(context.data.id, context.data);
        if (!programmatic.current) {
          // WRITE-BACK: append the new connection into a fresh graph object (D4).
          writeBackConnectionCreated(context.data);
          // keep the discrete event too (back-compat).
          props.onConnectionCreated && props.onConnectionCreated(serializeConn(context.data));
        }
      } else if (context.type === 'connectionremoved') {
        connInstances.delete(context.data.id);
        connMeta.delete(context.data.id);
        if (!programmatic.current) {
          // WRITE-BACK: filter the removed connection out of a fresh graph object (D4).
          writeBackConnectionRemoved(context.data.id);
          props.onConnectionRemoved && props.onConnectionRemoved({
            id: context.data.id
          });
        }
      }
      return context;
    });
    area.current.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'nodepicked') {
        props.onNodePicked && props.onNodePicked({
          id: context.data.id
        });
        // T1.3 — pointer-DOWN: stash the PRE-drag graph snapshot (before any movement). It
        // is committed to history on the first `nodetranslated` (only if a drag follows;
        // gated on !programmatic + history). A re-pick mid-drag won't overwrite a live one.
        if (!programmatic.current && props.history !== false && !dragGestureActive.current) {
          pendingDragSnapshot.current = snapshotCurrent();
        }
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
        // T1.3 — a pointerup ends any in-progress drag gesture, so the NEXT drag pushes a
        // fresh history snapshot (one gesture = one undo step, D-03). Drop any stashed
        // pre-drag snapshot that was never committed (a pick with no drag).
        dragGestureActive.current = false;
        pendingDragSnapshot.current = null;
        // T1.1: a background pointerup (anywhere not on a connection path) clears the edge
        // selection — UNLESS this same gesture just selected an edge (the path's own
        // pointerup ran in the same tick and raised `edgeClickGuard`; the guard self-resets
        // on the next microtask). Mirrors the node selectable's click-to-deselect.
        if (!edgeClickGuard.current && selectedConnId.current != null) clearEdgeSelection();
      } else if (context.type === 'nodetranslated') {
        if (!programmatic.current) {
          const id = context.data.id;
          const pos = context.data.position;
          const meta = nodeMeta.get(id);
          if (meta) {
            meta.x = pos.x;
            meta.y = pos.y;
          }
          // T1.3 — commit ONE history snapshot per drag gesture, at its FIRST translate:
          // the pre-move snapshot stashed on nodepicked (a drag truly happened now, not just
          // a pick). dragGestureActive holds until the drag-ending pointerup resets it, so a
          // continuous drag = ONE undo step (D-03).
          if (!dragGestureActive.current) {
            dragGestureActive.current = true;
            if (pendingDragSnapshot.current) {
              pushHistorySnapshot(pendingDragSnapshot.current);
              pendingDragSnapshot.current = null;
            }
          }
          // WRITE-BACK (coalesced): accumulate the latest position for this node and
          // flush ONE fresh graph object per animation frame (Pitfall 2 — the drag
          // storm). The discrete `node-moved` emit stays per-translate (back-compat).
          pendingDragPositions.set(id, {
            x: pos.x,
            y: pos.y
          });
          scheduleDragFlush();
          props.onNodeMoved && props.onNodeMoved({
            id,
            x: pos.x,
            y: pos.y
          });
        }
        // a node moved → its minimap rect moves (works during a programmatic translate too).
        if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
        // T2.8 — the selected node moved → re-track its toolbar overlay (no-op if off).
        if (scheduleToolbarTrack.current) scheduleToolbarTrack.current();
      } else if (context.type === 'translated') {
        props.onTranslated && props.onTranslated({
          x: context.data.position.x,
          y: context.data.position.y
        });
        // the viewport window moved → redraw the minimap viewport rect + mask.
        if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
        // T2.8 — a pan shifts the node's screen rect → re-track the toolbar (no-op if off).
        if (scheduleToolbarTrack.current) scheduleToolbarTrack.current();
      } else if (context.type === 'zoomed') {
        if (!programmatic.current) {
          const k = area.current.area.transform.k;
          if (k !== _zoomRef.current) setZoom(k);
        }
        // the viewport window resized (zoom) → redraw the minimap viewport rect + mask.
        if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
        // T2.8 — a zoom changes the node's screen rect/size → re-track the toolbar (no-op if off).
        if (scheduleToolbarTrack.current) scheduleToolbarTrack.current();
      } else if (context.type === 'contextmenu') {
        // suppress the native browser menu over the canvas; surface a hook instead.
        context.data.event.preventDefault();
        const ctx = context.data.context;
        props.onContextMenu && props.onContextMenu({
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
      if (!editor.current || !area.current) return;
      const graphNodes = Array.isArray(_graphRef.current && _graphRef.current.nodes) ? _graphRef.current.nodes : [];
      const want = [];
      programmatic.current++;
      try {
        for (const spec of graphNodes as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          nodeMeta.set(spec.id, spec);
          let node = nodeInstances.get(spec.id);
          if (!node) {
            node = buildNode(spec, _portRegRef.current);
            nodeInstances.set(spec.id, node);
            await editor.current.addNode(node);
            await area.current.translate(spec.id, {
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
            } = portSchemaForType(spec.type, _portRegRef.current);
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
            const view = area.current.nodeViews.get(spec.id);
            if (view && spec.x != null && spec.y != null && (view.position.x !== spec.x || view.position.y !== spec.y)) {
              await area.current.translate(spec.id, {
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
            await area.current.update('node', spec.id);
            // a port change must re-run connections — an edge that was skipped because
            // its endpoint port didn't exist yet can now be drawn.
            if (portsAdded && reconcileConnections.current) await reconcileConnections.current();
          }
        }
        // remove dropped GRAPH-managed nodes (+ their connections) — imperatively added
        // nodes (NOT in lastPropNodeIds) survive (the power-user escape hatch).
        const tracked = new Set(lastPropNodeIds.current);
        for (const id of tracked as any) {
          if (!want.includes(id) && nodeInstances.has(id)) {
            for (const c of editor.current.getConnections() as any) {
              if (c.source === id || c.target === id) await editor.current.removeConnection(c.id);
            }
            await editor.current.removeNode(id);
            nodeInstances.delete(id);
            nodeMeta.delete(id);
          }
        }
        lastPropNodeIds.current = want;
      } finally {
        programmatic.current--;
      }
    };

    // Re-entrancy-guarded entry point. If a pass is already running, mark a re-run and
    // return — the in-flight pass loops until no further request is pending. Serializing
    // overlapping reconciles is what stops the Lit async-context cascade from racing the
    // engine into "cannot find node" (which otherwise aborts the declarative graph build).
    reconcileNodes.current = async () => {
      if (reconcileNodesRunning.current) {
        reconcileNodesPending.current = true;
        return;
      }
      reconcileNodesRunning.current = true;
      try {
        do {
          reconcileNodesPending.current = false;
          await reconcileNodesPass();
        } while (reconcileNodesPending.current);
      } finally {
        reconcileNodesRunning.current = false;
      }
    };
    reconcileConnections.current = async () => {
      if (!editor.current) return;
      // Edges come ONLY from the bound graph's `connections` (the single source of
      // truth — declarative <Connection> children are gone). Normalize id-defaulting
      // (a connection authored without an id gets a stable derived id) so an edge the
      // canvas wrote back (carrying the engine id) and a hand-authored edge dedup.
      const graphConns = Array.isArray(_graphRef.current && _graphRef.current.connections) ? _graphRef.current.connections : [];
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
      programmatic.current++;
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
              await area.current.update('connection', spec.id);
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
          await editor.current.addConnection(conn);
        }
        // remove dropped GRAPH-managed edges — imperatively added edges survive.
        const tracked = new Set(lastPropConnIds.current);
        for (const id of tracked as any) {
          if (!want.includes(id) && connInstances.has(id)) {
            await editor.current.removeConnection(id);
            connInstances.delete(id);
            connMeta.delete(id);
          }
        }
        lastPropConnIds.current = want;
      } finally {
        programmatic.current--;
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
      const view = area.current && area.current.nodeViews ? area.current.nodeViews.get(id) : null;
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
      minimapRedrawRaf.current = 0;
      if (!props.minimap || !minimapSvg.current || !area.current || !container) return;
      const t = area.current.area.transform;
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
        const view = area.current.nodeViews.get(n.id);
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
      minimapMap.current = {
        minX,
        minY,
        scale,
        offX,
        offY
      };
      const toMMx = (gx: any) => (gx - minX) * scale + offX;
      const toMMy = (gy: any) => (gy - minY) * scale + offY;
      minimapSvg.current.innerHTML = '';
      for (const r of rects as any) {
        const fill = r.selected ? flowToken('--rozie-flow-accent', '#3b82f6') : flowToken('--rozie-flow-minimap-node-fill', '#94a3b8');
        minimapSvg.current.appendChild(mkMinimapRect(toMMx(r.gx), toMMy(r.gy), r.gw * scale, r.gh * scale, 'rozie-flow-minimap__node', fill, null, 0));
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
      mask.setAttribute('fill', flowToken('--rozie-flow-minimap-mask', 'rgba(15, 23, 42, 0.18)'));
      mask.setAttribute('d', 'M0 0 H' + MINIMAP_W + ' V' + MINIMAP_H + ' H0 Z ' + 'M' + mvx + ' ' + mvy + ' h' + mvw + ' v' + mvh + ' h' + -mvw + ' Z');
      minimapSvg.current.appendChild(mask);
      minimapSvg.current.appendChild(mkMinimapRect(mvx, mvy, mvw, mvh, 'rozie-flow-minimap__viewport', 'none', flowToken('--rozie-flow-accent', '#3b82f6'), 1.5));
    };

    // rAF-coalesced scheduler (bridged to the top-level $watch + the engine pipes). No-op
    // when :minimap is off (the bridge stays callable everywhere, cheap).
    scheduleMinimapRedraw.current = () => {
      if (!props.minimap || minimapRedrawRaf.current) return;
      if (typeof requestAnimationFrame === 'function') {
        minimapRedrawRaf.current = requestAnimationFrame(redrawMinimap);
      } else {
        minimapRedrawRaf.current = 1;
        Promise.resolve().then(redrawMinimap);
      }
    };

    // Map a minimap pointer event → graph coords (via the stored minimapMap) → setCenter.
    // Pan is a view op → allowed even when readonly, but gated by `pannable` (mirror the
    // main-canvas pannable gate). Pointer capture keeps the drag tracking off the box.
    const minimapPointerToGraph = (e: any) => {
      if (!minimapMap.current || !minimapHost.current) return null;
      const box = minimapHost.current.getBoundingClientRect();
      const rw = box.width || MINIMAP_W;
      const rh = box.height || MINIMAP_H;
      const mx = (e.clientX - box.left) * (MINIMAP_W / rw);
      const my = (e.clientY - box.top) * (MINIMAP_H / rh);
      return {
        gx: minimapMap.current.minX + (mx - minimapMap.current.offX) / minimapMap.current.scale,
        gy: minimapMap.current.minY + (my - minimapMap.current.offY) / minimapMap.current.scale
      };
    };
    if (props.minimap && minimapEl.current) {
      minimapHost.current = minimapEl.current;
      minimapSvg.current = document.createElementNS(SVGNS, 'svg');
      minimapSvg.current.setAttribute('class', 'rozie-flow-minimap__svg');
      minimapSvg.current.setAttribute('viewBox', '0 0 ' + MINIMAP_W + ' ' + MINIMAP_H);
      minimapSvg.current.setAttribute('preserveAspectRatio', 'none');
      minimapHost.current.appendChild(minimapSvg.current);
      onMinimapPointerDown.current = (e: any) => {
        if (!props.pannable) return;
        const g = minimapPointerToGraph(e);
        if (!g) return;
        minimapPanning.current = true;
        try {
          if (e.target && e.target.setPointerCapture && e.pointerId != null) e.target.setPointerCapture(e.pointerId);
        } catch (err: any) {}
        e.preventDefault();
        e.stopPropagation();
        setCenter(g.gx, g.gy, null);
      };
      onMinimapPointerMove.current = (e: any) => {
        if (!minimapPanning.current || !props.pannable) return;
        const g = minimapPointerToGraph(e);
        if (!g) return;
        e.preventDefault();
        setCenter(g.gx, g.gy, null);
      };
      onMinimapPointerUp.current = (e: any) => {
        if (!minimapPanning.current) return;
        minimapPanning.current = false;
        try {
          if (e.target && e.target.releasePointerCapture && e.pointerId != null) e.target.releasePointerCapture(e.pointerId);
        } catch (err: any) {}
      };
      minimapHost.current.addEventListener('pointerdown', onMinimapPointerDown.current);
      minimapHost.current.addEventListener('pointermove', onMinimapPointerMove.current);
      minimapHost.current.addEventListener('pointerup', onMinimapPointerUp.current);
    }

    // ─── T2.8 NodeToolbar (opt-in :node-toolbar) ─────────────────────────────────
    // A floating component-template overlay over the SELECTED node. The host div
    // (ref="toolbarEl") carries the [data-rozie-s-*] scope attr → PLAIN scoped CSS positions
    // it absolutely (NOT the :root engine-DOM escape hatch — it's component DOM, like the
    // marquee box + Controls). It is positioned from the engine node-view ELEMENT's rect
    // (which the AreaPlugin transforms for pan/zoom/drag) relative to the canvas container, so
    // the area transform is honored automatically — we read getBoundingClientRect() and
    // subtract the container's rect (the screenToFlowPosition discipline, but the other way).
    // Re-tracked on translated/zoomed/nodetranslated (the pipe branches that schedule the
    // minimap redraw) + on every selection emit. OPT-IN (default OFF) → existing demos +
    // FlowCanvasScreenshot are pixel-identical (the host div is r-if'd off when :node-toolbar
    // is false; selecting a node never pops it).

    // Resolve the SINGLE selected node id the toolbar should track: the one picked node when
    // EXACTLY one is selected, else null (no toolbar over a multi-select or empty selection —
    // a per-node action needs an unambiguous target). Read-only.
    const singleSelectedNodeId = () => {
      const ids = selectedNodeIds();
      return ids.length === 1 ? ids[0] : null;
    };

    // Position the toolbar host over the tracked node's engine element, or hide it. The
    // node-view element is already transformed by the AreaPlugin (pan/zoom/drag), so its
    // client rect minus the container's client rect gives the toolbar's container-relative
    // px — no manual transform math. Placed just ABOVE the node (bottom of the toolbar at the
    // node's top edge); clamped so it never goes off the top of the container.
    const trackToolbar = () => {
      toolbarTrackRaf.current = 0;
      if (!props.nodeToolbar || !toolbarHost.current || !area.current || !container) return;
      const id = toolbarSelectedId.current;
      if (id == null) {
        toolbarHost.current.style.display = 'none';
        return;
      }
      const view = area.current.nodeViews ? area.current.nodeViews.get(id) : null;
      const el = view && view.element ? view.element : null;
      const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
      if (!rect) {
        toolbarHost.current.style.display = 'none';
        return;
      }
      const cbox = container.getBoundingClientRect();
      // container-relative px of the node's top-left + width.
      const nx = rect.left - cbox.left;
      const ny = rect.top - cbox.top;
      const tbH = toolbarHost.current.offsetHeight || 30;
      let top = ny - tbH - 6;
      if (top < 2) top = ny + rect.height + 6; // flip below if it would clip the top
      toolbarHost.current.style.left = nx + 'px';
      toolbarHost.current.style.top = top + 'px';
      toolbarHost.current.style.display = 'flex';
    };
    scheduleToolbarTrack.current = () => {
      if (!props.nodeToolbar || toolbarTrackRaf.current) return;
      if (typeof requestAnimationFrame === 'function') {
        toolbarTrackRaf.current = requestAnimationFrame(trackToolbar);
      } else {
        toolbarTrackRaf.current = 1;
        Promise.resolve().then(trackToolbar);
      }
    };

    // Recompute the tracked node from the live selection + (re)mount the toolbar content for
    // it. Called from the selection emit (a pick/unpick changed the selection). When the
    // tracked id changes: if the consumer fills `#toolbar`, (re)render the reactive portal
    // with the new node scope; else the default buttons stay put (they read the live tracked
    // id at click time, so no re-mount needed). Then reposition.
    const syncToolbar = () => {
      if (!props.nodeToolbar || !toolbarHost.current) return;
      const id = singleSelectedNodeId();
      if (id === toolbarSelectedId.current && id == null === (toolbarSelectedId.current == null)) {
        // same target — just reposition (e.g. after a drag).
        scheduleToolbarTrack.current();
        return;
      }
      toolbarSelectedId.current = id;
      if ((props.renderToolbar ?? props.slots?.["toolbar"]) && id != null) {
        const meta = nodeMeta.get(id) || {
          id,
          type: undefined,
          data: {}
        };
        const scope = {
          node: meta,
          emit: toolbarEmit
        };
        if (toolbarHandle.current && toolbarHandle.current.update) {
          toolbarHandle.current.update(scope);
        } else {
          toolbarHandle.current = portals.toolbar(toolbarHost.current, scope);
        }
      }
      scheduleToolbarTrack.current();
    };
    syncToolbarSelection.current = syncToolbar;

    // The @node-action emit helper for the toolbar's actions (the EXISTING emit — no new emit,
    // T2.8). Carries the tracked node id. Handed to the `#toolbar` slot scope so a consumer
    // override can raise its own actions too.
    const toolbarEmit = (name: any, detail: any) => {
      const id = toolbarSelectedId.current;
      props.onNodeAction && props.onNodeAction({
        id,
        name,
        detail
      });
    };
    if (props.nodeToolbar && toolbarEl.current) {
      toolbarHost.current = toolbarEl.current;
      toolbarHost.current.style.display = 'none';
      if (!(props.renderToolbar ?? props.slots?.["toolbar"])) {
        // default chrome: delete + duplicate buttons. Static literal labels (Threat
        // T-44-06-1: no node-derived text rendered via innerHTML — these are fixed strings
        // set via textContent). Both fire @node-action on the tracked node.
        toolbarDeleteBtn.current = document.createElement('button');
        toolbarDeleteBtn.current.type = 'button';
        toolbarDeleteBtn.current.className = 'rozie-flow-toolbar__btn rozie-flow-toolbar__btn--delete';
        toolbarDeleteBtn.current.setAttribute('data-testid', 'flow-toolbar-delete');
        toolbarDeleteBtn.current.setAttribute('aria-label', 'Delete node');
        toolbarDeleteBtn.current.textContent = 'Delete';
        toolbarDuplicateBtn.current = document.createElement('button');
        toolbarDuplicateBtn.current.type = 'button';
        toolbarDuplicateBtn.current.className = 'rozie-flow-toolbar__btn rozie-flow-toolbar__btn--duplicate';
        toolbarDuplicateBtn.current.setAttribute('data-testid', 'flow-toolbar-duplicate');
        toolbarDuplicateBtn.current.setAttribute('aria-label', 'Duplicate node');
        toolbarDuplicateBtn.current.textContent = 'Duplicate';
        onToolbarDelete.current = (e: any) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          const id = toolbarSelectedId.current;
          if (id == null) return;
          toolbarEmit('delete', {
            id
          });
          toolbarSelectedId.current = null;
          deleteNode(id);
          scheduleToolbarTrack.current();
        };
        onToolbarDup.current = (e: any) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          const id = toolbarSelectedId.current;
          if (id == null) return;
          const newId = duplicateNode(id);
          toolbarEmit('duplicate', {
            id,
            newId
          });
          scheduleToolbarTrack.current();
        };
        // pointerup (NOT click — Rete swallows clicks during node interaction; the §6a item-7
        // discipline) on the COMPONENT-template buttons.
        toolbarDeleteBtn.current.addEventListener('pointerup', onToolbarDelete.current);
        toolbarDuplicateBtn.current.addEventListener('pointerup', onToolbarDup.current);
        toolbarHost.current.appendChild(toolbarDeleteBtn.current);
        toolbarHost.current.appendChild(toolbarDuplicateBtn.current);
      }
    }

    // ─── T2.4 MARQUEE select (mode:'select') ─────────────────────────────────────
    // A Figma-style rubber-band box. RESTORE-PATH resolution (RESEARCH Q2/A8): rete's
    // internal `Drag` class is NOT exported, so setDragHandler(null) can't be cleanly
    // reversed (re-instantiating Drag is impossible). Instead we leave the default pan Drag
    // installed and intercept the EMPTY-canvas pointerdown in the CAPTURE phase on the
    // container — the default Drag attaches its own bubble-phase pointerdown listener on the
    // SAME container (verified rete-area-plugin@2.1.5: setDragHandler → Drag.initialize(
    // this.container)), so a capture listener fires FIRST and stopPropagation() blocks pan
    // before it starts. The interception is gated PURELY on the live `$props.mode` flag, so
    // switching back to 'pan' restores pan with ZERO engine mutation (the persistent
    // mode-guard the research preferred). A node drag is UNTOUCHED in both modes: we only act
    // when the pointerdown target is NOT inside a node element (empty canvas).
    //
    // The box is a COMPONENT-TEMPLATE overlay div (ref="marqueeEl") — it carries the
    // [data-rozie-s-*] scope attr so a PLAIN scoped rule styles it (NOT the :root engine-DOM
    // escape hatch). On release we hit-test every graph node's rect (graph coords via
    // area.nodeViews.get(id).position + measureNodeSize) against the box (converted to graph
    // coords through the live transform) and nodeSelectApi.select(id, true) each intersector,
    // then scheduleSelectionEmit() (the existing @selection-change path — NO new emit).
    // Marquee changes only SELECTION (script-state), never the graph model → no history push.
    const nodeAt = (target: any) => {
      if (!target || typeof target.closest !== 'function') return null;
      return target.closest('.rozie-flow-node');
    };
    // container-relative px → GRAPH coords (the inverse area transform, like
    // screenToFlowPosition but already container-relative). px = transform + graph·k.
    const containerPxToGraph = (px: any, py: any) => {
      const t = area.current.area.transform;
      const k = t.k || 1;
      return {
        x: (px - t.x) / k,
        y: (py - t.y) / k
      };
    };
    const updateMarqueeBox = () => {
      if (!marqueeBox.current || !marqueeStart.current || !marqueeCur.current) return;
      const x = Math.min(marqueeStart.current.x, marqueeCur.current.x);
      const y = Math.min(marqueeStart.current.y, marqueeCur.current.y);
      const w = Math.abs(marqueeCur.current.x - marqueeStart.current.x);
      const h = Math.abs(marqueeCur.current.y - marqueeStart.current.y);
      marqueeBox.current.style.left = x + 'px';
      marqueeBox.current.style.top = y + 'px';
      marqueeBox.current.style.width = w + 'px';
      marqueeBox.current.style.height = h + 'px';
      marqueeBox.current.style.display = 'block';
    };
    const finishMarquee = () => {
      if (!marqueeActive.current) return;
      marqueeActive.current = false;
      if (marqueeBox.current) marqueeBox.current.style.display = 'none';
      if (!marqueeStart.current || !marqueeCur.current || !nodeSelectApi.current) {
        marqueeStart.current = null;
        marqueeCur.current = null;
        return;
      }
      // box in graph coords (two opposite corners → min/max).
      const a = containerPxToGraph(marqueeStart.current.x, marqueeStart.current.y);
      const b = containerPxToGraph(marqueeCur.current.x, marqueeCur.current.y);
      const bx0 = Math.min(a.x, b.x),
        by0 = Math.min(a.y, b.y);
      const bx1 = Math.max(a.x, b.x),
        by1 = Math.max(a.y, b.y);
      marqueeStart.current = null;
      marqueeCur.current = null;
      const graphNodes = currentGraph().nodes || [];
      let first = true;
      for (const n of graphNodes as any) {
        if (!n || n.id == null) continue;
        const view = area.current.nodeViews.get(n.id);
        const gx = view ? view.position.x : n.x || 0;
        const gy = view ? view.position.y : n.y || 0;
        const sz = measureNodeSize(n.id);
        // a node intersects the box if their rects overlap (AABB), in graph coords.
        const overlaps = gx < bx1 && gx + sz.w > bx0 && gy < by1 && gy + sz.h > by0;
        if (overlaps) {
          // accumulate=true keeps every intersector selected (first one replaces the prior
          // selection so an old pick doesn't linger; rest accumulate). select(id, accumulate).
          nodeSelectApi.current.select(n.id, !first);
          first = false;
        }
      }
      // surface @selection-change once the engine's awaited select() chain has flushed.
      scheduleSelectionEmit();
    };
    if (props.selectable && !props.readonly && container && typeof container.addEventListener === 'function') {
      marqueeBox.current = marqueeEl.current || null;
      onCanvasPointerDownCapture.current = (e: any) => {
        // only in select mode, only the EMPTY canvas (not on a node — those still drag), only
        // the primary button. A live `$props.mode` read = the persistent mode-guard (restoring
        // pan is just this check returning early; no engine mutation).
        if (_modeRef.current !== 'select') return;
        if (e && e.button != null && e.button !== 0) return;
        if (nodeAt(e.target)) return;
        // BLOCK rete's pan Drag (its bubble-phase pointerdown on the same container) — capture
        // phase runs first, so stopPropagation() here pre-empts pan; the marquee owns this drag.
        e.stopPropagation();
        e.preventDefault();
        const box = container.getBoundingClientRect();
        marqueeActive.current = true;
        marqueeStart.current = {
          x: e.clientX - box.left,
          y: e.clientY - box.top
        };
        marqueeCur.current = {
          x: marqueeStart.current.x,
          y: marqueeStart.current.y
        };
        try {
          if (container.setPointerCapture && e.pointerId != null) container.setPointerCapture(e.pointerId);
        } catch (err: any) {}
        updateMarqueeBox();
      };
      onMarqueePointerMove.current = (e: any) => {
        if (!marqueeActive.current) return;
        const box = container.getBoundingClientRect();
        marqueeCur.current = {
          x: e.clientX - box.left,
          y: e.clientY - box.top
        };
        updateMarqueeBox();
      };
      onMarqueePointerUp.current = (e: any) => {
        if (!marqueeActive.current) return;
        try {
          if (container.releasePointerCapture && e && e.pointerId != null) container.releasePointerCapture(e.pointerId);
        } catch (err: any) {}
        finishMarquee();
      };
      container.addEventListener('pointerdown', onCanvasPointerDownCapture.current, true);
      container.addEventListener('pointermove', onMarqueePointerMove.current);
      container.addEventListener('pointerup', onMarqueePointerUp.current);
    }

    // ─── initial graph: nodes first, then connections (connections reference live
    // node instances), then optional fit. Sequenced via an async IIFE so the
    // $onMount-returned teardown stays synchronous. ──────────────────────────────
    ;
    (async () => {
      // T1.3 — seed the canvas's own last-written graph from the initial bound value so the
      // first gesture's snapshot/base reflects the mounted graph (immune to prop re-bind lag).
      lastWrittenGraph.current = structuredClone(currentGraph());
      await reconcileNodes.current();
      await reconcileConnections.current();
      if (typeof _zoomRef.current === 'number' && _zoomRef.current !== 1) {
        programmatic.current++;
        try {
          await area.current.area.zoom(_zoomRef.current);
        } finally {
          programmatic.current--;
        }
      }
      if (props.fitOnMount && editor.current.getNodes().length) {
        programmatic.current++;
        try {
          await AreaExtensions.zoomAt(area.current, editor.current.getNodes());
        } finally {
          programmatic.current--;
        }
        if (area.current) {
          const k = area.current.area.transform.k;
          if (k !== _zoomRef.current) setZoom(k);
        }
      }
      // draw the minimap once the graph + fit have settled (also redrawn on every
      // render / pan / zoom / drag / selection / graph change below).
      if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
    })();
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      if (onCanvasKeydown.current && keydownContainer.current && typeof keydownContainer.current.removeEventListener === 'function') {
        try {
          keydownContainer.current.removeEventListener('keydown', onCanvasKeydown.current);
        } catch (e: any) {}
      }
      if (dragFlushRaf.current && typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(dragFlushRaf.current);
        } catch (e: any) {}
      }
      dragFlushRaf.current = 0;
      pendingDragPositions.clear();
      // T1.1: drop the edge-selection state + its cached <path> reference on teardown.
      clearEdgeSelection();
      // MiniMap teardown — remove the pointer-pan listeners + cancel a pending redraw.
      if (minimapHost.current) {
        if (onMinimapPointerDown.current) {
          try {
            minimapHost.current.removeEventListener('pointerdown', onMinimapPointerDown.current);
          } catch (e: any) {}
        }
        if (onMinimapPointerMove.current) {
          try {
            minimapHost.current.removeEventListener('pointermove', onMinimapPointerMove.current);
          } catch (e: any) {}
        }
        if (onMinimapPointerUp.current) {
          try {
            minimapHost.current.removeEventListener('pointerup', onMinimapPointerUp.current);
          } catch (e: any) {}
        }
      }
      if (minimapRedrawRaf.current && typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(minimapRedrawRaf.current);
        } catch (e: any) {}
      }
      minimapRedrawRaf.current = 0;
      // T2.8 NodeToolbar teardown — remove the default-button listeners, dispose the optional
      // `#toolbar` reactive portal handle, and cancel a pending reposition.
      if (toolbarDeleteBtn.current && onToolbarDelete.current) {
        try {
          toolbarDeleteBtn.current.removeEventListener('pointerup', onToolbarDelete.current);
        } catch (e: any) {}
      }
      if (toolbarDuplicateBtn.current && onToolbarDup.current) {
        try {
          toolbarDuplicateBtn.current.removeEventListener('pointerup', onToolbarDup.current);
        } catch (e: any) {}
      }
      if (toolbarHandle.current && toolbarHandle.current.dispose) {
        try {
          toolbarHandle.current.dispose();
        } catch (e: any) {}
      }
      toolbarHandle.current = null;
      toolbarSelectedId.current = null;
      if (toolbarTrackRaf.current && typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(toolbarTrackRaf.current);
        } catch (e: any) {}
      }
      toolbarTrackRaf.current = 0;
      // T2.4 Marquee teardown — remove the capture-phase pointerdown guard + window listeners.
      if (keydownContainer.current) {
        if (onCanvasPointerDownCapture.current) {
          try {
            keydownContainer.current.removeEventListener('pointerdown', onCanvasPointerDownCapture.current, true);
          } catch (e: any) {}
        }
        if (onMarqueePointerMove.current) {
          try {
            keydownContainer.current.removeEventListener('pointermove', onMarqueePointerMove.current);
          } catch (e: any) {}
        }
        if (onMarqueePointerUp.current) {
          try {
            keydownContainer.current.removeEventListener('pointerup', onMarqueePointerUp.current);
          } catch (e: any) {}
        }
      }
      marqueeActive.current = false;
      marqueeStart.current = null;
      marqueeCur.current = null;
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
      if (area.current) area.current.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    // T1.3 — keep the canvas's own last-written graph in sync with an EXTERNAL (non-
    // programmatic) consumer change, so undo/redo's "current" state tracks reality (our own
    // write-backs / restores set lastWrittenGraph synchronously under the programmatic guard;
    // this only refreshes it for a genuine outside edit).
    if (selfWriteInFlight.current) {
      // our own commitGraph write echoing back — lastWrittenGraph is already authoritative.
      selfWriteInFlight.current = false;
    } else if (!programmatic.current) {
      const c = structuredClone(currentGraph());
      if (c != null) lastWrittenGraph.current = c;
    }
    if (reconcileNodes.current) {
      Promise.resolve(reconcileNodes.current()).then(() => {
        if (reconcileConnections.current) reconcileConnections.current();
      });
    }
    // graph changed (nodes added/removed/moved) → refresh the minimap node rects.
    if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
  }, [graph]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (reconcileNodes.current) {
      Promise.resolve(reconcileNodes.current()).then(() => {
        if (reconcileConnections.current) reconcileConnections.current();
      });
    }
  }, [portReg]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    if (reconcileNodes.current) reconcileNodes.current();
  }, [typeReg]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = zoom;
    if (!area.current || typeof v !== 'number') return;
    if (v === area.current.area.transform.k) return;
    programmatic.current++;
    Promise.resolve(area.current.area.zoom(v)).finally(() => {
      programmatic.current--;
    });
  }, [zoom]);

  const _rozieExposeRef = useRef({ getEditor, getArea, addNode, removeNode, deleteNode, addConnection, removeConnection, clear, zoomToFit, zoomTo, setCenter, setViewport, screenToFlowPosition, getNodes, getConnections, getTransform, autoArrange, undo, redo, canUndo, canRedo, getSelectedNodes, selectNode, clearSelection, selectAll, centerOnNode });
  _rozieExposeRef.current = { getEditor, getArea, addNode, removeNode, deleteNode, addConnection, removeConnection, clear, zoomToFit, zoomTo, setCenter, setViewport, screenToFlowPosition, getNodes, getConnections, getTransform, autoArrange, undo, redo, canUndo, canRedo, getSelectedNodes, selectNode, clearSelection, selectAll, centerOnNode };
  useImperativeHandle(ref, () => ({ getEditor: (...args: Parameters<typeof getEditor>): ReturnType<typeof getEditor> => _rozieExposeRef.current.getEditor(...args), getArea: (...args: Parameters<typeof getArea>): ReturnType<typeof getArea> => _rozieExposeRef.current.getArea(...args), addNode: (...args: Parameters<typeof addNode>): ReturnType<typeof addNode> => _rozieExposeRef.current.addNode(...args), removeNode: (...args: Parameters<typeof removeNode>): ReturnType<typeof removeNode> => _rozieExposeRef.current.removeNode(...args), deleteNode: (...args: Parameters<typeof deleteNode>): ReturnType<typeof deleteNode> => _rozieExposeRef.current.deleteNode(...args), addConnection: (...args: Parameters<typeof addConnection>): ReturnType<typeof addConnection> => _rozieExposeRef.current.addConnection(...args), removeConnection: (...args: Parameters<typeof removeConnection>): ReturnType<typeof removeConnection> => _rozieExposeRef.current.removeConnection(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args), zoomToFit: (...args: Parameters<typeof zoomToFit>): ReturnType<typeof zoomToFit> => _rozieExposeRef.current.zoomToFit(...args), zoomTo: (...args: Parameters<typeof zoomTo>): ReturnType<typeof zoomTo> => _rozieExposeRef.current.zoomTo(...args), setCenter: (...args: Parameters<typeof setCenter>): ReturnType<typeof setCenter> => _rozieExposeRef.current.setCenter(...args), setViewport: (...args: Parameters<typeof setViewport>): ReturnType<typeof setViewport> => _rozieExposeRef.current.setViewport(...args), screenToFlowPosition: (...args: Parameters<typeof screenToFlowPosition>): ReturnType<typeof screenToFlowPosition> => _rozieExposeRef.current.screenToFlowPosition(...args), getNodes: (...args: Parameters<typeof getNodes>): ReturnType<typeof getNodes> => _rozieExposeRef.current.getNodes(...args), getConnections: (...args: Parameters<typeof getConnections>): ReturnType<typeof getConnections> => _rozieExposeRef.current.getConnections(...args), getTransform: (...args: Parameters<typeof getTransform>): ReturnType<typeof getTransform> => _rozieExposeRef.current.getTransform(...args), autoArrange: (...args: Parameters<typeof autoArrange>): ReturnType<typeof autoArrange> => _rozieExposeRef.current.autoArrange(...args), undo: (...args: Parameters<typeof undo>): ReturnType<typeof undo> => _rozieExposeRef.current.undo(...args), redo: (...args: Parameters<typeof redo>): ReturnType<typeof redo> => _rozieExposeRef.current.redo(...args), canUndo: (...args: Parameters<typeof canUndo>): ReturnType<typeof canUndo> => _rozieExposeRef.current.canUndo(...args), canRedo: (...args: Parameters<typeof canRedo>): ReturnType<typeof canRedo> => _rozieExposeRef.current.canRedo(...args), getSelectedNodes: (...args: Parameters<typeof getSelectedNodes>): ReturnType<typeof getSelectedNodes> => _rozieExposeRef.current.getSelectedNodes(...args), selectNode: (...args: Parameters<typeof selectNode>): ReturnType<typeof selectNode> => _rozieExposeRef.current.selectNode(...args), clearSelection: (...args: Parameters<typeof clearSelection>): ReturnType<typeof clearSelection> => _rozieExposeRef.current.clearSelection(...args), selectAll: (...args: Parameters<typeof selectAll>): ReturnType<typeof selectAll> => _rozieExposeRef.current.selectAll(...args), centerOnNode: (...args: Parameters<typeof centerOnNode>): ReturnType<typeof centerOnNode> => _rozieExposeRef.current.centerOnNode(...args) }), []);

  return (
    <__ctx_rete_canvas.Provider value={{
  // Register/replace a node TYPE template. `spec` carries an optional
  // `bodyRenderer(host, { node })` — the render-by-type projection (mounted per graph
  // node of this type into the engine body host, see renderNode). Whole-object replace.
  registerType: (type: any, spec: any) => {
    if (type != null) setTypeReg(prev => ({
      ...prev,
      [type]: spec
    }));
  },
  // Drop a type on <NodeType> unmount (whole-object replace).
  unregisterType: (type: any) => {
    const t = {
      ...typeReg
    };
    delete t[type];
    setTypeReg(t);
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
    setPortReg(prev => ({
      ...prev,
      [portKey]: {
        type,
        side,
        key,
        portType,
        label,
        multiple,
        position
      }
    }));
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
}}>
    <>
    <div className={clsx("rozie-flow-canvas", { "rozie-flow-canvas--lines": props.background === 'lines', "rozie-flow-canvas--cross": props.background === 'cross', "rozie-flow-canvas--none": props.background === 'none' })} ref={canvasEl} tabIndex={0} data-rozie-s-cd396d6a="">
      
      {!!(props.controls) && <div className={"rozie-flow-controls"} data-rozie-s-cd396d6a="">
        <button type="button" className={"rozie-flow-controls__btn"} data-testid="flow-zoom-in" aria-label="Zoom in" onClick={controlZoomIn} data-rozie-s-cd396d6a="">+</button>
        <button type="button" className={"rozie-flow-controls__btn"} data-testid="flow-zoom-out" aria-label="Zoom out" onClick={controlZoomOut} data-rozie-s-cd396d6a="">&#8722;</button>
        <button type="button" className={"rozie-flow-controls__btn"} data-testid="flow-fit" aria-label="Fit view" onClick={controlFit} data-rozie-s-cd396d6a="">&#9744;</button>
        
        {!!(props.marquee) && <button type="button" className={clsx("rozie-flow-controls__btn", { "is-active": mode === 'select' })} data-testid="flow-mode" aria-label={rozieAttr(mode === 'select' ? 'Select mode (click to pan)' : 'Pan mode (click to select)')} onClick={toggleMode} data-rozie-s-cd396d6a="">{rozieDisplay(mode === 'select' ? '▢' : '✥')}</button>}</div>}{!!(props.minimap) && <div className={"rozie-flow-minimap"} ref={minimapEl} data-testid="flow-minimap" data-rozie-s-cd396d6a="" />}<div className={"rozie-flow-marquee"} ref={marqueeEl} data-testid="flow-marquee" data-rozie-s-cd396d6a="" />
      
      {!!(props.nodeToolbar) && <div className={"rozie-flow-toolbar"} ref={toolbarEl} data-testid="flow-toolbar" data-rozie-s-cd396d6a="" />}</div>





    {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </>
    </__ctx_rete_canvas.Provider>
  );
});
export default FlowCanvas;
