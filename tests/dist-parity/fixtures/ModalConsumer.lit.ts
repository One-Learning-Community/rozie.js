import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { adoptConsumerStyles, rozieSpread } from '@rozie/runtime-lit';
import { ref } from 'lit/directives/ref.js';
import './Modal.rozie';
import './WrapperModal.rozie';

@customElement('rozie-modal-consumer')
export default class ModalConsumer extends SignalWatcher(LitElement) {
  static styles = css`
.modal-consumer[data-rozie-s-5d081d3a] { display: flex; flex-direction: column; gap: 1rem; }
.close[data-rozie-s-5d081d3a] { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.dynamic-fill[data-rozie-s-5d081d3a] { font-weight: bold; }
`;

  @property({ type: String, reflect: true }) title: string = 'Confirm';
  private _open1 = signal(true);
  private _open2 = signal(true);
  private _open3 = signal(true);
  private _slotName = signal('header');

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="modal-consumer" ${rozieSpread(this.$attrs)} data-rozie-s-5d081d3a>
  <rozie-modal .open=${this._open1.value} @open-change=${($event: CustomEvent) => { this._open1.value = $event.detail; }} data-rozie-s-5d081d3a .header=${(scope: { close: unknown }) => html`
      <h2 data-rozie-s-5d081d3a>${this.title}</h2>
      <button class="close" @click=${scope.close} data-rozie-s-5d081d3a>×</button>
    `} .footer=${(scope: { close: unknown }) => html`
      <button @click=${scope.close} data-rozie-s-5d081d3a>Cancel</button>
      <button @click=${($event: Event) => { this.onConfirm(); }} data-rozie-s-5d081d3a>OK</button>
    `} ${ref((el: Element | undefined) => el && adoptConsumerStyles(el, (this.constructor as { styles?: unknown }).styles))}>
    Are you sure you want to proceed?
    </rozie-modal>

  <rozie-modal .open=${this._open2.value} @open-change=${($event: CustomEvent) => { this._open2.value = $event.detail; }} data-rozie-s-5d081d3a><div slot="${this._slotName.value}">
      <span class="dynamic-fill" data-rozie-s-5d081d3a>Dynamic header via slotName</span>
    </div>
    Dynamic-name demo body
  </rozie-modal>

  <rozie-wrapper-modal .open=${this._open3.value} @open-change=${($event: CustomEvent) => { this._open3.value = $event.detail; }} .title=${this.title} data-rozie-s-5d081d3a><h2 data-rozie-s-5d081d3a slot="brand">Re-projected brand</h2><button data-rozie-s-5d081d3a slot="actions">Wrapper action</button>
    Body via wrapper's default slot
    </rozie-wrapper-modal>
</div>
`;
  }

  onConfirm() {
    this._open1.value = false;
  }

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
