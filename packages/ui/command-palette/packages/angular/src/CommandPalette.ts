import { Component, ContentChild, DestroyRef, ElementRef, TemplateRef, ViewEncapsulation, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Combobox } from '@rozie-ui/combobox-angular';

import { scoreCommands, labelHighlight } from './internal/scoreCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The ranked command list fed to the vendored <Combobox> as its `:options`.
// command-palette KEEPS its own ranking (scoreCommands, fuzzy-subsequence by
// default over label+keywords, label weighted above keywords, pluggable via
// $props.score) and runs <Combobox :disable-filter="true"> — combobox's
// built-in filter is label-only substring and would drop keyword matching +
// the ranked ordering. scoreCommands already normalizes non-array input, so
// no local Array.isArray guard is needed. A plain function (called from the
// template binding AND handlers) — never $computed (the combobox
// value-vs-accessor split). Each item is passed through verbatim; combobox
// resolves its value via `optionValue` (below) and its label via `.label`.

interface OptionCtx {
  $implicit: { option: any; index: any; active: any; selected: any; disabled: any; matches: any };
  option: any;
  index: any;
  active: any;
  selected: any;
  disabled: any;
  matches: any;
}

interface EmptyCtx {
  $implicit: { query: any };
  query: any;
}

interface FooterCtx {}

interface IconCtx {
  $implicit: { option: any };
  option: any;
}

interface ActionsCtx {
  $implicit: { option: any; actions: any };
  option: any;
  actions: any;
}

interface TrailingCtx {
  $implicit: { option: any };
  option: any;
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
  selector: 'rozie-command-palette',
  standalone: true,
  imports: [NgTemplateOutlet, Combobox],
  template: `

    @if (open()) {
    <div class="rozie-command-palette" (click)="onBackdropClick($event)">
      <div #panel class="rozie-command-palette-panel" role="dialog" aria-modal="true" [attr.aria-label]="ariaLabel()" (keydown)="onPanelKeydown($event)">
        
        <rozie-combobox #combobox [inline]="true" [disableFilter]="true" [closeOnSelect]="false" [options]="filteredItems()" [optionValue]="commandValue" [optionDisabled]="commandDisabled" [placeholder]="placeholder()" [ariaLabel]="ariaLabel()" [idBase]="idBase()" [value]="activeValue()" (valueChange)="activeValue.set($event)" (change)="onComboboxChange($event)" (search)="onComboboxSearch($event)"><ng-template #option let-option="option" let-index="index" let-active="active" let-selected="selected" let-disabled="disabled">
            @if ((optionTpl ?? templates()?.['option'])) {
    <ng-container *ngTemplateOutlet="(optionTpl ?? templates()?.['option']); context: { $implicit: { option: option, index: index, active: active, selected: selected, disabled: disabled, matches: labelHighlight(labelText(option), query()) }, option: option, index: index, active: active, selected: selected, disabled: disabled, matches: labelHighlight(labelText(option), query()) }" />
    } @else {

              <div class="rozie-command-palette-option">
                @if ((iconTpl ?? templates()?.['icon'])) {
    <span class="rozie-command-palette-option-icon">
                  @if ((iconTpl ?? templates()?.['icon'])) {
    <ng-container *ngTemplateOutlet="(iconTpl ?? templates()?.['icon']); context: { $implicit: { option: option }, option: option }" />
    }
                </span>
    }<span class="rozie-command-palette-option-main">
                  <span class="rozie-command-palette-option-label">
                    @for (segment of labelSegments(option); track si; let si = $index) {
    <span [class]="{ 'rozie-command-palette-option-label-match': segment.match }">{{ rozieDisplay(segment.text) }}</span>
    }
                  </span>
                  @if (groupText(option)) {
    <span class="rozie-command-palette-option-group">{{ rozieDisplay(groupText(option)) }}</span>
    }</span>
                @if ((actionsTpl ?? templates()?.['actions'])) {
    <span class="rozie-command-palette-option-actions">
                  @if ((actionsTpl ?? templates()?.['actions'])) {
    <ng-container *ngTemplateOutlet="(actionsTpl ?? templates()?.['actions']); context: { $implicit: { option: option, actions: actionsList(option) }, option: option, actions: actionsList(option) }" />
    }
                </span>
    }@if ((trailingTpl ?? templates()?.['trailing'])) {
    <span class="rozie-command-palette-option-trailing">
                  @if ((trailingTpl ?? templates()?.['trailing'])) {
    <ng-container *ngTemplateOutlet="(trailingTpl ?? templates()?.['trailing']); context: { $implicit: { option: option }, option: option }" />
    }
                </span>
    }</div>
            
    }
          </ng-template><ng-template #empty let-query="query">
            @if ((emptyTpl ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? templates()?.['empty']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    {{ emptyText() }}
    }
          </ng-template></rozie-combobox>

        
        @if ((footerTpl ?? templates()?.['footer'])) {
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
    :host(rozie-command-palette) { display: contents; }
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
      gap: var(--rozie-command-palette-option-gap, 0.75rem);
    }
    .rozie-command-palette-option-main {
      display: flex;
      align-items: center;
      gap: var(--rozie-command-palette-option-gap, 0.75rem);
      flex: 1 1 auto;
      min-width: 0;
    }
    .rozie-command-palette-option-icon {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      color: var(--rozie-command-palette-icon-color, inherit);
      font-size: var(--rozie-command-palette-icon-size, 1rem);
    }
    .rozie-command-palette-option-actions {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      gap: var(--rozie-command-palette-actions-gap, 0.375rem);
      color: var(--rozie-command-palette-actions-color, rgba(0, 0, 0, 0.55));
      font-size: var(--rozie-command-palette-actions-font-size, 0.75rem);
    }
    .rozie-command-palette-option-trailing {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      color: var(--rozie-command-palette-trailing-color, rgba(0, 0, 0, 0.5));
      font-size: var(--rozie-command-palette-trailing-font-size, 0.75rem);
    }
    .rozie-command-palette-option-group {
      font-size: var(--rozie-command-palette-group-font-size, 0.75rem);
      color: var(--rozie-command-palette-group-color, rgba(0, 0, 0, 0.5));
      text-transform: var(--rozie-command-palette-group-transform, uppercase);
      letter-spacing: 0.04em;
    }
    .rozie-command-palette-option-label-match {
      font-weight: var(--rozie-command-palette-match-weight, 600);
      color: var(--rozie-command-palette-match-color, inherit);
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
   * The current search text (two-way `r-model`). Two-way bind it to read the query, or pre-seed it by setting a value alongside `open` — an open no longer clears it, so the palette opens filtered to that query. The component ranks `items` by this string via `score` (fuzzy-subsequence by default, matched over each item `label` plus its `keywords`, label weighted above keywords). Reset to `""` when the palette closes, so each plain open starts with a fresh search box.
   */
  query = model<string>('');
  /**
   * Custom ranking/exclusion hook: `(item, query) => number | null`. Return `null` to exclude an item from the results; otherwise higher numbers rank first. Leave unset (`default: null`) to use the built-in fuzzy-subsequence scorer (label weighted above keywords). A recency/frecency boost is added INSIDE `score` (e.g. `return baseScore + recencyBonus(item.id)`), not as a separate prop.
   * @example
   * <CommandPalette :score="(item, q) => item.label.includes(q) ? 1 : null" :items="commands" />
   */
  score = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * The command list — `[{ id, label, group?, keywords?, disabled?, icon?, actions? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` is shown as a per-row label on each matching command (it is not a section heading — items are not bucketed); optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. The optional `icon` and `actions` fields are display-only — unused by ranking — surfaced through the `#icon` and `#actions` option-row slots.
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
   * Id base for the combobox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase = input<string>('rozie-command-palette');
  activeValue = signal<any>(null);
  panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  combobox = viewChild<Combobox>('combobox');
  select = output<unknown>();
  @ContentChild('option', { read: TemplateRef }) optionTpl?: TemplateRef<OptionCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;
  @ContentChild('icon', { read: TemplateRef }) iconTpl?: TemplateRef<IconCtx>;
  @ContentChild('actions', { read: TemplateRef }) actionsTpl?: TemplateRef<ActionsCtx>;
  @ContentChild('trailing', { read: TemplateRef }) trailingTpl?: TemplateRef<TrailingCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen) this.onOpen();else this.query.set('');
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    if (this.open()) this.onOpen();
  }

  filteredItems = () => scoreCommands(this.items(), this.query(), this.score());
  commandValue = (it: any) => it && it.id !== undefined ? it.id : it;
  commandDisabled = (it: any) => !!(it && it.disabled);
  labelText = (o: any) => o && o.label !== undefined ? o.label : '';
  groupText = (o: any) => o && o.group !== undefined ? o.group : '';
  actionsList = (o: any) => o && o.actions ? o.actions : [];
  labelSegments = (o: any) => {
    const label = this.labelText(o);
    const ranges = labelHighlight(label, this.query());
    const segments = [];
    let cursor = 0;
    for (let i = 0; i < ranges.length; i++) {
      const start = ranges[i][0];
      const end = ranges[i][1];
      if (start > cursor) segments.push({
        text: label.slice(cursor, start),
        match: false
      });
      segments.push({
        text: label.slice(start, end),
        match: true
      });
      cursor = end;
    }
    if (cursor < label.length) segments.push({
      text: label.slice(cursor),
      match: false
    });
    if (segments.length === 0) segments.push({
      text: label,
      match: false
    });
    return segments;
  };
  closePalette = () => {
    this.open.set(false);
  };
  onComboboxChange = (e: any) => {
    const item = e ? e.option : null;
    if (!item || item.disabled) return;
    this.select.emit({
      id: item.id,
      label: item.label,
      group: item.group
    });
    // Clear the internal selection so re-selecting the same command re-fires.
    this.activeValue.set(null);
    if (this.closeOnSelect()) this.closePalette();
  };
  onComboboxSearch = (e: any) => {
    this.query.set(e && e.query !== undefined ? e.query : '');
  };
  onBackdropClick = (e: any) => {
    if (e && e.target === e.currentTarget) this.closePalette();
  };
  focusInput = () => {
    this.combobox()?.focus();
  };
  onOpen = () => {
    this.activeValue.set(null);
    // Defer a tick so the overlay + <Combobox> are mounted before focusing.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.focusInput();
      });
    } else {
      this.focusInput();
    }
  };
  onPanelKeydown = (e: any) => {
    if (e && e.key === 'Escape') {
      e.preventDefault();
      this.closePalette();
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
  focus = () => this.focusInput();

  static ngTemplateContextGuard(
    _dir: CommandPalette,
    _ctx: unknown,
  ): _ctx is OptionCtx | EmptyCtx | FooterCtx | IconCtx | ActionsCtx | TrailingCtx {
    return true;
  }

  protected readonly labelHighlight = labelHighlight;

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default CommandPalette;
