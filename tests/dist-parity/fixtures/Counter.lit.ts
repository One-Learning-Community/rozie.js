import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { createLitControllableProperty } from '@rozie/runtime-lit';

@customElement('rozie-counter')
export default class Counter extends SignalWatcher(LitElement) {
  static styles = css`
.counter { display: inline-flex; gap: 0.5rem; align-items: center; }
.counter.hovering { background: rgba(0, 0, 0, 0.04); }
.value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
.counter button { padding: 0.25rem 0.5rem; }
.counter button:disabled { opacity: 0.4; cursor: not-allowed; }
`;

  @property({ type: Number, attribute: 'value' }) _value_attr: number = 0;
  private _valueControllable = createLitControllableProperty<number>({ host: this, eventName: 'value-change', defaultValue: 0, initialControlledValue: undefined });
  @property({ type: Number, reflect: true }) step: number = 1;
  @property({ type: Number, reflect: true }) min: number = -Infinity;
  @property({ type: Number, reflect: true }) max: number = Infinity;
  private _hovering = signal(false);

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    console.log("hello from rozie");
  }

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
<div class="${Object.entries({ "counter": true, hovering: this._hovering.value }).filter(([, v]) => v).map(([k]) => k).join(' ')}" @mouseenter=${(e: Event) => { this._hovering.value = true; }} @mouseleave=${(e: Event) => { this._hovering.value = false; }}>
  <button ?disabled=${!this.canDecrement} aria-label="Decrement" @click=${this.decrement}>−</button>
  <span class="value">${this.value}</span>
  <button ?disabled=${!this.canIncrement} aria-label="Increment" @click=${this.increment}>+</button>
</div>
`;
  }

  get canIncrement() { return this.value + this.step <= this.max; }

  get canDecrement() { return this.value - this.step >= this.min; }

  increment = () => {
  if (this.canIncrement) this.value += this.step;
};

  decrement = () => {
  if (this.canDecrement) this.value -= this.step;
};

  get value(): number { return this._valueControllable.read(); }
  set value(v: number) { this._valueControllable.write(v); }
}
