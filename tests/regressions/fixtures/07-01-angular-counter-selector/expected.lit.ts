import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty } from '@rozie/runtime-lit';

@customElement('rozie-counter')
export default class Counter extends SignalWatcher(LitElement) {
  static styles = css`
.counter { font-variant-numeric: tabular-nums; }
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
<button class="counter" @click=${this.bump}>${this.value}</button>
`;
  }

  bump = () => {
  this.value += 1;
};

  get value(): number { return this._valueControllable.read(); }
  set value(v: number) { this._valueControllable.write(v); }
}
