import { LitElement, css, html } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr, rozieClass, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

interface RozieToastSlotCtx {
  toast: unknown;
  dismiss: unknown;
}

@customElement('rozie-toaster')
export default class Toaster extends SignalWatcher(LitElement) {
  static styles = css`
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
}
.rozie-toast--success[data-rozie-s-12d4265c] { background: var(--rozie-toast-success-bg, #16a34a); }
.rozie-toast--error[data-rozie-s-12d4265c] { background: var(--rozie-toast-error-bg, #dc2626); }
.rozie-toast--warning[data-rozie-s-12d4265c] { background: var(--rozie-toast-warning-bg, #ca8a04); }
.rozie-toast--info[data-rozie-s-12d4265c] { background: var(--rozie-toast-info-bg, var(--rozie-toast-bg, #333)); }
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
  private _toasts = signal<any[]>([]);
  private _seq = signal(0);

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
        this.pauseTimers();
      };
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`
<div class="rozie-toaster ${(rozieClass('rozie-toaster--' + this.position))}" role="region" aria-label=${rozieAttr(this.regionLabel())} ${rozieSpread(this.$attrs)} @mouseenter=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onMouseEnter(); }} @mouseleave=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onMouseLeave(); }} ${rozieListeners(this.$listeners)} data-rozie-s-12d4265c>
  
  ${repeat<any>(this._toasts.value, (t, _idx) => t.id, (t, _idx) => html`<div class="rozie-toast ${(rozieClass('rozie-toast--' + t.type))}" key=${rozieAttr(t.id)} role="status" aria-live=${rozieAttr(this.liveFor(t.type))} data-rozie-s-12d4265c>
    ${this.toast !== undefined ? this.toast({toast: t, dismiss: this.dismiss}) : html`<slot name="toast" data-rozie-params=${(() => { try { return JSON.stringify({toast: t}); } catch { return '{}'; } })()} @rozie-toast-dismiss=${($event: CustomEvent) => ((this.dismiss) as (...args: any[]) => any)($event.detail)}>
      <span class="rozie-toast-message" data-rozie-s-12d4265c>${rozieDisplay(t.message)}</span>
      <button class="rozie-toast-close" type="button" aria-label="Dismiss" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.dismiss(t.id); }} data-rozie-s-12d4265c>×</button>
    </slot>`}
  </div>`)}
</div>
`;
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

  dismiss = (id: any) => {
  this.clearTimer(id);
  this._toasts.value = this._toasts.value.filter((t: any) => t.id !== id);
};

  clear = () => {
  this.pauseTimers();
  this._toasts.value = [];
};

  onMouseEnter = () => {
  if (this.disablePauseOnHover) return;
  this.pauseTimers();
};

  onMouseLeave = () => {
  if (this.disablePauseOnHover) return;
  for (const t of this._toasts.value as any) this.startTimer(t);
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
    const __skip = new Set<string>(['position', 'duration', 'max', 'disable-pause-on-hover', 'disablepauseonhover', 'aria-label', 'arialabel']);
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
