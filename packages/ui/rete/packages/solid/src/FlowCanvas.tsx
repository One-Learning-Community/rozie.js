import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
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

__rozieInjectStyle('FlowCanvas-cd396d6a', `.rozie-flow-canvas[data-rozie-s-cd396d6a] {
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
.rozie-flow-canvas .rozie-flow-connection { position: absolute; }
.rozie-flow-canvas .rozie-flow-connection__svg {
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
  }`);

interface NodeSlotCtx { node: any; selected: any; emit: any; }

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
  onNodeAction?: (...args: unknown[]) => void;
  onConnectionCreated?: (...args: unknown[]) => void;
  onConnectionRemoved?: (...args: unknown[]) => void;
  onNodePicked?: (...args: unknown[]) => void;
  onNodeMoved?: (...args: unknown[]) => void;
  onTranslated?: (...args: unknown[]) => void;
  onContextMenu?: (...args: unknown[]) => void;
  nodeSlot?: (ctx: () => NodeSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: FlowCanvasHandle) => void;
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

export default function FlowCanvas(_props: FlowCanvasProps): JSX.Element {
  const _merged = mergeProps({ nodes: (() => [])(), connections: (() => [])(), pannable: true, zoomable: true, selectable: true, readonly: false, minZoom: 0.1, maxZoom: 4, snapGrid: 0, accumulateOnCtrl: true, curvature: 0.3, fitOnMount: true }, _props);
  const [local, attrs] = splitProps(_merged, ['nodes', 'connections', 'zoom', 'pannable', 'zoomable', 'selectable', 'readonly', 'minZoom', 'maxZoom', 'snapGrid', 'accumulateOnCtrl', 'curvature', 'fitOnMount', 'ref']);
  onMount(() => { local.ref?.({ getEditor, getArea, addNode, removeNode, addConnection, removeConnection, clear, zoomToFit, zoomTo, getNodes, getConnections, getTransform }); });

  const [zoom, setZoom] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'zoom', 1);
  interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portalDisposers = new Set<() => void>();
  const portals = {
    node: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
      const slot = _props.nodeSlot ?? _props.slots?.['node'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-node', 'cd396d6a');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { node: unknown; selected: unknown; emit: unknown })), container);
      portalDisposers.add(dispose);
      return {
        update: (s: unknown): void => {
          setScopeSig(s);
        },
        dispose: (): void => {
          dispose();
          portalDisposers.delete(dispose);
        },
      };
    },
  };
  onCleanup(() => {
    for (const dispose of portalDisposers) dispose();
    portalDisposers.clear();
  });
  onMount(() => {
    const _cleanup = (() => {
    const container = canvasElRef;
    lastPropNodeIds = [];
    lastPropConnIds = [];
    editor = new NodeEditor();
    area = new AreaPlugin(container);
    connectionPlugin = new ConnectionPlugin();
    connectionPlugin.addPreset(ConnectionPresets.classic.setup());
    // DOM-based socket position watcher — feeds connection-path redraw + the
    // ConnectionPlugin's drag-to-connect hit-testing.
    socketWatcher = getDOMSocketPosition();
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
    if (local.selectable && !local.readonly) {
      selector = AreaExtensions.selector();
      AreaExtensions.selectableNodes(area, selector, {
        accumulating: local.accumulateOnCtrl ? AreaExtensions.accumulateOnCtrl() : {
          active: () => false
        }
      });
    }
    // raise the picked node above its siblings.
    AreaExtensions.simpleNodesOrder(area);

    // ── zoom clamp (restrictor) ──
    const min = typeof local.minZoom === 'number' && local.minZoom > 0 ? local.minZoom : 0;
    const max = typeof local.maxZoom === 'number' && local.maxZoom > 0 ? local.maxZoom : 0;
    if (min || max) {
      AreaExtensions.restrictor(area, {
        scaling: {
          min: min || 0.01,
          max: max || 100
        }
      });
    }

    // ── snap-to-grid ──
    if (typeof local.snapGrid === 'number' && local.snapGrid > 0) {
      AreaExtensions.snapGrid(area, {
        size: local.snapGrid,
        dynamic: true
      });
    }

    // ── interaction toggles ──
    if (!local.pannable) area.area.setDragHandler(null);
    if (!local.zoomable) area.area.setZoomHandler(null);

    // ─────────────────────────────────────────────────────────────────────────
    // THE VANILLA RENDER PIPE. Intercepts the AreaPlugin's render/unmount signals.
    // ALWAYS returns context (returning undefined would halt the signal chain and
    // break the ConnectionPlugin / socket watcher downstream).
    // ─────────────────────────────────────────────────────────────────────────
    area.addPipe((context: any) => {
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
      const emit = (name: any, detail: any) => _props.onNodeAction?.({
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
        emit,
        socketDisposers
      };
      if ((_props.nodeSlot ?? _props.slots?.["node"])) {
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
        socketDisposers.push(() => {
          area.emit({
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
      const curvature = typeof local.curvature === 'number' ? local.curvature : 0.3;
      const redraw = () => {
        if (!start || !end) return;
        path.setAttribute('d', classicConnectionPath([start, end], curvature));
      };
      const un1 = socketWatcher.listen(connection.source, 'output', connection.sourceOutput, (p: any) => {
        start = p;
        redraw();
      });
      const un2 = socketWatcher.listen(connection.target, 'input', connection.targetInput, (p: any) => {
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
    editor.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'connectioncreated') {
        // keep engine truth in sync so reconcile diffs correctly — a user-drawn
        // connection (auto id) must register here or the next props pass re-adds it.
        connInstances.set(context.data.id, context.data);
        if (!programmatic) _props.onConnectionCreated?.(serializeConn(context.data));
      } else if (context.type === 'connectionremoved') {
        connInstances.delete(context.data.id);
        if (!programmatic) _props.onConnectionRemoved?.({
          id: context.data.id
        });
      }
      return context;
    });
    area.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'nodepicked') {
        _props.onNodePicked?.({
          id: context.data.id
        });
      } else if (context.type === 'nodetranslated') {
        if (!programmatic) {
          const id = context.data.id;
          const pos = context.data.position;
          const meta = nodeMeta.get(id);
          if (meta) {
            meta.x = pos.x;
            meta.y = pos.y;
          }
          _props.onNodeMoved?.({
            id,
            x: pos.x,
            y: pos.y
          });
        }
      } else if (context.type === 'translated') {
        _props.onTranslated?.({
          x: context.data.position.x,
          y: context.data.position.y
        });
      } else if (context.type === 'zoomed') {
        if (!programmatic) {
          const k = area.area.transform.k;
          if (k !== zoom()) setZoom(k);
        }
      } else if (context.type === 'contextmenu') {
        // suppress the native browser menu over the canvas; surface a hook instead.
        context.data.event.preventDefault();
        const ctx = context.data.context;
        _props.onContextMenu?.({
          id: ctx && ctx.id ? ctx.id : null
        });
      }
      return context;
    });

    // ─── prop reconcilers (bridged to the top-level $watch) ────────────────────
    reconcileNodes = async (list: any) => {
      if (!editor || !area) return;
      const arr = Array.isArray(list) ? list : [];
      const want = [];
      programmatic++;
      try {
        for (const spec of arr as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          nodeMeta.set(spec.id, spec);
          let node = nodeInstances.get(spec.id);
          if (!node) {
            node = buildNode(spec);
            nodeInstances.set(spec.id, node);
            await editor.addNode(node);
            await area.translate(spec.id, {
              x: spec.x || 0,
              y: spec.y || 0
            });
          } else {
            const view = area.nodeViews.get(spec.id);
            if (view && spec.x != null && spec.y != null && (view.position.x !== spec.x || view.position.y !== spec.y)) {
              await area.translate(spec.id, {
                x: spec.x,
                y: spec.y
              });
            }
            await area.update('node', spec.id);
          }
        }
        // remove dropped PROP-managed nodes (+ their connections) — imperatively
        // added nodes (never in lastPropNodeIds) survive.
        for (const id of lastPropNodeIds as any) {
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
    reconcileConnections = async (list: any) => {
      if (!editor) return;
      const arr = Array.isArray(list) ? list : [];
      const want = [];
      programmatic++;
      try {
        for (const spec of arr as any) {
          if (!spec || spec.source == null || spec.target == null) continue;
          const srcOut = spec.sourceOutput != null ? spec.sourceOutput : 'out';
          const tgtIn = spec.targetInput != null ? spec.targetInput : 'in';
          const id = spec.id != null ? spec.id : `${spec.source}:${srcOut}->${spec.target}:${tgtIn}`;
          want.push(id);
          if (connInstances.has(id)) continue;
          const sourceNode = nodeInstances.get(spec.source);
          const targetNode = nodeInstances.get(spec.target);
          if (!sourceNode || !targetNode) continue;
          const conn = new ClassicPreset.Connection(sourceNode, srcOut, targetNode, tgtIn);
          conn.id = id;
          connInstances.set(id, conn);
          await editor.addConnection(conn);
        }
        for (const id of lastPropConnIds as any) {
          if (!want.includes(id) && connInstances.has(id)) {
            await editor.removeConnection(id);
            connInstances.delete(id);
          }
        }
        lastPropConnIds = want;
      } finally {
        programmatic--;
      }
    }

    // ─── initial graph: nodes first, then connections (connections reference live
    // node instances), then optional fit. Sequenced via an async IIFE so the
    // $onMount-returned teardown stays synchronous. ──────────────────────────────
  ;
    (async () => {
      await reconcileNodes(local.nodes);
      await reconcileConnections(local.connections);
      if (typeof zoom() === 'number' && zoom() !== 1) {
        programmatic++;
        try {
          await area.area.zoom(zoom());
        } finally {
          programmatic--;
        }
      }
      if (local.fitOnMount && editor.getNodes().length) {
        programmatic++;
        try {
          await AreaExtensions.zoomAt(area, editor.getNodes());
        } finally {
          programmatic--;
        }
        if (area) {
          const k = area.area.transform.k;
          if (k !== zoom()) setZoom(k);
        }
      }
    })();
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
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
    if (area) area.destroy();
  });
  });
  createEffect(on(() => (() => local.nodes)(), (v) => untrack(() => ((v: any) => {
    if (reconcileNodes) reconcileNodes(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.connections)(), (v) => untrack(() => ((v: any) => {
    if (reconcileConnections) reconcileConnections(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => zoom())(), (v) => untrack(() => ((v: any) => {
    if (!area || typeof v !== 'number') return;
    if (v === area.area.transform.k) return;
    programmatic++;
    Promise.resolve(area.area.zoom(v)).finally(() => {
      programmatic--;
    });
  })(v)), { defer: true }));
  let canvasElRef: HTMLElement | null = null;

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
  const nodeInstances = new Map();
  const nodeMeta = new Map();
  const connInstances = new Map();
  const nodeEntries = new Map();
  const connEntries = new Map();

  // ids last applied FROM PROPS, so reconcile removes only prop-managed entities —
  // an imperative $expose addNode/addConnection is NOT auto-reaped on the next
  // props change (the power-user escape hatch stays alive). MapLibre reconciles
  // every marker because markers are purely prop-driven; a flow editor also accepts
  // imperative edits, so it tracks provenance.
  let lastPropNodeIds: any = null;
  let lastPropConnIds: any = null;

  // Re-entrant suppression counter: while > 0 the editor/area event handlers skip
  // echoing back into $emit / $model (our own programmatic add/remove/translate/
  // zoom must not bounce out as if the user did it — the MapLibre PROGRAMMATIC
  // eventData guard, in counter form so batched/nested ops never race).
  let programmatic = 0;

  // The $portals/$emit-capturing reconcilers are built INSIDE $onMount ($portals
  // referenced at top level fails the bundled-leaf strict typecheck — the CM/
  // TipTap/MapLibre portal discipline) and bridged here so the top-level $watch can
  // call them.
  let reconcileNodes: any = null;
  let reconcileConnections: any = null;

  // ── pure helpers (no sigils → safe at top level) ──
  function serializeConn(c: any) {
    return {
      id: c.id,
      source: c.source,
      sourceOutput: c.sourceOutput,
      target: c.target,
      targetInput: c.targetInput
    };
  }

  // Build a live Rete node from a consumer spec. The consumer's `id` is assigned
  // onto the node so positions, portal keys, and connection source/target ids all
  // align with the author's identifiers (Rete would otherwise auto-generate ids).
  function buildNode(spec: any) {
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
  }
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
    return editor;
  }
  function getArea() {
    return area;
  }
  async function addNode(spec: any) {
    if (!editor || !spec || spec.id == null) return null;
    const node = buildNode(spec);
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
  async function removeNode(id: any) {
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
  async function addConnection(spec: any) {
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
  async function removeConnection(id: any) {
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
  async function clear() {
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
    lastPropNodeIds = [];
    lastPropConnIds = [];
  }
  async function zoomToFit() {
    if (!area || !editor) return;
    programmatic++;
    try {
      await AreaExtensions.zoomAt(area, editor.getNodes());
    } finally {
      programmatic--;
    }
    const k = area.area.transform.k;
    if (k !== zoom()) setZoom(k);
  }
  async function zoomTo(k: any) {
    if (!area || typeof k !== 'number') return;
    programmatic++;
    try {
      await area.area.zoom(k);
    } finally {
      programmatic--;
    }
    if (k !== zoom()) setZoom(k);
  }
  function getNodes() {
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
  function getConnections() {
    return editor ? editor.getConnections().map(serializeConn) : [];
  }
  function getTransform() {
    return area ? {
      x: area.area.transform.x,
      y: area.area.transform.y,
      k: area.area.transform.k
    } : null;
  }

  return (
    <>
    <div class={"rozie-flow-canvas"} ref={(el) => { canvasElRef = el as HTMLElement; }} data-rozie-s-cd396d6a="" />


    </>
  );
}
