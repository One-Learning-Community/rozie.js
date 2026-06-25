import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-editor-select')
export default class EditorSelect extends SignalWatcher(LitElement) {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
   */
  @property({ type: String, reflect: true }) columnId: string = '';
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  @property({ type: Object }) column: unknown = null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  @property({ type: Object }) row: unknown = null;
  /**
   * The current cell value the `<select>` binds to (String-coerced).
   */
  @property({ type: Object }) value: unknown = null;
  /**
   * `(value) => void` — commit the cell. This editor immediately commits the selected value on `@change`. Null-guarded at call sites.
   */
  @property({ type: Function }) commit: ((...args: unknown[]) => unknown) | null = null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  @property({ type: Function }) cancel: ((...args: unknown[]) => unknown) | null = null;
  /**
   * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
   */
  @property({ type: Array }) options: any[] = [];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

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
<select class="rdt-cell-editor" data-editing-cell="" aria-label=${this.columnId} .value=${this.selectValue()} @change=${($event: Event) => { this.onChange($event); }} @keydown=${($event: Event) => { this.onKeydown($event); }} data-rozie-s-117f1a16>
  ${repeat<any>(this.options, (opt, _idx) => opt.value, (opt, _idx) => html`<option key=${rozieAttr(opt.value)} value=${rozieAttr(opt.value)} data-rozie-s-117f1a16>${rozieDisplay(opt.label)}</option>`)}
</select>
`;
  }

  selectValue = () => this.value != null ? String(this.value) : '';

  onChange = (e: any) => {
  this.commit && this.commit(e && e.target ? e.target.value : '');
};

  onKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    this.cancel && this.cancel();
  }
};
}
