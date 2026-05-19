import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-connected-rearm')
export default class ConnectedRearm extends SignalWatcher(LitElement) {
  static styles = css`
.rearm[data-rozie-s-453272bf] { font-variant-numeric: tabular-nums; }
`;

  private _pressed = signal(0);

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    const _lh0 = (e: KeyboardEvent) => {  ((this.onKey) as (...args: any[]) => any)(e); };
    document.addEventListener('keydown', _lh0, undefined);
    this._disconnectCleanups.push(() => document.removeEventListener('keydown', _lh0, undefined));
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this._armListeners();
  }

  firstUpdated(): void {
    this._armListeners();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="rearm" data-rozie-s-453272bf>${this._pressed.value}</div>
`;
  }

  onKey = () => {
  this._pressed.value += 1;
};
}
