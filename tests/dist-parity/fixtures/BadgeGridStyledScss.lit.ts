import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-badge-grid-styled-scss')
export default class BadgeGridStyledScss extends SignalWatcher(LitElement) {
  static styles = css`
.badge[data-rozie-s-44801268] {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  font-weight: 600;
}
.badge-grid[data-rozie-s-44801268] {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.badge[data-rozie-s-44801268] {
  padding: 2px 8px;
}
.badge--neutral[data-rozie-s-44801268] {
  color: #ffffff;
  background: #6b7280;
}
.badge--success[data-rozie-s-44801268] {
  color: #ffffff;
  background: #16a34a;
}
.badge--warning[data-rozie-s-44801268] {
  color: #ffffff;
  background: #d97706;
}
.badge--danger[data-rozie-s-44801268] {
  color: #ffffff;
  background: #dc2626;
}
.badge-grid--gap-1[data-rozie-s-44801268] {
  gap: 4px;
}
.badge-grid--gap-2[data-rozie-s-44801268] {
  gap: 8px;
}
.badge-grid--gap-3[data-rozie-s-44801268] {
  gap: 12px;
}
`;

  @property({ type: Array }) badges: any[] = [];

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="badge-grid" data-rozie-s-44801268>
  ${repeat<any>(this.badges, (badge, _idx) => badge, (badge, _idx) => html`<span class="badge badge--neutral" key=${badge} data-rozie-s-44801268>
    ${badge}
  </span>`)}
</div>
`;
  }
}
