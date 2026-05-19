import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { debounce } from '@rozie/runtime-lit';

@customElement('rozie-search-input')
export default class SearchInput extends SignalWatcher(LitElement) {
  static styles = css`
.search-input[data-rozie-s-8bbc4a60] { display: inline-flex; align-items: center; gap: 0.25rem; }
input[data-rozie-s-8bbc4a60] { padding: 0.25rem 0.5rem; }
.clear-btn[data-rozie-s-8bbc4a60] { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.hint[data-rozie-s-8bbc4a60] { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
`;

  @property({ type: String, reflect: true }) placeholder: string = 'Search…';
  @property({ type: Number, reflect: true }) minLength: number = 2;
  @property({ type: Boolean, reflect: true }) autofocus: boolean = false;
  private _query = signal('');
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;

  private _tw0 = debounce((e: Event) => ((this.onSearch) as (...args: any[]) => any)(e), 300);

  private _disconnectCleanups: Array<() => void> = [];

  private _armListeners(): void {
    this._disconnectCleanups.push(() => this._tw0.cancel());
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this._armListeners();
  }

  firstUpdated(): void {
    this._armListeners();

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
<div class="search-input" data-rozie-s-8bbc4a60>
  
  <input type="search" placeholder=${this.placeholder} .value=${this._query.value} @input=${(e: InputEvent) => { ((e) => this._query.value = (e.target as HTMLInputElement).value)(e); (this._tw0)(e); }} @keydown=${(e: KeyboardEvent) => { ((e: KeyboardEvent) => { if (e.key !== 'Enter') return; ((this.onSearch) as (...args: any[]) => any)(e); })(e); ((e: KeyboardEvent) => { if (e.key !== 'Escape') return; ((this.clear) as (...args: any[]) => any)(e); })(e); }} data-rozie-ref="inputEl" data-rozie-s-8bbc4a60 />

  ${this._query.value.length > 0 ? html`<button class="clear-btn" aria-label="Clear" @click=${this.clear} data-rozie-s-8bbc4a60>
    ×
  </button>` : html`<span class="hint" data-rozie-s-8bbc4a60>${this.minLength}+ chars</span>`}</div>
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
