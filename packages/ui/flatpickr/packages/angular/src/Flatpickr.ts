import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, model, output, untracked, viewChild } from '@angular/core';

import flatpickr from 'flatpickr';

@Component({
  selector: 'rozie-flatpickr',
  standalone: true,
  template: `

    <input #inputEl type="text" class="rozie-flatpickr" [name]="name()" [placeholder]="placeholder()" #rozieSpread_0 #rozieListenersTarget_1 />

  `,
  styles: [`
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
})
export class Flatpickr {
  date = model<string>('');
  mode = input<string>('single');
  dateFormat = input<string>('Y-m-d');
  altInput = input<boolean>(false);
  altFormat = input<string>('F j, Y');
  enableTime = input<boolean>(false);
  enableSeconds = input<boolean>(false);
  time24hr = input<boolean>(false);
  noCalendar = input<boolean>(false);
  minDate = input<(string) | null>(null);
  maxDate = input<(string) | null>(null);
  placeholder = input<string>('Select a date…');
  disabled = input<boolean>(false);
  commitOn = input<string>('complete');
  options = input<Record<string, any>>((() => ({}))());
  name = input<string>('');
  inline = input<boolean>(false);
  staticPosition = input<boolean>(false);
  position = input<string>('auto');
  appendTo = input<(Record<string, any>) | null>(null);
  showMonths = input<number>(1);
  weekNumbers = input<boolean>(false);
  monthSelectorType = input<string>('dropdown');
  prevArrow = input<(string) | null>(null);
  nextArrow = input<(string) | null>(null);
  allowInput = input<boolean>(false);
  disable = input<any[]>((() => [])());
  enable = input<any[]>((() => [])());
  locale = input<(Record<string, any>) | null>(null);
  firstDayOfWeek = input<number>(0);
  parseDate = input<((...args: unknown[]) => unknown) | null>(null);
  formatDate = input<((...args: unknown[]) => unknown) | null>(null);
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
    effect(() => { const __watchVal = (() => this.disabled())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => {
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
    this.instance = flatpickr(this.inputEl()!.nativeElement, {
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
          this.date.set(dateStr);
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
    if (this.disabled()) this.instance.input.disabled = true;
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
