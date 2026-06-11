import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, InjectionToken, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

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

interface NodeCtx {
  $implicit: { node: any; selected: any; emit: any };
  node: any;
  selected: any;
  emit: any;
}

interface DefaultCtx {}

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
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-flow-canvas" #canvasEl></div>



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
      border-radius: 8px;
      background:
        radial-gradient(circle, rgba(0, 0, 0, 0.08) 1px, transparent 1px) 0 0 / 20px 20px,
        #f7f8fa;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    ::ng-deep .rozie-flow-canvas .rozie-flow-node {
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
    ::ng-deep .rozie-flow-canvas .rozie-flow-node.is-selected {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 2px 8px rgba(0, 0, 0, 0.15);
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-node__title {
        padding: 0.5rem 0.75rem;
        font-weight: 600;
        color: #1f2937;
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
        color: #6b7280;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-port--output { justify-content: flex-end; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #94a3b8;
        border: 2px solid #ffffff;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
        cursor: crosshair;
        flex: none;
      }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket--input { margin-left: -6px; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket--output { margin-right: -6px; }
    ::ng-deep .rozie-flow-canvas .rozie-flow-socket:hover { background: #3b82f6; }
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
        stroke: #64748b;
        stroke-width: 3px;
        pointer-events: auto;
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
  addTypePort: (type: any, side: any, key: any, portType: any, label: any, multiple: any) => {
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
    const entry = __rozieCtxHost.nodeEntries.get(nodeId);
    return entry ? entry.body : null;
  }
}); },
    },
  ],
})
export class FlowCanvas {
  graph = model<Record<string, any>>((() => ({
    nodes: [],
    connections: []
  }))());
  validateTypes = input<boolean>(true);
  zoom = model<number>(1);
  pannable = input<boolean>(true);
  zoomable = input<boolean>(true);
  selectable = input<boolean>(true);
  readonly = input<boolean>(false);
  minZoom = input<number>(0.1);
  maxZoom = input<number>(4);
  snapGrid = input<number>(0);
  accumulateOnCtrl = input<boolean>(true);
  curvature = input<number>(0.3);
  fitOnMount = input<boolean>(true);
  canConnect = input<((...args: unknown[]) => unknown) | null>(null);
  typeReg = signal({});
  portReg = signal({});
  canvasEl = viewChild<ElementRef<HTMLDivElement>>('canvasEl');
  nodeAction = output<unknown>({ alias: 'node-action' });
  connectionRejected = output<unknown>({ alias: 'connection-rejected' });
  connectionCreated = output<unknown>({ alias: 'connection-created' });
  connectionRemoved = output<unknown>({ alias: 'connection-removed' });
  nodePicked = output<unknown>({ alias: 'node-picked' });
  nodeMoved = output<unknown>({ alias: 'node-moved' });
  translated = output<unknown>();
  contextMenu = output<unknown>({ alias: 'context-menu' });
  @ContentChild('node', { read: TemplateRef }) nodeTpl?: TemplateRef<NodeCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _nodeTpl = contentChild('node', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.graph())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (this.reconcileNodes) {
        Promise.resolve(this.reconcileNodes()).then(() => {
          if (this.reconcileConnections) this.reconcileConnections();
        });
      }
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
        for (const node of view.rootNodes as Node[]) container.appendChild(node);
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
    const __minZoom = this.minZoom();
    const __maxZoom = this.maxZoom();
    const __snapGrid = this.snapGrid();
    const container = this.canvasEl()?.nativeElement;
    this.lastPropNodeIds = [];
    this.lastPropConnIds = [];
    this.editor = new NodeEditor();
    this.area = new AreaPlugin(container);
    this.connectionPlugin = new ConnectionPlugin();
    this.connectionPlugin.addPreset(ConnectionPresets.classic.setup());
    // DOM-based socket position watcher — feeds connection-path redraw + the
    // ConnectionPlugin's drag-to-connect hit-testing.
    // DOM-based socket position watcher — feeds connection-path redraw + the
    // ConnectionPlugin's drag-to-connect hit-testing.
    this.socketWatcher = getDOMSocketPosition();
    this.editor.use(this.area);
    this.area.use(this.connectionPlugin);
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

    // ── selection (selectableNodes) ──
    // ── selection (selectableNodes) ──
    if (this.selectable() && !this.readonly()) {
      this.selector = AreaExtensions.selector();
      AreaExtensions.selectableNodes(this.area, this.selector, {
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

    // Render one column of sockets and, crucially, EMIT a socket render signal per
    // socket so the ConnectionPlugin + position watcher register it.
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
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'rozie-flow-connection__path');
      svg.appendChild(path);
      element.appendChild(svg);
      let start: any = null;
      let end: any = null;
      const curvature = typeof __curvature === 'number' ? __curvature : 0.3;
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
          const srcType = this.portTypeOf(c.source, 'output', c.sourceOutput);
          const tgtType = this.portTypeOf(c.target, 'input', c.targetInput);
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
      } else if (context.type === 'nodetranslated') {
        if (!this.programmatic) {
          const id = context.data.id;
          const pos = context.data.position;
          const meta = this.nodeMeta.get(id);
          if (meta) {
            meta.x = pos.x;
            meta.y = pos.y;
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
      } else if (context.type === 'translated') {
        this.translated.emit({
          x: context.data.position.x,
          y: context.data.position.y
        });
      } else if (context.type === 'zoomed') {
        if (!this.programmatic) {
          const k = this.area.area.transform.k;
          if (k !== this.zoom()) this.zoom.set(k);
        }
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
      this.programmatic++;
      try {
        for (const spec of merged as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          if (this.connInstances.has(spec.id)) continue;
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
          await this.editor.addConnection(conn);
        }
        // remove dropped GRAPH-managed edges — imperatively added edges survive.
        const tracked = new Set(this.lastPropConnIds);
        for (const id of tracked as any) {
          if (!want.includes(id) && this.connInstances.has(id)) {
            await this.editor.removeConnection(id);
            this.connInstances.delete(id);
          }
        }
        this.lastPropConnIds = want;
      } finally {
        this.programmatic--;
      }
    }

    // ─── initial graph: nodes first, then connections (connections reference live
    // node instances), then optional fit. Sequenced via an async IIFE so the
    // $onMount-returned teardown stays synchronous. ──────────────────────────────
    ;
    (async () => {
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
    })();
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.dragFlushRaf && typeof cancelAnimationFrame === 'function') {
        try {
          cancelAnimationFrame(this.dragFlushRaf);
        } catch (e: any) {}
      }
      this.dragFlushRaf = 0;
      this.pendingDragPositions.clear();
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
  SOCKET = new ClassicPreset.Socket('flow');
  nodeInstances = new Map();
  nodeMeta = new Map();
  connInstances = new Map();
  nodeEntries = new Map();
  connEntries = new Map();
  lastPropNodeIds: any = null;
  lastPropConnIds: any = null;
  programmatic = 0;
  pendingDragPositions = new Map();
  dragFlushRaf = 0;
  currentGraph = () => this.graph() || {
    nodes: [],
    connections: []
  };
  flushDragWriteBack = () => {
    this.dragFlushRaf = 0;
    if (this.programmatic) {
      this.pendingDragPositions.clear();
      return;
    }
    if (this.pendingDragPositions.size === 0) return;
    const g = this.currentGraph();
    const nodes = (g.nodes || []).map((n: any) => {
      const p = n && n.id != null ? this.pendingDragPositions.get(n.id) : null;
      return p ? {
        ...n,
        x: p.x,
        y: p.y
      } : n;
    });
    this.pendingDragPositions.clear();
    this.graph.set({
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
    const g = this.currentGraph();
    const conn = {
      id: c.id,
      source: c.source,
      sourceOutput: c.sourceOutput,
      target: c.target,
      targetInput: c.targetInput
    };
    this.graph.set({
      ...g,
      connections: [...(g.connections || []), conn]
    });
  };
  writeBackConnectionRemoved = (id: any) => {
    if (this.programmatic) return;
    const g = this.currentGraph();
    this.graph.set({
      ...g,
      connections: (g.connections || []).filter((e: any) => e && e.id !== id)
    });
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
  portTypeOf = (nodeId: any, side: any, key: any) => {
    const meta = this.nodeMeta.get(nodeId);
    if (!meta || meta.type == null || key == null) return null;
    const entry = this.portReg()[meta.type + '::' + side + '::' + key];
    return entry ? entry.portType : null;
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

  static ngTemplateContextGuard(
    _dir: FlowCanvas,
    _ctx: unknown,
  ): _ctx is NodeCtx | DefaultCtx {
    return true;
  }
}

export default FlowCanvas;
