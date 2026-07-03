import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, InjectionToken, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

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

interface NodeCtx {
  $implicit: { node: any; selected: any; emit: any };
  node: any;
  selected: any;
  emit: any;
}

interface ToolbarCtx {
  $implicit: { node: any; emit: any };
  node: any;
  emit: any;
}

interface DefaultCtx {}

function __rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}

function __rozieAttr(v: unknown): string | null {
  return v == null ? null : __rozieDisplay(v);
}

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-flow-canvas',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-flow-canvas" #canvasEl tabindex="0">
      
      @if (controls()) {
    <div class="rozie-flow-controls">
        <button type="button" class="rozie-flow-controls__btn" data-testid="flow-zoom-in" aria-label="Zoom in" (click)="controlZoomIn()">+</button>
        <button type="button" class="rozie-flow-controls__btn" data-testid="flow-zoom-out" aria-label="Zoom out" (click)="controlZoomOut()">&#8722;</button>
        <button type="button" class="rozie-flow-controls__btn" data-testid="flow-fit" aria-label="Fit view" (click)="controlFit()">&#9744;</button>
        
        @if (marquee()) {
    <button type="button" class="rozie-flow-controls__btn" [ngClass]="{ 'is-active': mode() === 'select' }" data-testid="flow-mode" [attr.aria-label]="rozieAttr(mode() === 'select' ? 'Select mode (click to pan)' : 'Pan mode (click to select)')" (click)="toggleMode()">{{ rozieDisplay(mode() === 'select' ? '▢' : '✥') }}</button>
    }</div>
    }@if (minimap()) {
    <div class="rozie-flow-minimap" #minimapEl data-testid="flow-minimap"></div>
    }<div class="rozie-flow-marquee" #marqueeEl data-testid="flow-marquee"></div>
      
      @if (nodeToolbar()) {
    <div class="rozie-flow-toolbar" #toolbarEl data-testid="flow-toolbar"></div>
    }</div>





    <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [`
    .rozie-flow-canvas {
      width: 100%;
      height: 100%;
      min-height: 360px;
      position: relative;
      overflow: hidden;
      border-radius: var(--rozie-flow-radius, 8px);
      background:
        radial-gradient(circle, var(--rozie-flow-grid-dot-color, rgba(0, 0, 0, 0.08)) 1px, transparent 1px) 0 0 / var(--rozie-flow-grid-size, 20px) var(--rozie-flow-grid-size, 20px),
        var(--rozie-flow-bg, #f7f8fa);
      border: 1px solid var(--rozie-flow-border-color, rgba(0, 0, 0, 0.1));
    }
    .rozie-flow-controls {
      position: absolute;
      left: 10px;
      bottom: 10px;
      z-index: 10;
      display: flex;
      flex-direction: column;
      gap: 2px;
      pointer-events: none;
    }
    .rozie-flow-controls__btn {
      pointer-events: auto;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font: 600 16px/1 system-ui, sans-serif;
      color: var(--rozie-flow-control-fg, #334155);
      background: var(--rozie-flow-control-bg, #ffffff);
      border: 1px solid var(--rozie-flow-control-border, rgba(0, 0, 0, 0.16));
      border-radius: var(--rozie-flow-control-radius, 6px);
      box-shadow: var(--rozie-flow-control-shadow, 0 1px 3px rgba(0, 0, 0, 0.14));
      cursor: pointer;
      user-select: none;
    }
    .rozie-flow-controls__btn:hover { background: var(--rozie-flow-control-hover-bg, #f1f5f9); }
    .rozie-flow-controls__btn:active { background: var(--rozie-flow-control-active-bg, #e2e8f0); }
    .rozie-flow-controls__btn.is-active {
      background: var(--rozie-flow-control-selected-bg, #dbeafe);
      color: var(--rozie-flow-control-selected-fg, #1d4ed8);
      border-color: var(--rozie-flow-control-selected-border, var(--rozie-flow-accent, #3b82f6));
    }
    .rozie-flow-marquee {
      position: absolute;
      display: none;
      z-index: 9;
      pointer-events: none;
      background: var(--rozie-flow-marquee-bg, rgba(59, 130, 246, 0.12));
      border: 1px solid var(--rozie-flow-marquee-border, var(--rozie-flow-accent, #3b82f6));
      border-radius: 2px;
    }
    .rozie-flow-minimap {
      position: absolute;
      right: 10px;
      bottom: 10px;
      z-index: 10;
      width: 200px;
      height: 150px;
      background: var(--rozie-flow-minimap-bg, rgba(255, 255, 255, 0.82));
      border: 1px solid var(--rozie-flow-minimap-border, rgba(0, 0, 0, 0.16));
      border-radius: var(--rozie-flow-control-radius, 6px);
      box-shadow: var(--rozie-flow-minimap-shadow, 0 1px 3px rgba(0, 0, 0, 0.14));
      overflow: hidden;
      cursor: pointer;
      touch-action: none;
    }
    .rozie-flow-minimap__svg { display: block; width: 100%; height: 100%; }
    .rozie-flow-toolbar {
      position: absolute;
      display: none;
      z-index: 11;
      gap: 4px;
      padding: 3px;
      background: var(--rozie-flow-toolbar-bg, #ffffff);
      border: 1px solid var(--rozie-flow-toolbar-border, rgba(0, 0, 0, 0.16));
      border-radius: var(--rozie-flow-control-radius, 6px);
      box-shadow: var(--rozie-flow-toolbar-shadow, 0 2px 8px rgba(0, 0, 0, 0.18));
      pointer-events: auto;
      white-space: nowrap;
    }
    .rozie-flow-toolbar__btn {
      font: 600 12px/1 system-ui, sans-serif;
      color: var(--rozie-flow-toolbar-btn-fg, #334155);
      background: var(--rozie-flow-toolbar-btn-bg, #f8fafc);
      border: 1px solid var(--rozie-flow-toolbar-btn-border, rgba(0, 0, 0, 0.14));
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      user-select: none;
    }
    .rozie-flow-toolbar__btn:hover { background: var(--rozie-flow-toolbar-btn-hover-bg, #eef2f7); }
    .rozie-flow-toolbar__btn:active { background: var(--rozie-flow-control-active-bg, #e2e8f0); }
    .rozie-flow-toolbar__btn--delete { color: var(--rozie-flow-toolbar-delete-fg, #b91c1c); }

    @media (prefers-color-scheme: dark) {
        ::ng-deep .rozie-flow-canvas {
          --rozie-flow-accent: #60a5fa;
          --rozie-flow-bg: #0f172a;
          --rozie-flow-grid-dot-color: rgba(255, 255, 255, 0.06);
          --rozie-flow-border-color: rgba(255, 255, 255, 0.1);
          --rozie-flow-node-bg: #1e293b;
          --rozie-flow-node-border: rgba(255, 255, 255, 0.12);
          --rozie-flow-node-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          --rozie-flow-node-title-fg: #e2e8f0;
          --rozie-flow-node-selected-ring: rgba(96, 165, 250, 0.5);
          --rozie-flow-port-fg: #94a3b8;
          --rozie-flow-socket-bg: #64748b;
          --rozie-flow-socket-border-color: #1e293b;
          --rozie-flow-connection-stroke: #64748b;
          --rozie-flow-connection-label-fg: #e2e8f0;
          --rozie-flow-connection-label-halo: #0f172a;
          --rozie-flow-control-bg: #1e293b;
          --rozie-flow-control-fg: #cbd5e1;
          --rozie-flow-control-border: rgba(255, 255, 255, 0.14);
          --rozie-flow-control-hover-bg: #334155;
          --rozie-flow-control-active-bg: #475569;
          --rozie-flow-control-selected-bg: #1e3a8a;
          --rozie-flow-control-selected-fg: #bfdbfe;
          --rozie-flow-minimap-bg: rgba(15, 23, 42, 0.82);
          --rozie-flow-minimap-border: rgba(255, 255, 255, 0.14);
          --rozie-flow-minimap-node-fill: #64748b;
          --rozie-flow-minimap-mask: rgba(0, 0, 0, 0.35);
          --rozie-flow-toolbar-bg: #1e293b;
          --rozie-flow-toolbar-border: rgba(255, 255, 255, 0.14);
          --rozie-flow-toolbar-btn-bg: #334155;
          --rozie-flow-toolbar-btn-fg: #cbd5e1;
          --rozie-flow-toolbar-btn-border: rgba(255, 255, 255, 0.12);
          --rozie-flow-toolbar-btn-hover-bg: #475569;
          --rozie-flow-toolbar-delete-fg: #f87171;
        }
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: stretch;
        min-width: 140px;
        background: var(--rozie-flow-node-bg, #ffffff);
        border: 1px solid var(--rozie-flow-node-border, rgba(0, 0, 0, 0.16));
        border-radius: var(--rozie-flow-node-radius, 8px);
        box-shadow: var(--rozie-flow-node-shadow, 0 2px 6px rgba(0, 0, 0, 0.12));
        user-select: none;
        cursor: grab;
        font: 13px/1.4 system-ui, sans-serif;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node.is-selected {
        border-color: var(--rozie-flow-node-selected-border, var(--rozie-flow-accent, #3b82f6));
        box-shadow: 0 0 0 2px var(--rozie-flow-node-selected-ring, rgba(59, 130, 246, 0.5)), 0 2px 8px rgba(0, 0, 0, 0.15);
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node__title {
        padding: 0.5rem 0.75rem;
        font-weight: 600;
        color: var(--rozie-flow-node-title-fg, #1f2937);
        white-space: nowrap;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node__body { min-width: 0; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node__col {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.5rem 0;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-port {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        color: var(--rozie-flow-port-fg, #6b7280);
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-port--output { justify-content: flex-end; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket {
        width: var(--rozie-flow-socket-size, 12px);
        height: var(--rozie-flow-socket-size, 12px);
        border-radius: 50%;
        background: var(--rozie-flow-socket-bg, #94a3b8);
        border: 2px solid var(--rozie-flow-socket-border-color, #ffffff);
        box-shadow: 0 0 0 1px var(--rozie-flow-socket-ring, rgba(0, 0, 0, 0.2));
        cursor: crosshair;
        flex: none;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket--input { margin-left: -6px; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket--output { margin-right: -6px; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket:hover { background: var(--rozie-flow-socket-hover-bg, var(--rozie-flow-accent, #3b82f6)); }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node--rows {
        display: flex;
        flex-direction: column;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node__mid {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: stretch;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node__row {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.75rem;
        padding: 0 0.5rem;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-port--vertical {
        flex-direction: column;
        align-items: center;
        gap: 0.125rem;
        font-size: 0.7rem;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket--top,
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket--bottom { margin-left: 0; margin-right: 0; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket--top { margin-top: -6px; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket--bottom { margin-bottom: -6px; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-connection { position: absolute; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-connection__svg {
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
    ::ng-deep .rozie-flow-canvas .rozie-flow-connection__path {
        fill: none;
        stroke: var(--rozie-flow-connection-stroke, #64748b);
        stroke-width: var(--rozie-flow-connection-width, 3px);
        pointer-events: auto;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-connection__path.is-selected {
        stroke: var(--rozie-flow-connection-selected-stroke, var(--rozie-flow-accent, #3b82f6));
        stroke-width: var(--rozie-flow-connection-selected-width, 4px);
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-connection__label {
        font: 600 11px system-ui, sans-serif;
        fill: var(--rozie-flow-connection-label-fg, #334155);
        paint-order: stroke;
        stroke: var(--rozie-flow-connection-label-halo, #ffffff);
        stroke-width: 3px;
        stroke-linejoin: round;
        pointer-events: none;
        user-select: none;
      }
  `],
  providers: [
    {
      provide: rozieToken('rete:canvas'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => FlowCanvas)); return ({
  // Register/replace a node TYPE template. `spec` carries an optional
  // `bodyRenderer(host, { node })` — the render-by-type projection (mounted per graph
  // node of this type into the engine body host, see renderNode). Whole-object replace.
  registerType: (type: any, spec: any) => {
    if (type != null) __rozieCtxHost.typeReg.set({
      ...__rozieCtxHost.typeReg(),
      [type]: spec
    });
  },
  // Drop a type on <NodeType> unmount (whole-object replace).
  unregisterType: (type: any) => {
    const t = {
      ...__rozieCtxHost.typeReg()
    };
    delete t[type];
    __rozieCtxHost.typeReg.set(t);
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
    __rozieCtxHost.portReg.set({
      ...__rozieCtxHost.portReg(),
      [portKey]: {
        type,
        side,
        key,
        portType,
        label,
        multiple,
        position
      }
    });
  },
  // Render-by-type callback target. Returns the engine-created body host div for a
  // graph node (nodeEntries.get(nodeId).body). The render-by-type projection mounts
  // the node's TYPE template `#body` INTO this host via $portals — the Wave-0 A3
  // finding (a Lit child cannot relocate its own shadow <slot> across the boundary),
  // so the body is projected by the parent reusing the $portals host discipline.
  bodyHostFor: (nodeId: any) => {
    const entry = __rozieCtxHost.nodeEntries.get(nodeId);
    return entry ? entry.body : null;
  }
}); },
    },
  ],
})
export class FlowCanvas {
  /**
   * The single source of truth (two-way `r-model`) — `{ nodes: [{ id, type, x, y, data? }], connections: [{ id?, source, sourceOutput?, target, targetInput?, label?, stroke?, dashed? }] }`. A node's `type` selects its `<NodeType>` template (render-by-type + port schema); `data` is the opaque payload handed to that type's `#body` scope. The canvas writes back a FRESH top-level object on every drag (x/y) and connect/disconnect (connections) — immutable applyNodeChanges style. `sourceOutput`/`targetInput` default to `out`/`in`; a missing connection `id` is derived from the endpoints.
   * @example
   * <FlowCanvas r-model:graph="graph" :validate-types="true" />
   */
  graph = model<Record<string, any>>((() => ({
    nodes: [],
    connections: []
  }))());
  /**
   * Automatic typed-socket validation (default ON). When `true`, the canvas resolves each endpoint's port type from the per-`<NodeType>` `<Port type>` schema and auto-rejects a type-mismatched connection (firing `connection-rejected`). `canConnect` survives as the optional custom-rule override that runs in addition. Set `false` for pure-`canConnect` (type as metadata only).
   */
  validateTypes = input<boolean>(true);
  /**
   * The viewport zoom level (two-way `r-model`). Scroll/pinch writes the new zoom back through the model (echo-guarded against the wrapper's own programmatic zooms); a consumer write zooms the live area. There is deliberately no `zoom`/`zoomed` emit — a same-named emit collides with the model on Vue and Angular — so the two-way binding is the channel for zoom changes.
   */
  zoom = model<number>(1);
  /**
   * Whether the canvas can be panned by dragging the background (applied at construction). Set `false` to detach the area's drag handler.
   */
  pannable = input<boolean>(true);
  /**
   * Whether the canvas can be zoomed by scroll/pinch (applied at construction). Set `false` to detach the area's zoom handler.
   */
  zoomable = input<boolean>(true);
  /**
   * Whether nodes can be selected (click; ctrl-click to accumulate). Reflected as the `selected` flag in the `<NodeType>` `#body` scope and surfaced to the consumer via the `@selection-change` event.
   */
  selectable = input<boolean>(true);
  /**
   * Read-only viewer mode — no node drag, no connection editing, and no selection. View-only zoom/fit (Controls, the `zoomTo`/`zoomToFit` verbs) stay enabled.
   */
  readonly = input<boolean>(false);
  /**
   * Minimum zoom level — the lower bound of the area's zoom restrictor. `0` disables the bound.
   */
  minZoom = input<number>(0.1);
  /**
   * Maximum zoom level — the upper bound of the area's zoom restrictor. `0` disables the bound.
   */
  maxZoom = input<number>(4);
  /**
   * Snap-to-grid size in pixels for node dragging. `0` turns snapping off.
   */
  snapGrid = input<number>(0);
  /**
   * When selectable, hold Ctrl to add to the current selection instead of replacing it.
   */
  accumulateOnCtrl = input<boolean>(true);
  /**
   * The bezier curvature of connection paths (`classicConnectionPath`).
   */
  curvature = input<number>(0.3);
  /**
   * After the initial graph mounts, pan/zoom the viewport to fit all nodes (`AreaExtensions.zoomAt`).
   */
  fitOnMount = input<boolean>(true);
  /**
   * Render the built-in Controls overlay — a zoom in / zoom out / fit-view button cluster (the React Flow `<Controls/>` parity). The buttons drive the same zoom/fit path as the `zoomTo`/`zoomToFit` handle verbs (clamped to `minZoom`/`maxZoom`) and stay enabled in `readonly`. Opt out with `:controls="false"`.
   */
  controls = input<boolean>(true);
  /**
   * Render the built-in MiniMap overlay (opt-in, default OFF — the React Flow `<MiniMap/>` parity) — an absolute SVG panel (bottom-right) showing a scaled map of every node (sized from the measured engine node-view dims) plus the current viewport window (the area outside dimmed). It is pannable: dragging the minimap recenters the main viewport (via `setCenter`). Evaluated at construction, like `pannable`/`zoomable`/`controls` — set it at mount time.
   */
  minimap = input<boolean>(false);
  /**
   * Connection-validation predicate `(conn) => boolean`, receiving the normalized candidate connection `{ source, sourceOutput, target, targetInput }`. Return `false` to reject the connection — no edge is committed, no ghost path is drawn, and `connection-rejected` fires. Runs in addition to the automatic `:validate-types` check (the custom-rule override) and gates all connection paths uniformly (drag-to-connect, imperative `addConnection`, graph reconcile). Absent/`null` imposes no custom rule.
   */
  canConnect = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Undo/redo, on by default. Every gesture (drag, connect, disconnect, delete) pushes ONE capped (~100) snapshot of the bound graph (nodes incl. x/y + connections; not the viewport), and `undo()`/`redo()` plus Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y restore it through the two-way `graph` model (echo-guarded). One gesture = one undo step; a fresh edit after an undo discards the redo branch. Opt out with `:history="false"` (the snapshot stack stays empty and the verbs no-op).
   */
  history = input<boolean>(true);
  /**
   * Two-way interaction mode (`r-model`) — the Figma-style pan ↔ select toggle, `'pan'` (default) or `'select'`. In `'pan'` an empty-canvas drag pans the viewport (unchanged). In `'select'` an empty-canvas drag draws a rubber-band marquee box that multi-selects the intersecting nodes (surfacing `@selection-change`). A node drag still drags the node in both modes — only the empty-canvas drag changes. The canvas writes it back when the built-in mode button toggles (see `marquee`).
   */
  mode = model<string>('pan');
  /**
   * Render the 4th Controls button — the pan ↔ select mode toggle (it two-way-writes `mode`). Default OFF so the default Controls overlay keeps its three buttons. The marquee behavior works whenever `mode === 'select'` regardless of this flag (a consumer can drive `mode` directly); this only governs the built-in button.
   */
  marquee = input<boolean>(false);
  /**
   * Render the opt-in NodeToolbar (default OFF) — a floating toolbar over the single selected node (positioned from the engine node-view rect + the area transform, re-tracked on pan/zoom/drag). Default content is Delete (cascading controlled-graph `deleteNode`) + Duplicate (clone the node spec at an offset with a new id into a fresh `graph` object); both fire `@node-action` (`name: 'delete' | 'duplicate'`). Override the content by filling the `#toolbar` reactive slot.
   */
  nodeToolbar = input<boolean>(false);
  typeReg = signal({});
  portReg = signal({});
  canvasEl = viewChild<ElementRef<HTMLDivElement>>('canvasEl');
  minimapEl = viewChild<ElementRef<HTMLDivElement>>('minimapEl');
  marqueeEl = viewChild<ElementRef<HTMLDivElement>>('marqueeEl');
  toolbarEl = viewChild<ElementRef<HTMLDivElement>>('toolbarEl');
  edgeClick = output<unknown>({ alias: 'edge-click' });
  edgeSelected = output<unknown>({ alias: 'edge-selected' });
  selectionChange = output<unknown>({ alias: 'selection-change' });
  connectEnd = output<unknown>({ alias: 'connect-end' });
  nodeAction = output<unknown>({ alias: 'node-action' });
  connectionRejected = output<unknown>({ alias: 'connection-rejected' });
  connectionCreated = output<unknown>({ alias: 'connection-created' });
  connectionRemoved = output<unknown>({ alias: 'connection-removed' });
  nodePicked = output<unknown>({ alias: 'node-picked' });
  nodeMoved = output<unknown>({ alias: 'node-moved' });
  translated = output<unknown>();
  contextMenu = output<unknown>({ alias: 'context-menu' });
  @ContentChild('node', { read: TemplateRef }) nodeTpl?: TemplateRef<NodeCtx>;
  @ContentChild('toolbar', { read: TemplateRef }) toolbarTpl?: TemplateRef<ToolbarCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _nodeTpl = contentChild('node', { read: TemplateRef });
  private _toolbarTpl = contentChild('toolbar', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.graph())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      // T1.3 — keep the canvas's own last-written graph in sync with an EXTERNAL (non-
      // programmatic) consumer change, so undo/redo's "current" state tracks reality (our own
      // write-backs / restores set lastWrittenGraph synchronously under the programmatic guard;
      // this only refreshes it for a genuine outside edit).
      if (this.selfWriteInFlight) {
        // our own commitGraph write echoing back — lastWrittenGraph is already authoritative.
        this.selfWriteInFlight = false;
      } else if (!this.programmatic) {
        const c = structuredClone(this.currentGraph());
        if (c != null) this.lastWrittenGraph = c;
      }
      if (this.reconcileNodes) {
        Promise.resolve(this.reconcileNodes()).then(() => {
          if (this.reconcileConnections) this.reconcileConnections();
        });
      }
      // graph changed (nodes added/removed/moved) → refresh the minimap node rects.
      if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
    })(); }); });
    effect(() => { const __watchVal = (() => this.portReg())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      if (this.reconcileNodes) {
        Promise.resolve(this.reconcileNodes()).then(() => {
          if (this.reconcileConnections) this.reconcileConnections();
        });
      }
    })(); }); });
    effect(() => { const __watchVal = (() => this.typeReg())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      if (this.reconcileNodes) this.reconcileNodes();
    })(); }); });
    effect(() => { const __watchVal = (() => this.zoom())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (!this.area || typeof v !== 'number') return;
      if (v === this.area.area.transform.k) return;
      this.programmatic++;
      Promise.resolve(this.area.area.zoom(v)).finally(() => {
        this.programmatic--;
      });
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      node: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
        const tpl = this._nodeTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-node', 'cd396d6a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
      toolbar: (container: HTMLElement, scope: { node: unknown; emit: unknown }): ReactivePortalHandle => {
        const tpl = this._toolbarTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-toolbar', 'cd396d6a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
    };
    const __selectable = this.selectable();
    const __readonly = this.readonly();
    const __minZoom = this.minZoom();
    const __maxZoom = this.maxZoom();
    const __snapGrid = this.snapGrid();
    const container = this.canvasEl()?.nativeElement;

    // Resolve a `--rozie-flow-*` token off the live canvas element for the imperative
    // SVG attributes that can't take a raw `var()` (the arrowhead fill + the minimap
    // node/mask/viewport colors). Reads post-mount (container is live here → ROZ123-safe)
    // via getComputedStyle; the custom property inherits onto `.rozie-flow-canvas` from
    // any theme import (themes/base.css dark overrides, the shadcn/material/bootstrap
    // bridges) or `:root` override, and falls back to the historical literal when unset —
    // so the zero-import light default stays byte-identical while an imported dark theme
    // + design-system bridges track automatically.
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
    this.lastPropNodeIds = [];
    this.lastPropConnIds = [];
    this.editor = new NodeEditor();
    this.area = new AreaPlugin(container);
    this.connectionPlugin = new ConnectionPlugin();
    this.connectionPlugin.addPreset(ConnectionPresets.classic.setup());

    // Resolve a port's VISUAL position (F2) from the per-TYPE port schema (portReg, keyed
    // `type::side::key`), defaulting by DIRECTION (input → left, output → right) for exact
    // back-compat. DEFINED HERE inside $onMount (NOT top level) so its $data.portReg read
    // lowers on React to the live `_portRegRef.current`, not a stale-empty mount-time
    // closure (the portTypeOf discipline). Used by both the socket-anchor offset below and
    // renderNode's socket layout.
    // Resolve a port's VISUAL position (F2) from the per-TYPE port schema (portReg, keyed
    // `type::side::key`), defaulting by DIRECTION (input → left, output → right) for exact
    // back-compat. DEFINED HERE inside $onMount (NOT top level) so its $data.portReg read
    // lowers on React to the live `_portRegRef.current`, not a stale-empty mount-time
    // closure (the portTypeOf discipline). Used by both the socket-anchor offset below and
    // renderNode's socket layout.
    const resolvePortPosition = (type: any, side: any, key: any) => {
      const entry = type != null && key != null ? this.portReg()[type + '::' + side + '::' + key] : null;
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
    // DOM-based socket position watcher — feeds connection-path redraw + the
    // ConnectionPlugin's drag-to-connect hit-testing. A CUSTOM `offset` (F2): the rete
    // default shifts the anchor 12px OUTWARD on the X axis only (`x + 12·(input?−1:1)`) —
    // correct for left/right, wrong for top/bottom. We resolve each socket's visual
    // position and shift on the matching axis (±x for left/right — IDENTICAL to the default,
    // so the rete-flow-align cell stays green; ±y for top/bottom). The position is looked up
    // live via nodeMeta→type→portReg, so it tracks late-registered ports.
    const SOCKET_SHIFT = 12;
    const socketOffset = (position: any, nodeId: any, side: any, key: any) => {
      const meta = this.nodeMeta.get(nodeId);
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
    this.socketWatcher = getDOMSocketPosition({
      offset: socketOffset
    });
    this.editor.use(this.area);
    this.area.use(this.connectionPlugin);

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
    this.connectionPlugin.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'connectionpick') {
        // Open the coalesce window + capture the pre-gesture snapshot once. Gated on
        // !programmatic + history (a restore-driven engine op must not record history). A
        // re-pick while a close is pending cancels the pending close (the gesture continues).
        if (!this.programmatic && this.history() !== false) {
          this.reconnectInFlight++;
          this.reconnectPreSnapshot = this.snapshotCurrent();
          this.reconnectDidWriteBack = false;
          this.reconnectCloseScheduled = false;
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
        this.scheduleReconnectClose();

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
        if (cd && !cd.socket && cd.created === false && cd.initial && cd.initial.side === 'output' && !this.programmatic) {
          let pos: any = null;
          const inner = this.area && this.area.area ? this.area.area : null;
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
            pos = this.screenToFlowPosition(r.left + r.width / 2, r.top + r.height / 2);
          }
          if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
            this.connectEnd.emit({
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
    // The socket-position watcher (and, conceptually, our vanilla "render plugin")
    // must attach to a CHILD scope of the area — `attach` calls
    // `scope.parentScope(BaseAreaPlugin)`, which walks UP one level, so the scope's
    // parent must BE the area. Attaching to `area` itself fails ("actual parent is
    // not instance of type") because area's parent is the NodeEditor. So we add a
    // minimal child Scope and attach the watcher to it. Rete forwards every area
    // signal (render/nodetranslated/unmount/…) into this child's signal, so the
    // watcher sees socket renders + node moves and recomputes socket positions.
    this.renderScope = new Scope('rozie-vanilla-render');
    this.area.use(this.renderScope);
    this.socketWatcher.attach(this.renderScope);

    // ── T2.6 auto-layout (D-08, verb-only) ──
    // Wire the AutoArrangePlugin (elkjs classic preset) so the top-level autoArrange() verb
    // can run a layered relayout on demand. area.use(arrange) installs it as an area-scope
    // plugin; arrange.layout() mutates the engine node positions directly (calls area.translate
    // internally). The verb reads the arranged positions BACK into a FRESH $model.graph (the
    // controlled-graph contract — the engine is never the source of truth). NO auto-trigger —
    // the consumer calls autoArrange() (the MapLibre verb-first stance).
    // ── T2.6 auto-layout (D-08, verb-only) ──
    // Wire the AutoArrangePlugin (elkjs classic preset) so the top-level autoArrange() verb
    // can run a layered relayout on demand. area.use(arrange) installs it as an area-scope
    // plugin; arrange.layout() mutates the engine node positions directly (calls area.translate
    // internally). The verb reads the arranged positions BACK into a FRESH $model.graph (the
    // controlled-graph contract — the engine is never the source of truth). NO auto-trigger —
    // the consumer calls autoArrange() (the MapLibre verb-first stance).
    this.arrange = new AutoArrangePlugin();
    this.arrange.addPreset(ArrangePresets.classic.setup());
    this.area.use(this.arrange);

    // ── selection (selectableNodes) ──
    // Capture the returned handle ({ select(id, accumulate), unselect(id) }) so the T2.4
    // marquee can PROGRAMMATICALLY select each intersecting node (select(id, true) =
    // accumulate). The handle is null when selection is off (readonly / !selectable), in
    // which case the marquee branch no-ops.
    // ── selection (selectableNodes) ──
    // Capture the returned handle ({ select(id, accumulate), unselect(id) }) so the T2.4
    // marquee can PROGRAMMATICALLY select each intersecting node (select(id, true) =
    // accumulate). The handle is null when selection is off (readonly / !selectable), in
    // which case the marquee branch no-ops.
    if (__selectable && !__readonly) {
      this.selector = AreaExtensions.selector();
      this.nodeSelectApi = AreaExtensions.selectableNodes(this.area, this.selector, {
        accumulating: this.accumulateOnCtrl() ? AreaExtensions.accumulateOnCtrl() : {
          active: () => false
        }
      });
    }
    // raise the picked node above its siblings.
    // raise the picked node above its siblings.
    AreaExtensions.simpleNodesOrder(this.area);

    // ── zoom clamp (restrictor) ──
    // ── zoom clamp (restrictor) ──
    const min = typeof __minZoom === 'number' && __minZoom > 0 ? __minZoom : 0;
    const max = typeof __maxZoom === 'number' && __maxZoom > 0 ? __maxZoom : 0;
    if (min || max) {
      AreaExtensions.restrictor(this.area, {
        scaling: {
          min: min || 0.01,
          max: max || 100
        }
      });
    }

    // ── snap-to-grid ──
    // ── snap-to-grid ──
    if (typeof __snapGrid === 'number' && __snapGrid > 0) {
      AreaExtensions.snapGrid(this.area, {
        size: __snapGrid,
        dynamic: true
      });
    }

    // ── interaction toggles ──
    // ── interaction toggles ──
    if (!this.pannable()) this.area.area.setDragHandler(null);
    if (!this.zoomable()) this.area.area.setZoomHandler(null);

    // ── Delete / Backspace key → cascading delete of the selected node(s) (Win 1) ──
    // Attached to the engine container ($refs.canvasEl, which carries tabindex="0" in
    // the template so it can receive key focus) rather than `document`: the listener
    // lives INSIDE the Lit shadow root alongside the canvas, so a canvas-focused key
    // reaches it on Lit too (a `:target="document"` listener does not reliably see
    // shadow-scoped focus across all 6 — the canvas-element listener is the robust
    // cross-target path). Gated on selectable && !readonly. We guard against deleting
    // while focus is in a node-body text field (INPUT/TEXTAREA/contenteditable) so
    // typing in a node never nukes it. The listener is removed in the teardown.
    // ── Delete / Backspace key → cascading delete of the selected node(s) (Win 1) ──
    // Attached to the engine container ($refs.canvasEl, which carries tabindex="0" in
    // the template so it can receive key focus) rather than `document`: the listener
    // lives INSIDE the Lit shadow root alongside the canvas, so a canvas-focused key
    // reaches it on Lit too (a `:target="document"` listener does not reliably see
    // shadow-scoped focus across all 6 — the canvas-element listener is the robust
    // cross-target path). Gated on selectable && !readonly. We guard against deleting
    // while focus is in a node-body text field (INPUT/TEXTAREA/contenteditable) so
    // typing in a node never nukes it. The listener is removed in the teardown.
    if (__selectable && !__readonly && container && typeof container.addEventListener === 'function') {
      this.onCanvasKeydown = (e: any) => {
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
            this.undo();
            return;
          }
          if (k === 'z' && e.shiftKey || k === 'y') {
            e.preventDefault();
            this.redo();
            return;
          }
        }
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        const ids = this.selectedNodeIds();
        if (ids.length > 0) {
          e.preventDefault();
          for (const id of ids as any) this.deleteNode(id);
          return;
        }
        // T1.1 — EDGE DELETE (D-08). No node is picked but an edge is selected → remove
        // exactly that edge via the controlled-graph write-back (the disconnect path: a
        // fresh `{ ...g, connections: filtered }` object), then clear the selection. The
        // wrapper's own $watch(graph) reconcile reaps the live engine connection (the
        // single removal path — we do NOT also call editor.removeConnection, which would
        // race the reconcile into "cannot find connection", mirroring deleteNode). Node
        // delete takes precedence (handled above); this only runs when nothing's picked.
        if (this.selectedConnId != null) {
          e.preventDefault();
          const id = this.selectedConnId;
          this.clearEdgeSelection();
          this.writeBackConnectionRemoved(id);
        }
      };
      this.keydownContainer = container;
      container.addEventListener('keydown', this.onCanvasKeydown);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // THE VANILLA RENDER PIPE. Intercepts the AreaPlugin's render/unmount signals.
    // ALWAYS returns context (returning undefined would halt the signal chain and
    // break the ConnectionPlugin / socket watcher downstream).
    // ─────────────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
    // THE VANILLA RENDER PIPE. Intercepts the AreaPlugin's render/unmount signals.
    // ALWAYS returns context (returning undefined would halt the signal chain and
    // break the ConnectionPlugin / socket watcher downstream).
    // ─────────────────────────────────────────────────────────────────────────
    this.area.addPipe((context: any) => {
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
      if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
      const id = reteNode.id;
      const meta = this.nodeMeta.get(id) || {
        id,
        type: undefined,
        data: {}
      };
      const existing = this.nodeEntries.get(id);
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
      const emit = (name: any, detail: any) => this.nodeAction.emit({
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
      const typeSpec = meta.type != null ? this.typeReg()[meta.type] : null;
      if (typeSpec && typeof typeSpec.bodyRenderer === 'function') {
        // RENDER-BY-TYPE callback path. The <NodeType> cannot relocate its OWN <slot>
        // across the Lit shadow boundary (Wave-0 A3), so the PARENT projects the body
        // here from its own render scope: the type's registered bodyRenderer(host, scope)
        // mounts the type's `#body` portal INTO the engine `body` div (a FRESH render
        // root per node — no framework DOM relocation, the Phase-37 D-04 trap avoided).
        // nodeEntries must exist before the callback runs (bodyHostFor reads it), so
        // register first. The graph node's `data` flows in as scope → one template per
        // type renders every instance of that type.
        this.nodeEntries.set(id, entry);
        entry.bodyHandle = typeSpec.bodyRenderer(body, {
          node: meta,
          selected,
          emit
        });
        entry.bodyMoved = true;
        return;
      }
      if ((this.nodeTpl ?? this.templates()?.['node'])) {
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
      this.nodeEntries.set(id, entry);
    };

    // Render ONE socket into a zone and, crucially, EMIT its render signal so the
    // ConnectionPlugin + position watcher register it. `position` is the socket's visual
    // placement (left|right|top|bottom). For left/right the DOM is byte-identical to pre-F2
    // (the classic horizontal port row); top/bottom get a vertical port (socket above its
    // label) + a `--<position>` socket class so the socket straddles the matching edge.
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
      this.area.emit({
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
      this.area.emit({
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
        this.area.emit({
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
    // step: orthogonal HV-VH with a mid-X break.
    const stepPath = (s: any, e: any) => {
      const mx = (s.x + e.x) / 2;
      return `M ${s.x} ${s.y} L ${mx} ${s.y} L ${mx} ${e.y} L ${e.x} ${e.y}`;
    };
    // smoothstep: step with rounded corners (radius r, clamped to half the shorter leg).
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
      const __curvature = this.curvature();
      const id = connection.id;
      // A side is dangling when its node id OR its port key is empty/nullish.
      const srcDangling = !connection.source || !connection.sourceOutput;
      const tgtDangling = !connection.target || !connection.targetInput;

      // RE-RENDER of the SAME element (the pseudo on each pointermove): do NOT rebuild
      // the SVG or re-subscribe listeners (would leak) — just update the dangling
      // side's coordinate and redraw. This replaces the old unconditional early-return
      // that froze the preview line. For a REAL connection updatePointer is a no-op,
      // so a re-render of a committed edge is byte-for-byte the old early-return.
      const prev = this.connEntries.get(id);
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
      if (__selectable && !__readonly && !srcDangling && !tgtDangling) {
        path.style.cursor = 'pointer';
        path.addEventListener('pointerup', (e: any) => {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          this.selectEdge(connection.id, path);
        });
      }

      // ── per-edge label + styling (F3) ────────────────────────────────────────────
      // The consumer's connection spec ({ id, source, …, label?, stroke?, dashed? }) is kept
      // in connMeta keyed by id (the connection-side analog of nodeMeta). A committed edge
      // resolves its label/style here; a drag-preview pseudo (no committed id) has none.
      // Styling is applied as INLINE attributes (the arrowhead-marker discipline — engine DOM
      // carries no scope attr); a `label` renders an SVG <text> at the path midpoint (white
      // halo via paint-order for legibility over the line), repositioned in redraw().
      const emeta = this.connMeta.get(connection.id) || null;
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
      const curvature = typeof __curvature === 'number' ? __curvature : 0.3;
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
      if (!srcDangling) un1 = this.socketWatcher.listen(connection.source, 'output', connection.sourceOutput, (p: any) => {
        start = p;
        redraw();
      });
      if (!tgtDangling) un2 = this.socketWatcher.listen(connection.target, 'input', connection.targetInput, (p: any) => {
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
      this.connEntries.set(id, {
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
    // ── unmount cleanup (keyed by the engine element area hands back) ──
    const cleanupElement = (element: any) => {
      for (const [id, entry] of this.nodeEntries as any) {
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
          this.nodeEntries.delete(id);
          return;
        }
      }
      for (const [id, entry] of this.connEntries as any) {
        if (entry.element === element) {
          entry.dispose();
          this.connEntries.delete(id);
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
    // Resolve a single port's TYPE for the validation pipe: look up the live node's
    // `type` (via nodeMeta) then the portReg entry keyed `type::side::key`. Returns the
    // portType string or null (null on either side ⇒ no type constraint ⇒ allow). DEFINED
    // HERE (inside $onMount) — NOT at top level — so its $data.portReg read lowers on React
    // to the live `_portRegRef.current` rather than a stale-empty closure snapshot captured
    // when this once-only mount effect first ran (the cross-type-reject-didn't-fire bug).
    const portTypeOf = (nodeId: any, side: any, key: any) => {
      const meta = this.nodeMeta.get(nodeId);
      if (!meta || meta.type == null || key == null) return null;
      const entry = this.portReg()[meta.type + '::' + side + '::' + key];
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
    this.editor.addPipe((context: any) => {
      const __canConnect = this.canConnect();
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
        if (this.validateTypes() !== false) {
          const srcType = portTypeOf(c.source, 'output', c.sourceOutput);
          const tgtType = portTypeOf(c.target, 'input', c.targetInput);
          if (srcType != null && tgtType != null && srcType !== tgtType) {
            if (!this.programmatic) this.connectionRejected.emit(conn);
            return undefined; // ← CANCEL: type mismatch
          }
        }
        // 2. canConnect OVERRIDE (Phase-40 contract — custom rule, in addition).
        if (typeof __canConnect === 'function' && __canConnect(conn) === false) {
          if (!this.programmatic) this.connectionRejected.emit(conn);
          return undefined; // ← CANCEL: Signal.emit halts, addConnection returns false
        }
      }
      return context;
    });

    // ─── forward engine events (echo-guarded via `programmatic`) ───────────────
    // ─── forward engine events (echo-guarded via `programmatic`) ───────────────
    this.editor.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'connectioncreated') {
        // keep engine truth in sync so reconcile diffs correctly — a user-drawn
        // connection (auto id) must register here or the next graph pass re-adds it.
        this.connInstances.set(context.data.id, context.data);
        if (!this.programmatic) {
          // WRITE-BACK: append the new connection into a fresh graph object (D4).
          this.writeBackConnectionCreated(context.data);
          // keep the discrete event too (back-compat).
          this.connectionCreated.emit(this.serializeConn(context.data));
        }
      } else if (context.type === 'connectionremoved') {
        this.connInstances.delete(context.data.id);
        this.connMeta.delete(context.data.id);
        if (!this.programmatic) {
          // WRITE-BACK: filter the removed connection out of a fresh graph object (D4).
          this.writeBackConnectionRemoved(context.data.id);
          this.connectionRemoved.emit({
            id: context.data.id
          });
        }
      }
      return context;
    });
    this.area.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'nodepicked') {
        this.nodePicked.emit({
          id: context.data.id
        });
        // T1.3 — pointer-DOWN: stash the PRE-drag graph snapshot (before any movement). It
        // is committed to history on the first `nodetranslated` (only if a drag follows;
        // gated on !programmatic + history). A re-pick mid-drag won't overwrite a live one.
        if (!this.programmatic && this.history() !== false && !this.dragGestureActive) {
          this.pendingDragSnapshot = this.snapshotCurrent();
        }
        // Win 2: a pick changed the selection — surface @selection-change after the
        // engine's awaited select() for THIS pick has flushed the selector entities.
        this.scheduleSelectionEmit();
      } else if (context.type === 'pointerup') {
        // Win 2: AreaExtensions.selectableNodes UNSELECTS all on a click-like background
        // pointerUP (its `twitch < 4` deselect — NOT on pointerdown, verified against
        // rete-area-plugin's selectable pipe). Its unselectAll() is async and its pipe
        // runs before ours, so recompute AFTER its awaited unselectAll() flushes (the
        // microtask + rAF schedule). The dedup makes a no-op when nothing changed (e.g. a
        // pointerup that ended a node pick — already surfaced by the nodepicked branch).
        this.scheduleSelectionEmit();
        // T1.3 — a pointerup ends any in-progress drag gesture, so the NEXT drag pushes a
        // fresh history snapshot (one gesture = one undo step, D-03). Drop any stashed
        // pre-drag snapshot that was never committed (a pick with no drag).
        this.dragGestureActive = false;
        this.pendingDragSnapshot = null;
        // T1.1: a background pointerup (anywhere not on a connection path) clears the edge
        // selection — UNLESS this same gesture just selected an edge (the path's own
        // pointerup ran in the same tick and raised `edgeClickGuard`; the guard self-resets
        // on the next microtask). Mirrors the node selectable's click-to-deselect.
        if (!this.edgeClickGuard && this.selectedConnId != null) this.clearEdgeSelection();
      } else if (context.type === 'nodetranslated') {
        if (!this.programmatic) {
          const id = context.data.id;
          const pos = context.data.position;
          const meta = this.nodeMeta.get(id);
          if (meta) {
            meta.x = pos.x;
            meta.y = pos.y;
          }
          // T1.3 — commit ONE history snapshot per drag gesture, at its FIRST translate:
          // the pre-move snapshot stashed on nodepicked (a drag truly happened now, not just
          // a pick). dragGestureActive holds until the drag-ending pointerup resets it, so a
          // continuous drag = ONE undo step (D-03).
          if (!this.dragGestureActive) {
            this.dragGestureActive = true;
            if (this.pendingDragSnapshot) {
              this.pushHistorySnapshot(this.pendingDragSnapshot);
              this.pendingDragSnapshot = null;
            }
          }
          // WRITE-BACK (coalesced): accumulate the latest position for this node and
          // flush ONE fresh graph object per animation frame (Pitfall 2 — the drag
          // storm). The discrete `node-moved` emit stays per-translate (back-compat).
          this.pendingDragPositions.set(id, {
            x: pos.x,
            y: pos.y
          });
          this.scheduleDragFlush();
          this.nodeMoved.emit({
            id,
            x: pos.x,
            y: pos.y
          });
        }
        // a node moved → its minimap rect moves (works during a programmatic translate too).
        if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
        // T2.8 — the selected node moved → re-track its toolbar overlay (no-op if off).
        if (this.scheduleToolbarTrack) this.scheduleToolbarTrack();
      } else if (context.type === 'translated') {
        this.translated.emit({
          x: context.data.position.x,
          y: context.data.position.y
        });
        // the viewport window moved → redraw the minimap viewport rect + mask.
        if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
        // T2.8 — a pan shifts the node's screen rect → re-track the toolbar (no-op if off).
        if (this.scheduleToolbarTrack) this.scheduleToolbarTrack();
      } else if (context.type === 'zoomed') {
        if (!this.programmatic) {
          const k = this.area.area.transform.k;
          if (k !== this.zoom()) this.zoom.set(k);
        }
        // the viewport window resized (zoom) → redraw the minimap viewport rect + mask.
        if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
        // T2.8 — a zoom changes the node's screen rect/size → re-track the toolbar (no-op if off).
        if (this.scheduleToolbarTrack) this.scheduleToolbarTrack();
      } else if (context.type === 'contextmenu') {
        // suppress the native browser menu over the canvas; surface a hook instead.
        context.data.event.preventDefault();
        const ctx = context.data.context;
        this.contextMenu.emit({
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
    // ─── reconciler off the bound graph, bridged to the top-level $watch ──────────
    // Nodes come ONLY from `$props.graph.nodes` (the single source of truth, D1/D2);
    // sockets come from each node's TYPE port schema (portReg keyed `type::side::key`).
    // A port-schema change ($data.portReg, when a <Port> registers late on Lit) ALSO
    // drives this reconcile so a node whose type just gained ports re-renders. An
    // imperative $expose addNode (provenance NOT in lastPropNodeIds) survives the reaper.
    // Wrapped by reconcileNodes (below) with a re-entrancy guard so two passes never
    // race the engine (the Lit "cannot find node" fix).
    const reconcileNodesPass = async () => {
      const __graph = this.graph();
      const __portReg = this.portReg();
      if (!this.editor || !this.area) return;
      const graphNodes = Array.isArray(__graph && __graph.nodes) ? __graph.nodes : [];
      const want = [];
      this.programmatic++;
      try {
        for (const spec of graphNodes as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          this.nodeMeta.set(spec.id, spec);
          let node = this.nodeInstances.get(spec.id);
          if (!node) {
            node = this.buildNode(spec, __portReg);
            this.nodeInstances.set(spec.id, node);
            await this.editor.addNode(node);
            await this.area.translate(spec.id, {
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
            } = this.portSchemaForType(spec.type, __portReg);
            for (const inp of wantIn as any) {
              if (!inp || inp.key == null || node.inputs[inp.key]) continue;
              node.addInput(inp.key, new ClassicPreset.Input(this.SOCKET, inp.label, inp.multiple === true));
              portsAdded = true;
            }
            for (const out of wantOut as any) {
              if (!out || out.key == null || node.outputs[out.key]) continue;
              node.addOutput(out.key, new ClassicPreset.Output(this.SOCKET, out.label, out.multiple !== false));
              portsAdded = true;
            }
            const view = this.area.nodeViews.get(spec.id);
            if (view && spec.x != null && spec.y != null && (view.position.x !== spec.x || view.position.y !== spec.y)) {
              await this.area.translate(spec.id, {
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
              const entry = this.nodeEntries.get(spec.id);
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
                this.nodeEntries.delete(spec.id);
              }
            }
            await this.area.update('node', spec.id);
            // a port change must re-run connections — an edge that was skipped because
            // its endpoint port didn't exist yet can now be drawn.
            if (portsAdded && this.reconcileConnections) await this.reconcileConnections();
          }
        }
        // remove dropped GRAPH-managed nodes (+ their connections) — imperatively added
        // nodes (NOT in lastPropNodeIds) survive (the power-user escape hatch).
        const tracked = new Set(this.lastPropNodeIds);
        for (const id of tracked as any) {
          if (!want.includes(id) && this.nodeInstances.has(id)) {
            for (const c of this.editor.getConnections() as any) {
              if (c.source === id || c.target === id) await this.editor.removeConnection(c.id);
            }
            await this.editor.removeNode(id);
            this.nodeInstances.delete(id);
            this.nodeMeta.delete(id);
          }
        }
        this.lastPropNodeIds = want;
      } finally {
        this.programmatic--;
      }
    };

    // Re-entrancy-guarded entry point. If a pass is already running, mark a re-run and
    // return — the in-flight pass loops until no further request is pending. Serializing
    // overlapping reconciles is what stops the Lit async-context cascade from racing the
    // engine into "cannot find node" (which otherwise aborts the declarative graph build).
    // Re-entrancy-guarded entry point. If a pass is already running, mark a re-run and
    // return — the in-flight pass loops until no further request is pending. Serializing
    // overlapping reconciles is what stops the Lit async-context cascade from racing the
    // engine into "cannot find node" (which otherwise aborts the declarative graph build).
    this.reconcileNodes = async () => {
      if (this.reconcileNodesRunning) {
        this.reconcileNodesPending = true;
        return;
      }
      this.reconcileNodesRunning = true;
      try {
        do {
          this.reconcileNodesPending = false;
          await reconcileNodesPass();
        } while (this.reconcileNodesPending);
      } finally {
        this.reconcileNodesRunning = false;
      }
    };
    this.reconcileConnections = async () => {
      const __graph = this.graph();
      if (!this.editor) return;
      // Edges come ONLY from the bound graph's `connections` (the single source of
      // truth — declarative <Connection> children are gone). Normalize id-defaulting
      // (a connection authored without an id gets a stable derived id) so an edge the
      // canvas wrote back (carrying the engine id) and a hand-authored edge dedup.
      const graphConns = Array.isArray(__graph && __graph.connections) ? __graph.connections : [];
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
      this.programmatic++;
      try {
        for (const spec of merged as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          if (this.connInstances.has(spec.id)) {
            // existing edge — relabel/restyle in place if its label/style changed (the
            // controlled-graph expectation: edit the bound graph → see the change). Drop the
            // render entry so area.update takes the fresh-build path (re-applies label/style).
            const changed = edgeStyleSig(this.connMeta.get(spec.id)) !== edgeStyleSig(spec);
            this.connMeta.set(spec.id, spec);
            if (changed) {
              const entry = this.connEntries.get(spec.id);
              if (entry) {
                entry.dispose();
                this.connEntries.delete(spec.id);
              }
              await this.area.update('connection', spec.id);
            }
            continue;
          }
          const sourceNode = this.nodeInstances.get(spec.source);
          const targetNode = this.nodeInstances.get(spec.target);
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
          this.connInstances.set(spec.id, conn);
          // seed connMeta BEFORE addConnection so renderConnection sees the label/style on
          // its first render (the render fires synchronously inside addConnection's pipe).
          this.connMeta.set(spec.id, spec);
          await this.editor.addConnection(conn);
        }
        // remove dropped GRAPH-managed edges — imperatively added edges survive.
        const tracked = new Set(this.lastPropConnIds);
        for (const id of tracked as any) {
          if (!want.includes(id) && this.connInstances.has(id)) {
            await this.editor.removeConnection(id);
            this.connInstances.delete(id);
            this.connMeta.delete(id);
          }
        }
        this.lastPropConnIds = want;
      } finally {
        this.programmatic--;
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
      const view = this.area && this.area.nodeViews ? this.area.nodeViews.get(id) : null;
      const el = view && view.element ? view.element : null;
      const w = el && el.offsetWidth ? el.offsetWidth : this.MINIMAP_DEFAULT_NODE_W;
      const h = el && el.offsetHeight ? el.offsetHeight : this.MINIMAP_DEFAULT_NODE_H;
      return {
        w,
        h
      };
    };
    const mkMinimapRect = (x: any, y: any, w: any, h: any, cls: any, fill: any, stroke: any, strokeW: any) => {
      const r = document.createElementNS(this.SVGNS, 'rect');
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
    // Rebuild the minimap SVG: node rects (selected highlighted) + a dim mask outside the
    // viewport (evenodd punch-out) + the viewport window outline. The bounds union the
    // node rects AND the viewport window so the viewport indicator stays in-frame even
    // when panned past the nodes. Stores `minimapMap` (the px↔graph mapping the pointer-
    // pan handlers read). Cheap (a handful of rects) → a full rebuild per frame is fine.
    const redrawMinimap = () => {
      this.minimapRedrawRaf = 0;
      if (!this.minimap() || !this.minimapSvg || !this.area || !container) return;
      const t = this.area.area.transform;
      const k = t.k || 1;
      const cw = container.clientWidth || this.MINIMAP_W;
      const ch = container.clientHeight || this.MINIMAP_H;
      // viewport window in GRAPH coords (screen [0,cw]×[0,ch] → graph).
      const vx = -t.x / k,
        vy = -t.y / k,
        vw = cw / k,
        vh = ch / k;
      const graphNodes = this.currentGraph().nodes || [];
      const selIds = new Set(this.selectedNodeIds().map((s: any) => String(s)));
      const rects = [];
      for (const n of graphNodes as any) {
        if (!n || n.id == null) continue;
        const view = this.area.nodeViews.get(n.id);
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
      const scale = Math.min(this.MINIMAP_W / bw, this.MINIMAP_H / bh);
      const offX = (this.MINIMAP_W - bw * scale) / 2;
      const offY = (this.MINIMAP_H - bh * scale) / 2;
      this.minimapMap = {
        minX,
        minY,
        scale,
        offX,
        offY
      };
      const toMMx = (gx: any) => (gx - minX) * scale + offX;
      const toMMy = (gy: any) => (gy - minY) * scale + offY;
      this.minimapSvg.innerHTML = '';
      for (const r of rects as any) {
        const fill = r.selected ? flowToken('--rozie-flow-accent', '#3b82f6') : flowToken('--rozie-flow-minimap-node-fill', '#94a3b8');
        this.minimapSvg.appendChild(mkMinimapRect(toMMx(r.gx), toMMy(r.gy), r.gw * scale, r.gh * scale, 'rozie-flow-minimap__node', fill, null, 0));
      }
      // dim mask OUTSIDE the viewport: full minimap rect with the viewport rect punched
      // out (both subpaths same winding → fill-rule:evenodd leaves the viewport a hole).
      const mvx = toMMx(vx),
        mvy = toMMy(vy),
        mvw = vw * scale,
        mvh = vh * scale;
      const mask = document.createElementNS(this.SVGNS, 'path');
      mask.setAttribute('class', 'rozie-flow-minimap__mask');
      mask.setAttribute('fill-rule', 'evenodd');
      mask.setAttribute('fill', flowToken('--rozie-flow-minimap-mask', 'rgba(15, 23, 42, 0.18)'));
      mask.setAttribute('d', 'M0 0 H' + this.MINIMAP_W + ' V' + this.MINIMAP_H + ' H0 Z ' + 'M' + mvx + ' ' + mvy + ' h' + mvw + ' v' + mvh + ' h' + -mvw + ' Z');
      this.minimapSvg.appendChild(mask);
      this.minimapSvg.appendChild(mkMinimapRect(mvx, mvy, mvw, mvh, 'rozie-flow-minimap__viewport', 'none', flowToken('--rozie-flow-accent', '#3b82f6'), 1.5));
    };

    // rAF-coalesced scheduler (bridged to the top-level $watch + the engine pipes). No-op
    // when :minimap is off (the bridge stays callable everywhere, cheap).
    // rAF-coalesced scheduler (bridged to the top-level $watch + the engine pipes). No-op
    // when :minimap is off (the bridge stays callable everywhere, cheap).
    this.scheduleMinimapRedraw = () => {
      if (!this.minimap() || this.minimapRedrawRaf) return;
      if (typeof requestAnimationFrame === 'function') {
        this.minimapRedrawRaf = requestAnimationFrame(redrawMinimap);
      } else {
        this.minimapRedrawRaf = 1;
        Promise.resolve().then(redrawMinimap);
      }
    };

    // Map a minimap pointer event → graph coords (via the stored minimapMap) → setCenter.
    // Pan is a view op → allowed even when readonly, but gated by `pannable` (mirror the
    // main-canvas pannable gate). Pointer capture keeps the drag tracking off the box.
    // Map a minimap pointer event → graph coords (via the stored minimapMap) → setCenter.
    // Pan is a view op → allowed even when readonly, but gated by `pannable` (mirror the
    // main-canvas pannable gate). Pointer capture keeps the drag tracking off the box.
    const minimapPointerToGraph = (e: any) => {
      if (!this.minimapMap || !this.minimapHost) return null;
      const box = this.minimapHost.getBoundingClientRect();
      const rw = box.width || this.MINIMAP_W;
      const rh = box.height || this.MINIMAP_H;
      const mx = (e.clientX - box.left) * (this.MINIMAP_W / rw);
      const my = (e.clientY - box.top) * (this.MINIMAP_H / rh);
      return {
        gx: this.minimapMap.minX + (mx - this.minimapMap.offX) / this.minimapMap.scale,
        gy: this.minimapMap.minY + (my - this.minimapMap.offY) / this.minimapMap.scale
      };
    };
    if (this.minimap() && this.minimapEl()?.nativeElement) {
      this.minimapHost = this.minimapEl()?.nativeElement;
      this.minimapSvg = document.createElementNS(this.SVGNS, 'svg');
      this.minimapSvg.setAttribute('class', 'rozie-flow-minimap__svg');
      this.minimapSvg.setAttribute('viewBox', '0 0 ' + this.MINIMAP_W + ' ' + this.MINIMAP_H);
      this.minimapSvg.setAttribute('preserveAspectRatio', 'none');
      this.minimapHost.appendChild(this.minimapSvg);
      this.onMinimapPointerDown = (e: any) => {
        if (!this.pannable()) return;
        const g = minimapPointerToGraph(e);
        if (!g) return;
        this.minimapPanning = true;
        try {
          if (e.target && e.target.setPointerCapture && e.pointerId != null) e.target.setPointerCapture(e.pointerId);
        } catch (err: any) {}
        e.preventDefault();
        e.stopPropagation();
        this.setCenter(g.gx, g.gy, null);
      };
      this.onMinimapPointerMove = (e: any) => {
        if (!this.minimapPanning || !this.pannable()) return;
        const g = minimapPointerToGraph(e);
        if (!g) return;
        e.preventDefault();
        this.setCenter(g.gx, g.gy, null);
      };
      this.onMinimapPointerUp = (e: any) => {
        if (!this.minimapPanning) return;
        this.minimapPanning = false;
        try {
          if (e.target && e.target.releasePointerCapture && e.pointerId != null) e.target.releasePointerCapture(e.pointerId);
        } catch (err: any) {}
      };
      this.minimapHost.addEventListener('pointerdown', this.onMinimapPointerDown);
      this.minimapHost.addEventListener('pointermove', this.onMinimapPointerMove);
      this.minimapHost.addEventListener('pointerup', this.onMinimapPointerUp);
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
      const ids = this.selectedNodeIds();
      return ids.length === 1 ? ids[0] : null;
    };

    // Position the toolbar host over the tracked node's engine element, or hide it. The
    // node-view element is already transformed by the AreaPlugin (pan/zoom/drag), so its
    // client rect minus the container's client rect gives the toolbar's container-relative
    // px — no manual transform math. Placed just ABOVE the node (bottom of the toolbar at the
    // node's top edge); clamped so it never goes off the top of the container.
    // Position the toolbar host over the tracked node's engine element, or hide it. The
    // node-view element is already transformed by the AreaPlugin (pan/zoom/drag), so its
    // client rect minus the container's client rect gives the toolbar's container-relative
    // px — no manual transform math. Placed just ABOVE the node (bottom of the toolbar at the
    // node's top edge); clamped so it never goes off the top of the container.
    const trackToolbar = () => {
      this.toolbarTrackRaf = 0;
      if (!this.nodeToolbar() || !this.toolbarHost || !this.area || !container) return;
      const id = this.toolbarSelectedId;
      if (id == null) {
        this.toolbarHost.style.display = 'none';
        return;
      }
      const view = this.area.nodeViews ? this.area.nodeViews.get(id) : null;
      const el = view && view.element ? view.element : null;
      const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
      if (!rect) {
        this.toolbarHost.style.display = 'none';
        return;
      }
      const cbox = container.getBoundingClientRect();
      // container-relative px of the node's top-left + width.
      const nx = rect.left - cbox.left;
      const ny = rect.top - cbox.top;
      const tbH = this.toolbarHost.offsetHeight || 30;
      let top = ny - tbH - 6;
      if (top < 2) top = ny + rect.height + 6; // flip below if it would clip the top
      this.toolbarHost.style.left = nx + 'px';
      this.toolbarHost.style.top = top + 'px';
      this.toolbarHost.style.display = 'flex';
    };
    this.scheduleToolbarTrack = () => {
      if (!this.nodeToolbar() || this.toolbarTrackRaf) return;
      if (typeof requestAnimationFrame === 'function') {
        this.toolbarTrackRaf = requestAnimationFrame(trackToolbar);
      } else {
        this.toolbarTrackRaf = 1;
        Promise.resolve().then(trackToolbar);
      }
    };

    // Recompute the tracked node from the live selection + (re)mount the toolbar content for
    // it. Called from the selection emit (a pick/unpick changed the selection). When the
    // tracked id changes: if the consumer fills `#toolbar`, (re)render the reactive portal
    // with the new node scope; else the default buttons stay put (they read the live tracked
    // id at click time, so no re-mount needed). Then reposition.
    // Recompute the tracked node from the live selection + (re)mount the toolbar content for
    // it. Called from the selection emit (a pick/unpick changed the selection). When the
    // tracked id changes: if the consumer fills `#toolbar`, (re)render the reactive portal
    // with the new node scope; else the default buttons stay put (they read the live tracked
    // id at click time, so no re-mount needed). Then reposition.
    const syncToolbar = () => {
      if (!this.nodeToolbar() || !this.toolbarHost) return;
      const id = singleSelectedNodeId();
      if (id === this.toolbarSelectedId && id == null === (this.toolbarSelectedId == null)) {
        // same target — just reposition (e.g. after a drag).
        this.scheduleToolbarTrack();
        return;
      }
      this.toolbarSelectedId = id;
      if ((this.toolbarTpl ?? this.templates()?.['toolbar']) && id != null) {
        const meta = this.nodeMeta.get(id) || {
          id,
          type: undefined,
          data: {}
        };
        const scope = {
          node: meta,
          emit: toolbarEmit
        };
        if (this.toolbarHandle && this.toolbarHandle.update) {
          this.toolbarHandle.update(scope);
        } else {
          this.toolbarHandle = portals.toolbar(this.toolbarHost, scope);
        }
      }
      this.scheduleToolbarTrack();
    };
    this.syncToolbarSelection = syncToolbar;

    // The @node-action emit helper for the toolbar's actions (the EXISTING emit — no new emit,
    // T2.8). Carries the tracked node id. Handed to the `#toolbar` slot scope so a consumer
    // override can raise its own actions too.
    // The @node-action emit helper for the toolbar's actions (the EXISTING emit — no new emit,
    // T2.8). Carries the tracked node id. Handed to the `#toolbar` slot scope so a consumer
    // override can raise its own actions too.
    const toolbarEmit = (name: any, detail: any) => {
      const id = this.toolbarSelectedId;
      this.nodeAction.emit({
        id,
        name,
        detail
      });
    };
    if (this.nodeToolbar() && this.toolbarEl()?.nativeElement) {
      this.toolbarHost = this.toolbarEl()?.nativeElement;
      this.toolbarHost.style.display = 'none';
      if (!(this.toolbarTpl ?? this.templates()?.['toolbar'])) {
        // default chrome: delete + duplicate buttons. Static literal labels (Threat
        // T-44-06-1: no node-derived text rendered via innerHTML — these are fixed strings
        // set via textContent). Both fire @node-action on the tracked node.
        this.toolbarDeleteBtn = document.createElement('button');
        this.toolbarDeleteBtn.type = 'button';
        this.toolbarDeleteBtn.className = 'rozie-flow-toolbar__btn rozie-flow-toolbar__btn--delete';
        this.toolbarDeleteBtn.setAttribute('data-testid', 'flow-toolbar-delete');
        this.toolbarDeleteBtn.setAttribute('aria-label', 'Delete node');
        this.toolbarDeleteBtn.textContent = 'Delete';
        this.toolbarDuplicateBtn = document.createElement('button');
        this.toolbarDuplicateBtn.type = 'button';
        this.toolbarDuplicateBtn.className = 'rozie-flow-toolbar__btn rozie-flow-toolbar__btn--duplicate';
        this.toolbarDuplicateBtn.setAttribute('data-testid', 'flow-toolbar-duplicate');
        this.toolbarDuplicateBtn.setAttribute('aria-label', 'Duplicate node');
        this.toolbarDuplicateBtn.textContent = 'Duplicate';
        this.onToolbarDelete = (e: any) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          const id = this.toolbarSelectedId;
          if (id == null) return;
          toolbarEmit('delete', {
            id
          });
          this.toolbarSelectedId = null;
          this.deleteNode(id);
          this.scheduleToolbarTrack();
        };
        this.onToolbarDup = (e: any) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          const id = this.toolbarSelectedId;
          if (id == null) return;
          const newId = this.duplicateNode(id);
          toolbarEmit('duplicate', {
            id,
            newId
          });
          this.scheduleToolbarTrack();
        };
        // pointerup (NOT click — Rete swallows clicks during node interaction; the §6a item-7
        // discipline) on the COMPONENT-template buttons.
        this.toolbarDeleteBtn.addEventListener('pointerup', this.onToolbarDelete);
        this.toolbarDuplicateBtn.addEventListener('pointerup', this.onToolbarDup);
        this.toolbarHost.appendChild(this.toolbarDeleteBtn);
        this.toolbarHost.appendChild(this.toolbarDuplicateBtn);
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
    // container-relative px → GRAPH coords (the inverse area transform, like
    // screenToFlowPosition but already container-relative). px = transform + graph·k.
    const containerPxToGraph = (px: any, py: any) => {
      const t = this.area.area.transform;
      const k = t.k || 1;
      return {
        x: (px - t.x) / k,
        y: (py - t.y) / k
      };
    };
    const updateMarqueeBox = () => {
      if (!this.marqueeBox || !this.marqueeStart || !this.marqueeCur) return;
      const x = Math.min(this.marqueeStart.x, this.marqueeCur.x);
      const y = Math.min(this.marqueeStart.y, this.marqueeCur.y);
      const w = Math.abs(this.marqueeCur.x - this.marqueeStart.x);
      const h = Math.abs(this.marqueeCur.y - this.marqueeStart.y);
      this.marqueeBox.style.left = x + 'px';
      this.marqueeBox.style.top = y + 'px';
      this.marqueeBox.style.width = w + 'px';
      this.marqueeBox.style.height = h + 'px';
      this.marqueeBox.style.display = 'block';
    };
    const finishMarquee = () => {
      if (!this.marqueeActive) return;
      this.marqueeActive = false;
      if (this.marqueeBox) this.marqueeBox.style.display = 'none';
      if (!this.marqueeStart || !this.marqueeCur || !this.nodeSelectApi) {
        this.marqueeStart = null;
        this.marqueeCur = null;
        return;
      }
      // box in graph coords (two opposite corners → min/max).
      const a = containerPxToGraph(this.marqueeStart.x, this.marqueeStart.y);
      const b = containerPxToGraph(this.marqueeCur.x, this.marqueeCur.y);
      const bx0 = Math.min(a.x, b.x),
        by0 = Math.min(a.y, b.y);
      const bx1 = Math.max(a.x, b.x),
        by1 = Math.max(a.y, b.y);
      this.marqueeStart = null;
      this.marqueeCur = null;
      const graphNodes = this.currentGraph().nodes || [];
      let first = true;
      for (const n of graphNodes as any) {
        if (!n || n.id == null) continue;
        const view = this.area.nodeViews.get(n.id);
        const gx = view ? view.position.x : n.x || 0;
        const gy = view ? view.position.y : n.y || 0;
        const sz = measureNodeSize(n.id);
        // a node intersects the box if their rects overlap (AABB), in graph coords.
        const overlaps = gx < bx1 && gx + sz.w > bx0 && gy < by1 && gy + sz.h > by0;
        if (overlaps) {
          // accumulate=true keeps every intersector selected (first one replaces the prior
          // selection so an old pick doesn't linger; rest accumulate). select(id, accumulate).
          this.nodeSelectApi.select(n.id, !first);
          first = false;
        }
      }
      // surface @selection-change once the engine's awaited select() chain has flushed.
      this.scheduleSelectionEmit();
    };
    if (__selectable && !__readonly && container && typeof container.addEventListener === 'function') {
      this.marqueeBox = this.marqueeEl()?.nativeElement || null;
      this.onCanvasPointerDownCapture = (e: any) => {
        // only in select mode, only the EMPTY canvas (not on a node — those still drag), only
        // the primary button. A live `$props.mode` read = the persistent mode-guard (restoring
        // pan is just this check returning early; no engine mutation).
        if (this.mode() !== 'select') return;
        if (e && e.button != null && e.button !== 0) return;
        if (nodeAt(e.target)) return;
        // BLOCK rete's pan Drag (its bubble-phase pointerdown on the same container) — capture
        // phase runs first, so stopPropagation() here pre-empts pan; the marquee owns this drag.
        e.stopPropagation();
        e.preventDefault();
        const box = container.getBoundingClientRect();
        this.marqueeActive = true;
        this.marqueeStart = {
          x: e.clientX - box.left,
          y: e.clientY - box.top
        };
        this.marqueeCur = {
          x: this.marqueeStart.x,
          y: this.marqueeStart.y
        };
        try {
          if (container.setPointerCapture && e.pointerId != null) container.setPointerCapture(e.pointerId);
        } catch (err: any) {}
        updateMarqueeBox();
      };
      this.onMarqueePointerMove = (e: any) => {
        if (!this.marqueeActive) return;
        const box = container.getBoundingClientRect();
        this.marqueeCur = {
          x: e.clientX - box.left,
          y: e.clientY - box.top
        };
        updateMarqueeBox();
      };
      this.onMarqueePointerUp = (e: any) => {
        if (!this.marqueeActive) return;
        try {
          if (container.releasePointerCapture && e && e.pointerId != null) container.releasePointerCapture(e.pointerId);
        } catch (err: any) {}
        finishMarquee();
      };
      container.addEventListener('pointerdown', this.onCanvasPointerDownCapture, true);
      container.addEventListener('pointermove', this.onMarqueePointerMove);
      container.addEventListener('pointerup', this.onMarqueePointerUp);
    }

    // ─── initial graph: nodes first, then connections (connections reference live
    // node instances), then optional fit. Sequenced via an async IIFE so the
    // $onMount-returned teardown stays synchronous. ──────────────────────────────
    // ─── initial graph: nodes first, then connections (connections reference live
    // node instances), then optional fit. Sequenced via an async IIFE so the
    // $onMount-returned teardown stays synchronous. ──────────────────────────────
    ;
    (async () => {
      // T1.3 — seed the canvas's own last-written graph from the initial bound value so the
      // first gesture's snapshot/base reflects the mounted graph (immune to prop re-bind lag).
      this.lastWrittenGraph = structuredClone(this.currentGraph());
      await this.reconcileNodes();
      await this.reconcileConnections();
      if (typeof this.zoom() === 'number' && this.zoom() !== 1) {
        this.programmatic++;
        try {
          await this.area.area.zoom(this.zoom());
        } finally {
          this.programmatic--;
        }
      }
      if (this.fitOnMount() && this.editor.getNodes().length) {
        this.programmatic++;
        try {
          await AreaExtensions.zoomAt(this.area, this.editor.getNodes());
        } finally {
          this.programmatic--;
        }
        if (this.area) {
          const k = this.area.area.transform.k;
          if (k !== this.zoom()) this.zoom.set(k);
        }
      }
      // draw the minimap once the graph + fit have settled (also redrawn on every
      // render / pan / zoom / drag / selection / graph change below).
      if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
    })();
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.onCanvasKeydown && this.keydownContainer && typeof this.keydownContainer.removeEventListener === 'function') {
        try {
          this.keydownContainer.removeEventListener('keydown', this.onCanvasKeydown);
        } catch (e: any) {}
      }
      if (this.dragFlushRaf && typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(this.dragFlushRaf);
        } catch (e: any) {}
      }
      this.dragFlushRaf = 0;
      this.pendingDragPositions.clear();
      // T1.1: drop the edge-selection state + its cached <path> reference on teardown.
      this.clearEdgeSelection();
      // MiniMap teardown — remove the pointer-pan listeners + cancel a pending redraw.
      if (this.minimapHost) {
        if (this.onMinimapPointerDown) {
          try {
            this.minimapHost.removeEventListener('pointerdown', this.onMinimapPointerDown);
          } catch (e: any) {}
        }
        if (this.onMinimapPointerMove) {
          try {
            this.minimapHost.removeEventListener('pointermove', this.onMinimapPointerMove);
          } catch (e: any) {}
        }
        if (this.onMinimapPointerUp) {
          try {
            this.minimapHost.removeEventListener('pointerup', this.onMinimapPointerUp);
          } catch (e: any) {}
        }
      }
      if (this.minimapRedrawRaf && typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(this.minimapRedrawRaf);
        } catch (e: any) {}
      }
      this.minimapRedrawRaf = 0;
      // T2.8 NodeToolbar teardown — remove the default-button listeners, dispose the optional
      // `#toolbar` reactive portal handle, and cancel a pending reposition.
      if (this.toolbarDeleteBtn && this.onToolbarDelete) {
        try {
          this.toolbarDeleteBtn.removeEventListener('pointerup', this.onToolbarDelete);
        } catch (e: any) {}
      }
      if (this.toolbarDuplicateBtn && this.onToolbarDup) {
        try {
          this.toolbarDuplicateBtn.removeEventListener('pointerup', this.onToolbarDup);
        } catch (e: any) {}
      }
      if (this.toolbarHandle && this.toolbarHandle.dispose) {
        try {
          this.toolbarHandle.dispose();
        } catch (e: any) {}
      }
      this.toolbarHandle = null;
      this.toolbarSelectedId = null;
      if (this.toolbarTrackRaf && typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(this.toolbarTrackRaf);
        } catch (e: any) {}
      }
      this.toolbarTrackRaf = 0;
      // T2.4 Marquee teardown — remove the capture-phase pointerdown guard + window listeners.
      if (this.keydownContainer) {
        if (this.onCanvasPointerDownCapture) {
          try {
            this.keydownContainer.removeEventListener('pointerdown', this.onCanvasPointerDownCapture, true);
          } catch (e: any) {}
        }
        if (this.onMarqueePointerMove) {
          try {
            this.keydownContainer.removeEventListener('pointermove', this.onMarqueePointerMove);
          } catch (e: any) {}
        }
        if (this.onMarqueePointerUp) {
          try {
            this.keydownContainer.removeEventListener('pointerup', this.onMarqueePointerUp);
          } catch (e: any) {}
        }
      }
      this.marqueeActive = false;
      this.marqueeStart = null;
      this.marqueeCur = null;
      for (const [, entry] of this.nodeEntries as any) {
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
      this.nodeEntries.clear();
      for (const [, entry] of this.connEntries as any) entry.dispose();
      this.connEntries.clear();
      if (this.area) this.area.destroy();
    });
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
  }

  editor: any = null;
  area: any = null;
  connectionPlugin: any = null;
  socketWatcher: any = null;
  renderScope: any = null;
  selector: any = null;
  arrange: any = null;
  keydownContainer: any = null;
  onCanvasKeydown: any = null;
  minimapHost: any = null;
  minimapSvg: any = null;
  minimapRedrawRaf = 0;
  minimapMap: any = null;
  minimapPanning = false;
  onMinimapPointerDown: any = null;
  onMinimapPointerMove: any = null;
  onMinimapPointerUp: any = null;
  scheduleMinimapRedraw: any = null;
  nodeSelectApi: any = null;
  marqueeBox: any = null;
  marqueeActive = false;
  marqueeStart: any = null;
  marqueeCur: any = null;
  onCanvasPointerDownCapture: any = null;
  onMarqueePointerMove: any = null;
  onMarqueePointerUp: any = null;
  toolbarHost: any = null;
  toolbarSelectedId: any = null;
  toolbarHandle: any = null;
  scheduleToolbarTrack: any = null;
  syncToolbarSelection: any = null;
  toolbarTrackRaf = 0;
  toolbarDeleteBtn: any = null;
  toolbarDuplicateBtn: any = null;
  onToolbarDelete: any = null;
  onToolbarDup: any = null;
  MINIMAP_W = 200;
  MINIMAP_H = 150;
  MINIMAP_DEFAULT_NODE_W = 140;
  MINIMAP_DEFAULT_NODE_H = 52;
  SVGNS = 'http://www.w3.org/2000/svg';
  SOCKET = new ClassicPreset.Socket('flow');
  nodeInstances = new Map();
  nodeMeta = new Map();
  connInstances = new Map();
  nodeEntries = new Map();
  connEntries = new Map();
  connMeta = new Map();
  lastPropNodeIds: any = null;
  lastPropConnIds: any = null;
  programmatic = 0;
  lastSelectionIds: any = null;
  selectedConnId: any = null;
  selectedPathEl: any = null;
  edgeClickGuard = false;
  HISTORY_CAP = 100;
  historyStack = [];
  redoStack = [];
  dragGestureActive = false;
  pendingDragSnapshot: any = null;
  reconnectInFlight = 0;
  reconnectPreSnapshot: any = null;
  reconnectDidWriteBack = false;
  reconnectCloseScheduled = false;
  pendingDragPositions = new Map();
  dragFlushRaf = 0;
  currentGraph = () => this.graph() || {
    nodes: [],
    connections: []
  };
  lastWrittenGraph: any = null;
  selfWriteInFlight = false;
  commitGraph = (g: any) => {
    const c = structuredClone(g);
    this.lastWrittenGraph = c != null ? c : g;
    this.selfWriteInFlight = true;
    this.graph.set(g);
  };
  snapshotCurrent = () => {
    const src = this.lastWrittenGraph != null ? this.lastWrittenGraph : this.currentGraph();
    return structuredClone(src);
  };
  baseGraph = () => this.lastWrittenGraph != null ? this.lastWrittenGraph : this.currentGraph();
  pushHistorySnapshot = (snap: any) => {
    if (this.history() === false) return;
    if (!snap) return;
    this.historyStack.push(snap);
    if (this.historyStack.length > this.HISTORY_CAP) {
      this.historyStack = this.historyStack.slice(this.historyStack.length - this.HISTORY_CAP);
    }
    this.redoStack = [];
  };
  pushHistory = () => {
    if (this.programmatic) return;
    if (this.history() === false) return;
    this.pushHistorySnapshot(this.snapshotCurrent());
  };
  closeReconnectGesture = () => {
    if (!this.reconnectCloseScheduled) return;
    this.reconnectCloseScheduled = false;
    if (this.reconnectInFlight > 0) this.reconnectInFlight = 0;
    if (!this.programmatic && this.history() !== false && this.reconnectDidWriteBack && this.reconnectPreSnapshot) {
      this.pushHistorySnapshot(this.reconnectPreSnapshot);
    }
    this.reconnectPreSnapshot = null;
    this.reconnectDidWriteBack = false;
  };
  scheduleReconnectClose = () => {
    if (this.reconnectCloseScheduled) return;
    this.reconnectCloseScheduled = true;
    if (typeof setTimeout === 'function') setTimeout(this.closeReconnectGesture, 0);else Promise.resolve().then(this.closeReconnectGesture);
  };
  restoreGraph = (snap: any) => {
    if (!snap) return;
    // Cancel any in-flight drag write-back so a queued frame can't clobber the restore with
    // a stale position after the programmatic guard releases.
    this.pendingDragPositions.clear();
    if (this.dragFlushRaf) {
      if (typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(this.dragFlushRaf);
        } catch (e: any) {}
      }
      this.dragFlushRaf = 0;
    }
    this.programmatic++;
    try {
      const fresh = {
        nodes: (snap.nodes || []).map((n: any) => ({
          ...n
        })),
        connections: (snap.connections || []).map((c: any) => ({
          ...c
        }))
      };
      this.commitGraph(fresh);
    } finally {
      this.programmatic--;
    }
  };
  undo = () => {
    if (this.historyStack.length === 0) return;
    const cur = this.snapshotCurrent();
    const snap = this.historyStack.pop();
    if (cur) this.redoStack.push(cur);
    this.restoreGraph(snap);
  };
  redo = () => {
    if (this.redoStack.length === 0) return;
    const cur = this.snapshotCurrent();
    const snap = this.redoStack.pop();
    if (cur) this.historyStack.push(cur);
    this.restoreGraph(snap);
  };
  canUndo = () => this.historyStack.length > 0;
  canRedo = () => this.redoStack.length > 0;
  flushDragWriteBack = () => {
    this.dragFlushRaf = 0;
    if (this.programmatic) {
      this.pendingDragPositions.clear();
      return;
    }
    if (this.pendingDragPositions.size === 0) return;
    const g = this.baseGraph();
    const nodes = (g.nodes || []).map((n: any) => {
      const p = n && n.id != null ? this.pendingDragPositions.get(n.id) : null;
      return p ? {
        ...n,
        x: p.x,
        y: p.y
      } : n;
    });
    this.pendingDragPositions.clear();
    this.commitGraph({
      ...g,
      nodes
    });
  };
  scheduleDragFlush = () => {
    if (this.dragFlushRaf) return;
    if (typeof requestAnimationFrame === 'function') {
      this.dragFlushRaf = requestAnimationFrame(this.flushDragWriteBack);
    } else {
      this.dragFlushRaf = 1;
      Promise.resolve().then(this.flushDragWriteBack);
    }
  };
  writeBackConnectionCreated = (c: any) => {
    if (this.programmatic) return;
    // T1.3 — one history entry per CONNECT gesture (BEFORE the write so the snapshot is the
    // pre-connect state — snapshotCurrent reads lastWrittenGraph, still the pre-connect value).
    // T2.5 — SUPPRESS while a reconnect is in flight: the paired remove+add of a reconnect
    // (and a plain new-connection drag, which also rides connectionpick/drop) push ONE
    // coalesced snapshot on connectiondrop instead (D-03 one-gesture-one-entry).
    if (this.reconnectInFlight) this.reconnectDidWriteBack = true;else this.pushHistory();
    const g = this.baseGraph();
    const conn = {
      id: c.id,
      source: c.source,
      sourceOutput: c.sourceOutput,
      target: c.target,
      targetInput: c.targetInput
    };
    this.commitGraph({
      ...g,
      connections: [...(g.connections || []), conn]
    });
  };
  writeBackConnectionRemoved = (id: any) => {
    if (this.programmatic) return;
    // T1.3 — one history entry per DISCONNECT / edge-delete gesture (BEFORE the write).
    // T2.5 — SUPPRESS while a reconnect is in flight: the remove half of a reconnect is
    // coalesced with its paired add into ONE snapshot pushed on connectiondrop (D-03).
    if (this.reconnectInFlight) this.reconnectDidWriteBack = true;else this.pushHistory();
    const g = this.baseGraph();
    this.commitGraph({
      ...g,
      connections: (g.connections || []).filter((e: any) => e && e.id !== id)
    });
  };
  clearEdgeSelection = () => {
    if (this.selectedPathEl && this.selectedPathEl.classList) {
      try {
        this.selectedPathEl.classList.remove('is-selected');
      } catch (e: any) {}
    }
    this.selectedConnId = null;
    this.selectedPathEl = null;
  };
  selectEdge = (id: any, pathEl: any) => {
    if (id == null) return;
    this.clearEdgeSelection();
    this.selectedConnId = id;
    this.selectedPathEl = pathEl;
    if (pathEl && pathEl.classList) {
      try {
        pathEl.classList.add('is-selected');
      } catch (e: any) {}
    }
    this.edgeClickGuard = true;
    Promise.resolve().then(() => {
      this.edgeClickGuard = false;
    });
    this.edgeClick.emit({
      id
    });
    this.edgeSelected.emit({
      id
    });
  };
  deleteNode = (id: any) => {
    if (id == null) return false;
    const g = this.baseGraph();
    const sid = String(id);
    const nodes = (g.nodes || []).filter((n: any) => n && String(n.id) !== sid);
    if (nodes.length === (g.nodes || []).length) return false;
    const connections = (g.connections || []).filter((c: any) => c && String(c.source) !== sid && String(c.target) !== sid);
    // T1.3 — one history entry per DELETE gesture (node + its incident edges = ONE undo).
    this.pushHistory();
    this.commitGraph({
      ...g,
      nodes,
      connections
    });
    return true;
  };
  freshNodeId = (baseId: any, existing: any) => {
    const taken = new Set((existing || []).map((n: any) => n && n.id != null ? String(n.id) : ''));
    const root = baseId != null ? String(baseId) : 'node';
    let i = 1;
    let candidate = root + '-copy';
    while (taken.has(candidate)) {
      i++;
      candidate = root + '-copy-' + i;
    }
    return candidate;
  };
  duplicateNode = (id: any) => {
    if (id == null) return null;
    const g = this.baseGraph();
    const sid = String(id);
    const src = (g.nodes || []).find((n: any) => n && String(n.id) === sid);
    if (!src) return null;
    const newId = this.freshNodeId(src.id, g.nodes);
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
    this.pushHistory();
    this.commitGraph({
      ...g,
      nodes: [...(g.nodes || []), clone]
    });
    return newId;
  };
  selectedNodeIds = () => {
    if (!this.selector || !this.selector.entities) return [];
    const ids = [];
    for (const e of this.selector.entities.values() as any) {
      if (e && e.id != null) ids.push(e.id);
    }
    return ids;
  };
  maybeEmitSelectionChange = () => {
    if (this.programmatic) return;
    const ids = this.selectedNodeIds();
    const key = [...ids].map((x: any) => String(x)).sort().join(' ');
    if (key === this.lastSelectionIds) return;
    this.lastSelectionIds = key;
    this.selectionChange.emit({
      ids
    });
    // the selected set changed → repaint the minimap (selected nodes are highlighted).
    if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
    // T2.8 — the selection changed → re-track the NodeToolbar (it follows the single
    // selected node; hides on multi-select / empty selection). No-op when :node-toolbar off.
    if (this.syncToolbarSelection) this.syncToolbarSelection();
  };
  scheduleSelectionEmit = () => {
    Promise.resolve().then(this.maybeEmitSelectionChange);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(this.maybeEmitSelectionChange);
    } else {
      Promise.resolve().then(() => Promise.resolve().then(this.maybeEmitSelectionChange));
    }
  };
  reconcileNodes: any = null;
  reconcileConnections: any = null;
  reconcileNodesRunning = false;
  reconcileNodesPending = false;
  serializeConn = (c: any) => ({
    id: c.id,
    source: c.source,
    sourceOutput: c.sourceOutput,
    target: c.target,
    targetInput: c.targetInput
  });
  portSchemaForType = (type: any, portReg: any) => {
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
  buildNode = (spec: any, portReg: any) => {
    const label = spec.data && spec.data.label != null ? String(spec.data.label) : '';
    const node = new ClassicPreset.Node(label);
    node.id = spec.id;
    const {
      inputs,
      outputs
    } = this.portSchemaForType(spec.type, portReg);
    for (const inp of inputs as any) {
      if (!inp || inp.key == null) continue;
      node.addInput(inp.key, new ClassicPreset.Input(this.SOCKET, inp.label, inp.multiple === true));
    }
    for (const out of outputs as any) {
      if (!out || out.key == null) continue;
      node.addOutput(out.key, new ClassicPreset.Output(this.SOCKET, out.label, out.multiple !== false));
    }
    return node;
  };
  getEditor = () => {
    return this.editor;
  };
  getArea = () => {
    return this.area;
  };
  addNode = async (spec: any) => {
    if (!this.editor || !spec || spec.id == null) return null;
    const node = this.buildNode(spec, this.portReg());
    this.nodeInstances.set(spec.id, node);
    this.nodeMeta.set(spec.id, spec);
    this.programmatic++;
    try {
      await this.editor.addNode(node);
      await this.area.translate(spec.id, {
        x: spec.x || 0,
        y: spec.y || 0
      });
    } finally {
      this.programmatic--;
    }
    return spec.id;
  };
  removeNode = async (id: any) => {
    if (!this.editor || id == null || !this.nodeInstances.has(id)) return false;
    this.programmatic++;
    try {
      for (const c of this.editor.getConnections() as any) {
        if (c.source === id || c.target === id) await this.editor.removeConnection(c.id);
      }
      await this.editor.removeNode(id);
    } finally {
      this.programmatic--;
    }
    this.nodeInstances.delete(id);
    this.nodeMeta.delete(id);
    return true;
  };
  addConnection = async (spec: any) => {
    if (!this.editor || !spec || spec.source == null || spec.target == null) return null;
    const srcOut = spec.sourceOutput != null ? spec.sourceOutput : 'out';
    const tgtIn = spec.targetInput != null ? spec.targetInput : 'in';
    const sourceNode = this.nodeInstances.get(spec.source);
    const targetNode = this.nodeInstances.get(spec.target);
    if (!sourceNode || !targetNode) return null;
    const conn = new ClassicPreset.Connection(sourceNode, srcOut, targetNode, tgtIn);
    if (spec.id != null) conn.id = spec.id;
    this.programmatic++;
    try {
      await this.editor.addConnection(conn);
    } finally {
      this.programmatic--;
    }
    this.connInstances.set(conn.id, conn);
    return conn.id;
  };
  removeConnection = async (id: any) => {
    if (!this.editor || id == null) return false;
    this.programmatic++;
    try {
      await this.editor.removeConnection(id);
    } finally {
      this.programmatic--;
    }
    this.connInstances.delete(id);
    return true;
  };
  clear = async () => {
    if (!this.editor) return;
    this.programmatic++;
    try {
      await this.editor.clear();
    } finally {
      this.programmatic--;
    }
    this.nodeInstances.clear();
    this.nodeMeta.clear();
    this.connInstances.clear();
    this.connMeta.clear();
    this.lastPropNodeIds = [];
    this.lastPropConnIds = [];
  };
  zoomToFit = async () => {
    if (!this.area || !this.editor) return;
    this.programmatic++;
    try {
      await AreaExtensions.zoomAt(this.area, this.editor.getNodes());
    } finally {
      this.programmatic--;
    }
    const k = this.area.area.transform.k;
    if (k !== this.zoom()) this.zoom.set(k);
  };
  zoomTo = async (k: any) => {
    if (!this.area || typeof k !== 'number') return;
    this.programmatic++;
    try {
      await this.area.area.zoom(k);
    } finally {
      this.programmatic--;
    }
    if (k !== this.zoom()) this.zoom.set(k);
  };
  setViewport = async (vp: any) => {
    if (!this.area || !vp || typeof vp !== 'object') return;
    const tf = this.area.area.transform;
    const k = typeof vp.k === 'number' ? vp.k : tf.k;
    const x = typeof vp.x === 'number' ? vp.x : tf.x;
    const y = typeof vp.y === 'number' ? vp.y : tf.y;
    this.programmatic++;
    try {
      if (k !== this.area.area.transform.k) await this.area.area.zoom(k);
      await this.area.area.translate(x, y);
    } finally {
      this.programmatic--;
    }
    if (k !== this.zoom()) this.zoom.set(k);
  };
  setCenter = async (x: any, y: any, opts: any) => {
    if (!this.area || typeof x !== 'number' || typeof y !== 'number') return;
    const k = opts && typeof opts.zoom === 'number' ? opts.zoom : this.area.area.transform.k;
    const el = this.area.container;
    const cw = el && el.clientWidth ? el.clientWidth : 0;
    const ch = el && el.clientHeight ? el.clientHeight : 0;
    const tx = cw / 2 - x * k;
    const ty = ch / 2 - y * k;
    this.programmatic++;
    try {
      if (k !== this.area.area.transform.k) await this.area.area.zoom(k);
      await this.area.area.translate(tx, ty);
    } finally {
      this.programmatic--;
    }
    if (k !== this.zoom()) this.zoom.set(k);
  };
  ZOOM_STEP = 1.2;
  clampZoom = (k: any) => {
    const __minZoom = this.minZoom();
    const __maxZoom = this.maxZoom();
    let lo = typeof __minZoom === 'number' && __minZoom > 0 ? __minZoom : 0.01;
    let hi = typeof __maxZoom === 'number' && __maxZoom > 0 ? __maxZoom : 100;
    if (k < lo) return lo;
    if (k > hi) return hi;
    return k;
  };
  controlZoomIn = () => {
    if (!this.area) return;
    this.zoomTo(this.clampZoom(this.area.area.transform.k * this.ZOOM_STEP));
  };
  controlZoomOut = () => {
    if (!this.area) return;
    this.zoomTo(this.clampZoom(this.area.area.transform.k / this.ZOOM_STEP));
  };
  controlFit = () => {
    this.zoomToFit();
  };
  toggleMode = () => {
    this.mode.set(this.mode() === 'select' ? 'pan' : 'select');
  };
  getNodes = () => {
    if (!this.area) return [];
    const out = [];
    for (const [id, node] of this.nodeInstances as any) {
      const view = this.area.nodeViews.get(id);
      out.push({
        id,
        label: node.label,
        x: view ? view.position.x : 0,
        y: view ? view.position.y : 0
      });
    }
    return out;
  };
  getConnections = () => {
    return this.editor ? this.editor.getConnections().map(this.serializeConn) : [];
  };
  getTransform = () => {
    return this.area ? {
      x: this.area.area.transform.x,
      y: this.area.area.transform.y,
      k: this.area.area.transform.k
    } : null;
  };
  screenToFlowPosition = (clientX: any, clientY: any) => {
    if (!this.area || typeof clientX !== 'number' || typeof clientY !== 'number') return null;
    const el = this.area.container;
    const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
    if (!rect) return null;
    const t = this.area.area.transform;
    const k = t.k || 1;
    return {
      x: (clientX - rect.left - t.x) / k,
      y: (clientY - rect.top - t.y) / k
    };
  };
  autoArrange = async (opts: any) => {
    if (!this.arrange || !this.area) return;
    // Set elkjs dimensions on every live node instance from its measured node-view element
    // (Pitfall 3) — without dims the classic preset stacks all nodes at (0,0).
    for (const [id, node] of this.nodeInstances as any) {
      const view = this.area.nodeViews ? this.area.nodeViews.get(id) : null;
      const el = view && view.element ? view.element : null;
      node.width = el && el.offsetWidth ? el.offsetWidth : this.MINIMAP_DEFAULT_NODE_W;
      node.height = el && el.offsetHeight ? el.offsetHeight : this.MINIMAP_DEFAULT_NODE_H;
    }
    // ONE history entry for the arrange gesture, captured BEFORE the write (pushHistory reads
    // lastWrittenGraph, still the pre-arrange state). Gated on !programmatic + history.
    this.pushHistory();
    this.programmatic++;
    try {
      await this.arrange.layout(opts && opts.options ? {
        options: opts.options
      } : undefined);
    } finally {
      this.programmatic--;
    }
    // Read the arranged positions back into a FRESH graph object (controlled-graph contract).
    // Echo-guarded: commitGraph → $model.graph re-bind must not re-enter the reconcile as a new
    // gesture. (The arrange already moved the engine to these coords, so the reconcile is a
    // no-op diff; the guard is belt-and-braces + suppresses any history re-entry.)
    this.programmatic++;
    try {
      const g = this.baseGraph();
      const nodes = (g.nodes || []).map((n: any) => {
        const v = n && n.id != null && this.area.nodeViews ? this.area.nodeViews.get(n.id) : null;
        return v && v.position ? {
          ...n,
          x: v.position.x,
          y: v.position.y
        } : n;
      });
      this.commitGraph({
        ...g,
        nodes
      });
    } finally {
      this.programmatic--;
    }
  };
  getSelectedNodes = () => {
    const sel = new Set(this.selectedNodeIds().map((x: any) => String(x)));
    return this.getNodes().filter((n: any) => sel.has(String(n.id)));
  };
  selectNode = (id: any, accumulate: any) => {
    if (!this.nodeSelectApi || id == null) return;
    this.nodeSelectApi.select(id, !!accumulate);
    this.scheduleSelectionEmit();
  };
  clearSelection = () => {
    if (this.nodeSelectApi) {
      for (const id of this.selectedNodeIds() as any) this.nodeSelectApi.unselect(id);
    }
    this.clearEdgeSelection();
    this.scheduleSelectionEmit();
  };
  selectAll = () => {
    if (!this.nodeSelectApi) return;
    let first = true;
    for (const n of this.getNodes() as any) {
      this.nodeSelectApi.select(n.id, !first);
      first = false;
    }
    this.scheduleSelectionEmit();
  };
  centerOnNode = async (id: any, opts: any) => {
    if (!this.area || id == null) return;
    const view = this.area.nodeViews ? this.area.nodeViews.get(id) : null;
    if (!view || !view.position) return;
    const el = view.element;
    const w = el && el.offsetWidth ? el.offsetWidth : this.MINIMAP_DEFAULT_NODE_W;
    const h = el && el.offsetHeight ? el.offsetHeight : this.MINIMAP_DEFAULT_NODE_H;
    await this.setCenter(view.position.x + w / 2, view.position.y + h / 2, opts);
  };

  static ngTemplateContextGuard(
    _dir: FlowCanvas,
    _ctx: unknown,
  ): _ctx is NodeCtx | ToolbarCtx | DefaultCtx {
    return true;
  }

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default FlowCanvas;
