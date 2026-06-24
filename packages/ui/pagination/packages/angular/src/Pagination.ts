import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { paginationItems } from './internal/paginationItems';

// ---- derived view (ONE plain function, uniform x6) ---------------------
// The whole render model in a single call: { totalPages, page, pages,
// hasPrev, hasNext }. A PLAIN function (not $computed) so it reads uniformly
// on all six targets and can be aliased in handlers without the Solid
// accessor divergence. Returns a FRESH object each call — never feed it to a
// reference-equality $watch getter.

interface PrevControlCtx {
  $implicit: { disabled: any; goto: any; page: any };
  disabled: any;
  goto: any;
  page: any;
}

interface EllipsisCtx {
  $implicit: { index: any };
  index: any;
}

interface ItemCtx {
  $implicit: { page: any; selected: any; goto: any };
  page: any;
  selected: any;
  goto: any;
}

interface NextControlCtx {
  $implicit: { disabled: any; goto: any; page: any };
  disabled: any;
  goto: any;
  page: any;
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
  selector: 'rozie-pagination',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <nav class="rozie-pagination" [ngClass]="{ 'rozie-pagination--disabled': (disabled() || this.__rozieCvaDisabled()) }" #nav [attr.aria-label]="ariaLabel()" #rozieSpread_0 (keydown)="onControlKeydown($event)" #rozieListenersTarget_1>
      
      @if ((prevControlTpl ?? templates()?.['prevControl'])) {
    <ng-container *ngTemplateOutlet="(prevControlTpl ?? templates()?.['prevControl']); context: { $implicit: { disabled: !canPrev() || disabled(), goto: goPrev, page: currentPage() - 1 }, disabled: !canPrev() || disabled(), goto: goPrev, page: currentPage() - 1 }" />
    } @else {

        <button type="button" class="rozie-pagination-control rozie-pagination-prev" data-page-control="" [attr.tabindex]="rozieAttr(tabIndexFor(true))" [disabled]="!canPrev() || (disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(!canPrev() || (disabled() || this.__rozieCvaDisabled()))" aria-label="Previous page" (click)="goPrev()">‹</button>
      
    }

      
      @for (item of model().pages; track item + '-' + index; let index = $index) {

        @if (item === 'ellipsis') {
    <span class="rozie-pagination-ellipsis" aria-hidden="true">
          @if ((ellipsisTpl ?? templates()?.['ellipsis'])) {
    <ng-container *ngTemplateOutlet="(ellipsisTpl ?? templates()?.['ellipsis']); context: { $implicit: { index: index }, index: index }" />
    } @else {
    …
    }
        </span>
    }@if (item !== 'ellipsis') {
    <span class="rozie-pagination-item">
          @if ((itemTpl ?? templates()?.['item'])) {
    <ng-container *ngTemplateOutlet="(itemTpl ?? templates()?.['item']); context: _item_ctx_2(item, index)" />
    } @else {

            <button type="button" class="rozie-pagination-page" [ngClass]="{ 'is-active': isActive(item) }" data-page-control="" [attr.tabindex]="rozieAttr(tabIndexFor(isActive(item)))" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-current]="rozieAttr(isActive(item) ? 'page' : null)" [attr.aria-label]="rozieAttr('Go to page ' + item)" (click)="goToPage(item)">{{ rozieDisplay(item) }}</button>
          
    }
        </span>
    }
    }

      
      @if ((nextControlTpl ?? templates()?.['nextControl'])) {
    <ng-container *ngTemplateOutlet="(nextControlTpl ?? templates()?.['nextControl']); context: { $implicit: { disabled: !canNext() || disabled(), goto: goNext, page: currentPage() + 1 }, disabled: !canNext() || disabled(), goto: goNext, page: currentPage() + 1 }" />
    } @else {

        <button type="button" class="rozie-pagination-control rozie-pagination-next" data-page-control="" [attr.tabindex]="rozieAttr(tabIndexFor(true))" [disabled]="!canNext() || (disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(!canNext() || (disabled() || this.__rozieCvaDisabled()))" aria-label="Next page" (click)="goNext()">›</button>
      
    }
    </nav>

  `,
  styles: [`
    .rozie-pagination {
      display: inline-flex;
      align-items: center;
      gap: var(--rozie-pagination-gap, 0.25rem);
      font: var(--rozie-pagination-font, inherit);
    }
    .rozie-pagination-page,
    .rozie-pagination-control {
      box-sizing: border-box;
      min-width: var(--rozie-pagination-size, 2.25rem);
      height: var(--rozie-pagination-size, 2.25rem);
      padding: 0 var(--rozie-pagination-padding-x, 0.5rem);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font: inherit;
      font-weight: var(--rozie-pagination-font-weight, 500);
      color: var(--rozie-pagination-fg, #1a1a1a);
      background: var(--rozie-pagination-bg, transparent);
      border: var(--rozie-pagination-border-width, 1px) solid var(--rozie-pagination-border, rgba(0, 0, 0, 0.18));
      border-radius: var(--rozie-pagination-radius, 6px);
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .rozie-pagination-page:hover,
    .rozie-pagination-control:hover {
      background: var(--rozie-pagination-hover-bg, rgba(0, 0, 0, 0.05));
      border-color: var(--rozie-pagination-hover-border, rgba(0, 0, 0, 0.28));
    }
    .rozie-pagination-page:focus-visible,
    .rozie-pagination-control:focus-visible {
      outline: var(--rozie-pagination-ring-width, 2px) solid var(--rozie-pagination-ring, var(--rozie-pagination-accent, #0066cc));
      outline-offset: var(--rozie-pagination-ring-offset, 1px);
    }
    .rozie-pagination-page.is-active {
      color: var(--rozie-pagination-active-fg, #fff);
      background: var(--rozie-pagination-active-bg, var(--rozie-pagination-accent, #0066cc));
      border-color: var(--rozie-pagination-active-border, var(--rozie-pagination-accent, #0066cc));
    }
    .rozie-pagination-page:disabled,
    .rozie-pagination-control:disabled {
      cursor: not-allowed;
      opacity: var(--rozie-pagination-disabled-opacity, 0.5);
      pointer-events: none;
    }
    .rozie-pagination--disabled {
      opacity: var(--rozie-pagination-disabled-opacity, 0.5);
      pointer-events: none;
    }
    .rozie-pagination-ellipsis {
      min-width: var(--rozie-pagination-size, 2.25rem);
      height: var(--rozie-pagination-size, 2.25rem);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--rozie-pagination-ellipsis-fg, rgba(0, 0, 0, 0.5));
      user-select: none;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Pagination),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Pagination {
  /**
   * The 1-based current page (two-way model). Clamped into `[1, totalPages]`. Bind it with `r-model:modelValue` / `v-model:modelValue` / `modelValue` + `onModelValueChange`; it is also the Angular ControlValueAccessor control value.
   */
  modelValue = model<number>(1);
  /**
   * Explicit total page count. When provided (> 0) it takes precedence over `total` + `pageSize`. Use it when the backend already reports the page count.
   */
  totalPages = input<(number) | null>(null);
  /**
   * Total item count. Combined with `pageSize` to derive the page count (`ceil(total / pageSize)`) when `totalPages` is not given.
   */
  total = input<(number) | null>(null);
  /**
   * Items per page. Combined with `total` to derive the page count when `totalPages` is not given.
   */
  pageSize = input<(number) | null>(null);
  /**
   * Number of page buttons shown on each side of the current page (the sibling window). Larger values show more context around the current page.
   */
  siblingCount = input<number>(1);
  /**
   * Number of page buttons always shown at each boundary (the first and last `boundaryCount` pages), regardless of the current page.
   */
  boundaryCount = input<number>(1);
  /**
   * Disable the entire control — every page button and the prev/next controls become non-interactive and are marked `aria-disabled`.
   */
  disabled = input<boolean>(false);
  /**
   * Accessible name for the surrounding `<nav>` landmark (its `aria-label`). Defaults to `"Pagination"`.
   */
  ariaLabel = input<string>('Pagination');
  nav = viewChild<ElementRef<HTMLElement>>('nav');
  change = output<unknown>();
  @ContentChild('prevControl', { read: TemplateRef }) prevControlTpl?: TemplateRef<PrevControlCtx>;
  @ContentChild('ellipsis', { read: TemplateRef }) ellipsisTpl?: TemplateRef<EllipsisCtx>;
  @ContentChild('item', { read: TemplateRef }) itemTpl?: TemplateRef<ItemCtx>;
  @ContentChild('nextControl', { read: TemplateRef }) nextControlTpl?: TemplateRef<NextControlCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  model = () => paginationItems({
    page: this.modelValue(),
    totalPages: this.totalPages(),
    total: this.total(),
    pageSize: this.pageSize(),
    siblingCount: this.siblingCount(),
    boundaryCount: this.boundaryCount()
  });
  effectivePages = () => this.model().totalPages;
  currentPage = () => this.model().page;
  canPrev = () => this.model().hasPrev;
  canNext = () => this.model().hasNext;
  isActive = (page: any) => page === this.currentPage();
  tabIndexFor = (active: any): number | undefined => active ? 0 : -1;
  goToPage = (page: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const tp = this.effectivePages();
    let target = typeof page === 'number' ? Math.floor(page) : 1;
    if (target < 1) target = 1;
    if (target > tp) target = tp;
    if (target === this.currentPage()) return;
    this.modelValue.set(target), this.__rozieCvaOnChange(target);
    this.change.emit({
      page: target
    });
  };
  goNext = () => {
    if (this.canNext()) this.goToPage(this.currentPage() + 1);
  };
  goPrev = () => {
    if (this.canPrev()) this.goToPage(this.currentPage() - 1);
  };
  goFirst = () => this.goToPage(1);
  goLast = () => this.goToPage(this.effectivePages());
  controls = () => {
    const nav = this.nav()?.nativeElement;
    if (!nav) return [];
    return Array.from(nav.querySelectorAll('[data-page-control]')) as HTMLElement[];
  };
  focusControlAt = (idx: any) => {
    const els = this.controls();
    if (els.length === 0) return;
    let i = idx;
    if (i < 0) i = 0;
    if (i >= els.length) i = els.length - 1;
    const el = els[i];
    if (el && el.focus) el.focus();
  };
  focusedIndex = () => {
    const els = this.controls();
    const nav = this.nav()?.nativeElement;
    const active = nav ? nav.ownerDocument.activeElement : null;
    return els.indexOf(active as HTMLElement);
  };
  onControlKeydown = ($event: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const key = $event.key;
    const cur = this.focusedIndex();
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      $event.preventDefault();
      this.focusControlAt(cur + 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      $event.preventDefault();
      this.focusControlAt(cur - 1);
    } else if (key === 'Home') {
      $event.preventDefault();
      this.focusControlAt(0);
    } else if (key === 'End') {
      $event.preventDefault();
      this.focusControlAt(this.controls().length - 1);
    }
  };
  goto = (page: any) => this.goToPage(page);
  next = () => this.goNext();
  prev = () => this.goPrev();
  first = () => this.goFirst();
  last = () => this.goLast();

  private __rozieCvaOnChange: (v: number) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: number | null): void {
    this.modelValue.set(v ?? 1);
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

  static ngTemplateContextGuard(
    _dir: Pagination,
    _ctx: unknown,
  ): _ctx is PrevControlCtx | EllipsisCtx | ItemCtx | NextControlCtx {
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

  private _item_ctx_2 = (item: any, index: any) => ({ $implicit: { page: item, selected: this.isActive(item), goto: () => this.goToPage(item) }, page: item, selected: this.isActive(item), goto: () => this.goToPage(item) });

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Pagination;
