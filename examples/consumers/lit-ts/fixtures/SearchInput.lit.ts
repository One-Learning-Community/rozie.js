import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';

@customElement('rozie-search-input')
export default class SearchInput extends SignalWatcher(LitElement) {
  static styles = css`
.search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
input { padding: 0.25rem 0.5rem; }
.clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
`;

  @property({ type: String, reflect: true }) placeholder: string = 'Search…';
  @property({ type: Number, reflect: true }) minLength: number = 2;
  @property({ type: Boolean, reflect: true }) autofocus: boolean = false;
  private _query = signal('');
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;

  private _disconnectCleanups: Array<() => void> = [];

  firstUpdated(): void {
    this._disconnectCleanups.push((() => {
      // e.g., abort an in-flight request initialized in this hook
    }));

    if (this.autofocus) this._refInputEl?.focus();

    // Returning a function from $onMount registers a teardown — equivalent to
    // a separate $onUnmount, useful when setup and teardown logic belong together.
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="search-input">
  
  <input type="search" placeholder=${this.placeholder} .value=${this._query.value} @input=${(e) => this._query.value = (e.target as HTMLInputElement).value} @input=${this.onSearch} @keydown=${(e: Event) => { if ((e as KeyboardEvent).key !== 'Enter') return; (this.onSearch)(e); }} @keydown=${(e: Event) => { if ((e as KeyboardEvent).key !== 'Escape') return; (this.clear)(e); }} data-rozie-ref="inputEl" />

  ${this._query.value.length > 0 ? html`<button class="clear-btn" aria-label="Clear" @click=${this.clear}>
    ×
  </button>` : html`<span class="hint">${this.minLength}+ chars</span>`}</div>
`;
  }

  get isValid() { return this._query.value.length >= this.minLength; }

  onSearch = () => {
  if (this.isValid) this.dispatchEvent(new CustomEvent("search", {
    detail: this._query.value,
    bubbles: true,
    composed: true
  }));
};

  clear = () => {
  this._query.value = '';
  this.dispatchEvent(new CustomEvent("clear", {
    detail: undefined,
    bubbles: true,
    composed: true
  }));
};
}
