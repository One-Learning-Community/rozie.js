import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-update-expression-probe')
export default class UpdateExpressionProbe extends SignalWatcher(LitElement) {
  static styles = css`
.probe[data-rozie-s-0fceff7a] { display: inline-flex; gap: 0.5rem; align-items: center; }
.count[data-rozie-s-0fceff7a], .value[data-rozie-s-0fceff7a] { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
button[data-rozie-s-0fceff7a] { padding: 0.25rem 0.5rem; }
`;

  @property({ type: Number, attribute: 'value' }) _value_attr: number = 0;
  private _valueControllable = createLitControllableProperty<number>({ host: this, eventName: 'value-change', defaultValue: 0, initialControlledValue: undefined });
  private _count = signal(0);

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'value') this._valueControllable.notifyAttributeChange(value === null ? 0 : Number(value));
  }

  render() {
    return html`
<div class="probe" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-0fceff7a>
  <button aria-label="Decrement count" @click=${this.decCount} data-rozie-s-0fceff7a>−</button>
  <span class="count" data-rozie-s-0fceff7a>${this._count.value}</span>
  <button aria-label="Increment count" @click=${this.incCount} data-rozie-s-0fceff7a>+</button>
  <button aria-label="Decrement value" @click=${this.decValue} data-rozie-s-0fceff7a>−</button>
  <span class="value" data-rozie-s-0fceff7a>${this.value}</span>
  <button aria-label="Increment value" @click=${this.incValue} data-rozie-s-0fceff7a>+</button>
</div>
`;
  }

  incCount = () => {
  this._count.value++;
};

  decCount = () => {
  this._count.value--;
};

  incValue = () => {
  this._valueControllable.write(prev => prev + 1);
};

  decValue = () => {
  this._valueControllable.write(prev => prev - 1);
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
    const __skip = new Set<string>(['value']);
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
