import { LitElement, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
// The provider api.js loader (inject-once singleton + poll/timeout/error) lives
// in a vendored internal module so its branchy logic is unit-tested independent
// of any framework (see internal/loadCaptchaApi.test.ts). codegen copies
// src/internal/ into every leaf, so this relative import resolves verbatim ×6.
import { loadCaptchaApi } from './internal/loadCaptchaApi';

// Live widget handle. Top-level lets → React hoists to useRef (setup-once).
// `disposed` MUST be top-level (not declared inside $onMount): the Solid emitter
// extracts the teardown into a separate onCleanup() whose scope can't see a
// mount-body local, so a `let disposed` inside $onMount is out of scope in the
// teardown (TS2304). Top-level — like api/widgetId — is visible to both.

@customElement('rozie-captcha')
export default class Captcha extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) provider: string = 'recaptcha';
  @property({ type: String, reflect: true }) sitekey!: string;
  @property({ type: String, attribute: 'token' }) _token_attr: string = '';
  private _tokenControllable = createLitControllableProperty<string>({ host: this, eventName: 'token-change', defaultValue: '', initialControlledValue: undefined });
  @property({ type: String, reflect: true }) theme: string = 'light';
  @property({ type: String, reflect: true }) size: string = 'normal';
  @property({ type: Number, reflect: true }) tabindex: number = null;
  @property({ type: Object }) options: any = {};
  @query('[data-rozie-ref="widgetEl"]') private _refWidgetEl!: HTMLElement;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this._disconnectCleanups.push((() => {
      this.disposed = true;
      if (this.widgetId == null || !this.api) return;
      // Turnstile fully removes a widget; reCAPTCHA/hCaptcha only reset.
      if (typeof this.api.remove === 'function') this.api.remove(this.widgetId);else if (typeof this.api.reset === 'function') this.api.reset(this.widgetId);
    }));

    this.disposed = false;
    loadCaptchaApi(this.provider).then((a: any) => {
      if (this.disposed) return;
      this.api = a;
      this.widgetId = this.api.render(this._refWidgetEl, this.buildConfig());
    }).catch((err: any) => {
      this.dispatchEvent(new CustomEvent("error", {
        detail: {
          provider: this.provider,
          error: err
        },
        bubbles: true,
        composed: true
      }));
    });
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

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'token') this._tokenControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="rozie-captcha" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="widgetEl" data-rozie-s-9c7749d4></div>
`;
  }

  api: any = null;

  widgetId: any = null;

  disposed = false;

  buildConfig = () => ({
  sitekey: this.sitekey,
  theme: this.theme,
  size: this.size,
  ...(this.tabindex != null ? {
    tabindex: this.tabindex
  } : {}),
  callback: (token: any) => {
    this._tokenControllable.write(token);
    this.dispatchEvent(new CustomEvent("verify", {
      detail: {
        token,
        provider: this.provider
      },
      bubbles: true,
      composed: true
    }));
  },
  'expired-callback': () => {
    this._tokenControllable.write('');
    this.dispatchEvent(new CustomEvent("expire", {
      detail: {
        provider: this.provider
      },
      bubbles: true,
      composed: true
    }));
  },
  'error-callback': () => {
    this._tokenControllable.write('');
    this.dispatchEvent(new CustomEvent("error", {
      detail: {
        provider: this.provider
      },
      bubbles: true,
      composed: true
    }));
  },
  ...this.options
});

  reset() {
    if (this.widgetId != null && this.api && typeof this.api.reset === 'function') this.api.reset(this.widgetId);
    this._tokenControllable.write('');
  }

  execute() {
    if (this.widgetId != null && this.api && typeof this.api.execute === 'function') this.api.execute(this.widgetId);
  }

  getResponse() {
    return this.widgetId != null && this.api && typeof this.api.getResponse === 'function' ? this.api.getResponse(this.widgetId) : '';
  }

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
    const __skip = new Set<string>(['provider', 'sitekey', 'token', 'theme', 'size', 'tabindex', 'options']);
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
