import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr, rozieClass, rozieDisplay, rozieListeners, rozieSpread, rozieStyle } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

interface RozieToastSlotCtx {
  toast: unknown;
  dismiss: unknown;
}

@customElement('rozie-toaster')
export default class Toaster extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
@media (prefers-reduced-motion: reduce) {
  .rozie-toast[data-rozie-s-12d4265c] {
    animation-name: rozie-toast-fade-in;
    animation-duration: 1ms;
  }
  .rozie-toast--exiting[data-rozie-s-12d4265c] {
    animation-name: rozie-toast-fade-out;
    animation-duration: 1ms;
  }
}
.rozie-toaster[data-rozie-s-12d4265c] {
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
.rozie-toaster[data-rozie-s-12d4265c] > *[data-rozie-s-12d4265c] {
  pointer-events: auto;
}
.rozie-toaster--top-left[data-rozie-s-12d4265c] { top: 0; left: 0; align-items: flex-start; }
.rozie-toaster--top-right[data-rozie-s-12d4265c] { top: 0; right: 0; align-items: flex-end; }
.rozie-toaster--top-center[data-rozie-s-12d4265c] { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
.rozie-toaster--bottom-left[data-rozie-s-12d4265c] { bottom: 0; left: 0; align-items: flex-start; flex-direction: column-reverse; }
.rozie-toaster--bottom-right[data-rozie-s-12d4265c] { bottom: 0; right: 0; align-items: flex-end; flex-direction: column-reverse; }
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] { bottom: 0; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column-reverse; }
.rozie-toast[data-rozie-s-12d4265c] {
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
.rozie-toaster--top-center[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c],
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c] {
  touch-action: pan-x;
}
.rozie-toast--success[data-rozie-s-12d4265c] { background: var(--rozie-toast-success-bg, #16a34a); }
.rozie-toast--error[data-rozie-s-12d4265c] { background: var(--rozie-toast-error-bg, #dc2626); }
.rozie-toast--warning[data-rozie-s-12d4265c] { background: var(--rozie-toast-warning-bg, #ca8a04); }
.rozie-toast--info[data-rozie-s-12d4265c] { background: var(--rozie-toast-info-bg, var(--rozie-toast-bg, #333)); }
from[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(-0.5rem); }
to[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
from[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(0.5rem); }
to[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
from[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
to[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(-0.5rem); }
from[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
to[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(0.5rem); }
.rozie-toast[data-rozie-s-12d4265c] {
  animation: rozie-toast-enter var(--rozie-toast-enter-duration, 200ms) ease-out;
}
.rozie-toaster--bottom-left[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c],
.rozie-toaster--bottom-right[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c],
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c] {
  animation-name: rozie-toast-enter-from-bottom;
}
.rozie-toast--exiting[data-rozie-s-12d4265c] {
  animation: rozie-toast-exit var(--rozie-toast-exit-duration, 200ms) ease-in forwards;
}
.rozie-toaster--bottom-left[data-rozie-s-12d4265c] .rozie-toast--exiting[data-rozie-s-12d4265c],
.rozie-toaster--bottom-right[data-rozie-s-12d4265c] .rozie-toast--exiting[data-rozie-s-12d4265c],
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] .rozie-toast--exiting[data-rozie-s-12d4265c] {
  animation-name: rozie-toast-exit-to-bottom;
}
from[data-rozie-s-12d4265c] { opacity: 0; }
to[data-rozie-s-12d4265c] { opacity: 1; }
from[data-rozie-s-12d4265c] { opacity: 1; }
to[data-rozie-s-12d4265c] { opacity: 0; }
from[data-rozie-s-12d4265c] { opacity: 1; transform: translateX(0); }
to[data-rozie-s-12d4265c] { opacity: 0; transform: translateX(calc(var(--rozie-toast-swipe-exit, 1) * 100%)); }
from[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
to[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(calc(var(--rozie-toast-swipe-exit, 1) * 100%)); }
.rozie-toast--exiting.rozie-toast--swipe-exit[data-rozie-s-12d4265c] {
  animation-name: rozie-toast-swipe-exit-x;
}
.rozie-toaster--top-center[data-rozie-s-12d4265c] .rozie-toast--exiting.rozie-toast--swipe-exit[data-rozie-s-12d4265c],
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] .rozie-toast--exiting.rozie-toast--swipe-exit[data-rozie-s-12d4265c] {
  animation-name: rozie-toast-swipe-exit-y;
}
.rozie-toast-spinner[data-rozie-s-12d4265c] {
  flex: 0 0 auto;
  width: var(--rozie-toast-spinner-size, 1em);
  height: var(--rozie-toast-spinner-size, 1em);
  border: 2px solid color-mix(in srgb, var(--rozie-toast-spinner-color, currentColor) 25%, transparent);
  border-top-color: var(--rozie-toast-spinner-color, currentColor);
  border-radius: 50%;
  animation: rozie-toast-spin 0.75s linear infinite;
}
to[data-rozie-s-12d4265c] { transform: rotate(360deg); }
.rozie-toast-message[data-rozie-s-12d4265c] {
  flex: 1 1 auto;
  font-size: var(--rozie-toast-font-size, 0.9rem);
}
.rozie-toast-close[data-rozie-s-12d4265c] {
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
.rozie-toast-close[data-rozie-s-12d4265c]:hover {
  opacity: 1;
}
`;

  /**
   * Which corner the toast stack renders in: `'top-left'`, `'top-right'`, `'top-center'`, `'bottom-left'`, `'bottom-right'`, or `'bottom-center'`. Drives the fixed-position layout and the stack direction.
   */
  @property({ type: String, reflect: true }) position: string = 'bottom-right';
  /**
   * Default auto-dismiss time in milliseconds, applied to any toast that does not pass its own `duration`. `0` (or a per-toast `duration` of `0`) makes the toast sticky — it stays until explicitly dismissed.
   */
  @property({ type: Number, reflect: true }) duration: number = 4000;
  /**
   * Maximum number of visible toasts (`0` = unlimited). When the queue exceeds this, the oldest toasts drop off the stack.
   */
  @property({ type: Number, reflect: true }) max: number = 0;
  /**
   * Opt **out** of pausing the auto-dismiss timers while the pointer is over the stack. By default hovering pauses every timer and leaving restarts them; set this to keep toasts dismissing on schedule regardless of hover.
   */
  @property({ type: Boolean, reflect: true }) disablePauseOnHover: boolean = false;
  /**
   * Accessible name for the live region (`role="region"`), applied as its `aria-label`. Defaults to `'Notifications'` when not set, so assistive tech can navigate to the toast stack as a landmark.
   */
  @property({ type: String, reflect: true }) ariaLabel: string | null = null;
  /**
   * Opt **out** of pointer swipe-to-dismiss. By default, dragging a toast past 45% of its own width/height (direction auto-derived from `position`) or a fast flick dismisses it with reason `'swipe'`; a short drag springs back. A drag starting on the close button (or any button/link) never swipes.
   */
  @property({ type: Boolean, reflect: true }) disableSwipe: boolean = false;
  private _toasts = signal<any[]>([]);
  private _seq = signal(0);
  private _swipe = signal<any>(null);

  @state() private _hasSlotToast = false;
  @queryAssignedElements({ slot: 'toast', flatten: true }) private _slotToastElements!: Element[];
  @property({ attribute: false }) toast?: (scope: { toast: unknown; dismiss: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="toast"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotToast = this._slotToastElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotToast = Array.from(this.children).some((el) => el.getAttribute('slot') === 'toast');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      () => {
        this.unmounted = true;
        this.teardownTimers();
      };
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`
<div class="rozie-toaster ${(rozieClass('rozie-toaster--' + this.position))}" role="region" aria-label=${rozieAttr(this.regionLabel())} ${rozieSpread(this.$attrs)} @mouseenter=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onMouseEnter(); }} @mouseleave=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onMouseLeave(); }} ${rozieListeners(this.$listeners)} data-rozie-s-12d4265c>
  
  ${repeat<any>(this._toasts.value, (t, _idx) => t.id, (t, _idx) => html`<div class="rozie-toast ${(rozieClass('rozie-toast--' + t.type + (t.exiting ? ' rozie-toast--exiting' : '') + (t.swipeExitSign != null ? ' rozie-toast--swipe-exit' : '')))}" key=${rozieAttr(t.id)} style=${rozieStyle(this.toastStyle(t))} role="status" aria-live=${rozieAttr(this.liveFor(t.type))} @animationend=${($event: Event & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { t.exiting && this.removeToast(t.id); }} @pointerdown=${($event: PointerEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onToastPointerDown(t, $event); }} @pointermove=${($event: PointerEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onToastPointerMove(t, $event); }} @pointerup=${($event: PointerEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onToastPointerUp(t, $event); }} @pointercancel=${($event: PointerEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onToastPointerCancel(t); }} data-rozie-s-12d4265c>
    ${this.toast !== undefined ? this.toast({toast: t, dismiss: this.dismiss}) : html`<slot name="toast" data-rozie-params=${(() => { try { return JSON.stringify({toast: t}); } catch { return '{}'; } })()} @rozie-toast-dismiss=${($event: CustomEvent) => ((this.dismiss) as (...args: any[]) => any)($event.detail)}>
      ${t.type === 'loading' ? html`<span class="rozie-toast-spinner" aria-hidden="true" data-rozie-s-12d4265c></span>` : nothing}<span class="rozie-toast-message" data-rozie-s-12d4265c>${rozieDisplay(t.message)}</span>
      <button class="rozie-toast-close" type="button" aria-label="Dismiss" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.dismissBegin(t.id, 'close'); }} data-rozie-s-12d4265c>×</button>
    </slot>`}
  </div>`)}
</div>
`;
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
    const s = this._seq.value;
    id = 't' + s;
    this._seq.value = s + 1;
  }
  const toast = {
    id,
    message: t.message != null ? t.message : '',
    type: t.type || 'info',
    duration: t.duration != null ? t.duration : this.duration
  };
  const next = this._toasts.value.concat([toast]);
  const max = this.max;
  this._toasts.value = max > 0 && next.length > max ? next.slice(next.length - max) : next;
  this.startTimer(toast);
  return id;
};

  EXIT_FAILSAFE_MS = 350;

  removeToast = (id: any) => {
  this._toasts.value = this._toasts.value.filter((t: any) => t.id !== id);
};

  dismissBegin = (id: any, reason: any, extra: any) => {
  const entry = this._toasts.value.find((t: any) => t.id === id);
  if (!entry || entry.exiting) return;
  this.clearTimer(id);
  this.dispatchEvent(new CustomEvent("dismissed", {
    detail: {
      toast: entry,
      reason
    },
    bubbles: true,
    composed: true
  }));
  this._toasts.value = this._toasts.value.map((t: any) => t.id === id ? {
    ...t,
    exiting: true,
    ...(extra || {})
  } : t);
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
  this._toasts.value = [];
};

  patch = (id: any, changes: any) => {
  const c = changes || {};
  let existed = false;
  const next = this._toasts.value.map((t: any) => {
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
  this._toasts.value = next;
  if (c.duration !== undefined) {
    this.clearTimer(id);
    const patched = next.find((t: any) => t.id === id);
    this.startTimer(patched);
  }
  return true;
};

  settlePromise = (id: any, type: any, messageOrFn: any, value: any) => {
  if (this.unmounted) return;
  const stillThere = this._toasts.value.some((t: any) => t.id === id);
  if (!stillThere) return;
  const message = typeof messageOrFn === 'function' ? messageOrFn(value) : messageOrFn;
  this.patch(id, {
    type,
    message,
    duration: this.duration
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
  if (this.disableSwipe) return;
  if (event.button != null && event.button !== 0) return;
  // Ignore drags starting on the close button / any button-or-link chrome.
  const chrome = event.target && event.target.closest ? event.target.closest('button, a') : null;
  if (chrome) return;
  const axis = this.swipeAxisFor(this.position);
  const sign = this.swipeSignFor(this.position);
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
  if (this.disableSwipe) return;
  const gesture = this.swipeGesture;
  if (!gesture || gesture.id !== t.id) return;
  const raw = gesture.axis === 'x' ? event.clientX - gesture.startX : event.clientY - gesture.startY;
  const towardDismiss = raw * gesture.sign > 0;
  const d = towardDismiss ? raw : raw * 0.15;
  this._swipe.value = {
    id: t.id,
    d,
    axis: gesture.axis,
    sign: gesture.sign,
    size: gesture.size
  };
};

  onToastPointerUp = (t: any, event: any) => {
  if (this.disableSwipe) return;
  const gesture = this.swipeGesture;
  this.swipeGesture = null;
  const swipe = this._swipe.value;
  this._swipe.value = null;
  if (!gesture || gesture.id !== t.id || !swipe) return;
  const elapsed = Math.max(1, Date.now() - gesture.startTime);
  const magnitude = swipe.d * gesture.sign;
  const velocity = magnitude / elapsed;
  if (magnitude > 0 && (magnitude > gesture.size * 0.45 || velocity > 0.11)) {
    this.dismissBegin(t.id, 'swipe', {
      swipeExitSign: gesture.sign
    });
  }
};

  onToastPointerCancel = (t: any) => {
  if (this.disableSwipe) return;
  if (this.swipeGesture && this.swipeGesture.id === t.id) this.swipeGesture = null;
  if (this._swipe.value && this._swipe.value.id === t.id) this._swipe.value = null;
};

  toastStyle = (t: any) => {
  if (t.exiting) {
    return t.swipeExitSign != null ? '--rozie-toast-swipe-exit: ' + t.swipeExitSign + ';' : '';
  }
  const swipe = this._swipe.value;
  if (!swipe || swipe.id !== t.id) return '';
  const translate = swipe.axis === 'x' ? 'translateX(' + swipe.d + 'px)' : 'translateY(' + swipe.d + 'px)';
  const magnitude = swipe.d * swipe.sign;
  const opacity = magnitude > 0 && swipe.size > 0 ? Math.max(0.3, 1 - magnitude / swipe.size) : 1;
  return 'transform: ' + translate + '; opacity: ' + opacity + '; transition: none;';
};

  onMouseEnter = () => {
  if (this.disablePauseOnHover) return;
  this.pauseTimers();
};

  onMouseLeave = () => {
  if (this.disablePauseOnHover) return;
  this.resumeTimers();
};

  regionLabel = () => this.ariaLabel != null ? this.ariaLabel : 'Notifications';

  liveFor = (type: any) => type === 'error' || type === 'warning' ? 'assertive' : 'polite';

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['position', 'duration', 'max', 'disable-pause-on-hover', 'disablepauseonhover', 'aria-label', 'arialabel', 'disable-swipe', 'disableswipe']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
