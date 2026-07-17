import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-number-field')
export default class NumberField extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-number-field[data-rozie-s-ceb089aa] {
  display: inline-flex;
  align-items: stretch;
  gap: var(--rozie-number-field-gap, 0);
  font: var(--rozie-number-field-font, inherit);
  border: var(--rozie-number-field-border-width, 1px) solid var(--rozie-number-field-border-color, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-number-field-radius, 0.5rem);
  background: var(--rozie-number-field-bg, #fff);
  overflow: hidden;
}
.rozie-number-field-input[data-rozie-s-ceb089aa] {
  box-sizing: border-box;
  width: var(--rozie-number-field-width, 4.5rem);
  min-width: 0;
  padding: var(--rozie-number-field-padding, 0.375rem 0.5rem);
  text-align: var(--rozie-number-field-text-align, right);
  font: inherit;
  font-size: var(--rozie-number-field-font-size, 1rem);
  color: var(--rozie-number-field-color, inherit);
  background: transparent;
  border: none;
  outline: none;
}
.rozie-number-field-input[data-rozie-s-ceb089aa]:focus {
  box-shadow: inset 0 0 0 var(--rozie-number-field-focus-ring-width, 2px) var(--rozie-number-field-focus-ring-color, rgba(0, 102, 204, 0.35));
}
.rozie-number-field-btn[data-rozie-s-ceb089aa] {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rozie-number-field-btn-size, 2rem);
  padding: 0;
  font-size: var(--rozie-number-field-btn-font-size, 1.1rem);
  line-height: 1;
  color: var(--rozie-number-field-btn-color, inherit);
  background: var(--rozie-number-field-btn-bg, rgba(0, 0, 0, 0.04));
  border: none;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}
.rozie-number-field-btn[data-rozie-s-ceb089aa]:hover {
  background: var(--rozie-number-field-btn-hover-bg, rgba(0, 0, 0, 0.08));
}
.rozie-number-field-btn[data-rozie-s-ceb089aa]:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-number-field-disabled-opacity, 0.55);
}
.rozie-number-field--disabled[data-rozie-s-ceb089aa] {
  cursor: not-allowed;
  opacity: var(--rozie-number-field-disabled-opacity, 0.55);
}
`;

  /**
   * The numeric value of the field (two-way `r-model`). `null` means the field is empty. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a number field **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). The value is clamped to `[min, max]` and snapped to `step` on every commit.
   * @example
   * <NumberField r-model:modelValue="qty" :min="0" :max="10" />
   */
  @property({ type: Number, attribute: 'model-value' }) _modelValue_attr: number | null = null;
  private _modelValueControllable = createLitControllableProperty<number>({ host: this, eventName: 'model-value-change', defaultValue: null, initialControlledValue: undefined });
  /**
   * Inclusive lower bound. Every commit clamps the value to `>= min`, and the **Home** key jumps to `min`. `null` (the default) means no lower bound. Also emitted as `aria-valuemin`.
   */
  @property({ type: Number, reflect: true }) min: number | null = null;
  /**
   * Inclusive upper bound. Every commit clamps the value to `<= max`, and the **End** key jumps to `max`. `null` (the default) means no upper bound. Also emitted as `aria-valuemax`.
   */
  @property({ type: Number, reflect: true }) max: number | null = null;
  /**
   * The increment/decrement granularity. **ArrowUp** / **ArrowDown** and the +/- buttons change the value by `step`, and every commit snaps the value to the nearest multiple of `step` measured from `min` (or `0` when `min` is `null`).
   */
  @property({ type: Number, reflect: true }) step: number = 1;
  /**
   * The coarse step applied by **PageUp** / **PageDown**, for fast traversal of a wide range.
   */
  @property({ type: Number, reflect: true }) largeStep: number = 10;
  /**
   * Options forwarded to `Intl.NumberFormat` for locale-aware **display** formatting (e.g. `{ style: "currency", currency: "USD" }` or `{ minimumFractionDigits: 2 }`). The displayed text is formatted while the field is unfocused; on commit the formatting is stripped back off and the raw number is parsed.
   * @example
   * :formatOptions="{ style: 'currency', currency: 'USD' }"
   */
  @property({ type: Object }) formatOptions: any = {};
  /**
   * Opt in to **scrub-on-drag**: press and drag horizontally on the field to change the value by `step` per few pixels (a power-user affordance). Off by default.
   */
  @property({ type: Boolean, reflect: true }) allowScrub: boolean = false;
  /**
   * Disable the whole control — the input, both steppers, the keyboard, and scrubbing. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Make the field read-only — the value is shown and focusable but cannot be changed by typing, the steppers, the keyboard, or scrubbing.
   */
  @property({ type: Boolean, reflect: true }) readonly: boolean = false;
  /**
   * Accessible name applied to the `role="spinbutton"` input (`aria-label`). Provide this (or an external `<label>`) so the control is announced.
   */
  @property({ type: String, reflect: true }) ariaLabel: string | null = null;
  private _text = signal('');
  private _focused = signal(false);
  @query('[data-rozie-ref="input"]') private _refInput!: HTMLElement;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this._disconnectCleanups.push((() => {
      this.stopHold();
      this.scrubbing = false;
    }));

    // Seed the edit buffer so a programmatic focus shows the right text.
    const n = this.readValue();
    this._text.value = n === null ? '' : String(n);
    // Tear down any running repeat / scrub on unmount.
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
    if (name === 'model-value') this._modelValueControllable.notifyAttributeChange(value === null ? null : Number(value));
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-number-field": true, 'rozie-number-field--disabled': this.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-ceb089aa>
  <button class="rozie-number-field-btn rozie-number-field-btn--dec" type="button" tabindex="-1" aria-label="Decrement" ?disabled=${!!this.disabled || !!this.readonly} @pointerdown=${($event: PointerEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.startHold(-1); }} @pointerup=${($event: PointerEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.stopHold(); }} @pointerleave=${($event: Event & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.stopHold(); }} data-rozie-s-ceb089aa>−</button>

  <input class="rozie-number-field-input" type="text" inputmode="decimal" autocomplete="off" role="spinbutton" .value=${this.displayText()} ?disabled=${!!this.disabled} ?readonly=${!!this.readonly} aria-label=${this.ariaLabel} aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${this.modelValue} aria-valuetext=${rozieAttr(this.ariaText())} aria-disabled=${!!this.disabled} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInput($event); }} @focus=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onFocus($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onBlur(); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} @pointerdown=${($event: PointerEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onScrubDown($event); }} @pointermove=${($event: PointerEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onScrubMove($event); }} @pointerup=${($event: PointerEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onScrubUp(); }} data-rozie-ref="input" data-rozie-s-ceb089aa />

  <button class="rozie-number-field-btn rozie-number-field-btn--inc" type="button" tabindex="-1" aria-label="Increment" ?disabled=${!!this.disabled || !!this.readonly} @pointerdown=${($event: PointerEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.startHold(1); }} @pointerup=${($event: PointerEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.stopHold(); }} @pointerleave=${($event: Event & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.stopHold(); }} data-rozie-s-ceb089aa>+</button>
</div>
`;
  }

  holdTimer: any = null;

  holdInterval = 0;

  scrubbing = false;

  scrubStartX = 0;

  scrubStartValue = 0;

  readValue = () => {
  const v = this.modelValue;
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
};

  hasMin = () => typeof this.min === 'number' && !Number.isNaN(this.min);

  hasMax = () => typeof this.max === 'number' && !Number.isNaN(this.max);

  clampValue = (n: any) => {
  let out = n;
  if (this.hasMin() && out < this.min) out = this.min;
  if (this.hasMax() && out > this.max) out = this.max;
  return out;
};

  snapValue = (n: any) => {
  const stepSize = typeof this.step === 'number' && this.step > 0 ? this.step : 1;
  const base = this.hasMin() ? this.min : 0;
  const snapped = base + Math.round((n - base) / stepSize) * stepSize;
  // Avoid binary-float drift (e.g. 0.1 + 0.2) by rounding to step precision.
  const decimals = (String(stepSize).split('.')[1] || '').length;
  return decimals > 0 ? Number(snapped.toFixed(decimals)) : snapped;
};

  formatter = () => {
  try {
    return new Intl.NumberFormat(undefined, this.formatOptions || {});
  } catch {
    return new Intl.NumberFormat();
  }
};

  formatted = () => {
  const n = this.readValue();
  return n === null ? '' : this.formatter().format(n);
};

  parseText = (raw: any) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const cleaned = s.replace(/[^0-9eE+\-.,]/g, '').replace(/,/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};

  displayText = () => this._focused.value ? this._text.value : this.formatted();

  ariaText = () => {
  const n = this.readValue();
  return n === null ? '' : this.formatted();
};

  commitValue = (n: any) => {
  let next = n;
  if (next !== null) {
    next = this.snapValue(next);
    next = this.clampValue(next);
  }
  this._modelValueControllable.write(next);
  // Keep the edit buffer in sync so a focused field reflects a programmatic step.
  this._text.value = next === null ? '' : String(next);
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: next
    },
    bubbles: true,
    composed: true
  }));
};

  stepBy = (dir: any, size: any) => {
  if (this.disabled || this.readonly) return;
  const cur = this.readValue();
  const stepSize = typeof size === 'number' ? size : typeof this.step === 'number' ? this.step : 1;
  const base = cur === null ? this.hasMin() ? this.min : 0 : cur;
  this.commitValue(base + dir * stepSize);
};

  stopHold = () => {
  if (this.holdTimer !== null) {
    clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }
  this.holdInterval = 0;
};

  startHold = (dir: any) => {
  if (this.disabled || this.readonly) return;
  this.stopHold();
  this.stepBy(dir, this.step);
  this.holdInterval = 300;
  const tick = () => {
    this.stepBy(dir, this.step);
    // Ramp: shorten the interval down to a floor for accelerating repeats.
    this.holdInterval = Math.max(40, Math.round(this.holdInterval * 0.8));
    this.holdTimer = setTimeout(tick, this.holdInterval);
  };
  this.holdTimer = setTimeout(tick, this.holdInterval);
};

  onInput = (e: any) => {
  if (this.readonly) return;
  const raw = e && e.target ? e.target.value : '';
  this._text.value = raw;
};

  onBlur = () => {
  this._focused.value = false;
  const parsed = this.parseText(this._text.value);
  this.commitValue(parsed);
};

  onFocus = (e: any) => {
  this._focused.value = true;
  // Seed the edit buffer with the raw (unformatted) number so editing is clean.
  const n = this.readValue();
  this._text.value = n === null ? '' : String(n);
  if (e && e.target && e.target.select) e.target.select();
};

  onKeydown = (e: any) => {
  if (this.disabled || this.readonly) return;
  const key = e ? e.key : '';
  if (key === 'ArrowUp') {
    if (e) e.preventDefault();
    this.stepBy(1, this.step);
  } else if (key === 'ArrowDown') {
    if (e) e.preventDefault();
    this.stepBy(-1, this.step);
  } else if (key === 'PageUp') {
    if (e) e.preventDefault();
    this.stepBy(1, this.largeStep);
  } else if (key === 'PageDown') {
    if (e) e.preventDefault();
    this.stepBy(-1, this.largeStep);
  } else if (key === 'Home') {
    if (this.hasMin()) {
      if (e) e.preventDefault();
      this.commitValue(this.min);
    }
  } else if (key === 'End') {
    if (this.hasMax()) {
      if (e) e.preventDefault();
      this.commitValue(this.max);
    }
  } else if (key === 'Enter') {
    // Commit the buffer without losing focus.
    const parsed = this.parseText(this._text.value);
    this.commitValue(parsed);
  }
};

  onScrubDown = (e: any) => {
  if (!this.allowScrub || this.disabled || this.readonly) return;
  this.scrubbing = true;
  this.scrubStartX = e && typeof e.clientX === 'number' ? e.clientX : 0;
  const cur = this.readValue();
  this.scrubStartValue = cur === null ? this.hasMin() ? this.min : 0 : cur;
  // Capture the pointer so move/up stay on this element for the whole drag.
  if (e && e.target && e.target.setPointerCapture && typeof e.pointerId === 'number') {
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {}
  }
};

  onScrubMove = (e: any) => {
  if (!this.scrubbing) return;
  const x = e && typeof e.clientX === 'number' ? e.clientX : 0;
  const dx = x - this.scrubStartX;
  const stepSize = typeof this.step === 'number' && this.step > 0 ? this.step : 1;
  // One step per 8px of horizontal travel.
  const delta = Math.round(dx / 8) * stepSize;
  this.commitValue(this.scrubStartValue + delta);
};

  onScrubUp = () => {
  this.scrubbing = false;
};

  focus = () => {
  const el = this._refInput;
  // NOTE: $refs.input types to the generic HTMLElement on the tsdown/vue leaves
  // (the emitter ref-type map has no `input` → HTMLInputElement entry), so we
  // only touch HTMLElement members here (`focus`). Text selection happens in the
  // onFocus handler, where `e.target` is `any` and `.select()` typechecks.
  if (el && el.focus) el.focus();
};

  increment = () => this.stepBy(1, this.step);

  decrement = () => this.stepBy(-1, this.step);

  clear = () => {
  this.commitValue(null);
  this._text.value = '';
};

  get modelValue(): number { return this._modelValueControllable.read(); }
  set modelValue(v: number) { this._modelValueControllable.notifyPropertyWrite(v); }

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
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'model-value', 'modelvalue', 'min', 'max', 'step', 'large-step', 'largestep', 'format-options', 'formatoptions', 'allow-scrub', 'allowscrub', 'disabled', 'readonly', 'aria-label', 'arialabel']);
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
