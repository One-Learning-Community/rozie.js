import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import './producer.rozie';
import './producer.rozie';

@customElement('rozie-consumer')
export default class Consumer extends SignalWatcher(LitElement) {
  private _outerOpen = signal(true);
  private _innerVal = signal('hello');

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<rozie-producer .open=${this._outerOpen.value} @open-change=${(e: CustomEvent) => { this._outerOpen.value = e.detail; }} .footer=${(scope: { close: unknown }) => html`
    <rozie-inner .open=${this._outerOpen.value} @open-change=${(e: CustomEvent) => { this._outerOpen.value = e.detail; }}></rozie-inner>
    <button @click=${scope.close}>×</button>
  `}></rozie-producer>
`;
  }
}
