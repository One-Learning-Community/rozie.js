import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { RozieSlot } from '@rozie/runtime-angular';
import { createKeynavStateMachine, type KeynavStateMachine, focusIsWithinScope } from '@rozie/runtime-keynav-core';

import { addMonths, buildMonthGrid, buildMonthList, buildYearGrid, dayLabel, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, rangeSpansDisabled, resolveLabel, resolveRovingDayIndex, resolveRovingDrillIndex, resolveViewIso, ROVING_DAY_NONE, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

interface HeaderCtx {
  $implicit: { label: any; prev: any; next: any; disabled: any; openMonths: any; openYears: any; closeDrill: any; viewMode: any };
  label: any;
  prev: any;
  next: any;
  disabled: any;
  openMonths: any;
  openYears: any;
  closeDrill: any;
  viewMode: any;
}

interface FooterCtx {
  $implicit: { today: any; clear: any; todayIso: any };
  today: any;
  clear: any;
  todayIso: any;
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

    <div class="rozie-datepicker" [ngClass]="{ 'rozie-datepicker--disabled': (disabled() || this.__rozieCvaDisabled()), 'rozie-datepicker--multi': numberOfMonths() > 1 }" #root role="group" [attr.aria-label]="rozieAttr(labelFor('root'))" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" #rozieSpread_0 #rozieListenersTarget_1>
      
      @if ((headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])) {
    <ng-container *ngTemplateOutlet="(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header']); context: { $implicit: { label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!disabled(), openMonths: enterMonthsView, openYears: enterYearsView, closeDrill: exitToDaysView, viewMode: viewMode() }, label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!disabled(), openMonths: enterMonthsView, openYears: enterYearsView, closeDrill: exitToDaysView, viewMode: viewMode() }" />
    } @else {

        <div class="rozie-datepicker-header">
          <button type="button" class="rozie-datepicker-nav rozie-datepicker-prev" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="rozieAttr(labelFor('previousMonth'))" (click)="goPrevMonth()">‹</button>
          @if (monthYearNav()) {
    <button type="button" class="rozie-datepicker-heading rozie-datepicker-heading-button" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="rozieAttr(labelFor('changeMonthYear'))" aria-live="polite" (click)="enterMonthsView()">{{ rozieDisplay(monthHeading()) }}</button>
    } @else {
    <span class="rozie-datepicker-heading" aria-live="polite">{{ rozieDisplay(monthHeading()) }}</span>
    }<button type="button" class="rozie-datepicker-nav rozie-datepicker-next" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="rozieAttr(labelFor('nextMonth'))" (click)="goNextMonth()">›</button>
        </div>
      
    }

      
      <div class="rozie-datepicker-grids" #__rozieKeynavRootRef>
        @for (g of daysGrids(); track g.year + '-' + g.month; let gi = $index) {
    <div class="rozie-datepicker-grid" role="grid" [attr.aria-label]="rozieAttr(panelHeading(gi))" (mouseleave)="hoverIso.set('')">
          <div class="rozie-datepicker-weekdays" role="row">
            @for (wd of weekdays(); track wi; let wi = $index) {
    <span class="rozie-datepicker-weekday" role="columnheader" [attr.aria-label]="rozieAttr(weekdaysLong()[wi])">{{ rozieDisplay(wd) }}</span>
    }
          </div>

          @for (week of g.weeks; track week[0].iso; let wk = $index) {
    <div class="rozie-datepicker-week" role="row">
            
            @for (day of week; track day.iso; let dc = $index) {
    <span class="rozie-datepicker-cell" role="gridcell" [attr.aria-selected]="!!(day.selected || day.rangeStart || day.rangeEnd)">
              <button type="button" class="rozie-datepicker-day" [ngClass]="{ 'is-selected': day.selected, 'is-today': day.today, 'is-outside': !day.inMonth, 'is-in-range': day.inRange, 'is-range-start': day.rangeStart, 'is-range-end': day.rangeEnd, 'is-in-preview': day.inPreview }" [attr.data-day]="rozieAttr(day.iso)" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!day.disabled" [attr.aria-label]="rozieAttr(dayAria(day.iso))" [attr.aria-current]="rozieAttr(day.today ? 'date' : null)" (mouseenter)="onDayHover(day.iso)" (focus)="onDayHover(day.iso)" (keydown)="onDayCellKeydown(day.iso, $event)" [id]="\`\${__rozieKeynavGroupId}-item-\${gi * 42 + wk * 7 + dc}\`" [attr.data-rozie-keynav-item]="gi * 42 + wk * 7 + dc" [attr.data-rozie-keynav-active]="activeDay() === gi * 42 + wk * 7 + dc ? '' : undefined" [tabIndex]="activeDay() === gi * 42 + wk * 7 + dc ? 0 : -1">{{ rozieDisplay(day.day) }}</button>
            </span>
    }
          </div>
    }
        </div>
    }
      </div>

      
      @if (showsMonthsView()) {
    <div class="rozie-datepicker-months">
        <div class="rozie-datepicker-drill-header">
          <button type="button" class="rozie-datepicker-drill-label" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="rozieAttr(labelFor('changeYear'))" (click)="enterYearsView()">{{ rozieDisplay(monthList().year) }}</button>
        </div>
        <div class="rozie-datepicker-drill-grid" role="grid" [attr.aria-label]="rozieAttr(labelFor('chooseMonth'))" #__rozieKeynavRootRef1>
          @for (cell of monthList().months; track cell.iso) {
    <button type="button" class="rozie-datepicker-month" [ngClass]="{ 'is-selected': cell.selected, 'is-current': cell.current }" role="gridcell" [attr.data-month]="rozieAttr(cell.iso)" [attr.aria-disabled]="!!cell.disabled" [attr.aria-selected]="!!cell.selected" (click)="selectMonth(cell.iso)" (keydown)="onMonthCellKeydown(cell.iso, $event)" [id]="\`\${__rozieKeynavGroupId1}-item-\${$index}\`" [attr.data-rozie-keynav-item]="$index" [attr.data-rozie-keynav-active]="activeMonth() === $index ? '' : undefined" [tabIndex]="activeMonth() === $index ? 0 : -1">{{ rozieDisplay(cell.label) }}</button>
    }
        </div>
      </div>
    }@if (showsYearsView()) {
    <div class="rozie-datepicker-years">
        <div class="rozie-datepicker-drill-header">
          <span class="rozie-datepicker-drill-label" aria-live="polite">{{ rozieDisplay(yearRangeLabel()) }}</span>
        </div>
        <div class="rozie-datepicker-drill-grid" role="grid" [attr.aria-label]="rozieAttr(labelFor('chooseYear'))" #__rozieKeynavRootRef2>
          @for (cell of yearGrid().years; track cell.iso) {
    <button type="button" class="rozie-datepicker-year" [ngClass]="{ 'is-selected': cell.selected, 'is-current': cell.current }" role="gridcell" [attr.data-year]="rozieAttr(cell.iso)" [attr.aria-disabled]="!!cell.disabled" [attr.aria-selected]="!!cell.selected" (click)="selectYear(cell.iso)" (keydown)="onYearCellKeydown(cell.iso, $event)" [id]="\`\${__rozieKeynavGroupId2}-item-\${$index}\`" [attr.data-rozie-keynav-item]="$index" [attr.data-rozie-keynav-active]="activeYear() === $index ? '' : undefined" [tabIndex]="activeYear() === $index ? 0 : -1">{{ rozieDisplay(cell.year) }}</button>
    }
        </div>
      </div>
    }@if ((footerTpl ?? __rozieFillMap()['footer'] ?? templates()?.['footer'])) {
    <ng-container *ngTemplateOutlet="(footerTpl ?? __rozieFillMap()['footer'] ?? templates()?.['footer']); context: { $implicit: { today: selectToday, clear: clear, todayIso: todayIso() }, today: selectToday, clear: clear, todayIso: todayIso() }" />
    } @else {

        @if (showsFooter()) {
    <div class="rozie-datepicker-footer">
          <button type="button" class="rozie-datepicker-footer-btn rozie-datepicker-today" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" (click)="selectToday()">{{ rozieDisplay(labelFor('today')) }}</button>
          <button type="button" class="rozie-datepicker-footer-btn rozie-datepicker-clear" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" (click)="clear()">{{ rozieDisplay(labelFor('clear')) }}</button>
        </div>
    }
    }

      
      @if ((presetsTpl ?? __rozieFillMap()['presets'] ?? templates()?.['presets'])) {
    <ng-container *ngTemplateOutlet="(presetsTpl ?? __rozieFillMap()['presets'] ?? templates()?.['presets']); context: { $implicit: { presets: resolvedPresets(), apply: applyPreset }, presets: resolvedPresets(), apply: applyPreset }" />
    } @else {

        @if (hasPresets()) {
    <div class="rozie-datepicker-presets" role="group" [attr.aria-label]="rozieAttr(labelFor('presets'))">
          @for (p of resolvedPresets(); track p.label) {
    <button type="button" class="rozie-datepicker-preset" [ngClass]="{ 'is-active': isPresetActive(p.range) }" [attr.aria-pressed]="!!isPresetActive(p.range)" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" (click)="applyPreset(p.range)">{{ rozieDisplay(p.label) }}</button>
    }
        </div>
    }
    }
    </div>

  `,
  styles: [`
    :host(rozie-date-picker) { display: contents; }
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
    .rozie-datepicker-grids {
      display: contents;
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
    .rozie-datepicker-day:hover:not([aria-disabled='true']) {
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
    .rozie-datepicker-day.is-selected:hover:not([aria-disabled='true']),
    .rozie-datepicker-day.is-range-start:hover:not([aria-disabled='true']),
    .rozie-datepicker-day.is-range-end:hover:not([aria-disabled='true']) {
      color: var(--rozie-datepicker-selected-fg, #fff);
      background: var(--rozie-datepicker-selected-hover-bg, color-mix(in srgb, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)) 85%, #000));
      border-color: var(--rozie-datepicker-selected-hover-bg, color-mix(in srgb, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)) 85%, #000));
    }
    .rozie-datepicker-day[aria-disabled='true'] {
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
    .rozie-datepicker-drill-header {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--rozie-datepicker-drill-header-gap, 0.5rem);
    }
    .rozie-datepicker-drill-label {
      font: inherit;
      font-weight: var(--rozie-datepicker-heading-weight, 600);
      font-size: var(--rozie-datepicker-heading-size, 0.95rem);
      color: inherit;
      background: var(--rozie-datepicker-drill-label-bg, transparent);
      border: var(--rozie-datepicker-border-width, 1px) solid transparent;
      border-radius: var(--rozie-datepicker-nav-radius, 6px);
      padding: var(--rozie-datepicker-drill-label-padding, 0.15rem 0.5rem);
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, border-color 0.12s;
    }
    .rozie-datepicker-drill-label:hover {
      background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
    }
    .rozie-datepicker-drill-label:focus-visible {
      outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
      outline-offset: var(--rozie-datepicker-ring-offset, 1px);
    }
    .rozie-datepicker-heading-button {
      font: inherit;
      color: inherit;
      background: var(--rozie-datepicker-drill-label-bg, transparent);
      border: var(--rozie-datepicker-border-width, 1px) solid transparent;
      border-radius: var(--rozie-datepicker-nav-radius, 6px);
      padding: var(--rozie-datepicker-drill-label-padding, 0.15rem 0.5rem);
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, border-color 0.12s;
    }
    .rozie-datepicker-heading-button:hover {
      background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
    }
    .rozie-datepicker-months .rozie-datepicker-drill-grid,
    .rozie-datepicker-years .rozie-datepicker-drill-grid {
      display: grid;
      grid-template-columns: repeat(var(--rozie-datepicker-drill-cols, 3), 1fr);
      gap: var(--rozie-datepicker-drill-gap, 0.25rem);
    }
    .rozie-datepicker-month,
    .rozie-datepicker-year {
      box-sizing: border-box;
      height: var(--rozie-datepicker-drill-cell-height, 2.5rem);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font: inherit;
      font-size: var(--rozie-datepicker-drill-cell-size, 0.85rem);
      color: inherit;
      background: var(--rozie-datepicker-day-bg, transparent);
      border: var(--rozie-datepicker-day-border-width, 1px) solid transparent;
      border-radius: var(--rozie-datepicker-day-radius, 6px);
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .rozie-datepicker-month:hover:not([aria-disabled='true']),
    .rozie-datepicker-year:hover:not([aria-disabled='true']) {
      background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
    }
    .rozie-datepicker-month.is-current:not(.is-selected),
    .rozie-datepicker-year.is-current:not(.is-selected) {
      border-color: var(--rozie-datepicker-today-border, var(--rozie-datepicker-accent, #0066cc));
    }
    .rozie-datepicker-month.is-selected,
    .rozie-datepicker-year.is-selected {
      color: var(--rozie-datepicker-selected-fg, #fff);
      background: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
      border-color: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
      font-weight: var(--rozie-datepicker-selected-weight, 600);
    }
    .rozie-datepicker-month:focus-visible,
    .rozie-datepicker-year:focus-visible {
      outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
      outline-offset: var(--rozie-datepicker-ring-offset, 1px);
    }
    .rozie-datepicker-month[aria-disabled='true'],
    .rozie-datepicker-year[aria-disabled='true'] {
      cursor: not-allowed;
      opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
      pointer-events: none;
    }
    .rozie-datepicker-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--rozie-datepicker-footer-gap, 0.25rem);
      margin-top: var(--rozie-datepicker-footer-gap-top, 0.5rem);
    }
    .rozie-datepicker-footer-btn {
      font: inherit;
      font-size: var(--rozie-datepicker-footer-size, 0.78rem);
      color: var(--rozie-datepicker-footer-fg, inherit);
      background: var(--rozie-datepicker-footer-bg, transparent);
      border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
      border-radius: var(--rozie-datepicker-footer-radius, 6px);
      padding: var(--rozie-datepicker-footer-padding, 0.2rem 0.6rem);
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .rozie-datepicker-footer-btn:hover:not(:disabled) {
      background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
    }
    .rozie-datepicker-footer-btn:focus-visible {
      outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
      outline-offset: var(--rozie-datepicker-ring-offset, 1px);
    }
    .rozie-datepicker-footer-btn:disabled {
      cursor: not-allowed;
      opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
      pointer-events: none;
    }
    .rozie-datepicker--multi .rozie-datepicker-grid {
      display: inline-grid;
      vertical-align: top;
    }
    .rozie-datepicker--multi .rozie-datepicker-grid + .rozie-datepicker-grid {
      margin-left: var(--rozie-datepicker-month-gap, 1rem);
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
   * Optional overrides for the 10 static English "chrome" strings, keyed by `root`, `previousMonth`, `nextMonth`, `changeMonthYear`, `changeYear`, `chooseMonth`, `chooseYear`, `presets`, `today`, `clear` (defaults: `"Date picker"`, `"Previous month"`, `"Next month"`, `"Change month and year"`, `"Change year"`, `"Choose month"`, `"Choose year"`, `"Date range presets"`, `"Today"`, `"Clear"`). **Honest split:** `Intl` is a date/number formatter, not a message catalog — it can localize a DATE but cannot translate the phrase "Previous month". The day-cell accessible name, each multi-month panel's own grid caption, the weekday header long names, and the month-year heading text are already Intl-derived from the `locale` prop and are NOT `labels` keys; the 10 chrome phrases above are English-static and only `labels` can translate them. An empty object (the default) yields the English defaults with zero config. **Lit caveat:** pass via a *property* binding (`.labels=${…}`), never a string attribute — the same rule already in force for `disabledDates`/`presetRanges`.
   * @example
   * <DatePicker :labels="{ previousMonth: 'Mois précédent' }" locale="fr-FR" />
   */
  labels = input<Record<string, any>>((() => ({}))());
  /**
   * Quick-pick presets for `range` mode — an array of `{ label, range }` where `range` is a literal `{ start, end }` value **or** a `() => { start, end }` thunk (the consumer owns the date math and i18n labels). Renders a default preset rail beneath the grid; the `#presets` slot overrides it. **Lit caveat:** pass via a *property* binding (`.presetRanges=${[…]}`) — thunks inside the array cannot survive a string attribute, same as `disabledDates`.
   */
  presetRanges = input<any[]>((() => [])());
  /**
   * Render the month-year heading as a clickable drill **button** that navigates days → months → years (and a year label that drills months → years). **Capability-on:** this is the documented exception to the boolean-default-`false` rule — the drill navigation is the ergonomic win of this feature, so it defaults to `true`. Set `:month-year-nav="false"` to restore the static heading `<span>` (byte-identical to the pre-navigation output).
   */
  monthYearNav = input<boolean>(true);
  /**
   * How many month grids to render side by side, anchored at the view month and stepping forward (e.g. `2` for a two-up range calendar). `1` (the default) emits exactly the single-month markup with no extra wrapper element.
   */
  numberOfMonths = input<number>(1);
  /**
   * Render a Today / Clear footer row beneath the calendar grid. `Today` selects (single mode) or navigates to (range mode) the current date; `Clear` deselects. The `#footer` slot fully overrides the default row, receiving `{ today, clear, todayIso }`.
   */
  showFooter = input<boolean>(false);
  /**
   * An array of weekday indices to disable, `Number[]` where `0` = Sunday through `6` = Saturday (e.g. `[0, 6]` disables every weekend). Serializable, so it passes fine as a plain attribute. Threaded through the single gating funnel, so disabled weekdays are non-interactive, non-focusable, and marked `aria-disabled` — in agreement with day cells, drill enablement, and keyboard focus.
   */
  disabledDaysOfWeek = input<any[]>((() => [])());
  /**
   * A consumer predicate `(iso: string) => boolean` — return `true` to disable the given ISO `YYYY-MM-DD` date (e.g. custom holiday / blackout rules beyond `disabledDates`/`min`/`max`). Threaded through the single gating funnel so day cells, drill enablement, and focus all agree. **Lit caveat:** pass via a *property* binding (`.isDateDisabled=${fn}`), never a string attribute — a function cannot survive attribute serialization, the same rule already in force for `disabledDates`/`presetRanges`.
   */
  isDateDisabled = input<((...args: any[]) => any) | null>(null);
  viewIso = signal('');
  hoverIso = signal('');
  viewMode = signal('days');
  activeDay = signal(0);
  activeDayReal = signal(0);
  activeMonth = signal(0);
  activeYear = signal(0);
  root = viewChild<ElementRef<HTMLDivElement>>('root');
  change = output<unknown>();
  rangeComplete = output<unknown>();
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;
  @ContentChild('presets', { read: TemplateRef }) presetsTpl?: TemplateRef<PresetsCtx>;
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
  private __rozieKeynavGroupId = 'rozie-keynav-' + Math.random().toString(36).slice(2);
  private __rozieKeynavRootRef = viewChild<ElementRef<HTMLElement>>('__rozieKeynavRootRef');
  private __rozieKeynavRenderer = inject(Renderer2);
  private __rozieKeynavHostEl = inject(ElementRef);
  private __rozieKeynavController: KeynavStateMachine | null = null;
  private __rozieKeynavRafId: number | null = null;
  private __rozieKeynavAttachedRoot: HTMLElement | null = null;
  private __rozieKeynavDetach: (() => void) | null = null;
  private __rozieKeynavLastFocused: number | null = null;
  private __rozieKeynavHasInteracted = false;
  private __rozieKeynavApplyActive = (__rozieKeynavRootEl: HTMLElement, __rozieKeynavActive: number, __rozieKeynavMayApply: boolean): boolean => {
    const __rozieKeynavActiveEl = __rozieKeynavRootEl.querySelector<HTMLElement>(`[data-rozie-keynav-item="${__rozieKeynavActive}"]`);
    if (__rozieKeynavMayApply) __rozieKeynavActiveEl?.focus();
    if (__rozieKeynavMayApply) __rozieKeynavActiveEl?.scrollIntoView({ block: 'nearest' });
    return __rozieKeynavActiveEl !== null;
  };
  private __rozieKeynavSyncActive = () => {
    const __rozieKeynavActive = this.activeDay();
    const __rozieKeynavRootEl = this.__rozieKeynavRootRef()?.nativeElement;
    if (this.__rozieKeynavRafId !== null) { cancelAnimationFrame(this.__rozieKeynavRafId); this.__rozieKeynavRafId = null; }
    if (!__rozieKeynavRootEl || !Number.isFinite(__rozieKeynavActive)) return;
    const __rozieKeynavIsNav = this.__rozieKeynavHasInteracted && this.__rozieKeynavLastFocused !== null && this.__rozieKeynavLastFocused !== __rozieKeynavActive;
    const __rozieKeynavMayApply = __rozieKeynavIsNav || focusIsWithinScope([this.__rozieKeynavHostEl.nativeElement, __rozieKeynavRootEl], __rozieKeynavRootEl.ownerDocument);
    this.__rozieKeynavLastFocused = __rozieKeynavActive;
    const __rozieKeynavFound = this.__rozieKeynavApplyActive(__rozieKeynavRootEl, __rozieKeynavActive, __rozieKeynavMayApply);
    if (!__rozieKeynavFound) {
      this.__rozieKeynavRafId = requestAnimationFrame(() => {
        this.__rozieKeynavRafId = null;
        if (this.activeDay() !== __rozieKeynavActive) return;
        const __rozieKeynavRetryRootEl = this.__rozieKeynavRootRef()?.nativeElement;
        if (__rozieKeynavRetryRootEl) this.__rozieKeynavApplyActive(__rozieKeynavRetryRootEl, __rozieKeynavActive, __rozieKeynavMayApply);
      });
    }
  };
  private __rozieKeynavAttachRoot = () => {
    const __rozieKeynavRootEl = this.__rozieKeynavRootRef()?.nativeElement ?? null;
    if (__rozieKeynavRootEl === this.__rozieKeynavAttachedRoot) return;
    if (this.__rozieKeynavDetach) { this.__rozieKeynavDetach(); this.__rozieKeynavDetach = null; }
    this.__rozieKeynavLastFocused = null;
    this.__rozieKeynavHasInteracted = false;
    this.__rozieKeynavAttachedRoot = __rozieKeynavRootEl;
    if (!__rozieKeynavRootEl) return;
    const __rozieKeynavHandleKeydown = ($event: KeyboardEvent) => { this.__rozieKeynavHasInteracted = true; this.__rozieKeynavController?.onKeydown($event); };
    const __rozieKeynavHandlePointer = ($event: PointerEvent) => {
      this.__rozieKeynavHasInteracted = true;
      const __rozieKeynavTarget = $event.target;
      if (!(__rozieKeynavTarget instanceof Element)) return;
      const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');
      if (!__rozieKeynavMarker) return;
      const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');
      if (__rozieKeynavRaw === null) return;
      const __rozieKeynavIdx = Number(__rozieKeynavRaw);
      if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;
      this.__rozieKeynavController?.onPointerActivate(__rozieKeynavIdx);
    };
    const __rozieKeynavHandleFocusIn = ($event: FocusEvent) => {
      this.__rozieKeynavHasInteracted = true;
      const __rozieKeynavTarget = $event.target;
      if (!(__rozieKeynavTarget instanceof Element)) return;
      const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');
      if (!__rozieKeynavMarker) return;
      const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');
      if (__rozieKeynavRaw === null) return;
      const __rozieKeynavIdx = Number(__rozieKeynavRaw);
      if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;
      this.__rozieKeynavController?.moveTo(__rozieKeynavIdx);
    };
    const __rozieKeynavUnlistenKeydown = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'keydown', __rozieKeynavHandleKeydown);
    const __rozieKeynavUnlistenPointer = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'pointerdown', __rozieKeynavHandlePointer);
    const __rozieKeynavUnlistenFocusIn = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'focusin', __rozieKeynavHandleFocusIn);
    this.__rozieKeynavDetach = () => {
      __rozieKeynavUnlistenKeydown();
      __rozieKeynavUnlistenPointer();
      __rozieKeynavUnlistenFocusIn();
    };
  };
  private __rozieKeynavGroupId1 = 'rozie-keynav-' + Math.random().toString(36).slice(2);
  private __rozieKeynavRootRef1 = viewChild<ElementRef<HTMLElement>>('__rozieKeynavRootRef1');
  private __rozieKeynavController1: KeynavStateMachine | null = null;
  private __rozieKeynavRafId1: number | null = null;
  private __rozieKeynavAttachedRoot1: HTMLElement | null = null;
  private __rozieKeynavDetach1: (() => void) | null = null;
  private __rozieKeynavLastFocused1: number | null = null;
  private __rozieKeynavHasInteracted1 = false;
  private __rozieKeynavApplyActive1 = (__rozieKeynavRootEl: HTMLElement, __rozieKeynavActive: number, __rozieKeynavMayApply: boolean): boolean => {
    const __rozieKeynavActiveEl = __rozieKeynavRootEl.querySelector<HTMLElement>(`[data-rozie-keynav-item="${__rozieKeynavActive}"]`);
    if (__rozieKeynavMayApply) __rozieKeynavActiveEl?.focus();
    if (__rozieKeynavMayApply) __rozieKeynavActiveEl?.scrollIntoView({ block: 'nearest' });
    return __rozieKeynavActiveEl !== null;
  };
  private __rozieKeynavSyncActive1 = () => {
    const __rozieKeynavActive = this.activeMonth();
    const __rozieKeynavRootEl = this.__rozieKeynavRootRef1()?.nativeElement;
    if (this.__rozieKeynavRafId1 !== null) { cancelAnimationFrame(this.__rozieKeynavRafId1); this.__rozieKeynavRafId1 = null; }
    if (!__rozieKeynavRootEl || !Number.isFinite(__rozieKeynavActive)) return;
    const __rozieKeynavIsNav = this.__rozieKeynavHasInteracted1 && this.__rozieKeynavLastFocused1 !== null && this.__rozieKeynavLastFocused1 !== __rozieKeynavActive;
    const __rozieKeynavMayApply = __rozieKeynavIsNav || focusIsWithinScope([this.__rozieKeynavHostEl.nativeElement, __rozieKeynavRootEl], __rozieKeynavRootEl.ownerDocument);
    this.__rozieKeynavLastFocused1 = __rozieKeynavActive;
    const __rozieKeynavFound = this.__rozieKeynavApplyActive1(__rozieKeynavRootEl, __rozieKeynavActive, __rozieKeynavMayApply);
    if (!__rozieKeynavFound) {
      this.__rozieKeynavRafId1 = requestAnimationFrame(() => {
        this.__rozieKeynavRafId1 = null;
        if (this.activeMonth() !== __rozieKeynavActive) return;
        const __rozieKeynavRetryRootEl = this.__rozieKeynavRootRef1()?.nativeElement;
        if (__rozieKeynavRetryRootEl) this.__rozieKeynavApplyActive1(__rozieKeynavRetryRootEl, __rozieKeynavActive, __rozieKeynavMayApply);
      });
    }
  };
  private __rozieKeynavAttachRoot1 = () => {
    const __rozieKeynavRootEl = this.__rozieKeynavRootRef1()?.nativeElement ?? null;
    if (__rozieKeynavRootEl === this.__rozieKeynavAttachedRoot1) return;
    if (this.__rozieKeynavDetach1) { this.__rozieKeynavDetach1(); this.__rozieKeynavDetach1 = null; }
    this.__rozieKeynavLastFocused1 = null;
    this.__rozieKeynavHasInteracted1 = false;
    this.__rozieKeynavAttachedRoot1 = __rozieKeynavRootEl;
    if (!__rozieKeynavRootEl) return;
    const __rozieKeynavHandleKeydown = ($event: KeyboardEvent) => { this.__rozieKeynavHasInteracted1 = true; this.__rozieKeynavController1?.onKeydown($event); };
    const __rozieKeynavHandlePointer = ($event: PointerEvent) => {
      this.__rozieKeynavHasInteracted1 = true;
      const __rozieKeynavTarget = $event.target;
      if (!(__rozieKeynavTarget instanceof Element)) return;
      const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');
      if (!__rozieKeynavMarker) return;
      const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');
      if (__rozieKeynavRaw === null) return;
      const __rozieKeynavIdx = Number(__rozieKeynavRaw);
      if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;
      this.__rozieKeynavController1?.onPointerActivate(__rozieKeynavIdx);
    };
    const __rozieKeynavHandleFocusIn = ($event: FocusEvent) => {
      this.__rozieKeynavHasInteracted1 = true;
      const __rozieKeynavTarget = $event.target;
      if (!(__rozieKeynavTarget instanceof Element)) return;
      const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');
      if (!__rozieKeynavMarker) return;
      const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');
      if (__rozieKeynavRaw === null) return;
      const __rozieKeynavIdx = Number(__rozieKeynavRaw);
      if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;
      this.__rozieKeynavController1?.moveTo(__rozieKeynavIdx);
    };
    const __rozieKeynavUnlistenKeydown = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'keydown', __rozieKeynavHandleKeydown);
    const __rozieKeynavUnlistenPointer = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'pointerdown', __rozieKeynavHandlePointer);
    const __rozieKeynavUnlistenFocusIn = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'focusin', __rozieKeynavHandleFocusIn);
    this.__rozieKeynavDetach1 = () => {
      __rozieKeynavUnlistenKeydown();
      __rozieKeynavUnlistenPointer();
      __rozieKeynavUnlistenFocusIn();
    };
  };
  private __rozieKeynavGroupId2 = 'rozie-keynav-' + Math.random().toString(36).slice(2);
  private __rozieKeynavRootRef2 = viewChild<ElementRef<HTMLElement>>('__rozieKeynavRootRef2');
  private __rozieKeynavController2: KeynavStateMachine | null = null;
  private __rozieKeynavRafId2: number | null = null;
  private __rozieKeynavAttachedRoot2: HTMLElement | null = null;
  private __rozieKeynavDetach2: (() => void) | null = null;
  private __rozieKeynavLastFocused2: number | null = null;
  private __rozieKeynavHasInteracted2 = false;
  private __rozieKeynavApplyActive2 = (__rozieKeynavRootEl: HTMLElement, __rozieKeynavActive: number, __rozieKeynavMayApply: boolean): boolean => {
    const __rozieKeynavActiveEl = __rozieKeynavRootEl.querySelector<HTMLElement>(`[data-rozie-keynav-item="${__rozieKeynavActive}"]`);
    if (__rozieKeynavMayApply) __rozieKeynavActiveEl?.focus();
    if (__rozieKeynavMayApply) __rozieKeynavActiveEl?.scrollIntoView({ block: 'nearest' });
    return __rozieKeynavActiveEl !== null;
  };
  private __rozieKeynavSyncActive2 = () => {
    const __rozieKeynavActive = this.activeYear();
    const __rozieKeynavRootEl = this.__rozieKeynavRootRef2()?.nativeElement;
    if (this.__rozieKeynavRafId2 !== null) { cancelAnimationFrame(this.__rozieKeynavRafId2); this.__rozieKeynavRafId2 = null; }
    if (!__rozieKeynavRootEl || !Number.isFinite(__rozieKeynavActive)) return;
    const __rozieKeynavIsNav = this.__rozieKeynavHasInteracted2 && this.__rozieKeynavLastFocused2 !== null && this.__rozieKeynavLastFocused2 !== __rozieKeynavActive;
    const __rozieKeynavMayApply = __rozieKeynavIsNav || focusIsWithinScope([this.__rozieKeynavHostEl.nativeElement, __rozieKeynavRootEl], __rozieKeynavRootEl.ownerDocument);
    this.__rozieKeynavLastFocused2 = __rozieKeynavActive;
    const __rozieKeynavFound = this.__rozieKeynavApplyActive2(__rozieKeynavRootEl, __rozieKeynavActive, __rozieKeynavMayApply);
    if (!__rozieKeynavFound) {
      this.__rozieKeynavRafId2 = requestAnimationFrame(() => {
        this.__rozieKeynavRafId2 = null;
        if (this.activeYear() !== __rozieKeynavActive) return;
        const __rozieKeynavRetryRootEl = this.__rozieKeynavRootRef2()?.nativeElement;
        if (__rozieKeynavRetryRootEl) this.__rozieKeynavApplyActive2(__rozieKeynavRetryRootEl, __rozieKeynavActive, __rozieKeynavMayApply);
      });
    }
  };
  private __rozieKeynavAttachRoot2 = () => {
    const __rozieKeynavRootEl = this.__rozieKeynavRootRef2()?.nativeElement ?? null;
    if (__rozieKeynavRootEl === this.__rozieKeynavAttachedRoot2) return;
    if (this.__rozieKeynavDetach2) { this.__rozieKeynavDetach2(); this.__rozieKeynavDetach2 = null; }
    this.__rozieKeynavLastFocused2 = null;
    this.__rozieKeynavHasInteracted2 = false;
    this.__rozieKeynavAttachedRoot2 = __rozieKeynavRootEl;
    if (!__rozieKeynavRootEl) return;
    const __rozieKeynavHandleKeydown = ($event: KeyboardEvent) => { this.__rozieKeynavHasInteracted2 = true; this.__rozieKeynavController2?.onKeydown($event); };
    const __rozieKeynavHandlePointer = ($event: PointerEvent) => {
      this.__rozieKeynavHasInteracted2 = true;
      const __rozieKeynavTarget = $event.target;
      if (!(__rozieKeynavTarget instanceof Element)) return;
      const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');
      if (!__rozieKeynavMarker) return;
      const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');
      if (__rozieKeynavRaw === null) return;
      const __rozieKeynavIdx = Number(__rozieKeynavRaw);
      if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;
      this.__rozieKeynavController2?.onPointerActivate(__rozieKeynavIdx);
    };
    const __rozieKeynavHandleFocusIn = ($event: FocusEvent) => {
      this.__rozieKeynavHasInteracted2 = true;
      const __rozieKeynavTarget = $event.target;
      if (!(__rozieKeynavTarget instanceof Element)) return;
      const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');
      if (!__rozieKeynavMarker) return;
      const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');
      if (__rozieKeynavRaw === null) return;
      const __rozieKeynavIdx = Number(__rozieKeynavRaw);
      if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;
      this.__rozieKeynavController2?.moveTo(__rozieKeynavIdx);
    };
    const __rozieKeynavUnlistenKeydown = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'keydown', __rozieKeynavHandleKeydown);
    const __rozieKeynavUnlistenPointer = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'pointerdown', __rozieKeynavHandlePointer);
    const __rozieKeynavUnlistenFocusIn = this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'focusin', __rozieKeynavHandleFocusIn);
    this.__rozieKeynavDetach2 = () => {
      __rozieKeynavUnlistenKeydown();
      __rozieKeynavUnlistenPointer();
      __rozieKeynavUnlistenFocusIn();
    };
  };
  private __rozieDestroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.__rozieKeynavAttachRoot();
    });
    effect(() => {
      this.__rozieKeynavSyncActive();
    });
    effect(() => {
      this.__rozieKeynavAttachRoot1();
    });
    effect(() => {
      this.__rozieKeynavSyncActive1();
    });
    effect(() => {
      this.__rozieKeynavAttachRoot2();
    });
    effect(() => {
      this.__rozieKeynavSyncActive2();
    });
  }

  ngAfterViewInit() {
    const nextViewIso = this.viewMonthGrid();
    this.viewIso.set(nextViewIso);
    this.seedActiveDay(nextViewIso);
    this.__rozieKeynavController = createKeynavStateMachine({
      getSource: () => (this.allDayCells()).map((day) => ({ disabled: day.disabled })),
      getActive: () => this.activeDay(),
      setActive: (i) => { this.activeDay.set(i); },
      commit: (i) => { this.onDayCommit(i); },
      page: (detail) => { this.onDayPage(detail); },
    }, { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false, grid: { columns: () => 7 } });
    this.__rozieKeynavAttachRoot();
    this.__rozieKeynavSyncActive();
    this.__rozieDestroyRef.onDestroy(() => {
      this.__rozieKeynavDetach?.();
      if (this.__rozieKeynavRafId !== null) cancelAnimationFrame(this.__rozieKeynavRafId);
      this.__rozieKeynavController?.dispose();
    });
    this.__rozieKeynavController1 = createKeynavStateMachine({
      getSource: () => (this.monthList().months).map((cell) => ({ label: cell.label, disabled: cell.disabled })),
      getActive: () => this.activeMonth(),
      setActive: (i) => { this.activeMonth.set(i); },
      commit: (i) => { this.onMonthCommit(i); },
      page: (detail) => { this.onDrillPage(); },
    }, { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false, grid: { columns: () => 3 } });
    this.__rozieKeynavAttachRoot1();
    this.__rozieKeynavSyncActive1();
    this.__rozieDestroyRef.onDestroy(() => {
      this.__rozieKeynavDetach1?.();
      if (this.__rozieKeynavRafId1 !== null) cancelAnimationFrame(this.__rozieKeynavRafId1);
      this.__rozieKeynavController1?.dispose();
    });
    this.__rozieKeynavController2 = createKeynavStateMachine({
      getSource: () => (this.yearGrid().years).map((cell) => ({ label: String(cell.year), disabled: cell.disabled })),
      getActive: () => this.activeYear(),
      setActive: (i) => { this.activeYear.set(i); },
      commit: (i) => { this.onYearCommit(i); },
      page: (detail) => { this.onDrillPage(); },
    }, { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false, grid: { columns: () => 3 } });
    this.__rozieKeynavAttachRoot2();
    this.__rozieKeynavSyncActive2();
    this.__rozieDestroyRef.onDestroy(() => {
      this.__rozieKeynavDetach2?.();
      if (this.__rozieKeynavRafId2 !== null) cancelAnimationFrame(this.__rozieKeynavRafId2);
      this.__rozieKeynavController2?.dispose();
    });
  }

  todayIso = () => {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  };
  selected = (): string => {
    const v = this.value();
    return typeof v === 'string' ? v : '';
  };
  readRange = () => normalizeRange(this.value());
  viewAnchor = (): string => {
    const s = this.selected();
    if (s !== '') return s;
    if (this.selectionMode() === 'range') return this.readRange().start;
    return '';
  };
  viewMonthGrid = (viewIsoOverride?: string) => resolveViewIso({
    viewIso: viewIsoOverride !== undefined ? viewIsoOverride : this.viewIso(),
    value: this.viewAnchor(),
    today: this.todayIso()
  });
  grid = () => buildMonthGrid({
    viewIso: this.viewMonthGrid(),
    value: this.selected(),
    today: this.todayIso(),
    min: this.min(),
    max: this.max(),
    disabledDates: this.disabledDates(),
    disabledDaysOfWeek: this.disabledDaysOfWeek(),
    isDateDisabled: this.isDateDisabled(),
    weekStartsOn: this.weekStartsOn(),
    disabled: (this.disabled() || this.__rozieCvaDisabled()),
    selection: this.selectionMode() === 'range' ? this.readRange() : undefined,
    previewEnd: this.selectionMode() === 'range' ? this.hoverIso() : undefined
  });
  grids = (viewIsoOverride?: string) => Array.from({
    length: this.numberOfMonths()
  }, (_: any, i: any) => buildMonthGrid({
    viewIso: addMonths(this.viewMonthGrid(viewIsoOverride), i),
    value: this.selected(),
    today: this.todayIso(),
    min: this.min(),
    max: this.max(),
    disabledDates: this.disabledDates(),
    disabledDaysOfWeek: this.disabledDaysOfWeek(),
    isDateDisabled: this.isDateDisabled(),
    weekStartsOn: this.weekStartsOn(),
    disabled: (this.disabled() || this.__rozieCvaDisabled()),
    selection: this.selectionMode() === 'range' ? this.readRange() : undefined,
    previewEnd: this.selectionMode() === 'range' ? this.hoverIso() : undefined
  }));
  monthList = () => buildMonthList(this.viewMonthGrid(), {
    min: this.min(),
    max: this.max(),
    value: this.selected(),
    today: this.todayIso(),
    locale: this.locale()
  });
  yearGrid = () => buildYearGrid(this.viewMonthGrid(), {
    min: this.min(),
    max: this.max(),
    value: this.selected(),
    today: this.todayIso()
  });
  yearRangeLabel = () => this.yearGrid().rangeLabel;
  daysGrids = (viewIsoOverride?: string, assumeDaysView?: boolean) => assumeDaysView || this.showsDaysView() ? this.grids(viewIsoOverride) : [];
  allDayCells = (viewIsoOverride?: string, assumeDaysView?: boolean) => this.daysGrids(viewIsoOverride, assumeDaysView).flatMap((g: any) => g.weeks.flatMap((row: any) => row));
  rovingDayInput = (viewIsoOverride?: string) => ({
    viewIso: this.viewMonthGrid(viewIsoOverride),
    value: this.selected(),
    today: this.todayIso(),
    min: this.min(),
    max: this.max(),
    disabledDates: this.disabledDates(),
    disabledDaysOfWeek: this.disabledDaysOfWeek(),
    isDateDisabled: this.isDateDisabled(),
    weekStartsOn: this.weekStartsOn(),
    disabled: (this.disabled() || this.__rozieCvaDisabled()),
    numberOfMonths: this.numberOfMonths(),
    anchor: this.selected() !== '' ? this.selected() : this.selectionMode() === 'range' ? this.readRange().start : ''
  });
  currentActiveDay = () => this.activeDay() === ROVING_DAY_NONE ? this.activeDayReal() : this.activeDay();
  seedActiveDay = (viewIsoOverride?: string, assumeDaysView?: boolean) => {
    const next = resolveRovingDayIndex(this.allDayCells(viewIsoOverride, assumeDaysView), this.rovingDayInput(viewIsoOverride));
    if (next === this.currentActiveDay()) {
      this.activeDay.set(ROVING_DAY_NONE);
    }
    // `activeDayReal` is updated SYNCHRONOUSLY (no rAF defer) — pure
    // bookkeeping, never read for DOM focus/UI, so it must always reflect the
    // latest INTENDED target the instant it's known, not one frame later.
    this.activeDayReal.set(next);
    requestAnimationFrame(() => {
      this.activeDay.set(next);
    });
  };
  monthHeading = () => monthLabel(this.viewMonthGrid(), this.locale());
  weekdays = () => weekdayLabels(this.weekStartsOn(), this.locale());
  labelFor = (key: any) => resolveLabel(this.labels(), key);
  dayAria = (iso: any) => dayLabel(iso, this.locale());
  weekdaysLong = () => weekdayLabels(this.weekStartsOn(), this.locale(), 'long');
  panelHeading = (i: any) => monthLabel(addMonths(this.viewMonthGrid(), i), this.locale());
  gateInput = () => ({
    viewIso: this.viewMonthGrid(),
    value: this.selected(),
    today: this.todayIso(),
    min: this.min(),
    max: this.max(),
    disabledDates: this.disabledDates(),
    disabledDaysOfWeek: this.disabledDaysOfWeek(),
    isDateDisabled: this.isDateDisabled(),
    weekStartsOn: this.weekStartsOn(),
    disabled: (this.disabled() || this.__rozieCvaDisabled())
  });
  dayEnabled = (iso: any) => !isDayDisabled(iso, this.gateInput());
  rangeSpanBlocked = (a: any, b: any) => rangeSpansDisabled(a, b, this.gateInput());
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
    if (r.start === '' || r.end !== '' || this.rangeSpanBlocked(r.start, iso)) {
      // No in-progress selection, a completed one, or a blocked span → (re)start the anchor.
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
      // Anchor set, end empty, span not blocked → complete the range (ordered by normalizeRange).
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
    if (r.start === '' || r.end !== '') return;
    if (!this.dayEnabled(iso) || this.rangeSpanBlocked(r.start, iso)) {
      this.hoverIso.set('');
      return;
    }
    this.hoverIso.set(iso);
  };
  onDaySelect = (iso: any) => {
    if (this.selectionMode() === 'range') this.commitRange(iso);else this.commitValue(iso);
  };
  goToMonth = (delta: any) => {
    const __viewMode = this.viewMode();
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const unit = __viewMode === 'years' ? 144 : __viewMode === 'months' ? 12 : 1;
    const nextViewIso = addMonths(this.viewMonthGrid(), delta * unit);
    this.viewIso.set(nextViewIso);
    // The rendered day set changed without going through the r-keynav page
    // mechanism (a direct header nav click) — reseed the tab stop (77-08).
    // Pass the freshly-computed viewIso directly (staleness fix, see
    // seedActiveDay's own doc comment) — $data.viewMode is UNCHANGED by this
    // function, so the live showsDaysView() read stays correct un-overridden.
    this.seedActiveDay(nextViewIso);
  };
  goPrevMonth = () => this.goToMonth(-1);
  goNextMonth = () => this.goToMonth(1);
  showsDaysView = (): boolean => this.viewMode() === 'days';
  showsMonthsView = (): boolean => this.viewMode() === 'months';
  showsYearsView = (): boolean => this.viewMode() === 'years';
  enterMonthsView = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.activeMonth.set(resolveRovingDrillIndex(this.monthList().months));
    this.viewMode.set('months');
  };
  enterYearsView = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.activeYear.set(resolveRovingDrillIndex(this.yearGrid().years));
    this.viewMode.set('years');
  };
  selectMonth = (iso: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    if (!isIsoDate(iso)) return;
    if (!this.monthEnabled(iso)) return;
    this.viewIso.set(iso);
    this.viewMode.set('days');
    // Both the view anchor AND the days-view transition are fresh in THIS
    // call — pass both explicitly (staleness fix, see seedActiveDay's own doc
    // comment).
    this.seedActiveDay(iso, true);
  };
  selectYear = (iso: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    if (!isIsoDate(iso)) return;
    if (!this.yearEnabled(iso)) return;
    this.viewIso.set(iso);
    this.viewMode.set('months');
    this.activeMonth.set(resolveRovingDrillIndex(this.monthList().months));
  };
  exitToDaysView = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.viewMode.set('days');
    // $data.viewIso is unchanged here (no fresher value to pass), but the
    // days-view transition IS fresh in THIS call — say so explicitly
    // (staleness fix, see seedActiveDay's own doc comment).
    this.seedActiveDay(undefined, true);
  };
  onDayCommit = (i: any) => {
    const cell = this.allDayCells()[i];
    if (cell) this.onDaySelect(cell.iso);
  };
  onDayPage = (detail: any) => {
    this.viewIso.set(addMonths(this.viewMonthGrid(), detail.direction));
    const nextCells = this.allDayCells();
    const current = this.currentActiveDay();
    const next = detail.reason === 'boundary' ? detail.direction > 0 ? 0 : nextCells.length - 1 : Math.min(current, nextCells.length - 1);
    if (next === current) {
      this.activeDay.set(ROVING_DAY_NONE);
    }
    this.activeDayReal.set(next);
    requestAnimationFrame(() => {
      this.activeDay.set(next);
    });
  };
  monthEnabled = (iso: any) => {
    const cell = this.monthList().months.find((m: any) => m.iso === iso);
    return !cell || !cell.disabled;
  };
  yearEnabled = (iso: any) => {
    const cell = this.yearGrid().years.find((y: any) => y.iso === iso);
    return !cell || !cell.disabled;
  };
  onDayCellKeydown = (iso: any, e: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
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
  onMonthCommit = (i: any) => {
    const cell = this.monthList().months[i];
    if (cell) this.selectMonth(cell.iso);
  };
  onYearCommit = (i: any) => {
    const cell = this.yearGrid().years[i];
    if (cell) this.selectYear(cell.iso);
  };
  onDrillPage = () => {};
  onMonthCellKeydown = (iso: any, e: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      this.selectMonth(iso);
    } else if (key === 'Escape') {
      e.preventDefault();
      this.exitToDaysView();
    }
  };
  onYearCellKeydown = (iso: any, e: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      this.selectYear(iso);
    } else if (key === 'Escape') {
      e.preventDefault();
      this.exitToDaysView();
    }
  };
  resolvedPresets = () => this.presetRanges().map((p: any) => ({
    label: p.label,
    range: rangeFromPreset(p)
  }));
  hasPresets = (): boolean => this.resolvedPresets().length > 0;
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
    this.seedActiveDay();
  };
  goToToday = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const nextViewIso = this.todayIso();
    this.viewIso.set(nextViewIso);
    // Fresh viewIso passed directly (staleness fix, see seedActiveDay's own
    // doc comment); $data.viewMode is unchanged here.
    this.seedActiveDay(nextViewIso);
  };
  selectToday = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    if (this.selectionMode() === 'range') {
      this.goToToday();
    } else {
      this.commitValue(this.todayIso());
    }
  };
  showsFooter = (): boolean => !!this.showFooter();
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
  ): _ctx is HeaderCtx | FooterCtx | PresetsCtx {
    return true;
  }

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
