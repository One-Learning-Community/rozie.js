import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

import { firstEmptyIndex as firstEmpty, isAllowedChar, planEmits, planWrite } from './internal/otpWrite';

// ---- derived view (plain functions, uniform ×6) ------------------------
// The current code, normalized to a string.

@Component({
  selector: 'rozie-otp',
  standalone: true,
  imports: [NgClass],
  template: `

    <div class="rozie-otp" [ngClass]="{ 'rozie-otp--disabled': (disabled() || this.__rozieCvaDisabled()) }" #root role="group" [attr.aria-label]="rozieAttr(ariaLabel())" #rozieSpread_0 #rozieListenersTarget_1>
      @for (cell of cells(); track cell.i) {
    <input class="rozie-otp-cell" [attr.type]="rozieAttr(cellType())" [attr.inputmode]="rozieAttr(cellInputMode())" maxlength="1" autocapitalize="off" autocorrect="off" spellcheck="false" [attr.autocomplete]="rozieAttr(cellAutocomplete(cell.i))" [value]="cell.ch" [placeholder]="placeholder()" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="rozieAttr(cellAriaLabel(cell.i))" [attr.data-filled]="rozieAttr(cell.ch ? 'true' : null)" (input)="onInput(cell.i, $event)" (keydown)="onKeydown(cell.i, $event)" (paste)="onPaste(cell.i, $event)" (focus)="onFocus($event)" (pointerup)="onPointerUp($event)" />
    }
    </div>

  `,
  styles: [`
    :host(rozie-otp) { display: contents; }
    .rozie-otp {
      display: inline-flex;
      gap: var(--rozie-otp-gap, 0.5rem);
      font: var(--rozie-otp-font, inherit);
    }
    .rozie-otp-cell {
      box-sizing: border-box;
      width: var(--rozie-otp-cell-size, 2.75rem);
      height: var(--rozie-otp-cell-size, 2.75rem);
      padding: 0;
      text-align: center;
      font-size: var(--rozie-otp-font-size, 1.25rem);
      font-weight: var(--rozie-otp-font-weight, 600);
      color: var(--rozie-otp-color, inherit);
      background: var(--rozie-otp-bg, #fff);
      border: var(--rozie-otp-border-width, 1px) solid var(--rozie-otp-border-color, rgba(0, 0, 0, 0.25));
      border-radius: var(--rozie-otp-radius, 0.5rem);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      caret-color: var(--rozie-otp-accent, #0066cc);
    }
    .rozie-otp-cell::placeholder {
      color: var(--rozie-otp-placeholder-color, rgba(0, 0, 0, 0.3));
    }
    .rozie-otp-cell[data-filled='true'] {
      border-color: var(--rozie-otp-filled-border-color, var(--rozie-otp-accent, #0066cc));
    }
    .rozie-otp-cell:focus {
      border-color: var(--rozie-otp-accent, #0066cc);
      box-shadow: 0 0 0 var(--rozie-otp-focus-ring-width, 3px) var(--rozie-otp-focus-ring-color, rgba(0, 102, 204, 0.25));
    }
    .rozie-otp--disabled .rozie-otp-cell {
      cursor: not-allowed;
      opacity: var(--rozie-otp-disabled-opacity, 0.55);
      background: var(--rozie-otp-disabled-bg, rgba(0, 0, 0, 0.04));
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Otp),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Otp {
  /**
   * The assembled one-time code (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so an Otp **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Always a contiguous string of `0..length` characters; Otp writes the new code back on every edit (type, paste, backspace).
   * @example
   * <rozie-otp [(value)]="code" [length]="6" type="numeric" ariaLabel="Verification code" />
   */
  value = model<string>('');
  /**
   * Number of input cells to render.
   */
  length = input<number>(6);
  /**
   * Allowed-character class plus the mobile keyboard hint: `'numeric'` permits digits only and sets `inputmode="numeric"`; `'alphanumeric'` permits `[A-Za-z0-9]` with `inputmode="text"`; `'text'` permits any non-space character with `inputmode="text"`. Characters that fail the test are rejected on type and filtered on paste.
   */
  type = input<string>('numeric');
  /**
   * Render the cells as masked dots (`type="password"`) for sensitive codes, while keeping the same keyboard and ARIA behavior.
   */
  mask = input<boolean>(false);
  /**
   * Focus the first empty cell on mount.
   */
  autoFocus = input<boolean>(false);
  /**
   * Disable every cell. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * Per-cell placeholder character shown in empty cells (e.g. `'•'` or `'0'`).
   */
  placeholder = input<string>('');
  /**
   * Accessible name for the whole group (`role="group"`, applied as `aria-label`). Each cell additionally gets an ordinal `aria-label` (`"Digit 1 of 6"`).
   */
  ariaLabel = input<(string) | null>(null);
  root = viewChild<ElementRef<HTMLDivElement>>('root');
  change = output<unknown>();
  complete = output<unknown>();

  ngAfterViewInit() {
    if (this.autoFocus()) this.focusIndex(this.firstEmptyIndex());
  }

  code = () => typeof this.value() === 'string' ? this.value() : '';
  cells = () => {
    const v = this.code();
    const out = [];
    for (let i = 0; i < this.length(); i++) out.push({
      i,
      ch: v[i] || ''
    });
    return out;
  };
  allowChar = (ch: any) => isAllowedChar(this.type(), ch);
  firstEmptyIndex = () => firstEmpty(this.code(), this.length());
  focusIndex = (idx: any) => {
    const __length = this.length();
    let i = idx;
    if (i < 0) i = 0;
    if (i >= __length) i = __length - 1;
    const root = this.root()?.nativeElement;
    if (!root) return;
    const inputs = root.querySelectorAll('input');
    const el = inputs[i];
    if (el) {
      el.focus();
      if (el.select) el.select();
    }
  };
  commitValue = (raw: any) => {
    const __length = this.length();
    const prev = this.code();
    const next = String(raw).slice(0, __length);
    const emits = planEmits(prev, next, __length);
    this.value.set(next), this.__rozieCvaOnChange(next);
    if (emits.change) this.change.emit({
      value: next
    });
    if (emits.complete) this.complete.emit({
      value: next
    });
  };
  onInput = (i: any, e: any) => {
    const raw = e && e.target ? e.target.value : '';
    if (raw === '') {
      const cur = this.code();
      this.commitValue(cur.slice(0, i) + cur.slice(i + 1));
      return;
    }
    const plan = planWrite(this.code(), this.length(), this.type(), i, raw);
    if (!plan) {
      if (e && e.target) e.target.value = this.code()[i] || '';
      return;
    }
    this.commitValue(plan.next);
    // Restore the originating cell's DOM value from the derived model. Required
    // for the multi-char/autofill case: the element currently holds the WHOLE
    // pasted/autofilled string, and when the committed value happens to equal the
    // previous value the framework re-render is a no-op (the same reason the
    // invalid-char branch above resets the element directly). Without this the
    // first cell keeps rendering the whole autofilled string.
    if (e && e.target) e.target.value = plan.next[i] || '';
    this.focusIndex(plan.focus);
  };
  onKeydown = (i: any, e: any) => {
    const key = e ? e.key : '';
    const cur = this.code();
    if (key === 'Backspace') {
      if (e) e.preventDefault();
      if (cur[i]) {
        this.commitValue(cur.slice(0, i) + cur.slice(i + 1));
      } else if (i > 0) {
        this.commitValue(cur.slice(0, i - 1) + cur.slice(i));
        this.focusIndex(i - 1);
      }
    } else if (key === 'ArrowLeft') {
      if (e) e.preventDefault();
      this.focusIndex(i - 1);
    } else if (key === 'ArrowRight') {
      if (e) e.preventDefault();
      this.focusIndex(i + 1);
    } else if (key === 'Home') {
      if (e) e.preventDefault();
      this.focusIndex(0);
    } else if (key === 'End') {
      if (e) e.preventDefault();
      this.focusIndex(this.length() - 1);
    }
  };
  onPaste = (i: any, e: any) => {
    if (e) e.preventDefault();
    const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
    const plan = planWrite(this.code(), this.length(), this.type(), i, text);
    if (!plan) return;
    this.commitValue(plan.next);
    this.focusIndex(plan.focus);
  };
  onFocus = (e: any) => {
    if (e && e.target && e.target.select) e.target.select();
  };
  onPointerUp = (e: any) => {
    if (e && e.target && e.target.select) e.target.select();
  };
  cellType = () => this.mask() ? 'password' : 'text';
  cellInputMode = () => this.type() === 'numeric' ? 'numeric' : 'text';
  cellAriaLabel = (i: any) => 'Digit ' + (i + 1) + ' of ' + this.length();
  cellAutocomplete = (i: any) => i === 0 ? 'one-time-code' : 'off';
  focus = () => this.focusIndex(this.firstEmptyIndex());
  clear = () => {
    this.commitValue('');
    this.focusIndex(0);
  };

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Otp;
