import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-inline-expr-handler')
export default class InlineExprHandler extends SignalWatcher(LitElement) {
  static styles = css`
.backdrop[data-rozie-s-8ec7623e] { position: fixed; inset: 0; }
`;

  @property({ type: Boolean, reflect: true }) closeOnBackdrop: boolean = true;
  private _open = signal(false);

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="backdrop" ${rozieSpread(this.$attrs)} @click=${($event: Event) => { this.closeOnBackdrop && this.close(); }} data-rozie-s-8ec7623e>
  
  <button @click=${this.close} data-rozie-s-8ec7623e>Close</button>
</div>
`;
  }

  close = () => {
  this._open.value = false;
};

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   */
  private get $attrs(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) out[a.name] = a.value;
    return out;
  }
}
