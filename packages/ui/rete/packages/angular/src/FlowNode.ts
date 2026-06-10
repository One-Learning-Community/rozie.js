import { Component, ContentChild, DestroyRef, ElementRef, InjectionToken, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

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


    <div class="rozie-flow-node-host" #__rozieRoot #rozieSpread_0 #rozieListenersTarget_1><ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" /></div>

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
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  canvas = inject(rozieToken('rete:canvas'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;

  constructor() {
    this.cv = this.canvas;

    // The FlowNode's own host element, captured at mount ($el only safe in $onMount,
    // ROZ123). The parent-invoked renderBody closure appends THIS into the engine
    // `body` host — moving the host preserves Lit shadow projection of the slot body.
    // Module-scope `any` so it survives into the parent's later render-scope call.
    effect(() => () => {
      if (this.registered) return;
      const live = this.canvas;
      if (live == null) return;
      this.cv = live;
      this.registered = true;
      this.cv.register(this.id(), this.buildSpec());
    });
    effect(() => { const __watchVal = (() => this.x())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      const __id = this.id();
      if (this.cv) this.cv.update(__id, {
        id: __id,
        x: this.x(),
        y: this.y(),
        label: this.label(),
        renderBody: (host: any) => {
          if (host && this.hostEl) host.appendChild(this.hostEl);
        }
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.y())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      const __id = this.id();
      if (this.cv) this.cv.update(__id, {
        id: __id,
        x: this.x(),
        y: this.y(),
        label: this.label(),
        renderBody: (host: any) => {
          if (host && this.hostEl) host.appendChild(this.hostEl);
        }
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.label())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      const __id = this.id();
      if (this.cv) this.cv.update(__id, {
        id: __id,
        x: this.x(),
        y: this.y(),
        label: this.label(),
        renderBody: (host: any) => {
          if (host && this.hostEl) host.appendChild(this.hostEl);
        }
      });
    })(); }); });
  }

  ngAfterViewInit() {
    this.hostEl = this.__rozieRoot()?.nativeElement;
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — projecting
    // this FlowNode's body into the engine element from the PARENT's render scope.
    // On Lit the injected canvas may still be undefined here (REQ-30 async context);
    // the $watch below performs the registration once the value arrives.
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — projecting
    // this FlowNode's body into the engine element from the PARENT's render scope.
    // On Lit the injected canvas may still be undefined here (REQ-30 async context);
    // the $watch below performs the registration once the value arrives.
    if (this.cv && !this.registered) {
      this.registered = true;
      this.cv.register(this.id(), this.buildSpec());
    }
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.cv) this.cv.unregister(this.id());
    });
  }

  cv: any = null;
  hostEl: any = null;
  registered = false;
  buildSpec = () => ({
    id: this.id(),
    x: this.x(),
    y: this.y(),
    label: this.label(),
    inputs: [],
    outputs: [],
    // D-04 render-callback: the parent calls this with the engine body host div.
    renderBody: (host: any) => {
      if (host && this.hostEl) host.appendChild(this.hostEl);
    }
  });

  static ngTemplateContextGuard(
    _dir: FlowNode,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });
}

export default FlowNode;
