import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, inject, input, output, signal, viewChild } from '@angular/core';
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

    <div class="rozie-toaster" [ngClass]="'rozie-toaster--' + position() + (stacked() ? ' rozie-toaster--stacked' : '')" role="region" [attr.aria-label]="rozieAttr(regionLabel())" #rozieSpread_0 (mouseenter)="onMouseEnter()" (mouseleave)="onMouseLeave()" #rozieListenersTarget_1>
      
      @for (t of toasts(); track t.id) {
    <div class="rozie-toast" [ngClass]="'rozie-toast--' + t.type + (t.exiting ? ' rozie-toast--exiting' : '') + (t.swipeExitSign != null ? ' rozie-toast--swipe-exit' : '')" [style]="toastStyle(t)" role="status" [attr.aria-live]="rozieAttr(liveFor(t.type))" (animationend)="t.exiting && removeToast(t.id)" (pointerdown)="onToastPointerDown(t, $event)" (pointermove)="onToastPointerMove(t, $event)" (pointerup)="onToastPointerUp(t, $event)" (pointercancel)="onToastPointerCancel(t)">
        @if ((toastTpl ?? templates()?.['toast'])) {
    <ng-container *ngTemplateOutlet="(toastTpl ?? templates()?.['toast']); context: { $implicit: { toast: t, dismiss: dismiss }, toast: t, dismiss: dismiss }" />
    } @else {

          @if (t.type === 'loading') {
    <span class="rozie-toast-spinner" aria-hidden="true"></span>
    }<span class="rozie-toast-message">{{ rozieDisplay(t.message) }}</span>
          <button type="button" class="rozie-toast-close" aria-label="Dismiss" (click)="dismissBegin(t.id, 'close')">×</button>
        
    }
      </div>
    }
    </div>

  `,
  styles: [`
    :host(rozie-toaster) { display: contents; }
    @media (prefers-reduced-motion: reduce) {
      .rozie-toast {
        animation-name: rozie-toast-fade-in;
        animation-duration: 1ms;
      }
      .rozie-toast--exiting {
        animation-name: rozie-toast-fade-out;
        animation-duration: 1ms;
      }
    }
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
    .rozie-toaster--stacked .rozie-toast {
      grid-area: 1 / 1;
      z-index: calc(100 - var(--rozie-toast-depth, 0));
    }
    .rozie-toaster--stacked:not(:hover):not(:focus-within) {
      display: grid;
    }
    .rozie-toaster--stacked:not(:hover):not(:focus-within) .rozie-toast {
      transform:
        translateY(calc(var(--rozie-toast-depth, 0) * var(--rozie-toast-stack-offset, 8px)))
        scale(calc(1 - var(--rozie-toast-depth, 0) * var(--rozie-toast-stack-scale-step, 0.05)));
      opacity: calc(1 - min(1, max(0, var(--rozie-toast-depth, 0) - 2)));
    }
    .rozie-toaster--stacked.rozie-toaster--bottom-left:not(:hover):not(:focus-within) .rozie-toast,
    .rozie-toaster--stacked.rozie-toaster--bottom-right:not(:hover):not(:focus-within) .rozie-toast,
    .rozie-toaster--stacked.rozie-toaster--bottom-center:not(:hover):not(:focus-within) .rozie-toast {
      transform:
        translateY(calc(var(--rozie-toast-depth, 0) * var(--rozie-toast-stack-offset, 8px) * -1))
        scale(calc(1 - var(--rozie-toast-depth, 0) * var(--rozie-toast-stack-scale-step, 0.05)));
    }
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
      /* Swipe: page scroll stays alive on touch along the axis the toast does
         NOT move on. The transition here drives the spring-back (the active-drag
         :style sets an inline \`transition: none\` to track the finger 1:1;
         releasing it without a further gesture falls back to this transition). */
      touch-action: pan-y;
      transition: transform 200ms ease, opacity 200ms ease;
    }
    .rozie-toaster--top-center .rozie-toast,
    .rozie-toaster--bottom-center .rozie-toast {
      touch-action: pan-x;
    }
    .rozie-toast--success { background: var(--rozie-toast-success-bg, #16a34a); }
    .rozie-toast--error { background: var(--rozie-toast-error-bg, #dc2626); }
    .rozie-toast--warning { background: var(--rozie-toast-warning-bg, #ca8a04); }
    .rozie-toast--info { background: var(--rozie-toast-info-bg, var(--rozie-toast-bg, #333)); }
    from { opacity: 0; transform: translateY(-0.5rem); }
    to { opacity: 1; transform: translateY(0); }
    from { opacity: 0; transform: translateY(0.5rem); }
    to { opacity: 1; transform: translateY(0); }
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-0.5rem); }
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(0.5rem); }
    .rozie-toast {
      animation: rozie-toast-enter var(--rozie-toast-enter-duration, 200ms) ease-out;
    }
    .rozie-toaster--bottom-left .rozie-toast,
    .rozie-toaster--bottom-right .rozie-toast,
    .rozie-toaster--bottom-center .rozie-toast {
      animation-name: rozie-toast-enter-from-bottom;
    }
    .rozie-toast--exiting {
      animation: rozie-toast-exit var(--rozie-toast-exit-duration, 200ms) ease-in forwards;
    }
    .rozie-toaster--bottom-left .rozie-toast--exiting,
    .rozie-toaster--bottom-right .rozie-toast--exiting,
    .rozie-toaster--bottom-center .rozie-toast--exiting {
      animation-name: rozie-toast-exit-to-bottom;
    }
    from { opacity: 0; }
    to { opacity: 1; }
    from { opacity: 1; }
    to { opacity: 0; }
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(calc(var(--rozie-toast-swipe-exit, 1) * 100%)); }
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(calc(var(--rozie-toast-swipe-exit, 1) * 100%)); }
    .rozie-toast--exiting.rozie-toast--swipe-exit {
      animation-name: rozie-toast-swipe-exit-x;
    }
    .rozie-toaster--top-center .rozie-toast--exiting.rozie-toast--swipe-exit,
    .rozie-toaster--bottom-center .rozie-toast--exiting.rozie-toast--swipe-exit {
      animation-name: rozie-toast-swipe-exit-y;
    }
    .rozie-toast-spinner {
      flex: 0 0 auto;
      width: var(--rozie-toast-spinner-size, 1em);
      height: var(--rozie-toast-spinner-size, 1em);
      border: 2px solid color-mix(in srgb, var(--rozie-toast-spinner-color, currentColor) 25%, transparent);
      border-top-color: var(--rozie-toast-spinner-color, currentColor);
      border-radius: 50%;
      animation: rozie-toast-spin 0.75s linear infinite;
    }
    to { transform: rotate(360deg); }
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
  /**
   * Which corner the toast stack renders in: `'top-left'`, `'top-right'`, `'top-center'`, `'bottom-left'`, `'bottom-right'`, or `'bottom-center'`. Drives the fixed-position layout and the stack direction.
   */
  position = input<string>('bottom-right');
  /**
   * Default auto-dismiss time in milliseconds, applied to any toast that does not pass its own `duration`. `0` (or a per-toast `duration` of `0`) makes the toast sticky — it stays until explicitly dismissed.
   */
  duration = input<number>(4000);
  /**
   * Maximum number of visible toasts (`0` = unlimited). When the queue exceeds this, the oldest toasts drop off the stack.
   */
  max = input<number>(0);
  /**
   * Opt **out** of pausing the auto-dismiss timers while the pointer is over the stack. By default hovering pauses every timer and leaving restarts them; set this to keep toasts dismissing on schedule regardless of hover.
   */
  disablePauseOnHover = input<boolean>(false);
  /**
   * Accessible name for the live region (`role="region"`), applied as its `aria-label`. Defaults to `'Notifications'` when not set, so assistive tech can navigate to the toast stack as a landmark.
   */
  ariaLabel = input<(string) | null>(null);
  /**
   * Opt **out** of pointer swipe-to-dismiss. By default, dragging a toast past 45% of its own width/height (direction auto-derived from `position`) or a fast flick dismisses it with reason `'swipe'`; a short drag springs back. A drag starting on the close button (or any button/link) never swipes.
   */
  disableSwipe = input<boolean>(false);
  /**
   * Opt **in** to a sonner-style collapsed stack: a single-cell grid overlay with depth-driven transforms (toasts at depth 3+ fade to invisible), newest on top. Hovering the region or moving keyboard focus into it expands to the normal flex-column stack; leaving re-collapses. `false` (default) renders the plain flex column at all times.
   */
  stacked = input<boolean>(false);
  toasts = signal<any[]>([]);
  seq = signal(0);
  swipe = signal<any>(null);
  dismissed = output<unknown>();
  @ContentChild('toast', { read: TemplateRef }) toastTpl?: TemplateRef<ToastCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.unmounted = true;
      this.teardownTimers();
    });
  }

  timers = {};
  unmounted = false;
  swipeGesture: any = null;
  startTimer = (toast: any) => {
    if (!toast || !toast.duration || toast.duration <= 0) return;
    if (typeof window === 'undefined') return;
    const remaining = toast.duration;
    const handle = window.setTimeout(() => this.dismissBegin(toast.id, 'timeout'), remaining);
    this.timers[toast.id] = {
      handle,
      startedAt: Date.now(),
      remaining
    };
  };
  clearTimer = (id: any) => {
    const entry = this.timers[id];
    if (entry && entry.handle != null && typeof window !== 'undefined') window.clearTimeout(entry.handle);
    delete this.timers[id];
  };
  pauseTimers = () => {
    if (typeof window === 'undefined') return;
    for (const id in this.timers) {
      const entry = this.timers[id];
      window.clearTimeout(entry.handle);
      const elapsed = Date.now() - entry.startedAt;
      this.timers[id] = {
        handle: null,
        startedAt: entry.startedAt,
        remaining: entry.remaining - elapsed
      };
    }
  };
  resumeTimers = () => {
    if (typeof window === 'undefined') return;
    for (const id in this.timers) {
      const entry = this.timers[id];
      if (entry.remaining == null || entry.remaining <= 0) continue;
      const remaining = entry.remaining;
      const handle = window.setTimeout(() => this.dismissBegin(id, 'timeout'), remaining);
      this.timers[id] = {
        handle,
        startedAt: Date.now(),
        remaining
      };
    }
  };
  teardownTimers = () => {
    if (typeof window !== 'undefined') {
      for (const id in this.timers) {
        const entry = this.timers[id];
        if (entry.handle != null) window.clearTimeout(entry.handle);
      }
    }
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
  EXIT_FAILSAFE_MS = 350;
  removeToast = (id: any) => {
    this.toasts.set(this.toasts().filter((t: any) => t.id !== id));
  };
  dismissBegin = (id: any, reason: any, extra?: {
    swipeExitSign?: number;
  }) => {
    const entry = this.toasts().find((t: any) => t.id === id);
    if (!entry || entry.exiting) return;
    this.clearTimer(id);
    this.dismissed.emit({
      toast: entry,
      reason
    });
    this.toasts.set(this.toasts().map((t: any) => t.id === id ? {
      ...t,
      exiting: true,
      ...(extra || {})
    } : t));
    if (typeof window === 'undefined') {
      this.removeToast(id);
    } else {
      window.setTimeout(() => this.removeToast(id), this.EXIT_FAILSAFE_MS);
    }
  };
  dismiss = (id: any) => {
    this.dismissBegin(id, 'api');
  };
  clear = () => {
    this.teardownTimers();
    this.toasts.set([]);
  };
  patch = (id: any, changes: any) => {
    const c = changes || {};
    let existed = false;
    const next = this.toasts().map((t: any) => {
      if (t.id !== id) return t;
      existed = true;
      const merged = {
        ...t
      };
      if (c.message !== undefined) merged.message = c.message;
      if (c.type !== undefined) merged.type = c.type;
      if (c.duration !== undefined) merged.duration = c.duration;
      return merged;
    });
    if (!existed) return false;
    this.toasts.set(next);
    if (c.duration !== undefined) {
      this.clearTimer(id);
      const patched = next.find((t: any) => t.id === id);
      this.startTimer(patched);
    }
    return true;
  };
  settlePromise = (id: any, type: any, messageOrFn: any, value: any) => {
    if (this.unmounted) return;
    const stillThere = this.toasts().some((t: any) => t.id === id);
    if (!stillThere) return;
    const message = typeof messageOrFn === 'function' ? messageOrFn(value) : messageOrFn;
    this.patch(id, {
      type,
      message,
      duration: this.duration()
    });
  };
  promise = (p: any, opts: any) => {
    const o = opts || {};
    const id = this.show({
      type: 'loading',
      duration: 0,
      message: o.loading
    });
    if (p && typeof p.then === 'function') {
      p.then((value: any) => this.settlePromise(id, 'success', o.success, value)).catch((err: any) => this.settlePromise(id, 'error', o.error, err));
    }
    return id;
  };
  swipeAxisFor = (position: any) => position === 'top-center' || position === 'bottom-center' ? 'y' : 'x';
  swipeSignFor = (position: any) => {
    if (position === 'top-right' || position === 'bottom-right') return 1;
    if (position === 'top-left' || position === 'bottom-left') return -1;
    if (position === 'bottom-center') return 1;
    return -1; // top-center
  };
  onToastPointerDown = (t: any, event: any) => {
    const __position = this.position();
    if (this.disableSwipe()) return;
    if (event.button != null && event.button !== 0) return;
    // Ignore drags starting on the close button / any button-or-link chrome.
    const chrome = event.target && event.target.closest ? event.target.closest('button, a') : null;
    if (chrome) return;
    const axis = this.swipeAxisFor(__position);
    const sign = this.swipeSignFor(__position);
    const el = event.currentTarget;
    const size = axis === 'x' ? el.offsetWidth : el.offsetHeight;
    this.swipeGesture = {
      id: t.id,
      axis,
      sign,
      size,
      startX: event.clientX,
      startY: event.clientY,
      startTime: Date.now()
    };
    if (el && el.setPointerCapture) {
      try {
        el.setPointerCapture(event.pointerId);
      } catch (e: any) {
        // Some embedded contexts throw on setPointerCapture — swipe still
        // works without capture (just loses "keeps tracking off-element").
      }
    }
  };
  onToastPointerMove = (t: any, event: any) => {
    if (this.disableSwipe()) return;
    const gesture = this.swipeGesture;
    if (!gesture || gesture.id !== t.id) return;
    const raw = gesture.axis === 'x' ? event.clientX - gesture.startX : event.clientY - gesture.startY;
    const towardDismiss = raw * gesture.sign > 0;
    const d = towardDismiss ? raw : raw * 0.15;
    this.swipe.set({
      id: t.id,
      d,
      axis: gesture.axis,
      sign: gesture.sign,
      size: gesture.size
    });
  };
  onToastPointerUp = (t: any, event: any) => {
    if (this.disableSwipe()) return;
    const gesture = this.swipeGesture;
    this.swipeGesture = null;
    // Local named `dragState`, NOT `swipe` — a local `swipe` would shadow the
    // reactive `$data.swipe` key on Svelte 5 (top-level `let swipe = $state(…)`
    // self-shadow TDZ: `const swipe = swipe` then `swipe = null` throws
    // "Cannot assign to constant"). Same collision class as the documented
    // $refs/$props self-shadow, just for a $data key.
    const dragState = this.swipe();
    this.swipe.set(null);
    if (!gesture || gesture.id !== t.id || !dragState) return;
    const elapsed = Math.max(1, Date.now() - gesture.startTime);
    const magnitude = dragState.d * gesture.sign;
    const velocity = magnitude / elapsed;
    if (magnitude > 0 && (magnitude > gesture.size * 0.45 || velocity > 0.11)) {
      this.dismissBegin(t.id, 'swipe', {
        swipeExitSign: gesture.sign
      });
    }
  };
  onToastPointerCancel = (t: any) => {
    if (this.disableSwipe()) return;
    if (this.swipeGesture && this.swipeGesture.id === t.id) this.swipeGesture = null;
    if (this.swipe() && this.swipe().id === t.id) this.swipe.set(null);
  };
  depth = (t: any) => {
    const __toasts = this.toasts();
    const idx = __toasts.findIndex((x: any) => x.id === t.id);
    return idx === -1 ? 0 : __toasts.length - 1 - idx;
  };
  toastStyle = (t: any) => {
    const depthDecl = '--rozie-toast-depth: ' + this.depth(t) + ';';
    if (t.exiting) {
      return t.swipeExitSign != null ? depthDecl + ' --rozie-toast-swipe-exit: ' + t.swipeExitSign + ';' : depthDecl;
    }
    // Local named `dragState`, NOT `swipe` — see the onToastPointerUp comment
    // above (Svelte 5 $data-key self-shadow).
    const dragState = this.swipe();
    if (!dragState || dragState.id !== t.id) return depthDecl;
    const translate = dragState.axis === 'x' ? 'translateX(' + dragState.d + 'px)' : 'translateY(' + dragState.d + 'px)';
    const magnitude = dragState.d * dragState.sign;
    const opacity = magnitude > 0 && dragState.size > 0 ? Math.max(0.3, 1 - magnitude / dragState.size) : 1;
    return depthDecl + ' transform: ' + translate + '; opacity: ' + opacity + '; transition: none;';
  };
  onMouseEnter = () => {
    if (this.disablePauseOnHover()) return;
    this.pauseTimers();
  };
  onMouseLeave = () => {
    if (this.disablePauseOnHover()) return;
    this.resumeTimers();
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
