import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-inline-expr-handler')
export default class InlineExprHandler extends SignalWatcher(LitElement) {
  static styles = css`
.backdrop[data-rozie-s-8ec7623e] { position: fixed; inset: 0; }
`;

  @property({ type: Boolean, reflect: true }) closeOnBackdrop: boolean = true;
  private _open = signal(false);

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="backdrop" @click=${(e: Event) => { this.closeOnBackdrop && this.close(); }} data-rozie-s-8ec7623e>
  
  <button @click=${this.close} data-rozie-s-8ec7623e>Close</button>
</div>
`;
  }

  close = () => {
  this._open.value = false;
};
}
