import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { rozieContext, useControllableState } from '@rozie/runtime-react';
import './FlowCanvas.css';
import './FlowCanvas.global.css';
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

interface NodeCtx { node: any; selected: any; emit: any; }

interface FlowCanvasProps {
  graph?: Record<string, any>;
  defaultGraph?: Record<string, any>;
  onGraphChange?: (graph: Record<string, any>) => void;
  validateTypes?: boolean;
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (zoom: number) => void;
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
  onSelectionChange?: (...args: any[]) => void;
  onNodeAction?: (...args: any[]) => void;
  onConnectionRejected?: (...args: any[]) => void;
  onConnectionCreated?: (...args: any[]) => void;
  onConnectionRemoved?: (...args: any[]) => void;
  onNodePicked?: (...args: any[]) => void;
  onNodeMoved?: (...args: any[]) => void;
  onTranslated?: (...args: any[]) => void;
  onContextMenu?: (...args: any[]) => void;
  renderNode?: (ctx: NodeCtx) => ReactNode;
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
}

const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(function FlowCanvas(_props: FlowCanvasProps, ref): JSX.Element {
  const __ctx_rete_canvas = rozieContext("rete:canvas");
  const portalRoots = useRef<Set<Root>>(new Set());
  const props: Omit<FlowCanvasProps, 'validateTypes' | 'pannable' | 'zoomable' | 'selectable' | 'readonly' | 'minZoom' | 'maxZoom' | 'snapGrid' | 'accumulateOnCtrl' | 'curvature' | 'fitOnMount' | 'controls' | 'minimap' | 'canConnect'> & { validateTypes: boolean; pannable: boolean; zoomable: boolean; selectable: boolean; readonly: boolean; minZoom: number; maxZoom: number; snapGrid: number; accumulateOnCtrl: boolean; curvature: number; fitOnMount: boolean; controls: boolean; minimap: boolean; canConnect: ((...args: any[]) => any) | null } = {
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
    canConnect: _props.canConnect ?? null,
  };
  const _renderNodeRef = useRef(props.renderNode);
  _renderNodeRef.current = props.renderNode;
  const lastPropNodeIds = useRef<any>(null);
  const lastPropConnIds = useRef<any>(null);
  const editor = useRef<any>(null);
  const area = useRef<any>(null);
  const connectionPlugin = useRef<any>(null);
  const socketWatcher = useRef<any>(null);
  const renderScope = useRef<any>(null);
  const selector = useRef<any>(null);
  const onCanvasKeydown = useRef<any>(null);
  const keydownContainer = useRef<any>(null);
  const scheduleMinimapRedraw = useRef<any>(null);
  const programmatic = useRef(0);
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
  const dragFlushRaf = useRef(0);
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
  const _graphRef = useRef(graph);
  _graphRef.current = graph;
  const _zoomRef = useRef(zoom);
  _zoomRef.current = zoom;
  const [typeReg, setTypeReg] = useState({});
  const [portReg, setPortReg] = useState({});
  const _portRegRef = useRef(portReg);
  _portRegRef.current = portReg;
  const _typeRegRef = useRef(typeReg);
  _typeRegRef.current = typeReg;
  const canvasEl = useRef<HTMLDivElement | null>(null);
  const minimapEl = useRef<HTMLDivElement | null>(null);
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
  // Win 2: the last emitted selection id-set, joined to a stable string, so
  // @selection-change fires ONLY on an actual change (a repeated identical pick/unpick
  // set does not spam the consumer). `null` until the first emit (so the initial empty
  // selection does not emit on mount). COMPONENT-scope so it survives across area events.
  let lastSelectionIds: any = null;

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
  const pendingDragPositions = useMemo(() => new Map(), []);
  const currentGraph = useCallback(() => graph || {
    nodes: [],
    connections: []
  }, [graph]);
  function flushDragWriteBack() {
    dragFlushRaf.current = 0;
    if (programmatic.current) {
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
    setGraph({
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
    const g = currentGraph();
    const conn = {
      id: c.id,
      source: c.source,
      sourceOutput: c.sourceOutput,
      target: c.target,
      targetInput: c.targetInput
    };
    setGraph({
      ...g,
      connections: [...(g.connections || []), conn]
    });
  }, [currentGraph, setGraph]);
  const writeBackConnectionRemoved = useCallback((id: any) => {
    if (programmatic.current) return;
    const g = currentGraph();
    setGraph({
      ...g,
      connections: (g.connections || []).filter((e: any) => e && e.id !== id)
    });
  }, [currentGraph, setGraph]);
  const deleteNode = useCallback((id: any) => {
    if (id == null) return false;
    const g = currentGraph();
    const sid = String(id);
    const nodes = (g.nodes || []).filter((n: any) => n && String(n.id) !== sid);
    if (nodes.length === (g.nodes || []).length) return false;
    const connections = (g.connections || []).filter((c: any) => c && String(c.source) !== sid && String(c.target) !== sid);
    setGraph({
      ...g,
      nodes,
      connections
    });
    return true;
  }, [currentGraph, setGraph]);
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
    const key = [...ids].map((x: any) => String(x)).sort().join(' ');
    if (key === lastSelectionIds) return;
    lastSelectionIds = key;
    props.onSelectionChange && props.onSelectionChange({
      ids
    });
    // the selected set changed → repaint the minimap (selected nodes are highlighted).
    if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
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
  };
    const container = canvasEl.current;
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

    // ── selection (selectableNodes) ──
    if (props.selectable && !props.readonly) {
      selector.current = AreaExtensions.selector();
      AreaExtensions.selectableNodes(area.current, selector.current, {
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
        if (!e || e.key !== 'Delete' && e.key !== 'Backspace') return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        const ids = selectedNodeIds();
        if (ids.length === 0) return;
        e.preventDefault();
        for (const id of ids as any) deleteNode(id);
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
      if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
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
      area.current.emit({
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
      area.current.emit({
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
        area.current.emit({
          type: 'unmount',
          data: {
            element: socketEl
          }
        });
      });
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
        path.setAttribute('d', classicConnectionPath([start, end], curvature));
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
      } else if (context.type === 'nodetranslated') {
        if (!programmatic.current) {
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
          props.onNodeMoved && props.onNodeMoved({
            id,
            x: pos.x,
            y: pos.y
          });
        }
        // a node moved → its minimap rect moves (works during a programmatic translate too).
        if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
      } else if (context.type === 'translated') {
        props.onTranslated && props.onTranslated({
          x: context.data.position.x,
          y: context.data.position.y
        });
        // the viewport window moved → redraw the minimap viewport rect + mask.
        if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
      } else if (context.type === 'zoomed') {
        if (!programmatic.current) {
          const k = area.current.area.transform.k;
          if (k !== _zoomRef.current) setZoom(k);
        }
        // the viewport window resized (zoom) → redraw the minimap viewport rect + mask.
        if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
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
          dashed: spec.dashed
        };
      };
      // cheap style signature so a label/style change on an EXISTING edge re-renders it.
      const edgeStyleSig = (s: any) => s ? String(s.label) + '|' + String(s.stroke) + '|' + String(s.dashed) : '';
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
        const fill = r.selected ? '#3b82f6' : '#94a3b8';
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
      mask.setAttribute('fill', 'rgba(15, 23, 42, 0.18)');
      mask.setAttribute('d', 'M0 0 H' + MINIMAP_W + ' V' + MINIMAP_H + ' H0 Z ' + 'M' + mvx + ' ' + mvy + ' h' + mvw + ' v' + mvh + ' h' + -mvw + ' Z');
      minimapSvg.current.appendChild(mask);
      minimapSvg.current.appendChild(mkMinimapRect(mvx, mvy, mvw, mvh, 'rozie-flow-minimap__viewport', 'none', '#3b82f6', 1.5));
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

    // ─── initial graph: nodes first, then connections (connections reference live
    // node instances), then optional fit. Sequenced via an async IIFE so the
    // $onMount-returned teardown stays synchronous. ──────────────────────────────
    ;
    (async () => {
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
    if (reconcileNodes.current) {
      Promise.resolve(reconcileNodes.current()).then(() => {
        if (reconcileConnections.current) reconcileConnections.current();
      });
    }
    // graph changed (nodes added/removed/moved) → refresh the minimap node rects.
    if (scheduleMinimapRedraw.current) scheduleMinimapRedraw.current();
  }, [graph]);
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

  useImperativeHandle(ref, () => ({ getEditor, getArea, addNode, removeNode, deleteNode, addConnection, removeConnection, clear, zoomToFit, zoomTo, setCenter, setViewport, screenToFlowPosition, getNodes, getConnections, getTransform }), []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className={"rozie-flow-canvas"} ref={canvasEl} tabIndex={0} data-rozie-s-cd396d6a="">
      
      {(props.controls) && <div className={"rozie-flow-controls"} data-rozie-s-cd396d6a="">
        <button type="button" className={"rozie-flow-controls__btn"} data-testid="flow-zoom-in" aria-label="Zoom in" onClick={controlZoomIn} data-rozie-s-cd396d6a="">+</button>
        <button type="button" className={"rozie-flow-controls__btn"} data-testid="flow-zoom-out" aria-label="Zoom out" onClick={controlZoomOut} data-rozie-s-cd396d6a="">&#8722;</button>
        <button type="button" className={"rozie-flow-controls__btn"} data-testid="flow-fit" aria-label="Fit view" onClick={controlFit} data-rozie-s-cd396d6a="">&#9744;</button>
      </div>}{(props.minimap) && <div className={"rozie-flow-minimap"} ref={minimapEl} data-testid="flow-minimap" data-rozie-s-cd396d6a="" />}</div>



    {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </>
    </__ctx_rete_canvas.Provider>
  );
});
export default FlowCanvas;
