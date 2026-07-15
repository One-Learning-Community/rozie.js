import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

interface MarkCtx {
  $implicit: { value: any; label: any; position: any };
  value: any;
  label: any;
  position: any;
}

interface BubbleCtx {
  $implicit: { value: any };
  value: any;
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
  selector: 'rozie-slider',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-slider" [ngClass]="{ 'rozie-slider--vertical': orientation() === 'vertical', 'rozie-slider--horizontal': orientation() !== 'vertical', 'rozie-slider--range': range(), 'rozie-slider--disabled': (disabled() || this.__rozieCvaDisabled()) }" [style]="fillStyle()" #rozieSpread_0 #rozieListenersTarget_1>
      
      <div class="rozie-slider-track" aria-hidden="true">
        <div class="rozie-slider-fill"></div>
      </div>

      
      @if (normalizedMarks().length > 0) {
    <div class="rozie-slider-marks" aria-hidden="true">
        
        @for (mark of normalizedMarks(); track mark.value) {
    <div class="rozie-slider-mark" [style]="{ left: pct(mark.value) + '%' }">
          @if ((markTpl ?? templates()?.['mark'])) {
    <ng-container *ngTemplateOutlet="(markTpl ?? templates()?.['mark']); context: { $implicit: { value: mark.value, label: mark.label, position: pct(mark.value) }, value: mark.value, label: mark.label, position: pct(mark.value) }" />
    } @else {

            <span class="rozie-slider-mark-label">{{ rozieDisplay(mark.label) }}</span>
          
    }
        </div>
    }
      </div>
    }@if (showValue() && !range()) {
    <div class="rozie-slider-bubbles" aria-hidden="true">
        <div class="rozie-slider-bubble" [style]="{ left: 'var(--rozie-slider-fill-end)' }">
          @if ((bubbleTpl ?? templates()?.['bubble'])) {
    <ng-container *ngTemplateOutlet="(bubbleTpl ?? templates()?.['bubble']); context: { $implicit: { value: singleValue() }, value: singleValue() }" />
    } @else {

            <span class="rozie-slider-bubble-text">{{ rozieDisplay(display(singleValue())) }}</span>
          
    }
        </div>
      </div>
    }@if (showValue() && range()) {
    <div class="rozie-slider-bubbles" aria-hidden="true">
        <div class="rozie-slider-bubble" [style]="{ left: 'var(--rozie-slider-fill-start)' }">
          @if ((bubbleTpl ?? templates()?.['bubble'])) {
    <ng-container *ngTemplateOutlet="(bubbleTpl ?? templates()?.['bubble']); context: { $implicit: { value: rangePair()[0] }, value: rangePair()[0] }" />
    } @else {

            <span class="rozie-slider-bubble-text">{{ rozieDisplay(display(rangePair()[0])) }}</span>
          
    }
        </div>
        <div class="rozie-slider-bubble" [style]="{ left: 'var(--rozie-slider-fill-end)' }">
          @if ((bubbleTpl ?? templates()?.['bubble'])) {
    <ng-container *ngTemplateOutlet="(bubbleTpl ?? templates()?.['bubble']); context: { $implicit: { value: rangePair()[1] }, value: rangePair()[1] }" />
    } @else {

            <span class="rozie-slider-bubble-text">{{ rozieDisplay(display(rangePair()[1])) }}</span>
          
    }
        </div>
      </div>
    }@if (!range()) {
    <input #inputEl class="rozie-slider-input" type="range" [min]="min()" [max]="max()" [step]="step()" [value]="singleValue()" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="ariaLabel()" [attr.aria-orientation]="rozieAttr(orientation() === 'vertical' ? 'vertical' : 'horizontal')" [attr.aria-valuetext]="rozieAttr(formatValue() !== null ? display(singleValue()) : null)" (input)="onInputSingle($event)" (keydown)="onKeyDownSingle($event)" />
    }@if (range()) {
    <input #inputEl class="rozie-slider-input rozie-slider-input--lo" type="range" [min]="min()" [max]="max()" [step]="step()" [value]="rangePair()[0]" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="ariaLabel()" [attr.aria-orientation]="rozieAttr(orientation() === 'vertical' ? 'vertical' : 'horizontal')" [attr.aria-valuetext]="rozieAttr(formatValue() !== null ? display(rangePair()[0]) : null)" (input)="onInputLo($event)" (keydown)="onKeyDownRange('lo', $event)" />
    }@if (range()) {
    <input class="rozie-slider-input rozie-slider-input--hi" type="range" [min]="min()" [max]="max()" [step]="step()" [value]="rangePair()[1]" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="ariaLabel()" [attr.aria-orientation]="rozieAttr(orientation() === 'vertical' ? 'vertical' : 'horizontal')" [attr.aria-valuetext]="rozieAttr(formatValue() !== null ? display(rangePair()[1]) : null)" (input)="onInputHi($event)" (keydown)="onKeyDownRange('hi', $event)" />
    }</div>

  `,
  styles: [`
    :host(rozie-slider) { display: contents; }
    .rozie-slider {
      position: relative;
      display: block;
      box-sizing: border-box;
      width: 100%;
      min-height: var(--rozie-slider-thumb-size, 1rem);
      padding: var(--rozie-slider-pad, 0.5rem 0);
      font: var(--rozie-slider-font, inherit);
    }
    .rozie-slider-track {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      transform: translateY(-50%);
      height: var(--rozie-slider-track-height, 0.375rem);
      border-radius: var(--rozie-slider-track-radius, 999px);
      background: var(--rozie-slider-track-bg, rgba(0, 0, 0, 0.18));
      pointer-events: none;
    }
    .rozie-slider-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      left: var(--rozie-slider-fill-start, 0%);
      right: calc(100% - var(--rozie-slider-fill-end, 0%));
      border-radius: inherit;
      background: var(--rozie-slider-fill-bg, var(--rozie-slider-accent, #0066cc));
    }
    .rozie-slider-input {
      -webkit-appearance: none;
      appearance: none;
      position: absolute;
      top: 50%;
      left: 0;
      transform: translateY(-50%);
      width: 100%;
      height: var(--rozie-slider-thumb-size, 1rem);
      margin: 0;
      background: none;
      pointer-events: none;
      cursor: pointer;
      accent-color: var(--rozie-slider-accent, #0066cc);
    }
    .rozie-slider-input:focus { outline: none; z-index: 2; }
    .rozie-slider--range .rozie-slider-input { pointer-events: none; }
    .rozie-slider--disabled .rozie-slider-input { cursor: not-allowed; }
    .rozie-slider--disabled { opacity: var(--rozie-slider-disabled-opacity, 0.55); }
    .rozie-slider-input::-webkit-slider-runnable-track {
      background: none;
      height: var(--rozie-slider-track-height, 0.375rem);
    }
    .rozie-slider-input::-moz-range-track {
      background: none;
      height: var(--rozie-slider-track-height, 0.375rem);
    }
    .rozie-slider-input::-moz-range-progress {
      background: none;
    }
    .rozie-slider-input::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      pointer-events: auto;
      width: var(--rozie-slider-thumb-size, 1rem);
      height: var(--rozie-slider-thumb-size, 1rem);
      border: var(--rozie-slider-thumb-border, 2px solid #fff);
      border-radius: 50%;
      background: var(--rozie-slider-thumb-bg, var(--rozie-slider-accent, #0066cc));
      box-shadow: var(--rozie-slider-thumb-shadow, 0 1px 3px rgba(0, 0, 0, 0.3));
      margin-top: var(--rozie-slider-thumb-offset, calc((0.375rem - 1rem) / 2));
      cursor: pointer;
    }
    .rozie-slider-input::-moz-range-thumb {
      pointer-events: auto;
      width: var(--rozie-slider-thumb-size, 1rem);
      height: var(--rozie-slider-thumb-size, 1rem);
      border: var(--rozie-slider-thumb-border, 2px solid #fff);
      border-radius: 50%;
      background: var(--rozie-slider-thumb-bg, var(--rozie-slider-accent, #0066cc));
      box-shadow: var(--rozie-slider-thumb-shadow, 0 1px 3px rgba(0, 0, 0, 0.3));
      cursor: pointer;
    }
    .rozie-slider--vertical {
      width: var(--rozie-slider-thickness, 2.5rem);
      height: var(--rozie-slider-length, 12rem);
      padding: 0;
    }
    .rozie-slider--vertical .rozie-slider-track,
    .rozie-slider--vertical .rozie-slider-input {
      top: 50%;
      left: 50%;
      width: var(--rozie-slider-length, 12rem);
      transform: translate(-50%, -50%) rotate(-90deg);
      transform-origin: center center;
    }
    .rozie-slider--vertical .rozie-slider-fill {
      /* The fill still spans start→end along the (now rotated) input axis. */
    }
    .rozie-slider--vertical .rozie-slider-marks,
    .rozie-slider--vertical .rozie-slider-bubbles {
      /* Overlays follow the rotated axis; left:%-of-length maps to the visual Y. */
      top: 50%;
      left: 50%;
      width: var(--rozie-slider-length, 12rem);
      transform: translate(-50%, -50%) rotate(-90deg);
      transform-origin: center center;
    }
    .rozie-slider-marks {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 0;
      pointer-events: none;
    }
    .rozie-slider-mark {
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      color: var(--rozie-slider-mark-color, rgba(0, 0, 0, 0.55));
    }
    .rozie-slider-mark-label {
      position: absolute;
      top: var(--rozie-slider-mark-offset, 0.75rem);
      left: 50%;
      transform: translateX(-50%);
      font-size: var(--rozie-slider-mark-font-size, 0.6875rem);
      white-space: nowrap;
    }
    .rozie-slider-bubbles {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 0;
      pointer-events: none;
    }
    .rozie-slider-bubble {
      position: absolute;
      top: var(--rozie-slider-bubble-offset, -1.25rem);
      transform: translateX(-50%);
    }
    .rozie-slider-bubble-text {
      display: inline-block;
      padding: var(--rozie-slider-bubble-padding, 0.0625rem 0.375rem);
      font-size: var(--rozie-slider-bubble-font-size, 0.6875rem);
      color: var(--rozie-slider-bubble-fg, #fff);
      background: var(--rozie-slider-bubble-bg, var(--rozie-slider-accent, #0066cc));
      border-radius: var(--rozie-slider-bubble-radius, 4px);
      white-space: nowrap;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Slider),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Slider {
  /**
   * The current value (two-way `r-model`). A scalar number in single mode; a sorted `[lo, hi]` array in `range` mode, with each thumb neighbour-clamped so the pair stays sorted on every commit. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Slider **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Slider r-model:value="volume" :min="0" :max="100" :step="1" ariaLabel="Volume" />
   */
  value = model<(unknown) | null>(null);
  /**
   * Switch to dual-thumb range mode: `value` becomes a sorted `[lo, hi]` array driven by two overlapping native inputs. The exact analog of listbox's `multiple` (scalar↔array). A bare attribute (`<Slider range>`) coerces to `true`.
   */
  range = input<boolean>(false);
  /**
   * The lower bound of the scale, forwarded to the native input as the `min` attribute (the browser derives `aria-valuemin` from it — not set by hand, per MDN slider-role guidance).
   */
  min = input<number>(0);
  /**
   * The upper bound of the scale, forwarded to the native input as the `max` attribute (the browser derives `aria-valuemax` from it — not set by hand, per MDN slider-role guidance).
   */
  max = input<number>(100);
  /**
   * The granularity of the scale, forwarded as the native `step` attribute; every write-back is quantized to it.
   */
  step = input<number>(1);
  /**
   * Layout orientation — `'horizontal'` (default) or `'vertical'`. Vertical rotates the wrapper `-90deg` so up = increase and sets `aria-orientation="vertical"` explicitly (a native range input always reports itself as horizontal even when visually rotated).
   */
  orientation = input<string>('horizontal');
  /**
   * Disable the control — it becomes non-interactive and dimmed. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * Tick marks over the track — either a bare `value[]` (positions only) or a `{ value, label }[]` (positioned and labelled). Rendered as a decorative overlay above the track; override per-mark rendering via the `mark` scoped slot (`{ value, label, position }`).
   */
  marks = input<any[]>((() => [])());
  /**
   * Accessible name for each native input when there is no visible `<label for>`, reflected onto the input's `aria-label`.
   */
  ariaLabel = input<(string) | null>(null);
  /**
   * The jump applied on `PageUp` / `PageDown`. `null` falls back to `step × 10`. Applied by a thin `@keydown` augment so it honours this value (native browsers otherwise use their own large step); arrows / `Home` / `End` stay native.
   */
  pageStep = input<(number) | null>(null);
  /**
   * A `(value) => string` formatter for the value shown in the `bubble` slot and surfaced as `aria-valuetext`. Receives the numeric value and returns a string; `null` uses the raw value.
   */
  formatValue = input<((...args: any[]) => any) | null>(null);
  /**
   * Render the value-bubble overlay (one bubble per thumb in range mode). Headless and opt-in — there is no default-styled bubble; supply the `bubble` slot to control its appearance.
   */
  showValue = input<boolean>(false);
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  change = output<unknown>();
  @ContentChild('mark', { read: TemplateRef }) markTpl?: TemplateRef<MarkCtx>;
  @ContentChild('bubble', { read: TemplateRef }) bubbleTpl?: TemplateRef<BubbleCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  fillStyle = computed(() => {
    const __value = this.value();
    const __min = this.min();
    let start, end;
    if (this.range()) {
      const arr = Array.isArray(__value) && __value.length === 2 ? __value : [__min, this.max()];
      start = this.pct(arr[0]);
      end = this.pct(arr[1]);
    } else {
      start = 0;
      const v = __value;
      end = this.pct(typeof v === 'number' && Number.isFinite(v) ? v : __min);
    }
    return {
      '--rozie-slider-fill-start': start + '%',
      '--rozie-slider-fill-end': end + '%'
    };
  });

  pct = (v: any) => {
    const __min = this.min();
    const span = this.max() - __min;
    if (span === 0) return 0;
    const p = (v - __min) / span * 100;
    if (p < 0) return 0;
    if (p > 100) return 100;
    return p;
  };
  clampStep = (raw: any) => {
    const __min = this.min();
    const __max = this.max();
    if (!Number.isFinite(raw)) return __min;
    let v = raw;
    if (v < __min) v = __min;
    if (v > __max) v = __max;
    const step = this.step();
    if (Number.isFinite(step) && step > 0) {
      const steps = Math.round((v - __min) / step);
      v = __min + steps * step;
      if (v < __min) v = __min;
      if (v > __max) v = __max;
    }
    return v;
  };
  rangePair = () => {
    const cur = this.value();
    if (Array.isArray(cur) && cur.length === 2) return [cur[0], cur[1]];
    return [this.min(), this.max()];
  };
  singleValue = () => {
    const cur = this.value();
    return typeof cur === 'number' && Number.isFinite(cur) ? cur : this.min();
  };
  normalizedMarks = () => {
    const __marks = this.marks();
    const list = Array.isArray(__marks) ? __marks : [];
    return list.map((m: any) => {
      if (m !== null && typeof m === 'object' && 'value' in m) {
        return {
          value: m.value,
          label: 'label' in m && m.label != null ? m.label : String(m.value)
        };
      }
      return {
        value: m,
        label: String(m)
      };
    });
  };
  display = (v: any) => {
    const __formatValue = this.formatValue();
    if (__formatValue !== null) return __formatValue(v);
    return String(v);
  };
  fireChange = (value: any) => this.change.emit({
    value: this.value()
  });
  commitSingle = (raw: any) => {
    const v = this.clampStep(raw);
    this.value.set(v), this.__rozieCvaOnChange(v);
    this.fireChange(v);
  };
  commitRange = (which: any, raw: any) => {
    const pair = this.rangePair();
    let lo = pair[0];
    let hi = pair[1];
    const v = this.clampStep(raw);
    if (which === 'lo') lo = Math.min(v, hi);else hi = Math.max(v, lo);
    const next = [lo, hi];
    this.value.set(next), this.__rozieCvaOnChange(next);
    this.fireChange(next);
  };
  onInputSingle = ($event: any) => this.commitSingle($event.target.valueAsNumber);
  onInputLo = ($event: any) => this.commitRange('lo', $event.target.valueAsNumber);
  onInputHi = ($event: any) => this.commitRange('hi', $event.target.valueAsNumber);
  effectivePageStep = () => {
    const __step = this.step();
    const ps = this.pageStep();
    if (Number.isFinite(ps) && ps > 0) return ps;
    const step = Number.isFinite(__step) && __step > 0 ? __step : 1;
    return step * 10;
  };
  onKeyDownSingle = ($event: any) => {
    const key = $event.key;
    if (key !== 'PageUp' && key !== 'PageDown') return;
    $event.preventDefault();
    const delta = key === 'PageUp' ? this.effectivePageStep() : -this.effectivePageStep();
    this.commitSingle(this.singleValue() + delta);
  };
  onKeyDownRange = (which: any, $event: any) => {
    const key = $event.key;
    if (key !== 'PageUp' && key !== 'PageDown') return;
    $event.preventDefault();
    const delta = key === 'PageUp' ? this.effectivePageStep() : -this.effectivePageStep();
    const pair = this.rangePair();
    const base = which === 'lo' ? pair[0] : pair[1];
    this.commitRange(which, base + delta);
  };
  focus = () => this.inputEl()?.nativeElement?.focus();
  increment = (thumb: any) => {
    const __step = this.step();
    if (this.range()) {
      const which = thumb === 'hi' ? 'hi' : 'lo';
      const pair = this.rangePair();
      const base = which === 'lo' ? pair[0] : pair[1];
      this.commitRange(which, base + __step);
    } else {
      this.commitSingle(this.singleValue() + __step);
    }
  };
  decrement = (thumb: any) => {
    const __step = this.step();
    if (this.range()) {
      const which = thumb === 'hi' ? 'hi' : 'lo';
      const pair = this.rangePair();
      const base = which === 'lo' ? pair[0] : pair[1];
      this.commitRange(which, base - __step);
    } else {
      this.commitSingle(this.singleValue() - __step);
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
    _dir: Slider,
    _ctx: unknown,
  ): _ctx is MarkCtx | BubbleCtx {
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

export default Slider;
