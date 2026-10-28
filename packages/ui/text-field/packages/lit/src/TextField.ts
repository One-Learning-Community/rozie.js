import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { applyAutosize } from './internal/autosize';

// Top-level so React hoists it to a ref and the Solid onMount/onCleanup split
// sees it in teardown.

/** The `change` and `enter` event payload: the field's current text. */
export interface TextFieldValuePayload {
  value: string;
}

export interface RozieTextFieldEventMap extends Omit<HTMLElementEventMap, 'change' | 'enter' | 'model-value-change'> {
  'change': CustomEvent<TextFieldValuePayload>;
  'enter': CustomEvent<TextFieldValuePayload>;
  'model-value-change': CustomEvent<string>;
}

@customElement('rozie-text-field')
export default class TextField extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-text-field[data-rozie-s-346ae6aa] {
  display: flex;
  flex-direction: column;
  gap: var(--rozie-text-field-gap, var(--rtf-gap, 0.375rem));
  font: var(--rozie-text-field-font, inherit);
  color: var(--rozie-text-field-color, var(--rtf-color, inherit));
  width: var(--rozie-text-field-width, var(--rtf-width, 100%));
  min-width: 0;
}
.rozie-text-field-label[data-rozie-s-346ae6aa] {
  font-size: var(--rozie-text-field-label-size, var(--rtf-label-size, 0.875rem));
  font-weight: var(--rozie-text-field-label-weight, var(--rtf-label-weight, 500));
  color: var(--rozie-text-field-label-color, var(--rtf-label-color, inherit));
}
.rozie-text-field-required[data-rozie-s-346ae6aa] {
  /* A margin, not a leading space in the markup: targets collapse that space differently. */
  margin-left: 0.25em;
  color: var(--rozie-text-field-error-color, var(--rtf-error-color, #dc2626));
}
.rozie-text-field-control[data-rozie-s-346ae6aa] {
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
.rozie-text-field--multiline[data-rozie-s-346ae6aa] .rozie-text-field-control[data-rozie-s-346ae6aa] {
  align-items: flex-start;
}
.rozie-text-field-control[data-rozie-s-346ae6aa]:focus-within {
  border-color: var(--rozie-text-field-focus-color, var(--rtf-focus-color, #2563eb));
  box-shadow: 0 0 0 var(--rozie-text-field-focus-ring-width, var(--rtf-focus-ring-width, 3px)) var(--rozie-text-field-focus-ring, var(--rtf-focus-ring, rgba(37, 99, 235, 0.25)));
}
.rozie-text-field--invalid[data-rozie-s-346ae6aa] .rozie-text-field-control[data-rozie-s-346ae6aa] {
  border-color: var(--rozie-text-field-error-color, var(--rtf-error-color, #dc2626));
}
.rozie-text-field--invalid[data-rozie-s-346ae6aa] .rozie-text-field-control[data-rozie-s-346ae6aa]:focus-within {
  box-shadow: 0 0 0 var(--rozie-text-field-focus-ring-width, var(--rtf-focus-ring-width, 3px)) var(--rozie-text-field-error-ring, var(--rtf-error-ring, rgba(220, 38, 38, 0.25)));
}
.rozie-text-field-control[data-rozie-s-346ae6aa]:has(> .rozie-text-field-input[data-rozie-s-346ae6aa]:disabled) {
  background: var(--rozie-text-field-disabled-bg, var(--rtf-disabled-bg, rgba(0, 0, 0, 0.04)));
  opacity: var(--rozie-text-field-disabled-opacity, var(--rtf-disabled-opacity, 0.6));
}
.rozie-text-field-input[data-rozie-s-346ae6aa] {
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
textarea.rozie-text-field-input[data-rozie-s-346ae6aa] {
  resize: var(--rozie-text-field-resize, var(--rtf-resize, vertical));
}
.rozie-text-field--autosize[data-rozie-s-346ae6aa] textarea.rozie-text-field-input[data-rozie-s-346ae6aa] {
  resize: none;
}
.rozie-text-field-input[data-rozie-s-346ae6aa]::placeholder {
  color: var(--rozie-text-field-placeholder-color, var(--rtf-placeholder-color, rgba(0, 0, 0, 0.45)));
}
.rozie-text-field-input[data-rozie-s-346ae6aa]:disabled {
  cursor: not-allowed;
}
.rozie-text-field-prefix[data-rozie-s-346ae6aa],
.rozie-text-field-suffix[data-rozie-s-346ae6aa] {
  display: inline-flex;
  align-items: center;
  flex: none;
  color: var(--rozie-text-field-adornment-color, var(--rtf-adornment-color, rgba(0, 0, 0, 0.55)));
}
.rozie-text-field--multiline[data-rozie-s-346ae6aa] .rozie-text-field-prefix[data-rozie-s-346ae6aa],
.rozie-text-field--multiline[data-rozie-s-346ae6aa] .rozie-text-field-suffix[data-rozie-s-346ae6aa] {
  padding-top: var(--rozie-text-field-padding-y, var(--rtf-padding-y, 0.5rem));
}
.rozie-text-field-description[data-rozie-s-346ae6aa],
.rozie-text-field-error[data-rozie-s-346ae6aa],
.rozie-text-field-count[data-rozie-s-346ae6aa] {
  margin: 0;
  font-size: var(--rozie-text-field-help-size, var(--rtf-help-size, 0.8125rem));
}
.rozie-text-field-description[data-rozie-s-346ae6aa] {
  color: var(--rozie-text-field-description-color, var(--rtf-description-color, rgba(0, 0, 0, 0.6)));
}
.rozie-text-field-error[data-rozie-s-346ae6aa] {
  color: var(--rozie-text-field-error-color, var(--rtf-error-color, #dc2626));
}
.rozie-text-field-count[data-rozie-s-346ae6aa] {
  align-self: flex-end;
  color: var(--rozie-text-field-description-color, var(--rtf-description-color, rgba(0, 0, 0, 0.6)));
  font-variant-numeric: tabular-nums;
}
`;

  /**
   * The text in the field (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so `[(ngModel)]` and `[formControl]` bind directly. Written on every keystroke.
   * @example
   * <rozie-text-field .modelValue=${email} @model-value-change=${…} label="Email"></rozie-text-field>
   */
  @property({ type: String, attribute: 'model-value' }) _modelValue_attr: string = '';
  private _modelValueControllable = createLitControllableProperty<string>({ host: this, eventName: 'model-value-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * Visible label text, rendered as a `<label>` whose `for` points at the control. Leave it empty and set `ariaLabel` when the field has no visible label.
   */
  @property({ type: String, reflect: true }) label: string = '';
  /**
   * Help text shown under the control and linked to it through `aria-describedby`, so screen readers announce it after the label.
   */
  @property({ type: String, reflect: true }) description: string = '';
  /**
   * Error message. A non-empty value renders it under the control, links it through `aria-describedby`, and marks the control `aria-invalid="true"`. Clear it (empty string) once the value is valid again.
   * @example
   * <rozie-text-field .modelValue=${email} @model-value-change=${…} label="Email" .error=${emailError}></rozie-text-field>
   */
  @property({ type: String, reflect: true }) error: string = '';
  /**
   * Mark the field invalid (`aria-invalid="true"` and the invalid styling) without showing a message, for example when the message is rendered elsewhere. A non-empty `error` implies this.
   */
  @property({ type: Boolean, reflect: true }) invalid: boolean = false;
  /**
   * The native input `type`: `'text'`, `'email'`, `'password'`, `'search'`, `'tel'` or `'url'`. Ignored when `multiline` is set.
   */
  @property({ type: String, reflect: true }) type: string = 'text';
  /**
   * Placeholder text shown while the field is empty. It is not a substitute for `label`: it disappears on input and many screen readers do not announce it.
   */
  @property({ type: String, reflect: true }) placeholder: string = '';
  /**
   * The native `name` attribute, used when the field sits in a plain HTML `<form>`. On Lit the control is in a shadow root, so it does not join the outer form; bind `modelValue` there.
   */
  @property({ type: String, reflect: true }) name: string = '';
  /**
   * The native `autocomplete` hint (e.g. `'email'`, `'current-password'`, `'off'`). Empty leaves the browser default.
   */
  @property({ type: String, reflect: true }) autocomplete: string = '';
  /**
   * Mark the field required: sets the native `required` attribute (announced by screen readers) and shows a `*` after the label. The marker is `aria-hidden` so it is not read twice.
   */
  @property({ type: Boolean, reflect: true }) required: boolean = false;
  /**
   * Disable the control. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Make the control read-only: the text is shown, focusable and selectable but cannot be edited.
   */
  @property({ type: Boolean, reflect: true }) readonly: boolean = false;
  /**
   * Maximum number of characters, forwarded as the native `maxlength`. `null` (the default) means no limit. With `showCount`, the counter reads `n / maxLength`.
   */
  @property({ type: Number, reflect: true, attribute: 'max-length' }) maxLength: number | null = null;
  /**
   * Show a character counter under the control (`n / maxLength`, or just `n` without a limit). The counter is linked through `aria-describedby`; it is not a live region, so it does not interrupt typing.
   */
  @property({ type: Boolean, reflect: true, attribute: 'show-count' }) showCount: boolean = false;
  /**
   * Render a `<textarea>` instead of an `<input>`.
   */
  @property({ type: Boolean, reflect: true }) multiline: boolean = false;
  /**
   * Visible rows of a `multiline` field (the native `rows`). With `autosize` it is the minimum height.
   */
  @property({ type: Number, reflect: true }) rows: number = 3;
  /**
   * Grow a `multiline` field to fit its content, from `rows` up to `maxRows`. It re-measures on input, on programmatic `modelValue` changes and when the field width changes.
   * @example
   * <rozie-text-field .modelValue=${notes} @model-value-change=${…} label="Notes" multiline autosize .maxRows=${8}></rozie-text-field>
   */
  @property({ type: Boolean, reflect: true }) autosize: boolean = false;
  /**
   * The tallest an `autosize` field grows, in rows; past it the textarea scrolls. `null` (the default) means no cap.
   */
  @property({ type: Number, reflect: true, attribute: 'max-rows' }) maxRows: number | null = null;
  /**
   * Accessible name for the control (`aria-label`) when there is no visible `label`.
   */
  @property({ type: String, reflect: true, attribute: 'aria-label' }) ariaLabel: string | null = null;
  /**
   * Id base for the control and its text: the control is `idBase + '-input'`, and the description, error and counter are `-description`, `-error` and `-count`. Leave it empty (the default) and each instance generates a unique base after mount (`rozie-text-field-<n>`); set it when you need stable ids, for example to point an external element at the control. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  @property({ type: String, reflect: true, attribute: 'id-base' }) idBase: string = '';
  private _autoId = signal('');
  @query('[data-rozie-ref="textareaEl"]') private _refTextareaEl!: HTMLElement;
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieFirstUpdateDone = false;

  @state() private _hasSlotPrefix = false;
  @queryAssignedElements({ slot: 'prefix', flatten: true }) private _slotPrefixElements!: Element[];
  @state() private _hasSlotSuffix = false;
  @queryAssignedElements({ slot: 'suffix', flatten: true }) private _slotSuffixElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="prefix"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotPrefix = this._slotPrefixElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="suffix"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSuffix = this._slotSuffixElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotPrefix = Array.from(this.children).some((el) => el.getAttribute('slot') === 'prefix');
    this._hasSlotSuffix = Array.from(this.children).some((el) => el.getAttribute('slot') === 'suffix');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push((() => {
      this.unmounted = true;
      this.observeWidth(null);
      if (this.resetForm) this.resetForm.removeEventListener('reset', this.onFormReset);
      this.resetForm = null;
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.modelValue)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => this.fitLater())(); }); }));

    this.unmounted = false;
    // Generated even when idBase is set, so clearing idBase later still leaves
    // this instance its own ids.
    this._autoId.value = 'rozie-text-field-' + this.nextAutoId();
    this.fit();
    const el: any = this.control();
    this.resetForm = el && el.form ? el.form : null;
    if (this.resetForm) this.resetForm.addEventListener('reset', this.onFormReset);
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('multiline'))) { const __watchVal = (() => this.multiline)(); (() => this.fitLater())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('autosize'))) { const __watchVal = (() => this.autosize)(); (() => this.fitLater())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('rows'))) { const __watchVal = (() => this.rows)(); (() => this.fitLater())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('maxRows'))) { const __watchVal = (() => this.maxRows)(); (() => this.fitLater())(); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'model-value') this._modelValueControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-text-field": true, 'rozie-text-field--invalid': this.isInvalid(), 'rozie-text-field--disabled': this.disabled, 'rozie-text-field--multiline': this.multiline, 'rozie-text-field--autosize': this.multiline && this.autosize }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-346ae6aa>
  ${this.label ? html`<label class="rozie-text-field-label" for=${rozieAttr(this.inputId())} data-rozie-s-346ae6aa>${this.label}${this.required ? html`<span class="rozie-text-field-required" aria-hidden="true" data-rozie-s-346ae6aa>*</span>` : nothing}</label>` : nothing}<div class="rozie-text-field-control" data-rozie-s-346ae6aa>
    ${this._hasSlotPrefix ? html`<span class="rozie-text-field-prefix" data-rozie-s-346ae6aa><slot name="prefix"></slot></span>` : nothing}${this.multiline ? html`<textarea class="rozie-text-field-input" id=${rozieAttr(this.inputId())} .value=${this.currentText()} rows=${this.rows} name=${rozieAttr(this.optionalAttr(this.name))} placeholder=${rozieAttr(this.optionalAttr(this.placeholder))} autocomplete=${rozieAttr(this.optionalAttr(this.autocomplete))} maxlength=${rozieAttr(this.maxLength)} ?required=${!!this.required} ?disabled=${!!this.disabled} ?readonly=${!!this.readonly} aria-label=${rozieAttr(this.ariaLabel)} aria-invalid=${rozieAttr(this.isInvalid() ? 'true' : null)} aria-describedby=${rozieAttr(this.describedBy())} @input=${($event: InputEvent & { currentTarget: HTMLTextAreaElement; target: HTMLTextAreaElement }) => { this.onInput($event); }} @change=${($event: Event & { currentTarget: HTMLTextAreaElement; target: HTMLTextAreaElement }) => { $event.stopPropagation(); this.onChange($event); }} data-rozie-ref="textareaEl" data-rozie-s-346ae6aa></textarea>` : nothing}${!this.multiline ? html`<input class="rozie-text-field-input" id=${rozieAttr(this.inputId())} type=${rozieAttr(this.inputType())} .value=${this.currentText()} name=${rozieAttr(this.optionalAttr(this.name))} placeholder=${rozieAttr(this.optionalAttr(this.placeholder))} autocomplete=${rozieAttr(this.optionalAttr(this.autocomplete))} maxlength=${rozieAttr(this.maxLength)} ?required=${!!this.required} ?disabled=${!!this.disabled} ?readonly=${!!this.readonly} aria-label=${rozieAttr(this.ariaLabel)} aria-invalid=${rozieAttr(this.isInvalid() ? 'true' : null)} aria-describedby=${rozieAttr(this.describedBy())} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInput($event); }} @change=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { $event.stopPropagation(); this.onChange($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} data-rozie-ref="inputEl" data-rozie-s-346ae6aa />` : nothing}${this._hasSlotSuffix ? html`<span class="rozie-text-field-suffix" data-rozie-s-346ae6aa><slot name="suffix"></slot></span>` : nothing}</div>

  ${this.description ? html`<p class="rozie-text-field-description" id=${rozieAttr(this.descriptionId())} data-rozie-s-346ae6aa>${this.description}</p>` : nothing}${this.hasError() ? html`<p class="rozie-text-field-error" id=${rozieAttr(this.errorId())} data-rozie-s-346ae6aa>${this.error}</p>` : nothing}${this.showCount ? html`<p class="rozie-text-field-count" id=${rozieAttr(this.countId())} data-rozie-s-346ae6aa>${rozieDisplay(this.countText())}</p>` : nothing}</div>
`;
  }

  widthObserver: any = null;

  observedEl: any = null;

  lastWidth = -1;

  // Whether fit() has written an inline height, so turning `autosize` off can
  // remove it (and never touches a height the user set with the resize grip).
  autosized = false;

  // Set by the unmount cleanup, so a re-fit still pending then does nothing (on
  // Lit, Angular and Solid the element refs outlive the unmount).
  unmounted = false;

  resetForm: any = null;

  // The page-wide id counter (the same four lines as Combobox / Listbox / Popover).
  nextAutoId = () => {
  const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
  Reflect.set(globalThis, '__rozieAutoId', n);
  return n;
};

  // ---- ids -------------------------------------------------------------------
  idRoot = () => this.idBase || this._autoId.value || 'rozie-text-field';

  inputId = () => this.idRoot() + '-input';

  descriptionId = () => this.idRoot() + '-description';

  errorId = () => this.idRoot() + '-error';

  countId = () => this.idRoot() + '-count';

  // ---- derived state ---------------------------------------------------------
  hasError = () => typeof this.error === 'string' && this.error.length > 0;

  isInvalid = () => !!this.invalid || this.hasError();

  currentText = () => this.modelValue == null ? '' : String(this.modelValue);

  // Read once into a local: Angular does not narrow across two signal calls.
  hasLimit = () => {
  const limit = this.maxLength;
  return typeof limit === 'number' && limit >= 0;
};

  countText = () => {
  const n = this.currentText().length;
  return this.hasLimit() ? n + ' / ' + this.maxLength : String(n);
};

  // The ids of the rendered helper text, space-joined, or null when there is none.
  describedBy = () => {
  const ids: string[] = [];
  if (this.description) ids.push(this.descriptionId());
  if (this.hasError()) ids.push(this.errorId());
  if (this.showCount) ids.push(this.countId());
  return ids.length > 0 ? ids.join(' ') : null;
};

  inputType = () => this.type ? this.type : 'text';

  // An optional string attribute: omitted when empty. Untyped param → `any`, so it
  // feeds strict DOM attribute types on every target (Vue's `string | undefined`,
  // Svelte's closed `autocomplete` union) without a per-target cast.
  optionalAttr = (v: any) => v ? v : undefined;

  // ---- autosize --------------------------------------------------------------
  // A width change re-wraps the text, so an autosized textarea is observed and
  // re-measured. Only a WIDTH change counts: our own height write must not loop
  // the observer. Re-targets when the textarea is (re)mounted by `multiline`.
  // The re-fit waits for the next frame: changing the observed element's height
  // inside the callback is the "ResizeObserver loop completed with undelivered
  // notifications" error.
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
    requestAnimationFrame(() => this.fit());
  });
  this.widthObserver.observe(el);
};

  fit = () => {
  if (this.unmounted) return;
  const el = this.multiline ? this._refTextareaEl : null;
  if (!el || !this.autosize) {
    this.observeWidth(null);
    if (el && this.autosized) {
      el.style.height = '';
      el.style.overflowY = '';
    }
    this.autosized = false;
    return;
  }
  this.observeWidth(el);
  applyAutosize(el, this.rows, this.maxRows);
  this.autosized = true;
};

  // Re-measure once every target has rendered the change: a macrotask, because
  // Lit applies its update in a microtask of its own.
  fitLater = () => {
  setTimeout(() => this.fit(), 0);
};

  // ---- handlers --------------------------------------------------------------
  control = () => this.multiline ? this._refTextareaEl : this._refInputEl;

  // Named commitText, NOT writeValue (the generated Angular CVA method).
  commitText = (text: any) => {
  this._modelValueControllable.write(text);
};

  onInput = (e: any) => {
  this.commitText(e && e.target ? e.target.value : '');
  this.fit();
};

  // `change` = the DOM `change` event: the user committed an edit (blurred after
  // changing the text, or pressed Enter where the browser commits on it). A
  // programmatic write never fires it. The template stops the native event so it
  // can't bubble out alongside this component's own `change` (Angular has no
  // shadow boundary to contain it).
  onChange = (e: any) => {
  this.dispatchEvent(new CustomEvent<TextFieldValuePayload>("change", {
    detail: {
      value: e && e.target ? e.target.value : this.currentText()
    },
    bubbles: true,
    composed: true
  }));
};

  // Enter that confirms an IME composition is not a commit. React's synthetic
  // event has no `isComposing`, so read the native event; Safari reports the
  // confirming Enter with keyCode 229 and `isComposing` false.
  onKeydown = (e: any) => {
  if (!e || e.key !== 'Enter' || e.repeat) return;
  const ne = e.nativeEvent ?? e;
  if (ne.isComposing || ne.keyCode === 229) return;
  this.dispatchEvent(new CustomEvent<TextFieldValuePayload>("enter", {
    detail: {
      value: e.target ? e.target.value : this.currentText()
    },
    bubbles: true,
    composed: true
  }));
};

  // ---- lifecycle -------------------------------------------------------------
  // A form reset puts the control back to its default value without an input
  // event. Vue, Svelte, Angular and Solid set the value as a property only, so
  // the control empties while modelValue (and the counter, the autosize height,
  // an Angular FormControl) keep the old text. The reset event fires before the
  // reset, so the control is read a task later.
  onFormReset = () => {
  setTimeout(() => {
    if (this.unmounted) return;
    const el: any = this.control();
    if (el && el.value !== this.currentText()) this.commitText(el.value);
    this.fit();
  }, 0);
};

  // ---- imperative handle -----------------------------------------------------
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

  get modelValue(): string { return this._modelValueControllable.read(); }
  set modelValue(v: string) { this._modelValueControllable.notifyPropertyWrite(v); }

  addEventListener<K extends keyof RozieTextFieldEventMap>(type: K, listener: (this: TextField, ev: RozieTextFieldEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
    super.addEventListener(type, listener, options);
  }
  removeEventListener<K extends keyof RozieTextFieldEventMap>(type: K, listener: (this: TextField, ev: RozieTextFieldEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, options);
  }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'model-value', 'modelvalue', 'label', 'description', 'error', 'invalid', 'type', 'placeholder', 'name', 'autocomplete', 'required', 'disabled', 'readonly', 'max-length', 'maxlength', 'show-count', 'showcount', 'multiline', 'rows', 'autosize', 'max-rows', 'maxrows', 'aria-label', 'arialabel', 'id-base', 'idbase']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
