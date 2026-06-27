import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

interface OptionCtx {
  $implicit: { option: any; index: any; active: any; selected: any; disabled: any };
  option: any;
  index: any;
  active: any;
  selected: any;
  disabled: any;
}

interface EmptyCtx {
  $implicit: { query: any };
  query: any;
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
  selector: 'rozie-combobox',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-combobox" [ngClass]="{ 'rozie-combobox--open': isOpen(), 'rozie-combobox--disabled': (disabled() || this.__rozieCvaDisabled()), 'rozie-combobox--inline': inline() }" #rozieSpread_0 #rozieListenersTarget_1>
      <input #inputEl class="rozie-combobox-input" type="text" role="combobox" aria-autocomplete="list" [attr.aria-expanded]="!!isOpen()" [attr.aria-controls]="rozieAttr(listId())" [attr.aria-activedescendant]="rozieAttr(activeId())" [attr.aria-label]="ariaLabel()" [value]="query()" [placeholder]="placeholder()" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" autocomplete="off" (input)="onInput($event)" (focus)="onFocus($event)" (blur)="onBlur()" (keydown)="onKeydown($event)" />

      @if (isOpen()) {
    <ul class="rozie-combobox-list" [attr.id]="rozieAttr(listId())" role="listbox">
        @for (opt of filteredOptions(); track opt.value) {
    <li class="rozie-combobox-option" [ngClass]="{ 'rozie-combobox-option--active': opt._i === activeIndex(), 'rozie-combobox-option--selected': opt.value === value(), 'rozie-combobox-option--disabled': opt.disabled }" [attr.id]="rozieAttr(optId(opt._i))" role="option" [attr.aria-selected]="opt.value === value()" [attr.aria-disabled]="!!opt.disabled" (mousedown)="$event.preventDefault(); selectOption(opt)" (mouseenter)="activeIndex.set(opt._i)">
          @if ((optionTpl ?? templates()?.['option'])) {
    <ng-container *ngTemplateOutlet="(optionTpl ?? templates()?.['option']); context: { $implicit: { option: opt.option, index: opt._i, active: opt._i === activeIndex(), selected: opt.value === value(), disabled: opt.disabled }, option: opt.option, index: opt._i, active: opt._i === activeIndex(), selected: opt.value === value(), disabled: opt.disabled }" />
    } @else {
    {{ rozieDisplay(opt.label) }}
    }
        </li>
    }

        @if (filteredOptions().length === 0) {
    <li class="rozie-combobox-empty" role="presentation">
          @if ((emptyTpl ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? templates()?.['empty']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    No results
    }
        </li>
    }</ul>
    }</div>

  `,
  styles: [`
    .rozie-combobox {
      position: relative;
      display: inline-block;
      width: var(--rozie-combobox-width, 16rem);
      font: var(--rozie-combobox-font, inherit);
    }
    .rozie-combobox-input {
      box-sizing: border-box;
      width: 100%;
      padding: var(--rozie-combobox-input-padding, 0.5rem 0.75rem);
      font: inherit;
      color: var(--rozie-combobox-color, inherit);
      background: var(--rozie-combobox-bg, #fff);
      border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-border-color, rgba(0, 0, 0, 0.25));
      border-radius: var(--rozie-combobox-radius, 0.5rem);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .rozie-combobox-input:focus {
      border-color: var(--rozie-combobox-accent, #0066cc);
      box-shadow: 0 0 0 var(--rozie-combobox-focus-ring-width, 3px) var(--rozie-combobox-focus-ring-color, rgba(0, 102, 204, 0.25));
    }
    .rozie-combobox--disabled .rozie-combobox-input {
      cursor: not-allowed;
      opacity: var(--rozie-combobox-disabled-opacity, 0.55);
      background: var(--rozie-combobox-disabled-bg, rgba(0, 0, 0, 0.04));
    }
    .rozie-combobox-list {
      position: absolute;
      z-index: var(--rozie-combobox-list-z, 50);
      top: calc(100% + var(--rozie-combobox-list-gap, 0.25rem));
      left: 0;
      right: 0;
      margin: 0;
      padding: var(--rozie-combobox-list-padding, 0.25rem);
      list-style: none;
      max-height: var(--rozie-combobox-list-max-height, 16rem);
      overflow-y: auto;
      background: var(--rozie-combobox-list-bg, #fff);
      border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-list-border-color, rgba(0, 0, 0, 0.15));
      border-radius: var(--rozie-combobox-radius, 0.5rem);
      box-shadow: var(--rozie-combobox-list-shadow, 0 10px 24px rgba(0, 0, 0, 0.16));
    }
    .rozie-combobox-option {
      padding: var(--rozie-combobox-option-padding, 0.4rem 0.6rem);
      border-radius: var(--rozie-combobox-option-radius, 0.375rem);
      cursor: pointer;
      color: var(--rozie-combobox-option-color, inherit);
    }
    .rozie-combobox-option--active {
      background: var(--rozie-combobox-option-active-bg, rgba(0, 102, 204, 0.12));
    }
    .rozie-combobox-option--selected {
      font-weight: var(--rozie-combobox-option-selected-weight, 600);
      color: var(--rozie-combobox-option-selected-color, var(--rozie-combobox-accent, #0066cc));
    }
    .rozie-combobox-option--disabled {
      cursor: not-allowed;
      opacity: var(--rozie-combobox-option-disabled-opacity, 0.45);
    }
    .rozie-combobox-empty {
      padding: var(--rozie-combobox-empty-padding, 0.5rem 0.6rem);
      color: var(--rozie-combobox-empty-color, rgba(0, 0, 0, 0.5));
      list-style: none;
    }
    .rozie-combobox--inline {
      display: block;
      width: 100%;
    }
    .rozie-combobox--inline .rozie-combobox-list {
      position: static;
      margin-top: var(--rozie-combobox-list-gap, 0.25rem);
      border: none;
      border-radius: 0;
      box-shadow: none;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Combobox),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Combobox {
  /**
   * The selected option's value (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a combobox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `null` when nothing is selected.
   * @example
   * <Combobox r-model:value="country" :options="countries" />
   */
  value = model<(unknown) | null>(null);
  /**
   * The option list — `[{ value, label, disabled? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, and an optional `disabled` flag makes an option non-selectable.
   */
  options = input<any[]>((() => [])());
  /**
   * Placeholder text shown in the input while it is empty.
   */
  placeholder = input<string>('');
  /**
   * Disable the control — the input becomes non-interactive and the popup cannot be opened. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * Opt **out** of built-in client filtering (async / server-side mode): render `options` exactly as supplied and rely on the `search` event to refetch. By default the component filters `options` by `label`, case-insensitively, against the typed query.
   */
  disableFilter = input<boolean>(false);
  /**
   * Accessible name for the input (`aria-label`), used when there is no visible `<label for>` pointing at it. Provide this (or an external label) so the combobox is announced.
   */
  ariaLabel = input<(string) | null>(null);
  /**
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one combobox shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase = input<string>('rozie-combobox');
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the combobox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  inline = input<boolean>(false);
  /**
   * Close the popup after a selection commits. Defaults `true` (standard autocomplete behavior); set to `false` to keep the popup open after a selection — e.g. when the combobox is embedded in a multi-action surface like a command palette.
   */
  closeOnSelect = input<boolean>(true);
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  optionLabel = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled = input<((...args: unknown[]) => unknown) | null>(null);
  query = signal('');
  isOpen = signal(false);
  activeIndex = signal(-1);
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  change = output<unknown>();
  search = output<unknown>();
  @ContentChild('option', { read: TemplateRef }) optionTpl?: TemplateRef<OptionCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.value())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.syncQueryToValue();
    })(); }); });
  }

  ngAfterViewInit() {
    this.syncQueryToValue();
  }

  labelOf = (opt: any) => {
    const __optionLabel = this.optionLabel();
    if (__optionLabel !== null) return __optionLabel(opt);
    if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
    return String(opt);
  };
  valueOf$local = (opt: any) => {
    const __optionValue = this.optionValue();
    if (__optionValue !== null) return __optionValue(opt);
    if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
    return opt;
  };
  disabledOf = (opt: any) => {
    const __optionDisabled = this.optionDisabled();
    if (__optionDisabled !== null) return !!__optionDisabled(opt);
    if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
    return false;
  };
  filteredOptions = () => {
    const __options = this.options();
    const opts = Array.isArray(__options) ? __options : [];
    let list = opts;
    if (!this.disableFilter()) {
      const q = this.query().toLowerCase();
      if (q) list = opts.filter((o: any) => String(this.labelOf(o)).toLowerCase().indexOf(q) !== -1);
    }
    return list.map((o: any, i: any) => ({
      value: this.valueOf$local(o),
      label: this.labelOf(o),
      disabled: this.disabledOf(o),
      _i: i,
      option: o
    }));
  };
  optId = (i: any) => this.idBase() + '-opt-' + i;
  listId = () => this.idBase() + '-list';
  activeId = () => {
    const __activeIndex = this.activeIndex();
    const list = this.filteredOptions();
    if (this.isOpen() && __activeIndex >= 0 && list[__activeIndex]) return this.optId(__activeIndex);
    return null;
  };
  nextEnabled = (list: any, from: any, dir: any) => {
    let i = from;
    for (let step = 0; step < list.length; step++) {
      i = i + dir;
      if (i < 0) i = 0;
      if (i >= list.length) i = list.length - 1;
      if (list[i] && !list[i].disabled) return i;
      if (dir < 0 && i === 0 || dir > 0 && i === list.length - 1) break;
    }
    return from;
  };
  selectOption = (opt: any) => {
    if (!opt || opt.disabled) return;
    this.value.set(opt.value), this.__rozieCvaOnChange(opt.value);
    this.query.set(String(opt.label));
    if (this.closeOnSelect()) this.isOpen.set(false);
    this.activeIndex.set(-1);
    this.change.emit({
      value: opt.value,
      option: opt.option
    });
  };
  syncQueryToValue = () => {
    const __options = this.options();
    const opts = Array.isArray(__options) ? __options : [];
    const opt = opts.find((o: any) => o.value === this.value());
    this.query.set(opt ? String(opt.label) : '');
  };
  onInput = (e: any) => {
    const q = e && e.target ? e.target.value : '';
    this.query.set(q);
    this.isOpen.set(true);
    this.activeIndex.set(0);
    this.search.emit({
      query: q
    });
  };
  onFocus = (e: any) => {
    this.isOpen.set(true);
    if (e && e.target && e.target.select) e.target.select();
  };
  onBlur = () => {
    this.isOpen.set(false);
  };
  onKeydown = (e: any) => {
    const key = e ? e.key : '';
    const list = this.filteredOptions();
    // Capture the reactive reads into locals BEFORE any write so React never binds
    // a pre-write value (ROZ138; the read-then-write-same-key idiom). Each branch
    // is mutually exclusive, but a flow-insensitive analysis can't see that.
    const wasOpen = this.isOpen();
    const ai = this.activeIndex();
    if (key === 'ArrowDown') {
      if (e) e.preventDefault();
      if (!wasOpen) {
        this.isOpen.set(true);
        this.activeIndex.set(0);
        return;
      }
      this.activeIndex.set(this.nextEnabled(list, ai, 1));
    } else if (key === 'ArrowUp') {
      if (e) e.preventDefault();
      if (!wasOpen) {
        this.isOpen.set(true);
        return;
      }
      this.activeIndex.set(this.nextEnabled(list, ai, -1));
    } else if (key === 'Enter') {
      if (wasOpen && ai >= 0 && list[ai]) {
        if (e) e.preventDefault();
        this.selectOption(list[ai]);
      }
    } else if (key === 'Escape') {
      if (wasOpen) {
        if (e) e.preventDefault();
        this.isOpen.set(false);
      }
    } else if (key === 'Home') {
      if (wasOpen) {
        if (e) e.preventDefault();
        this.activeIndex.set(this.nextEnabled(list, -1, 1));
      }
    } else if (key === 'End') {
      if (wasOpen) {
        if (e) e.preventDefault();
        this.activeIndex.set(this.nextEnabled(list, list.length, -1));
      }
    }
  };
  focus = () => this.inputEl()?.nativeElement?.focus();
  clear = () => {
    this.value.set(null), this.__rozieCvaOnChange(null);
    this.query.set('');
    this.activeIndex.set(-1);
    this.change.emit({
      value: null
    });
  };

  private __rozieCvaOnChange: (v: unknown) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: unknown | null): void {
    this.value.set(v ?? null);
  }
  registerOnChange(fn: (v: unknown) => void): void {
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
    _dir: Combobox,
    _ctx: unknown,
  ): _ctx is OptionCtx | EmptyCtx {
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

export default Combobox;
