<script module lang="ts">
/** The `change` and `enter` event payload: the field's current text. */
export interface TextFieldValuePayload {
  value: string;
}
</script>
<script lang="ts">
import { applyListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount, untrack } from 'svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'modelValue' | 'label' | 'description' | 'error' | 'invalid' | 'type' | 'placeholder' | 'name' | 'autocomplete' | 'required' | 'disabled' | 'readonly' | 'maxLength' | 'showCount' | 'multiline' | 'rows' | 'autosize' | 'maxRows' | 'ariaLabel' | 'idBase' | 'prefix' | 'suffix' | 'snippets' | 'onchange' | 'onenter' | 'children'> {
  /**
   * The text in the field (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so `[(ngModel)]` and `[formControl]` bind directly. Written on every keystroke.
   * @example
   * <TextField bind:modelValue={email} label="Email" />
   */
  modelValue?: string;
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
   * <TextField bind:modelValue={email} label="Email" error={emailError} />
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
   * <TextField bind:modelValue={notes} label="Notes" multiline autosize maxRows={8} />
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
  prefix?: Snippet;
  suffix?: Snippet;
  snippets?: Record<string, any>;
  onchange?: (payload: TextFieldValuePayload) => void;
  onenter?: (payload: TextFieldValuePayload) => void;
}

let {
  modelValue = $bindable(''),
  label = '',
  description = '',
  error = '',
  invalid = false,
  type = 'text',
  placeholder = '',
  name = '',
  autocomplete = '',
  required = false,
  disabled = false,
  readonly = false,
  maxLength = null,
  showCount = false,
  multiline = false,
  rows = 3,
  autosize = false,
  maxRows = null,
  ariaLabel = null,
  idBase = '',
  prefix: __prefixProp,
  suffix: __suffixProp,
  snippets,
  onchange,
  onenter,
  ...__rozieAttrs
}: Props = $props();

const prefix = $derived(__prefixProp ?? snippets?.prefix);
const suffix = $derived(__suffixProp ?? snippets?.suffix);

let autoId = $state('');

let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined);
let inputEl = $state<HTMLInputElement | undefined>(undefined);

import { applyAutosize } from './internal/autosize';
// Top-level so React hoists it to a ref and the Solid onMount/onCleanup split
// sees it in teardown.
let widthObserver: any = null;
let observedEl: any = null;
let lastWidth = -1;
// Whether fit() has written an inline height, so turning `autosize` off can
// remove it (and never touches a height the user set with the resize grip).
let autosized = false;
// The rows the last fit() used, read by the width observer. The observer
// re-applies through these instead of calling fit(): two helpers calling each
// other are a use-before-declaration error in React's useCallback dep arrays.
let fitRows: any = null;
let fitMaxRows: any = null;
// The text when the control gained focus, and whether the user has typed since.
// `change` fires on blur only for a user edit that changed the text, so a
// programmatic write (clear(), a consumer reformatting the value) never does.
let textAtFocus = '';
let editedSinceFocus = false;
// The page-wide id counter (the same four lines as Combobox / Listbox / Popover).
const nextAutoId = () => {
  const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
  Reflect.set(globalThis, '__rozieAutoId', n);
  return n;
};
// ---- ids -------------------------------------------------------------------
const idRoot = () => idBase || autoId || 'rozie-text-field';
const inputId = () => idRoot() + '-input';
const descriptionId = () => idRoot() + '-description';
const errorId = () => idRoot() + '-error';
const countId = () => idRoot() + '-count';
// ---- derived state ---------------------------------------------------------
const hasError = () => typeof error === 'string' && error.length > 0;
const isInvalid = () => !!invalid || hasError();
const currentText = () => modelValue == null ? '' : String(modelValue);
// Read once into a local: Angular does not narrow across two signal calls.
const hasLimit = () => {
  const limit = maxLength;
  return typeof limit === 'number' && limit >= 0;
};
const countText = () => {
  const n = currentText().length;
  return hasLimit() ? n + ' / ' + maxLength : String(n);
};
// The ids of the rendered helper text, space-joined, or null when there is none.
const describedBy = () => {
  const ids: string[] = [];
  if (description) ids.push(descriptionId());
  if (hasError()) ids.push(errorId());
  if (showCount) ids.push(countId());
  return ids.length > 0 ? ids.join(' ') : null;
};
const inputType = () => type ? type : 'text';
// An optional string attribute: omitted when empty. Untyped param → `any`, so it
// feeds strict DOM attribute types on every target (Vue's `string | undefined`,
// Svelte's closed `autocomplete` union) without a per-target cast.
const optionalAttr = (v: any) => v ? v : undefined;
// ---- autosize --------------------------------------------------------------
// A width change re-wraps the text, so an autosized textarea is observed and
// re-measured. Only a WIDTH change counts: our own height write must not loop
// the observer. Re-targets when the textarea is (re)mounted by `multiline`.
const observeWidth = (el: any) => {
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
    applyAutosize(observedEl, fitRows, fitMaxRows);
  });
  widthObserver.observe(el);
};
const fit = () => {
  const el = multiline ? textareaEl : null;
  if (!el || !autosize) {
    observeWidth(null);
    if (el && autosized) {
      el.style.height = '';
      el.style.overflowY = '';
    }
    autosized = false;
    return;
  }
  fitRows = rows;
  fitMaxRows = maxRows;
  observeWidth(el);
  applyAutosize(el, fitRows, fitMaxRows);
  autosized = true;
};
// Re-measure once every target has rendered the change: a macrotask, because
// Lit applies its update in a microtask of its own.
const fitLater = () => {
  setTimeout(() => fit(), 0);
};
// ---- handlers --------------------------------------------------------------
// Named commitText, NOT writeValue (the generated Angular CVA method).
const commitText = (text: any) => {
  modelValue = text;
};
const onInput = (e: any) => {
  editedSinceFocus = true;
  commitText(e && e.target ? e.target.value : '');
  fit();
};
// `change` = a committed edit: on blur, when the text differs from what it was
// at focus. Driven from focus/blur rather than the native `change` event because
// React's `onChange` (what `@change` lowers to there) fires on every keystroke,
// so the native event would not mean the same thing on all six targets.
const onFocus = (e: any) => {
  textAtFocus = e && e.target ? e.target.value : currentText();
  editedSinceFocus = false;
};
const onBlur = (e: any) => {
  const text = e && e.target ? e.target.value : currentText();
  const changed = editedSinceFocus && text !== textAtFocus;
  editedSinceFocus = false;
  textAtFocus = text;
  if (changed) onchange?.({
    value: text
  });
};
const onKeydown = (e: any) => {
  if (!e || e.key !== 'Enter' || e.isComposing) return;
  onenter?.({
    value: e.target ? e.target.value : currentText()
  });
};

// ---- lifecycle -------------------------------------------------------------
// ---- imperative handle -----------------------------------------------------
const control = () => multiline ? textareaEl : inputEl;
// focus() deliberately overrides HTMLElement.focus on Lit (ROZ137, accepted).
export const focus: () => void = () => {
  const el = control();
  if (el && el.focus) el.focus();
};
// select() — focus the control and select all of its text.
export const select: () => void = () => {
  const el: any = control();
  if (!el) return;
  if (el.focus) el.focus();
  if (el.select) el.select();
};
// clear() — empty the field (writes modelValue = '').
export const clear: () => void = () => {
  commitText('');
  fit();
};

let __rozieWatchInitial_0 = true;
$effect(() => { (() => modelValue)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => fitLater())(); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => multiline)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => fitLater())(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => autosize)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => fitLater())(); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { (() => rows)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } (() => fitLater())(); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { (() => maxRows)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } (() => fitLater())(); }); });

onMount(() => {
  if (!idBase) autoId = 'rozie-text-field-' + nextAutoId();
  fit();
  return () => {
    observeWidth(null);
  };
});
</script>

<div {...__rozieAttrs} class={["rozie-text-field", { 'rozie-text-field--invalid': isInvalid(), 'rozie-text-field--disabled': disabled, 'rozie-text-field--multiline': multiline, 'rozie-text-field--autosize': multiline && autosize }, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-346ae6aa>{#if label}<label class="rozie-text-field-label" for={rozieAttr(inputId())} data-rozie-s-346ae6aa>{label}{#if required}<span class="rozie-text-field-required" aria-hidden="true" data-rozie-s-346ae6aa> *</span>{/if}</label>{/if}<div class="rozie-text-field-control" data-rozie-s-346ae6aa>{#if prefix}<span class="rozie-text-field-prefix" data-rozie-s-346ae6aa>{#if prefix}{@render prefix()}{/if}</span>{/if}{#if multiline}<textarea bind:this={textareaEl} class="rozie-text-field-input" id={rozieAttr(inputId())} value={rozieAttr(currentText())} rows={rows} name={rozieAttr(optionalAttr(name))} placeholder={rozieAttr(optionalAttr(placeholder))} autocomplete={rozieAttr(optionalAttr(autocomplete))} maxlength={maxLength} required={!!required} disabled={!!disabled} readonly={!!readonly} aria-label={ariaLabel} aria-invalid={rozieAttr(isInvalid() ? 'true' : null)} aria-describedby={rozieAttr(describedBy())} oninput={($event) => { onInput($event); }} onfocus={($event) => { onFocus($event); }} onblur={($event) => { onBlur($event); }} data-rozie-s-346ae6aa></textarea>{/if}{#if !multiline}<input bind:this={inputEl} class="rozie-text-field-input" id={rozieAttr(inputId())} type={rozieAttr(inputType())} value={rozieAttr(currentText())} name={rozieAttr(optionalAttr(name))} placeholder={rozieAttr(optionalAttr(placeholder))} autocomplete={rozieAttr(optionalAttr(autocomplete))} maxlength={maxLength} required={!!required} disabled={!!disabled} readonly={!!readonly} aria-label={ariaLabel} aria-invalid={rozieAttr(isInvalid() ? 'true' : null)} aria-describedby={rozieAttr(describedBy())} oninput={($event) => { onInput($event); }} onfocus={($event) => { onFocus($event); }} onblur={($event) => { onBlur($event); }} onkeydown={($event) => { onKeydown($event); }} data-rozie-s-346ae6aa />{/if}{#if suffix}<span class="rozie-text-field-suffix" data-rozie-s-346ae6aa>{#if suffix}{@render suffix()}{/if}</span>{/if}</div>{#if description}<p class="rozie-text-field-description" id={rozieAttr(descriptionId())} data-rozie-s-346ae6aa>{description}</p>{/if}{#if hasError()}<p class="rozie-text-field-error" id={rozieAttr(errorId())} data-rozie-s-346ae6aa>{error}</p>{/if}{#if showCount}<p class="rozie-text-field-count" id={rozieAttr(countId())} data-rozie-s-346ae6aa>{rozieDisplay(countText())}</p>{/if}</div>

<style>
:global {
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
}
</style>
