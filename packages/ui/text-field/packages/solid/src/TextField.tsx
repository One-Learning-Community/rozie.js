import type { JSX } from 'solid-js';
import { Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import { applyAutosize } from './internal/autosize';

// Top-level so React hoists it to a ref and the Solid onMount/onCleanup split
// sees it in teardown.

/** The `change` and `enter` event payload: the field's current text. */
export interface TextFieldValuePayload {
  value: string;
}

__rozieInjectStyle('TextField-346ae6aa', `.rozie-text-field[data-rozie-s-346ae6aa] {
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
}`);

interface TextFieldProps extends Omit<import('solid-js').ComponentProps<'div'>, 'modelValue' | 'defaultModelValue' | 'onModelValueChange' | 'label' | 'description' | 'error' | 'invalid' | 'type' | 'placeholder' | 'name' | 'autocomplete' | 'required' | 'disabled' | 'readonly' | 'maxLength' | 'showCount' | 'multiline' | 'rows' | 'autosize' | 'maxRows' | 'ariaLabel' | 'idBase' | 'onChange' | 'onEnter' | 'prefixSlot' | 'suffixSlot' | 'slots' | 'ref' | 'children' | 'innerHTML' | 'innerText' | 'textContent'> {
  /**
   * The text in the field (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so `[(ngModel)]` and `[formControl]` bind directly. Written on every keystroke.
   * @example
   * <TextField modelValue={email()} onModelValueChange={setEmail} label="Email" />
   */
  modelValue?: string;
  defaultModelValue?: string;
  onModelValueChange?: (modelValue: string) => void;
  /**
   * Visible label text, rendered as a `<label>` whose `for` points at the control. Leave it empty and set `ariaLabel` when the field has no visible label.
   */
  label?: string;
  /**
   * Help text shown under the control and linked to it through `aria-describedby`, so screen readers announce it after the label.
   */
  description?: string;
  /**
   * Error message. A non-empty value renders it under the control, links it through `aria-describedby`, and marks the control `aria-invalid="true"`. Clear it (empty string) once the value is valid again.
   * @example
   * <TextField modelValue={email()} onModelValueChange={setEmail} label="Email" error={emailError} />
   */
  error?: string;
  /**
   * Mark the field invalid (`aria-invalid="true"` and the invalid styling) without showing a message, for example when the message is rendered elsewhere. A non-empty `error` implies this.
   */
  invalid?: boolean;
  /**
   * The native input `type`: `'text'`, `'email'`, `'password'`, `'search'`, `'tel'` or `'url'`. Ignored when `multiline` is set.
   */
  type?: string;
  /**
   * Placeholder text shown while the field is empty. It is not a substitute for `label`: it disappears on input and many screen readers do not announce it.
   */
  placeholder?: string;
  /**
   * The native `name` attribute, used when the field sits in a plain HTML `<form>`. On Lit the control is in a shadow root, so it does not join the outer form; bind `modelValue` there.
   */
  name?: string;
  /**
   * The native `autocomplete` hint (e.g. `'email'`, `'current-password'`, `'off'`). Empty leaves the browser default.
   */
  autocomplete?: string;
  /**
   * Mark the field required: sets the native `required` attribute (announced by screen readers) and shows a `*` after the label. The marker is `aria-hidden` so it is not read twice.
   */
  required?: boolean;
  /**
   * Disable the control. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Make the control read-only: the text is shown, focusable and selectable but cannot be edited.
   */
  readonly?: boolean;
  /**
   * Maximum number of characters, forwarded as the native `maxlength`. `null` (the default) means no limit. With `showCount`, the counter reads `n / maxLength`.
   */
  maxLength?: (number) | null;
  /**
   * Show a character counter under the control (`n / maxLength`, or just `n` without a limit). The counter is linked through `aria-describedby`; it is not a live region, so it does not interrupt typing.
   */
  showCount?: boolean;
  /**
   * Render a `<textarea>` instead of an `<input>`.
   */
  multiline?: boolean;
  /**
   * Visible rows of a `multiline` field (the native `rows`). With `autosize` it is the minimum height.
   */
  rows?: number;
  /**
   * Grow a `multiline` field to fit its content, from `rows` up to `maxRows`. It re-measures on input, on programmatic `modelValue` changes and when the field width changes.
   * @example
   * <TextField modelValue={notes()} onModelValueChange={setNotes} label="Notes" multiline autosize maxRows={8} />
   */
  autosize?: boolean;
  /**
   * The tallest an `autosize` field grows, in rows; past it the textarea scrolls. `null` (the default) means no cap.
   */
  maxRows?: (number) | null;
  /**
   * Accessible name for the control (`aria-label`) when there is no visible `label`.
   */
  ariaLabel?: (string) | null;
  /**
   * Id base for the control and its text: the control is `idBase + '-input'`, and the description, error and counter are `-description`, `-error` and `-count`. Leave it empty (the default) and each instance generates a unique base after mount (`rozie-text-field-<n>`); set it when you need stable ids, for example to point an external element at the control. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  onChange?: (payload: TextFieldValuePayload) => void;
  onEnter?: (payload: TextFieldValuePayload) => void;
  prefixSlot?: JSX.Element;
  suffixSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: TextFieldHandle) => void;
}

export interface TextFieldHandle {
  focus: () => void;
  select: () => void;
  clear: () => void;
}

export default function TextField(_props: TextFieldProps): JSX.Element {
  const _merged = mergeProps({ label: '', description: '', error: '', invalid: false, type: 'text', placeholder: '', name: '', autocomplete: '', required: false, disabled: false, readonly: false, maxLength: null, showCount: false, multiline: false, rows: 3, autosize: false, maxRows: null, ariaLabel: null, idBase: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['modelValue', 'label', 'description', 'error', 'invalid', 'type', 'placeholder', 'name', 'autocomplete', 'required', 'disabled', 'readonly', 'maxLength', 'showCount', 'multiline', 'rows', 'autosize', 'maxRows', 'ariaLabel', 'idBase', 'ref', 'onChange', 'onEnter', 'prefixSlot', 'suffixSlot', 'slots']);
  onMount(() => { local.ref?.({ focus, select, clear }); });

  const [modelValue, setModelValue] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'modelValue', '');
  const [autoId, setAutoId] = createSignal('');
  createEffect(on(() => (() => modelValue())(), (v) => untrack(() => (() => fitLater())()), { defer: true }));
  createEffect(on(() => (() => local.multiline)(), (v) => untrack(() => (() => fitLater())()), { defer: true }));
  createEffect(on(() => (() => local.autosize)(), (v) => untrack(() => (() => fitLater())()), { defer: true }));
  createEffect(on(() => (() => local.rows)(), (v) => untrack(() => (() => fitLater())()), { defer: true }));
  createEffect(on(() => (() => local.maxRows)(), (v) => untrack(() => (() => fitLater())()), { defer: true }));
  onMount(() => {
    const _cleanup = (() => {
    if (!local.idBase) setAutoId('rozie-text-field-' + nextAutoId());
    fit();
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    observeWidth(null);
  });
  });
  let textareaElRef: HTMLElement | null = null;
  let inputElRef: HTMLElement | null = null;

  // Top-level so React hoists it to a ref and the Solid onMount/onCleanup split
  // sees it in teardown.
  let widthObserver: any = null;
  let observedEl: any = null;
  let lastWidth = -1;
  // Whether fit() has written an inline height, so turning `autosize` off can
  // remove it (and never touches a height the user set with the resize grip).
  let autosized = false;

  // The page-wide id counter (the same four lines as Combobox / Listbox / Popover).
  function nextAutoId() {
    const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
    Reflect.set(globalThis, '__rozieAutoId', n);
    return n;
  }

  // ---- ids -------------------------------------------------------------------
  function idRoot() {
    return local.idBase || autoId() || 'rozie-text-field';
  }
  function inputId() {
    return idRoot() + '-input';
  }
  function descriptionId() {
    return idRoot() + '-description';
  }
  function errorId() {
    return idRoot() + '-error';
  }
  function countId() {
    return idRoot() + '-count';
  }

  // ---- derived state ---------------------------------------------------------
  function hasError() {
    return typeof local.error === 'string' && local.error.length > 0;
  }
  function isInvalid() {
    return !!local.invalid || hasError();
  }
  function currentText() {
    return modelValue() == null ? '' : String(modelValue());
  }
  // Read once into a local: Angular does not narrow across two signal calls.
  function hasLimit() {
    const limit = local.maxLength;
    return typeof limit === 'number' && limit >= 0;
  }
  function countText() {
    const n = currentText().length;
    return hasLimit() ? n + ' / ' + local.maxLength : String(n);
  }

  // The ids of the rendered helper text, space-joined, or null when there is none.
  function describedBy() {
    const ids: string[] = [];
    if (local.description) ids.push(descriptionId());
    if (hasError()) ids.push(errorId());
    if (local.showCount) ids.push(countId());
    return ids.length > 0 ? ids.join(' ') : null;
  }
  function inputType() {
    return local.type ? local.type : 'text';
  }

  // An optional string attribute: omitted when empty. Untyped param → `any`, so it
  // feeds strict DOM attribute types on every target (Vue's `string | undefined`,
  // Svelte's closed `autocomplete` union) without a per-target cast.
  function optionalAttr(v: any) {
    return v ? v : undefined;
  }

  // ---- autosize --------------------------------------------------------------
  // A width change re-wraps the text, so an autosized textarea is observed and
  // re-measured. Only a WIDTH change counts: our own height write must not loop
  // the observer. Re-targets when the textarea is (re)mounted by `multiline`.
  function observeWidth(el: any) {
    if (el === observedEl) return;
    if (widthObserver) widthObserver.disconnect();
    widthObserver = null;
    observedEl = el;
    lastWidth = -1;
    if (!el || typeof ResizeObserver === 'undefined') return;
    widthObserver = new ResizeObserver((entries: any) => {
      const w = entries[0] ? entries[0].contentRect.width : -1;
      if (w === lastWidth) return;
      lastWidth = w;
      fit();
    });
    widthObserver.observe(el);
  }
  function fit() {
    const el = local.multiline ? textareaElRef : null;
    if (!el || !local.autosize) {
      observeWidth(null);
      if (el && autosized) {
        el.style.height = '';
        el.style.overflowY = '';
      }
      autosized = false;
      return;
    }
    observeWidth(el);
    applyAutosize(el, local.rows, local.maxRows);
    autosized = true;
  }

  // Re-measure once every target has rendered the change: a macrotask, because
  // Lit applies its update in a microtask of its own.
  function fitLater() {
    setTimeout(() => fit(), 0);
  }

  // ---- handlers --------------------------------------------------------------
  // Named commitText, NOT writeValue (the generated Angular CVA method).
  function commitText(text: any) {
    setModelValue(text);
  }
  function onInput(e: any) {
    commitText(e && e.target ? e.target.value : '');
    fit();
  }

  // `change` = the DOM `change` event: the user committed an edit (blurred after
  // changing the text, or pressed Enter where the browser commits on it). A
  // programmatic write never fires it. The template stops the native event so it
  // can't bubble out alongside this component's own `change` (Angular has no
  // shadow boundary to contain it).
  function onChange(e: any) {
    _props.onChange?.({
      value: e && e.target ? e.target.value : currentText()
    });
  }
  function onKeydown(e: any) {
    if (!e || e.key !== 'Enter' || e.isComposing) return;
    _props.onEnter?.({
      value: e.target ? e.target.value : currentText()
    });
  }

  // ---- lifecycle -------------------------------------------------------------

  // ---- imperative handle -----------------------------------------------------
  function control() {
    return local.multiline ? textareaElRef : inputElRef;
  }

  // focus() deliberately overrides HTMLElement.focus on Lit (ROZ137, accepted).
  function focus() {
    const el = control();
    if (el && el.focus) el.focus();
  }

  // select() — focus the control and select all of its text.
  function select() {
    const el: any = control();
    if (!el) return;
    if (el.focus) el.focus();
    if (el.select) el.select();
  }

  // clear() — empty the field (writes modelValue = '').
  function clear() {
    commitText('');
    fit();
  }

  return (
    <>
    <div {...attrs} class={"rozie-text-field" + " " + rozieClass({ 'rozie-text-field--invalid': isInvalid(), 'rozie-text-field--disabled': local.disabled, 'rozie-text-field--multiline': local.multiline, 'rozie-text-field--autosize': local.multiline && local.autosize }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-346ae6aa="">
      {<Show when={local.label}><label class={"rozie-text-field-label"} for={rozieAttr(inputId())} data-rozie-s-346ae6aa="">{local.label}{<Show when={local.required}><span class={"rozie-text-field-required"} aria-hidden="true" data-rozie-s-346ae6aa="">*</span></Show>}</label></Show>}<div class={"rozie-text-field-control"} data-rozie-s-346ae6aa="">
        {<Show when={(_props.prefixSlot ?? _props.slots?.['prefix'])}><span class={"rozie-text-field-prefix"} data-rozie-s-346ae6aa="">{(_props.prefixSlot ?? _props.slots?.['prefix']?.({}))}</span></Show>}{<Show when={local.multiline}><textarea aria-label={rozieAttr(local.ariaLabel)} aria-invalid={rozieAttr(isInvalid() ? 'true' : null)} aria-describedby={rozieAttr(describedBy())} ref={(el) => { textareaElRef = el as HTMLElement; }} class={"rozie-text-field-input"} id={rozieAttr(inputId())} value={currentText()} rows={local.rows} name={rozieAttr(optionalAttr(local.name))} placeholder={rozieAttr(optionalAttr(local.placeholder))} autocomplete={rozieAttr(optionalAttr(local.autocomplete))} maxLength={(local.maxLength) ?? undefined} required={!!local.required} disabled={!!local.disabled} readOnly={!!local.readonly} onInput={($event: InputEvent & { currentTarget: HTMLTextAreaElement; target: Element }) => { onInput($event); }} onChange={($event: Event & { currentTarget: HTMLTextAreaElement; target: Element }) => { $event.stopPropagation(); onChange($event); }} data-rozie-s-346ae6aa="" /></Show>}{<Show when={!local.multiline}><input aria-label={rozieAttr(local.ariaLabel)} aria-invalid={rozieAttr(isInvalid() ? 'true' : null)} aria-describedby={rozieAttr(describedBy())} ref={(el) => { inputElRef = el as HTMLElement; }} class={"rozie-text-field-input"} id={rozieAttr(inputId())} type={rozieAttr(inputType())} value={currentText()} name={rozieAttr(optionalAttr(local.name))} placeholder={rozieAttr(optionalAttr(local.placeholder))} autocomplete={rozieAttr(optionalAttr(local.autocomplete))} maxLength={(local.maxLength) ?? undefined} required={!!local.required} disabled={!!local.disabled} readOnly={!!local.readonly} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onInput($event); }} onChange={($event: Event & { currentTarget: HTMLInputElement; target: Element }) => { $event.stopPropagation(); onChange($event); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onKeydown($event); }} data-rozie-s-346ae6aa="" /></Show>}{<Show when={(_props.suffixSlot ?? _props.slots?.['suffix'])}><span class={"rozie-text-field-suffix"} data-rozie-s-346ae6aa="">{(_props.suffixSlot ?? _props.slots?.['suffix']?.({}))}</span></Show>}</div>

      {<Show when={local.description}><p class={"rozie-text-field-description"} id={rozieAttr(descriptionId())} data-rozie-s-346ae6aa="">{local.description}</p></Show>}{<Show when={hasError()}><p class={"rozie-text-field-error"} id={rozieAttr(errorId())} data-rozie-s-346ae6aa="">{local.error}</p></Show>}{<Show when={local.showCount}><p class={"rozie-text-field-count"} id={rozieAttr(countId())} data-rozie-s-346ae6aa="">{rozieDisplay(countText())}</p></Show>}</div>
    </>
  );
}
