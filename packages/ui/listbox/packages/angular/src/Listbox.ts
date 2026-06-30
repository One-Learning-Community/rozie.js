import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally
// (a peer dep); every RUNTIME reference sits behind `if ($props.virtual)` / a
// `virtualizer` guard so the non-virtual emitted path executes none of it
// (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// Windowing instance state (the `let table` precedent — React hoists reassigned
// module-`let`s to useRef; do NOT const). NULL until $onMount, and ONLY constructed
// when $props.virtual. gridScrollEl is the captured .rozie-listbox-list scroll div the
// virtualizer observes; remeasurePending dedupes the deferred sweep.

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

    <div class="rozie-listbox" [ngClass]="{ 'rozie-listbox-open': open$local(), 'rozie-listbox-disabled': (disabled() || this.__rozieCvaDisabled()), 'rozie-listbox-inline': inline() }" #__rozieRoot #rozieSpread_0 #rozieListenersTarget_1>

      
      <div class="rozie-listbox-control" #controlEl>
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
      </div>

      
      @if (open$local() && !virtual()) {
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
    }@if (virtual()) {
    <div #listEl class="rozie-listbox-list rozie-listbox-list--virtual" role="listbox" [attr.id]="rozieAttr(id() + '-list')" [attr.aria-label]="ariaLabel()" [attr.aria-multiselectable]="multiple()" [style]="__style">
        <div class="rozie-listbox-spacer" aria-hidden="true" [style]="'height:' + padTop() + 'px'"></div>

        @for (wr of windowedRows(); track wr.row.id) {
    <div [attr.id]="rozieAttr(optionId(wr.vi.index))" [attr.data-index]="rozieAttr(wr.vi.index)" class="rozie-listbox-option" [ngClass]="{ 'is-active': activeIndex() === wr.vi.index, 'is-selected': isSelected(wr.row._opt), 'is-disabled': disabledOf(wr.row._opt) }" role="option" [attr.aria-selected]="!!isSelected(wr.row._opt)" [attr.aria-disabled]="!!disabledOf(wr.row._opt)" (click)="select(wr.row._opt)" (mousemove)="onOptionPointerMove(wr.vi.index)">
          @if ((optionTpl ?? templates()?.['option'])) {
    <ng-container *ngTemplateOutlet="(optionTpl ?? templates()?.['option']); context: { $implicit: { option: wr.row._opt, index: wr.vi.index, active: activeIndex() === wr.vi.index, selected: isSelected(wr.row._opt), disabled: disabledOf(wr.row._opt) }, option: wr.row._opt, index: wr.vi.index, active: activeIndex() === wr.vi.index, selected: isSelected(wr.row._opt), disabled: disabledOf(wr.row._opt) }" />
    } @else {

            {{ rozieDisplay(labelOf(wr.row._opt)) }}
          
    }
        </div>
    }

        <div class="rozie-listbox-spacer" aria-hidden="true" [style]="'height:' + padBottom() + 'px'"></div>

        @if (windowSource().length === 0) {
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
    .rozie-listbox-inline {
      display: block;
      width: 100%;
    }
    .rozie-listbox-inline .rozie-listbox-list {
      position: static;
      margin-top: var(--rozie-listbox-popup-offset, 4px);
      border: none;
      border-radius: 0;
      box-shadow: none;
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
    .rozie-listbox-spacer { margin: 0; padding: 0; border: 0; flex: none; }
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
  /**
   * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`.
   */
  options = input<any[]>((() => [])());
  /**
   * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Listbox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Listbox r-model:value="fruit" :options="fruits" />
   */
  value = model<(unknown) | null>(null);
  /**
   * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit.
   */
  multiple = input<boolean>(false);
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the listbox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
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
  optionLabel = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Stable id base for the ARIA wiring (the listbox id, per-option ids, and `aria-activedescendant`). Give each instance on a page a distinct id so these references stay unique.
   */
  id = input<string>('rozie-listbox');
  /**
   * Accessible name for the control when there is no visible `<label for>` pointing at its `id` (`aria-label`).
   */
  ariaLabel = input<(string) | null>(null);
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed listbox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
   */
  virtual = input<boolean>(false);
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight = input<number>(36);
  /**
   * A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-listbox-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  maxHeight = input<string>('');
  open$local = signal(false);
  activeIndex = signal(-1);
  query = signal('');
  rows = signal<any[]>([]);
  windowVer = signal(0);
  editVer = signal(0);
  controlEl = viewChild<ElementRef<HTMLDivElement>>('controlEl');
  triggerEl = viewChild<ElementRef<HTMLButtonElement>>('triggerEl');
  listEl = viewChild<ElementRef<HTMLDivElement>>('listEl');
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  openChange = output<unknown>({ alias: 'open-change' });
  change = output<unknown>();
  @ContentChild('selected', { read: TemplateRef }) selectedTpl?: TemplateRef<SelectedCtx>;
  @ContentChild('option', { read: TemplateRef }) optionTpl?: TemplateRef<OptionCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

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
      // Tear down the virtualizer's scroll-element ResizeObserver (no-op when virtual off).
      if (this.virtualizerCleanup) this.virtualizerCleanup();
    });
    effect(() => { const __watchVal = (() => (this.options() ? this.options().length : 0) + '|' + this.query())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.syncRows();
      if (this.virtual() && this.virtualizer) {
        this.gridScrollEl = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rozie-listbox-list') : this.gridScrollEl;
        this.virtualizer.setOptions(this.virtualizerOptions());
        this.virtualizer._willUpdate();
        this.windowVer.set(this.windowVer() + 1);
        this.scheduleRemeasure();
      }
    })(); }); });
  }

  ngAfterViewInit() {
    this.syncRows();
    if (this.virtual()) {
      // The list renders at mount when virtual, so the .rozie-listbox-list scroll container
      // exists here. Capture it via $el.querySelector (the data-table gridScrollEl precedent,
      // proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered node is null on
      // Solid/Lit, which leaves the virtualizer with no scroll element.
      this.gridScrollEl = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rozie-listbox-list') : null;
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
    const q = (this.query() || '').trim().toLowerCase();
    if (q === '') return __options;
    return __options.filter((opt: any) => this.labelOf(opt).toLowerCase().includes(q));
  };
  isSelected = (opt: any) => {
    const v = this.valueOf$local(opt);
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
    const v = this.valueOf$local(opt);
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
  onOptionPointerMove = (index: any) => {
    if (this.activeIndex() !== index) this.activeIndex.set(index);
  };
  virtualItemKey = (i: any) => {
    const src = this.windowSource();
    return src && src[i] ? src[i].id : undefined;
  };
  virtualizerOptions = (): any => ({
    count: this.windowSource().length,
    getScrollElement: () => this.gridScrollEl,
    estimateSize: () => this.estimateRowHeight(),
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    measureElement,
    overscan: 8,
    getItemKey: this.virtualItemKey,
    onChange: () => {
      this.windowVer.set(this.windowVer() + 1);
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
  pinMeasurement = (pin: number): {
    start: number;
    size: number;
    index: number;
    end: number;
  } | null => this.pinnedMeasurement(pin);
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
      // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
      // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
      // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
      // rows appear on the first onChange after _didMount.
      if (!this.virtual()) {
        const rowList = __rows || [];
        return rowList.map((r: any) => ({
          vi: null,
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
  padTop = () => {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void this.windowVer();
    void this.editVer();
    if (!this.virtual() || !this.virtualizer) return 0;
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
    if (!this.virtual() || !this.virtualizer) return 0;
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
  pmIndexInWindow = (items: any, idx: any) => {
    for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
    return false;
  };
  rowIsOutsideWindow = (r: any) => {
    if (!this.virtual() || !this.virtualizer) return false;
    const items = this.virtualizer.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
  };
  virtualizer: any = null;
  virtualizerCleanup: any = null;
  gridScrollEl: any = null;
  remeasurePending = false;
  windowSource = () => this.visibleOptions().map((o: any, i: any) => ({
    id: this.valueOf$local(o),
    _opt: o,
    _i: i
  }));
  pinnedEditIndex = () => -1;
  pinnedMeasurement = (pin: any) => null;
  syncRows = () => {
    this.rows.set(this.windowSource());
  };
  scheduleRemeasure = () => {
    if (this.remeasurePending) return;
    this.remeasurePending = true;
    let ranMicro = false;
    const microPass = () => {
      this.remeasureWindow();
    };
    const rafPass = () => {
      this.remeasurePending = false;
      this.remeasureWindow();
    };
    if (typeof queueMicrotask !== 'undefined') {
      ranMicro = true;
      queueMicrotask(microPass);
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) this.remeasurePending = false;else setTimeout(rafPass, 0);
  };
  remeasureWindow = () => {
    if (!this.virtualizer || !this.gridScrollEl) return;
    if (this.virtualizer.scrollState) return;
    const els = this.gridScrollEl.querySelectorAll('.rozie-listbox-option[data-index]');
    for (const el of els as any) this.virtualizer.measureElement(el);
  };
  focusControl = () => {
    this.triggerEl()?.nativeElement?.focus();
  };
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
  kickWindow = (attempts: any) => {
    if (!this.virtualizer) return;
    this.gridScrollEl = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rozie-listbox-list') : this.gridScrollEl;
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

  protected get __style() {
      const __maxHeight = this.maxHeight();
      return (this.open$local() ? '' : 'display:none;') + (__maxHeight ? 'height:' + __maxHeight + ';max-height:' + __maxHeight + ';overflow-y:auto;--rozie-listbox-max-height:' + __maxHeight : 'overflow-y:auto');
    }

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Listbox;
