import { Component, ContentChild, DestroyRef, EmbeddedViewRef, InjectionToken, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface BodyCtx {
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
  selector: 'rozie-node-type',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `




    <div class="rozie-node-type-children" style="display:none"><ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" /></div>
    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [`
    :host(rozie-node-type) { display: contents; }
  `],
  providers: [
    {
      provide: rozieToken('rete:nodeType'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => NodeType)); return ({
  get type() {
    return __rozieCtxHost.type();
  },
  addPort: (side: any, key: any, portType: any, label: any, multiple: any, position: any) => {
    if (__rozieCtxHost.cv) __rozieCtxHost.cv.addTypePort(__rozieCtxHost.type(), side, key, portType, label, multiple, position);
  }
}); },
    },
  ],
})
export class NodeType {
  /**
   * The node TYPE id (required). Every graph node whose `type` matches renders this template and uses this type's `<Port>` schema. There is no id/x/y here — this is a render-by-type TEMPLATE, not an instance; instance identity and position live in the bound `graph` model.
   * @example
   * <NodeType type="source"><template #body="{ node }">{{ node.data.label }}</template></NodeType>
   */
  type = input.required<string>();
  /**
   * Opt this node TYPE into corner-handle resizing (default OFF). When true, selecting a node of this type shows 4 corner drag handles (the React Flow <NodeResizer/> parity); dragging one persists an explicit node.width/node.height (a fixed box, D-07) that overrides auto-sizing for that node instance. A double-click on a handle resets the node back to auto-size.
   */
  resizable = input<boolean>(false);
  /**
   * Minimum width (px) a resize gesture may shrink this type to. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minWidth = input<(number) | null>(null);
  /**
   * Minimum height (px) a resize gesture may shrink this type to. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minHeight = input<(number) | null>(null);
  /**
   * Maximum width (px) a resize gesture may grow this type to. Unset = unbounded growth.
   */
  maxWidth = input<(number) | null>(null);
  /**
   * Maximum height (px) a resize gesture may grow this type to. Unset = unbounded growth.
   */
  maxHeight = input<(number) | null>(null);
  @ContentChild('body', { read: TemplateRef }) bodyTpl?: TemplateRef<BodyCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _bodyTpl = contentChild('body', { read: TemplateRef });
  canvas = inject(rozieToken('rete:canvas'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;

  constructor() {
    this.cv = this.canvas;

    // The live $portals.body handle ({ dispose }) returned by the parent-invoked
    // bodyRenderer callback. Module-scope `any` so the teardown — which the Solid
    // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose
    // it. (A NodeType type-template projects ONE body root per graph node; the canvas
    // disposes per-node on node unmount, this is the last-projection handle.)
    //
    // PER-NODE FIX: a Set of INDEPENDENT handles — ONE PER GRAPH NODE of this type.
    // render-by-type calls bodyRenderer once per node a->b->c; the old single-handle
    // form disposed the PRIOR node's body on each call, leaving only the LAST node of
    // the type rendered (3 nodes, 1 body — the count-only-VR-masking bug). Each call now
    // mounts an INDEPENDENT handle and disposes NONE of its siblings; the canvas already
    // owns per-node disposal (entry.bodyHandle in nodeEntries, torn down on node unmount).
    // Module-scope `any` so the Solid-hoisted teardown can sweep any leftovers. This is
    // the controlled-graph analog of FlowCanvas's per-node $portals.node handle map.
    this.bodyHandles = new Set();

    // The body-mount closure, DEFINED INSIDE $onMount (below) so it captures the
    // emitter-synthesized `portals` local — which on React/Angular/Lit is scoped to the
    // mount effect body, NOT visible from a spec callback the canvas invokes later (that
    // escaped scope is exactly why a bare `$portals.body(...)` in the bodyRenderer
    // threw "portals is not defined" on those 3 targets). Stored in a module-scope `any`
    // so the spec's bodyRenderer — invoked by the canvas's renderNode from its own
    // render scope — can delegate to it. ZERO emitter change (just correct scoping).
    effect(() => () => {
      if (this.registered) return;
      const live = this.canvas;
      if (live == null) return;
      this.cv = live;
      this.registered = true;
      this.cv.registerType(this.type(), this.buildSpec());
    });
    effect(() => { const __watchVal = (() => this.type())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (this.cv) this.cv.registerType(this.type(), this.buildSpec());
    })(); }); });
  }

  ngAfterViewInit() {
    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      body: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
        const tpl = this._bodyTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-body', '372f9492');
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
    // The body-mount closure — captures the mount-scoped `portals` local. Mounts an
    // INDEPENDENT body root PER graph node (the canvas calls this once per node of the
    // type), so every instance keeps its OWN #body — it must NOT dispose any sibling's
    // handle (the bug: a single shared handle torn down on each call left only the LAST
    // node rendered). The returned { dispose } is wrapped to deregister ITSELF from the
    // live set when the canvas disposes that node's projection (entry.bodyHandle on node
    // unmount / port-resync); a leftover handle is swept by the component teardown below.
    this.mountBody = (host: any, scope: any) => {
      if (!host) return null;
      const s = scope || {};
      const h = portals.body(host, {
        node: s.node,
        selected: s.selected,
        emit: s.emit
      });
      if (!h) return null;
      this.bodyHandles.add(h);
      return {
        update: (next: any) => {
          if (h && h.update) {
            try {
              return h.update(next);
            } catch (e: any) {}
          }
        },
        dispose: () => {
          this.bodyHandles.delete(h);
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
      };
    };
    // register this TYPE's spec INCLUDING the bodyRenderer callback. The canvas's
    // renderNode resolves typeReg[node.type].bodyRenderer for every graph node of this
    // type and projects the body into the engine host. On Lit the injected canvas may
    // still be undefined here (REQ-30 async context); the $onUpdate below performs the
    // registration once the value arrives.
    // register this TYPE's spec INCLUDING the bodyRenderer callback. The canvas's
    // renderNode resolves typeReg[node.type].bodyRenderer for every graph node of this
    // type and projects the body into the engine host. On Lit the injected canvas may
    // still be undefined here (REQ-30 async context); the $onUpdate below performs the
    // registration once the value arrives.
    if (this.cv && !this.registered) {
      this.registered = true;
      this.cv.registerType(this.type(), this.buildSpec());
    }
    this.__rozieDestroyRef.onDestroy(() => {
      // sweep any body projections still live at teardown (the canvas normally disposes
      // each per node unmount, but a component-level unmount must clean any stragglers).
      if (this.bodyHandles) {
        for (const h of this.bodyHandles as any) {
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
        this.bodyHandles.clear();
      }
      if (this.cv) this.cv.unregisterType(this.type());
    });
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
  }

  cv: any = null;
  bodyHandles: any = null;
  mountBody: any = null;
  registered = false;
  buildSpec = () => ({
    type: this.type(),
    // RENDER-BY-TYPE callback: the canvas hands the engine body host + scope; delegate
    // to the mountBody closure (defined inside $onMount so it can see the emitter's
    // mount-scoped `portals` local). Until $onMount has run, mountBody is null — but
    // the canvas only invokes bodyRenderer AFTER reconcileNodes (post-register,
    // post-mount), so mountBody is always set by then. Returns the { dispose } handle.
    bodyRenderer: (host: any, scope: any) => {
      // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html "cannot
      // find node" when re-rendering into an engine-owned host the area re-created)
      // can NEVER abort the canvas's renderNode loop — a thrown bodyRenderer would
      // propagate out of area.update/addNode and stop the whole graph from building.
      if (host && this.mountBody) {
        try {
          return this.mountBody(host, scope);
        } catch (e: any) {}
      }
      return null;
    },
    // NodeResizer (D-14/D-17): carried into the canvas's typeReg registry so
    // renderNode/the resize gesture can read resizable/min/max for this type.
    resizable: this.resizable(),
    minWidth: this.minWidth(),
    minHeight: this.minHeight(),
    maxWidth: this.maxWidth(),
    maxHeight: this.maxHeight()
  });

  static ngTemplateContextGuard(
    _dir: NodeType,
    _ctx: unknown,
  ): _ctx is BodyCtx | DefaultCtx {
    return true;
  }
}

export default NodeType;
