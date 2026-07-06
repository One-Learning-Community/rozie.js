import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-counter')
export default class Counter extends SignalWatcher(LitElement) {
  static styles = css`
.counter[data-rozie-s-c72e01d0] { display: inline-flex; gap: 0.5rem; align-items: center; }
.counter.hovering[data-rozie-s-c72e01d0] { background: rgba(0, 0, 0, 0.04); }
.value[data-rozie-s-c72e01d0] { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
button[data-rozie-s-c72e01d0] { padding: 0.25rem 0.5rem; }
button[data-rozie-s-c72e01d0]:disabled { opacity: 0.4; cursor: not-allowed; }
`;

  @property({ type: Number, attribute: 'value' }) _value_attr: number = 0;
  private _valueControllable = createLitControllableProperty<number>({ host: this, eventName: 'value-change', defaultValue: 0, initialControlledValue: undefined });
  @property({ type: Number, reflect: true }) step: number = 1;
  @property({ type: Number, reflect: true }) min: number = -Infinity;
  @property({ type: Number, reflect: true }) max: number = Infinity;
  private _hovering = signal(false);

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    console.log("hello from rozie");
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
    if (name === 'value') this._valueControllable.notifyAttributeChange(value === null ? 0 : Number(value));
  }

  render() {
    return html`
<div class="${Object.entries({ "counter": true, hovering: this._hovering.value }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} @mouseenter=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this._hovering.value = true; }} @mouseleave=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this._hovering.value = false; }} ${rozieListeners(this.$listeners)} data-rozie-s-c72e01d0>
  <button ?disabled=${!this.canDecrement} aria-label="Decrement" @click=${this.decrement} data-rozie-s-c72e01d0>−</button>
  <span class="value" data-rozie-s-c72e01d0>${this.value}</span>
  <button ?disabled=${!this.canIncrement} aria-label="Increment" @click=${this.increment} data-rozie-s-c72e01d0>+</button>
</div>
`;
  }

  get canIncrement() { return this.value + this.step <= this.max; }

  get canDecrement() { return this.value - this.step >= this.min; }

  increment = () => {
  if (this.canIncrement) this._valueControllable.write(prev => prev + this.step);
};

  decrement = () => {
  if (this.canDecrement) this._valueControllable.write(prev => prev - this.step);
};

  get value(): number { return this._valueControllable.read(); }
  set value(v: number) { this._valueControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['value', 'step', 'min', 'max']);
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
