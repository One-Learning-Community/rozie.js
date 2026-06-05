import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { adoptConsumerStyles } from '@rozie/runtime-lit';
import { ref } from 'lit/directives/ref.js';
import './producer.rozie';

@customElement('rozie-consumer')
export default class Consumer extends SignalWatcher(LitElement) {
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
<rozie-producer data-rozie-s-bd0c3708 .header=${(scope: { close: unknown }) => html`
    <button @click=${scope.close} data-rozie-s-bd0c3708>×</button>
  `} ${ref((el: Element | undefined) => el && adoptConsumerStyles(el, (this.constructor as { styles?: unknown }).styles))}>
  Body text
</rozie-producer>
`;
  }
}
