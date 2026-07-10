import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import flatpickr from 'flatpickr';

@Component({
  selector: 'rozie-flatpickr',
  standalone: true,
  template: `

    <input #inputEl type="text" class="rozie-flatpickr" [name]="name()" [placeholder]="placeholder()" #rozieSpread_0 #rozieListenersTarget_1 />

  `,
  styles: [`
    :host(rozie-flatpickr) { display: contents; }
    .rozie-flatpickr {
      padding: 0.375rem 0.5rem;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      font: inherit;
      width: 100%;
      box-sizing: border-box;
    }
    .rozie-flatpickr:focus {
      outline: 2px solid rgba(0, 100, 255, 0.4);
      outline-offset: -1px;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Flatpickr),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Flatpickr {
  /**
   * The two-way value (`r-model:date`) — the **formatted string** flatpickr produces, not a `Date`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Consumers that need the parsed `Date[]` read them off the `change` event payload instead.
   * @example
   * <Flatpickr r-model:date="picked" @change="onChange" />
   */
  date = model<string>('');
  /**
   * Selection mode: `'single'`, `'multiple'`, `'range'`, or `'time'`. In `'range'` mode the two-way `date` commits per `commitOn`. Runtime-updatable via flatpickr's `set()`.
   */
  mode = input<string>('single');
  /**
   * flatpickr date-format token string controlling how the value is formatted and parsed. Runtime-updatable via `set()`.
   */
  dateFormat = input<string>('Y-m-d');
  /**
   * Show a human-readable alt input (formatted with `altFormat`) while submitting the machine-format value. flatpickr creates a hidden mirror input and moves the original `name` onto it. **Construction-time only** — re-key the component to retune live.
   */
  altInput = input<boolean>(false);
  /**
   * Format token string for the human-readable alt input (used only when `altInput` is on).
   */
  altFormat = input<string>('F j, Y');
  /**
   * Add a time picker alongside the calendar. **Construction-time only** — re-key the component to retune live.
   */
  enableTime = input<boolean>(false);
  /**
   * Add a seconds input to the time picker (used with `enableTime`).
   */
  enableSeconds = input<boolean>(false);
  /**
   * Display time in 24-hour format instead of the AM/PM clock.
   */
  time24hr = input<boolean>(false);
  /**
   * Hide the calendar to make a time-only picker (pair with `enableTime`). **Construction-time only** — re-key the component to retune live.
   */
  noCalendar = input<boolean>(false);
  /**
   * Earliest selectable date (a `dateFormat`-formatted string). Runtime-updatable via `set()`.
   */
  minDate = input<(string) | null>(null);
  /**
   * Latest selectable date (a `dateFormat`-formatted string). Runtime-updatable via `set()`.
   */
  maxDate = input<(string) | null>(null);
  /**
   * Placeholder text for the rendered input when no date is selected.
   */
  placeholder = input<string>('Select a date…');
  /**
   * Disable the underlying input so the picker cannot be opened or edited. On Angular it OR-merges with the form `setDisabledState`. Runtime-updatable.
   */
  disabled = input<boolean>(false);
  /**
   * When to commit the two-way `date` in `mode="range"`: `'complete'` (the default — only once both ends are picked) or `'change'` (on every click, including the partial first click). The `change` event always fires on every click regardless, so partial ranges are observable off the event without polluting the two-way value.
   */
  commitOn = input<string>('complete');
  /**
   * Verbatim flatpickr options pass-through for anything the named props do not cover. It is spread **after** the named props, so a key here overrides the equivalent named prop on conflict.
   */
  options = input<Record<string, any>>((() => ({}))());
  /**
   * HTML form-control `name` forwarded onto the rendered input — the forms drop-in, so `Flatpickr` submits like a native control. When `altInput` is on, flatpickr moves the `name` onto the hidden mirror input, so the submitted value carries it either way.
   */
  name = input<string>('');
  /**
   * Render an always-visible calendar inline instead of a popup — useful for dashboards and embedded pickers. **Construction-time only** — re-key the component to toggle live.
   */
  inline = input<boolean>(false);
  /**
   * flatpickr's `static` option — positions the calendar relative to the input rather than absolutely off `<body>`. Exposed as `staticPosition` because `static` is a JS reserved word. **Construction-time only**.
   */
  staticPosition = input<boolean>(false);
  /**
   * Calendar popup position: `'auto'`, `'above'`, `'below'`, or per-axis forms like `'above center'`. **Construction-time only**.
   */
  position = input<string>('auto');
  /**
   * A DOM element to append the calendar popup to, useful for escaping `overflow: hidden` ancestors. **Construction-time only**.
   */
  appendTo = input<(Record<string, any>) | null>(null);
  /**
   * Number of calendar months to render side by side. **Construction-time only**.
   */
  showMonths = input<number>(1);
  /**
   * Show ISO week numbers down the left edge of the calendar. **Construction-time only**.
   */
  weekNumbers = input<boolean>(false);
  /**
   * Month-selector style in the calendar header: `'dropdown'` or `'static'`. **Construction-time only**.
   */
  monthSelectorType = input<string>('dropdown');
  /**
   * HTML string for the previous-month navigation arrow, overriding flatpickr's built-in SVG. **Construction-time only**.
   */
  prevArrow = input<(string) | null>(null);
  /**
   * HTML string for the next-month navigation arrow, overriding flatpickr's built-in SVG. **Construction-time only**.
   */
  nextArrow = input<(string) | null>(null);
  /**
   * Allow the user to type a date directly into the input instead of only picking from the calendar. **Construction-time only**.
   */
  allowInput = input<boolean>(false);
  /**
   * Dates to disable: a mixed array of `Date` objects, `"Y-m-d"` strings, `{ from, to }` range objects, and/or predicate functions `(date: Date) => boolean`. Runtime-updatable via `set()` — a runtime `disable: []` clears the exclusion set.
   */
  disable = input<any[]>((() => [])());
  /**
   * Allow-list (the inverse of `disable`): when non-empty, ONLY these dates/ranges/predicates are selectable and everything else is disabled. Same element shapes as `disable`. Runtime-updatable via `set()`.
   */
  enable = input<any[]>((() => [])());
  /**
   * A flatpickr locale object (e.g. `import fr from 'flatpickr/dist/l10n/fr.js'`). The consumer lazy-imports it themselves — the wrapper adds no locale dependency. Runtime-updatable via `set('locale', …)`.
   */
  locale = input<(Record<string, any>) | null>(null);
  /**
   * First weekday of the calendar (`0` = Sunday … `1` = Monday). Folded into the `locale` option and overrides the locale's own first weekday when set. Runtime-updatable.
   */
  firstDayOfWeek = input<number>(0);
  /**
   * Custom parser `(dateStr: string, format: string) => Date` for input formats flatpickr's token grammar cannot express. **Construction-time only** — re-key the component to change it live.
   */
  parseDate = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Custom formatter `(date: Date, format: string, locale) => string` for output formats flatpickr's token grammar cannot express. **Construction-time only** — re-key the component to change it live.
   */
  formatDate = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * An array of flatpickr plugin instances (imported from `flatpickr/dist/plugins/…`); the headline use is `rangePlugin` for two-input ranges. **Construction-time only** — re-key the component to swap plugins live.
   */
  plugins = input<any[]>((() => [])());
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  change = output<unknown>();
  ready = output<unknown>();
  open = output<void>();
  close = output<void>();
  monthChange = output<void>();
  yearChange = output<void>();
  valueUpdate = output<unknown>();
  dayCreate = output<unknown>();
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;
  private __rozieWatchInitial_6 = true;
  private __rozieWatchInitial_7 = true;
  private __rozieWatchInitial_8 = true;
  private __rozieWatchInitial_9 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.date())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (!this.instance) return;
      if (v !== this.instance.input.value) this.instance.setDate(v, false);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.mode())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => this.instance?.set('mode', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.minDate())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } ((v: any) => this.instance?.set('minDate', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.maxDate())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => this.instance?.set('maxDate', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.dateFormat())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => this.instance?.set('dateFormat', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => (this.disabled() || this.__rozieCvaDisabled()))(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => {
      if (this.instance) this.instance.input.disabled = v;
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.disable())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } ((v: any) => this.instance?.set('disable', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.enable())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((v: any) => this.instance?.set('enable', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.locale())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } ((v: any) => this.instance?.set('locale', {
      ...(v ?? {}),
      ...(this.firstDayOfWeek() !== 0 ? {
        firstDayOfWeek: this.firstDayOfWeek()
      } : {})
    }))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.firstDayOfWeek())(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } ((v: any) => this.instance?.set('locale', {
      ...(this.locale() ?? {}),
      ...(v !== 0 ? {
        firstDayOfWeek: v
      } : {})
    }))(__watchVal); }); });
  }

  ngAfterViewInit() {
    const __appendTo = this.appendTo();
    const __prevArrow = this.prevArrow();
    const __nextArrow = this.nextArrow();
    const __disable = this.disable();
    const __enable = this.enable();
    const __parseDate = this.parseDate();
    const __formatDate = this.formatDate();
    const __plugins = this.plugins();
    const __locale = this.locale();
    const __firstDayOfWeek = this.firstDayOfWeek();
    this.instance = (flatpickr as any)(this.inputEl()!.nativeElement, {
      mode: this.mode(),
      dateFormat: this.dateFormat(),
      altInput: this.altInput(),
      altFormat: this.altFormat(),
      enableTime: this.enableTime(),
      enableSeconds: this.enableSeconds(),
      time_24hr: this.time24hr(),
      noCalendar: this.noCalendar(),
      minDate: this.minDate(),
      maxDate: this.maxDate(),
      defaultDate: this.date() || null,
      // GAP-5 UI passthrough (construction-time only) + GAP-6a allowInput.
      // These match flatpickr's own defaults so passing them is render-neutral.
      inline: this.inline(),
      static: this.staticPosition(),
      position: this.position(),
      showMonths: this.showMonths(),
      weekNumbers: this.weekNumbers(),
      monthSelectorType: this.monthSelectorType(),
      allowInput: this.allowInput(),
      // `appendTo` / `prevArrow` / `nextArrow` default to null here but flatpickr
      // expects them ABSENT (its own defaults are `undefined` for appendTo and
      // built-in SVG strings for the arrows). Passing an explicit null breaks
      // construction, so include each ONLY when the consumer set a real value.
      ...(__appendTo != null ? {
        appendTo: __appendTo
      } : {}),
      ...(__prevArrow != null ? {
        prevArrow: __prevArrow
      } : {}),
      ...(__nextArrow != null ? {
        nextArrow: __nextArrow
      } : {}),
      // GAP-2/3/4/6b conditional-spread passthrough. NEVER pass an empty array /
      // null / default-0, because flatpickr treats `enable: []` as "nothing
      // enabled" and a null locale/parseDate/formatDate breaks construction —
      // each guard keeps the default render byte-identical to before.
      ...(__disable.length ? {
        disable: __disable
      } : {}),
      ...(__enable.length ? {
        enable: __enable
      } : {}),
      ...(__parseDate != null ? {
        parseDate: __parseDate
      } : {}),
      ...(__formatDate != null ? {
        formatDate: __formatDate
      } : {}),
      ...(__plugins.length ? {
        plugins: __plugins
      } : {}),
      // locale + firstDayOfWeek merge: emit a single `locale` entry present when
      // EITHER a locale object is set OR firstDayOfWeek is non-default (0). The
      // merge folds firstDayOfWeek INTO the locale object so it overrides the
      // locale's own. Kept a PURE expression (no statements) so Angular can splice
      // it into a binding context safely.
      ...(__locale != null || __firstDayOfWeek !== 0 ? {
        locale: {
          ...(__locale ?? {}),
          ...(__firstDayOfWeek !== 0 ? {
            firstDayOfWeek: __firstDayOfWeek
          } : {})
        }
      } : {}),
      ...this.options(),
      onChange: (selectedDates: any, dateStr: any) => {
        // Value contract + range-commit semantics. In range mode flatpickr fires
        // onChange on the FIRST click (partial range) — committing then is the
        // bug every wrapper ships. Commit the string only when the range is
        // complete (2 dates) unless the consumer opted into commitOn:'change'.
        const isRange = this.mode() === 'range';
        const complete = !isRange || selectedDates.length === 2;
        if ((this.commitOn() === 'change' || complete) && dateStr !== this.date()) {
          this.date.set(dateStr), this.__rozieCvaOnChange(dateStr);
        }
        // Always surface BOTH the formatted string and the Date[] so consumers
        // that need the parsed objects (range bounds, multi-select) get them.
        this.change.emit({
          value: dateStr,
          selectedDates
        });
      },
      onReady: (d: any, s: any) => this.ready.emit({
        value: s,
        selectedDates: d
      }),
      onOpen: () => this.open.emit(),
      onClose: () => this.close.emit(),
      onMonthChange: () => this.monthChange.emit(),
      onYearChange: () => this.yearChange.emit(),
      onValueUpdate: (d: any, s: any) => this.valueUpdate.emit({
        value: s,
        selectedDates: d
      }),
      onDayCreate: (_d: any, _s: any, _fp: any, dayElem: any) => this.dayCreate.emit(dayElem)
    });
    if ((this.disabled() || this.__rozieCvaDisabled())) this.instance.input.disabled = true;
    this.__rozieDestroyRef.onDestroy(() => this.instance?.destroy());
  }

  instance: any = null;
  clear = () => {
    this.instance?.clear();
  };
  openPicker = () => {
    this.instance?.open();
  };
  closePicker = () => {
    this.instance?.close();
  };
  selectDate = (date: any, triggerChange: any) => {
    this.instance?.setDate(date, triggerChange);
  };
  jumpToDate = (date: any) => {
    this.instance?.jumpToDate(date);
  };
  getSelectedDates = () => {
    return this.instance ? this.instance.selectedDates : [];
  };
  togglePicker = () => {
    this.instance?.toggle();
  };
  changeMonth = (value: any, isOffset: any) => {
    this.instance?.changeMonth(value, isOffset);
  };
  changeYear = (year: any) => {
    this.instance?.changeYear(year);
  };

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: string | null): void {
    this.date.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
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
}

export default Flatpickr;
