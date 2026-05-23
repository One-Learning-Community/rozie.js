import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import './wrapper.rozie';

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
<rozie-wrapper data-rozie-s-bd0c3708><div slot="title">Hello from consumer</div></rozie-wrapper>
`;
  }
}
