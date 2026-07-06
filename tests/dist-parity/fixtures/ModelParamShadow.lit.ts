import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-model-param-shadow')
export default class ModelParamShadow extends SignalWatcher(LitElement) {
  @property({ type: String, attribute: 'token' }) _token_attr: string = '';
  private _tokenControllable = createLitControllableProperty<string>({ host: this, eventName: 'token-change', defaultValue: '', initialControlledValue: undefined });
  private _status = signal('');

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
    if (name === 'token') this._tokenControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="model-param-shadow" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-9db1b80e>
  <button @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.solve('demo-token'); }} data-rozie-s-9db1b80e>solve</button>
  <button @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.setStatus('ready'); }} data-rozie-s-9db1b80e>status</button>
  <button @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.logLabel('hi'); }} data-rozie-s-9db1b80e>label</button>
  <span class="status" data-rozie-s-9db1b80e>${this._status.value}</span>
</div>
`;
  }

  get label() { return this._status.value + '!'; }

  solve = (token: any) => {
  this._tokenControllable.write(token);
  this.dispatchEvent(new CustomEvent("verify", {
    detail: {
      token
    },
    bubbles: true,
    composed: true
  }));
};

  setStatus = (status: any) => {
  this._status.value = status;
};

  logLabel = (label: any) => {
  this.dispatchEvent(new CustomEvent("verify", {
    detail: {
      token: label
    },
    bubbles: true,
    composed: true
  }));
};

  get token(): string { return this._tokenControllable.read(); }
  set token(v: string) { this._tokenControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['token']);
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
