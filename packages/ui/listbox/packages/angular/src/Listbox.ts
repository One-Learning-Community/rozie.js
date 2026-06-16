import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

interface SelectedCtx {
  $implicit: { selected: any; value: any };
  selected: any;
  value: any;
}

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
  selector: 'rozie-listbox',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-listbox" [ngClass]="{ 'rozie-listbox-open': open$local(), 'rozie-listbox-disabled': (disabled() || this.__rozieCvaDisabled()) }" #rozieSpread_0 #rozieListenersTarget_1>

      
      <div class="rozie-listbox-control" #controlEl>
        @if (combobox()) {
    <input #inputEl class="rozie-listbox-input" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" [attr.aria-expanded]="open$local()" [attr.aria-controls]="rozieAttr(id() + '-list')" [attr.aria-activedescendant]="rozieAttr(activeDescendant())" [attr.aria-label]="ariaLabel()" [disabled]="(disabled() || this.__rozieCvaDisabled())" [placeholder]="placeholder()" [value]="query()" (input)="onInput($event)" (keydown)="onControlKeyDown($event)" (focus)="open()" />
    } @else {
    <button #triggerEl type="button" class="rozie-listbox-trigger" role="combobox" aria-haspopup="listbox" [attr.aria-expanded]="open$local()" [attr.aria-controls]="rozieAttr(id() + '-list')" [attr.aria-activedescendant]="rozieAttr(activeDescendant())" [attr.aria-label]="ariaLabel()" [disabled]="(disabled() || this.__rozieCvaDisabled())" (click)="toggle()" (keydown)="onControlKeyDown($event)">
          @if ((selectedTpl ?? templates()?.['selected'])) {
    <ng-container *ngTemplateOutlet="(selectedTpl ?? templates()?.['selected']); context: { $implicit: { selected: selectedLabel(), value: value() }, selected: selectedLabel(), value: value() }" />
    } @else {

            @if (selectedLabel()) {
    <span class="rozie-listbox-selected">{{ rozieDisplay(selectedLabel()) }}</span>
    } @else {
    <span class="rozie-listbox-placeholder">{{ placeholder() }}</span>
    }
    }
          <span class="rozie-listbox-arrow" aria-hidden="true">▾</span>
        </button>
    }</div>

      
      @if (open$local()) {
    <div #listEl class="rozie-listbox-list" role="listbox" [attr.id]="rozieAttr(id() + '-list')" [attr.aria-label]="ariaLabel()" [attr.aria-multiselectable]="multiple()">
        @for (opt of visibleOptions(); track optionId(index); let index = $index) {
    <div [attr.id]="rozieAttr(optionId(index))" class="rozie-listbox-option" [ngClass]="{ 'is-active': activeIndex() === index, 'is-selected': isSelected(opt), 'is-disabled': disabledOf(opt) }" role="option" [attr.aria-selected]="!!isSelected(opt)" [attr.aria-disabled]="!!disabledOf(opt)" (click)="select(opt)" (mousemove)="onOptionPointerMove(index)">
          @if ((optionTpl ?? templates()?.['option'])) {
    <ng-container *ngTemplateOutlet="(optionTpl ?? templates()?.['option']); context: { $implicit: { option: opt, index: index, active: activeIndex() === index, selected: isSelected(opt), disabled: disabledOf(opt) }, option: opt, index: index, active: activeIndex() === index, selected: isSelected(opt), disabled: disabledOf(opt) }" />
    } @else {

            {{ rozieDisplay(labelOf(opt)) }}
          
    }
        </div>
    }

        @if (visibleOptions().length === 0) {
    <div class="rozie-listbox-empty" role="presentation">
          @if ((emptyTpl ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? templates()?.['empty']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    No options
    }
        </div>
    }</div>
    }</div>

  `,
  styles: [`
    .rozie-listbox {
      position: relative;
      display: inline-block;
      min-width: var(--rozie-listbox-min-width, 12rem);
      font: var(--rozie-listbox-font, inherit);
    }
    .rozie-listbox-control { display: block; }
    .rozie-listbox-input,
    .rozie-listbox-trigger {
      box-sizing: border-box;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--rozie-listbox-gap, 0.5rem);
      padding: var(--rozie-listbox-control-padding, 0.5rem 0.75rem);
      font: inherit;
      text-align: left;
      background: var(--rozie-listbox-bg, #fff);
      color: var(--rozie-listbox-fg, #1a1a1a);
      border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-border, rgba(0, 0, 0, 0.2));
      border-radius: var(--rozie-listbox-radius, 6px);
      cursor: pointer;
    }
    .rozie-listbox-input { cursor: text; }
    .rozie-listbox-input:focus-visible,
    .rozie-listbox-input:focus,
    .rozie-listbox-trigger:focus-visible,
    .rozie-listbox-trigger:focus {
      outline: var(--rozie-listbox-ring-width, 2px) solid var(--rozie-listbox-ring, var(--rozie-listbox-accent, #0066cc));
      outline-offset: var(--rozie-listbox-ring-offset, 1px);
    }
    .rozie-listbox-disabled { opacity: var(--rozie-listbox-disabled-opacity, 0.6); pointer-events: none; }
    .rozie-listbox-placeholder { color: var(--rozie-listbox-placeholder, rgba(0, 0, 0, 0.45)); }
    .rozie-listbox-arrow {
      font-size: 0.75em;
      color: var(--rozie-listbox-arrow-color, currentColor);
      opacity: var(--rozie-listbox-arrow-opacity, 0.7);
    }
    .rozie-listbox-list {
      position: absolute;
      z-index: var(--rozie-listbox-z, 1000);
      top: calc(100% + var(--rozie-listbox-popup-offset, 4px));
      left: 0;
      right: 0;
      margin: 0;
      padding: var(--rozie-listbox-popup-padding, 0.25rem);
      max-height: var(--rozie-listbox-max-height, 16rem);
      overflow-y: auto;
      list-style: none;
      background: var(--rozie-listbox-popup-bg, var(--rozie-listbox-bg, #fff));
      color: var(--rozie-listbox-fg, #1a1a1a);
      border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-popup-border, var(--rozie-listbox-border, rgba(0, 0, 0, 0.15)));
      border-radius: var(--rozie-listbox-popup-radius, var(--rozie-listbox-radius, 6px));
      box-shadow: var(--rozie-listbox-shadow, 0 6px 24px rgba(0, 0, 0, 0.12));
    }
    .rozie-listbox-option {
      padding: var(--rozie-listbox-option-padding, 0.4rem 0.6rem);
      border-radius: var(--rozie-listbox-option-radius, 4px);
      color: var(--rozie-listbox-option-fg, inherit);
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--rozie-listbox-gap, 0.5rem);
    }
    .rozie-listbox-option.is-active {
      background: var(--rozie-listbox-active-bg, rgba(0, 102, 204, 0.12));
      color: var(--rozie-listbox-active-fg, inherit);
    }
    .rozie-listbox-option.is-selected {
      background: var(--rozie-listbox-selected-bg, transparent);
      color: var(--rozie-listbox-selected-fg, inherit);
      font-weight: var(--rozie-listbox-selected-weight, 600);
    }
    .rozie-listbox-option.is-selected::after {
      content: var(--rozie-listbox-check, '✓');
      color: var(--rozie-listbox-check-color, var(--rozie-listbox-accent, #0066cc));
    }
    .rozie-listbox-option.is-disabled { opacity: var(--rozie-listbox-disabled-opacity, 0.45); cursor: not-allowed; }
    .rozie-listbox-empty { padding: var(--rozie-listbox-option-padding, 0.5rem 0.6rem); color: var(--rozie-listbox-empty-fg, rgba(0, 0, 0, 0.5)); }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Listbox),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Listbox {
  options = input<any[]>((() => [])());
  value = model<(unknown) | null>(null);
  multiple = input<boolean>(false);
  combobox = input<boolean>(false);
  filterable = input<boolean>(true);
  disabled = input<boolean>(false);
  placeholder = input<string>('');
  closeOnSelect = input<boolean>(true);
  optionLabel = input<((...args: unknown[]) => unknown) | null>(null);
  optionValue = input<((...args: unknown[]) => unknown) | null>(null);
  optionDisabled = input<((...args: unknown[]) => unknown) | null>(null);
  id = input<string>('rozie-listbox');
  ariaLabel = input<(string) | null>(null);
  open$local = signal(false);
  activeIndex = signal(-1);
  query = signal('');
  controlEl = viewChild<ElementRef<HTMLDivElement>>('controlEl');
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  triggerEl = viewChild<ElementRef<HTMLButtonElement>>('triggerEl');
  listEl = viewChild<ElementRef<HTMLDivElement>>('listEl');
  openChange = output<unknown>({ alias: 'open-change' });
  change = output<unknown>();
  search = output<unknown>();
  @ContentChild('selected', { read: TemplateRef }) selectedTpl?: TemplateRef<SelectedCtx>;
  @ContentChild('option', { read: TemplateRef }) optionTpl?: TemplateRef<OptionCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  constructor() {
      const renderer = inject(Renderer2);

      effect((onCleanup) => {
        if (!(this.open$local())) return;
        const handler = ($event: MouseEvent) => {
          const target = $event.target as Node;
          if (this.controlEl()?.nativeElement?.contains(target) || this.listEl()?.nativeElement?.contains(target)) return;
          this.close();
        };
        const unlisten = renderer.listen('document', 'click', handler);
        onCleanup(unlisten);
      });

    inject(DestroyRef).onDestroy(() => {
      if (this.typeTimer !== null) clearTimeout(this.typeTimer);
    });
  }

  selectedLabel = computed(() => {
    const __options = this.options();
    const cur = this.value();
    if (this.multiple()) {
      // Read the model value into a local before narrowing: `$props.value` lowers
      // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
      // separate calls — narrowing one stable local works on every target.
      const arr = Array.isArray(cur) ? cur : [];
      if (arr.length === 0) return '';
      return __options.filter((o: any) => arr.includes(valueOf$local(o))).map(this.labelOf).join(', ');
    }
    const match = __options.find((o: any) => valueOf$local(o) === cur);
    return match === undefined ? '' : this.labelOf(match);
  });
  activeDescendant = computed(() => {
    const __activeIndex = this.activeIndex();
    if (!this.open$local() || __activeIndex < 0) return null;
    return this.optionId(__activeIndex);
  });

  typeBuffer = '';
  typeTimer: any = null;
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
  optionId = (index: any) => this.id() + '-opt-' + index;
  visibleOptions = () => {
    const __options = this.options();
    if (!this.combobox() || !this.filterable()) return __options;
    const q = this.query().trim().toLowerCase();
    if (q === '') return __options;
    return __options.filter((opt: any) => this.labelOf(opt).toLowerCase().includes(q));
  };
  isSelected = (opt: any) => {
    const v = valueOf$local(opt);
    const cur = this.value();
    if (this.multiple()) return Array.isArray(cur) && cur.includes(v);
    return cur === v;
  };
  resolveInitialActive = () => {
    const opts = this.visibleOptions();
    const sel = opts.findIndex((o: any) => this.isSelected(o) && !this.disabledOf(o));
    if (sel !== -1) return sel;
    return opts.findIndex((o: any) => !this.disabledOf(o));
  };
  focusControl = () => {
    if (this.combobox()) this.inputEl()?.nativeElement?.focus();else this.triggerEl()?.nativeElement?.focus();
  };
  scrollActiveIntoView = () => {
    const __activeIndex = this.activeIndex();
    if (!this.listEl()?.nativeElement || __activeIndex < 0) return;
    const el = this.listEl()!.nativeElement.querySelector('#' + CSS.escape(this.optionId(__activeIndex)));
    el?.scrollIntoView({
      block: 'nearest'
    });
  };
  applyExpanded = (next: any) => {
    if (next && (this.disabled() || this.__rozieCvaDisabled())) return;
    if (this.open$local() === next) return;
    this.open$local.set(next);
    this.activeIndex.set(next ? this.resolveInitialActive() : -1);
    this.openChange.emit({
      open: next
    });
  };
  open = () => this.applyExpanded(true);
  close = () => this.applyExpanded(false);
  toggle = () => this.applyExpanded(!this.open$local());
  fireChange = (value: any, option: any) => this.change.emit({
    value: this.value(),
    option
  });
  select = (opt: any) => {
    if (this.disabledOf(opt)) return;
    const v = valueOf$local(opt);
    if (this.multiple()) {
      const cur = this.value();
      const arr = Array.isArray(cur) ? cur : [];
      // Fresh array on every commit — in-place mutation is dropped by the
      // React/Solid/Lit/Angular change detectors.
      const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
      this.value.set(next), this.__rozieCvaOnChange(next);
      this.fireChange(next, opt);
    } else {
      this.value.set(v), this.__rozieCvaOnChange(v);
      this.fireChange(v, opt);
      if (this.closeOnSelect()) {
        this.close();
        this.focusControl();
      }
    }
  };
  clear = () => {
    const empty = this.multiple() ? [] : null;
    this.value.set(empty), this.__rozieCvaOnChange(empty);
    this.query.set('');
    this.fireChange(empty, null);
  };
  nextEnabled = (from: any, dir: any) => {
    const opts = this.visibleOptions();
    if (opts.length === 0) return -1;
    let i = from;
    for (let step = 0; step < opts.length; step++) {
      i += dir;
      if (i < 0) i = opts.length - 1;else if (i >= opts.length) i = 0;
      if (!this.disabledOf(opts[i])) return i;
    }
    return from;
  };
  move = (dir: any) => {
    if (!this.open$local()) {
      this.open();
      return;
    }
    const start = this.activeIndex() < 0 ? dir > 0 ? -1 : 0 : this.activeIndex();
    this.activeIndex.set(this.nextEnabled(start, dir));
    this.scrollActiveIntoView();
  };
  moveEdge = (toEnd: any) => {
    if (!this.open$local()) this.open();
    this.activeIndex.set(toEnd ? this.nextEnabled(-1, -1) : this.nextEnabled(-1, 1));
    this.scrollActiveIntoView();
  };
  commitActive = () => {
    const __activeIndex = this.activeIndex();
    const opts = this.visibleOptions();
    if (__activeIndex >= 0 && __activeIndex < opts.length) this.select(opts[__activeIndex]);
  };
  onTypeahead = (ch: any) => {
    if (this.typeTimer !== null) clearTimeout(this.typeTimer);
    this.typeBuffer += ch.toLowerCase();
    this.typeTimer = setTimeout(() => {
      this.typeBuffer = '';
    }, 600);
    const opts = this.visibleOptions();
    const idx = opts.findIndex((o: any) => !this.disabledOf(o) && this.labelOf(o).toLowerCase().startsWith(this.typeBuffer));
    if (idx !== -1) {
      if (!this.open$local()) this.open();
      this.activeIndex.set(idx);
      this.scrollActiveIntoView();
    }
  };
  onControlKeyDown = ($event: any) => {
    const __open$local = this.open$local();
    const __combobox = this.combobox();
    const key = $event.key;
    if (key === 'ArrowDown') {
      $event.preventDefault();
      this.move(1);
    } else if (key === 'ArrowUp') {
      $event.preventDefault();
      this.move(-1);
    } else if (key === 'Home') {
      $event.preventDefault();
      this.moveEdge(false);
    } else if (key === 'End') {
      $event.preventDefault();
      this.moveEdge(true);
    } else if (key === 'Enter') {
      if (__open$local) {
        $event.preventDefault();
        this.commitActive();
      }
    } else if (key === 'Escape') {
      if (__open$local) {
        $event.preventDefault();
        this.close();
        this.focusControl();
      }
    } else if (key === ' ' || key === 'Spacebar') {
      // Space toggles / commits in select-only mode; a combobox input needs the
      // literal space, so do nothing there.
      if (!__combobox) {
        $event.preventDefault();
        if (!__open$local) this.open();else this.commitActive();
      }
    } else if (key === 'Tab') {
      if (__open$local) this.close();
    } else if (!__combobox && key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
      this.onTypeahead(key);
    }
  };
  fireSearch = (query: any) => this.search.emit({
    query: this.query()
  });
  onInput = ($event: any) => {
    // Use the fresh input value throughout — a re-read of `$data.query` right
    // after writing it is STALE on React (setState is async; the closure's
    // `query` is the pre-write value), so emit + filter off `q`, not `$data.query`.
    const q = $event.target.value;
    this.query.set(q);
    if (!this.open$local()) this.open();
    this.activeIndex.set(this.nextEnabled(-1, 1));
    this.fireSearch(q);
  };
  onOptionPointerMove = (index: any) => {
    if (this.activeIndex() !== index) this.activeIndex.set(index);
  };

  private __rozieCvaOnChange: (v: unknown) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  private __rozieCvaDisabled = signal(false);

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
    _dir: Listbox,
    _ctx: unknown,
  ): _ctx is SelectedCtx | OptionCtx | EmptyCtx {
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

export default Listbox;
