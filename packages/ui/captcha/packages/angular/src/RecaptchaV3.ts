import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

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

@Component({
  selector: 'rozie-recaptcha-v3',
  standalone: true,
  template: `

    <div class="rozie-recaptcha-v3" style="display:none" #rozieSpread_0 #rozieListenersTarget_1></div>

  `,
  styles: [`
    :host(rozie-recaptcha-v3) { display: contents; }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RecaptchaV3),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class RecaptchaV3 {
  /**
   * Required. The public reCAPTCHA v3 site key from your Google admin console.
   */
  sitekey = input.required<string>();
  /**
   * The default action label reported to reCAPTCHA's risk analysis (e.g. `submit`, `login`). Overridable per call via `execute(action)`.
   */
  action = input<string>('submit');
  /**
   * The latest verification token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written on each successful `execute()` — read it to attach the fresh token to your request.
   * @example
   * <rozie-recaptcha-v3 [(token)]="token" sitekey="…" action="signup" />
   */
  token = model<string>('');
  /**
   * Opt in to running one `execute()` at mount and emitting `@verify` with the initial token. Off by default — v3 is imperative-first and tokens are short-lived (~2 min), so fetch one at the moment of submission rather than eagerly at mount.
   */
  executeOnMount = input<boolean>(false);
  error = output<unknown>();
  verify = output<unknown>();
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    this.disposed = false;
    // Warm the script once for this sitekey. If opted in, run an initial execute.
    // Warm the script once for this sitekey. If opted in, run an initial execute.
    loadRecaptchaV3(this.sitekey()).then(() => {
      if (this.disposed || !this.executeOnMount()) return;
      this.execute();
    }).catch((err: any) => {
      if (this.disposed) return;
      this.error.emit({
        error: err
      });
    });
    this.__rozieDestroyRef.onDestroy(() => {
      this.disposed = true;
    });
  }

  disposed = false;
  // Run a v3 challenge and return a fresh token. The optional `action` arg
  // overrides the prop default for this one call. On success writes the two-way
  // token + emits @verify; on failure emits @error. NB: the resolved param must
  // NOT be named `token` — on Vue, $model.token lowers to a `defineModel('token')`
  // ref named `token`, and a same-named param shadows it (`token.value = token`
  // would write the param). Use `tok` (mirrors Captcha.rozie's `response`).
  //
  // A bare `action` (no author default) is fine — the emitter now lowers a
  // TRAILING `$expose` verb param optional (`action?: any`) whenever it sees a
  // fewer-arg internal call to the SAME verb, which the no-arg
  // executeOnMount path (`execute()`) below is (emitter-hardening backlog
  // item #5). The `action = null` author-side default this comment used to
  // require is gone — the compiler owns the arity now, not this source.
  execute = (action?: any) => {
    const a = action != null ? action : this.action();
    return loadRecaptchaV3(this.sitekey()).then(() => v3Execute(this.sitekey(), {
      action: a
    })).then((tok: any) => {
      if (this.disposed) return tok;
      this.token.set(tok), this.__rozieCvaOnChange(tok);
      this.verify.emit({
        token: tok,
        action: a
      });
      return tok;
    }).catch((err: any) => {
      if (!this.disposed) this.error.emit({
        error: err
      });
      throw err;
    });
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

export default RecaptchaV3;
