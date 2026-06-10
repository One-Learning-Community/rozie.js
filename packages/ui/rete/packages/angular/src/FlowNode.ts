import { Component, ContentChild, DestroyRef, EmbeddedViewRef, InjectionToken, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface BodyCtx {
  $implicit: { id: any; label: any };
  id: any;
  label: any;
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
  selector: 'rozie-flow-node',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `




    <div class="rozie-flow-node-children" style="display:none"><ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" /></div>
    <ng-container #rozie_portalAnchor></ng-container>
  `,
  providers: [
    {
      provide: rozieToken('rete:node'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => FlowNode)); return ({
  get id() {
    return __rozieCtxHost.id();
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (__rozieCtxHost.cv) __rozieCtxHost.cv.addPort(__rozieCtxHost.id(), side, key, label, multiple);
  }
}); },
    },
  ],
})
export class FlowNode {
  id = input.required<string>();
  x = input<number>(0);
  y = input<number>(0);
  label = input<unknown>(undefined);
  @ContentChild('body', { read: TemplateRef }) bodyTpl?: TemplateRef<BodyCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _bodyTpl = contentChild('body', { read: TemplateRef });
  canvas = inject(rozieToken('rete:canvas'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;

  constructor() {
    this.cv = this.canvas;

    // The live $portals.body handle ({ dispose }) returned by the parent-invoked
    // renderBody callback. Module-scope `any` so the teardown — which the Solid emitter
    // hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose it.
    effect(() => () => {
      if (this.registered) return;
      const live = this.canvas;
      if (live == null) return;
      this.cv = live;
      this.registered = true;
      this.cv.register(this.id(), this.buildSpec());
    });
    effect(() => { const __watchVal = (() => this.x())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (this.cv) this.cv.update(this.id(), this.buildSpec());
    })(); }); });
    effect(() => { const __watchVal = (() => this.y())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      if (this.cv) this.cv.update(this.id(), this.buildSpec());
    })(); }); });
    effect(() => { const __watchVal = (() => this.label())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      if (this.cv) this.cv.update(this.id(), this.buildSpec());
    })(); }); });
  }

  ngAfterViewInit() {
    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      body: (container: HTMLElement, scope: { id: unknown; label: unknown }): ReactivePortalHandle => {
        const tpl = this._bodyTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-body', '23c15996');
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
    // prior handle first so a re-fired renderBody (e.g. ports changed → fresh node
    // build) does not stack portal roots into the same engine host.
    this.mountBody = (host: any) => {
      if (!host) return;
      if (this.bodyHandle && this.bodyHandle.dispose) {
        try {
          this.bodyHandle.dispose();
        } catch (e: any) {}
      }
      this.bodyHandle = portals.body(host, {
        id: this.id(),
        label: this.label()
      });
    };
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — at which point
    // the FlowNode mounts its own body portal into the engine `body` host.
    // On Lit the injected canvas may still be undefined here (REQ-30 async context);
    // the $onUpdate below performs the registration once the value arrives.
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — at which point
    // the FlowNode mounts its own body portal into the engine `body` host.
    // On Lit the injected canvas may still be undefined here (REQ-30 async context);
    // the $onUpdate below performs the registration once the value arrives.
    if (this.cv && !this.registered) {
      this.registered = true;
      this.cv.register(this.id(), this.buildSpec());
    }
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.bodyHandle && this.bodyHandle.dispose) {
        try {
          this.bodyHandle.dispose();
        } catch (e: any) {}
      }
      if (this.cv) this.cv.unregister(this.id());
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
    id: this.id(),
    x: this.x(),
    y: this.y(),
    label: this.label(),
    inputs: [],
    outputs: [],
    // D-04 render-callback: the parent hands the engine body host; delegate to the
    // mountBody closure (defined inside $onMount so it can see the emitter's mount-
    // scoped `portals` local). Until $onMount has run, mountBody is null — but the
    // parent only invokes renderBody AFTER reconcileNodes (post-register, post-mount),
    // so mountBody is always set by then.
    renderBody: (host: any) => {
      // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html
      // "cannot find node" when re-rendering into an engine-owned host that the area
      // re-created) can NEVER abort the parent's reconcileNodes loop — a thrown
      // renderBody would propagate out of area.update/addNode and stop the whole graph
      // from building (cfg renders, the declarative nodes don't). The body simply
      // re-mounts on the next reconcile tick if a single attempt fails.
      if (host && this.mountBody) {
        try {
          this.mountBody(host);
        } catch (e: any) {}
      }
    }
  });

  static ngTemplateContextGuard(
    _dir: FlowNode,
    _ctx: unknown,
  ): _ctx is BodyCtx | DefaultCtx {
    return true;
  }
}

export default FlowNode;
