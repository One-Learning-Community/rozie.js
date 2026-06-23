import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-filter-text')
export default class FilterText extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) columnId: string = '';
  @property({ type: Object }) column: unknown = null;
  @property({ type: Object }) value: unknown = null;
  @property({ type: Function }) setFilter: ((...args: unknown[]) => unknown) | null = null;
  private _draft = signal('');

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    // Seed the draft once at setup from the incoming value (setup-once, NOT in the
    // template). Normalize null/undefined to '' so the input value binds to a string.
    this._draft.value = this.value != null ? String(this.value) : '';

    // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
    // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`
<input class="rdt-col-filter" type="text" aria-label=${this.columnId} .value=${this._draft.value} @input=${($event: Event) => { this.onInput($event); }} @keydown=${($event: Event) => { this.onKeydown($event); }} @blur=${($event: Event) => { this.onBlur(); }} data-rozie-s-18cbb44e />
`;
  }

  onInput = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
};

  applyFilter = () => {
  this.setFilter && this.setFilter(this.columnId, this._draft.value);
};

  clearFilter = () => {
  this._draft.value = '';
  this.setFilter && this.setFilter(this.columnId, '');
};

  onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    this.applyFilter();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    this.clearFilter();
  }
};

  onBlur = () => {
  this.applyFilter();
};
}
