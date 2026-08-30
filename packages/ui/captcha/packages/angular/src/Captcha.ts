import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

// The provider api.js loader (inject-once singleton + poll/timeout/error) lives
// in a vendored internal module so its branchy logic is unit-tested independent
// of any framework (see internal/loadCaptchaApi.test.ts). codegen copies
// src/internal/ into every leaf, so this relative import resolves verbatim ×6.
import { loadCaptchaApi } from './internal/loadCaptchaApi';

// Live widget handle. Top-level lets → React hoists to useRef (setup-once).
// `api`/`widgetId` MUST be top-level — reset()/execute()/getResponse() (the
// $expose'd imperative handle, callable any time) read them outside $onMount.

@Component({
  selector: 'rozie-captcha',
  standalone: true,
  template: `

    <div #widgetEl class="rozie-captcha" #rozieSpread_0 #rozieListenersTarget_1></div>

  `,
  styles: [`
    :host(rozie-captcha) { display: contents; }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Captcha),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Captcha {
  /**
   * Which widget to render: `recaptcha` (Google reCAPTCHA v2), `hcaptcha`, `turnstile` (Cloudflare), or `friendly` (Friendly Captcha). The first three share a near-identical explicit-render API; Friendly Captcha rides an internal `adapt()` bridge onto the same surface. Construction-time — re-key the component to switch it live.
   */
  provider = input<string>('recaptcha');
  /**
   * Required. The public site key from your provider dashboard. Identifies your site to the chosen provider.
   */
  sitekey = input.required<string>();
  /**
   * The verified response token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written by the widget on success and cleared on expire/reset, so reading it gives you the live response to send to your server for form submission.
   * @example
   * <rozie-captcha [(token)]="token" provider="recaptcha" sitekey="…" />
   */
  token = model<string>('');
  /**
   * Widget color theme: `light` or `dark` (all three core providers), or `auto` (Turnstile only). Construction-time — re-key the component to change it live.
   */
  theme = input<string>('light');
  /**
   * Widget size. reCAPTCHA/hCaptcha accept `normal`/`compact`/`invisible`; Turnstile accepts `normal`/`compact`/`flexible`. A no-op for Friendly Captcha (its `startMode` analog rides through the `options` escape hatch instead). Construction-time.
   */
  size = input<string>('normal');
  /**
   * Optional tab index forwarded to the rendered widget. Omitted from the render config when left unset (`null`).
   */
  tabindex = input<(number) | null>(null);
  /**
   * Escape hatch — provider-specific render options merged last (e.g. Turnstile `action`/`cData`/`retry`, hCaptcha `hl`, reCAPTCHA `badge`, Friendly Captcha `startMode`). Lets you reach keys this component does not promote to first-class props.
   */
  options = input<Record<string, any>>((() => ({}))());
  widgetEl = viewChild<ElementRef<HTMLDivElement>>('widgetEl');
  verify = output<unknown>();
  expire = output<unknown>();
  error = output<unknown>();
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    // Mount-local (not top-level) — read only by this closure's own async
    // .then()/.catch() and the returned teardown below. Emitter-hardening
    // backlog item #2 (project_emitter_hardening_backlog): every target keeps
    // a $onMount setup-local in scope for its own returned teardown, so this
    // no longer needs the prior TOP-LEVEL-`let` workaround (unlike `api`/
    // `widgetId` above, which stay top-level for the unrelated $expose reason).
    let disposed = false;
    loadCaptchaApi(this.provider()).then((a: any) => {
      if (disposed) return;
      this.api = a;
      this.widgetId = this.api.render(this.widgetEl()!.nativeElement, this.buildConfig());
    }).catch((err: any) => {
      this.error.emit({
        provider: this.provider(),
        error: err
      });
    });
    this.__rozieDestroyRef.onDestroy(() => {
      disposed = true;
      if (this.widgetId == null || !this.api) return;
      // Turnstile fully removes a widget; reCAPTCHA/hCaptcha only reset.
      if (typeof this.api.remove === 'function') this.api.remove(this.widgetId);else if (typeof this.api.reset === 'function') this.api.reset(this.widgetId);
    });
  }

  api: any = null;
  widgetId: any = null;
  // The render config shared across all three providers. The hyphenated
  // `expired-callback` / `error-callback` keys are the common option names each
  // provider's render() accepts. `tabindex` is omitted unless set; `options`
  // (the escape hatch) is merged last so a consumer can override any key.
  buildConfig = () => ({
    sitekey: this.sitekey(),
    theme: this.theme(),
    size: this.size(),
    ...(this.tabindex() != null ? {
      tabindex: this.tabindex()
    } : {}),
    // NB: the param must NOT be named `token` — on Vue, $model.token lowers to a
    // `defineModel('token')` ref named `token`, and a same-named param shadows it
    // (`token.value = token` would write the param, not the model → v-model:token
    // never populates). Vue-only footgun (React/Solid lower to a setToken call).
    callback: (response: any) => {
      this.token.set(response), this.__rozieCvaOnChange(response);
      this.verify.emit({
        token: response,
        provider: this.provider()
      });
    },
    'expired-callback': () => {
      this.token.set(''), this.__rozieCvaOnChange('');
      this.expire.emit({
        provider: this.provider()
      });
    },
    'error-callback': () => {
      this.token.set(''), this.__rozieCvaOnChange('');
      this.error.emit({
        provider: this.provider()
      });
    },
    ...this.options()
  });
  // Imperative handle. Each guards on a live widget (null before render / after
  // teardown). reset clears the two-way token to match the cleared widget.
  reset = () => {
    if (this.widgetId != null && this.api && typeof this.api.reset === 'function') this.api.reset(this.widgetId);
    this.token.set(''), this.__rozieCvaOnChange('');
  };
  // Invisible / programmatic challenge (size="invisible"). No-op until rendered.
  execute = () => {
    if (this.widgetId != null && this.api && typeof this.api.execute === 'function') this.api.execute(this.widgetId);
  };
  // Read the current response token on demand (e.g. just before form submit).
  getResponse = () => {
    return this.widgetId != null && this.api && typeof this.api.getResponse === 'function' ? this.api.getResponse(this.widgetId) : '';
  };

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: string | null): void {
    this.token.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });
}

export default Captcha;
