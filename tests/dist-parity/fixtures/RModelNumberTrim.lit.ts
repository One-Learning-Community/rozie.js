import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-rmodel-number-trim')
export default class RModelNumberTrim extends SignalWatcher(LitElement) {
  static styles = css`
.rmodel-number-trim[data-rozie-s-dfdb7742] { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo[data-rozie-s-dfdb7742] { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
`;

  private _quantity = signal(0);

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="rmodel-number-trim" data-rozie-s-dfdb7742>
  <input type="text" placeholder="Enter a quantity" .value=${this._quantity.value} @input=${($event) => this._quantity.value = (Number.isNaN(Number.parseFloat(((($event.target as HTMLInputElement).value).trim()))) ? ((($event.target as HTMLInputElement).value).trim()) : Number.parseFloat(((($event.target as HTMLInputElement).value).trim())))} data-rozie-s-dfdb7742 />
  <p class="echo" data-rozie-s-dfdb7742>Quantity: ${this._quantity.value}</p>
</div>
`;
  }
}
