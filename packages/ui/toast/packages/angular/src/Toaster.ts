import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, inject, input, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

interface ToastCtx {
  $implicit: { toast: any; dismiss: any };
  toast: any;
  dismiss: any;
}

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

@Component({
  selector: 'rozie-toaster',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-toaster" [ngClass]="'rozie-toaster--' + position()" role="region" [attr.aria-label]="rozieAttr(regionLabel())" #rozieSpread_0 (mouseenter)="onMouseEnter()" (mouseleave)="onMouseLeave()" #rozieListenersTarget_1>
      @for (toast of toasts(); track toast.id) {
    <div class="rozie-toast" [ngClass]="'rozie-toast--' + toast.type" role="status" [attr.aria-live]="rozieAttr(liveFor(toast.type))">
        @if ((toastTpl ?? templates()?.['toast'])) {
    <ng-container *ngTemplateOutlet="(toastTpl ?? templates()?.['toast']); context: { $implicit: { toast: toast, dismiss: dismiss }, toast: toast, dismiss: dismiss }" />
    } @else {

          <span class="rozie-toast-message">{{ rozieDisplay(toast.message) }}</span>
          <button type="button" class="rozie-toast-close" aria-label="Dismiss" (click)="dismiss(toast.id)">×</button>
        
    }
      </div>
    }
    </div>

  `,
  styles: [`
    .rozie-toaster {
      position: fixed;
      z-index: var(--rozie-toast-z, 9999);
      display: flex;
      flex-direction: column;
      gap: var(--rozie-toast-gap, 0.5rem);
      padding: var(--rozie-toast-region-padding, 1rem);
      max-width: var(--rozie-toast-max-width, calc(100vw - 2rem));
      pointer-events: none;
      font: var(--rozie-toast-font, inherit);
    }
    .rozie-toaster > * {
      pointer-events: auto;
    }
    .rozie-toaster--top-left { top: 0; left: 0; align-items: flex-start; }
    .rozie-toaster--top-right { top: 0; right: 0; align-items: flex-end; }
    .rozie-toaster--top-center { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
    .rozie-toaster--bottom-left { bottom: 0; left: 0; align-items: flex-start; flex-direction: column-reverse; }
    .rozie-toaster--bottom-right { bottom: 0; right: 0; align-items: flex-end; flex-direction: column-reverse; }
    .rozie-toaster--bottom-center { bottom: 0; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column-reverse; }
    .rozie-toast {
      display: flex;
      align-items: center;
      gap: var(--rozie-toast-content-gap, 0.75rem);
      min-width: var(--rozie-toast-min-width, 16rem);
      max-width: var(--rozie-toast-toast-max-width, 24rem);
      padding: var(--rozie-toast-padding, 0.75rem 1rem);
      color: var(--rozie-toast-color, #fff);
      background: var(--rozie-toast-bg, #333);
      border-radius: var(--rozie-toast-radius, 0.5rem);
      box-shadow: var(--rozie-toast-shadow, 0 6px 20px rgba(0, 0, 0, 0.25));
    }
    .rozie-toast--success { background: var(--rozie-toast-success-bg, #16a34a); }
    .rozie-toast--error { background: var(--rozie-toast-error-bg, #dc2626); }
    .rozie-toast--warning { background: var(--rozie-toast-warning-bg, #ca8a04); }
    .rozie-toast--info { background: var(--rozie-toast-info-bg, var(--rozie-toast-bg, #333)); }
    .rozie-toast-message {
      flex: 1 1 auto;
      font-size: var(--rozie-toast-font-size, 0.9rem);
    }
    .rozie-toast-close {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--rozie-toast-close-size, 1.25rem);
      height: var(--rozie-toast-close-size, 1.25rem);
      padding: 0;
      font-size: 1.1rem;
      line-height: 1;
      color: inherit;
      background: transparent;
      border: none;
      border-radius: 0.25rem;
      opacity: var(--rozie-toast-close-opacity, 0.75);
      cursor: pointer;
    }
    .rozie-toast-close:hover {
      opacity: 1;
    }
  `],
})
export class Toaster {
  position = input<string>('bottom-right');
  duration = input<number>(4000);
  max = input<number>(0);
  disablePauseOnHover = input<boolean>(false);
  ariaLabel = input<(string) | null>(null);
  toasts = signal<any[]>([]);
  seq = signal(0);
  @ContentChild('toast', { read: TemplateRef }) toastTpl?: TemplateRef<ToastCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.pauseTimers();
    });
  }

  timers = {};
  startTimer = (toast: any) => {
    if (!toast || !toast.duration || toast.duration <= 0) return;
    if (typeof window === 'undefined') return;
    this.timers[toast.id] = window.setTimeout(() => this.dismiss(toast.id), toast.duration);
  };
  clearTimer = (id: any) => {
    if (this.timers[id] && typeof window !== 'undefined') window.clearTimeout(this.timers[id]);
    delete this.timers[id];
  };
  pauseTimers = () => {
    if (typeof window === 'undefined') return;
    for (const k in this.timers) window.clearTimeout(this.timers[k]);
    this.timers = {};
  };
  show = (input: any) => {
    const t = input || {};
    // Derive the id from the reactive $data.seq counter (persists on React, unlike
    // a module-let referenced only here). Read seq into a local BEFORE writing it
    // back (no read-after-write of the same key in one fn → ROZ138-safe).
    let id;
    if (t.id != null) {
      id = t.id;
    } else {
      const s = this.seq();
      id = 't' + s;
      this.seq.set(s + 1);
    }
    const toast = {
      id,
      message: t.message != null ? t.message : '',
      type: t.type || 'info',
      duration: t.duration != null ? t.duration : this.duration()
    };
    const next = this.toasts().concat([toast]);
    const max = this.max();
    this.toasts.set(max > 0 && next.length > max ? next.slice(next.length - max) : next);
    this.startTimer(toast);
    return id;
  };
  dismiss = (id: any) => {
    this.clearTimer(id);
    this.toasts.set(this.toasts().filter((t: any) => t.id !== id));
  };
  clear = () => {
    this.pauseTimers();
    this.toasts.set([]);
  };
  onMouseEnter = () => {
    if (this.disablePauseOnHover()) return;
    this.pauseTimers();
  };
  onMouseLeave = () => {
    if (this.disablePauseOnHover()) return;
    for (const t of this.toasts() as any) this.startTimer(t);
  };
  regionLabel = () => this.ariaLabel() != null ? this.ariaLabel() : 'Notifications';
  liveFor = (type: any) => type === 'error' || type === 'warning' ? 'assertive' : 'polite';

  static ngTemplateContextGuard(
    _dir: Toaster,
    _ctx: unknown,
  ): _ctx is ToastCtx {
    return true;
  }

  private __rozieDestroyRef = inject(DestroyRef);

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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Toaster;
