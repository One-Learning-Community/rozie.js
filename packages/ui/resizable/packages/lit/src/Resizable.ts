import { LitElement, css, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieListeners, rozieSpread, rozieStyle } from '@rozie/runtime-lit';
import { clampPercent, percentFromPointer, nudge } from './internal/resizeMath';

// ---- derived view (plain functions, uniform ×6) ------------------------
// The current size, normalized + clamped. Plain function (called in template
// bindings AND handlers) — never $computed (a $computed is a value on React but
// an accessor on Solid; a plain fn reads uniformly).

@customElement('rozie-resizable')
export default class Resizable extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-resizable[data-rozie-s-8330bc5a] {
  display: flex;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  font: var(--rozie-resizable-font, inherit);
}
.rozie-resizable--horizontal[data-rozie-s-8330bc5a] {
  flex-direction: row;
}
.rozie-resizable--vertical[data-rozie-s-8330bc5a] {
  flex-direction: column;
}
.rozie-resizable-panel[data-rozie-s-8330bc5a] {
  box-sizing: border-box;
  overflow: auto;
}
.rozie-resizable-panel--start[data-rozie-s-8330bc5a] {
  flex: 0 0 auto;
}
.rozie-resizable--horizontal[data-rozie-s-8330bc5a] .rozie-resizable-panel--start[data-rozie-s-8330bc5a] {
  width: var(--rozie-resizable-size, 50%);
  height: 100%;
}
.rozie-resizable--vertical[data-rozie-s-8330bc5a] .rozie-resizable-panel--start[data-rozie-s-8330bc5a] {
  height: var(--rozie-resizable-size, 50%);
  width: 100%;
}
.rozie-resizable-panel--end[data-rozie-s-8330bc5a] {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
}
.rozie-resizable-handle[data-rozie-s-8330bc5a] {
  flex: 0 0 var(--rozie-resizable-handle-size, 0.5rem);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rozie-resizable-handle-bg, rgba(0, 0, 0, 0.08));
  outline: none;
  transition: background-color 0.15s;
  touch-action: none;
}
.rozie-resizable--horizontal[data-rozie-s-8330bc5a] .rozie-resizable-handle[data-rozie-s-8330bc5a] {
  cursor: col-resize;
  align-self: stretch;
}
.rozie-resizable--vertical[data-rozie-s-8330bc5a] .rozie-resizable-handle[data-rozie-s-8330bc5a] {
  cursor: row-resize;
}
.rozie-resizable-handle[data-rozie-s-8330bc5a]:hover {
  background: var(--rozie-resizable-handle-hover-bg, rgba(0, 0, 0, 0.16));
}
.rozie-resizable-handle[data-rozie-s-8330bc5a]:focus-visible {
  box-shadow: 0 0 0 var(--rozie-resizable-focus-ring-width, 2px)
    var(--rozie-resizable-focus-ring-color, rgba(0, 102, 204, 0.5));
  z-index: 1;
}
.rozie-resizable--dragging[data-rozie-s-8330bc5a] .rozie-resizable-handle[data-rozie-s-8330bc5a] {
  background: var(--rozie-resizable-handle-active-bg, var(--rozie-resizable-accent, #0066cc));
}
.rozie-resizable-grip[data-rozie-s-8330bc5a] {
  display: block;
  border-radius: 999px;
  background: var(--rozie-resizable-grip-bg, rgba(0, 0, 0, 0.35));
}
.rozie-resizable--horizontal[data-rozie-s-8330bc5a] .rozie-resizable-grip[data-rozie-s-8330bc5a] {
  width: var(--rozie-resizable-grip-thickness, 2px);
  height: var(--rozie-resizable-grip-length, 1.5rem);
}
.rozie-resizable--vertical[data-rozie-s-8330bc5a] .rozie-resizable-grip[data-rozie-s-8330bc5a] {
  height: var(--rozie-resizable-grip-thickness, 2px);
  width: var(--rozie-resizable-grip-length, 1.5rem);
}
.rozie-resizable--disabled[data-rozie-s-8330bc5a] .rozie-resizable-handle[data-rozie-s-8330bc5a] {
  cursor: default;
  opacity: var(--rozie-resizable-disabled-opacity, 0.55);
}
`;

  /**
   * The first (`start`) panel's size as a percent of the container along the split axis (its width when `direction="horizontal"`, its height when `"vertical"`). Two-way via `r-model:size`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so the splitter position **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Every commit (drag, keyboard, or a programmatic `applySize`) is clamped to `[min, max]` and written back.
   * @example
   * <Resizable r-model:size="split" :min="20" :max="80" direction="horizontal" />
   */
  @property({ type: Number, attribute: 'size' }) _size_attr: number = 50;
  private _sizeControllable = createLitControllableProperty<number>({ host: this, eventName: 'size-change', defaultValue: 50, initialControlledValue: undefined });
  /**
   * The split axis. `'horizontal'` (default) lays the two panels out side-by-side with a vertical drag handle between them (`size` is the first panel's **width**); `'vertical'` stacks them with a horizontal handle (`size` is the first panel's **height**). Also sets the handle's `aria-orientation`.
   */
  @property({ type: String, reflect: true }) direction: string = 'horizontal';
  /**
   * The minimum `size` percent — the first panel can never be dragged or nudged below this. Clamps every commit.
   */
  @property({ type: Number, reflect: true }) min: number = 10;
  /**
   * The maximum `size` percent — the first panel can never be dragged or nudged beyond this (so the second panel keeps at least `100 - max` percent). Clamps every commit.
   */
  @property({ type: Number, reflect: true }) max: number = 90;
  /**
   * Disable resizing — the handle becomes non-interactive (pointer drag and keyboard are ignored) and the panels lock at the current `size`. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  private _dragging = signal(false);
  @query('[data-rozie-ref="root"]') private _refRoot!: HTMLElement;

  @state() private _hasSlotStart = false;
  @queryAssignedElements({ slot: 'start', flatten: true }) private _slotStartElements!: Element[];
  @state() private _hasSlotHandle = false;
  @queryAssignedElements({ slot: 'handle', flatten: true }) private _slotHandleElements!: Element[];
  @state() private _hasSlotEnd = false;
  @queryAssignedElements({ slot: 'end', flatten: true }) private _slotEndElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="start"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotStart = this._slotStartElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="handle"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotHandle = this._slotHandleElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="end"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotEnd = this._slotEndElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotStart = Array.from(this.children).some((el) => el.getAttribute('slot') === 'start');
    this._hasSlotHandle = Array.from(this.children).some((el) => el.getAttribute('slot') === 'handle');
    this._hasSlotEnd = Array.from(this.children).some((el) => el.getAttribute('slot') === 'end');
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
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'size') this._sizeControllable.notifyAttributeChange(value === null ? 50 : Number(value));
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-resizable": true, 'rozie-resizable--vertical': this.isVertical(), 'rozie-resizable--horizontal': !this.isVertical(), 'rozie-resizable--dragging': this._dragging.value, 'rozie-resizable--disabled': this.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" style=${rozieStyle(this.sizeStyle())} ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="root" data-rozie-s-8330bc5a>
  
  <div class="rozie-resizable-panel rozie-resizable-panel--start" data-rozie-s-8330bc5a>
    <slot name="start"></slot>
  </div>

  
  <div class="rozie-resizable-handle" role="separator" tabindex="0" aria-orientation=${rozieAttr(this.isVertical() ? 'horizontal' : 'vertical')} aria-valuenow=${this.size} aria-valuemin=${this.min} aria-valuemax=${this.max} aria-disabled=${!!this.disabled} @pointerdown=${($event: PointerEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onPointerDown($event); }} @pointermove=${($event: PointerEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onPointerMove($event); }} @pointerup=${($event: PointerEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onPointerUp($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onKeydown($event); }} data-rozie-s-8330bc5a>
    <slot name="handle">
      <span class="rozie-resizable-grip" aria-hidden="true" data-rozie-s-8330bc5a></span>
    </slot>
  </div>

  
  <div class="rozie-resizable-panel rozie-resizable-panel--end" data-rozie-s-8330bc5a>
    <slot name="end"></slot>
  </div>
</div>
`;
  }

  currentSize = () => {
  const raw = typeof this.size === 'number' ? this.size : this.min;
  return clampPercent(raw, this.min, this.max);
};

  isVertical = () => this.direction === 'vertical';

  sizeStyle = () => ({
  '--rozie-resizable-size': this.currentSize() + '%'
});

  commitSize = (raw: any) => {
  const next = clampPercent(raw, this.min, this.max);
  this._sizeControllable.write(next);
  this.dispatchEvent(new CustomEvent("resize", {
    detail: {
      size: next
    },
    bubbles: true,
    composed: true
  }));
};

  onPointerDown = (e: any) => {
  if (this.disabled) return;
  if (e && e.preventDefault) e.preventDefault();
  this._dragging.value = true;
  // Capture the pointer on the handle so move/up keep firing on it even when the
  // pointer leaves the handle mid-drag.
  if (e && e.currentTarget && e.currentTarget.setPointerCapture && e.pointerId != null) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }
};

  onPointerMove = (e: any) => {
  if (!this._dragging.value || this.disabled) return;
  const root = this._refRoot;
  if (!root) return;
  const rect = root.getBoundingClientRect();
  const pct = this.isVertical() ? percentFromPointer(e.clientY, rect.top, rect.height) : percentFromPointer(e.clientX, rect.left, rect.width);
  this.commitSize(pct);
};

  onPointerUp = (e: any) => {
  if (!this._dragging.value) return;
  this._dragging.value = false;
  if (e && e.currentTarget && e.currentTarget.releasePointerCapture && e.pointerId != null) {
    if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }
};

  onKeydown = (e: any) => {
  if (this.disabled) return;
  const key = e ? e.key : '';
  const vertical = this.isVertical();
  const decKey = vertical ? 'ArrowUp' : 'ArrowLeft';
  const incKey = vertical ? 'ArrowDown' : 'ArrowRight';
  if (key === decKey) {
    if (e) e.preventDefault();
    this.commitSize(nudge(this.currentSize(), -1, this.min, this.max));
  } else if (key === incKey) {
    if (e) e.preventDefault();
    this.commitSize(nudge(this.currentSize(), 1, this.min, this.max));
  } else if (key === 'Home') {
    if (e) e.preventDefault();
    this.commitSize(this.min);
  } else if (key === 'End') {
    if (e) e.preventDefault();
    this.commitSize(this.max);
  }
};

  applySize = (percent: any) => this.commitSize(percent);

  reset = () => this.commitSize((this.min + this.max) / 2);

  get size(): number { return this._sizeControllable.read(); }
  set size(v: number) { this._sizeControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['size', 'direction', 'min', 'max', 'disabled']);
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
