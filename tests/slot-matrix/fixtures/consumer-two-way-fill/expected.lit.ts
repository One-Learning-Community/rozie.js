import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { adoptConsumerStyles } from '@rozie/runtime-lit';
import { ref } from 'lit/directives/ref.js';
import './producer.rozie';
import './producer.rozie';

@customElement('rozie-consumer')
export default class Consumer extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  private _outerOpen = signal(true);
  private _innerVal = signal('hello');

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`
<rozie-producer .open=${this._outerOpen.value} @open-change=${($event: CustomEvent) => { this._outerOpen.value = $event.detail; }} data-rozie-s-bd0c3708 .footer=${(scope: { close: any }) => html`
    <rozie-inner .open=${this._outerOpen.value} @open-change=${($event: CustomEvent) => { this._outerOpen.value = $event.detail; }} data-rozie-s-bd0c3708></rozie-inner>
    <button @click=${scope.close} data-rozie-s-bd0c3708>×</button>
  `} ${ref((el: Element | undefined) => el && adoptConsumerStyles(el, (this.constructor as { styles?: unknown }).styles))}></rozie-producer>
`;
  }
}
