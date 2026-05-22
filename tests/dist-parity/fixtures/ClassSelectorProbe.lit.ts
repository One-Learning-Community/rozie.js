import { LitElement, css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-class-selector-probe')
export default class ClassSelectorProbe extends SignalWatcher(LitElement) {
  static styles = css`
.panel[data-rozie-s-899140be] {
  display: block;
  padding: 0.5rem;
  font-family: system-ui, -apple-system, sans-serif;
}
.grip[data-rozie-s-899140be] {
  cursor: grab;
  user-select: none;
  color: rgba(0, 0, 0, 0.35);
}
`;

  private _ready = signal(false);

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    this._ready.value = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="panel" data-handle=${".panel"} data-grip=${this.gripSelector} data-rozie-s-899140be>
  <span class="grip" aria-hidden="true" data-rozie-s-899140be>⋮⋮</span>
  ${this._ready.value ? html`<span data-rozie-s-899140be>ready</span>` : nothing}</div>
`;
  }

  gripSelector = ".grip";
}
