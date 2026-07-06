import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
// The v3 api.js loader (inject-once-per-sitekey singleton + ready-gate + token
// execute) lives in a vendored internal module so its branchy logic is
// unit-tested independent of any framework (see internal/loadRecaptchaV3.test.ts).
// codegen copies src/internal/ into every leaf, so this import resolves ×6.
import { loadRecaptchaV3, execute as v3Execute } from './internal/loadRecaptchaV3';

// `disposed` MUST be top-level (not $onMount-local): the exported `execute()`
// below — callable any time via `$expose({ execute })`, including after
// unmount — reads it to guard a late resolve that fires post-unmount. That
// cross-function visibility (not a per-target emitter limitation) is why this
// one stays top-level even after emitter-hardening backlog item #2 landed
// (contrast Captcha.rozie's `disposed`, which IS $onMount-local — its
// exposed handle functions don't read it).

@customElement('rozie-recaptcha-v3')
export default class RecaptchaV3 extends SignalWatcher(LitElement) {
  /**
   * Required. The public reCAPTCHA v3 site key from your Google admin console.
   */
  @property({ type: String, reflect: true }) sitekey!: string;
  /**
   * The default action label reported to reCAPTCHA's risk analysis (e.g. `submit`, `login`). Overridable per call via `execute(action)`.
   */
  @property({ type: String, reflect: true }) action: string = 'submit';
  /**
   * The latest verification token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written on each successful `execute()` — read it to attach the fresh token to your request.
   * @example
   * <RecaptchaV3 r-model:token="token" sitekey="…" action="signup" />
   */
  @property({ type: String, attribute: 'token' }) _token_attr: string = '';
  private _tokenControllable = createLitControllableProperty<string>({ host: this, eventName: 'token-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * Opt in to running one `execute()` at mount and emitting `@verify` with the initial token. Off by default — v3 is imperative-first and tokens are short-lived (~2 min), so fetch one at the moment of submission rather than eagerly at mount.
   */
  @property({ type: Boolean, reflect: true }) executeOnMount: boolean = false;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this._disconnectCleanups.push((() => {
      this.disposed = true;
    }));

    this.disposed = false;
    // Warm the script once for this sitekey. If opted in, run an initial execute.
    // Warm the script once for this sitekey. If opted in, run an initial execute.
    loadRecaptchaV3(this.sitekey).then(() => {
      if (this.disposed || !this.executeOnMount) return;
      this.execute();
    }).catch((err: any) => {
      if (this.disposed) return;
      this.dispatchEvent(new CustomEvent("error", {
        detail: {
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
<div class="rozie-recaptcha-v3" style="display:none" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-9148a0b0></div>
`;
  }

  disposed = false;

  execute(action?: any) {
    const a = action != null ? action : this.action;
    return loadRecaptchaV3(this.sitekey).then(() => v3Execute(this.sitekey, {
      action: a
    })).then((tok: any) => {
      if (this.disposed) return tok;
      this._tokenControllable.write(tok);
      this.dispatchEvent(new CustomEvent("verify", {
        detail: {
          token: tok,
          action: a
        },
        bubbles: true,
        composed: true
      }));
      return tok;
    }).catch((err: any) => {
      if (!this.disposed) this.dispatchEvent(new CustomEvent("error", {
        detail: {
          error: err
        },
        bubbles: true,
        composed: true
      }));
      throw err;
    });
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
    const __skip = new Set<string>(['sitekey', 'action', 'token', 'execute-on-mount', 'executeonmount']);
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
