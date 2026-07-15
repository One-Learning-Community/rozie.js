import { Component, ContentChild, DestroyRef, ElementRef, TemplateRef, ViewEncapsulation, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Combobox } from '@rozie-ui/combobox-angular';

import { scoreCommands, labelHighlight } from './internal/scoreCommands';
import { isNavigating, pushFrame, popFrame, currentFrame, settleFrame, failFrame, breadcrumb as buildBreadcrumb, depth as levelDepth } from './internal/levelStack';
import { resolveChildSource, isAsyncLevel, nextRequestToken, isLatestRequest } from './internal/asyncSource';

// ---- async race-drop token + debounce timer (module-level lets) ---------
// These are NOT $data. They are read-after-write SYNCHRONOUSLY across async
// boundaries within a single handler (bump a token, then compare it after an
// await; clear/replace a timer id on every keystroke), which React's useState
// ($data) binds STALE (setState is async — the pre-write value is read). As
// module-level `let`s referenced ONLY from handlers/lifecycle (never the
// template), the React emitter hoists them to `useRef` (persistent +
// synchronous) via hoistModuleLet — giving a correct, target-uniform token
// comparison. Kept out of $data specifically to dodge the documented
// stale-read (the plan's $data placement broke the race-drop AND the navigate
// depth on React/Solid/Lit).

interface BreadcrumbCtx {
  $implicit: { stack: any; back: any };
  stack: any;
  back: any;
}

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

interface LoadingCtx {
  $implicit: { query: any };
  query: any;
}

interface ErrorCtx {
  $implicit: { query: any; error: any; retry: any };
  query: any;
  error: any;
  retry: any;
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
        
        @if (atDepth()) {
    <div class="rozie-command-palette-header">
          @if ((breadcrumbTpl ?? templates()?.['breadcrumb'])) {
    <ng-container *ngTemplateOutlet="(breadcrumbTpl ?? templates()?.['breadcrumb']); context: { $implicit: { stack: breadcrumbStack(), back: goBack }, stack: breadcrumbStack(), back: goBack }" />
    } @else {

            <button type="button" class="rozie-command-palette-back" aria-label="Back" data-testid="command-palette-back" (click)="goBack()">‹</button>
            <span class="rozie-command-palette-title" data-testid="command-palette-title">{{ rozieDisplay(currentTitle()) }}</span>
          
    }
        </div>
    }<rozie-combobox #combobox [inline]="true" [disableFilter]="true" [closeOnSelect]="false" [options]="filteredItems()" [optionValue]="commandValue" [optionDisabled]="commandDisabled" [placeholder]="currentPlaceholder()" [ariaLabel]="ariaLabel()" [idBase]="idBase()" [value]="activeValue()" (valueChange)="activeValue.set($event)" (change)="onComboboxChange($event)" (search)="onComboboxSearch($event)"><ng-template #option let-option="option" let-index="index" let-active="active" let-selected="selected" let-disabled="disabled">
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
            @if (currentStatus() === 'ready') {
    @if ((emptyTpl ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? templates()?.['empty']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    {{ emptyText() }}
    }
    }</ng-template></rozie-combobox>

        
        @if (currentStatus() === 'loading') {
    <div class="rozie-command-palette-loading">
          @if ((loadingTpl ?? templates()?.['loading'])) {
    <ng-container *ngTemplateOutlet="(loadingTpl ?? templates()?.['loading']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    Loading…
    }
        </div>
    } @else if (currentStatus() === 'error') {
    <div class="rozie-command-palette-error">
          <ng-container *ngTemplateOutlet="(errorTpl ?? templates()?.['error']); context: { $implicit: { query: query(), error: currentError(), retry: retryCurrentLevel }, query: query(), error: currentError(), retry: retryCurrentLevel }" />
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
    .rozie-command-palette-header {
      display: flex;
      align-items: center;
      gap: var(--rozie-command-palette-header-gap, 0.5rem);
      padding: var(--rozie-command-palette-header-padding, 0.5rem 0.75rem);
      border-bottom: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
      font-size: var(--rozie-command-palette-header-font-size, 0.875rem);
    }
    .rozie-command-palette-back {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--rozie-command-palette-back-padding, 0.125rem 0.375rem);
      font: inherit;
      font-size: var(--rozie-command-palette-back-font-size, 1.1rem);
      line-height: 1;
      color: inherit;
      background: var(--rozie-command-palette-back-bg, transparent);
      border: var(--rozie-command-palette-back-border, none);
      border-radius: var(--rozie-command-palette-back-radius, 0.375rem);
      cursor: pointer;
    }
    .rozie-command-palette-back:hover {
      background: var(--rozie-command-palette-back-hover-bg, rgba(0, 0, 0, 0.06));
    }
    .rozie-command-palette-title {
      font-weight: var(--rozie-command-palette-title-weight, 600);
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
    .rozie-command-palette-loading {
      padding: var(--rozie-command-palette-empty-padding, 1.5rem);
      text-align: center;
      color: var(--rozie-command-palette-loading-color, rgba(0, 0, 0, 0.5));
    }
    .rozie-command-palette-error {
      padding: var(--rozie-command-palette-empty-padding, 1.5rem);
      text-align: center;
      color: var(--rozie-command-palette-error-color, #c0392b);
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
  score = input<((...args: any[]) => any) | null>(null);
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
  /**
   * Debounce (ms) applied to a nested level's ASYNC `source(query)` keystroke refetch only — sync (`children`) levels re-rank locally on every keystroke with no debounce. Defaults to ~150ms (`internal/asyncSource.ts`'s `DEFAULT_SEARCH_DEBOUNCE`).
   * @example
   * <CommandPalette :search-debounce="300" :items="commands" />
   */
  searchDebounce = input<number>(150);
  activeValue = signal<any>(null);
  levelStack = signal<any[]>([]);
  panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  combobox = viewChild<Combobox>('combobox');
  navigate = output<unknown>();
  back = output<void>();
  select = output<unknown>();
  @ContentChild('breadcrumb', { read: TemplateRef }) breadcrumbTpl?: TemplateRef<BreadcrumbCtx>;
  @ContentChild('option', { read: TemplateRef }) optionTpl?: TemplateRef<OptionCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;
  @ContentChild('loading', { read: TemplateRef }) loadingTpl?: TemplateRef<LoadingCtx>;
  @ContentChild('error', { read: TemplateRef }) errorTpl?: TemplateRef<ErrorCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;
  @ContentChild('icon', { read: TemplateRef }) iconTpl?: TemplateRef<IconCtx>;
  @ContentChild('actions', { read: TemplateRef }) actionsTpl?: TemplateRef<ActionsCtx>;
  @ContentChild('trailing', { read: TemplateRef }) trailingTpl?: TemplateRef<TrailingCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.debounceTimerId != null) clearTimeout(this.debounceTimerId);
    });
    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen) this.onOpen();else {
        this.query.set('');
        this.levelStack.set([]);
        this.activeValue.set(null);
        if (this.debounceTimerId != null) clearTimeout(this.debounceTimerId);
        this.debounceTimerId = null;
        this.requestToken = nextRequestToken(this.requestToken);
      }
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    if (this.open()) this.onOpen();
  }

  requestToken = 0;
  debounceTimerId: any = null;
  currentItems = () => {
    const frame = currentFrame(this.levelStack());
    if (frame) {
      if (frame.status === 'loading' || frame.status === 'error') return [];
      return frame.resolvedItems;
    }
    return this.items();
  };
  currentDepth = () => levelDepth(this.levelStack());
  currentStatus = () => {
    const frame = currentFrame(this.levelStack());
    return frame ? frame.status : 'ready';
  };
  currentError = () => {
    const frame = currentFrame(this.levelStack());
    return frame ? frame.error : null;
  };
  atDepth = () => this.currentDepth() > 0;
  currentTitle = () => {
    const frame = currentFrame(this.levelStack());
    return frame && frame.title != null ? frame.title : this.ariaLabel();
  };
  currentPlaceholder = () => {
    const frame = currentFrame(this.levelStack());
    return frame && frame.placeholder != null ? frame.placeholder : this.placeholder();
  };
  breadcrumbStack = () => buildBreadcrumb(this.levelStack(), this.ariaLabel());
  filteredItems = () => scoreCommands(this.currentItems(), this.query(), this.score());
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
  applyAsyncResult = (token: any, promise: any) => {
    return promise.then((items: any) => {
      if (!isLatestRequest(token, this.requestToken)) return;
      this.levelStack.set(settleFrame(this.levelStack(), Array.isArray(items) ? items : []));
    }, (error: any) => {
      if (!isLatestRequest(token, this.requestToken)) return;
      this.levelStack.set(failFrame(this.levelStack(), error));
    });
  };
  beginLevelLoad = (item: any, query: any) => {
    const resolved = resolveChildSource(item, query);
    if (resolved.kind === 'async') {
      this.requestToken = nextRequestToken(this.requestToken);
      this.applyAsyncResult(this.requestToken, resolved.promise);
      return;
    }
    if (resolved.kind === 'sync') {
      const items = resolved.items;
      Promise.resolve().then(() => {
        this.levelStack.set(settleFrame(this.levelStack(), items));
      });
    }
  };
  retryCurrentLevel = () => {
    const frame = currentFrame(this.levelStack());
    if (!frame || !frame.item || !isAsyncLevel(frame.item)) return;
    this.beginLevelLoad(frame.item, this.query());
  };
  pushLevel = (item: any) => {
    const nextStack = pushFrame(this.levelStack(), item, this.query());
    this.levelStack.set(nextStack);
    this.query.set('');
    this.activeValue.set(null);
    this.combobox()?.clear();
    this.focusInput();
    this.navigate.emit({
      item,
      depth: nextStack.length
    });
    if (isAsyncLevel(item)) this.beginLevelLoad(item, '');
  };
  goBack = () => {
    if (this.levelStack().length === 0) return;
    const {
      stack,
      restoreQuery
    } = popFrame(this.levelStack());
    this.levelStack.set(stack);
    this.requestToken = nextRequestToken(this.requestToken);
    const q = restoreQuery == null ? '' : restoreQuery;
    this.query.set(q);
    this.combobox()?.seedQuery(q);
    this.activeValue.set(null);
    this.reopenComboboxPopup();
    this.back.emit();
  };
  openTo = async (path: any) => {
    this.open.set(true);
    let stack = [];
    this.levelStack.set(stack);
    this.query.set('');
    const ids = Array.isArray(path) ? path : [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const list = stack.length === 0 ? this.items() : stack[stack.length - 1].resolvedItems;
      const item = Array.isArray(list) ? list.find((it: any) => it && it.id === id) : null;
      if (!item) break;
      stack = pushFrame(stack, item, '');
      this.levelStack.set(stack);
      const resolved = resolveChildSource(item, '');
      if (resolved.kind === 'async') {
        this.requestToken = nextRequestToken(this.requestToken);
        const token = this.requestToken;
        try {
          const items = await resolved.promise;
          if (isLatestRequest(token, this.requestToken)) {
            stack = settleFrame(stack, Array.isArray(items) ? items : []);
            this.levelStack.set(stack);
          }
        } catch (error: any) {
          if (isLatestRequest(token, this.requestToken)) {
            stack = failFrame(stack, error);
            this.levelStack.set(stack);
          }
        }
      } else if (resolved.kind === 'sync') {
        stack = settleFrame(stack, resolved.items);
        this.levelStack.set(stack);
      }
    }
    this.activeValue.set(null);
    // Defer the combobox ref touch a frame (the onOpen() precedent) — openTo
    // may have just flipped `open` false→true in THIS call, so the overlay +
    // <Combobox> may not be mounted yet on every target when the drill loop's
    // awaits resolve.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.combobox()?.clear();
        this.focusInput();
      });
    } else {
      this.combobox()?.clear();
      this.focusInput();
    }
  };
  onComboboxChange = (e: any) => {
    const item = e ? e.option : null;
    if (!item || item.disabled) return;
    if (isNavigating(item)) {
      this.pushLevel(item);
      return;
    }
    const path = this.levelStack().map((f: any) => f.item ? f.item.id : null);
    this.select.emit({
      id: item.id,
      label: item.label,
      group: item.group,
      path
    });
    // Clear the internal selection so re-selecting the same command re-fires.
    this.activeValue.set(null);
    if (this.closeOnSelect()) this.closePalette();
  };
  onComboboxSearch = (e: any) => {
    const q = e && e.query !== undefined ? e.query : '';
    this.query.set(q);
    const frame = currentFrame(this.levelStack());
    if (!frame || !isAsyncLevel(frame.item)) return;
    this.requestToken = nextRequestToken(this.requestToken);
    const token = this.requestToken;
    const item = frame.item;
    if (this.debounceTimerId != null) clearTimeout(this.debounceTimerId);
    this.debounceTimerId = setTimeout(() => {
      const resolved = resolveChildSource(item, q);
      if (resolved.kind === 'sync') {
        if (isLatestRequest(token, this.requestToken)) {
          this.levelStack.set(settleFrame(this.levelStack(), resolved.items));
        }
        return;
      }
      if (resolved.kind === 'async') this.applyAsyncResult(token, resolved.promise);
    }, this.searchDebounce());
  };
  onBackdropClick = (e: any) => {
    if (e && e.target === e.currentTarget) this.closePalette();
  };
  focusInput = () => {
    this.combobox()?.focus();
  };
  deepActiveElement = () => {
    let node = typeof document !== 'undefined' ? document.activeElement : null;
    while (node && node.shadowRoot && node.shadowRoot.activeElement) {
      node = node.shadowRoot.activeElement;
    }
    return node;
  };
  reopenComboboxPopup = () => {
    // `any` — document.activeElement types as `Element` (no `.blur`); the deepest
    // focused node is really an HTMLElement across all six leaves.
    const active: any = this.deepActiveElement();
    if (active && typeof active.blur === 'function') active.blur();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.focusInput();
      });
    } else {
      this.focusInput();
    }
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
    if (!e) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.currentDepth() > 0) this.goBack();else this.closePalette();
      return;
    }
    if (e.key === 'Backspace' && this.query() === '' && this.currentDepth() > 0) {
      e.preventDefault();
      this.goBack();
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
  ): _ctx is BreadcrumbCtx | OptionCtx | EmptyCtx | LoadingCtx | ErrorCtx | FooterCtx | IconCtx | ActionsCtx | TrailingCtx {
    return true;
  }

  protected readonly labelHighlight = labelHighlight;

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default CommandPalette;
