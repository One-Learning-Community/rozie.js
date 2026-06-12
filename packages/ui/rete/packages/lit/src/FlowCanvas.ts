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
.rozie-flow-controls[data-rozie-s-cd396d6a] {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
}
.rozie-flow-controls__btn[data-rozie-s-cd396d6a] {
  pointer-events: auto;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font: 600 16px/1 system-ui, sans-serif;
  color: #334155;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
  cursor: pointer;
  user-select: none;
}
.rozie-flow-controls__btn[data-rozie-s-cd396d6a]:hover { background: #f1f5f9; }
.rozie-flow-controls__btn[data-rozie-s-cd396d6a]:active { background: #e2e8f0; }
.rozie-flow-minimap[data-rozie-s-cd396d6a] {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 10;
  width: 200px;
  height: 150px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
  overflow: hidden;
  cursor: pointer;
  touch-action: none;
}
.rozie-flow-minimap__svg[data-rozie-s-cd396d6a] { display: block; width: 100%; height: 100%; }
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

  @property({ type: Object, attribute: 'graph' }) _graph_attr: any = {
  nodes: [],
  connections: []
};
  private _graphControllable = createLitControllableProperty<any>({ host: this, eventName: 'graph-change', defaultValue: {
  nodes: [],
  connections: []
}, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) validateTypes: boolean = true;
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
  @property({ type: Boolean, reflect: true }) controls: boolean = true;
  @property({ type: Boolean, reflect: true }) minimap: boolean = false;
  @property({ type: Function }) canConnect: ((...args: unknown[]) => unknown) | null = null;
  private _typeReg = signal({});
  private _portReg = signal({});
  @query('[data-rozie-ref="canvasEl"]') private _refCanvasEl!: HTMLElement;
  @query('[data-rozie-ref="minimapEl"]') private _refMinimapEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieWatchInitial_1 = true;
private __rozieWatchInitial_2 = true;
private __rozieWatchInitial_3 = true;
private _portalContainers = new Set<HTMLElement>();
private __rozieCtxProvider_rete_canvas = new ContextProvider(this, { context: __rozieCtx_rete_canvas, initialValue: ((__rozieCtxHost) => ({
  // Register/replace a node TYPE template. `spec` carries an optional
  // `bodyRenderer(host, { node })` — the render-by-type projection (mounted per graph
  // node of this type into the engine body host, see renderNode). Whole-object replace.
  registerType: (type: any, spec: any) => {
    if (type != null) __rozieCtxHost._typeReg.value = {
      ...__rozieCtxHost._typeReg.value,
      [type]: spec
    };
  },
  // Drop a type on <NodeType> unmount (whole-object replace).
  unregisterType: (type: any) => {
    const t = {
      ...__rozieCtxHost._typeReg.value
    };
    delete t[type];
    __rozieCtxHost._typeReg.value = t;
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
    __rozieCtxHost._portReg.value = {
      ...__rozieCtxHost._portReg.value,
      [portKey]: {
        type,
        side,
        key,
        portType,
        label,
        multiple
      }
    };
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
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.graph)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (this.reconcileNodes) {
        Promise.resolve(this.reconcileNodes()).then(() => {
          if (this.reconcileConnections) this.reconcileConnections();
        });
      }
      // graph changed (nodes added/removed/moved) → refresh the minimap node rects.
      if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._portReg.value)(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      if (this.reconcileNodes) {
        Promise.resolve(this.reconcileNodes()).then(() => {
          if (this.reconcileConnections) this.reconcileConnections();
        });
      }
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._typeReg.value)(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      if (this.reconcileNodes) this.reconcileNodes();
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.zoom)(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (!this.area || typeof v !== 'number') return;
      if (v === this.area.area.transform.k) return;
      this.programmatic++;
      Promise.resolve(this.area.area.zoom(v)).finally(() => {
        this.programmatic--;
      });
    })(__watchVal); }); }));

    this._disconnectCleanups.push(effect(() => { void this._typeReg.value; void this._portReg.value; this.__rozieCtxProvider_rete_canvas.setValue(((__rozieCtxHost) => ({
      // Register/replace a node TYPE template. `spec` carries an optional
      // `bodyRenderer(host, { node })` — the render-by-type projection (mounted per graph
      // node of this type into the engine body host, see renderNode). Whole-object replace.
      registerType: (type: any, spec: any) => {
        if (type != null) __rozieCtxHost._typeReg.value = {
          ...__rozieCtxHost._typeReg.value,
          [type]: spec
        };
      },
      // Drop a type on <NodeType> unmount (whole-object replace).
      unregisterType: (type: any) => {
        const t = {
          ...__rozieCtxHost._typeReg.value
        };
        delete t[type];
        __rozieCtxHost._typeReg.value = t;
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
        __rozieCtxHost._portReg.value = {
          ...__rozieCtxHost._portReg.value,
          [portKey]: {
            type,
            side,
            key,
            portType,
            label,
            multiple
          }
        };
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
    }))(this)); }));

    const container = this._refCanvasEl;
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
    if (this.selectable && !this.readonly && container && typeof container.addEventListener === 'function') {
      this.onCanvasKeydown = (e: any) => {
        if (!e || e.key !== 'Delete' && e.key !== 'Backspace') return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        const ids = this.selectedNodeIds();
        if (ids.length === 0) return;
        e.preventDefault();
        for (const id of ids as any) this.deleteNode(id);
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
      const typeSpec = meta.type != null ? this._typeReg.value[meta.type] : null;
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
      if (this.node !== undefined) {
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
      // keeps a constant pixel size under the area zoom transform. Inline fill (#64748b,
      // matching the connection stroke) is the cross-target-safe choice — no scoped-CSS /
      // :root rule needed for the marker DOM. The marker is purely decorative — it does
      // NOT touch the path `d` / socket alignment (the rete-flow-align cell stays green).
      const markerId = 'rozie-arrow-' + String(id);
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', markerId);
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '6');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerUnits', 'userSpaceOnUse');
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrow.setAttribute('class', 'rozie-flow-connection__arrow');
      arrow.setAttribute('d', 'M0,0 L6,3 L0,6 Z');
      arrow.setAttribute('fill', '#64748b');
      marker.appendChild(arrow);
      defs.appendChild(marker);
      svg.appendChild(defs);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'rozie-flow-connection__path');
      path.setAttribute('marker-end', 'url(#' + markerId + ')');
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
      const entry = this._portReg.value[meta.type + '::' + side + '::' + key];
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
        if (this.validateTypes !== false) {
          const srcType = portTypeOf(c.source, 'output', c.sourceOutput);
          const tgtType = portTypeOf(c.target, 'input', c.targetInput);
          if (srcType != null && tgtType != null && srcType !== tgtType) {
            if (!this.programmatic) this.dispatchEvent(new CustomEvent("connection-rejected", {
              detail: conn,
              bubbles: true,
              composed: true
            }));
            return undefined; // ← CANCEL: type mismatch
          }
        }
        // 2. canConnect OVERRIDE (Phase-40 contract — custom rule, in addition).
        if (typeof this.canConnect === 'function' && this.canConnect(conn) === false) {
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
        // connection (auto id) must register here or the next graph pass re-adds it.
        this.connInstances.set(context.data.id, context.data);
        if (!this.programmatic) {
          // WRITE-BACK: append the new connection into a fresh graph object (D4).
          this.writeBackConnectionCreated(context.data);
          // keep the discrete event too (back-compat).
          this.dispatchEvent(new CustomEvent("connection-created", {
            detail: this.serializeConn(context.data),
            bubbles: true,
            composed: true
          }));
        }
      } else if (context.type === 'connectionremoved') {
        this.connInstances.delete(context.data.id);
        if (!this.programmatic) {
          // WRITE-BACK: filter the removed connection out of a fresh graph object (D4).
          this.writeBackConnectionRemoved(context.data.id);
          this.dispatchEvent(new CustomEvent("connection-removed", {
            detail: {
              id: context.data.id
            },
            bubbles: true,
            composed: true
          }));
        }
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
        // a node moved → its minimap rect moves (works during a programmatic translate too).
        if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
      } else if (context.type === 'translated') {
        this.dispatchEvent(new CustomEvent("translated", {
          detail: {
            x: context.data.position.x,
            y: context.data.position.y
          },
          bubbles: true,
          composed: true
        }));
        // the viewport window moved → redraw the minimap viewport rect + mask.
        if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
      } else if (context.type === 'zoomed') {
        if (!this.programmatic) {
          const k = this.area.area.transform.k;
          if (k !== this.zoom) this._zoomControllable.write(k);
        }
        // the viewport window resized (zoom) → redraw the minimap viewport rect + mask.
        if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
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
      if (!this.editor || !this.area) return;
      const graphNodes = Array.isArray(this.graph && this.graph.nodes) ? this.graph.nodes : [];
      const want = [];
      this.programmatic++;
      try {
        for (const spec of graphNodes as any) {
          if (!spec || spec.id == null) continue;
          want.push(spec.id);
          this.nodeMeta.set(spec.id, spec);
          let node = this.nodeInstances.get(spec.id);
          if (!node) {
            node = this.buildNode(spec, this._portReg.value);
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
            } = this.portSchemaForType(spec.type, this._portReg.value);
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
      if (!this.editor) return;
      // Edges come ONLY from the bound graph's `connections` (the single source of
      // truth — declarative <Connection> children are gone). Normalize id-defaulting
      // (a connection authored without an id gets a stable derived id) so an edge the
      // canvas wrote back (carrying the engine id) and a hand-authored edge dedup.
      const graphConns = Array.isArray(this.graph && this.graph.connections) ? this.graph.connections : [];
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
      if (!this.minimap || !this.minimapSvg || !this.area || !container) return;
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
        const fill = r.selected ? '#3b82f6' : '#94a3b8';
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
      mask.setAttribute('fill', 'rgba(15, 23, 42, 0.18)');
      mask.setAttribute('d', 'M0 0 H' + this.MINIMAP_W + ' V' + this.MINIMAP_H + ' H0 Z ' + 'M' + mvx + ' ' + mvy + ' h' + mvw + ' v' + mvh + ' h' + -mvw + ' Z');
      this.minimapSvg.appendChild(mask);
      this.minimapSvg.appendChild(mkMinimapRect(mvx, mvy, mvw, mvh, 'rozie-flow-minimap__viewport', 'none', '#3b82f6', 1.5));
    };

    // rAF-coalesced scheduler (bridged to the top-level $watch + the engine pipes). No-op
    // when :minimap is off (the bridge stays callable everywhere, cheap).
    // rAF-coalesced scheduler (bridged to the top-level $watch + the engine pipes). No-op
    // when :minimap is off (the bridge stays callable everywhere, cheap).
    this.scheduleMinimapRedraw = () => {
      if (!this.minimap || this.minimapRedrawRaf) return;
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
    if (this.minimap && this._refMinimapEl) {
      this.minimapHost = this._refMinimapEl;
      this.minimapSvg = document.createElementNS(this.SVGNS, 'svg');
      this.minimapSvg.setAttribute('class', 'rozie-flow-minimap__svg');
      this.minimapSvg.setAttribute('viewBox', '0 0 ' + this.MINIMAP_W + ' ' + this.MINIMAP_H);
      this.minimapSvg.setAttribute('preserveAspectRatio', 'none');
      this.minimapHost.appendChild(this.minimapSvg);
      this.onMinimapPointerDown = (e: any) => {
        if (!this.pannable) return;
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
        if (!this.minimapPanning || !this.pannable) return;
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

    // ─── initial graph: nodes first, then connections (connections reference live
    // node instances), then optional fit. Sequenced via an async IIFE so the
    // $onMount-returned teardown stays synchronous. ──────────────────────────────
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
      // draw the minimap once the graph + fit have settled (also redrawn on every
      // render / pan / zoom / drag / selection / graph change below).
      if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
    })();
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
    if (name === 'graph') this._graphControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'zoom') this._zoomControllable.notifyAttributeChange(value === null ? 1 : Number(value));
  }

  render() {
    return html`
<div class="rozie-flow-canvas" tabindex="0" data-rozie-ref="canvasEl" data-rozie-s-cd396d6a>
  
  ${this.controls ? html`<div class="rozie-flow-controls" data-rozie-s-cd396d6a>
    <button class="rozie-flow-controls__btn" type="button" data-testid="flow-zoom-in" aria-label="Zoom in" @click=${this.controlZoomIn} data-rozie-s-cd396d6a>+</button>
    <button class="rozie-flow-controls__btn" type="button" data-testid="flow-zoom-out" aria-label="Zoom out" @click=${this.controlZoomOut} data-rozie-s-cd396d6a>&#8722;</button>
    <button class="rozie-flow-controls__btn" type="button" data-testid="flow-fit" aria-label="Fit view" @click=${this.controlFit} data-rozie-s-cd396d6a>&#9744;</button>
  </div>` : nothing}${this.minimap ? html`<div class="rozie-flow-minimap" data-testid="flow-minimap" data-rozie-ref="minimapEl" data-rozie-s-cd396d6a></div>` : nothing}</div>

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

  lastPropNodeIds: any = null;

  lastPropConnIds: any = null;

  programmatic = 0;

  lastSelectionIds: any = null;

  pendingDragPositions = new Map();

  dragFlushRaf = 0;

  currentGraph = () => this.graph || {
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
  this._graphControllable.write({
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
  this._graphControllable.write({
    ...g,
    connections: [...(g.connections || []), conn]
  });
};

  writeBackConnectionRemoved = (id: any) => {
  if (this.programmatic) return;
  const g = this.currentGraph();
  this._graphControllable.write({
    ...g,
    connections: (g.connections || []).filter((e: any) => e && e.id !== id)
  });
};

  deleteNode = (id: any) => {
  if (id == null) return false;
  const g = this.currentGraph();
  const sid = String(id);
  const nodes = (g.nodes || []).filter((n: any) => n && String(n.id) !== sid);
  if (nodes.length === (g.nodes || []).length) return false;
  const connections = (g.connections || []).filter((c: any) => c && String(c.source) !== sid && String(c.target) !== sid);
  this._graphControllable.write({
    ...g,
    nodes,
    connections
  });
  return true;
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
  const key = [...ids].map((x: any) => String(x)).sort().join(' ');
  if (key === this.lastSelectionIds) return;
  this.lastSelectionIds = key;
  this.dispatchEvent(new CustomEvent("selection-change", {
    detail: {
      ids
    },
    bubbles: true,
    composed: true
  }));
  // the selected set changed → repaint the minimap (selected nodes are highlighted).
  if (this.scheduleMinimapRedraw) this.scheduleMinimapRedraw();
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

  getEditor() {
    return this.editor;
  }

  getArea() {
    return this.area;
  }

  async addNode(spec: any) {
    if (!this.editor || !spec || spec.id == null) return null;
    const node = this.buildNode(spec, this._portReg.value);
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

  async setViewport(vp: any) {
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
    if (k !== this.zoom) this._zoomControllable.write(k);
  }

  async setCenter(x: any, y: any, opts: any) {
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
    if (k !== this.zoom) this._zoomControllable.write(k);
  }

  ZOOM_STEP = 1.2;

  clampZoom = (k: any) => {
  let lo = typeof this.minZoom === 'number' && this.minZoom > 0 ? this.minZoom : 0.01;
  let hi = typeof this.maxZoom === 'number' && this.maxZoom > 0 ? this.maxZoom : 100;
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

  get graph(): any { return this._graphControllable.read(); }
  set graph(v: any) { this._graphControllable.notifyPropertyWrite(v); }
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
