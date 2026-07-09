import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread, rozieStyle } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

interface RozieMarkSlotCtx {
  value: unknown;
  label: unknown;
  position: unknown;
}

interface RozieBubbleSlotCtx {
  value: unknown;
}

@customElement('rozie-slider')
export default class Slider extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-slider[data-rozie-s-4e6f0be6] {
  position: relative;
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: var(--rozie-slider-thumb-size, 1rem);
  padding: var(--rozie-slider-pad, 0.5rem 0);
  font: var(--rozie-slider-font, inherit);
}
.rozie-slider-track[data-rozie-s-4e6f0be6] {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  height: var(--rozie-slider-track-height, 0.375rem);
  border-radius: var(--rozie-slider-track-radius, 999px);
  background: var(--rozie-slider-track-bg, rgba(0, 0, 0, 0.18));
  pointer-events: none;
}
.rozie-slider-fill[data-rozie-s-4e6f0be6] {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--rozie-slider-fill-start, 0%);
  right: calc(100% - var(--rozie-slider-fill-end, 0%));
  border-radius: inherit;
  background: var(--rozie-slider-fill-bg, var(--rozie-slider-accent, #0066cc));
}
.rozie-slider-input[data-rozie-s-4e6f0be6] {
  -webkit-appearance: none;
  appearance: none;
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  width: 100%;
  height: var(--rozie-slider-thumb-size, 1rem);
  margin: 0;
  background: none;
  pointer-events: none;
  cursor: pointer;
  accent-color: var(--rozie-slider-accent, #0066cc);
}
.rozie-slider-input[data-rozie-s-4e6f0be6]:focus { outline: none; z-index: 2; }
.rozie-slider--range[data-rozie-s-4e6f0be6] .rozie-slider-input[data-rozie-s-4e6f0be6] { pointer-events: none; }
.rozie-slider--disabled[data-rozie-s-4e6f0be6] .rozie-slider-input[data-rozie-s-4e6f0be6] { cursor: not-allowed; }
.rozie-slider--disabled[data-rozie-s-4e6f0be6] { opacity: var(--rozie-slider-disabled-opacity, 0.55); }
.rozie-slider-input[data-rozie-s-4e6f0be6]::-webkit-slider-runnable-track {
  background: none;
  height: var(--rozie-slider-track-height, 0.375rem);
}
.rozie-slider-input[data-rozie-s-4e6f0be6]::-moz-range-track {
  background: none;
  height: var(--rozie-slider-track-height, 0.375rem);
}
.rozie-slider-input[data-rozie-s-4e6f0be6]::-moz-range-progress {
  background: none;
}
.rozie-slider-input[data-rozie-s-4e6f0be6]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  pointer-events: auto;
  width: var(--rozie-slider-thumb-size, 1rem);
  height: var(--rozie-slider-thumb-size, 1rem);
  border: var(--rozie-slider-thumb-border, 2px solid #fff);
  border-radius: 50%;
  background: var(--rozie-slider-thumb-bg, var(--rozie-slider-accent, #0066cc));
  box-shadow: var(--rozie-slider-thumb-shadow, 0 1px 3px rgba(0, 0, 0, 0.3));
  margin-top: var(--rozie-slider-thumb-offset, calc((0.375rem - 1rem) / 2));
  cursor: pointer;
}
.rozie-slider-input[data-rozie-s-4e6f0be6]::-moz-range-thumb {
  pointer-events: auto;
  width: var(--rozie-slider-thumb-size, 1rem);
  height: var(--rozie-slider-thumb-size, 1rem);
  border: var(--rozie-slider-thumb-border, 2px solid #fff);
  border-radius: 50%;
  background: var(--rozie-slider-thumb-bg, var(--rozie-slider-accent, #0066cc));
  box-shadow: var(--rozie-slider-thumb-shadow, 0 1px 3px rgba(0, 0, 0, 0.3));
  cursor: pointer;
}
.rozie-slider--vertical[data-rozie-s-4e6f0be6] {
  width: var(--rozie-slider-thickness, 2.5rem);
  height: var(--rozie-slider-length, 12rem);
  padding: 0;
}
.rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-track[data-rozie-s-4e6f0be6],
.rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-input[data-rozie-s-4e6f0be6] {
  top: 50%;
  left: 50%;
  width: var(--rozie-slider-length, 12rem);
  transform: translate(-50%, -50%) rotate(-90deg);
  transform-origin: center center;
}
.rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-fill[data-rozie-s-4e6f0be6] {
  /* The fill still spans start→end along the (now rotated) input axis. */
}
.rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-marks[data-rozie-s-4e6f0be6],
.rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-bubbles[data-rozie-s-4e6f0be6] {
  /* Overlays follow the rotated axis; left:%-of-length maps to the visual Y. */
  top: 50%;
  left: 50%;
  width: var(--rozie-slider-length, 12rem);
  transform: translate(-50%, -50%) rotate(-90deg);
  transform-origin: center center;
}
.rozie-slider-marks[data-rozie-s-4e6f0be6] {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 0;
  pointer-events: none;
}
.rozie-slider-mark[data-rozie-s-4e6f0be6] {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  color: var(--rozie-slider-mark-color, rgba(0, 0, 0, 0.55));
}
.rozie-slider-mark-label[data-rozie-s-4e6f0be6] {
  position: absolute;
  top: var(--rozie-slider-mark-offset, 0.75rem);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--rozie-slider-mark-font-size, 0.6875rem);
  white-space: nowrap;
}
.rozie-slider-bubbles[data-rozie-s-4e6f0be6] {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0;
  pointer-events: none;
}
.rozie-slider-bubble[data-rozie-s-4e6f0be6] {
  position: absolute;
  top: var(--rozie-slider-bubble-offset, -1.25rem);
  transform: translateX(-50%);
}
.rozie-slider-bubble-text[data-rozie-s-4e6f0be6] {
  display: inline-block;
  padding: var(--rozie-slider-bubble-padding, 0.0625rem 0.375rem);
  font-size: var(--rozie-slider-bubble-font-size, 0.6875rem);
  color: var(--rozie-slider-bubble-fg, #fff);
  background: var(--rozie-slider-bubble-bg, var(--rozie-slider-accent, #0066cc));
  border-radius: var(--rozie-slider-bubble-radius, 4px);
  white-space: nowrap;
}
`;

  /**
   * The current value (two-way `r-model`). A scalar number in single mode; a sorted `[lo, hi]` array in `range` mode, with each thumb neighbour-clamped so the pair stays sorted on every commit. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Slider **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Slider r-model:value="volume" :min="0" :max="100" :step="1" ariaLabel="Volume" />
   */
  @property({ type: Object, attribute: 'value' }) _value_attr: unknown = null;
  private _valueControllable = createLitControllableProperty<unknown>({ host: this, eventName: 'value-change', defaultValue: null, initialControlledValue: undefined });
  /**
   * Switch to dual-thumb range mode: `value` becomes a sorted `[lo, hi]` array driven by two overlapping native inputs. The exact analog of listbox's `multiple` (scalar↔array). A bare attribute (`<Slider range>`) coerces to `true`.
   */
  @property({ type: Boolean, reflect: true }) range: boolean = false;
  /**
   * The lower bound of the scale, forwarded to the native input as the `min` attribute (the browser derives `aria-valuemin` from it — not set by hand, per MDN slider-role guidance).
   */
  @property({ type: Number, reflect: true }) min: number = 0;
  /**
   * The upper bound of the scale, forwarded to the native input as the `max` attribute (the browser derives `aria-valuemax` from it — not set by hand, per MDN slider-role guidance).
   */
  @property({ type: Number, reflect: true }) max: number = 100;
  /**
   * The granularity of the scale, forwarded as the native `step` attribute; every write-back is quantized to it.
   */
  @property({ type: Number, reflect: true }) step: number = 1;
  /**
   * Layout orientation — `'horizontal'` (default) or `'vertical'`. Vertical rotates the wrapper `-90deg` so up = increase and sets `aria-orientation="vertical"` explicitly (a native range input always reports itself as horizontal even when visually rotated).
   */
  @property({ type: String, reflect: true }) orientation: string = 'horizontal';
  /**
   * Disable the control — it becomes non-interactive and dimmed. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Tick marks over the track — either a bare `value[]` (positions only) or a `{ value, label }[]` (positioned and labelled). Rendered as a decorative overlay above the track; override per-mark rendering via the `mark` scoped slot (`{ value, label, position }`).
   */
  @property({ type: Array }) marks: any[] = [];
  /**
   * Accessible name for each native input when there is no visible `<label for>`, reflected onto the input's `aria-label`.
   */
  @property({ type: String, reflect: true }) ariaLabel: string | null = null;
  /**
   * The jump applied on `PageUp` / `PageDown`. `null` falls back to `step × 10`. Applied by a thin `@keydown` augment so it honours this value (native browsers otherwise use their own large step); arrows / `Home` / `End` stay native.
   */
  @property({ type: Number, reflect: true }) pageStep: number | null = null;
  /**
   * A `(value) => string` formatter for the value shown in the `bubble` slot and surfaced as `aria-valuetext`. Receives the numeric value and returns a string; `null` uses the raw value.
   */
  @property({ type: Function }) formatValue: ((...args: unknown[]) => unknown) | null = null;
  /**
   * Render the value-bubble overlay (one bubble per thumb in range mode). Headless and opt-in — there is no default-styled bubble; supply the `bubble` slot to control its appearance.
   */
  @property({ type: Boolean, reflect: true }) showValue: boolean = false;
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;

  @state() private _hasSlotMark = false;
  @queryAssignedElements({ slot: 'mark', flatten: true }) private _slotMarkElements!: Element[];
  @property({ attribute: false }) mark?: (scope: { value: unknown; label: unknown; position: unknown }) => unknown;
  @state() private _hasSlotBubble = false;
  @queryAssignedElements({ slot: 'bubble', flatten: true }) private _slotBubbleElements!: Element[];
  @property({ attribute: false }) bubble?: (scope: { value: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="mark"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotMark = this._slotMarkElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="bubble"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotBubble = this._slotBubbleElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotMark = Array.from(this.children).some((el) => el.getAttribute('slot') === 'mark');
    this._hasSlotBubble = Array.from(this.children).some((el) => el.getAttribute('slot') === 'bubble');
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
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as unknown);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-slider": true, 'rozie-slider--vertical': this.orientation === 'vertical', 'rozie-slider--horizontal': this.orientation !== 'vertical', 'rozie-slider--range': this.range, 'rozie-slider--disabled': this.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" style=${rozieStyle(this.fillStyle)} ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-4e6f0be6>
  
  <div class="rozie-slider-track" aria-hidden="true" data-rozie-s-4e6f0be6>
    <div class="rozie-slider-fill" data-rozie-s-4e6f0be6></div>
  </div>

  
  ${this.normalizedMarks().length > 0 ? html`<div class="rozie-slider-marks" aria-hidden="true" data-rozie-s-4e6f0be6>
    
    ${repeat<any>(this.normalizedMarks(), (mark, _idx) => mark.value, (mark, _idx) => html`<div class="rozie-slider-mark" key=${rozieAttr(mark.value)} style=${styleMap({ left: this.pct(mark.value) + '%' })} data-rozie-s-4e6f0be6>
      ${this.mark !== undefined ? this.mark({value: mark.value, label: mark.label, position: this.pct(mark.value)}) : html`<slot name="mark" data-rozie-params=${(() => { try { return JSON.stringify({value: mark.value, label: mark.label, position: this.pct(mark.value)}); } catch { return '{}'; } })()}>
        <span class="rozie-slider-mark-label" data-rozie-s-4e6f0be6>${rozieDisplay(mark.label)}</span>
      </slot>`}
    </div>`)}
  </div>` : nothing}${this.showValue && !this.range ? html`<div class="rozie-slider-bubbles" aria-hidden="true" data-rozie-s-4e6f0be6>
    <div class="rozie-slider-bubble" style=${styleMap({ left: 'var(--rozie-slider-fill-end)' })} data-rozie-s-4e6f0be6>
      ${this.bubble !== undefined ? this.bubble({value: this.singleValue()}) : html`<slot name="bubble" data-rozie-params=${(() => { try { return JSON.stringify({value: this.singleValue()}); } catch { return '{}'; } })()}>
        <span class="rozie-slider-bubble-text" data-rozie-s-4e6f0be6>${rozieDisplay(this.display(this.singleValue()))}</span>
      </slot>`}
    </div>
  </div>` : nothing}${this.showValue && this.range ? html`<div class="rozie-slider-bubbles" aria-hidden="true" data-rozie-s-4e6f0be6>
    <div class="rozie-slider-bubble" style=${styleMap({ left: 'var(--rozie-slider-fill-start)' })} data-rozie-s-4e6f0be6>
      ${this.bubble !== undefined ? this.bubble({value: this.rangePair()[0]}) : html`<slot name="bubble" data-rozie-params=${(() => { try { return JSON.stringify({value: this.rangePair()[0]}); } catch { return '{}'; } })()}>
        <span class="rozie-slider-bubble-text" data-rozie-s-4e6f0be6>${rozieDisplay(this.display(this.rangePair()[0]))}</span>
      </slot>`}
    </div>
    <div class="rozie-slider-bubble" style=${styleMap({ left: 'var(--rozie-slider-fill-end)' })} data-rozie-s-4e6f0be6>
      ${this.bubble !== undefined ? this.bubble({value: this.rangePair()[1]}) : html`<slot name="bubble" data-rozie-params=${(() => { try { return JSON.stringify({value: this.rangePair()[1]}); } catch { return '{}'; } })()}>
        <span class="rozie-slider-bubble-text" data-rozie-s-4e6f0be6>${rozieDisplay(this.display(this.rangePair()[1]))}</span>
      </slot>`}
    </div>
  </div>` : nothing}${!this.range ? html`<input class="rozie-slider-input" type="range" min=${this.min} max=${this.max} step=${this.step} .value=${this.singleValue()} ?disabled=${!!this.disabled} aria-label=${this.ariaLabel} aria-orientation=${rozieAttr(this.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext=${rozieAttr(this.formatValue !== null ? this.display(this.singleValue()) : null)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInputSingle($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeyDownSingle($event); }} data-rozie-ref="inputEl" data-rozie-s-4e6f0be6 />` : nothing}${this.range ? html`<input class="rozie-slider-input rozie-slider-input--lo" type="range" min=${this.min} max=${this.max} step=${this.step} .value=${this.rangePair()[0]} ?disabled=${!!this.disabled} aria-label=${this.ariaLabel} aria-orientation=${rozieAttr(this.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext=${rozieAttr(this.formatValue !== null ? this.display(this.rangePair()[0]) : null)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInputLo($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeyDownRange('lo', $event); }} data-rozie-ref="inputEl" data-rozie-s-4e6f0be6 />` : nothing}${this.range ? html`<input class="rozie-slider-input rozie-slider-input--hi" type="range" min=${this.min} max=${this.max} step=${this.step} .value=${this.rangePair()[1]} ?disabled=${!!this.disabled} aria-label=${this.ariaLabel} aria-orientation=${rozieAttr(this.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext=${rozieAttr(this.formatValue !== null ? this.display(this.rangePair()[1]) : null)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInputHi($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeyDownRange('hi', $event); }} data-rozie-s-4e6f0be6 />` : nothing}</div>
`;
  }

  pct = (v: any) => {
  const span = this.max - this.min;
  if (span === 0) return 0;
  const p = (v - this.min) / span * 100;
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
};

  clampStep = (raw: any) => {
  if (!Number.isFinite(raw)) return this.min;
  let v = raw;
  if (v < this.min) v = this.min;
  if (v > this.max) v = this.max;
  const step = this.step;
  if (Number.isFinite(step) && step > 0) {
    const steps = Math.round((v - this.min) / step);
    v = this.min + steps * step;
    if (v < this.min) v = this.min;
    if (v > this.max) v = this.max;
  }
  return v;
};

  rangePair = () => {
  const cur = this.value;
  if (Array.isArray(cur) && cur.length === 2) return [cur[0], cur[1]];
  return [this.min, this.max];
};

  singleValue = () => {
  const cur = this.value;
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : this.min;
};

  get fillStyle() {
    let start, end;
    if (this.range) {
      const arr = Array.isArray(this.value) && this.value.length === 2 ? this.value : [this.min, this.max];
      start = this.pct(arr[0]);
      end = this.pct(arr[1]);
    } else {
      start = 0;
      end = this.pct(typeof this.value === 'number' && Number.isFinite(this.value) ? this.value : this.min);
    }
    return {
      '--rozie-slider-fill-start': start + '%',
      '--rozie-slider-fill-end': end + '%'
    };
  }

  normalizedMarks = () => {
  const list = Array.isArray(this.marks) ? this.marks : [];
  return list.map((m: any) => {
    if (m !== null && typeof m === 'object' && 'value' in m) {
      return {
        value: m.value,
        label: 'label' in m && m.label != null ? m.label : String(m.value)
      };
    }
    return {
      value: m,
      label: String(m)
    };
  });
};

  display = (v: any) => {
  if (this.formatValue !== null) return this.formatValue(v);
  return String(v);
};

  fireChange = (value: any) => this.dispatchEvent(new CustomEvent("change", {
  detail: {
    value
  },
  bubbles: true,
  composed: true
}));

  commitSingle = (raw: any) => {
  const v = this.clampStep(raw);
  this._valueControllable.write(v);
  this.fireChange(v);
};

  commitRange = (which: any, raw: any) => {
  const pair = this.rangePair();
  let lo = pair[0];
  let hi = pair[1];
  const v = this.clampStep(raw);
  if (which === 'lo') lo = Math.min(v, hi);else hi = Math.max(v, lo);
  const next = [lo, hi];
  this._valueControllable.write(next);
  this.fireChange(next);
};

  onInputSingle = ($event: any) => this.commitSingle($event.target.valueAsNumber);

  onInputLo = ($event: any) => this.commitRange('lo', $event.target.valueAsNumber);

  onInputHi = ($event: any) => this.commitRange('hi', $event.target.valueAsNumber);

  effectivePageStep = () => {
  const ps = this.pageStep;
  if (Number.isFinite(ps) && ps > 0) return ps;
  const step = Number.isFinite(this.step) && this.step > 0 ? this.step : 1;
  return step * 10;
};

  onKeyDownSingle = ($event: any) => {
  const key = $event.key;
  if (key !== 'PageUp' && key !== 'PageDown') return;
  $event.preventDefault();
  const delta = key === 'PageUp' ? this.effectivePageStep() : -this.effectivePageStep();
  this.commitSingle(this.singleValue() + delta);
};

  onKeyDownRange = (which: any, $event: any) => {
  const key = $event.key;
  if (key !== 'PageUp' && key !== 'PageDown') return;
  $event.preventDefault();
  const delta = key === 'PageUp' ? this.effectivePageStep() : -this.effectivePageStep();
  const pair = this.rangePair();
  const base = which === 'lo' ? pair[0] : pair[1];
  this.commitRange(which, base + delta);
};

  focus = () => this._refInputEl?.focus();

  increment = (thumb: any) => {
  if (this.range) {
    const which = thumb === 'hi' ? 'hi' : 'lo';
    const pair = this.rangePair();
    const base = which === 'lo' ? pair[0] : pair[1];
    this.commitRange(which, base + this.step);
  } else {
    this.commitSingle(this.singleValue() + this.step);
  }
};

  decrement = (thumb: any) => {
  if (this.range) {
    const which = thumb === 'hi' ? 'hi' : 'lo';
    const pair = this.rangePair();
    const base = which === 'lo' ? pair[0] : pair[1];
    this.commitRange(which, base - this.step);
  } else {
    this.commitSingle(this.singleValue() - this.step);
  }
};

  get value(): unknown { return this._valueControllable.read(); }
  set value(v: unknown) { this._valueControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['value', 'range', 'min', 'max', 'step', 'orientation', 'disabled', 'marks', 'aria-label', 'arialabel', 'page-step', 'pagestep', 'format-value', 'formatvalue', 'show-value', 'showvalue']);
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
