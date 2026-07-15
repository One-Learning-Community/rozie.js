import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface FlowCanvasProps {
  /**
   * The single source of truth (two-way `r-model`) — `{ nodes: [{ id, type, x, y, data? }], connections: [{ id?, source, sourceOutput?, target, targetInput?, label?, stroke?, dashed? }] }`. A node's `type` selects its `<NodeType>` template (render-by-type + port schema); `data` is the opaque payload handed to that type's `#body` scope. The canvas writes back a FRESH top-level object on every drag (x/y) and connect/disconnect (connections) — immutable applyNodeChanges style. `sourceOutput`/`targetInput` default to `out`/`in`; a missing connection `id` is derived from the endpoints.
   * @example
   * <FlowCanvas r-model:graph="graph" :validate-types="true" />
   */
  graph?: Record<string, unknown>;
  defaultGraph?: Record<string, unknown>;
  onGraphChange?: (next: Record<string, unknown>) => void;
  /**
   * Automatic typed-socket validation (default ON). When `true`, the canvas resolves each endpoint's port type from the per-`<NodeType>` `<Port type>` schema and auto-rejects a type-mismatched connection (firing `connection-rejected`). `canConnect` survives as the optional custom-rule override that runs in addition. Set `false` for pure-`canConnect` (type as metadata only).
   */
  validateTypes?: boolean;
  /**
   * The viewport zoom level (two-way `r-model`). Scroll/pinch writes the new zoom back through the model (echo-guarded against the wrapper's own programmatic zooms); a consumer write zooms the live area. There is deliberately no `zoom`/`zoomed` emit — a same-named emit collides with the model on Vue and Angular — so the two-way binding is the channel for zoom changes.
   */
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (next: number) => void;
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
  onModeChange?: (next: string) => void;
  /**
   * Render the 4th Controls button — the pan ↔ select mode toggle (it two-way-writes `mode`). Default OFF so the default Controls overlay keeps its three buttons. The marquee behavior works whenever `mode === 'select'` regardless of this flag (a consumer can drive `mode` directly); this only governs the built-in button.
   */
  marquee?: boolean;
  /**
   * Render the opt-in NodeToolbar (default OFF) — a floating toolbar over the single selected node (positioned from the engine node-view rect + the area transform, re-tracked on pan/zoom/drag). Default content is Delete (cascading controlled-graph `deleteNode`) + Duplicate (clone the node spec at an offset with a new id into a fresh `graph` object); both fire `@node-action` (`name: 'delete' | 'duplicate'`). Override the content by filling the `#toolbar` reactive slot.
   */
  nodeToolbar?: boolean;
  onEdgeClick?: (...args: unknown[]) => void;
  onEdgeSelected?: (...args: unknown[]) => void;
  onSelectionChange?: (...args: unknown[]) => void;
  onConnectEnd?: (...args: unknown[]) => void;
  onNodeAction?: (...args: unknown[]) => void;
  onConnectionRejected?: (...args: unknown[]) => void;
  onConnectionCreated?: (...args: unknown[]) => void;
  onConnectionRemoved?: (...args: unknown[]) => void;
  onNodePicked?: (...args: unknown[]) => void;
  onNodeMoved?: (...args: unknown[]) => void;
  onTranslated?: (...args: unknown[]) => void;
  onContextMenu?: (...args: unknown[]) => void;
  renderNode?: (params: { node: () => void; selected: () => void; emit: () => void }) => ReactNode;
  renderToolbar?: (params: { node: () => void; emit: () => void }) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
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

declare const FlowCanvas: React.ForwardRefExoticComponent<FlowCanvasProps & React.RefAttributes<FlowCanvasHandle>>;
export default FlowCanvas;
