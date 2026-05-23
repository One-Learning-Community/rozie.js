import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { adoptConsumerStyles } from '@rozie/runtime-lit';
import { ref } from 'lit/directives/ref.js';
import './producer.rozie';

@customElement('rozie-consumer')
export default class Consumer extends SignalWatcher(LitElement) {
  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
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
