import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { clsx, rozieAttr, rozieDisplay, rozieNativeListeners, useControllableState } from '@rozie/runtime-react';
import './TextField.css';
import { applyAutosize } from './internal/autosize';

// Top-level so React hoists it to a ref and the Solid onMount/onCleanup split
// sees it in teardown.

/** The `change` and `enter` event payload: the field's current text. */
export interface TextFieldValuePayload {
  value: string;
}

interface TextFieldProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'modelValue' | 'defaultModelValue' | 'onModelValueChange' | 'label' | 'description' | 'error' | 'invalid' | 'type' | 'placeholder' | 'name' | 'autocomplete' | 'required' | 'disabled' | 'readonly' | 'maxLength' | 'showCount' | 'multiline' | 'rows' | 'autosize' | 'maxRows' | 'ariaLabel' | 'idBase' | 'onChange' | 'onEnter' | 'renderPrefix' | 'renderSuffix' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  /**
   * The text in the field (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so `[(ngModel)]` and `[formControl]` bind directly. Written on every keystroke.
   * @example
   * <TextField modelValue={email} onModelValueChange={setEmail} label="Email" />
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
   * <TextField modelValue={email} onModelValueChange={setEmail} label="Email" error={emailError} />
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
   * <TextField modelValue={notes} onModelValueChange={setNotes} label="Notes" multiline autosize maxRows={8} />
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
  renderPrefix?: () => ReactNode;
  renderSuffix?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface TextFieldHandle {
  focus: () => void;
  select: () => void;
  clear: () => void;
}

const TextField = forwardRef<TextFieldHandle, TextFieldProps>(function TextField(_props: TextFieldProps, ref): JSX.Element {
  const props: Omit<TextFieldProps, 'label' | 'description' | 'error' | 'invalid' | 'type' | 'placeholder' | 'name' | 'autocomplete' | 'required' | 'disabled' | 'readonly' | 'maxLength' | 'showCount' | 'multiline' | 'rows' | 'autosize' | 'maxRows' | 'ariaLabel' | 'idBase'> & { label: string; description: string; error: string; invalid: boolean; type: string; placeholder: string; name: string; autocomplete: string; required: boolean; disabled: boolean; readonly: boolean; maxLength: (number) | null; showCount: boolean; multiline: boolean; rows: number; autosize: boolean; maxRows: (number) | null; ariaLabel: (string) | null; idBase: string } = {
    ..._props,
    label: _props.label ?? '',
    description: _props.description ?? '',
    error: _props.error ?? '',
    invalid: _props.invalid ?? false,
    type: _props.type ?? 'text',
    placeholder: _props.placeholder ?? '',
    name: _props.name ?? '',
    autocomplete: _props.autocomplete ?? '',
    required: _props.required ?? false,
    disabled: _props.disabled ?? false,
    readonly: _props.readonly ?? false,
    maxLength: _props.maxLength ?? null,
    showCount: _props.showCount ?? false,
    multiline: _props.multiline ?? false,
    rows: _props.rows ?? 3,
    autosize: _props.autosize ?? false,
    maxRows: _props.maxRows ?? null,
    ariaLabel: _props.ariaLabel ?? null,
    idBase: _props.idBase ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { modelValue, label, description, error, invalid, type, placeholder, name, autocomplete, required, disabled, readonly, maxLength, showCount, multiline, rows, autosize, maxRows, ariaLabel, idBase, defaultValue, onModelValueChange, defaultModelValue, onChange, onEnter, renderPrefix, renderSuffix, slots, ...rest } = _props as TextFieldProps & Record<string, unknown>;
    void modelValue; void label; void description; void error; void invalid; void type; void placeholder; void name; void autocomplete; void required; void disabled; void readonly; void maxLength; void showCount; void multiline; void rows; void autosize; void maxRows; void ariaLabel; void idBase; void defaultValue; void onModelValueChange; void defaultModelValue; void onChange; void onEnter; void renderPrefix; void renderSuffix; void slots;
    return rest;
  })();
  const autosized = useRef(false);
  const observedEl = useRef<any>(null);
  const widthObserver = useRef<any>(null);
  const lastWidth = useRef(-1);
  const [modelValue, setModelValue] = useControllableState({
    value: props.modelValue,
    defaultValue: props.defaultModelValue ?? '',
    onValueChange: props.onModelValueChange,
  });
  const _idBaseRef = useRef(props.idBase);
  _idBaseRef.current = props.idBase;
  const [autoId, setAutoId] = useState('');
  const textareaEl = useRef<HTMLTextAreaElement | null>(null);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);

  // Whether fit() has written an inline height, so turning `autosize` off can
  // remove it (and never touches a height the user set with the resize grip).
  // Top-level so React hoists it to a ref and the Solid onMount/onCleanup split
  // sees it in teardown.
  // The page-wide id counter (the same four lines as Combobox / Listbox / Popover).
  const nextAutoId = useCallback(() => {
    const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
    Reflect.set(globalThis, '__rozieAutoId', n);
    return n;
  }, []);
  // ---- ids -------------------------------------------------------------------
  function idRoot() {
    return props.idBase || autoId || 'rozie-text-field';
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
    return typeof props.error === 'string' && props.error.length > 0;
  }
  function isInvalid() {
    return !!props.invalid || hasError();
  }
  function currentText() {
    return modelValue == null ? '' : String(modelValue);
  }
  // Read once into a local: Angular does not narrow across two signal calls.
  function hasLimit() {
    const limit = props.maxLength;
    return typeof limit === 'number' && limit >= 0;
  }
  function countText() {
    const n = currentText().length;
    return hasLimit() ? n + ' / ' + props.maxLength : String(n);
  }

  // The ids of the rendered helper text, space-joined, or null when there is none.
  function describedBy() {
    const ids: string[] = [];
    if (props.description) ids.push(descriptionId());
    if (hasError()) ids.push(errorId());
    if (props.showCount) ids.push(countId());
    return ids.length > 0 ? ids.join(' ') : null;
  }
  function inputType() {
    return props.type ? props.type : 'text';
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
  const _rozieFwd_fit = useRef<typeof fit>(null!);
  const observeWidth = useCallback((el: any) => {
    if (el === observedEl.current) return;
    if (widthObserver.current) widthObserver.current.disconnect();
    widthObserver.current = null;
    observedEl.current = el;
    lastWidth.current = -1;
    if (!el || typeof ResizeObserver === 'undefined') return;
    widthObserver.current = new ResizeObserver((entries: any) => {
      const w = entries[0] ? entries[0].contentRect.width : -1;
      if (w === lastWidth.current) return;
      lastWidth.current = w;
      _rozieFwd_fit.current();
    });
    widthObserver.current.observe(el);
  }, []);
  const fit = useCallback(() => {
    const el = props.multiline ? textareaEl.current : null;
    if (!el || !props.autosize) {
      observeWidth(null);
      if (el && autosized.current) {
        el.style.height = '';
        el.style.overflowY = '';
      }
      autosized.current = false;
      return;
    }
    observeWidth(el);
    applyAutosize(el, props.rows, props.maxRows);
    autosized.current = true;
  }, [observeWidth, props.autosize, props.maxRows, props.multiline, props.rows]);
  _rozieFwd_fit.current = fit;
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
  const onInput = useCallback((e: any) => {
    commitText(e && e.target ? e.target.value : '');
    fit();
  }, [commitText, fit]);
  // `change` = the DOM `change` event: the user committed an edit (blurred after
  // changing the text, or pressed Enter where the browser commits on it). A
  // programmatic write never fires it. The template stops the native event so it
  // can't bubble out alongside this component's own `change` (Angular has no
  // shadow boundary to contain it).
  const { onChange: _rozieProp_onChange } = props;
    const onChange = useCallback((e: any) => {
    _rozieProp_onChange && _rozieProp_onChange({
      value: e && e.target ? e.target.value : currentText()
    });
  }, [_rozieProp_onChange, currentText]);
  const { onEnter: _rozieProp_onEnter } = props;
    const onKeydown = useCallback((e: any) => {
    if (!e || e.key !== 'Enter' || e.isComposing) return;
    _rozieProp_onEnter && _rozieProp_onEnter({
      value: e.target ? e.target.value : currentText()
    });
  }, [_rozieProp_onEnter, currentText]);
  // ---- lifecycle -------------------------------------------------------------
  // ---- imperative handle -----------------------------------------------------
  function control() {
    return props.multiline ? textareaEl.current : inputEl.current;
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

  const _fitRef = useRef(fit);
  _fitRef.current = fit;
  const _observeWidthRef = useRef(observeWidth);
  _observeWidthRef.current = observeWidth;
  useEffect(() => {
    if (!_idBaseRef.current) setAutoId('rozie-text-field-' + nextAutoId());
    _fitRef.current();
    return () => {
      _observeWidthRef.current(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    fitLater();
  }, [modelValue]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    fitLater();
  }, [props.multiline]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    fitLater();
  }, [props.autosize]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    fitLater();
  }, [props.rows]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    fitLater();
  }, [props.maxRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ focus, select, clear });
  _rozieExposeRef.current = { focus, select, clear };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => flushSync(() => _rozieExposeRef.current.focus(...args)), select: (...args: Parameters<typeof select>): ReturnType<typeof select> => flushSync(() => _rozieExposeRef.current.select(...args)), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => flushSync(() => _rozieExposeRef.current.clear(...args)) }), []);

  return (
    <>
    <div {...attrs} className={clsx(clsx("rozie-text-field", { "rozie-text-field--invalid": isInvalid(), "rozie-text-field--disabled": props.disabled, "rozie-text-field--multiline": props.multiline, "rozie-text-field--autosize": props.multiline && props.autosize }), (attrs.className as string | undefined))} data-rozie-s-346ae6aa="">
      {!!(props.label) && <label className={"rozie-text-field-label"} htmlFor={rozieAttr(inputId())} data-rozie-s-346ae6aa="">{props.label}{!!(props.required) && <span className={"rozie-text-field-required"} aria-hidden="true" data-rozie-s-346ae6aa="">*</span>}</label>}<div className={"rozie-text-field-control"} data-rozie-s-346ae6aa="">
        {!!((props.renderPrefix ?? props.slots?.['prefix'])) && <span className={"rozie-text-field-prefix"} data-rozie-s-346ae6aa="">{(props.renderPrefix ?? props.slots?.['prefix'])?.()}</span>}{!!(props.multiline) && <textarea className={"rozie-text-field-input"} id={rozieAttr(inputId())} value={currentText()} rows={props.rows} name={rozieAttr(optionalAttr(props.name))} placeholder={rozieAttr(optionalAttr(props.placeholder))} autoComplete={rozieAttr(optionalAttr(props.autocomplete))} maxLength={(props.maxLength) ?? undefined} required={!!props.required} disabled={!!props.disabled} readOnly={!!props.readonly} aria-label={rozieAttr(props.ariaLabel)} aria-invalid={rozieAttr(isInvalid() ? 'true' : undefined)} aria-describedby={rozieAttr(describedBy())} onInput={($event) => { onInput($event); }} ref={rozieNativeListeners<HTMLTextAreaElement>([["change", ($event) => { $event.stopPropagation(); onChange($event); }]], textareaEl)} data-rozie-s-346ae6aa="" />}{!!(!props.multiline) && <input className={"rozie-text-field-input"} id={rozieAttr(inputId())} type={rozieAttr(inputType())} value={currentText()} name={rozieAttr(optionalAttr(props.name))} placeholder={rozieAttr(optionalAttr(props.placeholder))} autoComplete={rozieAttr(optionalAttr(props.autocomplete))} maxLength={(props.maxLength) ?? undefined} required={!!props.required} disabled={!!props.disabled} readOnly={!!props.readonly} aria-label={rozieAttr(props.ariaLabel)} aria-invalid={rozieAttr(isInvalid() ? 'true' : undefined)} aria-describedby={rozieAttr(describedBy())} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} ref={rozieNativeListeners<HTMLInputElement>([["change", ($event) => { $event.stopPropagation(); onChange($event); }]], inputEl)} data-rozie-s-346ae6aa="" />}{!!((props.renderSuffix ?? props.slots?.['suffix'])) && <span className={"rozie-text-field-suffix"} data-rozie-s-346ae6aa="">{(props.renderSuffix ?? props.slots?.['suffix'])?.()}</span>}</div>

      {!!(props.description) && <p className={"rozie-text-field-description"} id={rozieAttr(descriptionId())} data-rozie-s-346ae6aa="">{props.description}</p>}{!!(hasError()) && <p className={"rozie-text-field-error"} id={rozieAttr(errorId())} data-rozie-s-346ae6aa="">{props.error}</p>}{!!(props.showCount) && <p className={"rozie-text-field-count"} id={rozieAttr(countId())} data-rozie-s-346ae6aa="">{rozieDisplay(countText())}</p>}</div>
    </>
  );
});
export default TextField;
