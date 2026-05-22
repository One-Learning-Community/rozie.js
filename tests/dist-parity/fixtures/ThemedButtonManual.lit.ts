import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieSpread } from '@rozie/runtime-lit';
import { styleMap } from 'lit/directives/style-map.js';

@customElement('rozie-themed-button-manual')
export default class ThemedButtonManual extends SignalWatcher(LitElement) {
  static styles = css`
.btn[data-rozie-s-671f0616] {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: var(--btn-bg, #3b82f6);
  color: var(--btn-fg, #ffffff);
  font: inherit;
  cursor: pointer;
}
.btn[data-rozie-s-671f0616]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;

  @property({ type: String, reflect: true }) label: string = 'Click me';
  @property({ type: String, reflect: true }) variant: string = 'primary';

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<button class="btn ${(this.variant)}" style=${styleMap({ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' })} ${rozieSpread(this.$attrs)} data-rozie-s-671f0616>
  ${this.label}
</button>
`;
  }
}
