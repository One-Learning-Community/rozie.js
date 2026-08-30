import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, computed, effect, forwardRef, inject, model, output, signal, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-model-param-shadow',
  standalone: true,
  template: `

    <div class="model-param-shadow" #rozieSpread_0 #rozieListenersTarget_1>
      <button (click)="solve('demo-token')">solve</button>
      <button (click)="setStatus('ready')">status</button>
      <button (click)="logLabel('hi')">label</button>
      <span class="status">{{ status() }}</span>
    </div>

  `,
  styles: [`
    :host(rozie-model-param-shadow) { display: contents; }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ModelParamShadow),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class ModelParamShadow {
  token = model<string>('');
  status = signal('');
  verify = output<unknown>();

  label = computed(() => this.status() + '!');

  // solve(token): param == the model prop name. `$model.token = token` lowers on
  // Vue to `token.value = token` (param shadows the defineModel ref) pre-fix.
  solve = (token: any) => {
    this.token.set(token), this.__rozieCvaOnChange(token);
    this.verify.emit({
      token: this.token()
    });
  };
  // setStatus(status): param == the $data key. `$data.status = status` lowers on
  // Vue to `status.value = status` (param shadows the state ref) pre-fix.
  setStatus = (status: any) => {
    this.status.set(status);
  };
  // logLabel(label): param == the $computed name. The bare `label` read lowers on
  // Vue to `label.value` (reads the computed ref, not the param) pre-fix.
  logLabel = (label: any) => {
    this.verify.emit({
      token: label
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

  private __rozieDestroyRef = inject(DestroyRef);

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

export default ModelParamShadow;
