import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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
  selector: 'rozie-number-field',
  standalone: true,
  imports: [NgClass],
  template: `

    <div class="rozie-number-field" [ngClass]="{ 'rozie-number-field--disabled': (disabled() || this.__rozieCvaDisabled()) }" #rozieSpread_0 #rozieListenersTarget_1>
      <button type="button" class="rozie-number-field-btn rozie-number-field-btn--dec" tabindex="-1" aria-label="Decrement" [disabled]="!!(disabled() || this.__rozieCvaDisabled()) || !!readonly()" (pointerdown)="startHold(-1)" (pointerup)="stopHold()" (pointerleave)="stopHold()">−</button>

      <input #input class="rozie-number-field-input" type="text" inputmode="decimal" autocomplete="off" role="spinbutton" [value]="displayText()" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [readOnly]="!!readonly()" [attr.aria-label]="ariaLabel()" [attr.aria-valuemin]="min()" [attr.aria-valuemax]="max()" [attr.aria-valuenow]="modelValue()" [attr.aria-valuetext]="rozieAttr(ariaText())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" (input)="onInput($event)" (focus)="onFocus($event)" (blur)="onBlur()" (keydown)="onKeydown($event)" (pointerdown)="onScrubDown($event)" (pointermove)="onScrubMove($event)" (pointerup)="onScrubUp()" />

      <button type="button" class="rozie-number-field-btn rozie-number-field-btn--inc" tabindex="-1" aria-label="Increment" [disabled]="!!(disabled() || this.__rozieCvaDisabled()) || !!readonly()" (pointerdown)="startHold(1)" (pointerup)="stopHold()" (pointerleave)="stopHold()">+</button>
    </div>

  `,
  styles: [`
    .rozie-number-field {
      display: inline-flex;
      align-items: stretch;
      gap: var(--rozie-number-field-gap, 0);
      font: var(--rozie-number-field-font, inherit);
      border: var(--rozie-number-field-border-width, 1px) solid var(--rozie-number-field-border-color, rgba(0, 0, 0, 0.25));
      border-radius: var(--rozie-number-field-radius, 0.5rem);
      background: var(--rozie-number-field-bg, #fff);
      overflow: hidden;
    }
    .rozie-number-field-input {
      box-sizing: border-box;
      width: var(--rozie-number-field-width, 4.5rem);
      min-width: 0;
      padding: var(--rozie-number-field-padding, 0.375rem 0.5rem);
      text-align: var(--rozie-number-field-text-align, right);
      font: inherit;
      font-size: var(--rozie-number-field-font-size, 1rem);
      color: var(--rozie-number-field-color, inherit);
      background: transparent;
      border: none;
      outline: none;
    }
    .rozie-number-field-input:focus {
      box-shadow: inset 0 0 0 var(--rozie-number-field-focus-ring-width, 2px) var(--rozie-number-field-focus-ring-color, rgba(0, 102, 204, 0.35));
    }
    .rozie-number-field-btn {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--rozie-number-field-btn-size, 2rem);
      padding: 0;
      font-size: var(--rozie-number-field-btn-font-size, 1.1rem);
      line-height: 1;
      color: var(--rozie-number-field-btn-color, inherit);
      background: var(--rozie-number-field-btn-bg, rgba(0, 0, 0, 0.04));
      border: none;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.15s;
    }
    .rozie-number-field-btn:hover {
      background: var(--rozie-number-field-btn-hover-bg, rgba(0, 0, 0, 0.08));
    }
    .rozie-number-field-btn:disabled {
      cursor: not-allowed;
      opacity: var(--rozie-number-field-disabled-opacity, 0.55);
    }
    .rozie-number-field--disabled {
      cursor: not-allowed;
      opacity: var(--rozie-number-field-disabled-opacity, 0.55);
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NumberField),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class NumberField {
  /**
   * The numeric value of the field (two-way `r-model`). `null` means the field is empty. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a number field **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). The value is clamped to `[min, max]` and snapped to `step` on every commit.
   * @example
   * <NumberField r-model:modelValue="qty" :min="0" :max="10" />
   */
  modelValue = model<(number) | null>(null);
  /**
   * Inclusive lower bound. Every commit clamps the value to `>= min`, and the **Home** key jumps to `min`. `null` (the default) means no lower bound. Also emitted as `aria-valuemin`.
   */
  min = input<(number) | null>(null);
  /**
   * Inclusive upper bound. Every commit clamps the value to `<= max`, and the **End** key jumps to `max`. `null` (the default) means no upper bound. Also emitted as `aria-valuemax`.
   */
  max = input<(number) | null>(null);
  /**
   * The increment/decrement granularity. **ArrowUp** / **ArrowDown** and the +/- buttons change the value by `step`, and every commit snaps the value to the nearest multiple of `step` measured from `min` (or `0` when `min` is `null`).
   */
  step = input<number>(1);
  /**
   * The coarse step applied by **PageUp** / **PageDown**, for fast traversal of a wide range.
   */
  largeStep = input<number>(10);
  /**
   * Options forwarded to `Intl.NumberFormat` for locale-aware **display** formatting (e.g. `{ style: "currency", currency: "USD" }` or `{ minimumFractionDigits: 2 }`). The displayed text is formatted while the field is unfocused; on commit the formatting is stripped back off and the raw number is parsed.
   * @example
   * :formatOptions="{ style: 'currency', currency: 'USD' }"
   */
  formatOptions = input<Record<string, any>>((() => ({}))());
  /**
   * Opt in to **scrub-on-drag**: press and drag horizontally on the field to change the value by `step` per few pixels (a power-user affordance). Off by default.
   */
  allowScrub = input<boolean>(false);
  /**
   * Disable the whole control — the input, both steppers, the keyboard, and scrubbing. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * Make the field read-only — the value is shown and focusable but cannot be changed by typing, the steppers, the keyboard, or scrubbing.
   */
  readonly = input<boolean>(false);
  /**
   * Accessible name applied to the `role="spinbutton"` input (`aria-label`). Provide this (or an external `<label>`) so the control is announced.
   */
  ariaLabel = input<(string) | null>(null);
  text = signal('');
  focused = signal(false);
  input = viewChild<ElementRef<HTMLInputElement>>('input');
  change = output<unknown>();
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    // Seed the edit buffer so a programmatic focus shows the right text.
    const n = this.readValue();
    this.text.set(n === null ? '' : String(n));
    // Tear down any running repeat / scrub on unmount.
    this.__rozieDestroyRef.onDestroy(() => {
      this.stopHold();
      this.scrubbing = false;
    });
  }

  holdTimer: any = null;
  holdInterval = 0;
  scrubbing = false;
  scrubStartX = 0;
  scrubStartValue = 0;
  readValue = () => {
    const v = this.modelValue();
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  };
  hasMin = () => typeof this.min() === 'number' && !Number.isNaN(this.min());
  hasMax = () => typeof this.max() === 'number' && !Number.isNaN(this.max());
  clampValue = (n: any) => {
    const __min = this.min();
    const __max = this.max();
    let out = n;
    if (this.hasMin() && out < __min) out = __min;
    if (this.hasMax() && out > __max) out = __max;
    return out;
  };
  snapValue = (n: any) => {
    const __step = this.step();
    const stepSize = typeof __step === 'number' && __step > 0 ? __step : 1;
    const base = this.hasMin() ? this.min() : 0;
    const snapped = base + Math.round((n - base) / stepSize) * stepSize;
    // Avoid binary-float drift (e.g. 0.1 + 0.2) by rounding to step precision.
    const decimals = (String(stepSize).split('.')[1] || '').length;
    return decimals > 0 ? Number(snapped.toFixed(decimals)) : snapped;
  };
  formatter = () => {
    try {
      return new Intl.NumberFormat(undefined, this.formatOptions() || {});
    } catch {
      return new Intl.NumberFormat();
    }
  };
  formatted = () => {
    const n = this.readValue();
    return n === null ? '' : this.formatter().format(n);
  };
  parseText = (raw: any) => {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    const cleaned = s.replace(/[^0-9eE+\-.,]/g, '').replace(/,/g, '');
    const n = Number.parseFloat(cleaned);
    return Number.isNaN(n) ? null : n;
  };
  displayText = () => this.focused() ? this.text() : this.formatted();
  ariaText = () => {
    const n = this.readValue();
    return n === null ? '' : this.formatted();
  };
  commitValue = (n: any) => {
    let next = n;
    if (next !== null) {
      next = this.snapValue(next);
      next = this.clampValue(next);
    }
    this.modelValue.set(next), this.__rozieCvaOnChange(next);
    // Keep the edit buffer in sync so a focused field reflects a programmatic step.
    this.text.set(next === null ? '' : String(next));
    this.change.emit({
      value: next
    });
  };
  stepBy = (dir: any, size: any) => {
    const __step = this.step();
    if ((this.disabled() || this.__rozieCvaDisabled()) || this.readonly()) return;
    const cur = this.readValue();
    const stepSize = typeof size === 'number' ? size : typeof __step === 'number' ? __step : 1;
    const base = cur === null ? this.hasMin() ? this.min() : 0 : cur;
    this.commitValue(base + dir * stepSize);
  };
  stopHold = () => {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.holdInterval = 0;
  };
  startHold = (dir: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled()) || this.readonly()) return;
    this.stopHold();
    this.stepBy(dir, this.step());
    this.holdInterval = 300;
    const tick = () => {
      this.stepBy(dir, this.step());
      // Ramp: shorten the interval down to a floor for accelerating repeats.
      this.holdInterval = Math.max(40, Math.round(this.holdInterval * 0.8));
      this.holdTimer = setTimeout(tick, this.holdInterval);
    };
    this.holdTimer = setTimeout(tick, this.holdInterval);
  };
  onInput = (e: any) => {
    if (this.readonly()) return;
    const raw = e && e.target ? e.target.value : '';
    this.text.set(raw);
  };
  onBlur = () => {
    this.focused.set(false);
    const parsed = this.parseText(this.text());
    this.commitValue(parsed);
  };
  onFocus = (e: any) => {
    this.focused.set(true);
    // Seed the edit buffer with the raw (unformatted) number so editing is clean.
    const n = this.readValue();
    this.text.set(n === null ? '' : String(n));
    if (e && e.target && e.target.select) e.target.select();
  };
  onKeydown = (e: any) => {
    const __step = this.step();
    const __largeStep = this.largeStep();
    if ((this.disabled() || this.__rozieCvaDisabled()) || this.readonly()) return;
    const key = e ? e.key : '';
    if (key === 'ArrowUp') {
      if (e) e.preventDefault();
      this.stepBy(1, __step);
    } else if (key === 'ArrowDown') {
      if (e) e.preventDefault();
      this.stepBy(-1, __step);
    } else if (key === 'PageUp') {
      if (e) e.preventDefault();
      this.stepBy(1, __largeStep);
    } else if (key === 'PageDown') {
      if (e) e.preventDefault();
      this.stepBy(-1, __largeStep);
    } else if (key === 'Home') {
      if (this.hasMin()) {
        if (e) e.preventDefault();
        this.commitValue(this.min());
      }
    } else if (key === 'End') {
      if (this.hasMax()) {
        if (e) e.preventDefault();
        this.commitValue(this.max());
      }
    } else if (key === 'Enter') {
      // Commit the buffer without losing focus.
      const parsed = this.parseText(this.text());
      this.commitValue(parsed);
    }
  };
  onScrubDown = (e: any) => {
    if (!this.allowScrub() || (this.disabled() || this.__rozieCvaDisabled()) || this.readonly()) return;
    this.scrubbing = true;
    this.scrubStartX = e && typeof e.clientX === 'number' ? e.clientX : 0;
    const cur = this.readValue();
    this.scrubStartValue = cur === null ? this.hasMin() ? this.min() : 0 : cur;
    // Capture the pointer so move/up stay on this element for the whole drag.
    if (e && e.target && e.target.setPointerCapture && typeof e.pointerId === 'number') {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
    }
  };
  onScrubMove = (e: any) => {
    const __step = this.step();
    if (!this.scrubbing) return;
    const x = e && typeof e.clientX === 'number' ? e.clientX : 0;
    const dx = x - this.scrubStartX;
    const stepSize = typeof __step === 'number' && __step > 0 ? __step : 1;
    // One step per 8px of horizontal travel.
    const delta = Math.round(dx / 8) * stepSize;
    this.commitValue(this.scrubStartValue + delta);
  };
  onScrubUp = () => {
    this.scrubbing = false;
  };
  focus = () => {
    const el = this.input()?.nativeElement;
    // NOTE: $refs.input types to the generic HTMLElement on the tsdown/vue leaves
    // (the emitter ref-type map has no `input` → HTMLInputElement entry), so we
    // only touch HTMLElement members here (`focus`). Text selection happens in the
    // onFocus handler, where `e.target` is `any` and `.select()` typechecks.
    if (el && el.focus) el.focus();
  };
  increment = () => this.stepBy(1, this.step());
  decrement = () => this.stepBy(-1, this.step());
  clear = () => {
    this.commitValue(null);
    this.text.set('');
  };

  private __rozieCvaOnChange: (v: number) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: number | null): void {
    this.modelValue.set(v ?? null);
  }
  registerOnChange(fn: (v: number) => void): void {
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default NumberField;
