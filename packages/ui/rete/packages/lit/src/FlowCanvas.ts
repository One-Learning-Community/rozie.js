import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { adoptDocumentStyles, createLitControllableProperty, injectGlobalStyles } from '@rozie/runtime-lit';
import { ContextProvider, createContext } from '@lit/context';
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

const __rozieCtx_rete_canvas = createContext(Symbol.for("rozie:rete:canvas"));

interface RozieNodeSlotCtx {
  node: unknown;
  selected: unknown;
  emit: unknown;
}

@customElement('rozie-flow-canvas')
export default class FlowCanvas extends SignalWatcher(LitElement) {
  static styles = css`
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
`;

  @property({ type: Array }) nodes: any[] = [];
  @property({ type: Array }) connections: any[] = [];
  @property({ type: Number, attribute: 'zoom' }) _zoom_attr: number = 1;
  private _zoomControllable = createLitControllableProperty<number>({ host: this, eventName: 'zoom-change', defaultValue: 1, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) pannable: boolean = true;
  @property({ type: Boolean, reflect: true }) zoomable: boolean = true;
  @property({ type: Boolean, reflect: true }) selectable: boolean = true;
  @property({ type: Boolean, reflect: true }) readonly: boolean = false;
  @property({ type: Number, reflect: true }) minZoom: number = 0.1;
  @property({ type: Number, reflect: true }) maxZoom: number = 4;
  @property({ type: Number, reflect: true }) snapGrid: number = 0;
  @property({ type: Boolean, reflect: true }) accumulateOnCtrl: boolean = true;
  @property({ type: Number, reflect: true }) curvature: number = 0.3;
  @property({ type: Boolean, reflect: true }) fitOnMount: boolean = true;
  @property({ type: Function }) canConnect: ((...args: unknown[]) => unknown) | null = null;
  private _nodeReg = signal({});
  private _connReg = signal({});
  private _portReg = signal({});
  @query('[data-rozie-ref="canvasEl"]') private _refCanvasEl!: HTMLElement;
private __rozieWatchInitial_2 = true;
private __rozieWatchInitial_3 = true;
private __rozieWatchInitial_4 = true;
private __rozieWatchInitial_5 = true;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();
private __rozieCtxProvider_rete_canvas = new ContextProvider(this, { context: __rozieCtx_rete_canvas, initialValue: ((__rozieCtxHost) => ({
  register: (id: any, spec: any) => {
    __rozieCtxHost._nodeReg.value = {
      ...__rozieCtxHost._nodeReg.value,
      [id]: spec
    };
  },
  update: (id: any, spec: any) => {
    __rozieCtxHost._nodeReg.value = {
      ...__rozieCtxHost._nodeReg.value,
      [id]: spec
    };
  },
  unregister: (id: any) => {
    const n = {
      ...__rozieCtxHost._nodeReg.value
    };
    delete n[id];
    __rozieCtxHost._nodeReg.value = n;
  },
  registerConnection: (id: any, spec: any) => {
    __rozieCtxHost._connReg.value = {
      ...__rozieCtxHost._connReg.value,
      [id]: spec
    };
  },
  unregisterConnection: (id: any) => {
    const c = {
      ...__rozieCtxHost._connReg.value
    };
    delete c[id];
    __rozieCtxHost._connReg.value = c;
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
    __rozieCtxHost._portReg.value = {
      ...__rozieCtxHost._portReg.value,
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
    const entry = __rozieCtxHost.nodeEntries.get(id);
    return entry ? entry.body : null;
  }
}))(this) });

  @state() private _hasSlotNode = false;
  @queryAssignedElements({ slot: 'node', flatten: true }) private _slotNodeElements!: Element[];
  @property({ attribute: false }) node?: (scope: { node: unknown; selected: unknown; emit: unknown }) => unknown;
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="node"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotNode = this._slotNodeElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotNode = Array.from(this.children).some((el) => el.getAttribute('slot') === 'node');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    adoptDocumentStyles(this);

    this._armListeners();

    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      node: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
        const tpl = this.node;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-node', 'cd396d6a');
        const renderScope = (s: { node: unknown; selected: unknown; emit: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { node: unknown; selected: unknown; emit: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
    };

    this._disconnectCleanups.push((() => {
      for (const [, entry] of this.nodeEntries as any) {
        if (entry.handle) entry.handle.dispose();
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
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._nodeReg.value)(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      if (this.reconcileNodes) {
        Promise.resolve(this.reconcileNodes()).then(() => {
          if (this.reconcileConnections) this.reconcileConnections();
        });
      }
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._connReg.value)(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } (() => {
      if (this.reconcileConnections) this.reconcileConnections();
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._portReg.value)(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } (() => {
      if (this.reconcileNodes) {
        Promise.resolve(this.reconcileNodes()).then(() => {
          if (this.reconcileConnections) this.reconcileConnections();
        });
      }
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.zoom)(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => {
      if (!this.area || typeof v !== 'number') return;
      if (v === this.area.area.transform.k) return;
      this.programmatic++;
      Promise.resolve(this.area.area.zoom(v)).finally(() => {
        this.programmatic--;
      });
    })(__watchVal); }); }));

    this._disconnectCleanups.push(effect(() => { void this._nodeReg.value; void this._connReg.value; void this._portReg.value; this.__rozieCtxProvider_rete_canvas.setValue(((__rozieCtxHost) => ({
      register: (id: any, spec: any) => {
        __rozieCtxHost._nodeReg.value = {
          ...__rozieCtxHost._nodeReg.value,
          [id]: spec
        };
      },
      update: (id: any, spec: any) => {
        __rozieCtxHost._nodeReg.value = {
          ...__rozieCtxHost._nodeReg.value,
          [id]: spec
        };
      },
      unregister: (id: any) => {
        const n = {
          ...__rozieCtxHost._nodeReg.value
        };
        delete n[id];
        __rozieCtxHost._nodeReg.value = n;
      },
      registerConnection: (id: any, spec: any) => {
        __rozieCtxHost._connReg.value = {
          ...__rozieCtxHost._connReg.value,
          [id]: spec
        };
      },
      unregisterConnection: (id: any) => {
        const c = {
          ...__rozieCtxHost._connReg.value
        };
        delete c[id];
        __rozieCtxHost._connReg.value = c;
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
        __rozieCtxHost._portReg.value = {
          ...__rozieCtxHost._portReg.value,
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
        const entry = __rozieCtxHost.nodeEntries.get(id);
        return entry ? entry.body : null;
      }
    }))(this)); }));

    const container = this._refCanvasEl;
    this.lastPropNodeIds = [];
    this.lastPropConnIds = [];
    this.lastRegistryNodeIds = [];
    this.lastRegistryConnIds = [];
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
    if (this.selectable && !this.readonly) {
      this.selector = AreaExtensions.selector();
      AreaExtensions.selectableNodes(this.area, this.selector, {
        accumulating: this.accumulateOnCtrl ? AreaExtensions.accumulateOnCtrl() : {
          active: () => false
        }
      });
    }
    // raise the picked node above its siblings.
    // raise the picked node above its siblings.
    AreaExtensions.simpleNodesOrder(this.area);

    // ── zoom clamp (restrictor) ──
    // ── zoom clamp (restrictor) ──
    const min = typeof this.minZoom === 'number' && this.minZoom > 0 ? this.minZoom : 0;
    const max = typeof this.maxZoom === 'number' && this.maxZoom > 0 ? this.maxZoom : 0;
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
    if (typeof this.snapGrid === 'number' && this.snapGrid > 0) {
      AreaExtensions.snapGrid(this.area, {
        size: this.snapGrid,
        dynamic: true
      });
    }

    // ── interaction toggles ──
    // ── interaction toggles ──
    if (!this.pannable) this.area.area.setDragHandler(null);
    if (!this.zoomable) this.area.area.setZoomHandler(null);

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
        label: reteNode.label
      };
      const existing = this.nodeEntries.get(id);
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
      const emit = (name: any, detail: any) => this.dispatchEvent(new CustomEvent("node-action", {
        detail: {
          id,
          name,
          detail
        },
        bubbles: true,
        composed: true
      }));
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
        this.nodeEntries.set(id, entry);
        meta.renderBody(body);
        entry.bodyMoved = true;
        return;
      }
      if (this.node !== undefined) {
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
      const curvature = typeof this.curvature === 'number' ? this.curvature : 0.3;
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

    // ─── connection-validation gate (D2/D3) ────────────────────────────────────
    // Cancels Rete's cancellable `connectioncreate` pre-event when $props.canConnect
    // returns false. The falsy emit result makes editor.addConnection return false
    // WITHOUT pushing the connection or emitting `connectioncreated` — so no ghost
    // edge is drawn and no `connection-created` fires. Gates drag-to-connect,
    // imperative addConnection, and config-array reconcile uniformly (all three route
    // through editor.addConnection). $props.canConnect is read LIVE at gate time (not
    // captured at mount) so a reactive prop change takes effect on the next attempt.
    // Registered before the connectioncreated-forwarding pipe so it halts the chain
    // earlier (order is not load-bearing — cancelling connectioncreate short-circuits
    // addConnection before connectioncreated is ever emitted).
    // ─── connection-validation gate (D2/D3) ────────────────────────────────────
    // Cancels Rete's cancellable `connectioncreate` pre-event when $props.canConnect
    // returns false. The falsy emit result makes editor.addConnection return false
    // WITHOUT pushing the connection or emitting `connectioncreated` — so no ghost
    // edge is drawn and no `connection-created` fires. Gates drag-to-connect,
    // imperative addConnection, and config-array reconcile uniformly (all three route
    // through editor.addConnection). $props.canConnect is read LIVE at gate time (not
    // captured at mount) so a reactive prop change takes effect on the next attempt.
    // Registered before the connectioncreated-forwarding pipe so it halts the chain
    // earlier (order is not load-bearing — cancelling connectioncreate short-circuits
    // addConnection before connectioncreated is ever emitted).
    this.editor.addPipe((context: any) => {
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
        if (typeof this.canConnect === 'function' && this.canConnect(conn) === false) {
          // Echo-guard the EMIT only (mirrors connection-created/connection-removed) so a
          // programmatic reconcile that the rule would reject doesn't surface as a
          // user-facing rejection. The block (return undefined) stays UNCONDITIONAL so the
          // rule is enforced on every path.
          if (!this.programmatic) this.dispatchEvent(new CustomEvent("connection-rejected", {
            detail: conn,
            bubbles: true,
            composed: true
          }));
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
        // connection (auto id) must register here or the next props pass re-adds it.
        this.connInstances.set(context.data.id, context.data);
        if (!this.programmatic) this.dispatchEvent(new CustomEvent("connection-created", {
          detail: this.serializeConn(context.data),
          bubbles: true,
          composed: true
        }));
      } else if (context.type === 'connectionremoved') {
        this.connInstances.delete(context.data.id);
        if (!this.programmatic) this.dispatchEvent(new CustomEvent("connection-removed", {
          detail: {
            id: context.data.id
          },
          bubbles: true,
          composed: true
        }));
      }
      return context;
    });
    this.area.addPipe((context: any) => {
      if (!context || typeof context !== 'object' || !('type' in context)) return context;
      if (context.type === 'nodepicked') {
        this.dispatchEvent(new CustomEvent("node-picked", {
          detail: {
            id: context.data.id
          },
          bubbles: true,
          composed: true
        }));
      } else if (context.type === 'nodetranslated') {
        if (!this.programmatic) {
          const id = context.data.id;
          const pos = context.data.position;
          const meta = this.nodeMeta.get(id);
          if (meta) {
            meta.x = pos.x;
            meta.y = pos.y;
          }
          this.dispatchEvent(new CustomEvent("node-moved", {
            detail: {
              id,
              x: pos.x,
              y: pos.y
            },
            bubbles: true,
            composed: true
          }));
        }
      } else if (context.type === 'translated') {
        this.dispatchEvent(new CustomEvent("translated", {
          detail: {
            x: context.data.position.x,
            y: context.data.position.y
          },
          bubbles: true,
          composed: true
        }));
      } else if (context.type === 'zoomed') {
        if (!this.programmatic) {
          const k = this.area.area.transform.k;
          if (k !== this.zoom) this._zoomControllable.write(k);
        }
      } else if (context.type === 'contextmenu') {
        // suppress the native browser menu over the canvas; surface a hook instead.
        context.data.event.preventDefault();
        const ctx = context.data.context;
        this.dispatchEvent(new CustomEvent("context-menu", {
          detail: {
            id: ctx && ctx.id ? ctx.id : null
          },
          bubbles: true,
          composed: true
        }));
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
      if (!this.editor || !this.area) return;
      const propArr = Array.isArray(this.nodes) ? this.nodes : [];
      const {
        merged,
        regIds
      } = mergeById(propArr, this._nodeReg.value);
      const regWant = new Set(regIds);
      const propWant = [];
      const want = [];
      this.programmatic++;
      try {
        for (const rawSpec of merged as any) {
          if (!rawSpec || rawSpec.id == null) continue;
          // Merge the declarative <Handle> ports (portReg) into this node's spec on
          // EVERY run — order-independent: whether the node or its ports registered
          // last, the reconcile triggered by either sees both (D37 mount-order fix).
          const spec = this.mergePortsIntoSpec(rawSpec, this._portReg.value);
          want.push(spec.id);
          if (!regWant.has(spec.id)) propWant.push(spec.id);
          this.nodeMeta.set(spec.id, spec);
          let node = this.nodeInstances.get(spec.id);
          if (!node) {
            node = this.buildNode(spec);
            this.nodeInstances.set(spec.id, node);
            await this.editor.addNode(node);
            await this.area.translate(spec.id, {
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
              // D-04 body host is re-projected by renderBody (appendChild re-moves the
              // same host element — idempotent).
              const entry = this.nodeEntries.get(spec.id);
              if (entry) {
                if (entry.handle) entry.handle.dispose();
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
        // remove dropped PROP-managed OR REGISTRY-managed nodes (+ their connections)
        // — imperatively added nodes (in NEITHER provenance set) survive.
        const tracked = new Set([...this.lastPropNodeIds, ...this.lastRegistryNodeIds]);
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
        this.lastPropNodeIds = propWant;
        this.lastRegistryNodeIds = regIds;
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
      if (!this.editor) return;
      const propArr = Array.isArray(this.connections) ? this.connections : [];
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
      for (const k in this._connReg.value) {
        const n = norm(this._connReg.value[k]);
        if (n) normReg[k] = n;
      }
      const {
        merged,
        regIds
      } = mergeById(normProps, normReg);
      const regWant = new Set(regIds);
      const propWant = [];
      const want = [];
      this.programmatic++;
      try {
        for (const spec of merged as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          if (!regWant.has(spec.id)) propWant.push(spec.id);
          if (this.connInstances.has(spec.id)) continue;
          const sourceNode = this.nodeInstances.get(spec.source);
          const targetNode = this.nodeInstances.get(spec.target);
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
          this.connInstances.set(spec.id, conn);
          await this.editor.addConnection(conn);
        }
        const tracked = new Set([...this.lastPropConnIds, ...this.lastRegistryConnIds]);
        for (const id of tracked as any) {
          if (!want.includes(id) && this.connInstances.has(id)) {
            await this.editor.removeConnection(id);
            this.connInstances.delete(id);
          }
        }
        this.lastPropConnIds = propWant;
        this.lastRegistryConnIds = regIds;
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
      if (typeof this.zoom === 'number' && this.zoom !== 1) {
        this.programmatic++;
        try {
          await this.area.area.zoom(this.zoom);
        } finally {
          this.programmatic--;
        }
      }
      if (this.fitOnMount && this.editor.getNodes().length) {
        this.programmatic++;
        try {
          await AreaExtensions.zoomAt(this.area, this.editor.getNodes());
        } finally {
          this.programmatic--;
        }
        if (this.area) {
          const k = this.area.area.transform.k;
          if (k !== this.zoom) this._zoomControllable.write(k);
        }
      }
    })();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('nodes'))) { const __watchVal = (() => this.nodes)(); (() => {
      if (this.reconcileNodes) this.reconcileNodes();
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('connections'))) { const __watchVal = (() => this.connections)(); (() => {
      if (this.reconcileConnections) this.reconcileConnections();
    })(); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const container of this._portalContainers) render(nothing, container);
      this._portalContainers.clear();
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'zoom') this._zoomControllable.notifyAttributeChange(value === null ? 1 : Number(value));
  }

  render() {
    return html`
<div class="rozie-flow-canvas" data-rozie-ref="canvasEl" data-rozie-s-cd396d6a></div>

<slot name="node"></slot>

<slot></slot>
`;
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

  lastRegistryNodeIds: any = null;

  lastRegistryConnIds: any = null;

  programmatic = 0;

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

  buildNode = (spec: any) => {
  const node = new ClassicPreset.Node(spec.label != null ? String(spec.label) : '');
  node.id = spec.id;
  const inputs = Array.isArray(spec.inputs) ? spec.inputs : [];
  const outputs = Array.isArray(spec.outputs) ? spec.outputs : [];
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

  mergePortsIntoSpec = (spec: any, portMap: any) => {
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

  getEditor() {
    return this.editor;
  }

  getArea() {
    return this.area;
  }

  async addNode(spec: any) {
    if (!this.editor || !spec || spec.id == null) return null;
    const node = this.buildNode(spec);
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
  }

  async removeNode(id: any) {
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
  }

  async addConnection(spec: any) {
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
  }

  async removeConnection(id: any) {
    if (!this.editor || id == null) return false;
    this.programmatic++;
    try {
      await this.editor.removeConnection(id);
    } finally {
      this.programmatic--;
    }
    this.connInstances.delete(id);
    return true;
  }

  async clear() {
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
  }

  async zoomToFit() {
    if (!this.area || !this.editor) return;
    this.programmatic++;
    try {
      await AreaExtensions.zoomAt(this.area, this.editor.getNodes());
    } finally {
      this.programmatic--;
    }
    const k = this.area.area.transform.k;
    if (k !== this.zoom) this._zoomControllable.write(k);
  }

  async zoomTo(k: any) {
    if (!this.area || typeof k !== 'number') return;
    this.programmatic++;
    try {
      await this.area.area.zoom(k);
    } finally {
      this.programmatic--;
    }
    if (k !== this.zoom) this._zoomControllable.write(k);
  }

  getNodes() {
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
  }

  getConnections() {
    return this.editor ? this.editor.getConnections().map(this.serializeConn) : [];
  }

  getTransform() {
    return this.area ? {
      x: this.area.area.transform.x,
      y: this.area.area.transform.y,
      k: this.area.area.transform.k
    } : null;
  }

  get zoom(): number { return this._zoomControllable.read(); }
  set zoom(v: number) { this._zoomControllable.notifyPropertyWrite(v); }
}

injectGlobalStyles('rozie-flow-canvas-global', `
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
`);
