import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr } from '@rozie/runtime-lit';

@customElement('rozie-filter-number-range')
export default class FilterNumberRange extends SignalWatcher(LitElement) {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
   */
  @property({ type: String, reflect: true }) columnId: string = '';
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  @property({ type: Object }) column: unknown = null;
  /**
   * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
   */
  @property({ type: Function }) setFilter: ((...args: unknown[]) => unknown) | null = null;
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
  @property({ type: Object }) minMax: unknown = null;
  private _minDraft = signal('');
  private _maxDraft = signal('');

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    // Seed both drafts once at setup from the incoming [min,max] tuple (setup-once).
    this._minDraft.value = Array.isArray(this.value) && this.value[0] != null ? String(this.value[0]) : '';
    this._maxDraft.value = Array.isArray(this.value) && this.value[1] != null ? String(this.value[1]) : '';

    // Untyped handler params neutralize to `any` (the global-filter idiom).
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
<span style="display:flex; align-items: center" data-rozie-s-97b2c090>
  <input class="rdt-col-filter" part="col-filter" type="number" aria-label=${rozieAttr(this.columnId + ' min')} placeholder=${rozieAttr(this.minPlaceholder())} .value=${this._minDraft.value} @input=${($event: Event) => { this.onMinInput($event); }} @change=${($event: Event) => { this.applyRange(); }} data-rozie-s-97b2c090 />
  <span data-rozie-s-97b2c090> - </span>
  <input class="rdt-col-filter" part="col-filter" type="number" aria-label=${rozieAttr(this.columnId + ' max')} placeholder=${rozieAttr(this.maxPlaceholder())} .value=${this._maxDraft.value} @input=${($event: Event) => { this.onMaxInput($event); }} @change=${($event: Event) => { this.applyRange(); }} data-rozie-s-97b2c090 />
</span>
`;
  }

  onMinInput = (e: any) => {
  this._minDraft.value = e && e.target ? e.target.value : '';
};

  onMaxInput = (e: any) => {
  this._maxDraft.value = e && e.target ? e.target.value : '';
};

  minPlaceholder = () => Array.isArray(this.minMax) && this.minMax[0] != null ? String(this.minMax[0]) : '';

  maxPlaceholder = () => Array.isArray(this.minMax) && this.minMax[1] != null ? String(this.minMax[1]) : '';

  applyRange = () => {
  const minNum = this._minDraft.value === '' ? undefined : Number(this._minDraft.value);
  const maxNum = this._maxDraft.value === '' ? undefined : Number(this._maxDraft.value);
  if (minNum === undefined && maxNum === undefined) {
    this.setFilter && this.setFilter(this.columnId, '');
  } else {
    this.setFilter && this.setFilter(this.columnId, [minNum, maxNum]);
  }
};
}
