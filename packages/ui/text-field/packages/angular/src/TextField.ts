import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay, rozieModel } from '@rozie/runtime-angular';

import { applyAutosize } from './internal/autosize';

// Top-level so React hoists it to a ref and the Solid onMount/onCleanup split
// sees it in teardown.

/** The `change` and `enter` event payload: the field's current text. */
export interface TextFieldValuePayload {
  value: string;
}

interface PrefixCtx {}

interface SuffixCtx {}

@Component({
  selector: 'rozie-text-field',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-text-field" [ngClass]="{ 'rozie-text-field--invalid': isInvalid(), 'rozie-text-field--disabled': (disabled() || this.__rozieCvaDisabled()), 'rozie-text-field--multiline': multiline(), 'rozie-text-field--autosize': multiline() && autosize() }" #rozieSpread_0 #rozieListenersTarget_1>
      @if (label()) {
    <label class="rozie-text-field-label" [attr.for]="rozieAttr(inputId())">{{ label() }}@if (required()) {
    <span class="rozie-text-field-required" aria-hidden="true"> *</span>
    }</label>
    }<div class="rozie-text-field-control">
        @if ((prefixTpl ?? __rozieFillMap()['prefix'] ?? templates()?.['prefix'])) {
    <span class="rozie-text-field-prefix">@if ((prefixTpl ?? __rozieFillMap()['prefix'] ?? templates()?.['prefix'])) {
    <ng-container *ngTemplateOutlet="(prefixTpl ?? __rozieFillMap()['prefix'] ?? templates()?.['prefix'])" />
    }</span>
    }@if (multiline()) {
    <textarea #textareaEl class="rozie-text-field-input" [attr.id]="rozieAttr(inputId())" [value]="currentText()" [rows]="rows()" [attr.name]="rozieAttr(optionalAttr(name()))" [attr.placeholder]="rozieAttr(optionalAttr(placeholder()))" [attr.autocomplete]="rozieAttr(optionalAttr(autocomplete()))" [attr.maxlength]="rozieAttr(maxLength())" [required]="!!required()" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [readOnly]="!!readonly()" [attr.aria-label]="rozieAttr(ariaLabel())" [attr.aria-invalid]="rozieAttr(isInvalid() ? 'true' : null)" [attr.aria-describedby]="rozieAttr(describedBy())" (input)="onInput($event)" (focus)="onFocus($event)" (blur)="onBlur($event)"></textarea>
    }@if (!multiline()) {
    <input #inputEl class="rozie-text-field-input" [attr.id]="rozieAttr(inputId())" [attr.type]="rozieAttr(inputType())" [value]="currentText()" [attr.name]="rozieAttr(optionalAttr(name()))" [attr.placeholder]="rozieAttr(optionalAttr(placeholder()))" [attr.autocomplete]="rozieAttr(optionalAttr(autocomplete()))" [attr.maxlength]="rozieAttr(maxLength())" [required]="!!required()" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [readOnly]="!!readonly()" [attr.aria-label]="rozieAttr(ariaLabel())" [attr.aria-invalid]="rozieAttr(isInvalid() ? 'true' : null)" [attr.aria-describedby]="rozieAttr(describedBy())" (input)="onInput($event)" (focus)="onFocus($event)" (blur)="onBlur($event)" (keydown)="onKeydown($event)" />
    }@if ((suffixTpl ?? __rozieFillMap()['suffix'] ?? templates()?.['suffix'])) {
    <span class="rozie-text-field-suffix">@if ((suffixTpl ?? __rozieFillMap()['suffix'] ?? templates()?.['suffix'])) {
    <ng-container *ngTemplateOutlet="(suffixTpl ?? __rozieFillMap()['suffix'] ?? templates()?.['suffix'])" />
    }</span>
    }</div>

      @if (description()) {
    <p class="rozie-text-field-description" [attr.id]="rozieAttr(descriptionId())">{{ description() }}</p>
    }@if (hasError()) {
    <p class="rozie-text-field-error" [attr.id]="rozieAttr(errorId())">{{ error() }}</p>
    }@if (showCount()) {
    <p class="rozie-text-field-count" [attr.id]="rozieAttr(countId())">{{ rozieDisplay(countText()) }}</p>
    }</div>

  `,
  styles: [`
    :host(rozie-text-field) { display: contents; }
    .rozie-text-field {
      display: flex;
      flex-direction: column;
      gap: var(--rozie-text-field-gap, var(--rtf-gap, 0.375rem));
      font: var(--rozie-text-field-font, inherit);
      color: var(--rozie-text-field-color, var(--rtf-color, inherit));
      width: var(--rozie-text-field-width, var(--rtf-width, 100%));
      min-width: 0;
    }
    .rozie-text-field-label {
      font-size: var(--rozie-text-field-label-size, var(--rtf-label-size, 0.875rem));
      font-weight: var(--rozie-text-field-label-weight, var(--rtf-label-weight, 500));
      color: var(--rozie-text-field-label-color, var(--rtf-label-color, inherit));
    }
    .rozie-text-field-required {
      color: var(--rozie-text-field-error-color, var(--rtf-error-color, #dc2626));
    }
    .rozie-text-field-control {
      display: flex;
      align-items: center;
      gap: var(--rozie-text-field-adornment-gap, var(--rtf-adornment-gap, 0.5rem));
      box-sizing: border-box;
      padding: 0 var(--rozie-text-field-padding-x, var(--rtf-padding-x, 0.75rem));
      border: var(--rozie-text-field-border-width, var(--rtf-border-width, 1px)) solid var(--rozie-text-field-border-color, var(--rtf-border-color, rgba(0, 0, 0, 0.25)));
      border-radius: var(--rozie-text-field-radius, var(--rtf-radius, 0.5rem));
      background: var(--rozie-text-field-bg, var(--rtf-bg, #fff));
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .rozie-text-field--multiline .rozie-text-field-control {
      align-items: flex-start;
    }
    .rozie-text-field-control:focus-within {
      border-color: var(--rozie-text-field-focus-color, var(--rtf-focus-color, #2563eb));
      box-shadow: 0 0 0 var(--rozie-text-field-focus-ring-width, var(--rtf-focus-ring-width, 3px)) var(--rozie-text-field-focus-ring, var(--rtf-focus-ring, rgba(37, 99, 235, 0.25)));
    }
    .rozie-text-field--invalid .rozie-text-field-control {
      border-color: var(--rozie-text-field-error-color, var(--rtf-error-color, #dc2626));
    }
    .rozie-text-field--invalid .rozie-text-field-control:focus-within {
      box-shadow: 0 0 0 var(--rozie-text-field-focus-ring-width, var(--rtf-focus-ring-width, 3px)) var(--rozie-text-field-error-ring, var(--rtf-error-ring, rgba(220, 38, 38, 0.25)));
    }
    .rozie-text-field-control:has(> .rozie-text-field-input:disabled) {
      background: var(--rozie-text-field-disabled-bg, var(--rtf-disabled-bg, rgba(0, 0, 0, 0.04)));
      opacity: var(--rozie-text-field-disabled-opacity, var(--rtf-disabled-opacity, 0.6));
    }
    .rozie-text-field-input {
      flex: 1 1 auto;
      min-width: 0;
      box-sizing: border-box;
      margin: 0;
      padding: var(--rozie-text-field-padding-y, var(--rtf-padding-y, 0.5rem)) 0;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      color: inherit;
      line-height: var(--rozie-text-field-line-height, var(--rtf-line-height, 1.5));
    }
    textarea.rozie-text-field-input {
      resize: var(--rozie-text-field-resize, var(--rtf-resize, vertical));
    }
    .rozie-text-field--autosize textarea.rozie-text-field-input {
      resize: none;
    }
    .rozie-text-field-input::placeholder {
      color: var(--rozie-text-field-placeholder-color, var(--rtf-placeholder-color, rgba(0, 0, 0, 0.45)));
    }
    .rozie-text-field-input:disabled {
      cursor: not-allowed;
    }
    .rozie-text-field-prefix,
    .rozie-text-field-suffix {
      display: inline-flex;
      align-items: center;
      flex: none;
      color: var(--rozie-text-field-adornment-color, var(--rtf-adornment-color, rgba(0, 0, 0, 0.55)));
    }
    .rozie-text-field--multiline .rozie-text-field-prefix,
    .rozie-text-field--multiline .rozie-text-field-suffix {
      padding-top: var(--rozie-text-field-padding-y, var(--rtf-padding-y, 0.5rem));
    }
    .rozie-text-field-description,
    .rozie-text-field-error,
    .rozie-text-field-count {
      margin: 0;
      font-size: var(--rozie-text-field-help-size, var(--rtf-help-size, 0.8125rem));
    }
    .rozie-text-field-description {
      color: var(--rozie-text-field-description-color, var(--rtf-description-color, rgba(0, 0, 0, 0.6)));
    }
    .rozie-text-field-error {
      color: var(--rozie-text-field-error-color, var(--rtf-error-color, #dc2626));
    }
    .rozie-text-field-count {
      align-self: flex-end;
      color: var(--rozie-text-field-description-color, var(--rtf-description-color, rgba(0, 0, 0, 0.6)));
      font-variant-numeric: tabular-nums;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextField),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class TextField {
  /**
   * The text in the field (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so `[(ngModel)]` and `[formControl]` bind directly. Written on every keystroke.
   * @example
   * <rozie-text-field [(modelValue)]="email" label="Email" />
   */
  readonly __rozieModelIn_modelValue = input<string | undefined>(undefined, { alias: 'modelValue' });
  modelValueChange = output<string>();
  modelValue = rozieModel<string, import('@angular/core').ModelSignal<string>>(this.__rozieModelIn_modelValue, this.modelValueChange, '', { signal, computed, untracked });
  /**
   * Visible label text, rendered as a `<label>` whose `for` points at the control. Leave it empty and set `ariaLabel` when the field has no visible label.
   */
  label = input<string>('');
  /**
   * Help text shown under the control and linked to it through `aria-describedby`, so screen readers announce it after the label.
   */
  description = input<string>('');
  /**
   * Error message. A non-empty value renders it under the control, links it through `aria-describedby`, and marks the control `aria-invalid="true"`. Clear it (empty string) once the value is valid again.
   * @example
   * <rozie-text-field [(modelValue)]="email" label="Email" [error]="emailError" />
   */
  error = input<string>('');
  /**
   * Mark the field invalid (`aria-invalid="true"` and the invalid styling) without showing a message, for example when the message is rendered elsewhere. A non-empty `error` implies this.
   */
  invalid = input<boolean>(false);
  /**
   * The native input `type`: `'text'`, `'email'`, `'password'`, `'search'`, `'tel'` or `'url'`. Ignored when `multiline` is set.
   */
  type = input<string>('text');
  /**
   * Placeholder text shown while the field is empty. It is not a substitute for `label`: it disappears on input and many screen readers do not announce it.
   */
  placeholder = input<string>('');
  /**
   * The native `name` attribute, used when the field sits in a plain HTML `<form>`. On Lit the control is in a shadow root, so it does not join the outer form; bind `modelValue` there.
   */
  name = input<string>('');
  /**
   * The native `autocomplete` hint (e.g. `'email'`, `'current-password'`, `'off'`). Empty leaves the browser default.
   */
  autocomplete = input<string>('');
  /**
   * Mark the field required: sets the native `required` attribute (announced by screen readers) and shows a `*` after the label. The marker is `aria-hidden` so it is not read twice.
   */
  required = input<boolean>(false);
  /**
   * Disable the control. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * Make the control read-only: the text is shown, focusable and selectable but cannot be edited.
   */
  readonly = input<boolean>(false);
  /**
   * Maximum number of characters, forwarded as the native `maxlength`. `null` (the default) means no limit. With `showCount`, the counter reads `n / maxLength`.
   */
  maxLength = input<(number) | null>(null);
  /**
   * Show a character counter under the control (`n / maxLength`, or just `n` without a limit). The counter is linked through `aria-describedby`; it is not a live region, so it does not interrupt typing.
   */
  showCount = input<boolean>(false);
  /**
   * Render a `<textarea>` instead of an `<input>`.
   */
  multiline = input<boolean>(false);
  /**
   * Visible rows of a `multiline` field (the native `rows`). With `autosize` it is the minimum height.
   */
  rows = input<number>(3);
  /**
   * Grow a `multiline` field to fit its content, from `rows` up to `maxRows`. It re-measures on input, on programmatic `modelValue` changes and when the field width changes.
   * @example
   * <rozie-text-field [(modelValue)]="notes" label="Notes" multiline autosize [maxRows]="8" />
   */
  autosize = input<boolean>(false);
  /**
   * The tallest an `autosize` field grows, in rows; past it the textarea scrolls. `null` (the default) means no cap.
   */
  maxRows = input<(number) | null>(null);
  /**
   * Accessible name for the control (`aria-label`) when there is no visible `label`.
   */
  ariaLabel = input<(string) | null>(null);
  /**
   * Id base for the control and its text: the control is `idBase + '-input'`, and the description, error and counter are `-description`, `-error` and `-count`. Leave it empty (the default) and each instance generates a unique base after mount (`rozie-text-field-<n>`); set it when you need stable ids, for example to point an external element at the control. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase = input<string>('');
  autoId = signal('');
  textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  change = output<TextFieldValuePayload>();
  enter = output<TextFieldValuePayload>();
  private __rozieNativeEventGuard = ((host: HTMLElement, renderer: Renderer2) => ['change'].map((type) => renderer.listen(host, type, (e: Event) => { if (e.target !== host) e.stopImmediatePropagation(); })))(inject(ElementRef).nativeElement, inject(Renderer2));
  @ContentChild('prefix', { read: TemplateRef }) prefixTpl?: TemplateRef<PrefixCtx>;
  @ContentChild('suffix', { read: TemplateRef }) suffixTpl?: TemplateRef<SuffixCtx>;
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
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.modelValue())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => this.fitLater())(); }); });
    effect(() => { const __watchVal = (() => this.multiline())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => this.fitLater())(); }); });
    effect(() => { const __watchVal = (() => this.autosize())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => this.fitLater())(); }); });
    effect(() => { const __watchVal = (() => this.rows())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } (() => this.fitLater())(); }); });
    effect(() => { const __watchVal = (() => this.maxRows())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } (() => this.fitLater())(); }); });
  }

  ngAfterViewInit() {
    if (!this.idBase()) this.autoId.set('rozie-text-field-' + this.nextAutoId());
    this.fit();
    this.__rozieDestroyRef.onDestroy(() => {
      this.observeWidth(null);
    });
  }

  widthObserver: any = null;
  observedEl: any = null;
  lastWidth = -1;
  // Whether fit() has written an inline height, so turning `autosize` off can
  // remove it (and never touches a height the user set with the resize grip).
  autosized = false;
  // The rows the last fit() used, read by the width observer. The observer
  // re-applies through these instead of calling fit(): two helpers calling each
  // other are a use-before-declaration error in React's useCallback dep arrays.
  fitRows: any = null;
  fitMaxRows: any = null;
  // The text when the control gained focus, and whether the user has typed since.
  // `change` fires on blur only for a user edit that changed the text, so a
  // programmatic write (clear(), a consumer reformatting the value) never does.
  textAtFocus = '';
  editedSinceFocus = false;
  // The page-wide id counter (the same four lines as Combobox / Listbox / Popover).
  nextAutoId = () => {
    const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
    Reflect.set(globalThis, '__rozieAutoId', n);
    return n;
  };
  // ---- ids -------------------------------------------------------------------
  idRoot = () => this.idBase() || this.autoId() || 'rozie-text-field';
  inputId = () => this.idRoot() + '-input';
  descriptionId = () => this.idRoot() + '-description';
  errorId = () => this.idRoot() + '-error';
  countId = () => this.idRoot() + '-count';
  // ---- derived state ---------------------------------------------------------
  hasError = () => typeof this.error() === 'string' && this.error().length > 0;
  isInvalid = () => !!this.invalid() || this.hasError();
  currentText = () => this.modelValue() == null ? '' : String(this.modelValue());
  // Read once into a local: Angular does not narrow across two signal calls.
  hasLimit = () => {
    const limit = this.maxLength();
    return typeof limit === 'number' && limit >= 0;
  };
  countText = () => {
    const n = this.currentText().length;
    return this.hasLimit() ? n + ' / ' + this.maxLength() : String(n);
  };
  // The ids of the rendered helper text, space-joined, or null when there is none.
  describedBy = () => {
    const ids: string[] = [];
    if (this.description()) ids.push(this.descriptionId());
    if (this.hasError()) ids.push(this.errorId());
    if (this.showCount()) ids.push(this.countId());
    return ids.length > 0 ? ids.join(' ') : null;
  };
  inputType = () => this.type() ? this.type() : 'text';
  // An optional string attribute: omitted when empty. Untyped param → `any`, so it
  // feeds strict DOM attribute types on every target (Vue's `string | undefined`,
  // Svelte's closed `autocomplete` union) without a per-target cast.
  optionalAttr = (v: any) => v ? v : undefined;
  // ---- autosize --------------------------------------------------------------
  // A width change re-wraps the text, so an autosized textarea is observed and
  // re-measured. Only a WIDTH change counts: our own height write must not loop
  // the observer. Re-targets when the textarea is (re)mounted by `multiline`.
  observeWidth = (el: any) => {
    if (el === this.observedEl) return;
    if (this.widthObserver) this.widthObserver.disconnect();
    this.widthObserver = null;
    this.observedEl = el;
    this.lastWidth = -1;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.widthObserver = new ResizeObserver((entries: any) => {
      const w = entries[0] ? entries[0].contentRect.width : -1;
      if (w === this.lastWidth) return;
      this.lastWidth = w;
      applyAutosize(this.observedEl, this.fitRows, this.fitMaxRows);
    });
    this.widthObserver.observe(el);
  };
  fit = () => {
    const el = this.multiline() ? this.textareaEl()?.nativeElement : null;
    if (!el || !this.autosize()) {
      this.observeWidth(null);
      if (el && this.autosized) {
        el.style.height = '';
        el.style.overflowY = '';
      }
      this.autosized = false;
      return;
    }
    this.fitRows = this.rows();
    this.fitMaxRows = this.maxRows();
    this.observeWidth(el);
    applyAutosize(el, this.fitRows, this.fitMaxRows);
    this.autosized = true;
  };
  // Re-measure once every target has rendered the change: a macrotask, because
  // Lit applies its update in a microtask of its own.
  fitLater = () => {
    setTimeout(() => this.fit(), 0);
  };
  // ---- handlers --------------------------------------------------------------
  // Named commitText, NOT writeValue (the generated Angular CVA method).
  commitText = (text: any) => {
    this.modelValue.set(text), this.__rozieCvaOnChange(text);
  };
  onInput = (e: any) => {
    this.editedSinceFocus = true;
    this.commitText(e && e.target ? e.target.value : '');
    this.fit();
  };
  // `change` = a committed edit: on blur, when the text differs from what it was
  // at focus. Driven from focus/blur rather than the native `change` event because
  // React's `onChange` (what `@change` lowers to there) fires on every keystroke,
  // so the native event would not mean the same thing on all six targets.
  onFocus = (e: any) => {
    this.textAtFocus = e && e.target ? e.target.value : this.currentText();
    this.editedSinceFocus = false;
  };
  onBlur = (e: any) => {
    const text = e && e.target ? e.target.value : this.currentText();
    const changed = this.editedSinceFocus && text !== this.textAtFocus;
    this.editedSinceFocus = false;
    this.textAtFocus = text;
    if (changed) this.change.emit({
      value: text
    });
  };
  onKeydown = (e: any) => {
    if (!e || e.key !== 'Enter' || e.isComposing) return;
    this.enter.emit({
      value: e.target ? e.target.value : this.currentText()
    });
  };
  // ---- lifecycle -------------------------------------------------------------
  // ---- imperative handle -----------------------------------------------------
  control = () => this.multiline() ? this.textareaEl()?.nativeElement : this.inputEl()?.nativeElement;
  // focus() deliberately overrides HTMLElement.focus on Lit (ROZ137, accepted).
  focus: () => void = () => {
    const el = this.control();
    if (el && el.focus) el.focus();
  };
  // select() — focus the control and select all of its text.
  select: () => void = () => {
    const el: any = this.control();
    if (!el) return;
    if (el.focus) el.focus();
    if (el.select) el.select();
  };
  // clear() — empty the field (writes modelValue = '').
  clear: () => void = () => {
    this.commitText('');
    this.fit();
  };

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: string | null): void {
    this.modelValue.set(v ?? '');
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

  static ngTemplateContextGuard(
    _dir: TextField,
    _ctx: unknown,
  ): _ctx is PrefixCtx | SuffixCtx {
    return true;
  }

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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default TextField;
