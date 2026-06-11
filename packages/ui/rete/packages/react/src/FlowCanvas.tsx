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
  canConnect?: ((...args: any[]) => any) | null;
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
  addConnection: (...args: any[]) => any;
  removeConnection: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  zoomToFit: (...args: any[]) => any;
  zoomTo: (...args: any[]) => any;
  getNodes: (...args: any[]) => any;
  getConnections: (...args: any[]) => any;
  getTransform: (...args: any[]) => any;
}

const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(function FlowCanvas(_props: FlowCanvasProps, ref): JSX.Element {
  const __ctx_rete_canvas = rozieContext("rete:canvas");
  const portalRoots = useRef<Set<Root>>(new Set());
  const props: Omit<FlowCanvasProps, 'validateTypes' | 'pannable' | 'zoomable' | 'selectable' | 'readonly' | 'minZoom' | 'maxZoom' | 'snapGrid' | 'accumulateOnCtrl' | 'curvature' | 'fitOnMount' | 'canConnect'> & { validateTypes: boolean; pannable: boolean; zoomable: boolean; selectable: boolean; readonly: boolean; minZoom: number; maxZoom: number; snapGrid: number; accumulateOnCtrl: boolean; curvature: number; fitOnMount: boolean; canConnect: ((...args: any[]) => any) | null } = {
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
  const programmatic = useRef(0);
  const reconcileConnections = useRef<any>(null);
  const reconcileNodes = useRef<any>(null);
  const reconcileNodesRunning = useRef(false);
  const reconcileNodesPending = useRef(false);
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
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);

  const SOCKET = useMemo(() => new ClassicPreset.Socket('flow'), []);
  const nodeInstances = useMemo(() => new Map(), []);
  const nodeMeta = useMemo(() => new Map(), []);
  const connInstances = useMemo(() => new Map(), []);
  const nodeEntries = useMemo(() => new Map(), []);
  const connEntries = useMemo(() => new Map(), []);
  const pendingDragPositions = useMemo(() => new Map(), []);
  function currentGraph() {
    return graph || {
      nodes: [],
      connections: []
    };
  }
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
  const portTypeOf = useCallback((nodeId: any, side: any, key: any) => {
    const meta = nodeMeta.get(nodeId);
    if (!meta || meta.type == null || key == null) return null;
    const entry = portReg[meta.type + '::' + side + '::' + key];
    return entry ? entry.portType : null;
  }, [portReg]);
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
    // DOM-based socket position watcher — feeds connection-path redraw + the
    // ConnectionPlugin's drag-to-connect hit-testing.
    socketWatcher.current = getDOMSocketPosition();
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
      const inputsCol = document.createElement('div');
      inputsCol.className = 'rozie-flow-node__col rozie-flow-node__col--in';
      const body = document.createElement('div');
      body.className = 'rozie-flow-node__body';
      const outputsCol = document.createElement('div');
      outputsCol.className = 'rozie-flow-node__col rozie-flow-node__col--out';
      box.appendChild(inputsCol);
      box.appendChild(body);
      box.appendChild(outputsCol);
      element.appendChild(box);
      const socketDisposers = [];
      buildSocketRow(inputsCol, reteNode, 'input', socketDisposers);
      buildSocketRow(outputsCol, reteNode, 'output', socketDisposers);

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

    // Render one column of sockets and, crucially, EMIT a socket render signal per
    // socket so the ConnectionPlugin + position watcher register it.
    const buildSocketRow = (col: any, reteNode: any, side: any, socketDisposers: any) => {
      const ports = side === 'input' ? reteNode.inputs : reteNode.outputs;
      for (const key of Object.keys(ports) as any) {
        const port = ports[key];
        if (!port) continue;
        const row = document.createElement('div');
        row.className = 'rozie-flow-port rozie-flow-port--' + side;
        const socketEl = document.createElement('div');
        socketEl.className = 'rozie-flow-socket rozie-flow-socket--' + side;
        socketEl.setAttribute('data-testid', 'socket');
        const label = document.createElement('span');
        label.className = 'rozie-flow-port__label';
        label.textContent = port.label != null ? String(port.label) : key;
        if (side === 'input') {
          row.appendChild(socketEl);
          row.appendChild(label);
        } else {
          row.appendChild(label);
          row.appendChild(socketEl);
        }
        col.appendChild(row);

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
        // ALSO LOAD-BEARING (the socket-position contract): getDOMSocketPosition
        // measures + stores a socket's DOM position ONLY on a 'rendered' socket signal
        // — that is the render-plugin lifecycle's post-mount phase (an official render
        // plugin emits 'rendered' after the framework commits the socket element). Our
        // vanilla pipe creates the socket DOM synchronously and has already appended it
        // under the engine node-view element by this point, so we fire 'rendered' right
        // after 'render'. WITHOUT IT the position store stays permanently empty, every
        // socketWatcher.listen() callback reads back null, and NO connection path —
        // committed OR the drag-to-connect preview — is ever drawn (redraw()'s
        // `if (!start || !end) return` guard never passes).
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
      }
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
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'rozie-flow-connection__path');
      svg.appendChild(path);
      element.appendChild(svg);
      let start: any = null;
      let end: any = null;
      const curvature = typeof props.curvature === 'number' ? props.curvature : 0.3;
      const redraw = () => {
        if (!start || !end) return;
        path.setAttribute('d', classicConnectionPath([start, end], curvature));
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
      } else if (context.type === 'translated') {
        props.onTranslated && props.onTranslated({
          x: context.data.position.x,
          y: context.data.position.y
        });
      } else if (context.type === 'zoomed') {
        if (!programmatic.current) {
          const k = area.current.area.transform.k;
          if (k !== _zoomRef.current) setZoom(k);
        }
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
        return {
          id,
          source: spec.source,
          sourceOutput: srcOut,
          target: spec.target,
          targetInput: tgtIn
        };
      };
      const merged = graphConns.map(norm).filter(Boolean);
      const want = [];
      programmatic.current++;
      try {
        for (const spec of merged as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          if (connInstances.has(spec.id)) continue;
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
          await editor.current.addConnection(conn);
        }
        // remove dropped GRAPH-managed edges — imperatively added edges survive.
        const tracked = new Set(lastPropConnIds.current);
        for (const id of tracked as any) {
          if (!want.includes(id) && connInstances.has(id)) {
            await editor.current.removeConnection(id);
            connInstances.delete(id);
          }
        }
        lastPropConnIds.current = want;
      } finally {
        programmatic.current--;
      }
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
    })();
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      if (dragFlushRaf.current && typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(dragFlushRaf.current);
        } catch (e: any) {}
      }
      dragFlushRaf.current = 0;
      pendingDragPositions.clear();
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

  useImperativeHandle(ref, () => ({ getEditor, getArea, addNode, removeNode, addConnection, removeConnection, clear, zoomToFit, zoomTo, getNodes, getConnections, getTransform }), []); // eslint-disable-line react-hooks/exhaustive-deps

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
  // `side` is derived by <Port> from which of out=/in= is set (out⇒'output', in⇒'input');
  // `portType` carries the port type that drives validate-types + the typed-port color.
  addTypePort: (type: any, side: any, key: any, portType: any, label: any, multiple: any) => {
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
        multiple
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
    <div className={"rozie-flow-canvas"} ref={canvasEl} data-rozie-s-cd396d6a="" />



    {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </>
    </__ctx_rete_canvas.Provider>
  );
});
export default FlowCanvas;
