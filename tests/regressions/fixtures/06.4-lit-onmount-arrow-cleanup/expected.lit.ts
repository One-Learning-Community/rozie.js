import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-on-mount-arrow-cleanup')
export default class OnMountArrowCleanup extends SignalWatcher(LitElement) {
  static styles = css`
.ticker { font-variant-numeric: tabular-nums; }
`;

  private _ticks = signal(0);
  private _running = signal(true);

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    this._disconnectCleanups.push((() => window.removeEventListener('resize', this.onResize)));

    window.addEventListener('resize', this.onResize);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="ticker">${this._ticks.value}</div>
`;
  }

  onResize = () => {
  this._ticks.value += 1;
};
}
