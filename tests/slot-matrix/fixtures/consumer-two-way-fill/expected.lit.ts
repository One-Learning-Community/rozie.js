import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { adoptConsumerStyles } from '@rozie/runtime-lit';
import { ref } from 'lit/directives/ref.js';
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
<rozie-producer .open=${this._outerOpen.value} @open-change=${($event: CustomEvent) => { this._outerOpen.value = $event.detail; }} .footer=${(scope: { close: unknown }) => html`
    <rozie-inner .open=${this._outerOpen.value} @open-change=${($event: CustomEvent) => { this._outerOpen.value = $event.detail; }}></rozie-inner>
    <button @click=${scope.close} data-rozie-s-bd0c3708>×</button>
  `} ${ref((el: Element | undefined) => el && adoptConsumerStyles(el, (this.constructor as { styles?: unknown }).styles))}></rozie-producer>
`;
  }
}
