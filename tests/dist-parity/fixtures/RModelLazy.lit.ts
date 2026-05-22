import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-rmodel-lazy')
export default class RModelLazy extends SignalWatcher(LitElement) {
  static styles = css`
.rmodel-lazy[data-rozie-s-34fe9f5a] { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo[data-rozie-s-34fe9f5a] { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
`;

  private _draft = signal('');

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="rmodel-lazy" data-rozie-s-34fe9f5a>
  <input type="text" placeholder="Commit on blur" .value=${this._draft.value} @change=${($event) => this._draft.value = ($event.target as HTMLInputElement).value} data-rozie-s-34fe9f5a />
  <p class="echo" data-rozie-s-34fe9f5a>Committed: ${this._draft.value}</p>
</div>
`;
  }
}
