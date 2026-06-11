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
  }`);

interface NodeSlotCtx { node: any; selected: any; emit: any; }

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
  canConnect?: ((...args: unknown[]) => unknown) | null;
  onNodeAction?: (...args: unknown[]) => void;
  onConnectionRejected?: (...args: unknown[]) => void;
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
  const _merged = mergeProps({ validateTypes: true, pannable: true, zoomable: true, selectable: true, readonly: false, minZoom: 0.1, maxZoom: 4, snapGrid: 0, accumulateOnCtrl: true, curvature: 0.3, fitOnMount: true, canConnect: null }, _props);
  const [local, attrs] = splitProps(_merged, ['graph', 'validateTypes', 'zoom', 'pannable', 'zoomable', 'selectable', 'readonly', 'minZoom', 'maxZoom', 'snapGrid', 'accumulateOnCtrl', 'curvature', 'fitOnMount', 'canConnect', 'children', 'ref']);
  const resolved = () => local.children;
  onMount(() => { local.ref?.({ getEditor, getArea, addNode, removeNode, addConnection, removeConnection, clear, zoomToFit, zoomTo, getNodes, getConnections, getTransform }); });

  const __ctx_rete_canvas = rozieContext("rete:canvas");
  const [graph, setGraph] = createControllableSignal<Record<string, any>>(_props as unknown as Record<string, unknown>, 'graph', (() => ({
    nodes: [],
    connections: []
  }))());
  const [zoom, setZoom] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'zoom', 1);
  const [typeReg, setTypeReg] = createSignal({});
  const [portReg, setPortReg] = createSignal({});
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
      const typeSpec = meta.type != null ? typeReg()[meta.type] : null;
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
      if ((_props.nodeSlot ?? _props.slots?.["node"])) {
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
      const curvature = typeof local.curvature === 'number' ? local.curvature : 0.3;
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
        if (local.validateTypes !== false) {
          const srcType = portTypeOf(c.source, 'output', c.sourceOutput);
          const tgtType = portTypeOf(c.target, 'input', c.targetInput);
          if (srcType != null && tgtType != null && srcType !== tgtType) {
            if (!programmatic) _props.onConnectionRejected?.(conn);
            return undefined; // ← CANCEL: type mismatch
          }
        }
        // 2. canConnect OVERRIDE (Phase-40 contract — custom rule, in addition).
        if (typeof local.canConnect === 'function' && local.canConnect(conn) === false) {
          if (!programmatic) _props.onConnectionRejected?.(conn);
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
          _props.onConnectionCreated?.(serializeConn(context.data));
        }
      } else if (context.type === 'connectionremoved') {
        connInstances.delete(context.data.id);
        if (!programmatic) {
          // WRITE-BACK: filter the removed connection out of a fresh graph object (D4).
          writeBackConnectionRemoved(context.data.id);
          _props.onConnectionRemoved?.({
            id: context.data.id
          });
        }
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
          // WRITE-BACK (coalesced): accumulate the latest position for this node and
          // flush ONE fresh graph object per animation frame (Pitfall 2 — the drag
          // storm). The discrete `node-moved` emit stays per-translate (back-compat).
          pendingDragPositions.set(id, {
            x: pos.x,
            y: pos.y
          });
          scheduleDragFlush();
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
      const graphNodes = Array.isArray(graph() && graph().nodes) ? graph().nodes : [];
      const want = [];
      programmatic++;
      try {
        for (const spec of graphNodes as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          nodeMeta.set(spec.id, spec);
          let node = nodeInstances.get(spec.id);
          if (!node) {
            node = buildNode(spec, portReg());
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
            } = portSchemaForType(spec.type, portReg());
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
      const graphConns = Array.isArray(graph() && graph().connections) ? graph().connections : [];
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
      programmatic++;
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
          await editor.addConnection(conn);
        }
        // remove dropped GRAPH-managed edges — imperatively added edges survive.
        const tracked = new Set(lastPropConnIds);
        for (const id of tracked as any) {
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
    if (dragFlushRaf && typeof cancelAnimationFrame === 'function') {
      try {
        cancelAnimationFrame(dragFlushRaf);
      } catch (e: any) {}
    }
    dragFlushRaf = 0;
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
    if (area) area.destroy();
  });
  });
  createEffect(on(() => (() => graph())(), (v) => untrack(() => (() => {
    if (reconcileNodes) {
      Promise.resolve(reconcileNodes()).then(() => {
        if (reconcileConnections) reconcileConnections();
      });
    }
  })()), { defer: true }));
  createEffect(on(() => (() => portReg())(), (v) => untrack(() => (() => {
    if (reconcileNodes) {
      Promise.resolve(reconcileNodes()).then(() => {
        if (reconcileConnections) reconcileConnections();
      });
    }
  })()), { defer: true }));
  createEffect(on(() => (() => typeReg())(), (v) => untrack(() => (() => {
    if (reconcileNodes) reconcileNodes();
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
  let programmatic = 0;

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
  let dragFlushRaf = 0;

  // The current bound graph — NEVER mutated in place.
  function currentGraph() {
    return graph() || {
      nodes: [],
      connections: []
    };
  }

  // Flush the coalesced drag positions: one fresh graph object with every pending
  // node's x/y applied. Echo-guarded. Clears the pending map.
  function flushDragWriteBack() {
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
    setGraph({
      ...g,
      nodes
    });
  }

  // Schedule a coalesced drag write-back (rAF; falls back to a microtask where rAF is
  // unavailable — e.g. a non-DOM test env).
  function scheduleDragFlush() {
    if (dragFlushRaf) return;
    if (typeof requestAnimationFrame === 'function') {
      dragFlushRaf = requestAnimationFrame(flushDragWriteBack);
    } else {
      dragFlushRaf = 1;
      Promise.resolve().then(flushDragWriteBack);
    }
  }

  // CONNECT — append a fresh connection into a fresh graph object. Echo-guarded.
  function writeBackConnectionCreated(c: any) {
    if (programmatic) return;
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
  }

  // DISCONNECT — filter the id out into a fresh graph object. Echo-guarded.
  function writeBackConnectionRemoved(id: any) {
    if (programmatic) return;
    const g = currentGraph();
    setGraph({
      ...g,
      connections: (g.connections || []).filter((e: any) => e && e.id !== id)
    });
  }

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
  let reconcileNodesRunning = false;
  let reconcileNodesPending = false;

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

  // Resolve a node TYPE's port schema from the flat per-TYPE portReg — the entries
  // whose key starts `type + '::'`. Returns { inputs:[{key,label,multiple,portType}],
  // outputs:[…] }. Pure (no $data write) so buildNode / buildSocketRow can call it on
  // every run regardless of the order the <NodeType> vs its <Port> children registered.
  function portSchemaForType(type: any, portReg: any) {
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
  }

  // Build a live Rete node from a graph-node spec ({ id, type, x, y, data }). The
  // consumer's `id` is assigned onto the node so positions, portal keys, and
  // connection source/target ids all align with the author's identifiers (Rete would
  // otherwise auto-generate ids). Sockets come from the node's TYPE port schema
  // (portReg keyed `type::side::key`) — a type's ports declared ONCE apply to every
  // instance (render-by-type). The single shared SOCKET still gates compatibility by
  // identity; the per-port `portType` drives typed VALIDATION, not socket identity.
  function buildNode(spec: any, portReg: any) {
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
  }

  // Resolve a single port's TYPE for the validation pipe: look up the live node's
  // `type` (via nodeMeta) then the portReg entry keyed `type::side::key`. Returns the
  // portType string or null (null on either side ⇒ no type constraint ⇒ allow).
  function portTypeOf(nodeId: any, side: any, key: any) {
    const meta = nodeMeta.get(nodeId);
    if (!meta || meta.type == null || key == null) return null;
    const entry = portReg()[meta.type + '::' + side + '::' + key];
    return entry ? entry.portType : null;
  }

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
  function getEditor() {
    return editor;
  }
  function getArea() {
    return area;
  }
  async function addNode(spec: any) {
    if (!editor || !spec || spec.id == null) return null;
    const node = buildNode(spec, portReg());
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
  // Register/replace a node TYPE template. `spec` carries an optional
  // `bodyRenderer(host, { node })` — the render-by-type projection (mounted per graph
  // node of this type into the engine body host, see renderNode). Whole-object replace.
  registerType: (type: any, spec: any) => {
    if (type != null) setTypeReg({
      ...typeReg(),
      [type]: spec
    });
  },
  // Drop a type on <NodeType> unmount (whole-object replace).
  unregisterType: (type: any) => {
    const t = {
      ...typeReg()
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
  addTypePort: (type: any, side: any, key: any, portType: any, label: any, multiple: any) => {
    if (type == null || key == null) return;
    const portKey = type + '::' + side + '::' + key;
    setPortReg({
      ...portReg(),
      [portKey]: {
        type,
        side,
        key,
        portType,
        label,
        multiple
      }
    });
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
    <div class={"rozie-flow-canvas"} ref={(el) => { canvasElRef = el as HTMLElement; }} data-rozie-s-cd396d6a="" />



    {resolved()}
    </>
    </__ctx_rete_canvas.Provider>
  );
}
