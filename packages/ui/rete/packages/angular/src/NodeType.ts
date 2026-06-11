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
  providers: [
    {
      provide: rozieToken('rete:nodeType'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => NodeType)); return ({
  get type() {
    return __rozieCtxHost.type();
  },
  addPort: (side: any, key: any, portType: any, label: any, multiple: any) => {
    if (__rozieCtxHost.cv) __rozieCtxHost.cv.addTypePort(__rozieCtxHost.type(), side, key, portType, label, multiple);
  }
}); },
    },
  ],
})
export class NodeType {
  type = input.required<string>();
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
    // The body-mount closure — captures the mount-scoped `portals` local. Disposes a
    // prior handle first so a re-fired bodyRenderer (e.g. ports changed → fresh node
    // build) does not stack portal roots into the same engine host. Mounts the type's
    // `#body` slot, scoped with the graph node ({ node, selected, emit }).
    this.mountBody = (host: any, scope: any) => {
      if (!host) return null;
      if (this.bodyHandle && this.bodyHandle.dispose) {
        try {
          this.bodyHandle.dispose();
        } catch (e: any) {}
      }
      const s = scope || {};
      this.bodyHandle = portals.body(host, {
        node: s.node,
        selected: s.selected,
        emit: s.emit
      });
      return this.bodyHandle;
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
      if (this.bodyHandle && this.bodyHandle.dispose) {
        try {
          this.bodyHandle.dispose();
        } catch (e: any) {}
      }
      if (this.cv) this.cv.unregisterType(this.type());
    });
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
  }

  cv: any = null;
  bodyHandle: any = null;
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
    }
  });

  static ngTemplateContextGuard(
    _dir: NodeType,
    _ctx: unknown,
  ): _ctx is BodyCtx | DefaultCtx {
    return true;
  }
}

export default NodeType;
