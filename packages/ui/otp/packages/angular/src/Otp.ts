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
  selector: 'rozie-otp',
  standalone: true,
  imports: [NgClass],
  template: `

    <div class="rozie-otp" [ngClass]="{ 'rozie-otp--disabled': (disabled() || this.__rozieCvaDisabled()) }" #root role="group" [attr.aria-label]="ariaLabel()" #rozieSpread_0 #rozieListenersTarget_1>
      @for (cell of cells(); track cell.i) {
    <input class="rozie-otp-cell" [attr.type]="rozieAttr(cellType())" [attr.inputmode]="rozieAttr(cellInputMode())" maxlength="1" autocapitalize="off" [attr.autocomplete]="rozieAttr(cellAutocomplete(cell.i))" [value]="cell.ch" [placeholder]="placeholder()" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="rozieAttr(cellAriaLabel(cell.i))" [attr.data-filled]="rozieAttr(cell.ch ? 'true' : null)" (input)="onInput(cell.i, $event)" (keydown)="onKeydown(cell.i, $event)" (paste)="onPaste(cell.i, $event)" (focus)="onFocus($event)" />
    }
    </div>

  `,
  styles: [`
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
  value = model<string>('');
  length = input<number>(6);
  type = input<string>('numeric');
  mask = input<boolean>(false);
  autoFocus = input<boolean>(false);
  disabled = input<boolean>(false);
  placeholder = input<string>('');
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
  allowChar = (ch: any) => {
    const __type = this.type();
    if (!ch) return false;
    if (__type === 'numeric') return /[0-9]/.test(ch);
    if (__type === 'alphanumeric') return /[a-zA-Z0-9]/.test(ch);
    return /\S/.test(ch);
  };
  firstEmptyIndex = () => {
    const __length = this.length();
    const len = this.code().length;
    return len >= __length ? __length - 1 : len;
  };
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
    const next = String(raw).slice(0, __length);
    this.value.set(next), this.__rozieCvaOnChange(next);
    this.change.emit({
      value: next
    });
    if (next.length === __length) this.complete.emit({
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
    const ch = raw.slice(-1);
    if (!this.allowChar(ch)) {
      if (e && e.target) e.target.value = this.code()[i] || '';
      return;
    }
    const cur = this.code();
    this.commitValue(cur.slice(0, i) + ch + cur.slice(i + 1));
    this.focusIndex(i + 1);
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
    const __length = this.length();
    if (e) e.preventDefault();
    const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
    const chars = text.split('').filter(this.allowChar);
    if (!chars.length) return;
    const arr = this.code().split('');
    for (let k = 0; k < chars.length && i + k < __length; k++) arr[i + k] = chars[k];
    this.commitValue(arr.join(''));
    const landed = i + chars.length;
    this.focusIndex(landed >= __length ? __length - 1 : landed);
  };
  onFocus = (e: any) => {
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

export default Otp;
