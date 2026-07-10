import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { debounce, rozieListeners } from '@rozie/runtime-lit';

@customElement('rozie-r-on-probe')
export default class ROnProbe extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.r-on-probe[data-rozie-s-c4bd99aa] {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.25rem;
}
.r-on-probe[data-rozie-s-c4bd99aa] span[data-rozie-s-c4bd99aa] {
  display: inline-block;
  padding: 0.125rem 0.25rem;
}
`;

  private _fn = signal(() => {});
  private _onInput = signal(() => {});
  private _f1 = signal(() => {});
  private _f2 = signal(() => {});
  private _someObj = signal({
  click: () => {},
  mouseenter: () => {}
});

  private _tw0 = debounce(($event: Event) => ((this._onInput.value) as (...args: any[]) => any)($event), 300);

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    this._disconnectCleanups.push(() => this._tw0.cancel());
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();
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
<div class="r-on-probe" data-rozie-s-c4bd99aa>
  <span @click=${($event: MouseEvent & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { $event.stopPropagation(); ((this._fn.value) as (...args: any[]) => any)($event); }} @input=${this._tw0} data-rozie-s-c4bd99aa>literal modifier-bearing</span>
  <span ${rozieListeners(this._someObj.value)} data-rozie-s-c4bd99aa>dynamic</span>
  <span @click=${($event: MouseEvent & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { (this._f1.value)($event); (this._f2.value)($event); }} data-rozie-s-c4bd99aa>R6 source-order merge</span>
</div>
`;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
