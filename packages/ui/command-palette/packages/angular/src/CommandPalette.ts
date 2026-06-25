import { Component, ContentChild, DestroyRef, ElementRef, TemplateRef, ViewEncapsulation, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list, each carrying its filtered-list index `_i`. A plain
// function (called from the r-for AND handlers) — never $computed.

interface ItemCtx {
  $implicit: { item: any; active: any };
  item: any;
  active: any;
}

interface EmptyCtx {}

interface FooterCtx {}

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
  selector: 'rozie-command-palette',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    @if (open()) {
    <div class="rozie-command-palette" (click)="onBackdropClick($event)">
      <div class="rozie-command-palette-panel" role="dialog" aria-modal="true" [attr.aria-label]="ariaLabel()" (keydown)="onKeydown($event)">
        <div class="rozie-command-palette-search">
          <input #inputEl class="rozie-command-palette-input" type="text" role="combobox" aria-autocomplete="list" [attr.id]="rozieAttr(inputId())" [attr.aria-expanded]="!!open()" [attr.aria-controls]="rozieAttr(listId())" [attr.aria-activedescendant]="rozieAttr(activeId())" [attr.aria-label]="ariaLabel()" [value]="query()" [placeholder]="placeholder()" autocomplete="off" (input)="onInput($event)" />
        </div>

        @if (filteredItems().length > 0) {
    <ul class="rozie-command-palette-list" [attr.id]="rozieAttr(listId())" role="listbox" [attr.aria-label]="ariaLabel()">
          @for (item of filteredItems(); track item.id) {
    <li class="rozie-command-palette-option" [ngClass]="{ 'rozie-command-palette-option--active': item._i === activeIndex(), 'rozie-command-palette-option--disabled': item.disabled }" [attr.id]="rozieAttr(optId(item._i))" role="option" [attr.aria-selected]="item._i === activeIndex()" [attr.aria-disabled]="!!item.disabled" (mousedown)="$event.preventDefault(); selectItem(item)" (mouseenter)="activeIndex.set(item._i)">
            @if ((itemTpl ?? templates()?.['item'])) {
    <ng-container *ngTemplateOutlet="(itemTpl ?? templates()?.['item']); context: { $implicit: { item: item, active: item._i === activeIndex() }, item: item, active: item._i === activeIndex() }" />
    } @else {

              <span class="rozie-command-palette-option-label">{{ rozieDisplay(item.label) }}</span>
              @if (item.group) {
    <span class="rozie-command-palette-option-group">{{ rozieDisplay(item.group) }}</span>
    }
    }
          </li>
    }
        </ul>
    }@if (filteredItems().length === 0) {
    <div class="rozie-command-palette-empty">
          @if ((emptyTpl ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? templates()?.['empty'])" />
    } @else {
    {{ emptyText() }}
    }
        </div>
    }@if ((footerTpl ?? templates()?.['footer'])) {
    <div class="rozie-command-palette-footer">
          @if ((footerTpl ?? templates()?.['footer'])) {
    <ng-container *ngTemplateOutlet="(footerTpl ?? templates()?.['footer'])" />
    }
        </div>
    }</div>
    </div>
    }
  `,
  styles: [`
    .rozie-command-palette {
      position: fixed;
      inset: 0;
      z-index: var(--rozie-command-palette-z, 1000);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: var(--rozie-command-palette-overlay-padding, 12vh 1rem 1rem);
      background: var(--rozie-command-palette-backdrop-bg, rgba(0, 0, 0, 0.5));
      backdrop-filter: var(--rozie-command-palette-backdrop-filter, none);
    }
    .rozie-command-palette-panel {
      display: flex;
      flex-direction: column;
      width: var(--rozie-command-palette-width, min(40rem, 100%));
      max-height: var(--rozie-command-palette-max-height, 70vh);
      overflow: hidden;
      font: var(--rozie-command-palette-font, inherit);
      color: var(--rozie-command-palette-color, inherit);
      background: var(--rozie-command-palette-bg, #fff);
      border: var(--rozie-command-palette-border, none);
      border-radius: var(--rozie-command-palette-radius, 0.75rem);
      box-shadow: var(--rozie-command-palette-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25));
    }
    .rozie-command-palette-search {
      padding: var(--rozie-command-palette-search-padding, 0.75rem);
      border-bottom: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
    }
    .rozie-command-palette-input {
      box-sizing: border-box;
      width: 100%;
      padding: var(--rozie-command-palette-input-padding, 0.5rem 0.75rem);
      font: inherit;
      font-size: var(--rozie-command-palette-input-font-size, 1.05rem);
      color: inherit;
      background: var(--rozie-command-palette-input-bg, transparent);
      border: var(--rozie-command-palette-input-border, none);
      border-radius: var(--rozie-command-palette-input-radius, 0.5rem);
      outline: none;
    }
    .rozie-command-palette-list {
      margin: 0;
      padding: var(--rozie-command-palette-list-padding, 0.5rem);
      list-style: none;
      overflow-y: auto;
    }
    .rozie-command-palette-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--rozie-command-palette-option-gap, 0.75rem);
      padding: var(--rozie-command-palette-option-padding, 0.5rem 0.625rem);
      border-radius: var(--rozie-command-palette-option-radius, 0.5rem);
      cursor: pointer;
      color: var(--rozie-command-palette-option-color, inherit);
    }
    .rozie-command-palette-option--active {
      background: var(--rozie-command-palette-option-active-bg, rgba(0, 102, 204, 0.12));
      color: var(--rozie-command-palette-option-active-color, inherit);
    }
    .rozie-command-palette-option--disabled {
      cursor: not-allowed;
      opacity: var(--rozie-command-palette-option-disabled-opacity, 0.45);
    }
    .rozie-command-palette-option-group {
      font-size: var(--rozie-command-palette-group-font-size, 0.75rem);
      color: var(--rozie-command-palette-group-color, rgba(0, 0, 0, 0.5));
      text-transform: var(--rozie-command-palette-group-transform, uppercase);
      letter-spacing: 0.04em;
    }
    .rozie-command-palette-empty {
      padding: var(--rozie-command-palette-empty-padding, 1.5rem);
      text-align: center;
      color: var(--rozie-command-palette-empty-color, rgba(0, 0, 0, 0.5));
    }
    .rozie-command-palette-footer {
      padding: var(--rozie-command-palette-footer-padding, 0.5rem 0.75rem);
      border-top: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
      font-size: var(--rozie-command-palette-footer-font-size, 0.8125rem);
      color: var(--rozie-command-palette-footer-color, rgba(0, 0, 0, 0.55));
    }
  `],
})
export class CommandPalette {
  /**
   * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
   * @example
   * <CommandPalette r-model:open="paletteOpen" :items="commands" />
   */
  open = model<boolean>(false);
  /**
   * The current search text (two-way `r-model`). Two-way bind it to read or pre-seed the query; the component filters `items` by this string over each item `label` plus its `keywords`. Cleared to `""` whenever the palette opens.
   */
  query = model<string>('');
  /**
   * The command list — `[{ id, label, group?, keywords?, disabled? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` buckets items under a heading; optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation.
   */
  items = input<any[]>((() => [])());
  /**
   * Placeholder text shown in the search input while the query is empty.
   */
  placeholder = input<string>('Type a command…');
  /**
   * Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup.
   */
  emptyText = input<string>('No results.');
  /**
   * Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row.
   */
  closeOnSelect = input<boolean>(true);
  /**
   * Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands").
   */
  ariaLabel = input<string>('Command palette');
  /**
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase = input<string>('rozie-command-palette');
  activeIndex = signal(0);
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  select = output<unknown>();
  @ContentChild('item', { read: TemplateRef }) itemTpl?: TemplateRef<ItemCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen) this.onOpen();
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    if (this.open()) this.onOpen();
  }

  filteredItems = () => {
    const __items = this.items();
    const src = Array.isArray(__items) ? __items : [];
    const list = filterCommands(src, this.query());
    return list.map((it: any, i: any) => ({
      id: it.id,
      label: it.label,
      group: it.group,
      keywords: it.keywords,
      disabled: !!it.disabled,
      _i: i
    }));
  };
  optId = (i: any) => this.idBase() + '-opt-' + i;
  listId = () => this.idBase() + '-list';
  inputId = () => this.idBase() + '-input';
  activeId = () => {
    const __activeIndex = this.activeIndex();
    const list = this.filteredItems();
    if (__activeIndex >= 0 && list[__activeIndex]) return this.optId(__activeIndex);
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
  firstEnabled = (list: any) => {
    for (let i = 0; i < list.length; i++) {
      if (list[i] && !list[i].disabled) return i;
    }
    return 0;
  };
  closePalette = () => {
    this.open.set(false);
  };
  selectItem = (item: any) => {
    if (!item || item.disabled) return;
    this.select.emit({
      id: item.id,
      label: item.label,
      group: item.group
    });
    if (this.closeOnSelect()) this.closePalette();
  };
  onInput = (e: any) => {
    const __items = this.items();
    const q = e && e.target ? e.target.value : '';
    this.query.set(q);
    // Reset the highlight to the first enabled item of the NEW filtered list.
    const next = filterCommands(Array.isArray(__items) ? __items : [], q);
    this.activeIndex.set(this.firstEnabled(next));
  };
  onKeydown = (e: any) => {
    const key = e ? e.key : '';
    const list = this.filteredItems();
    const ai = this.activeIndex();
    if (key === 'ArrowDown') {
      if (e) e.preventDefault();
      this.activeIndex.set(this.nextEnabled(list, ai, 1));
    } else if (key === 'ArrowUp') {
      if (e) e.preventDefault();
      this.activeIndex.set(this.nextEnabled(list, ai, -1));
    } else if (key === 'Home') {
      if (e) e.preventDefault();
      this.activeIndex.set(this.nextEnabled(list, -1, 1));
    } else if (key === 'End') {
      if (e) e.preventDefault();
      this.activeIndex.set(this.nextEnabled(list, list.length, -1));
    } else if (key === 'Enter') {
      if (ai >= 0 && list[ai]) {
        if (e) e.preventDefault();
        this.selectItem(list[ai]);
      }
    } else if (key === 'Escape') {
      if (e) e.preventDefault();
      this.closePalette();
    }
  };
  onBackdropClick = (e: any) => {
    if (e && e.target === e.currentTarget) this.closePalette();
  };
  onOpen = () => {
    const __items = this.items();
    this.query.set('');
    this.activeIndex.set(this.firstEnabled(filterCommands(Array.isArray(__items) ? __items : [], '')));
    const el = this.inputEl()?.nativeElement;
    if (el && el.focus) {
      // Defer a tick so the overlay is mounted before focusing.
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          const again = this.inputEl()?.nativeElement;
          if (again && again.focus) again.focus();
        });
      } else {
        el.focus();
      }
    }
  };
  show = () => {
    this.open.set(true);
  };
  close = () => {
    this.closePalette();
  };
  toggle = () => {
    this.open.set(!this.open());
  };
  focus = () => this.inputEl()?.nativeElement?.focus();

  static ngTemplateContextGuard(
    _dir: CommandPalette,
    _ctx: unknown,
  ): _ctx is ItemCtx | EmptyCtx | FooterCtx {
    return true;
  }

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default CommandPalette;
