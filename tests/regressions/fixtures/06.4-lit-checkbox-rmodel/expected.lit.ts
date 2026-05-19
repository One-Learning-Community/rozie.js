import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty } from '@rozie/runtime-lit';

@customElement('rozie-checkbox-rmodel')
export default class CheckboxRModel extends SignalWatcher(LitElement) {
  static styles = css`
.toggle[data-rozie-s-5898a126] { display: inline-flex; gap: 0.25rem; align-items: center; }
`;

  @property({ type: Boolean, attribute: 'checked' }) _checked_attr: boolean = false;
  private _checkedControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'checked-change', defaultValue: false, initialControlledValue: undefined });

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'checked') this._checkedControllable.notifyAttributeChange(value !== null);
  }

  render() {
    return html`
<label class="toggle" data-rozie-s-5898a126>
  
  <input type="checkbox" .checked=${this.checked} @change=${($event) => this.checked = ($event.target as HTMLInputElement).checked} data-rozie-s-5898a126 />
  <span data-rozie-s-5898a126>Enabled</span>
</label>
`;
  }

  get checked(): boolean { return this._checkedControllable.read(); }
  set checked(v: boolean) { this._checkedControllable.write(v); }
}
