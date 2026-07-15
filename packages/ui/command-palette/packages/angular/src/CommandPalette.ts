import { Component, ContentChild, DestroyRef, ElementRef, TemplateRef, ViewEncapsulation, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

import { Combobox } from '@rozie-ui/combobox-angular';

import { scoreCommands, labelHighlight } from './internal/scoreCommands';
import { isNavigating, pushFrame, popFrame, currentFrame, settleFrame, failFrame, breadcrumb as buildBreadcrumb, depth as levelDepth, levelDefaultItems } from './internal/levelStack';
import { resolveChildSource, isAsyncLevel, nextRequestToken, isLatestRequest } from './internal/asyncSource';
import { canOpenActions, actionsOf, firstEnabledActionIndex, rovingActionIndex, resolveEscape, matchesActionKey, caretAtEnd } from './internal/actionMenu';
import { deriveCommandGroups } from './internal/commandGroups';

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

interface GroupHeadingCtx {
  $implicit: { group: any };
  group: any;
}

interface EmptyCtx {
  $implicit: { query: any };
  query: any;
}

interface ActionItemCtx {
  $implicit: { action: any; item: any; active: any; disabled: any };
  action: any;
  item: any;
  active: any;
  disabled: any;
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
  imports: [NgTemplateOutlet, NgClass, Combobox],
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
    }<rozie-combobox #combobox [inline]="true" [disableFilter]="true" [closeOnSelect]="false" [options]="orderedItems()" [groups]="commandGroups()" [groupCap]="groupCap()" [optionValue]="commandValue" [optionDisabled]="commandDisabled" [placeholder]="currentPlaceholder()" [ariaLabel]="ariaLabel()" [idBase]="idBase()" [value]="activeValue()" (valueChange)="activeValue.set($event)" (change)="onComboboxChange($event)" (search)="onComboboxSearch($event)"><ng-template #option let-option="option" let-index="index" let-active="active" let-selected="selected" let-disabled="disabled">
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
                  @if (groupText(option) && !grouped()) {
    <span class="rozie-command-palette-option-group">{{ rozieDisplay(groupText(option)) }}</span>
    }</span>
                
                @if ((actionsTpl ?? templates()?.['actions']) || actionsList(option).length > 0) {
    <span class="rozie-command-palette-option-actions" data-testid="command-palette-actions-affordance" (mousedown)="$event.stopPropagation(); openActionMenu(option)">
                  @if ((actionsTpl ?? templates()?.['actions'])) {
    <ng-container *ngTemplateOutlet="(actionsTpl ?? templates()?.['actions']); context: { $implicit: { option: option, actions: actionsList(option) }, option: option, actions: actionsList(option) }" />
    } @else {

                    @if (actionsList(option).length > 0) {
    <span class="rozie-command-palette-option-actions-hint" aria-hidden="true">{{ rozieDisplay(actionKeyHint()) }}</span>
    }
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
          </ng-template><ng-template #groupHeading let-group="group">
            @if ((groupHeadingTpl ?? templates()?.['groupHeading'])) {
    <ng-container *ngTemplateOutlet="(groupHeadingTpl ?? templates()?.['groupHeading']); context: { $implicit: { group: group }, group: group }" />
    } @else {
    {{ rozieDisplay(groupLabel(group)) }}
    }
          </ng-template><ng-template #empty let-query="query">
            @if (currentStatus() === 'ready') {
    @if ((emptyTpl ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? templates()?.['empty']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    {{ emptyText() }}
    }
    }</ng-template></rozie-combobox>

        
        @if (atActions()) {
    <div data-command-palette-menu="" data-testid="command-palette-actions-menu" class="rozie-command-palette-actions-menu" role="menu" [attr.aria-label]="rozieAttr(__attr_aria_label)" [attr.style]="'top:' + actionMenuTop() + 'px'" (keydown)="onActionMenuKeydown($event)">
          @for (action of actionAnchor() ? actionAnchor().actions : []; track action.id; let ai = $index) {
    <div class="rozie-command-palette-actions-menu-item" [ngClass]="{ 'rozie-command-palette-actions-menu-item--active': ai === actionIndex(), 'rozie-command-palette-actions-menu-item--disabled': !!action.disabled }" role="menuitem" data-testid="command-palette-action-item" [attr.aria-disabled]="!!action.disabled" tabindex="-1" (mouseenter)="actionIndex.set(Number(ai))" (mousedown)="$event.preventDefault(); selectAction(action)">
            @if ((actionItemTpl ?? templates()?.['actionItem'])) {
    <ng-container *ngTemplateOutlet="(actionItemTpl ?? templates()?.['actionItem']); context: { $implicit: { action: action, item: actionAnchor() ? actionAnchor().item : null, active: ai === actionIndex(), disabled: !!action.disabled }, action: action, item: actionAnchor() ? actionAnchor().item : null, active: ai === actionIndex(), disabled: !!action.disabled }" />
    } @else {

              @if (actionIcon(action)) {
    <span class="rozie-command-palette-actions-menu-item-icon">{{ rozieDisplay(actionIcon(action)) }}</span>
    }<span class="rozie-command-palette-actions-menu-item-label">{{ rozieDisplay(actionLabel(action)) }}</span>
              @if (actionShortcut(action)) {
    <span class="rozie-command-palette-actions-menu-item-shortcut">{{ rozieDisplay(actionShortcut(action)) }}</span>
    }
    }
          </div>
    }
        </div>
    }@if (currentStatus() === 'loading') {
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
      cursor: pointer;
      border-radius: var(--rozie-command-palette-actions-radius, 0.25rem);
    }
    .rozie-command-palette-option-actions:hover {
      color: var(--rozie-command-palette-actions-hover-color, rgba(0, 0, 0, 0.85));
      background: var(--rozie-command-palette-actions-hover-bg, rgba(0, 0, 0, 0.06));
    }
    .rozie-command-palette-option-actions-hint {
      padding: var(--rozie-command-palette-actions-hint-padding, 0.0625rem 0.3125rem);
      font-size: var(--rozie-command-palette-actions-hint-font-size, 0.6875rem);
      color: var(--rozie-command-palette-actions-hint-color, inherit);
      background: var(--rozie-command-palette-actions-hint-bg, rgba(0, 0, 0, 0.06));
      border-radius: var(--rozie-command-palette-actions-hint-radius, 0.25rem);
    }
    .rozie-command-palette-actions-menu {
      position: absolute;
      right: var(--rozie-command-palette-action-right, 0.5rem);
      z-index: var(--rozie-command-palette-action-z, 10);
      min-width: var(--rozie-command-palette-action-min-width, 10rem);
      max-width: var(--rozie-command-palette-action-max-width, 16rem);
      padding: var(--rozie-command-palette-action-padding, 0.25rem);
      background: var(--rozie-command-palette-action-bg, #fff);
      border: var(--rozie-command-palette-action-border, 1px solid rgba(0, 0, 0, 0.1));
      border-radius: var(--rozie-command-palette-action-radius, 0.5rem);
      box-shadow: var(--rozie-command-palette-action-shadow, 0 6px 24px rgba(0, 0, 0, 0.25));
    }
    .rozie-command-palette-actions-menu-item {
      display: flex;
      align-items: center;
      gap: var(--rozie-command-palette-action-gap, 0.5rem);
      padding: var(--rozie-command-palette-action-item-padding, 0.375rem 0.5rem);
      border-radius: var(--rozie-command-palette-action-item-radius, 0.375rem);
      cursor: pointer;
      outline: none;
    }
    .rozie-command-palette-actions-menu-item--active,
    .rozie-command-palette-actions-menu-item:focus {
      background: var(--rozie-command-palette-action-active-bg, rgba(0, 0, 0, 0.08));
    }
    .rozie-command-palette-actions-menu-item--disabled {
      opacity: var(--rozie-command-palette-action-disabled-opacity, 0.5);
      cursor: default;
    }
    .rozie-command-palette-actions-menu-item-icon {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      color: var(--rozie-command-palette-action-icon-color, inherit);
    }
    .rozie-command-palette-actions-menu-item-label {
      flex: 1 1 auto;
      min-width: 0;
    }
    .rozie-command-palette-actions-menu-item-shortcut {
      flex: 0 0 auto;
      font-size: var(--rozie-command-palette-action-shortcut-font-size, 0.75rem);
      color: var(--rozie-command-palette-action-shortcut-color, rgba(0, 0, 0, 0.5));
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
   * The command list — `[{ id, label, group?, keywords?, disabled?, icon?, actions? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; commands sharing an optional `group` string are bucketed under a labeled section heading (auto-derived, via the vendored combobox's native section groups) — commands with no `group` render first in a headingless block. The heading text is the `group` string itself; override its markup with the `#groupHeading` slot. Optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. The optional `icon` and `actions` fields are display-only — unused by ranking — surfaced through the `#icon` and `#actions` option-row slots.
   */
  items = input<any[]>((() => [])());
  /**
   * Items shown when the query is empty (the empty/home state), resolved PER LEVEL. This top-level prop is the ROOT level's home view; a navigating item's own `defaultItems` field (alongside its `children`/`source`) is that CHILD level's home view. They render grouped when they carry `group` fields (composes with native sections, same as `items`), and scoring never reorders them (the empty-query short-circuit preserves author order). Typing a query switches to scored `items`/`source` results; clearing the query returns to `defaultItems`. This is the first-class replacement for branching on `query === ''` inside a `source` function — and the natural home for a recents/frecency list (composes with the `score` prop's recency boost). Leave unset (`default: () => []`) for today's behavior — no defaultItems is byte-behavior-identical to the full source-order list.
   * @example
   * <CommandPalette :default-items="recentCommands" :items="commands" />
   */
  defaultItems = input<any[]>((() => [])());
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
  /**
   * The keyboard shortcut that opens the highlighted row's action menu — a portable `$mod+<letter>` token (default `"$mod+k"`, i.e. ⌘K/Ctrl+K) matched via `(event.metaKey || event.ctrlKey) && event.key === <letter>`. A bare single-letter token (e.g. `"k"`) matches with no modifier required. Pressing it (or caret-at-end Right-arrow, or clicking the row's actions affordance) on a row with no `actions` is a no-op — the menu only opens for a row that has them.
   * @example
   * <CommandPalette action-key="$mod+j" :items="commands" />
   */
  actionKey = input<string>('$mod+k');
  /**
   * Whether choosing an action closes the whole palette. Defaults to `true` — running an action ALWAYS closes the action menu itself; `closeOnAction` additionally decides whether the palette dismisses too (`false` returns to the result list with the palette still open, e.g. for firing several actions in a row).
   */
  closeOnAction = input<boolean>(true);
  /**
   * Pass-through to the vendored combobox's `groupCap`: cap each command section to its first `groupCap` results with an expand-in-place '+N more' row. `0`/absent = uncapped (default). Note: the ⌘K/Right-arrow row action menu resolves the highlighted row by section index, which assumes the uncapped section order — combining `groupCap` with per-row `actions` is not composed in this pass.
   */
  groupCap = input<number>(0);
  activeValue = signal<any>(null);
  levelStack = signal<any[]>([]);
  activeSurface = signal('list');
  actionIndex = signal(-1);
  actionAnchor = signal<any>(null);
  actionMenuTop = signal(0);
  panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  combobox = viewChild<Combobox>('combobox');
  navigate = output<unknown>();
  back = output<void>();
  select = output<unknown>();
  actionSelect = output<unknown>({ alias: 'action-select' });
  @ContentChild('breadcrumb', { read: TemplateRef }) breadcrumbTpl?: TemplateRef<BreadcrumbCtx>;
  @ContentChild('option', { read: TemplateRef }) optionTpl?: TemplateRef<OptionCtx>;
  @ContentChild('groupHeading', { read: TemplateRef }) groupHeadingTpl?: TemplateRef<GroupHeadingCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;
  @ContentChild('actionItem', { read: TemplateRef }) actionItemTpl?: TemplateRef<ActionItemCtx>;
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
        // Reset the action surface directly (NOT closeActionMenu — the palette is
        // closing, so there is no combobox popup left to reopen/keepOpen-release;
        // a plain reset keeps a reopen starting clean, per spec §Composition).
        this.activeSurface.set('list');
        this.actionIndex.set(-1);
        this.actionAnchor.set(null);
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
  currentDefaultItems = () => {
    const frame = currentFrame(this.levelStack());
    return frame ? frame.defaultItems : this.defaultItems();
  };
  currentBaseItems = () => {
    const __query = this.query();
    const q = String(__query == null ? '' : __query).trim();
    const defaults = this.currentDefaultItems();
    if (q === '' && Array.isArray(defaults) && defaults.length > 0) return defaults;
    return this.currentItems();
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
  atActions = () => this.activeSurface() === 'actions';
  currentTitle = () => {
    const frame = currentFrame(this.levelStack());
    return frame && frame.title != null ? frame.title : this.ariaLabel();
  };
  currentPlaceholder = () => {
    const frame = currentFrame(this.levelStack());
    return frame && frame.placeholder != null ? frame.placeholder : this.placeholder();
  };
  breadcrumbStack = () => buildBreadcrumb(this.levelStack(), this.ariaLabel());
  filteredItems = () => scoreCommands(this.currentBaseItems(), this.query(), this.score());
  groupedView = () => deriveCommandGroups(this.filteredItems());
  orderedItems = () => this.groupedView().ordered;
  commandGroups = () => this.groupedView().groups;
  grouped = () => this.commandGroups().length > 0;
  groupLabel = (g: any) => g && g.label !== undefined ? g.label : '';
  commandValue = (it: any) => it && it.id !== undefined ? it.id : it;
  commandDisabled = (it: any) => !!(it && it.disabled);
  labelText = (o: any) => o && o.label !== undefined ? o.label : '';
  groupText = (o: any) => o && o.group !== undefined ? o.group : '';
  actionsList = (o: any) => o && o.actions ? o.actions : [];
  actionLabel = (a: any) => a && a.label !== undefined ? a.label : '';
  actionShortcut = (a: any) => a && a.shortcut !== undefined ? a.shortcut : undefined;
  actionIcon = (a: any) => a && a.icon !== undefined ? a.icon : undefined;
  actionKeyHint = () => {
    const k = this.actionKey();
    if (typeof k !== 'string') return '';
    if (k.indexOf('$mod+') === 0) return '⌘' + k.slice('$mod+'.length).toUpperCase();
    return k.toUpperCase();
  };
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
    // Level nav always resets to the list surface (spec §Composition) — a
    // navigating item's own action menu, if somehow open, must not survive
    // the push.
    if (this.activeSurface() !== 'list') this.closeActionMenu();
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
    // command-palette-13-empty-home-view-first: an item carrying a non-empty
    // defaultItems is seeded 'ready' by pushFrame — skip the initial
    // beginLevelLoad('') kick-off entirely (no source('') call, no loading
    // flash). Typing still triggers the debounced source(query) refetch below
    // (onComboboxSearch); clearing back to '' returns to the home view without
    // ever invoking source.
    if (isAsyncLevel(item) && levelDefaultItems(item).length === 0) this.beginLevelLoad(item, '');
  };
  goBack = () => {
    if (this.levelStack().length === 0) return;
    // Level nav always resets to the list surface (spec §Composition) — pop
    // closes an open action menu FIRST.
    if (this.activeSurface() !== 'list') this.closeActionMenu();
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
      item,
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
    // command-palette-13-empty-home-view-first: clearing back to '' on a level
    // that carries defaultItems must NOT refetch (no source('') call) and must
    // NOT let a late in-flight source result stomp the restored home view —
    // bump the token (drops any in-flight resolution), clear any pending
    // debounce timer, and return. currentBaseItems() already swaps back to
    // the frame's defaultItems on the next render via filteredItems().
    if (q === '' && levelDefaultItems(frame.item).length > 0) {
      this.requestToken = nextRequestToken(this.requestToken);
      if (this.debounceTimerId != null) clearTimeout(this.debounceTimerId);
      this.debounceTimerId = null;
      return;
    }
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
  deepQuerySelector = (root: any, selector: any) => {
    if (!root || typeof root.querySelector !== 'function') return null;
    const direct = root.querySelector(selector);
    if (direct) return direct;
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (let i = 0; i < all.length; i++) {
      const sr = all[i].shadowRoot;
      if (sr) {
        const found = this.deepQuerySelector(sr, selector);
        if (found) return found;
      }
    }
    return null;
  };
  highlightedItem = () => {
    const panel = this.panel()?.nativeElement;
    if (!panel) return null;
    const activeEl: any = this.deepQuerySelector(panel, '.rozie-combobox-option--active');
    if (!activeEl) return null;
    const prefix = this.idBase() + '-opt-';
    const id = String(activeEl.id || activeEl.getAttribute('id') || '');
    if (id.indexOf(prefix) !== 0) return null;
    const idx = parseInt(id.slice(prefix.length), 10);
    if (Number.isNaN(idx)) return null;
    const list = this.orderedItems();
    return idx >= 0 && idx < list.length ? list[idx] : null;
  };
  searchInputEl = () => {
    const panel = this.panel()?.nativeElement;
    return panel ? this.deepQuerySelector(panel, 'input[role="combobox"]') : null;
  };
  focusFirstMenuItem = () => {
    const panel = this.panel()?.nativeElement;
    if (!panel) return;
    const el: any = panel.querySelector('[data-command-palette-menu] [role="menuitem"]:not([aria-disabled="true"])');
    if (el && typeof el.focus === 'function') el.focus();
  };
  openActionMenu = (item: any) => {
    if (!canOpenActions(item)) return;
    const actions = actionsOf(item);
    // The flyout's `:aria-label` reads `$data.actionAnchor.label` (a plain
    // PROPERTY read, computed here in script) rather than calling
    // `labelText(item)` directly from the template attribute binding — a bare
    // top-level-helper CALL inside a plain (non-slot-scoped) `:attr` binding
    // throws `labelText is not defined` on the Angular target specifically
    // (the emitter's `this.`-qualification pass doesn't reach that binding
    // shape) — a source-level workaround, not an emitter change.
    this.actionAnchor.set({
      item,
      actions,
      label: this.labelText(item)
    });
    this.actionIndex.set(firstEnabledActionIndex(actions));
    this.activeSurface.set('actions');
    const panel = this.panel()?.nativeElement;
    const activeRow: any = panel ? this.deepQuerySelector(panel, '.rozie-combobox-option--active') : null;
    this.actionMenuTop.set(activeRow ? activeRow.offsetTop : 0);
    this.combobox()?.pinOpen(true);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.focusFirstMenuItem();
      });
    } else {
      this.focusFirstMenuItem();
    }
  };
  closeActionMenu = () => {
    this.activeSurface.set('list');
    this.actionIndex.set(-1);
    this.actionAnchor.set(null);
    this.combobox()?.pinOpen(false);
    this.reopenComboboxPopup();
  };
  roveAction = (dir: any) => {
    const anchor = this.actionAnchor();
    if (!anchor) return;
    const idx = rovingActionIndex(anchor.actions, this.actionIndex(), dir);
    this.actionIndex.set(idx);
    const panel = this.panel()?.nativeElement;
    if (!panel) return;
    const items: any = panel.querySelectorAll('[data-command-palette-menu] [role="menuitem"]');
    const el: any = items[idx];
    if (el && typeof el.focus === 'function') el.focus();
  };
  selectAction = (action: any) => {
    if (!action || action.disabled) return;
    const anchor = this.actionAnchor();
    const item = anchor ? anchor.item : null;
    this.actionSelect.emit({
      item,
      action
    });
    this.closeActionMenu();
    if (this.closeOnAction()) this.closePalette();
  };
  onActionMenuKeydown = (e: any) => {
    if (!e) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      this.roveAction(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      this.roveAction(-1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const anchor = this.actionAnchor();
      const action = anchor && Array.isArray(anchor.actions) ? anchor.actions[this.actionIndex()] : null;
      if (action) this.selectAction(action);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      this.closeActionMenu();
      return;
    }
    if (matchesActionKey(e, this.actionKey())) {
      e.preventDefault();
      e.stopPropagation();
      this.closeActionMenu();
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
    const __activeSurface = this.activeSurface();
    if (!e) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      const route = resolveEscape(__activeSurface, this.currentDepth());
      if (route === 'close-surface') this.closeActionMenu();else if (route === 'pop-level') this.goBack();else this.closePalette();
      return;
    }
    if (__activeSurface === 'list') {
      if (matchesActionKey(e, this.actionKey())) {
        const item = this.highlightedItem();
        if (canOpenActions(item)) {
          e.preventDefault();
          this.openActionMenu(item);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        const input: any = this.searchInputEl();
        const item = this.highlightedItem();
        const value = input && input.value != null ? String(input.value) : '';
        if (input && caretAtEnd(input.selectionStart, input.selectionEnd, value.length) && canOpenActions(item)) {
          e.preventDefault();
          this.openActionMenu(item);
          return;
        }
      }
    }
    if (e.key === 'Backspace' && this.query() === '' && this.currentDepth() > 0 && __activeSurface === 'list') {
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
  ): _ctx is BreadcrumbCtx | OptionCtx | GroupHeadingCtx | EmptyCtx | ActionItemCtx | LoadingCtx | ErrorCtx | FooterCtx | IconCtx | ActionsCtx | TrailingCtx {
    return true;
  }

  protected get __attr_aria_label() {
      const __actionAnchor = this.actionAnchor();
      return __actionAnchor ? __actionAnchor.label : null;
    }

  protected readonly Number = Number;

  protected readonly labelHighlight = labelHighlight;

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default CommandPalette;
