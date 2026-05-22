import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-counter')
export default class Counter extends SignalWatcher(LitElement) {
  static styles = css`
.counter[data-rozie-s-80d69145] { font-variant-numeric: tabular-nums; }
`;

  @property({ type: Number, attribute: 'value' }) _value_attr: number = 0;
  private _valueControllable = createLitControllableProperty<number>({ host: this, eventName: 'value-change', defaultValue: 0, initialControlledValue: undefined });

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
<button class="counter" ${rozieSpread(this.$attrs)} @click=${this.bump} data-rozie-s-80d69145>${this.value}</button>
`;
  }

  bump = () => {
  this._valueControllable.write(prev => prev + 1);
};

  get value(): number { return this._valueControllable.read(); }
  set value(v: number) { this._valueControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   */
  private get $attrs(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) out[a.name] = a.value;
    return out;
  }
}
