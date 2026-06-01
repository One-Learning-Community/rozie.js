import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import flatpickr from 'flatpickr';

@customElement('rozie-flatpickr')
export default class Flatpickr extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-flatpickr[data-rozie-s-159070d4] {
  padding: 0.375rem 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  font: inherit;
  width: 100%;
  box-sizing: border-box;
}
.rozie-flatpickr[data-rozie-s-159070d4]:focus {
  outline: 2px solid rgba(0, 100, 255, 0.4);
  outline-offset: -1px;
}
`;

  @property({ type: String, attribute: 'date' }) _date_attr: string = '';
  private _dateControllable = createLitControllableProperty<string>({ host: this, eventName: 'date-change', defaultValue: '', initialControlledValue: undefined });
  @property({ type: String, reflect: true }) mode: string = 'single';
  @property({ type: String, reflect: true }) dateFormat: string = 'Y-m-d';
  @property({ type: Boolean, reflect: true }) altInput: boolean = false;
  @property({ type: String, reflect: true }) altFormat: string = 'F j, Y';
  @property({ type: Boolean, reflect: true }) enableTime: boolean = false;
  @property({ type: Boolean, reflect: true }) enableSeconds: boolean = false;
  @property({ type: Boolean, reflect: true }) time24hr: boolean = false;
  @property({ type: Boolean, reflect: true }) noCalendar: boolean = false;
  @property({ type: String, reflect: true }) minDate: string = null;
  @property({ type: String, reflect: true }) maxDate: string = null;
  @property({ type: String, reflect: true }) placeholder: string = 'Select a date…';
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  @property({ type: String, reflect: true }) commitOn: string = 'complete';
  @property({ type: Object }) options: any = {};
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    this._disconnectCleanups.push((() => this.instance?.destroy()));

    this.instance = flatpickr(this._refInputEl, {
      mode: this.mode,
      dateFormat: this.dateFormat,
      altInput: this.altInput,
      altFormat: this.altFormat,
      enableTime: this.enableTime,
      enableSeconds: this.enableSeconds,
      time_24hr: this.time24hr,
      noCalendar: this.noCalendar,
      minDate: this.minDate,
      maxDate: this.maxDate,
      defaultDate: this.date || null,
      ...this.options,
      onChange: (selectedDates: any, dateStr: any) => {
        // Value contract + range-commit semantics. In range mode flatpickr fires
        // onChange on the FIRST click (partial range) — committing then is the
        // bug every wrapper ships. Commit the string only when the range is
        // complete (2 dates) unless the consumer opted into commitOn:'change'.
        const isRange = this.mode === 'range';
        const complete = !isRange || selectedDates.length === 2;
        if ((this.commitOn === 'change' || complete) && dateStr !== this.date) {
          this._dateControllable.write(dateStr);
        }
        // Always surface BOTH the formatted string and the Date[] so consumers
        // that need the parsed objects (range bounds, multi-select) get them.
        this.dispatchEvent(new CustomEvent("change", {
          detail: {
            value: dateStr,
            selectedDates
          },
          bubbles: true,
          composed: true
        }));
      },
      onReady: (d: any, s: any) => this.dispatchEvent(new CustomEvent("ready", {
        detail: {
          value: s,
          selectedDates: d
        },
        bubbles: true,
        composed: true
      })),
      onOpen: () => this.dispatchEvent(new CustomEvent("open", {
        detail: undefined,
        bubbles: true,
        composed: true
      })),
      onClose: () => this.dispatchEvent(new CustomEvent("close", {
        detail: undefined,
        bubbles: true,
        composed: true
      })),
      onMonthChange: () => this.dispatchEvent(new CustomEvent("monthChange", {
        detail: undefined,
        bubbles: true,
        composed: true
      })),
      onYearChange: () => this.dispatchEvent(new CustomEvent("yearChange", {
        detail: undefined,
        bubbles: true,
        composed: true
      })),
      onValueUpdate: (d: any, s: any) => this.dispatchEvent(new CustomEvent("valueUpdate", {
        detail: {
          value: s,
          selectedDates: d
        },
        bubbles: true,
        composed: true
      })),
      onDayCreate: (_d: any, _s: any, _fp: any, dayElem: any) => this.dispatchEvent(new CustomEvent("dayCreate", {
        detail: dayElem,
        bubbles: true,
        composed: true
      }))
    });
    if (this.disabled) this.instance.input.disabled = true;
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('date')) { const __watchVal = (() => this.date)(); ((v: any) => {
      if (!this.instance) return;
      if (v !== this.instance.input.value) this.instance.setDate(v, false);
    })(__watchVal); }
    if (changedProperties.has('mode')) { const __watchVal = (() => this.mode)(); ((v: any) => this.instance?.set('mode', v))(__watchVal); }
    if (changedProperties.has('minDate')) { const __watchVal = (() => this.minDate)(); ((v: any) => this.instance?.set('minDate', v))(__watchVal); }
    if (changedProperties.has('maxDate')) { const __watchVal = (() => this.maxDate)(); ((v: any) => this.instance?.set('maxDate', v))(__watchVal); }
    if (changedProperties.has('dateFormat')) { const __watchVal = (() => this.dateFormat)(); ((v: any) => this.instance?.set('dateFormat', v))(__watchVal); }
    if (changedProperties.has('disabled')) { const __watchVal = (() => this.disabled)(); ((v: any) => {
      if (this.instance) this.instance.input.disabled = v;
    })(__watchVal); }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'date') this._dateControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<input class="rozie-flatpickr" type="text" placeholder=${this.placeholder} ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="inputEl" data-rozie-s-159070d4 />
`;
  }

  instance: any = null;

  clear() {
    this.instance?.clear();
  }

  openPicker() {
    this.instance?.open();
  }

  closePicker() {
    this.instance?.close();
  }

  selectDate(date: any, triggerChange: any) {
    this.instance?.setDate(date, triggerChange);
  }

  jumpToDate(date: any) {
    this.instance?.jumpToDate(date);
  }

  get date(): string { return this._dateControllable.read(); }
  set date(v: string) { this._dateControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['date', 'mode', 'date-format', 'dateformat', 'alt-input', 'altinput', 'alt-format', 'altformat', 'enable-time', 'enabletime', 'enable-seconds', 'enableseconds', 'time24hr', 'no-calendar', 'nocalendar', 'min-date', 'mindate', 'max-date', 'maxdate', 'placeholder', 'disabled', 'commit-on', 'commiton', 'options']);
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
