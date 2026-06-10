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
  nodes?: any[];
  connections?: any[];
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
  onNodeAction?: (...args: any[]) => void;
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
  const __defaultNodes = useState(() => (() => [])())[0];
  const __defaultConnections = useState(() => (() => [])())[0];
  const props: Omit<FlowCanvasProps, 'nodes' | 'connections' | 'pannable' | 'zoomable' | 'selectable' | 'readonly' | 'minZoom' | 'maxZoom' | 'snapGrid' | 'accumulateOnCtrl' | 'curvature' | 'fitOnMount'> & { nodes: any[]; connections: any[]; pannable: boolean; zoomable: boolean; selectable: boolean; readonly: boolean; minZoom: number; maxZoom: number; snapGrid: number; accumulateOnCtrl: boolean; curvature: number; fitOnMount: boolean } = {
    ..._props,
    nodes: _props.nodes ?? __defaultNodes,
    connections: _props.connections ?? __defaultConnections,
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
  };
  const _renderNodeRef = useRef(props.renderNode);
  _renderNodeRef.current = props.renderNode;
  const lastPropNodeIds = useRef<any>(null);
  const lastPropConnIds = useRef<any>(null);
  const lastRegistryNodeIds = useRef<any>(null);
  const lastRegistryConnIds = useRef<any>(null);
  const editor = useRef<any>(null);
  const area = useRef<any>(null);
  const connectionPlugin = useRef<any>(null);
  const socketWatcher = useRef<any>(null);
  const renderScope = useRef<any>(null);
  const selector = useRef<any>(null);
  const programmatic = useRef(0);
  const reconcileNodes = useRef<any>(null);
  const reconcileConnections = useRef<any>(null);
  const [zoom, setZoom] = useControllableState({
    value: props.zoom,
    defaultValue: props.defaultZoom ?? 1,
    onValueChange: props.onZoomChange,
  });
  const _connectionsRef = useRef(props.connections);
  _connectionsRef.current = props.connections;
  const _nodesRef = useRef(props.nodes);
  _nodesRef.current = props.nodes;
  const _zoomRef = useRef(zoom);
  _zoomRef.current = zoom;
  const [nodeReg, setNodeReg] = useState({});
  const [connReg, setConnReg] = useState({});
  const [portReg, setPortReg] = useState({});
  const _connRegRef = useRef(connReg);
  _connRegRef.current = connReg;
  const _nodeRegRef = useRef(nodeReg);
  _nodeRegRef.current = nodeReg;
  const _portRegRef = useRef(portReg);
  _portRegRef.current = portReg;
  const canvasEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);

  const SOCKET = useMemo(() => new ClassicPreset.Socket('flow'), []);
  const nodeInstances = useMemo(() => new Map(), []);
  const nodeMeta = useMemo(() => new Map(), []);
  const connInstances = useMemo(() => new Map(), []);
  const nodeEntries = useMemo(() => new Map(), []);
  const connEntries = useMemo(() => new Map(), []);
  const serializeConn = useCallback((c: any) => ({
    id: c.id,
    source: c.source,
    sourceOutput: c.sourceOutput,
    target: c.target,
    targetInput: c.targetInput
  }), []);
  const buildNode = useCallback((spec: any) => {
    const node = new ClassicPreset.Node(spec.label != null ? String(spec.label) : '');
    node.id = spec.id;
    const inputs = Array.isArray(spec.inputs) ? spec.inputs : [];
    const outputs = Array.isArray(spec.outputs) ? spec.outputs : [];
    for (const inp of inputs as any) {
      if (!inp || inp.key == null) continue;
      node.addInput(inp.key, new ClassicPreset.Input(SOCKET, inp.label, inp.multiple === true));
    }
    for (const out of outputs as any) {
      if (!out || out.key == null) continue;
      node.addOutput(out.key, new ClassicPreset.Output(SOCKET, out.label, out.multiple !== false));
    }
    return node;
  }, []);
  const mergePortsIntoSpec = useCallback((spec: any, portMap: any) => {
    if (!spec || !portMap) return spec;
    const inputs = Array.isArray(spec.inputs) ? spec.inputs.slice() : [];
    const outputs = Array.isArray(spec.outputs) ? spec.outputs.slice() : [];
    let changed = false;
    for (const k in portMap) {
      const p = portMap[k];
      if (!p || p.key == null || p.nodeId !== spec.id) continue;
      if (p.side === 'input') {
        if (inputs.some((q: any) => q && q.key === p.key)) continue;
        inputs.push({
          key: p.key,
          label: p.label,
          multiple: p.multiple
        });
        changed = true;
      } else {
        if (outputs.some((q: any) => q && q.key === p.key)) continue;
        outputs.push({
          key: p.key,
          label: p.label,
          multiple: p.multiple
        });
        changed = true;
      }
    }
    return changed ? {
      ...spec,
      inputs,
      outputs
    } : spec;
  }, []);
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
    const node = buildNode(spec);
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
    lastRegistryNodeIds.current = [];
    lastRegistryConnIds.current = [];
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
        if (data.type === 'node') renderNode(data.element, data.payload);else if (data.type === 'connection') renderConnection(data.element, data.payload);
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
        label: reteNode.label
      };
      const existing = nodeEntries.get(id);
      const selected = reteNode.selected === true;
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
          existing.titleEl.textContent = meta.label != null ? String(meta.label) : '';
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
        titleEl: null,
        bodyMoved: false,
        emit,
        socketDisposers
      };
      if (typeof meta.renderBody === 'function') {
        // D-04 render-callback path (declarative <FlowNode> child). The child cannot
        // relocate its OWN <slot> across the Lit shadow boundary (Wave-0 A3), so the
        // PARENT projects the body here from its own render scope: the child's
        // registered renderBody(host) appends the child's host element (its $el,
        // shadow root + slot projection intact) into the engine `body` div. nodeEntries
        // must exist before the callback runs (bodyHostFor reads it), so register first.
        nodeEntries.set(id, entry);
        meta.renderBody(body);
        entry.bodyMoved = true;
        return;
      }
      if ((props.renderNode ?? props.slots?.["node"])) {
        // reactive multi-instance portal — one handle per node, re-rendered in
        // place on meta change (the MapLibre marker discipline).
        entry.handle = portals.node(body, {
          node: meta,
          selected,
          emit
        });
      } else {
        // default chrome: a title bar.
        const title = document.createElement('div');
        title.className = 'rozie-flow-node__title';
        title.textContent = meta.label != null ? String(meta.label) : '';
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
    // Mounts an <svg><path> and redraws it whenever either endpoint socket moves.
    const renderConnection = (element: any, connection: any) => {
      const id = connection.id;
      if (connEntries.has(id) && connEntries.get(id).element === element) return;
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
      const un1 = socketWatcher.current.listen(connection.source, 'output', connection.sourceOutput, (p: any) => {
        start = p;
        redraw();
      });
      const un2 = socketWatcher.current.listen(connection.target, 'input', connection.targetInput, (p: any) => {
        end = p;
        redraw();
      });
      connEntries.set(id, {
        element,
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

    // ─── forward engine events (echo-guarded via `programmatic`) ───────────────
    editor.current.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'connectioncreated') {
        // keep engine truth in sync so reconcile diffs correctly — a user-drawn
        // connection (auto id) must register here or the next props pass re-adds it.
        connInstances.set(context.data.id, context.data);
        if (!programmatic.current) props.onConnectionCreated && props.onConnectionCreated(serializeConn(context.data));
      } else if (context.type === 'connectionremoved') {
        connInstances.delete(context.data.id);
        if (!programmatic.current) props.onConnectionRemoved && props.onConnectionRemoved({
          id: context.data.id
        });
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

    // Union the config-array prop with the declarative-children registry by id
    // (D-02 last-writer-wins: the registry — children — overrides the config-array
    // on id collision; array entries first in array order, then registry entries in
    // registration order). The empty-registry path returns exactly the config array
    // (dedup-by-id of an array with no registry overrides is the array itself), so
    // (∅ ∪ props) === props in behavior — the dist-parity zero-drift guarantee.
    // Returns the merged list AND the set of ids contributed by the registry, so the
    // reaper can track prop-managed vs registry-managed provenance SEPARATELY.
    const mergeById = (arr: any, reg: any) => {
      const out = [];
      const idx = new Map();
      const regIds = [];
      for (const e of (Array.isArray(arr) ? arr : []) as any) {
        if (!e || e.id == null) continue;
        if (idx.has(e.id)) {
          out[idx.get(e.id)] = e;
        } else {
          idx.set(e.id, out.length);
          out.push(e);
        }
      }
      for (const id in reg) {
        const e = reg[id];
        if (!e || e.id == null) continue;
        regIds.push(e.id);
        if (idx.has(e.id)) {
          out[idx.get(e.id)] = e;
        } else {
          idx.set(e.id, out.length);
          out.push(e);
        }
      }
      return {
        merged: out,
        regIds
      };
    };

    // ─── reconcilers off (registry ∪ props), bridged to the top-level $watch ──────
    // The reconcilers read BOTH sources internally (config-array $props + the
    // declarative-children registry) so a single function serves the node/connection
    // $watch AND the registry $watch. Provenance is split: prop-contributed ids land
    // in lastPropNodeIds, registry-contributed ids in lastRegistryNodeIds — the
    // reaper removes a dropped id only if it was previously managed by EITHER source;
    // an imperative $expose addNode (in NEITHER set) survives (D37-08).
    reconcileNodes.current = async () => {
      if (!editor.current || !area.current) return;
      const propArr = Array.isArray(_nodesRef.current) ? _nodesRef.current : [];
      const {
        merged,
        regIds
      } = mergeById(propArr, _nodeRegRef.current);
      const regWant = new Set(regIds);
      const propWant = [];
      const want = [];
      programmatic.current++;
      try {
        for (const rawSpec of merged as any) {
          if (!rawSpec || rawSpec.id == null) continue;
          // Merge the declarative <Handle> ports (portReg) into this node's spec on
          // EVERY run — order-independent: whether the node or its ports registered
          // last, the reconcile triggered by either sees both (D37 mount-order fix).
          const spec = mergePortsIntoSpec(rawSpec, _portRegRef.current);
          want.push(spec.id);
          if (!regWant.has(spec.id)) propWant.push(spec.id);
          nodeMeta.set(spec.id, spec);
          let node = nodeInstances.get(spec.id);
          if (!node) {
            node = buildNode(spec);
            nodeInstances.set(spec.id, node);
            await editor.current.addNode(node);
            await area.current.translate(spec.id, {
              x: spec.x || 0,
              y: spec.y || 0
            });
          } else {
            // Sync any ports the spec gained AFTER the node was first built — a
            // nested <Handle>'s addPort can land after reconcileNodes already created
            // the node (the node registered before its ports on some targets).
            // buildNode only runs for NEW nodes, so add the missing inputs/outputs
            // onto the live instance here, then re-render.
            let portsAdded = false;
            const wantIn = Array.isArray(spec.inputs) ? spec.inputs : [];
            const wantOut = Array.isArray(spec.outputs) ? spec.outputs : [];
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
              // D-04 body host is re-projected by renderBody (appendChild re-moves the
              // same host element — idempotent).
              const entry = nodeEntries.get(spec.id);
              if (entry) {
                if (entry.handle) entry.handle.dispose();
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
        // remove dropped PROP-managed OR REGISTRY-managed nodes (+ their connections)
        // — imperatively added nodes (in NEITHER provenance set) survive.
        const tracked = new Set([...lastPropNodeIds.current, ...lastRegistryNodeIds.current]);
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
        lastPropNodeIds.current = propWant;
        lastRegistryNodeIds.current = regIds;
      } finally {
        programmatic.current--;
      }
    };
    reconcileConnections.current = async () => {
      if (!editor.current) return;
      const propArr = Array.isArray(_connectionsRef.current) ? _connectionsRef.current : [];
      // Normalize both sources to the same id-defaulting before the union so a
      // collision between a config-array edge and a <Connection> child dedups
      // correctly (the registry entry wins, D-02).
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
      const normProps = propArr.map(norm).filter(Boolean);
      const normReg = {};
      for (const k in _connRegRef.current) {
        const n = norm(_connRegRef.current[k]);
        if (n) normReg[k] = n;
      }
      const {
        merged,
        regIds
      } = mergeById(normProps, normReg);
      const regWant = new Set(regIds);
      const propWant = [];
      const want = [];
      programmatic.current++;
      try {
        for (const spec of merged as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          if (!regWant.has(spec.id)) propWant.push(spec.id);
          if (connInstances.has(spec.id)) continue;
          const sourceNode = nodeInstances.get(spec.source);
          const targetNode = nodeInstances.get(spec.target);
          if (!sourceNode || !targetNode) continue;
          // DEFENSIVE: the referenced output/input ports must exist on the live node
          // instances before addConnection (Rete throws "source node doesn't have
          // output with a key out" otherwise, aborting the loop). A declarative
          // <Connection> may register before the nested <Handle>s have flushed their
          // ports into the node (child-before-parent mount order); skip until the
          // ports exist — reconcileNodes re-runs reconcileConnections after a node-
          // registry change (incl. a Handle addPort), so the edge lands on a later tick.
          if (!sourceNode.outputs || !sourceNode.outputs[spec.sourceOutput]) continue;
          if (!targetNode.inputs || !targetNode.inputs[spec.targetInput]) continue;
          const conn = new ClassicPreset.Connection(sourceNode, spec.sourceOutput, targetNode, spec.targetInput);
          conn.id = spec.id;
          connInstances.set(spec.id, conn);
          await editor.current.addConnection(conn);
        }
        const tracked = new Set([...lastPropConnIds.current, ...lastRegistryConnIds.current]);
        for (const id of tracked as any) {
          if (!want.includes(id) && connInstances.has(id)) {
            await editor.current.removeConnection(id);
            connInstances.delete(id);
          }
        }
        lastPropConnIds.current = propWant;
        lastRegistryConnIds.current = regIds;
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
      for (const [, entry] of nodeEntries as any) {
        if (entry.handle) entry.handle.dispose();
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
    if (reconcileNodes.current) reconcileNodes.current();
  }, [props.nodes]);
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (reconcileConnections.current) reconcileConnections.current();
  }, [props.connections]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    if (reconcileNodes.current) {
      Promise.resolve(reconcileNodes.current()).then(() => {
        if (reconcileConnections.current) reconcileConnections.current();
      });
    }
  }, [nodeReg]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    if (reconcileConnections.current) reconcileConnections.current();
  }, [connReg]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    if (reconcileNodes.current) {
      Promise.resolve(reconcileNodes.current()).then(() => {
        if (reconcileConnections.current) reconcileConnections.current();
      });
    }
  }, [portReg]);
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
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
  register: (id: any, spec: any) => {
    setNodeReg(prev => ({
      ...prev,
      [id]: spec
    }));
  },
  update: (id: any, spec: any) => {
    setNodeReg(prev => ({
      ...prev,
      [id]: spec
    }));
  },
  unregister: (id: any) => {
    const n = {
      ...nodeReg
    };
    delete n[id];
    setNodeReg(n);
  },
  registerConnection: (id: any, spec: any) => {
    setConnReg(prev => ({
      ...prev,
      [id]: spec
    }));
  },
  unregisterConnection: (id: any) => {
    const c = {
      ...connReg
    };
    delete c[id];
    setConnReg(c);
  },
  // A <Handle> registers a port against THIS node's id+side. Mutate the registered
  // node spec's inputs/outputs (whole-object replacement of the node entry) so the
  // node $watch refires and reconcileNodes re-runs buildNode with the new port set.
  // A <Handle> registers a port against its node's id+side. We store it in the flat
  // portReg under a UNIQUE per-port key so registration is order-independent AND
  // concurrency-safe: two <Handle>s of the same node addPort in one React commit,
  // and a pure `{ ...portReg, [uniqueKey]: port }` write (functional setState) merges
  // both (an array read-modify-write under one nodeId key would clobber). reconcile
  // Nodes merges the node's portReg entries into its spec on every run regardless of
  // mount order. The unique key also makes a re-fired addPort (late Lit context)
  // idempotent — it overwrites the same key with the same value.
  addPort: (id: any, side: any, key: any, label: any, multiple: any) => {
    if (id == null || key == null) return;
    const portKey = id + '::' + side + '::' + key;
    setPortReg(prev => ({
      ...prev,
      [portKey]: {
        nodeId: id,
        side,
        key,
        label,
        multiple
      }
    }));
  },
  // D-04 render-callback target. Returns the engine-created body host div for a
  // registry node (FlowCanvas.rozie nodeEntries.get(id).body). A <FlowNode>'s
  // registered spec carries a renderBody(host) callback that the PARENT invokes
  // from its own render scope (see renderNode) — the Wave-0 A3 finding: a Lit
  // <FlowNode> cannot relocate its own shadow <slot> across the boundary, so the
  // body is projected by the parent reusing the $portals.node host discipline.
  bodyHostFor: (id: any) => {
    const entry = nodeEntries.get(id);
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
