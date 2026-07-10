import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-cva-off-state')
export default class CvaOffState extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.cva-off-state[data-rozie-s-a2873aa8] { display: inline-flex; align-items: center; gap: 0.5rem; }
input[data-rozie-s-a2873aa8] { padding: 0.25rem 0.5rem; }
.echo[data-rozie-s-a2873aa8] { color: rgba(0, 0, 0, 0.6); }
`;

  @property({ type: String, attribute: 'value' }) _value_attr: string = '';
  private _valueControllable = createLitControllableProperty<string>({ host: this, eventName: 'value-change', defaultValue: '', initialControlledValue: undefined });

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

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="cva-off-state" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-a2873aa8>
  <input type="text" .value=${this.value} placeholder="Type a value" @input=${this.onInput} data-rozie-s-a2873aa8 />
  <span class="echo" data-rozie-s-a2873aa8>${this.value}</span>
</div>
`;
  }

  onInput(e: any) {
    this._valueControllable.write(e.target.value);
  }

  get value(): string { return this._valueControllable.read(); }
  set value(v: string) { this._valueControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['value']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
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
