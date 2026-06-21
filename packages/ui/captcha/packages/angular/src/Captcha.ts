import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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

@Component({
  selector: 'rozie-captcha',
  standalone: true,
  template: `

    <div #widgetEl class="rozie-captcha" #rozieSpread_0 #rozieListenersTarget_1></div>

  `,
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
  provider = input<string>('recaptcha');
  sitekey = input.required<string>();
  token = model<string>('');
  theme = input<string>('light');
  size = input<string>('normal');
  tabindex = input<(number) | null>(null);
  options = input<Record<string, any>>((() => ({}))());
  widgetEl = viewChild<ElementRef<HTMLDivElement>>('widgetEl');
  verify = output<unknown>();
  expire = output<unknown>();
  error = output<unknown>();
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    this.disposed = false;
    loadCaptchaApi(this.provider()).then((a: any) => {
      if (this.disposed) return;
      this.api = a;
      this.widgetId = this.api.render(this.widgetEl()!.nativeElement, this.buildConfig());
    }).catch((err: any) => {
      this.error.emit({
        provider: this.provider(),
        error: err
      });
    });
    this.__rozieDestroyRef.onDestroy(() => {
      this.disposed = true;
      if (this.widgetId == null || !this.api) return;
      // Turnstile fully removes a widget; reCAPTCHA/hCaptcha only reset.
      if (typeof this.api.remove === 'function') this.api.remove(this.widgetId);else if (typeof this.api.reset === 'function') this.api.reset(this.widgetId);
    });
  }

  api: any = null;
  widgetId: any = null;
  disposed = false;
  buildConfig = () => ({
    sitekey: this.sitekey(),
    theme: this.theme(),
    size: this.size(),
    ...(this.tabindex() != null ? {
      tabindex: this.tabindex()
    } : {}),
    callback: (token: any) => {
      this.token.set(token), this.__rozieCvaOnChange(token);
      this.verify.emit({
        token: this.token(),
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
  reset = () => {
    if (this.widgetId != null && this.api && typeof this.api.reset === 'function') this.api.reset(this.widgetId);
    this.token.set(''), this.__rozieCvaOnChange('');
  };
  execute = () => {
    if (this.widgetId != null && this.api && typeof this.api.execute === 'function') this.api.execute(this.widgetId);
  };
  getResponse = () => {
    return this.widgetId != null && this.api && typeof this.api.getResponse === 'function' ? this.api.getResponse(this.widgetId) : '';
  };

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  private __rozieCvaDisabled = signal(false);

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

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

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
