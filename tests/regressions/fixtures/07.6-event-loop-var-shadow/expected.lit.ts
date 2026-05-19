import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-event-loop-var-shadow')
export default class EventLoopVarShadow extends SignalWatcher(LitElement) {
  private _items = signal([{
  id: 'a',
  label: 'A'
}, {
  id: 'b',
  label: 'B'
}]);

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<ul data-rozie-s-a955b18d>
  ${repeat<any>(this._items.value, (e, _idx) => e.id, (e, _idx) => html`<li key=${e.id} data-rozie-s-a955b18d>
    <span data-rozie-s-a955b18d>${e.label}</span>
    
    <button type="button" @click=${($event: Event) => { this.removeItem(e.id); }} data-rozie-s-a955b18d>×</button>
  </li>`)}
</ul>
`;
  }

  removeItem = id => {
  this._items.value = this._items.value.filter(x => x.id !== id);
};
}
