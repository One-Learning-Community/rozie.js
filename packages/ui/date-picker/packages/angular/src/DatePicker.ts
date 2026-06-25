import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { addDays, addMonths, buildMonthGrid, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, resolveViewIso, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

interface HeaderCtx {
  $implicit: { label: any; prev: any; next: any; disabled: any };
  label: any;
  prev: any;
  next: any;
  disabled: any;
}

interface PresetsCtx {
  $implicit: { presets: any; apply: any };
  presets: any;
  apply: any;
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
  selector: 'rozie-date-picker',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-datepicker" [ngClass]="{ 'rozie-datepicker--disabled': (disabled() || this.__rozieCvaDisabled()) }" #root role="group" aria-label="Date picker" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" #rozieSpread_0 #rozieListenersTarget_1>
      
      @if ((headerTpl ?? templates()?.['header'])) {
    <ng-container *ngTemplateOutlet="(headerTpl ?? templates()?.['header']); context: { $implicit: { label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!disabled() }, label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!disabled() }" />
    } @else {

        <div class="rozie-datepicker-header">
          <button type="button" class="rozie-datepicker-nav rozie-datepicker-prev" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" aria-label="Previous month" (click)="goPrevMonth()">‹</button>
          <span class="rozie-datepicker-heading" aria-live="polite">{{ rozieDisplay(monthHeading()) }}</span>
          <button type="button" class="rozie-datepicker-nav rozie-datepicker-next" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" aria-label="Next month" (click)="goNextMonth()">›</button>
        </div>
      
    }

      
      <div class="rozie-datepicker-grid" role="grid" (mouseleave)="hoverIso.set('')">
        <div class="rozie-datepicker-weekdays" role="row">
          @for (wd of weekdays(); track wi; let wi = $index) {
    <span class="rozie-datepicker-weekday" role="columnheader" [attr.aria-label]="rozieAttr(wd)">{{ rozieDisplay(wd) }}</span>
    }
        </div>

        @for (week of grid().weeks; track wk; let wk = $index) {
    <div class="rozie-datepicker-week" role="row">
          @for (day of week; track day.iso) {
    <span class="rozie-datepicker-cell" role="gridcell" [attr.aria-selected]="!!(day.selected || day.rangeStart || day.rangeEnd)">
            <button type="button" class="rozie-datepicker-day" [ngClass]="{ 'is-selected': day.selected, 'is-today': day.today, 'is-outside': !day.inMonth, 'is-in-range': day.inRange, 'is-range-start': day.rangeStart, 'is-range-end': day.rangeEnd, 'is-in-preview': day.inPreview }" [attr.data-day]="rozieAttr(day.iso)" [attr.tabindex]="rozieAttr(dayTabIndex(day))" [disabled]="!!day.disabled" [attr.aria-disabled]="!!day.disabled" [attr.aria-label]="rozieAttr(day.iso)" [attr.aria-current]="rozieAttr(day.today ? 'date' : null)" (click)="onDaySelect(day.iso)" (mouseenter)="onDayHover(day.iso)" (focus)="onDayHover(day.iso)" (keydown)="onDayKeydown(day.iso, $event)">{{ rozieDisplay(day.day) }}</button>
          </span>
    }
        </div>
    }
      </div>

      
      @if ((presetsTpl ?? templates()?.['presets'])) {
    <ng-container *ngTemplateOutlet="(presetsTpl ?? templates()?.['presets']); context: { $implicit: { presets: resolvedPresets(), apply: applyPreset }, presets: resolvedPresets(), apply: applyPreset }" />
    } @else {

        @if (resolvedPresets().length) {
    <div class="rozie-datepicker-presets" role="group" aria-label="Date range presets">
          @for (p of resolvedPresets(); track p.label) {
    <button type="button" class="rozie-datepicker-preset" [ngClass]="{ 'is-active': isPresetActive(p.range) }" [attr.aria-pressed]="!!isPresetActive(p.range)" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" (click)="applyPreset(p.range)">{{ rozieDisplay(p.label) }}</button>
    }
        </div>
    }
    }
    </div>

  `,
  styles: [`
    .rozie-datepicker {
      display: inline-block;
      font: var(--rozie-datepicker-font, inherit);
      color: var(--rozie-datepicker-fg, #1a1a1a);
      background: var(--rozie-datepicker-bg, #fff);
      border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
      border-radius: var(--rozie-datepicker-radius, 10px);
      padding: var(--rozie-datepicker-padding, 0.75rem);
    }
    .rozie-datepicker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--rozie-datepicker-gap, 0.25rem);
      margin-bottom: var(--rozie-datepicker-header-gap, 0.5rem);
    }
    .rozie-datepicker-heading {
      font-weight: var(--rozie-datepicker-heading-weight, 600);
      font-size: var(--rozie-datepicker-heading-size, 0.95rem);
    }
    .rozie-datepicker-nav {
      box-sizing: border-box;
      width: var(--rozie-datepicker-nav-size, 2rem);
      height: var(--rozie-datepicker-nav-size, 2rem);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font: inherit;
      color: inherit;
      background: var(--rozie-datepicker-nav-bg, transparent);
      border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
      border-radius: var(--rozie-datepicker-nav-radius, 6px);
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, border-color 0.12s;
    }
    .rozie-datepicker-nav:hover {
      background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
    }
    .rozie-datepicker-nav:focus-visible,
    .rozie-datepicker-day:focus-visible {
      outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
      outline-offset: var(--rozie-datepicker-ring-offset, 1px);
    }
    .rozie-datepicker-grid {
      display: grid;
      gap: var(--rozie-datepicker-cell-gap, 0.125rem);
    }
    .rozie-datepicker-weekdays,
    .rozie-datepicker-week {
      display: grid;
      grid-template-columns: repeat(7, var(--rozie-datepicker-cell-size, 2.25rem));
      gap: var(--rozie-datepicker-cell-gap, 0.125rem);
    }
    .rozie-datepicker-weekday {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: var(--rozie-datepicker-weekday-height, 1.75rem);
      font-size: var(--rozie-datepicker-weekday-size, 0.72rem);
      font-weight: var(--rozie-datepicker-weekday-weight, 600);
      color: var(--rozie-datepicker-weekday-fg, rgba(0, 0, 0, 0.5));
      text-transform: uppercase;
      user-select: none;
    }
    .rozie-datepicker-cell {
      display: inline-flex;
    }
    .rozie-datepicker-day {
      box-sizing: border-box;
      width: var(--rozie-datepicker-cell-size, 2.25rem);
      height: var(--rozie-datepicker-cell-size, 2.25rem);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font: inherit;
      font-size: var(--rozie-datepicker-day-size, 0.85rem);
      color: inherit;
      background: var(--rozie-datepicker-day-bg, transparent);
      border: var(--rozie-datepicker-day-border-width, 1px) solid transparent;
      border-radius: var(--rozie-datepicker-day-radius, 6px);
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .rozie-datepicker-day:hover:not(:disabled) {
      background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
    }
    .rozie-datepicker-day.is-outside {
      color: var(--rozie-datepicker-outside-fg, rgba(0, 0, 0, 0.35));
    }
    .rozie-datepicker-day.is-today:not(.is-selected) {
      border-color: var(--rozie-datepicker-today-border, var(--rozie-datepicker-accent, #0066cc));
    }
    .rozie-datepicker-day.is-selected {
      color: var(--rozie-datepicker-selected-fg, #fff);
      background: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
      border-color: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
      font-weight: var(--rozie-datepicker-selected-weight, 600);
    }
    .rozie-datepicker-day.is-in-range {
      background: var(--rozie-datepicker-range-bg, rgba(0, 102, 204, 0.14));
      border-radius: 0;
    }
    .rozie-datepicker-day.is-in-preview {
      background: var(--rozie-datepicker-preview-bg, rgba(0, 102, 204, 0.08));
      border-radius: 0;
    }
    .rozie-datepicker-day.is-range-start,
    .rozie-datepicker-day.is-range-end {
      color: var(--rozie-datepicker-selected-fg, #fff);
      background: var(--rozie-datepicker-range-endpoint-bg, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)));
      border-color: var(--rozie-datepicker-range-endpoint-bg, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)));
      font-weight: var(--rozie-datepicker-selected-weight, 600);
    }
    .rozie-datepicker-day.is-range-start {
      border-top-left-radius: var(--rozie-datepicker-day-radius, 6px);
      border-bottom-left-radius: var(--rozie-datepicker-day-radius, 6px);
    }
    .rozie-datepicker-day.is-range-end {
      border-top-right-radius: var(--rozie-datepicker-day-radius, 6px);
      border-bottom-right-radius: var(--rozie-datepicker-day-radius, 6px);
    }
    .rozie-datepicker-day:disabled {
      cursor: not-allowed;
      opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
      pointer-events: none;
    }
    .rozie-datepicker--disabled {
      opacity: var(--rozie-datepicker-disabled-opacity, 0.55);
      pointer-events: none;
    }
    .rozie-datepicker-presets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--rozie-datepicker-presets-gap, 0.25rem);
      margin-top: var(--rozie-datepicker-presets-gap-top, 0.5rem);
    }
    .rozie-datepicker-preset {
      font: inherit;
      font-size: var(--rozie-datepicker-preset-size, 0.78rem);
      color: var(--rozie-datepicker-preset-fg, inherit);
      background: var(--rozie-datepicker-preset-bg, transparent);
      border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
      border-radius: var(--rozie-datepicker-preset-radius, 999px);
      padding: var(--rozie-datepicker-preset-padding, 0.2rem 0.6rem);
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .rozie-datepicker-preset:hover:not(:disabled) {
      background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
    }
    .rozie-datepicker-preset:focus-visible {
      outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
      outline-offset: var(--rozie-datepicker-ring-offset, 1px);
    }
    .rozie-datepicker-preset.is-active {
      color: var(--rozie-datepicker-selected-fg, #fff);
      background: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
      border-color: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
      font-weight: var(--rozie-datepicker-selected-weight, 600);
    }
    .rozie-datepicker-preset:disabled {
      cursor: not-allowed;
      opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
      pointer-events: none;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePicker),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class DatePicker {
  /**
   * The selected value (two-way `r-model`). **Polymorphic** on `selectionMode`: in `single` mode an ISO `YYYY-MM-DD` string (`""` = nothing selected); in `range` mode a `{ start, end }` object of ISO endpoints (`""` = an unset endpoint). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Selecting a day writes the new value back and emits `change`. **Lit caveat (range mode):** the object form must be delivered via a *property* binding (`.value=${obj}` / `r-model`), never a string `value="..."` attribute — the same rule already in force for `disabledDates`.
   * @example
   * <DatePicker r-model:value="date" :min="'2026-01-01'" @change="onPick" />
   */
  value = model<string | Record<string, any>>('');
  /**
   * Selection mode: `'single'` (the default — `value` is one ISO `YYYY-MM-DD` string, fully backward-compatible) or `'range'` (`value` becomes a `{ start, end }` object selected with two clicks plus a live hover preview, direction-agnostic). In `range` mode a completed selection additionally emits `rangeComplete`.
   */
  selectionMode = input<string>('single');
  /**
   * Inclusive lower bound as an ISO `YYYY-MM-DD` string. Days before it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no lower bound.
   */
  min = input<(string) | null>(null);
  /**
   * Inclusive upper bound as an ISO `YYYY-MM-DD` string. Days after it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no upper bound.
   */
  max = input<(string) | null>(null);
  /**
   * An array of ISO `YYYY-MM-DD` strings to disable individually (e.g. holidays or already-booked days), in addition to the `min`/`max` bounds. Disabled days are non-interactive and marked `aria-disabled`.
   */
  disabledDates = input<any[]>((() => [])());
  /**
   * The first day of the week as a number, `0` = Sunday through `6` = Saturday. Rotates both the weekday header row and the grid columns (e.g. `1` for a Monday-first calendar).
   */
  weekStartsOn = input<number>(0);
  /**
   * Disable the entire control — every day cell and the previous/next month buttons become non-interactive and are marked `aria-disabled`. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * BCP-47 locale tag used by `Intl.DateTimeFormat` to render the month-year heading and the short weekday header labels (e.g. `"fr-FR"`, `"ja-JP"`). Falls back to English names in a runtime without `Intl`.
   */
  locale = input<string>('en-US');
  /**
   * Quick-pick presets for `range` mode — an array of `{ label, range }` where `range` is a literal `{ start, end }` value **or** a `() => { start, end }` thunk (the consumer owns the date math and i18n labels). Renders a default preset rail beneath the grid; the `#presets` slot overrides it. **Lit caveat:** pass via a *property* binding (`.presetRanges=${[…]}`) — thunks inside the array cannot survive a string attribute, same as `disabledDates`.
   */
  presetRanges = input<any[]>((() => [])());
  viewIso = signal('');
  hoverIso = signal('');
  root = viewChild<ElementRef<HTMLDivElement>>('root');
  change = output<unknown>();
  rangeComplete = output<unknown>();
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('presets', { read: TemplateRef }) presetsTpl?: TemplateRef<PresetsCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  ngAfterViewInit() {
    this.viewIso.set(this.viewMonthGrid());
  }

  todayIso = () => {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  };
  selected = () => typeof this.value() === 'string' ? this.value() : '';
  readRange = () => normalizeRange(this.value());
  viewMonthGrid = () => resolveViewIso({
    viewIso: this.viewIso(),
    value: this.selected(),
    today: this.todayIso()
  });
  grid = () => buildMonthGrid({
    viewIso: this.viewMonthGrid(),
    value: this.selected(),
    today: this.todayIso(),
    min: this.min(),
    max: this.max(),
    disabledDates: this.disabledDates(),
    weekStartsOn: this.weekStartsOn(),
    disabled: (this.disabled() || this.__rozieCvaDisabled()),
    selection: this.selectionMode() === 'range' ? this.readRange() : undefined,
    previewEnd: this.selectionMode() === 'range' ? this.hoverIso() : undefined
  });
  dayTabIndex = (day: any): number | undefined => day.selected || this.selected() === '' && day.today ? 0 : -1;
  monthHeading = () => monthLabel(this.viewMonthGrid(), this.locale());
  weekdays = () => weekdayLabels(this.weekStartsOn(), this.locale());
  dayEnabled = (iso: any) => !isDayDisabled(iso, {
    viewIso: this.viewMonthGrid(),
    value: this.selected(),
    today: this.todayIso(),
    min: this.min(),
    max: this.max(),
    disabledDates: this.disabledDates(),
    weekStartsOn: this.weekStartsOn(),
    disabled: (this.disabled() || this.__rozieCvaDisabled())
  });
  commitValue = (iso: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    if (!isIsoDate(iso)) return;
    if (!this.dayEnabled(iso)) return;
    if (iso === this.selected()) return;
    this.value.set(iso), this.__rozieCvaOnChange(iso);
    this.viewIso.set(iso);
    this.change.emit({
      value: iso
    });
  };
  commitRange = (iso: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    if (!isIsoDate(iso)) return;
    if (!this.dayEnabled(iso)) return;
    const r = this.readRange();
    if (r.start === '' || r.end !== '') {
      // No in-progress selection, or a completed one → (re)start the anchor.
      this.value.set({
        start: iso,
        end: ''
      }), this.__rozieCvaOnChange({
        start: iso,
        end: ''
      });
      this.viewIso.set(iso);
      this.change.emit({
        value: {
          start: iso,
          end: ''
        }
      });
    } else {
      // Anchor set, end empty → complete the range (ordered by normalizeRange).
      const next = normalizeRange({
        start: r.start,
        end: iso
      });
      this.value.set(next), this.__rozieCvaOnChange(next);
      this.viewIso.set(iso);
      this.hoverIso.set('');
      this.change.emit({
        value: next
      });
      this.rangeComplete.emit({
        value: next
      });
    }
  };
  onDayHover = (iso: any) => {
    if (this.selectionMode() !== 'range') return;
    const r = this.readRange();
    if (r.start !== '' && r.end === '') this.hoverIso.set(iso);
  };
  onDaySelect = (iso: any) => {
    if (this.selectionMode() === 'range') this.commitRange(iso);else this.commitValue(iso);
  };
  goToMonth = (delta: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.viewIso.set(addMonths(this.viewMonthGrid(), delta));
  };
  goPrevMonth = () => this.goToMonth(-1);
  goNextMonth = () => this.goToMonth(1);
  dayCells = () => {
    const root = this.root()?.nativeElement;
    if (!root) return [];
    return Array.from(root.querySelectorAll('[data-day]')) as HTMLElement[];
  };
  focusDayIso = (iso: any) => {
    const cells = this.dayCells();
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].getAttribute('data-day') === iso) {
        cells[i].focus();
        return;
      }
    }
  };
  moveFocus = (fromIso: any, days: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const next = addDays(fromIso, days);
    const g = this.grid();
    // If `next` is not in the rendered weeks, swing the view to its month first.
    const present = g.weeks.some((row: any) => row.some((d: any) => d.iso === next));
    if (!present) this.viewIso.set(next);
    this.focusDayIso(next);
  };
  onDayKeydown = (iso: any, e: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const key = e ? e.key : '';
    if (key === 'ArrowLeft') {
      e.preventDefault();
      this.moveFocus(iso, -1);
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      this.moveFocus(iso, 1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      this.moveFocus(iso, -7);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      this.moveFocus(iso, 7);
    } else if (key === 'Home') {
      e.preventDefault();
      this.moveFocus(iso, -this.weekdayOffset(iso));
    } else if (key === 'End') {
      e.preventDefault();
      this.moveFocus(iso, 6 - this.weekdayOffset(iso));
    } else if (key === 'PageUp') {
      e.preventDefault();
      this.moveFocus(iso, 0 - this.daysInMonthSpan(iso, -1));
    } else if (key === 'PageDown') {
      e.preventDefault();
      this.moveFocus(iso, this.daysInMonthSpan(iso, 1));
    } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      this.onDaySelect(iso);
    } else if (key === 'Escape') {
      // In range mode, cancel an in-progress (anchor-set) selection.
      if (this.selectionMode() === 'range') {
        const r = this.readRange();
        if (r.start !== '' && r.end === '') {
          e.preventDefault();
          this.value.set({
            start: '',
            end: ''
          }), this.__rozieCvaOnChange({
            start: '',
            end: ''
          });
          this.hoverIso.set('');
          this.change.emit({
            value: {
              start: '',
              end: ''
            }
          });
        }
      }
    }
  };
  weekdayOffset = (iso: any) => {
    const g = this.grid();
    for (const row of g.weeks as any) {
      for (let c = 0; c < row.length; c++) {
        if (row[c].iso === iso) return c;
      }
    }
    return 0;
  };
  daysInMonthSpan = (iso: any, dir: any) => {
    const a = this.isoToMs(iso);
    const b = this.isoToMs(addMonths(iso, dir));
    return Math.round((b - a) / 86400000);
  };
  isoToMs = (iso: any) => {
    const t = isIsoDate(iso) ? Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : 0;
    return t;
  };
  resolvedPresets = () => this.presetRanges().map((p: any) => ({
    label: p.label,
    range: rangeFromPreset(p)
  }));
  applyPreset = (range: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const next = normalizeRange(range);
    this.value.set(next), this.__rozieCvaOnChange(next);
    this.hoverIso.set('');
    this.change.emit({
      value: next
    });
    this.rangeComplete.emit({
      value: next
    });
  };
  isPresetActive = (range: any) => {
    const p = normalizeRange(range);
    if (p.start === '') return false;
    const r = this.readRange();
    return r.start === p.start && r.end === p.end;
  };
  focus = () => {
    const sel = this.selected();
    const t = this.todayIso();
    const g = this.grid();
    const present = (iso: any) => g.weeks.some((row: any) => row.some((d: any) => d.iso === iso));
    if (sel && present(sel)) {
      this.focusDayIso(sel);
    } else if (present(t)) {
      this.focusDayIso(t);
    } else {
      const first = g.weeks[0] && g.weeks[0][0] ? g.weeks[0][0].iso : '';
      if (first) this.focusDayIso(first);
    }
  };
  goToToday = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.viewIso.set(this.todayIso());
  };
  clear = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    if (this.selectionMode() === 'range') {
      const r = this.readRange();
      if (r.start === '' && r.end === '') return;
      this.value.set({
        start: '',
        end: ''
      }), this.__rozieCvaOnChange({
        start: '',
        end: ''
      });
      this.hoverIso.set('');
      this.change.emit({
        value: {
          start: '',
          end: ''
        }
      });
    } else {
      if (this.selected() === '') return;
      this.value.set(''), this.__rozieCvaOnChange('');
      this.change.emit({
        value: ''
      });
    }
  };

  private __rozieCvaOnChange: (v: string | Record<string, any>) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: string | Record<string, any> | null): void {
    this.value.set(v ?? '');
  }
  registerOnChange(fn: (v: string | Record<string, any>) => void): void {
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
    _dir: DatePicker,
    _ctx: unknown,
  ): _ctx is HeaderCtx | PresetsCtx {
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

export default DatePicker;
