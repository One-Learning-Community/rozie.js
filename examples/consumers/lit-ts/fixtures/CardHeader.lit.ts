import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';

@customElement('rozie-card-header')
export default class CardHeader extends SignalWatcher(LitElement) {
  static styles = css`
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
.card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
.card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
`;

  @property({ type: String, reflect: true }) title: string = '';
  @property({ type: Function }) onClose: ((...args: unknown[]) => unknown) | null = null;

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<header class="card-header">
  <h3 class="card-header__title">${this.title}</h3>
  ${this.onClose ? html`<button class="card-header__close" @click=${this.onClose}>×</button>` : nothing}</header>
`;
  }
}
