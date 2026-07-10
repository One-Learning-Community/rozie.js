import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

interface DefaultCtx {
  $implicit: { checked: any; toggle: any };
  checked: any;
  toggle: any;
}

function __rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}

function __rozieAttr(v: unknown): string | null {
  return v == null ? null : __rozieDisplay(v);
}

@Component({
  selector: 'rozie-switch',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <button #control type="button" class="rozie-switch" [ngClass]="{ 'rozie-switch--checked': isChecked(), 'rozie-switch--disabled': (disabled() || this.__rozieCvaDisabled()) }" role="switch" [attr.tabindex]="rozieAttr(controlTabindex())" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-checked]="!!modelValue()" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-readonly]="!!readonly()" [attr.aria-label]="ariaLabel()" #rozieSpread_0 (click)="onClick()" (keydown)="onKeydown($event)" #rozieListenersTarget_1>
      @if ((defaultTpl ?? templates()?.['defaultSlot'])) {
    <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot']); context: { $implicit: { checked: isChecked(), toggle: toggle }, checked: isChecked(), toggle: toggle }" />
    } @else {

        <span class="rozie-switch-track">
          <span class="rozie-switch-thumb"></span>
        </span>
      
    }
    </button>

  `,
  styles: [`
    :host(rozie-switch) { display: contents; }
    .rozie-switch {
      display: inline-flex;
      align-items: center;
      box-sizing: border-box;
      padding: 0;
      margin: 0;
      border: none;
      background: none;
      cursor: pointer;
      font: inherit;
      -webkit-tap-highlight-color: transparent;
    }
    .rozie-switch:focus-visible {
      outline: var(--rozie-switch-focus-ring-width, 2px) solid var(--rozie-switch-focus-ring-color, rgba(0, 102, 204, 0.5));
      outline-offset: var(--rozie-switch-focus-ring-offset, 2px);
      border-radius: var(--rozie-switch-radius, 999px);
    }
    .rozie-switch--disabled {
      cursor: not-allowed;
      opacity: var(--rozie-switch-disabled-opacity, 0.55);
    }
    .rozie-switch-track {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      width: var(--rozie-switch-width, 2.75rem);
      height: var(--rozie-switch-height, 1.5rem);
      padding: var(--rozie-switch-track-padding, 0.125rem);
      background: var(--rozie-switch-off-bg, rgba(0, 0, 0, 0.25));
      border-radius: var(--rozie-switch-radius, 999px);
      transition: background-color 0.18s ease;
    }
    .rozie-switch--checked .rozie-switch-track {
      background: var(--rozie-switch-on-bg, #0066cc);
    }
    .rozie-switch-thumb {
      box-sizing: border-box;
      width: var(--rozie-switch-thumb-size, 1.25rem);
      height: var(--rozie-switch-thumb-size, 1.25rem);
      background: var(--rozie-switch-thumb-bg, #fff);
      border-radius: 50%;
      box-shadow: var(--rozie-switch-thumb-shadow, 0 1px 2px rgba(0, 0, 0, 0.3));
      transition: transform 0.18s ease;
      transform: translateX(0);
    }
    .rozie-switch--checked .rozie-switch-thumb {
      transform: translateX(var(--rozie-switch-thumb-travel, calc(2.75rem - 1.5rem)));
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Switch),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Switch {
  /**
   * The on/off state of the switch (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a switch **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `true` is the checked/on state; reflected as `aria-checked`.
   * @example
   * <Switch r-model:modelValue="on" ariaLabel="Wi-Fi" />
   */
  modelValue = model<boolean>(false);
  /**
   * Disable the control entirely — it becomes non-focusable (`tabindex` is dropped), non-toggleable (click and keyboard are ignored), and `aria-disabled` is set. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * Make the switch read-only — its state is shown and the control stays focusable, but the user cannot toggle it (click and keyboard are ignored). Reflected as `aria-readonly`.
   */
  readonly = input<boolean>(false);
  /**
   * Accessible name applied to the `role="switch"` control (`aria-label`). Provide this (or an external `<label>`) so the switch is announced.
   */
  ariaLabel = input<(string) | null>(null);
  control = viewChild<ElementRef<HTMLButtonElement>>('control');
  change = output<unknown>();
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  isChecked = () => this.modelValue() === true;
  commitValue = (next: any) => {
    const v = next === true;
    this.modelValue.set(v), this.__rozieCvaOnChange(v);
    this.change.emit({
      checked: v
    });
  };
  toggle = () => {
    if ((this.disabled() || this.__rozieCvaDisabled()) || this.readonly()) return;
    this.commitValue(!this.isChecked());
  };
  onClick = () => {
    this.toggle();
  };
  onKeydown = (e: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled()) || this.readonly()) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      if (e) e.preventDefault();
      this.toggle();
    }
  };
  controlTabindex = () => (this.disabled() || this.__rozieCvaDisabled()) ? null : 0;
  focus = () => {
    const el = this.control()?.nativeElement;
    if (el && el.focus) el.focus();
  };

  private __rozieCvaOnChange: (v: boolean) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: boolean | null): void {
    this.modelValue.set(v ?? false);
  }
  registerOnChange(fn: (v: boolean) => void): void {
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

  static ngTemplateContextGuard(
    _dir: Switch,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }

  private __rozieDestroyRef = inject(DestroyRef);

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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Switch;
