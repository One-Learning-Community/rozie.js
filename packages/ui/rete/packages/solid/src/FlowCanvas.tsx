import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal, rozieContext } from '@rozie/runtime-solid';
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
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
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
  const [local, attrs] = splitProps(_merged, ['nodes', 'connections', 'zoom', 'pannable', 'zoomable', 'selectable', 'readonly', 'minZoom', 'maxZoom', 'snapGrid', 'accumulateOnCtrl', 'curvature', 'fitOnMount', 'children', 'ref']);
  const resolved = () => local.children;
  onMount(() => { local.ref?.({ getEditor, getArea, addNode, removeNode, addConnection, removeConnection, clear, zoomToFit, zoomTo, getNodes, getConnections, getTransform }); });

  const __ctx_rete_canvas = rozieContext("rete:canvas");
  const [zoom, setZoom] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'zoom', 1);
  const [nodeReg, setNodeReg] = createSignal({});
  const [connReg, setConnReg] = createSignal({});
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
    lastRegistryNodeIds = [];
    lastRegistryConnIds = [];
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
    reconcileNodes = async () => {
      if (!editor || !area) return;
      const propArr = Array.isArray(local.nodes) ? local.nodes : [];
      const {
        merged,
        regIds
      } = mergeById(propArr, nodeReg());
      const regWant = new Set(regIds);
      const propWant = [];
      const want = [];
      programmatic++;
      try {
        for (const spec of merged as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          if (!regWant.has(spec.id)) propWant.push(spec.id);
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
        // remove dropped PROP-managed OR REGISTRY-managed nodes (+ their connections)
        // — imperatively added nodes (in NEITHER provenance set) survive.
        const tracked = new Set([...lastPropNodeIds, ...lastRegistryNodeIds]);
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
        lastPropNodeIds = propWant;
        lastRegistryNodeIds = regIds;
      } finally {
        programmatic--;
      }
    };
    reconcileConnections = async () => {
      if (!editor) return;
      const propArr = Array.isArray(local.connections) ? local.connections : [];
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
      for (const k in connReg()) {
        const n = norm(connReg()[k]);
        if (n) normReg[k] = n;
      }
      const {
        merged,
        regIds
      } = mergeById(normProps, normReg);
      const regWant = new Set(regIds);
      const propWant = [];
      const want = [];
      programmatic++;
      try {
        for (const spec of merged as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          if (!regWant.has(spec.id)) propWant.push(spec.id);
          if (connInstances.has(spec.id)) continue;
          const sourceNode = nodeInstances.get(spec.source);
          const targetNode = nodeInstances.get(spec.target);
          if (!sourceNode || !targetNode) continue;
          const conn = new ClassicPreset.Connection(sourceNode, spec.sourceOutput, targetNode, spec.targetInput);
          conn.id = spec.id;
          connInstances.set(spec.id, conn);
          await editor.addConnection(conn);
        }
        const tracked = new Set([...lastPropConnIds, ...lastRegistryConnIds]);
        for (const id of tracked as any) {
          if (!want.includes(id) && connInstances.has(id)) {
            await editor.removeConnection(id);
            connInstances.delete(id);
          }
        }
        lastPropConnIds = propWant;
        lastRegistryConnIds = regIds;
      } finally {
        programmatic--;
      }
    }

    // ─── initial graph: nodes first, then connections (connections reference live
    // node instances), then optional fit. Sequenced via an async IIFE so the
    // $onMount-returned teardown stays synchronous. ──────────────────────────────
  ;
    (async () => {
      await reconcileNodes();
      await reconcileConnections();
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
  createEffect(on(() => (() => local.nodes)(), (v) => untrack(() => (() => {
    if (reconcileNodes) reconcileNodes();
  })()), { defer: true }));
  createEffect(on(() => (() => local.connections)(), (v) => untrack(() => (() => {
    if (reconcileConnections) reconcileConnections();
  })()), { defer: true }));
  createEffect(on(() => (() => nodeReg())(), (v) => untrack(() => (() => {
    if (reconcileNodes) {
      Promise.resolve(reconcileNodes()).then(() => {
        if (reconcileConnections) reconcileConnections();
      });
    }
  })()), { defer: true }));
  createEffect(on(() => (() => connReg())(), (v) => untrack(() => (() => {
    if (reconcileConnections) reconcileConnections();
  })()), { defer: true }));
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

  // ids last applied FROM THE DECLARATIVE-CHILDREN REGISTRY — a SEPARATE provenance
  // set from lastPropNodeIds/lastPropConnIds (D37-08). reconcile reaps prop-managed
  // AND registry-managed entities by their OWN provenance, but an imperative $expose
  // addNode/addConnection appears in NEITHER set and so survives every reconcile
  // (the power-user escape hatch stays alive). Folding registry ids into
  // lastPropNodeIds would let an imperative add be reaped on the next registry tick.
  let lastRegistryNodeIds: any = null;
  let lastRegistryConnIds: any = null;

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

  // ─── declarative-children registry (Phase 37 $provide/$inject dogfood) ───────
  // The register surface mirrors the SHIPPED Tabs.rozie $provide('tabs', { … })
  // shape, productized for the canvas. CRITICAL reactive-write discipline (D-3,
  // Pitfall 1): every mutation WHOLE-OBJECT-REPLACES the registry so the watched
  // $data.nodeReg/$data.connReg reference changes exactly once per call — a bare
  // in-place $data.nodeReg[id] = spec is silent on React/Solid/Angular/Lit.
  //   register/update/unregister               → node registry (<FlowNode>)
  //   registerConnection/unregisterConnection  → connection registry (<Connection>)
  //   addPort(id, side, key, label, multiple)  → mutate a node spec's inputs/outputs
  //                                              then re-reconcile (feeds buildNode)
  //   bodyHostFor(id)                          → the engine `body` host div (D-04
  //                                              render-callback target, see below)

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
    <__ctx_rete_canvas.Provider value={{
  register: (id: any, spec: any) => {
    setNodeReg({
      ...nodeReg(),
      [id]: spec
    });
  },
  update: (id: any, spec: any) => {
    setNodeReg({
      ...nodeReg(),
      [id]: spec
    });
  },
  unregister: (id: any) => {
    const n = {
      ...nodeReg()
    };
    delete n[id];
    setNodeReg(n);
  },
  registerConnection: (id: any, spec: any) => {
    setConnReg({
      ...connReg(),
      [id]: spec
    });
  },
  unregisterConnection: (id: any) => {
    const c = {
      ...connReg()
    };
    delete c[id];
    setConnReg(c);
  },
  // A <Handle> registers a port against THIS node's id+side. Mutate the registered
  // node spec's inputs/outputs (whole-object replacement of the node entry) so the
  // node $watch refires and reconcileNodes re-runs buildNode with the new port set.
  addPort: (id: any, side: any, key: any, label: any, multiple: any) => {
    if (id == null || key == null) return;
    const cur = nodeReg()[id];
    if (!cur) return;
    const list = side === 'input' ? Array.isArray(cur.inputs) ? cur.inputs.slice() : [] : Array.isArray(cur.outputs) ? cur.outputs.slice() : [];
    if (list.some((p: any) => p && p.key === key)) return;
    list.push({
      key,
      label,
      multiple
    });
    const next = side === 'input' ? {
      ...cur,
      inputs: list
    } : {
      ...cur,
      outputs: list
    };
    setNodeReg({
      ...nodeReg(),
      [id]: next
    });
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
    <div class={"rozie-flow-canvas"} ref={(el) => { canvasElRef = el as HTMLElement; }} data-rozie-s-cd396d6a="" />



    {resolved()}
    </>
    </__ctx_rete_canvas.Provider>
  );
}
