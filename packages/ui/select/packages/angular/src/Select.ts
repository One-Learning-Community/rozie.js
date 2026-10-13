import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

import { Popover } from '@rozie-ui/popover-angular';

// ---- option grouping (src/internal/groupOptions.ts) ---------------------
// The pure stable-partition helper is a RUNTIME import (not a `.rzts` partial):
// codegen's `copyInternal` vendors it into each leaf at `./internal/groupOptions`.
// It is a byte copy of @rozie-ui/headless-core/src/internal/groupOptions.ts.
import { groupOptions } from './internal/groupOptions';
// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally
// (a peer dep); every RUNTIME reference sits behind `if ($props.virtual)` / a
// `virtualizer` guard so the non-virtual emitted path executes none of it
// (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// Windowing instance state (the `let table` precedent — React hoists reassigned
// module-`let`s to useRef; do NOT const). NULL until $onMount, and ONLY constructed
// when $props.virtual. gridScrollEl is the captured .rozie-select-list scroll div the
// virtualizer observes; remeasurePending dedupes the deferred sweep.

/** An entry of the `groups` prop. */
export interface SelectGroup {
  id: string;
  label: string;
}

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

interface GroupHeadingCtx {
  $implicit: { group: SelectGroup };
  group: SelectGroup;
}

@Component({
  selector: 'rozie-select',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass, Popover],
  template: `

    <div class="rozie-select" [ngClass]="{ 'rozie-select-open': popupVisible(), 'rozie-select-disabled': (disabled() || this.__rozieCvaDisabled()), 'rozie-select-inline': inline(), 'rozie-select--block': block() }" #__rozieRoot #rozieSpread_0 #rozieListenersTarget_1>
      
      <rozie-popover trigger="manual" [open]="panelOpen()" (openChange)="panelOpen.set($event)" [bare]="true" [matchWidth]="true" [keepMounted]="virtual()" [disablePositioning]="inline()" [disableDismiss]="inline()" [placement]="placement()" [offset]="offset()" [disableFlip]="disableFlip()" [disableShift]="disableShift()" [idBase]="idRoot()"><ng-template #anchor>
          
          <div class="rozie-select-control" #controlEl (click)="onControlClick($event)">
            <div #triggerEl class="rozie-select-trigger" role="combobox" aria-haspopup="listbox" [attr.tabindex]="rozieAttr(triggerTabindex())" [attr.aria-expanded]="!!popupVisible()" [attr.aria-controls]="rozieAttr(idRoot() + '-list')" [attr.aria-activedescendant]="rozieAttr(popupVisible() && activeIndex() < visibleOptions().length ? activeDescendant() : null)" [attr.aria-label]="rozieAttr(ariaLabel())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" (keydown)="onTriggerKeyDown($event)">
              @if ((selectedTpl ?? __rozieFillMap()['selected'] ?? templates()?.['selected'])) {
    <ng-container *ngTemplateOutlet="(selectedTpl ?? __rozieFillMap()['selected'] ?? templates()?.['selected']); context: { $implicit: { selected: selectedLabel(), value: value() }, selected: selectedLabel(), value: value() }" />
    } @else {

                @if (selectedLabel()) {
    <span class="rozie-select-selected">{{ rozieDisplay(selectedLabel()) }}</span>
    } @else {
    <span class="rozie-select-placeholder">{{ placeholder() }}</span>
    }
    }
            </div>
            <span class="rozie-select-arrow" aria-hidden="true">▾</span>
          </div>
        </ng-template><ng-template #defaultSlot>
          
          @if (popupVisible() && !virtual() && !isGrouped()) {
    <div #listEl class="rozie-select-list" role="listbox" [attr.id]="rozieAttr(idRoot() + '-list')" [attr.aria-label]="rozieAttr(ariaLabel())" [attr.aria-multiselectable]="multiple()">
            @for (opt of visibleOptions(); track optionId(index); let index = $index) {
    <div [attr.id]="rozieAttr(optionId(index))" class="rozie-select-option" [ngClass]="{ 'is-active': activeIndex() === index, 'is-selected': isSelected(opt), 'is-disabled': disabledOf(opt) }" role="option" [attr.aria-selected]="!!isSelected(opt)" [attr.aria-disabled]="!!disabledOf(opt)" (click)="select(opt)" (mousemove)="onOptionPointerMove(index)">
              @if ((optionTpl ?? __rozieFillMap()['option'] ?? templates()?.['option'])) {
    <ng-container *ngTemplateOutlet="(optionTpl ?? __rozieFillMap()['option'] ?? templates()?.['option']); context: { $implicit: { option: opt, index: index, active: activeIndex() === index, selected: isSelected(opt), disabled: disabledOf(opt) }, option: opt, index: index, active: activeIndex() === index, selected: isSelected(opt), disabled: disabledOf(opt) }" />
    } @else {

                {{ rozieDisplay(labelOf(opt)) }}
              
    }
            </div>
    }

            @if (visibleOptions().length === 0) {
    <div class="rozie-select-empty" role="presentation">
              @if ((emptyTpl ?? __rozieFillMap()['empty'] ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? __rozieFillMap()['empty'] ?? templates()?.['empty']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    No options
    }
            </div>
    }</div>
    }@if (popupVisible() && !virtual() && isGrouped()) {
    <div #listEl class="rozie-select-list" role="listbox" [attr.id]="rozieAttr(idRoot() + '-list')" [attr.aria-label]="rozieAttr(ariaLabel())" [attr.aria-multiselectable]="multiple()">
            @for (blk of groupBlocks(); track 'grp-' + (blk.group ? blk.group.id : '_ungrouped')) {
    <div class="rozie-select-group" role="group" [attr.aria-label]="rozieAttr(blk.group ? blk.group.label : null)">
              @if (blk.group) {
    <div class="rozie-select-group-heading" role="presentation">
                @if ((groupHeadingTpl ?? __rozieFillMap()['groupHeading'] ?? templates()?.['groupHeading'])) {
    <ng-container *ngTemplateOutlet="(groupHeadingTpl ?? __rozieFillMap()['groupHeading'] ?? templates()?.['groupHeading']); context: { $implicit: { group: blk.group }, group: blk.group }" />
    } @else {
    {{ rozieDisplay(blk.group.label) }}
    }
              </div>
    }@for (row of blk.items; track optionId(row.index)) {
    <div [attr.id]="rozieAttr(optionId(row.index))" class="rozie-select-option" [ngClass]="{ 'is-active': activeIndex() === row.index, 'is-selected': isSelected(row.opt), 'is-disabled': disabledOf(row.opt) }" role="option" [attr.aria-selected]="!!isSelected(row.opt)" [attr.aria-disabled]="!!disabledOf(row.opt)" (click)="select(row.opt)" (mousemove)="onOptionPointerMove(row.index)">
                @if ((optionTpl ?? __rozieFillMap()['option'] ?? templates()?.['option'])) {
    <ng-container *ngTemplateOutlet="(optionTpl ?? __rozieFillMap()['option'] ?? templates()?.['option']); context: { $implicit: { option: row.opt, index: row.index, active: activeIndex() === row.index, selected: isSelected(row.opt), disabled: disabledOf(row.opt) }, option: row.opt, index: row.index, active: activeIndex() === row.index, selected: isSelected(row.opt), disabled: disabledOf(row.opt) }" />
    } @else {

                  {{ rozieDisplay(labelOf(row.opt)) }}
                
    }
              </div>
    }
            </div>
    }
            @if (visibleOptions().length === 0) {
    <div class="rozie-select-empty" role="presentation">
              @if ((emptyTpl ?? __rozieFillMap()['empty'] ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? __rozieFillMap()['empty'] ?? templates()?.['empty']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    No options
    }
            </div>
    }</div>
    }@if (virtual()) {
    <div #listEl class="rozie-select-list rozie-select-list--virtual" role="listbox" [attr.id]="rozieAttr(idRoot() + '-list')" [attr.aria-label]="rozieAttr(ariaLabel())" [attr.aria-multiselectable]="multiple()" [attr.style]="__style">
            <div class="rozie-select-spacer" aria-hidden="true" [attr.style]="'height:' + padTop() + 'px'"></div>

            @for (wr of windowedRows(); track wr.row.id) {
    <div [attr.id]="rozieAttr(optionId(wr.vi.index))" [attr.data-index]="rozieAttr(wr.vi.index)" class="rozie-select-option" [ngClass]="{ 'is-active': activeIndex() === wr.vi.index, 'is-selected': isSelected(wr.row._opt), 'is-disabled': disabledOf(wr.row._opt) }" role="option" [attr.aria-selected]="!!isSelected(wr.row._opt)" [attr.aria-disabled]="!!disabledOf(wr.row._opt)" (click)="select(wr.row._opt)" (mousemove)="onOptionPointerMove(wr.vi.index)">
              @if ((optionTpl ?? __rozieFillMap()['option'] ?? templates()?.['option'])) {
    <ng-container *ngTemplateOutlet="(optionTpl ?? __rozieFillMap()['option'] ?? templates()?.['option']); context: { $implicit: { option: wr.row._opt, index: wr.vi.index, active: activeIndex() === wr.vi.index, selected: isSelected(wr.row._opt), disabled: disabledOf(wr.row._opt) }, option: wr.row._opt, index: wr.vi.index, active: activeIndex() === wr.vi.index, selected: isSelected(wr.row._opt), disabled: disabledOf(wr.row._opt) }" />
    } @else {

                {{ rozieDisplay(labelOf(wr.row._opt)) }}
              
    }
            </div>
    }

            <div class="rozie-select-spacer" aria-hidden="true" [attr.style]="'height:' + padBottom() + 'px'"></div>

            @if (windowSource().length === 0) {
    <div class="rozie-select-empty" role="presentation">
              @if ((emptyTpl ?? __rozieFillMap()['empty'] ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? __rozieFillMap()['empty'] ?? templates()?.['empty']); context: { $implicit: { query: query() }, query: query() }" />
    } @else {
    No options
    }
            </div>
    }</div>
    }</ng-template></rozie-popover>
    </div>

  `,
  styles: [`
    :host(rozie-select) { display: contents; }
    .rozie-select {
      position: relative;
      display: inline-block;
      min-width: var(--rozie-select-min-width, var(--rsl-min-width, 12rem));
      font: var(--rozie-select-font, inherit);
      /* The popup's stacking order is the composed popover's now; keep the select's own
         \`--rozie-select-z\` token steering it (custom properties inherit into the panel). */
      --rozie-popover-z: var(--rozie-select-z, var(--rsl-z, 1000));
    }
    .rozie-select-control {
      box-sizing: border-box;
      /* NOT \`width: 100%\`: the control renders inside the popover's anchor wrapper
         (\`display: inline-block\`, shrink-to-fit), so a percentage width is circular. It
         sizes to its content with the root's own minimum, which is the box the root's
         \`inline-block\` + \`min-width\` gave it before. \`block\` and \`inline\` stretch it. */
      min-width: var(--rozie-select-min-width, var(--rsl-min-width, 12rem));
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--rozie-select-gap, var(--rsl-gap, 0.5rem));
      padding: var(--rozie-select-control-padding, var(--rsl-control-padding, 0.5rem 0.75rem));
      font: inherit;
      text-align: left;
      background: var(--rozie-select-bg, var(--rsl-bg, #fff));
      color: var(--rozie-select-fg, var(--rsl-fg, #1a1a1a));
      border: var(--rozie-select-border-width, var(--rsl-border-width, 1px)) solid var(--rozie-select-border, var(--rsl-border, rgba(0, 0, 0, 0.2)));
      border-radius: var(--rozie-select-radius, var(--rsl-radius, 6px));
      cursor: pointer;
    }
    .rozie-select-control:focus-within {
      outline: var(--rozie-select-ring-width, var(--rsl-ring-width, 2px)) solid var(--rozie-select-ring, var(--rozie-select-accent, var(--rsl-ring, var(--rsl-accent, #0066cc))));
      outline-offset: var(--rozie-select-ring-offset, var(--rsl-ring-offset, 1px));
    }
    .rozie-select-trigger { flex: 1 1 auto; min-width: 0; min-height: 1.5em; outline: none; background: none; border: 0; padding: 0; text-align: start; }
    .rozie-select-disabled .rozie-select-control { cursor: default; }
    .rozie-select-disabled { opacity: var(--rozie-select-disabled-opacity, var(--rsl-disabled-opacity, 0.6)); pointer-events: none; }
    .rozie-select-placeholder { color: var(--rozie-select-placeholder, var(--rsl-placeholder, rgba(0, 0, 0, 0.45))); }
    .rozie-select-arrow {
      font-size: 0.75em;
      color: var(--rozie-select-arrow-color, var(--rsl-arrow-color, currentColor));
      opacity: var(--rozie-select-arrow-opacity, var(--rsl-arrow-opacity, 0.7));
    }
    .rozie-select-list {
      margin: 0;
      padding: var(--rozie-select-popup-padding, var(--rsl-popup-padding, 0.25rem));
      max-height: var(--rozie-select-max-height, var(--rsl-max-height, 16rem));
      overflow-y: auto;
      list-style: none;
      background: var(--rozie-select-popup-bg, var(--rozie-select-bg, var(--rsl-popup-bg, var(--rsl-bg, #fff))));
      color: var(--rozie-select-fg, var(--rsl-fg, #1a1a1a));
      border: var(--rozie-select-border-width, var(--rsl-border-width, 1px)) solid var(--rozie-select-popup-border, var(--rozie-select-border, var(--rsl-popup-border, var(--rsl-border, rgba(0, 0, 0, 0.15)))));
      border-radius: var(--rozie-select-popup-radius, var(--rozie-select-radius, var(--rsl-popup-radius, var(--rsl-radius, 6px))));
      box-shadow: var(--rozie-select-shadow, var(--rsl-shadow, 0 6px 24px rgba(0, 0, 0, 0.12)));
    }
    .rozie-select-inline {
      display: block;
      width: 100%;
    }
    .rozie-select-inline .rozie-select-list {
      margin-top: var(--rozie-select-popup-offset, var(--rsl-popup-offset, 4px));
      border: none;
      border-radius: 0;
      box-shadow: none;
    }
    .rozie-select-inline,
    .rozie-select--block {
      container-type: inline-size;
    }
    .rozie-select-inline .rozie-select-control,
    .rozie-select--block .rozie-select-control {
      width: 100cqw;
    }
    .rozie-select--block {
      display: block;
      width: 100%;
    }
    .rozie-select-option {
      padding: var(--rozie-select-option-padding, var(--rsl-option-padding, 0.4rem 0.6rem));
      border-radius: var(--rozie-select-option-radius, var(--rsl-option-radius, 4px));
      color: var(--rozie-select-option-fg, inherit);
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--rozie-select-gap, var(--rsl-gap, 0.5rem));
    }
    .rozie-select-option.is-active {
      background: var(--rozie-select-active-bg, var(--rsl-active-bg, rgba(0, 102, 204, 0.12)));
      color: var(--rozie-select-active-fg, var(--rsl-active-fg, inherit));
    }
    .rozie-select-option.is-selected {
      background: var(--rozie-select-selected-bg, var(--rsl-selected-bg, transparent));
      color: var(--rozie-select-selected-fg, var(--rsl-selected-fg, inherit));
      font-weight: var(--rozie-select-selected-weight, var(--rsl-selected-weight, 600));
    }
    .rozie-select-option.is-selected::after {
      content: var(--rozie-select-check, var(--rsl-check, '✓'));
      color: var(--rozie-select-check-color, var(--rozie-select-accent, var(--rsl-check-color, var(--rsl-accent, #0066cc))));
    }
    .rozie-select-option.is-disabled { opacity: var(--rozie-select-disabled-opacity, var(--rsl-disabled-opacity, 0.45)); cursor: not-allowed; }
    .rozie-select-group-heading {
      padding: var(--rozie-select-group-heading-padding, var(--rsl-group-heading-padding, 0.25rem 0.6rem));
      font-size: var(--rozie-select-group-heading-size, var(--rsl-group-heading-size, 0.75rem));
      font-weight: var(--rozie-select-group-heading-weight, var(--rsl-group-heading-weight, 600));
      color: var(--rozie-select-group-heading-color, var(--rsl-group-heading-color, rgba(0, 0, 0, 0.55)));
    }
    .rozie-select-empty { padding: var(--rozie-select-option-padding, var(--rsl-option-padding, 0.5rem 0.6rem)); color: var(--rozie-select-empty-fg, var(--rsl-empty-fg, rgba(0, 0, 0, 0.5))); }
    .rozie-select-spacer { margin: 0; padding: 0; border: 0; flex: none; }
    .rozie-select-list--virtual { overflow-anchor: none; }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Select),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Select {
  /**
   * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`.
   */
  options = input<any[]>((() => [])());
  /**
   * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Select **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <rozie-select [(value)]="fruit" [options]="fruits" />
   */
  value = model<(unknown) | null>(null);
  /**
   * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit.
   */
  multiple = input<boolean>(false);
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the select inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  inline = input<boolean>(false);
  /**
   * Disable the control entirely. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * Placeholder text shown in the empty control.
   */
  placeholder = input<string>('');
  /**
   * Close the popup after a single-select commit. Defaults `true`; multi-select keeps the popup open regardless of this setting.
   */
  closeOnSelect = input<boolean>(true);
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  optionLabel = input<((...args: any[]) => any) | null>(null);
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue = input<((...args: any[]) => any) | null>(null);
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled = input<((...args: any[]) => any) | null>(null);
  /**
   * Id base for the popup, option and control elements — `aria-activedescendant` needs real ids. Option ids are `idBase + "-opt-" + i`, the popup id is `idBase + "-list"`. Leave it empty (the default) and each instance generates a unique id base after mount (`rozie-select-<n>`). Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase = input<string>('');
  /**
   * Show nothing instead of the empty state: when there are no options the popup is not shown, the control reports `aria-expanded="false"`, and Escape is left to the host.
   */
  hideEmpty = input<boolean>(false);
  /**
   * Tab picks the highlighted option while the popup is open and an option is highlighted, then moves focus normally. Default `false` (Tab only closes the popup).
   */
  selectOnTab = input<boolean>(false);
  /**
   * Floating UI placement of the popup relative to the control, forwarded to the composed `@rozie-ui/popover` leaf — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end`. Default `"bottom-start"` keeps the popup flush with the control's left edge. Ignored when `inline` is set.
   */
  placement = input<string>('bottom-start');
  /**
   * Gap in pixels between the control and the popup, forwarded to the composed `@rozie-ui/popover` leaf. Default `4`. Ignored when `inline` is set (the in-flow gap is the `--rozie-select-popup-offset` token).
   */
  offset = input<number>(4);
  /**
   * Disable the popup's Floating UI `flip` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup flips above the control when it would overflow the viewport below; set this to keep it pinned to `placement` regardless. Ignored when `inline` is set.
   */
  disableFlip = input<boolean>(false);
  /**
   * Disable the popup's Floating UI `shift` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup shifts to stay within the viewport; set this to keep it strictly aligned to the control. Ignored when `inline` is set.
   */
  disableShift = input<boolean>(false);
  /**
   * Fill the container: the root becomes `display: block; width: 100%`, the control stretches to that width, and the width-matched popup follows. Adds the `rozie-select--block` modifier class on the root. Default `false` keeps the content-sized control (at least `--rozie-select-min-width`).
   */
  block = input<boolean>(false);
  /**
   * Ordered section list `[{ id, label }]` setting group order and heading text. Options are partitioned by their optional `group` string; groups present on options but absent here follow in first-appearance order. Empty (the default) renders a flat list. Ignored when `virtual` is on.
   */
  groups = input<any[]>((() => [])());
  /**
   * Accessible name for the control when there is no visible `<label for>` pointing at its `id` (`aria-label`).
   */
  ariaLabel = input<(string) | null>(null);
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed select. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded. Grouping is not applied while `virtual` is on.
   */
  virtual = input<boolean>(false);
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight = input<number>(36);
  /**
   * A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-select-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  maxHeight = input<string>('');
  autoId = signal('');
  open$local = signal(false);
  panelOpen = signal(false);
  panelEcho = signal(false);
  activeIndex = signal(-1);
  query = signal('');
  rows = signal<any[]>([]);
  windowVer = signal(0);
  editVer = signal(0);
  controlEl = viewChild<ElementRef<HTMLDivElement>>('controlEl');
  triggerEl = viewChild<ElementRef<HTMLDivElement>>('triggerEl');
  listEl = viewChild<ElementRef<HTMLDivElement>>('listEl');
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  openChange = output<unknown>({ alias: 'open-change' });
  change = output<unknown>();
  @ContentChild('selected', { read: TemplateRef }) selectedTpl?: TemplateRef<SelectedCtx>;
  @ContentChild('option', { read: TemplateRef }) optionTpl?: TemplateRef<OptionCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;
  @ContentChild('groupHeading', { read: TemplateRef }) groupHeadingTpl?: TemplateRef<GroupHeadingCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map = Object.create(null) as Record<string, TemplateRef<unknown>>;
    for (const f of this.__rozieFills()) {
      const k = f.rozieSlot();
      if (k == null) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      map[k === '' ? 'defaultSlot' : k] = f.templateRef;
    }
    return map;
  });
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;

  constructor() {
      const renderer = inject(Renderer2);

      effect((onCleanup) => {
        if (!(this.open$local() && (this.inline() || !this.popupVisible()))) return;
        const listenTarget = typeof document === 'undefined' ? null : document;
        if (!listenTarget) return;
        const handler = ($event: MouseEvent) => {
          const target = $event.target as Node;
          if (this.controlEl()?.nativeElement?.contains(target) || this.listEl()?.nativeElement?.contains(target)) return;
          ((this.close) as (...args: any[]) => any)($event);
        };
        listenTarget.addEventListener('click', handler as EventListener, true);
        onCleanup(() => listenTarget.removeEventListener('click', handler as EventListener, true));
      });

    inject(DestroyRef).onDestroy(() => {
      if (this.typeTimer !== null) clearTimeout(this.typeTimer);
      // Tear down the virtualizer's scroll-element ResizeObserver (no-op when virtual off).
      if (this.virtualizerCleanup) this.virtualizerCleanup();
    });
    effect(() => { const __watchVal = (() => (this.open$local() ? 'o' : 'c') + (this.hideEmpty() ? 'h' : 's') + (this.options() ? this.options().length : 0) + '|' + this.query())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.syncPanel();
    })(); }); });
    effect(() => { const __watchVal = (() => this.panelOpen())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      const __panelOpen = this.panelOpen();
      if (__panelOpen === this.panelEcho()) return;
      this.panelEcho.set(__panelOpen);
      if (!__panelOpen) this.close();
    })(); }); });
    effect(() => { const __watchVal = (() => (this.options() ? this.options().length : 0) + '|' + this.query())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      this.syncRows();
      if (this.virtual() && this.virtualizer) {
        this.gridScrollEl = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rozie-select-list') : this.gridScrollEl;
        this.virtualizer.setOptions(this.virtualizerOptions());
        this.virtualizer._willUpdate();
        this.windowVer.set(this.windowVer() + 1);
        this.scheduleRemeasure();
      }
    })(); }); });
    effect(() => { const __watchVal = (() => this.options() ? this.options().length : 0)(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } (() => {
      if (this.activeIndex() >= this.visibleOptions().length) this.activeIndex.set(this.visibleOptions().length > 0 ? this.nextEnabled(-1, 1) : -1);
    })(); }); });
  }

  ngAfterViewInit() {
    if (!this.idBase()) this.autoId.set('rozie-select-' + this.nextAutoId());
    this.syncRows();
    if (this.virtual()) {
      // The list renders at mount when virtual, so the .rozie-select-list scroll container
      // exists here. Capture it via $el.querySelector (the data-table gridScrollEl precedent,
      // proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered node is null on
      // Solid/Lit, which leaves the virtualizer with no scroll element.
      this.gridScrollEl = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rozie-select-list') : null;
      this.virtualizer = new Virtualizer(this.virtualizerOptions());
      this.virtualizerCleanup = this.virtualizer._didMount();
      this.windowVer.set(this.windowVer() + 1);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.kickWindow(8));else setTimeout(() => this.kickWindow(8), 0);
    }
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
      return __options.filter((o: any) => arr.includes(this.valueOf$local(o))).map(this.labelOf).join(', ');
    }
    const match = __options.find((o: any) => this.valueOf$local(o) === cur);
    return match === undefined ? '' : this.labelOf(match);
  });
  activeDescendant = computed(() => {
    const __activeIndex = this.activeIndex();
    if (!this.open$local() || __activeIndex < 0) return null;
    return this.optionId(__activeIndex);
  });

  // Type-ahead buffer for the select-only trigger. Module-scope
  // `let`s reassigned from handlers → the React emitter hoists them to `useRef`
  // so they persist across renders (the setup-once guarantee); no-op elsewhere.
  // They STAY in this host (not the shared spine) per the A==B rule: reassigned
  // module-`let`s + sigils live in the host; the partial only closes over them.
  typeBuffer = '';
  typeTimer: any = null;
  // ---- shared list spine (P2: @rozie-ui/headless-core/listCore.rzts) ------
  // The option resolvers, single+multi selection, close/clear, and the
  // activeDescendant derivation come from the shared list spine. It is a
  // compile-time `.rzts` script-partial: it dissolves into this leaf via
  // inlineScriptPartials() before IR lowering (zero runtime dep). The spine closes
  // over this host's pieces by convention: idRoot() and the impure ref fn
  // focusControl (below). Navigation, type-ahead and open/toggle are host-local —
  // see HOST-LOCAL NAVIGATION below; they use the reassigned module-`let`s
  // typeBuffer/typeTimer (above) and scrollActiveIntoView (below).
  // ══ Shared headless LIST SPINE (Phase 64, D-06) — the target-agnostic list-core bridge ══
  // Lifted verbatim from Listbox.rozie's <script> (the monolithic pure-Rozie list logic). This
  // partial holds ONLY the PURE list spine — option resolvers, the client-side filter, enabled-index
  // navigation, the arrow/home/end/enter/escape/space/tab keyboard reducer, type-ahead, single+multi
  // selection, open/close state, and activeDescendant derivation. It is a compile-time `.rzts`
  // script-partial: it dissolves into each consumer's compiled leaf via inlineScriptPartials() before
  // IR lowering — leaving zero runtime dependency (the 64-01-proven cross-package bare-specifier path).
  //
  // ── PARAMETERIZATION (D-06) ──────────────────────────────────────────────────────────────────
  // The spine is parameterized BY HOST CONVENTION (the same implicit by-convention mixin contract
  // windowing.rzts uses) along two axes:
  //   - focus-model: `activedescendant` | `roving`. Both list families default to `activedescendant`
  //     (what they use today): the highlighted option is tracked virtually via `activeDescendant`
  //     (an option id) while DOM focus stays on the control. `roving` (real per-option tabindex
  //     focus) is SUPPORTED-BUT-UNUSED — no focus rewrite is forced here; a roving host would supply
  //     its own focus mover. The `activeDescendant` / `optionId` derivation below IS the
  //     activedescendant model.
  //   - input-mode: `select-only` (Listbox — a button trigger + type-ahead) | `filter-input`
  //     (Combobox — a text <input> that filters by the typed query). The mode is by HOST CONVENTION,
  //     NOT a discriminant prop (P3 retired the Listbox `combobox`/`filterable` props): a select-only
  //     host never writes `$data.query`, so `visibleOptions` is the identity path for it and the
  //     printable-char branch of the reducer feeds type-ahead; a filter-input host writes `$data.query`
  //     from its <input>, so `visibleOptions` substring-filters and `onInput` drives the query.
  //
  // ── HOST CONTRACT (symbols the consuming host MUST define before importing) ────────────────────
  //   - the reassigned module-`let`s `typeBuffer` / `typeTimer` — type-ahead scratch state. They are
  //     reassigned from handlers → the React emitter hoists them to `useRef` (the setup-once
  //     guarantee), so per the A==B playbook rule they STAY IN THE HOST; this partial only closes
  //     over them (in `onTypeahead`).
  //   - `idRoot()` — the host's id base (Listbox: the `id` prop, else the per-instance id it
  //     generates in $onMount); `optionId` below derives every option id from it.
  //   - `focusControl()` / `scrollActiveIntoView()` — impure ref-reading functions (they touch the
  //     control / list ref elements, which are post-mount-only per ROZ123), so they are per-consumer
  //     HOST functions; this partial only closes over them (it reads NO refs itself).
  //   - the option set + form surface (`$props.options` / `$props.value` (model) / `$props.multiple` /
  //     `$props.optionLabel` / `$props.optionValue` / `$props.optionDisabled` /
  //     `$props.closeOnSelect` / `$props.disabled`) and the reactive state (`$data.open` /
  //     `$data.activeIndex` / `$data.query`). Input-mode is by convention (the host's <input> writing
  //     `$data.query`), NOT a discriminant prop.
  // ---- option resolvers --------------------------------------------------
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
  // `idRoot()` is a HOST function (the host's id base: its id prop, else a generated
  // per-instance id) so the option ids follow the host's auto-id fallback.
  optionId = (index: any) => this.idRoot() + '-opt-' + index;
  // Is a given option currently selected? Multi compares array membership.
  isSelected = (opt: any) => {
    const v = this.valueOf$local(opt);
    const cur = this.value();
    if (this.multiple()) return Array.isArray(cur) && cur.includes(v);
    return cur === v;
  };
  // First enabled visible index, preferring the currently-selected option.
  close = () => {
    if (!this.open$local()) return;
    this.open$local.set(false);
    this.activeIndex.set(-1);
    this.openChange.emit({
      open: false
    });
  };
  // ---- selection ---------------------------------------------------------
  select = (opt: any) => {
    if (this.disabledOf(opt)) return;
    const v = this.valueOf$local(opt);
    if (this.multiple()) {
      const cur = this.value();
      const arr = Array.isArray(cur) ? cur : [];
      // Fresh array on every commit — in-place mutation is dropped by the
      // React/Solid/Lit/Angular change detectors.
      const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
      this.value.set(next), this.__rozieCvaOnChange(next);
      this.change.emit({
        value: next,
        option: opt
      });
    } else {
      this.value.set(v), this.__rozieCvaOnChange(v);
      this.change.emit({
        value: v,
        option: opt
      });
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
    this.change.emit({
      value: empty,
      option: null
    });
  };
  // ---- keyboard navigation over the VISIBLE list -------------------------
  // Pointer hover sets the virtual highlight (matches native <select> feel).
  onOptionPointerMove = (index: any) => {
    if (this.activeIndex() !== index) this.activeIndex.set(index);
  };
  groupOfOption = (opt: any) => opt !== null && typeof opt === 'object' && 'group' in opt ? opt.group : null;
  // Grouping is active only for a non-empty `groups` list, and never while windowing.
  isGrouped = () => !this.virtual() && Array.isArray(this.groups()) && this.groups().length > 0;
  // Visual order: identity when ungrouped, group-partitioned when grouped. Memoised on
  // the inputs so repeated calls in one render return the SAME array (stable indices).
  orderedOptionsCache = {
    keys: null as any[] | null,
    val: null as any
  };
  orderedOptions = () => {
    const __options = this.options();
    const __groups = this.groups();
    const __rozieMemoKey = [__options, __groups, this.virtual()];
    const __rozieMemoPrev = this.orderedOptionsCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return this.orderedOptionsCache.val;
    }
    const __rozieMemoVal = this.isGrouped() ? groupOptions(__options, __groups, this.groupOfOption).ordered : __options;
    this.orderedOptionsCache.keys = __rozieMemoKey;
    this.orderedOptionsCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  };
  // Blocks for the grouped render; each item carries its index in visibleOptions().
  groupBlocks = () => {
    const res = groupOptions(this.options(), this.groups(), this.groupOfOption);
    let i = 0;
    return res.blocks.map((b: any) => ({
      group: b.group,
      items: b.items.map((opt: any) => ({
        opt,
        index: i++
      }))
    }));
  };
  // ══ HOST-LOCAL NAVIGATION (begin) ═════════════════════════════════════════
  // These ten functions are defined here instead of imported from listCore.rzts.
  // The spine's navigation is bound to the spine's own `visibleOptions()`, and the
  // partial inliner does not allow shadowing one function of a partial (ROZ139).
  // Select needs navigation over the grouped VISUAL order, so it owns
  // `visibleOptions` and every spine function that reaches it. The nine below
  // `visibleOptions` are VERBATIM copies of listCore.rzts, kept in sync by
  // tests/spine-copies.test.ts — change them in the spine first, then here.
  // Combobox likewise keeps its navigation host-local.
  // The option list every index refers to, in visual order. Select-only: there is
  // no query filter (nothing writes `$data.query`).
  visibleOptions = () => this.orderedOptions();
  resolveInitialActive = () => {
    const opts = this.visibleOptions();
    const sel = opts.findIndex((o: any) => this.isSelected(o) && !this.disabledOf(o));
    if (sel !== -1) return sel;
    return opts.findIndex((o: any) => !this.disabledOf(o));
  };
  open = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    if (this.open$local()) return;
    this.open$local.set(true);
    this.activeIndex.set(this.resolveInitialActive());
    this.openChange.emit({
      open: true
    });
  };
  toggle = () => {
    if (this.open$local()) this.close();else this.open();
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
      // Space toggles / commits in a select-only host (a button trigger). A
      // filter-input host types the literal space into its <input> and does NOT
      // route Space through this reducer, so this branch is select-only by use.
      $event.preventDefault();
      if (!__open$local) this.open();else this.commitActive();
    } else if (key === 'Tab') {
      if (__open$local) this.close();
    } else if (key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
      this.onTypeahead(key);
    }
  };
  // ══ HOST-LOCAL NAVIGATION (end) ═══════════════════════════════════════════
  // ---- shared windowing math (Phase 64 P4: @rozie-ui/headless-core/windowing.rzts) ----
  // The PURE windowing math (the windowed slice + spacer geometry) is the SAME
  // virtual-core bridge data-table consumes. It is a compile-time `.rzts` partial:
  // the imported symbols DISSOLVE into this leaf via inlineScriptPartials() before
  // IR lowering (zero runtime dep). The math closes over this host's pieces BY
  // CONVENTION (D-04/D-05): windowSource(), the virtualizer instance + gridScrollEl +
  // the virtual-core fns, scheduleRemeasure(), $data.windowVer/$data.editVer, and the
  // no-op pin hook pinnedEditIndex()/pinnedMeasurement() defined below. The impure
  // DOM/refs pieces stay HERE per-consumer (ROZ123). NB the pin hooks are defined in
  // THIS host (not the shared partial) so data-table's A==B byte-identity is untouched.
  // ══ Generic vertical windowing math (Phase 64, D-04) — the target-agnostic virtual-core bridge ══
  // Lifted verbatim from the DataTable virtualization.rzts (the Phase 53/63 B13 baseline). This partial
  // holds ONLY the PURE windowing math; every DOM/refs/virtualizer-instance impurity stays per-consumer
  // in the host (ROZ123). It is a compile-time `.rzts` script-partial: it dissolves into each consumer's
  // compiled leaf via inlineScriptPartials() before IR lowering — leaving zero runtime dependency.
  //
  // HOST CONTRACT (symbols the consuming host MUST define before importing — the same implicit
  // by-convention mixin contract the DataTable host's other partials already use for `$data.windowVer`):
  //   - windowSource(): T[]   — the full list to window (the KEY generalization; the DataTable host
  //                             returns its pre-pagination row model, listbox/combobox return the
  //                             filtered options). This partial MUST NOT reach into the host data engine
  //                             directly — rows arrive ONLY through windowSource().
  //   - $props.estimateRowHeight — per-item size estimate (kept aliased for DataTable back-compat).
  //   - $data.windowVer / $data.editVer — window/edit-version reactivity bumps.
  //   - gridScrollEl              — the scroll-container element handle.
  //   - virtualizer               — the host virtual-core instance (built in $onMount from the ref).
  //   - observeElementRect / observeElementOffset / elementScroll / measureElement — virtual-core fns.
  //   - scheduleRemeasure()       — the host's rAF/microtask remeasure defer.
  //   - pinnedEditIndex() / pinnedMeasurement(pin) — the D-05 OPTIONAL pin-extension hook (host-provided,
  //                             defaulting to no-op): the DataTable host passes its edit-pinning hooks;
  //                             listbox passes nothing. Routing pinning through this host hook (NOT
  //                             inlining it) keeps DataTable's B13 edit-pinning behavior byte-identical.
  //   - rowsWindowed(): boolean  — is the ROW axis windowed. REQUIRED, no default — replaces every bare
  //                             truthiness read of the host's windowing prop (D-05); `windowedRows()` /
  //                             `padTop()` / `padBottom()` / `rowIsOutsideWindow()` below call it by
  //                             convention exactly as they already call `pinnedEditIndex()`.
  //   - colsWindowed(): boolean  — is the COLUMN axis windowed. REQUIRED, no default. `false` for every
  //                             host until it defines the real column-axis mechanism (87-04+).
  //   - columnCount(): number    — the leaf-column count the column virtualizer windows over. REQUIRED,
  //                             no default.
  //   - columnSize(i: number): number — the authoritative width of absolute leaf column `i`, sourced
  //                             from table-core's `getSize()` under D-06. REQUIRED, no default.
  //   - forcedColumns(): number[] — the D-10 OPTIONAL column-axis mirror of `pinnedEditIndex()`: the
  //                             DataTable host unions pinned + active-cell + editing column indices into
  //                             the column-window slice; listbox/combobox pass an empty array (host-
  //                             provided, defaulting to `[]`).
  //   - colVirtualizer           — the host's SECOND virtual-core instance, windowing the COLUMN axis
  //                             (see the AXIS MECHANISM note below). Host-provided, defaulting to `null`.
  //   - autoMeasureOn(): boolean — the D-18 REQUIRED content-driven-estimate gate (Phase 87 87-07):
  //                             data-table's real body reads `$props.autoMeasure === true`; listbox/
  //                             combobox/command-palette return `false` so the accumulator branch
  //                             estimateRowSize() gates on is dead code for them (D-20).
  //   - afterRowRemeasure        — OPTIONAL host-owned mutable `let` (defaults to a no-op / undefined),
  //                             assigned to refineRowEstimate() (below) by the host. The DataTable
  //                             host's remeasureWindow() (virtualization.rzts) calls it AFTER its
  //                             measureElement sweep so the fold + hysteresis re-feed run on every
  //                             window commit. Routed through a mutable `let` rather than a direct
  //                             call FROM virtualization.rzts INTO this file: a relative-partial CONST
  //                             calling a bare-specifier-partial CONST is the exact forward-reference
  //                             TDZ class remeasureColumnWindow()'s own DataTable.rozie comment
  //                             documents for columnVirtualizerOptions() (inlineScriptPartials()
  //                             groups the relative partial BEFORE the bare-specifier partial in the
  //                             merged per-target output, regardless of source import order). A
  //                             mutable `let` hoists to `useRef` on React and is excluded from a
  //                             useCallback's dependency array, sidestepping the hazard entirely — the
  //                             SAME mechanism `refreshRowModel` already relies on.
  //
  // AXIS MECHANISM (OQ1 / Assumption A1 — resolved from the installed source in 87-02;
  // LANDED in 87-04: `columnVirtualizerOptions()` below IS the second, horizontal instance this
  // note originally only documented). `horizontal` is a PER-INSTANCE field of `VirtualizerOptions`
  // (`node_modules/@tanstack/virtual-core/dist/esm/index.d.ts:67`, installed version 3.17.1 per
  // `package.json`), and every axis-sensitive internal read consults `instance.options.horizontal` —
  // `measureElement`'s inlineSize/blockSize + offsetWidth/offsetHeight branch
  // (`dist/esm/index.js:137,150`), `observeElementOffset`'s scrollLeft/scrollTop branch
  // (`dist/esm/index.js:118-121`), `getMaxScrollOffset`'s scrollWidth/scrollHeight branch
  // (`dist/esm/index.js:907-915`), and `scrollWithAdjustments`'s left/top branch
  // (`dist/esm/index.js:152-161`). So ONE `Virtualizer` instance windows exactly ONE axis: the column
  // axis needs its own SECOND, independent `Virtualizer` instance constructed with `horizontal: true`,
  // sharing the SAME `getScrollElement()` (the `rdt-scroll` wrapper) the row instance already uses.
  // Two options the row axis does not set that the column instance will need: `isRtl?: boolean`
  // (data-table ships an RTL grid path) and `overscan?: number` (D-07 gives the column axis its own
  // hardcoded constant, separate from the row axis's `overscan: 8` below).
  //
  // isRtl WIRING (gap-closure 87-09, LANDED — see `ensureColRtlWatch()`/`isColRtl()` below,
  // immediately ahead of `columnVirtualizerOptions()`): data-table has no construction-time RTL
  // signal (no `dir`/`rtl` prop), and `dir` can be set on `gridScrollEl` at ANY point relative to
  // mount. `isRtl` is therefore computed LIVE via `getComputedStyle`, not baked in once.
  // getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
  // React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
  // id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
  virtualItemKey = (i: any) => {
    const src = this.windowSource();
    return src && src[i] ? src[i].id : undefined;
  };
  // COL_OVERSCAN (D-07): the column axis's own hardcoded overscan constant, separate from the
  // row axis's `overscan: 8` below. Columns are far wider than rows are tall, so one number
  // cannot serve both axes; no prop is exposed because no consumer has asked to tune the row
  // overscan across the four phases it has shipped. Unused until 87-04 constructs the second,
  // horizontal Virtualizer instance (see the AXIS MECHANISM note above).
  // ══ Phase 87 87-07 (D-15/D-18) — content-driven auto-measure: the shared engine's FIRST
  // mutable top-level state. Hoisted to `useRef` PER-INSTANCE by the React emitter's
  // hoistModuleLet — the SAME mechanism already load-bearing for `table`, `virtualizer`,
  // `remeasurePending`, and `gridScrollEl` in the DataTable host (Task 1's confirmed
  // precedent), so two DataTable instances on one page never share an accumulator
  // (T-87-07-04). measuredRowTotal/measuredRowCount together give the running MEAN of every
  // row folded in so far; lastFedRowEstimate is the estimate value most recently pushed into
  // virtual-core (the hysteresis comparison baseline). ══
  measuredRowTotal = 0;
  measuredRowCount = 0;
  // ══ Gap-closure 87-10 — windowVerBumpPending / bumpWindowVer(): coalesce EVERY $data.windowVer
  // write behind a SINGLE microtask-deferred increment, regardless of how many callers request
  // one within the same synchronous JS task. ══
  //
  // ROOT CAUSE (framework-agnostic; the Solid-specific symptom this closes only EXPOSES it) —
  // confirmed by instrumenting the installed @tanstack/virtual-core@3.17.1 source directly
  // (dist/esm/index.js), not by reasoning abstractly: virtual-core's resizeItem() calls
  // `this.notify(false)` — synchronously invoking `virtualizerOptions().onChange` below — EVERY
  // TIME a measured row's real size differs from its cached one (`delta !== 0`), independent of
  // framework (dist/esm/index.js:836-874). remeasureWindow()'s CR-01 sweep
  // (packages/ui/data-table/src/virtualization.rzts) measures EVERY currently-rendered `<tr>` in
  // ONE for-loop BEFORE calling afterRowRemeasure() (refineRowEstimate() below) — so a single
  // synchronous JS task (e.g. the very first measurement pass, which transitions N never-before-
  // measured rows from the flat seed to their real heights) can fire onChange, and therefore an
  // UNCOALESCED `$data.windowVer = $data.windowVer + 1`, MANY times in a row — well BEFORE
  // refineRowEstimate()'s own fold-then-re-feed (which runs only AFTER that loop finishes) has
  // folded those same measurements into the running mean or re-fed the converged estimate into
  // virtual-core via setOptions(). A live trace of this exact sequence (instrumented resizeItem/
  // getMeasurements calls, DataTableColumnVirtualDemo, autoMeasure on) showed Vue batching 3
  // resizeItem calls before its ONE downstream re-render reads getMeasurements() — already
  // reflecting the fully-folded, re-fed state — versus Solid re-running its padTop()/padBottom()
  // effects SYNCHRONOUSLY and IMMEDIATELY on EVERY individual windowVer write (11 interleaved
  // resize-then-immediate-recompute pairs, each recompute happening mid-sweep, before
  // refineRowEstimate() had run even once). React/Vue/Svelte/Angular/Lit all batch their own
  // reactivity to at least a microtask boundary, so their downstream reads land AFTER the whole
  // synchronous burst (measurement sweep + fold + re-feed) completes — accidentally correct, not
  // correct by construction. Solid does not auto-batch a signal write made from outside a
  // Solid-owned event/effect context, so it is the one target where the mid-burst TORN read is
  // externally observable. Because `setOptions()` + `_willUpdate()` alone do NOT invalidate
  // virtual-core's own `getMeasurements()` memo (keyed on itemSizeCacheVersion /
  // getMeasurementOptions() — never on the estimateSize FUNCTION reference itself; confirmed from
  // the same installed source, dist/esm/index.js:585-587,624), Solid's LAST such mid-sweep
  // recompute is also the LAST time getMeasurements() is ever invoked for that sweep once no
  // further row happens to differ from its cache — so the DOM stays frozen on that stale,
  // pre-fold/pre-re-feed snapshot indefinitely, even though the accumulator itself has already
  // converged correctly (T-87-07's own confirmed finding).
  //
  // FIX: coalesce every requester of a windowVer bump — virtual-core's own onChange AND
  // refineRowEstimate()'s explicit re-feed bump — behind ONE microtask-deferred write, the SAME
  // idiom scheduleRemeasure() already uses in virtualization.rzts. This makes the render happen
  // EXACTLY ONCE, strictly AFTER the entire synchronous burst (including refineRowEstimate()'s
  // fold + re-feed) on EVERY target, by construction rather than by incidental host-framework
  // batching. Scoped to the ROW axis only: colVirtualizer never calls resizeItem() at all (D-06 —
  // column widths come from table-core's getSize() oracle, never measured from the DOM), so
  // columnVirtualizerOptions()'s onChange cannot hit this burst class and is left untouched.
  windowVerBumpPending = false;
  bumpWindowVer = (): void => {
    if (this.windowVerBumpPending) return;
    this.windowVerBumpPending = true;
    const flush = () => {
      this.windowVerBumpPending = false;
      this.windowVer.set(this.windowVer() + 1);
    };
    // Mirrors scheduleRemeasure()'s own defensive queueMicrotask-with-setTimeout-fallback
    // (virtualization.rzts) for environments where queueMicrotask is unavailable.
    if (typeof queueMicrotask !== 'undefined') queueMicrotask(flush);else setTimeout(flush, 0);
  };
  // ESTIMATE_REFEED_DELTA_PX (D-15): the hysteresis threshold gating a re-feed into
  // virtual-core. Without it, a mean nudging by a fraction of a pixel on every fold would
  // re-feed on every window commit — the T-87-07-01 DoS control, paired with virtual-core's
  // own measureElement/resizeItem idempotence (see refineRowEstimate() below).
  // estimateRowSize(i) (D-15/D-17): the estimateSize() resolver. MUST check !autoMeasureOn()
  // FIRST so the off path touches zero accumulator state and returns $props.estimateRowHeight
  // verbatim (D-17's byte-behavioral no-op). The zero-measurements case (first paint,
  // regardless of autoMeasure) still returns the seed — the very first render has nothing
  // measured yet either way (D-15).
  estimateRowSize = (i: number): number => {
    const __estimateRowHeight = this.estimateRowHeight();
    if (!this.autoMeasureOn()) return __estimateRowHeight;
    if (this.measuredRowCount === 0) return __estimateRowHeight;
    return Math.round(this.measuredRowTotal / this.measuredRowCount);
  };
  // foldMeasuredRow(index, height): fold ONE measured row's height into the running-mean
  // accumulator, UPDATING (not double-adding) an already-folded index (T-87-07-03).
  // The FULL virtualizer options. virtual-core's setOptions REPLACES options with
  // `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
  // source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
  // Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
  // on virtual-core's generic option inference. onChange's windowVer write is routed through
  // bumpWindowVer() (87-10) rather than a raw `$data.x = $data.x + 1` — resizeItem() can call
  // this onChange MANY times in a single synchronous sweep (once per row whose real measured
  // size differs from its cache, e.g. every never-before-measured row in the FIRST window),
  // and coalescing those into one microtask-deferred write is what keeps every target's render
  // landing strictly AFTER the whole sweep (see bumpWindowVer()'s own comment for the confirmed
  // Solid-specific rendering gap this closes). The React emitter still lowers the underlying
  // `$data.windowVer = $data.windowVer + 1` to functional setState — correct even deferred to a
  // microtask, exactly as it was correct from a mount closure before.
  virtualizerOptions = (): any => ({
    count: this.windowSource().length,
    getScrollElement: () => this.gridScrollEl,
    estimateSize: (i: any) => this.estimateRowSize(i),
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    measureElement,
    overscan: 8,
    getItemKey: this.virtualItemKey,
    onChange: () => {
      this.bumpWindowVer();
      // CR-01: re-observe the freshly-committed window so RECYCLED rows get measured.
      // virtual-core only observe()s a node you explicitly hand to measureElement (it does
      // NOT auto-discover rendered rows — measureElement is the SOLE caller of
      // observer.observe, virtual-core@3.17.1 dist/esm/index.js:794-817). Rows that recycle
      // into view on scroll are brand-new DOM nodes; without re-sweeping they keep the
      // estimateRowHeight seed forever and the spacer math drifts (req-2). Deferred one frame
      // so the new <tr> set is in the DOM before we measure. Safe from an infinite
      // measure→onChange→measure loop: measureElement is idempotent on an already-observed
      // node (the `prevNode !== node` guard), and resizeItem only re-fires onChange when the
      // measured height actually DIFFERS from the cached one (delta !== 0) — an unchanged
      // re-measure is a no-op.
      this.scheduleRemeasure();
    }
  });
  // pinMeasurement(pin): the D-05 pin-hook read, RE-TYPED at the windowing layer so the
  // shared math is strict-clean across every host. The host-provided pinnedMeasurement() has
  // two shapes: the DataTable host returns a real virtual-core measurement; the listbox/combobox
  // no-op host returns bare `null` (inferred `(pin) => null`). Calling it directly makes
  // `const pm = pinnedMeasurement(pin)` flow-narrow to `null`, so the downstream `pm && pm.start`
  // guard collapses the object branch to `never` (TS2339, Class 3). Reading the hook through this
  // thin wrapper with an EXPLICIT return type (a return-type annotation is NOT flow-narrowed)
  // gives the measurement a real object-or-null shape, so `pm && pm.start` keeps the object branch.
  // Typing-only: the runtime value (a measurement or null) is unchanged.
  pinMeasurement = (pin: number): {
    start: number;
    size: number;
    index: number;
    end: number;
  } | null => this.pinnedMeasurement(pin);
  // windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
  // { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
  // $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
  // full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
  // `rows` binding → TS2448 self-shadow, line ~1149 lesson).
  windowedRows = () => {
    const __rows = this.rows();
    // SUBSCRIBE FIRST (fine-grained targets): touch the reactive windowVer at the TOP — BEFORE any
    // early return — so Solid's <For>/Svelte's {#each} accessor subscribes to it on its FIRST eval,
    // which happens at initial render while `virtualizer` is still null (it is built in $onMount,
    // after the first render). `virtualizer` is a non-reactive `let`, so if the windowVer read sat
    // BELOW the `!virtualizer` guard the accessor would early-return [] without ever reading the
    // signal → it would NEVER re-run when onChange later bumps windowVer, and the window would stay
    // blank forever (the Solid/Svelte fine-grained bug). Coarse targets re-render wholesale so the
    // placement is a no-op for them. The post-construction windowVer bump in $onMount fires the
    // first re-run that picks up the now-non-null virtualizer.
    // ALSO subscribe to editVer here so the slice re-derives when an editor opens/closes (the
    // pin/unpin transition), mirroring the probe's windowVer bump on pin (Solid/Svelte fine-grained).
    void this.windowVer();
    void this.editVer();
    if (!this.virtualizer) {
      // Rows OFF (Phase 87 D-04: this now includes the colsWindowed()-only path, since the
      // wrapper template is entered whenever isWindowed(), not just rowsWindowed() — the row
      // virtualizer is never constructed when only the column axis is windowed, D-04) → the FULL
      // set, with a SYNTHETIC `vi.index` set to each row's array position (matching rowIndexOf's
      // own `$data.rows.indexOf(row)` semantics exactly, since $data.rows IS windowSource()'s
      // output here). Every windowed body binding reads wr.vi.index (data-row, aria-rowindex,
      // colIndexOf, isEditing, the fill handle) — a bare `null` there is a hard crash the moment
      // this branch is reached with the wrapper mounted, which colsWindowed()-only now does.
      // Row-virtual ON but the virtualizer is not yet constructed (pre-$onMount first paint) →
      // render NOTHING so the template never dereferences a not-yet-real `vi`; the rows appear on
      // the first onChange after _didMount.
      if (!this.rowsWindowed()) {
        const rowList = __rows || [];
        return rowList.map((r: any, i: any) => ({
          vi: {
            index: i
          },
          row: r
        }));
      }
      return [];
    }
    const items = this.virtualizer.getVirtualItems();
    const rowList = __rows || [];
    // WR-01: drop any virtual item whose index outruns the current full-model rows (a brief
    // shrink window where the virtualizer count is stale relative to $data.rows on the async
    // onChange→windowVer path). The template keys on wr.row.id, so a row:undefined entry would
    // throw "Cannot read properties of undefined"; filter it here so the template never sees it.
    const out = items.map((vi: any) => ({
      vi,
      row: rowList[vi.index]
    })).filter((wr: any) => wr.row);
    // ── D-02 pin-row union (req-9): if an editor is open on a row that is NOT in the current
    // window, UNION it into the slice (keyed on row.id so Lit repeat / Solid For never recycle it
    // into another full-model row), LEADING the slice when it sits above the window and TRAILING
    // it when below — so DOM order matches visual/aria order. The spacer subtraction (padTop/
    // padBottom) keeps the total exactly getTotalSize(). This is the 51-01-proven mechanism wired
    // into the real windowing.
    const pin = this.pinnedEditIndex();
    if (pin >= 0 && rowList[pin]) {
      let inWindow = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].index === pin) {
          inWindow = true;
          break;
        }
      }
      if (!inWindow) {
        const pm = this.pinMeasurement(pin);
        const firstStart = items.length ? items[0].start : 0;
        const above = pm ? pm.start < firstStart : pin < (items.length ? items[0].index : pin);
        const pinnedEntry = {
          vi: pm != null ? pm : {
            index: pin
          },
          row: rowList[pin],
          pinned: true
        };
        if (above) out.unshift(pinnedEntry);else out.push(pinnedEntry);
      }
    }
    return out;
  };
  // Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
  // the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
  // (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
  padTop = () => {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void this.windowVer();
    void this.editVer();
    if (!this.rowsWindowed() || !this.virtualizer) return 0;
    const items = this.virtualizer.getVirtualItems();
    let pad = items.length ? items[0].start : 0;
    // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
    // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
    // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
    const pin = this.pinnedEditIndex();
    if (pin >= 0) {
      const pm = this.pinMeasurement(pin);
      const inWindow = this.pmIndexInWindow(items, pin);
      if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
    }
    return pad < 0 ? 0 : pad;
  };
  padBottom = () => {
    // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
    // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
    // on pin/unpin.
    void this.windowVer();
    void this.editVer();
    if (!this.rowsWindowed() || !this.virtualizer) return 0;
    const items = this.virtualizer.getVirtualItems();
    if (!items.length) return 0;
    let pad = this.virtualizer.getTotalSize() - items[items.length - 1].end;
    // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
    // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
    const pin = this.pinnedEditIndex();
    if (pin >= 0) {
      const pm = this.pinMeasurement(pin);
      const inWindow = this.pmIndexInWindow(items, pin);
      // WR-01: decide "below the window" by INDEX, not by start-OFFSET. On variable-height rows
      // measurement drift can leave pm.start at-or-past items[0].start while the pinned row's
      // index is actually ABOVE the window, mis-subtracting its height from the trailing spacer.
      // The pinned full-model index vs the last rendered item's index is drift-proof. Fall back to
      // the offset comparison only if the measurement lacks an index (defensive).
      const lastItemIdx = items[items.length - 1].index;
      const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
      if (pm && !inWindow && below) {
        // below the window → it trailed the slice; subtract its height from the trailing spacer.
        if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
      }
    }
    return pad < 0 ? 0 : pad;
  };
  // pmIndexInWindow: is full-model index `idx` present in the rendered virtual window?
  pmIndexInWindow = (items: any, idx: any) => {
    for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
    return false;
  };
  // rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
  // window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
  rowIsOutsideWindow = (r: any) => {
    if (!this.rowsWindowed() || !this.virtualizer) return false;
    const items = this.virtualizer.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
  };
  // ══ Phase 87 87-04 — the column-axis analogs of windowedRows()/padTop()/padBottom()/
  // rowIsOutsideWindow() above. The column axis has no "row-shaped" identity to carry alongside
  // a VirtualItem (a column is not a full-model object the way a row is), so windowedColIndices()
  // returns bare ABSOLUTE leaf-column indices; the template resolves each index back to a header/
  // cell through the host's own header-group / visibleCellsFor lookups (D-08/D-09). ══
  // windowedColIndices(): the ordered array of ABSOLUTE leaf-column indices to render.
  virtualizer: any = null;
  virtualizerCleanup: any = null;
  gridScrollEl: any = null;
  remeasurePending = false;
  // Scroll-end pin state (see recordScrollEnd()): whether the USER left the view at the end,
  // the option count at that moment, and the last scrollTop already accounted for.
  scrollEndPinned = false;
  scrollEndPinnedCount = -1;
  scrollEndPinnedTop = -1;
  // windowSource(): the windowing.rzts host-contract row source — the FILTERED option
  // set. CR-02: the shared windowing contract requires each row to carry a STABLE `.id`
  // (windowing.rzts virtualItemKey reads src[i].id, and the windowed template keys on
  // wr.row.id). A raw Select option is a primitive or a bare { label, value, disabled }
  // — NOT guaranteed to have `.id` — so an unwrapped raw set keyed on wr.row.id collapses
  // every framework :key (and every virtual-core measurement key) to `undefined`, which
  // recycles the wrong DOM node as the window scrolls. Wrap each option into an id-bearing
  // row the way the sibling Combobox's filteredOptions() does — `id` is the resolved
  // value, `_opt` the original option (read via wr.row._opt in the windowed template),
  // `_i` the source index. Kept === $data.rows so the math's rowList[vi.index] resolves to
  // the same wrapped row the count windows over.
  //
  // $memo, keyed on the TRUE inputs. The key covers everything the map reads:
  // options ref + groups + virtual (visibleOptions' inputs — with `virtual` on,
  // grouping is off, so this is source order) and the optionValue resolver
  // (valueOf in the map body).
  // Same reference-stability contract the sibling Combobox's filteredOptions carries —
  // virtual-core's getItemKey/getMeasurements walk this O(count) per pass, so an
  // unmemoized per-call re-map made every scroll tick O(N²) in wrapper allocations.
  windowSourceCache = {
    keys: null as any[] | null,
    val: null as any
  };
  windowSource = () => {
    const __rozieMemoKey = [this.options(), this.groups(), this.virtual(), this.optionValue()];
    const __rozieMemoPrev = this.windowSourceCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return this.windowSourceCache.val;
    }
    const __rozieMemoVal = this.visibleOptions().map((o: any, i: any) => ({
      id: this.valueOf$local(o),
      _opt: o,
      _i: i
    }));
    this.windowSourceCache.keys = __rozieMemoKey;
    this.windowSourceCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  };
  // D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
  // A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
  // pinnedMeasurement() UNGUARDED by convention; a select has no edit-pinning, so these
  // reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
  // to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
  pinnedEditIndex = () => -1;
  pinnedMeasurement = (pin: any) => null;
  // D-05 windowing.rzts host-contract one-liner (Phase 87 87-02). rowsWindowed() preserves
  // today's EXACT truthiness (byte-behavior-identical) — it is the REQUIRED symbol
  // windowing.rzts calls in place of a bare `$props.virtual` read. NOT type-annotated — this
  // `<script>` block has no `lang="ts"` (unlike windowing.rzts / Combobox.rozie), so the
  // pinMeasurement() explicit-return-type trick (windowing.rzts:65-74) does not apply here; nothing
  // in this plan calls these through a type-narrowing wrapper.
  //
  // GAP-CLOSURE 87-16 (WR-02): the column-axis host-contract symbols (`colVirtualizer`,
  // `colsWindowed()`, `columnCount()`, `columnSize()`, `forcedColumns()`) that 87-02 added
  // alongside this were REMOVED here — they were dead code shipped on a mistaken premise
  // about the compiler's tree-shaking BFS. Select imports only `{ virtualItemKey,
  // virtualizerOptions, windowedRows, padTop, padBottom, pmIndexInWindow, rowIsOutsideWindow }`
  // from windowing.rzts; none of those functions' bodies reference the column-axis symbols
  // (only `columnVirtualizerOptions()`/`windowedColIndices()`/`colPadLeft()`/`colPadRight()`/
  // `colIsOutsideWindow()` do, and Select never imports any of those), so
  // `inlineScriptPartials()`'s BFS never needed them to exist. See 87-REVIEW.md WR-02 /
  // 87-16-SUMMARY.md for the verification trail.
  rowsWindowed = () => !!this.virtual();
  // autoMeasureOn() (Phase 87 87-07, D-18/D-20): the content-driven-estimate host-contract
  // gate. Select never lights this branch — a permanent `false` keeps windowing.rzts's
  // estimateRowSize()/refineRowEstimate() accumulator dead code here. RETAINED (unlike the
  // column-axis symbols above): `virtualizerOptions()` — which Select DOES import and call
  // — wires `estimateSize: (i) => estimateRowSize(i)`, and `estimateRowSize()` calls
  // `autoMeasureOn()` as its first line. This one IS reachable through the import graph.
  autoMeasureOn = () => false;
  // Keep $data.rows === windowSource() so the windowing math indexes the live option set.
  syncRows = () => {
    this.rows.set(this.windowSource());
  };
  // SCROLL-END PIN (the data-table D-19 twin): keep a user who scrolled to the END of a
  // variable-height list at the end while the options in view measure taller than their
  // estimate. The view is judged on the DOM, and only at a move the USER made — a move is
  // virtual-core's own when it still holds an unreconciled scroll adjustment
  // (scrollAdjustments !== 0): its above-viewport compensation writes an ABSOLUTE scrollTop
  // computed from its last-observed (stale) offset, so it pulls the view back up from the end
  // and must neither clear the pin nor be mistaken for the user leaving the end. That position
  // is remembered so the scroll event that later reports it is not read as a user move either.
  // (Judging on virtual-core's MODEL, as the data-table host does, fails here: its total grows
  // with every option measured in the ResizeObserver batch while its offset stays at the stale
  // value, so the pin was cleared mid-batch — every target ended 10-126px short, measured.)
  recordScrollEnd = () => {
    if (!this.virtualizer || !this.gridScrollEl || this.virtualizer.scrollState) return;
    const top = this.gridScrollEl.scrollTop;
    if (top === this.scrollEndPinnedTop) return;
    this.scrollEndPinnedTop = top;
    if (this.virtualizer.scrollAdjustments !== 0) return;
    // Only a list that actually overflows has an end to hold: while the window has not painted
    // yet (or the list is closed), scrollHeight <= clientHeight reads as "at the end" and a pin
    // recorded then would jump the freshly opened list to the bottom.
    const sh = this.gridScrollEl.scrollHeight;
    const ch = this.gridScrollEl.clientHeight;
    this.scrollEndPinned = ch > 0 && sh - ch > 1 && sh - top - ch <= 1;
    this.scrollEndPinnedCount = this.windowSource().length;
  };
  // Re-apply the pin after the framework has committed the window (called from the rAF pass):
  // the real maximum is known only then. Not while a programmatic scroll (scrollToIndex) is in
  // flight, and not when the option count changed since the user reached the end (a new filter
  // or appended options must not be auto-followed).
  keepScrollEnd = () => {
    if (!this.scrollEndPinned || !this.virtualizer || !this.gridScrollEl || this.virtualizer.scrollState) return;
    if (this.windowSource().length !== this.scrollEndPinnedCount) return;
    const maxTop = this.gridScrollEl.scrollHeight - this.gridScrollEl.clientHeight;
    if (maxTop - this.gridScrollEl.scrollTop > 1) {
      this.gridScrollEl.scrollTop = maxTop;
      this.scrollEndPinnedTop = this.gridScrollEl.scrollTop;
    }
  };
  // Defer remeasureWindow() until AFTER the framework commits the recycled window
  // (onChange fires BEFORE React/Solid commit). TWO deferred passes (microtask THEN rAF)
  // behind one in-flight flag (the data-table virtualization.rzts:46-56 pattern, copied
  // per-consumer per D-04/D-09): the microtask catches Solid's <For> / Svelte's {#each}
  // SYNCHRONOUS commit (the Phase 63 Solid under-convergence hazard — D-09 rAF-defer
  // budget), the rAF catches React's async commit. measureElement is idempotent on an
  // already-observed node, so running both is cheap and loop-free.
  scheduleRemeasure = () => {
    this.recordScrollEnd();
    if (this.remeasurePending) return;
    this.remeasurePending = true;
    let ranMicro = false;
    const microPass = () => {
      this.remeasureWindow();
    };
    // N-05 (quick 260923-rrr): key the rAF pass on the OUTCOME. React and Angular commit the
    // recycled window AFTER the first rAF, so one pass measured the OLD options and the new ones
    // waited for virtual-core's 150ms scrolling-ended tick — with variable-height options the late
    // above-viewport adjustment then moved the whole list (measured). Re-run next frame until the
    // committed options cover the virtualizer's window, bounded (the data-table host twin).
    let rafAttempts = 0;
    const rafPass = () => {
      const covered = this.remeasureWindow();
      rafAttempts = rafAttempts + 1;
      if (!covered && rafAttempts < 10 && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(rafPass);
        return;
      }
      this.keepScrollEnd();
      this.remeasurePending = false;
    };
    if (typeof queueMicrotask !== 'undefined') {
      ranMicro = true;
      queueMicrotask(microPass);
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) this.remeasurePending = false;else setTimeout(rafPass, 0);
  };
  // measureElement sweep: hand every rendered windowed option to the virtualizer so its
  // true (variable) height is observed (virtual-core measures ONLY nodes passed to
  // measureElement, keyed by the data-index attribute). Bails during a programmatic
  // scroll (scrollToIndex) so a measure can't starve the scroll target.
  remeasureWindow = () => {
    if (!this.virtualizer || !this.gridScrollEl) return true;
    if (this.virtualizer.scrollState) return true;
    const els = this.gridScrollEl.querySelectorAll('.rozie-select-option[data-index]');
    const rendered = new Set();
    for (const el of els as any) {
      this.virtualizer.measureElement(el);
      rendered.add(el.getAttribute('data-index'));
    }
    // N-05: false while the framework has not yet committed the recycled window.
    const items = this.virtualizer.getVirtualItems();
    for (let i = 0; i < items.length; i++) {
      if (!rendered.has(String(items[i].index))) return false;
    }
    return true;
  };
  // ---- focus / scroll helpers (post-mount $refs only) --------------------
  // Impure ($refs) → per the ROZ123 + A==B rules they stay in the host (the spine
  // only closes over them). Named `focusControl` (not `focus`): a `focus` $expose
  // verb would override the inherited HTMLElement.focus method on the Lit element.
  focusControl = () => {
    this.triggerEl()?.nativeElement?.focus();
  };
  // Keep the active option visible inside the scrolling listbox. Reads $refs in
  // a post-mount callback only (never eagerly — ROZ123). When windowing, route through
  // the virtualizer (scrollToIndex) so an active option OUTSIDE the rendered window is
  // scrolled into view (the windowed-arrow-nav seam); else the native scrollIntoView.
  scrollActiveIntoView = () => {
    const __activeIndex = this.activeIndex();
    if (__activeIndex < 0) return;
    if (this.virtual() && this.virtualizer) {
      // 'center' (not 'auto'): keep the active option well inside the rendered slice as the
      // window scrolls — 'auto' lands it at the viewport edge where the overscan band can
      // leave it just-unrendered for a frame on the fine-grained targets (Solid).
      this.virtualizer.scrollToIndex(__activeIndex, {
        align: 'center'
      });
      this.scheduleRemeasure();
      return;
    }
    if (!this.listEl()?.nativeElement) return;
    const el = this.listEl()!.nativeElement.querySelector('#' + CSS.escape(this.optionId(__activeIndex)));
    el?.scrollIntoView({
      block: 'nearest'
    });
  };
  // ---- windowing lifecycle (post-mount; ONLY when virtual) ----------------
  // kickWindow: the cross-target first-paint settle. Re-captures the LIVE scroll element,
  // re-feeds the CURRENT option count into the virtualizer, re-attaches its rect observer
  // (_willUpdate), and bumps the windowVer signal so the windowed <For>/{#each}/repeat
  // re-derives. Retried over a few frames because (a) virtual-core measures the scroll rect
  // asynchronously (D-09 Solid rAF-defer — a synchronous kick sees rectH 0 → empty window),
  // (b) Solid/Lit recreate the list node between mount and first commit (leaving virtual-core's
  // scrollElement stale), and (c) the consumer often seeds options AFTER the select mounts
  // (Lit/React), so the count must be re-read once the prop propagates. Stops once the window
  // paints (or attempts run out) — idempotent + loop-free.
  kickWindow = (attempts: any) => {
    if (!this.virtualizer) return;
    this.gridScrollEl = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rozie-select-list') : this.gridScrollEl;
    // Only re-feed the count from a NON-EMPTY source: on React these rAF closures capture
    // stale (mount-time, empty) props, so feeding here would CLOBBER the $watch's correct
    // count back to 0. The $watch (fresh useEffect props) owns React's count; the kick owns
    // the Solid/Lit scroll-element re-attach + the deferred windowVer re-derive.
    if (this.windowSource().length > 0) {
      this.syncRows();
      this.virtualizer.setOptions(this.virtualizerOptions());
    }
    this.virtualizer._willUpdate();
    this.windowVer.set(this.windowVer() + 1);
    this.remeasureWindow();
    if (this.windowedRows().length === 0 && attempts > 0) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.kickWindow(attempts - 1));else setTimeout(() => this.kickWindow(attempts - 1), 16);
    }
  };
  // nextAutoId(): a page-wide counter shared by every Rozie component instance. It
  // lives on globalThis (read through Reflect, which type-checks in the plain-JS and
  // the TS script alike) so separately bundled copies of a leaf never hand out the
  // same id. The same four lines live in Combobox, Select and Popover.
  nextAutoId = () => {
    const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
    Reflect.set(globalThis, '__rozieAutoId', n);
    return n;
  };
  // idRoot(): the `idBase` prop, else the per-instance id generated in $onMount, else the
  // pre-mount fallback. Also the listCore.rzts host contract (its optionId reads it).
  idRoot = () => this.idBase() || this.autoId() || 'rozie-select';
  // popupVisible(): the single gate every list branch and aria-expanded read.
  popupVisible = () => {
    if (!this.open$local()) return false;
    if (!this.hideEmpty()) return true;
    return this.visibleOptions().length > 0;
  };
  // ---- composed popover <-> open state ------------------------------------
  // The popover's `open` model is bound to $data.panelOpen, NOT to $data.open: the
  // popover emits nothing of its own, it only writes its model when it dismisses
  // (outside click, or Escape seen at the document). Binding it to a field of its own
  // makes that write visible, so a popover-initiated close is routed through the
  // spine's close() like every other close — one `open-change` per real transition and
  // the highlight reset.
  //
  // Telling the popover's write from our own is done with STATE, not a flag:
  // $data.panelEcho is written together with every $data.panelOpen write made here, so
  // in any one render/flush the pair is consistent — equal means "ours", different
  // means "the popover closed itself" (it can never open itself: `trigger="manual"`).
  // A plain variable in its place is read live while the reactive values are per-render
  // snapshots on React: when a close and a re-open land in one commit, both watchers
  // run in one pass and the second one misreads our own write as a dismissal (seen as
  // a popup that stayed shut after Enter-then-ArrowDown).
  // The echo is written FIRST, for targets whose watchers run synchronously on a write.
  syncPanel = () => {
    const visible = this.popupVisible();
    if (visible === this.panelOpen()) return;
    this.panelEcho.set(visible);
    this.panelOpen.set(visible);
  };
  // select -> popover: follows a derived primitive covering everything popupVisible() reads.
  // Select-local keydown wrapper (kept out of listCore so the shared partial and the sibling
  // families' generated output stay untouched).
  //  - hideEmpty: when the popup is hidden because the list is empty ($data.open is still true
  //    internally; only the rendered/ARIA state is gated), Escape and Enter are left entirely to
  //    the host - not preventDefault'ed, not consumed. All other keys still reach listCore.
  //  - selectOnTab: Tab commits the highlighted option before listCore closes the popup, only
  //    while the popup is actually visible.
  onTriggerKeyDown = ($event: any) => {
    const __open$local = this.open$local();
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const hidden = __open$local && !this.popupVisible();
    if (hidden && ($event.key === 'Escape' || $event.key === 'Enter')) return;
    if ($event.key === 'Tab' && __open$local && this.selectOnTab() && this.popupVisible() && this.activeIndex() >= 0) this.commitActive();
    this.onControlKeyDown($event);
  };
  // A number-typed helper: a literal `0`/`-1` tabindex trips TS2869 on React
  // (`?? undefined` on a provably non-null operand) - the data-table cellTabindex precedent.
  triggerTabindex = () => (this.disabled() || this.__rozieCvaDisabled()) ? -1 : 0;
  // One click handler on the whole control: the arrow, padding and (later) the chip
  // row all open the popup; the buttons inside stop propagation themselves.
  onControlClick = ($event: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.toggle();
    this.focusControl();
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
    _dir: Select,
    _ctx: unknown,
  ): _ctx is SelectedCtx | OptionCtx | EmptyCtx | GroupHeadingCtx {
    return true;
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

  protected get __style() {
      const __maxHeight = this.maxHeight();
      return (this.popupVisible() ? '' : 'display:none;') + (__maxHeight ? 'height:' + __maxHeight + ';max-height:' + __maxHeight + ';overflow-y:auto;--rozie-select-max-height:' + __maxHeight : 'overflow-y:auto');
    }

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Select;
