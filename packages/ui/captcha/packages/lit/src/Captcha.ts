import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
// The provider api.js loader (inject-once singleton + poll/timeout/error) lives
// in a vendored internal module so its branchy logic is unit-tested independent
// of any framework (see internal/loadCaptchaApi.test.ts). codegen copies
// src/internal/ into every leaf, so this relative import resolves verbatim ×6.
import { loadCaptchaApi } from './internal/loadCaptchaApi';

// Live widget handle. Top-level lets → React hoists to useRef (setup-once).
// `api`/`widgetId` MUST be top-level — reset()/execute()/getResponse() (the
// $expose'd imperative handle, callable any time) read them outside $onMount.

@customElement('rozie-captcha')
export default class Captcha extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  /**
   * Which widget to render: `recaptcha` (Google reCAPTCHA v2), `hcaptcha`, `turnstile` (Cloudflare), or `friendly` (Friendly Captcha). The first three share a near-identical explicit-render API; Friendly Captcha rides an internal `adapt()` bridge onto the same surface. Construction-time — re-key the component to switch it live.
   */
  @property({ type: String, reflect: true }) provider: string = 'recaptcha';
  /**
   * Required. The public site key from your provider dashboard. Identifies your site to the chosen provider.
   */
  @property({ type: String, reflect: true }) sitekey!: string;
  /**
   * The verified response token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written by the widget on success and cleared on expire/reset, so reading it gives you the live response to send to your server for form submission.
   * @example
   * <Captcha r-model:token="token" provider="recaptcha" sitekey="…" />
   */
  @property({ type: String, attribute: 'token' }) _token_attr: string = '';
  private _tokenControllable = createLitControllableProperty<string>({ host: this, eventName: 'token-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * Widget color theme: `light` or `dark` (all three core providers), or `auto` (Turnstile only). Construction-time — re-key the component to change it live.
   */
  @property({ type: String, reflect: true }) theme: string = 'light';
  /**
   * Widget size. reCAPTCHA/hCaptcha accept `normal`/`compact`/`invisible`; Turnstile accepts `normal`/`compact`/`flexible`. A no-op for Friendly Captcha (its `startMode` analog rides through the `options` escape hatch instead). Construction-time.
   */
  @property({ type: String, reflect: true }) size: string = 'normal';
  /**
   * Optional tab index forwarded to the rendered widget. Omitted from the render config when left unset (`null`).
   */
  @property({ type: Number, reflect: true }) tabindex: number | null = null;
  /**
   * Escape hatch — provider-specific render options merged last (e.g. Turnstile `action`/`cData`/`retry`, hCaptcha `hl`, reCAPTCHA `badge`, Friendly Captcha `startMode`). Lets you reach keys this component does not promote to first-class props.
   */
  @property({ type: Object }) options: any = {};
  @query('[data-rozie-ref="widgetEl"]') private _refWidgetEl!: HTMLElement;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this._disconnectCleanups.push((() => {
      disposed = true;
      if (this.widgetId == null || !this.api) return;
      // Turnstile fully removes a widget; reCAPTCHA/hCaptcha only reset.
      if (typeof this.api.remove === 'function') this.api.remove(this.widgetId);else if (typeof this.api.reset === 'function') this.api.reset(this.widgetId);
    }));

    // Mount-local (not top-level) — read only by this closure's own async
    // .then()/.catch() and the returned teardown below. Emitter-hardening
    // backlog item #2 (project_emitter_hardening_backlog): every target keeps
    // a $onMount setup-local in scope for its own returned teardown, so this
    // no longer needs the prior TOP-LEVEL-`let` workaround (unlike `api`/
    // `widgetId` above, which stay top-level for the unrelated $expose reason).
    let disposed = false;
    loadCaptchaApi(this.provider).then((a: any) => {
      if (disposed) return;
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

  buildConfig = () => ({
  sitekey: this.sitekey,
  theme: this.theme,
  size: this.size,
  ...(this.tabindex != null ? {
    tabindex: this.tabindex
  } : {}),
  // NB: the param must NOT be named `token` — on Vue, $model.token lowers to a
  // `defineModel('token')` ref named `token`, and a same-named param shadows it
  // (`token.value = token` would write the param, not the model → v-model:token
  // never populates). Vue-only footgun (React/Solid lower to a setToken call).
  callback: (response: any) => {
    this._tokenControllable.write(response);
    this.dispatchEvent(new CustomEvent("verify", {
      detail: {
        token: response,
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
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'provider', 'sitekey', 'token', 'theme', 'size', 'tabindex', 'options']);
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
