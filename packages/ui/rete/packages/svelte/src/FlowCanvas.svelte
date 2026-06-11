<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';
import { onMount, setContext, untrack } from 'svelte';

interface Props {
  nodes?: any[];
  connections?: any[];
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
  node?: Snippet<[{ node: any; selected: any; emit: any }]>;
  children?: Snippet;
  snippets?: Record<string, any>;
  onnodeaction?: (...args: unknown[]) => void;
  onconnectioncreated?: (...args: unknown[]) => void;
  onconnectionremoved?: (...args: unknown[]) => void;
  onnodepicked?: (...args: unknown[]) => void;
  onnodemoved?: (...args: unknown[]) => void;
  ontranslated?: (...args: unknown[]) => void;
  oncontextmenu?: (...args: unknown[]) => void;
}

let __defaultNodes = (() => [])();
let __defaultConnections = (() => [])();

let {
  nodes = __defaultNodes,
  connections = __defaultConnections,
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
  node: __nodeProp,
  children: __childrenProp,
  snippets,
  onnodeaction,
  onconnectioncreated,
  onconnectionremoved,
  onnodepicked,
  onnodemoved,
  ontranslated,
  oncontextmenu
}: Props = $props();

const node = $derived(__nodeProp ?? snippets?.node);
const children = $derived(__childrenProp ?? snippets?.children);

let nodeReg = $state({});
let connReg = $state({});
let portReg = $state({});

let canvasEl = $state<HTMLElement | undefined>(undefined);

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

// ids last applied FROM PROPS, so reconcile removes only prop-managed entities —
// an imperative $expose addNode/addConnection is NOT auto-reaped on the next
// props change (the power-user escape hatch stays alive). MapLibre reconciles
// every marker because markers are purely prop-driven; a flow editor also accepts
// imperative edits, so it tracks provenance.
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
// Re-entrant suppression counter: while > 0 the editor/area event handlers skip
// echoing back into $emit / $model (our own programmatic add/remove/translate/
// zoom must not bounce out as if the user did it — the MapLibre PROGRAMMATIC
// eventData guard, in counter form so batched/nested ops never race).
let programmatic = 0;

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

// Build a live Rete node from a consumer spec. The consumer's `id` is assigned
// onto the node so positions, portal keys, and connection source/target ids all
// align with the author's identifiers (Rete would otherwise auto-generate ids).
// Build a live Rete node from a consumer spec. The consumer's `id` is assigned
// onto the node so positions, portal keys, and connection source/target ids all
// align with the author's identifiers (Rete would otherwise auto-generate ids).
const buildNode = (spec: any) => {
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
};

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
// Merge the declarative-port registry (the flat portReg entries belonging to this
// node id) into a node spec's inputs/outputs. Returns a spec whose inputs/outputs
// are (spec.inputs ∪ portReg input ports) and (spec.outputs ∪ portReg output ports),
// deduped by key. Pure (no $data write) so reconcileNodes can call it on every run
// regardless of the order the node vs its <Handle> ports registered. Returns the
// SAME spec when there are no extra ports for this node (keeps the config-array path
// allocation-free / byte-equivalent).
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
// Merge the declarative-port registry (the flat portReg entries belonging to this
// node id) into a node spec's inputs/outputs. Returns a spec whose inputs/outputs
// are (spec.inputs ∪ portReg input ports) and (spec.outputs ∪ portReg output ports),
// deduped by key. Pure (no $data write) so reconcileNodes can call it on every run
// regardless of the order the node vs its <Handle> ports registered. Returns the
// SAME spec when there are no extra ports for this node (keeps the config-array path
// allocation-free / byte-equivalent).
const mergePortsIntoSpec = (spec: any, portMap: any) => {
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
};
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

setContext('rete:canvas', {
  register: (id: any, spec: any) => {
    nodeReg = {
      ...nodeReg,
      [id]: spec
    };
  },
  update: (id: any, spec: any) => {
    nodeReg = {
      ...nodeReg,
      [id]: spec
    };
  },
  unregister: (id: any) => {
    const n = {
      ...nodeReg
    };
    delete n[id];
    nodeReg = n;
  },
  registerConnection: (id: any, spec: any) => {
    connReg = {
      ...connReg,
      [id]: spec
    };
  },
  unregisterConnection: (id: any) => {
    const c = {
      ...connReg
    };
    delete c[id];
    connReg = c;
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
    portReg = {
      ...portReg,
      [portKey]: {
        nodeId: id,
        side,
        key,
        label,
        multiple
      }
    };
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
    if (node) {
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
    const curvature$local = typeof curvature === 'number' ? curvature : 0.3;
    const redraw = () => {
      if (!start || !end) return;
      path.setAttribute('d', classicConnectionPath([start, end], curvature$local));
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
      if (!programmatic) onconnectioncreated?.(serializeConn(context.data));
    } else if (context.type === 'connectionremoved') {
      connInstances.delete(context.data.id);
      if (!programmatic) onconnectionremoved?.({
        id: context.data.id
      });
    }
    return context;
  });
  area.addPipe((context: any) => {
    if (!context || typeof context !== 'object' || !('type' in context)) return context;
    if (context.type === 'nodepicked') {
      onnodepicked?.({
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
        onnodemoved?.({
          id,
          x: pos.x,
          y: pos.y
        });
      }
    } else if (context.type === 'translated') {
      ontranslated?.({
        x: context.data.position.x,
        y: context.data.position.y
      });
    } else if (context.type === 'zoomed') {
      if (!programmatic) {
        const k = area.area.transform.k;
        if (k !== zoom) zoom = k;
      }
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
  // The actual reconcile pass — wrapped by reconcileNodes (below) with a re-entrancy
  // guard so two passes never race the engine (the Lit "cannot find node" fix).
  const reconcileNodesPass = async () => {
    if (!editor || !area) return;
    const propArr = Array.isArray(nodes) ? nodes : [];
    const {
      merged,
      regIds
    } = mergeById(propArr, nodeReg);
    const regWant = new Set(regIds);
    const propWant = [];
    const want = [];
    programmatic++;
    try {
      for (const rawSpec of merged as any) {
        if (!rawSpec || rawSpec.id == null) continue;
        // Merge the declarative <Handle> ports (portReg) into this node's spec on
        // EVERY run — order-independent: whether the node or its ports registered
        // last, the reconcile triggered by either sees both (D37 mount-order fix).
        const spec = mergePortsIntoSpec(rawSpec, portReg);
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
          await area.update('node', spec.id);
          // a port change must re-run connections — an edge that was skipped because
          // its endpoint port didn't exist yet can now be drawn.
          if (portsAdded && reconcileConnections) await reconcileConnections();
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
    const propArr = Array.isArray(connections) ? connections : [];
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
    for (const k in connReg) {
      const n = norm(connReg[k]);
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
  })();
  return () => {
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
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { (() => nodes)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (reconcileNodes) reconcileNodes();
})(); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => connections)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => {
  if (reconcileConnections) reconcileConnections();
})(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => nodeReg)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => {
  if (reconcileNodes) {
    Promise.resolve(reconcileNodes()).then(() => {
      if (reconcileConnections) reconcileConnections();
    });
  }
})(); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { (() => connReg)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } (() => {
  if (reconcileConnections) reconcileConnections();
})(); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { (() => portReg)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } (() => {
  if (reconcileNodes) {
    Promise.resolve(reconcileNodes()).then(() => {
      if (reconcileConnections) reconcileConnections();
    });
  }
})(); }); });
let __rozieWatchInitial_5 = true;
$effect(() => { const __watchVal = (() => zoom)(); untrack(() => { if (__rozieWatchInitial_5) { __rozieWatchInitial_5 = false; return; } ((v: any) => {
  if (!area || typeof v !== 'number') return;
  if (v === area.area.transform.k) return;
  programmatic++;
  Promise.resolve(area.area.zoom(v)).finally(() => {
    programmatic--;
  });
})(__watchVal); }); });
</script>

<div class="rozie-flow-canvas" bind:this={canvasEl} data-rozie-s-cd396d6a></div>{@render children?.()}

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
}
</style>
