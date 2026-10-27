import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

/** The `change` and `enter` event payload: the field's current text. */
export interface TextFieldValuePayload {
  value: string;
}

export interface TextFieldProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'modelValue' | 'defaultModelValue' | 'onModelValueChange' | 'label' | 'description' | 'error' | 'invalid' | 'type' | 'placeholder' | 'name' | 'autocomplete' | 'required' | 'disabled' | 'readonly' | 'maxLength' | 'showCount' | 'multiline' | 'rows' | 'autosize' | 'maxRows' | 'ariaLabel' | 'idBase' | 'onChange' | 'onEnter' | 'renderPrefix' | 'renderSuffix' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  /**
   * The text in the field (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so `[(ngModel)]` and `[formControl]` bind directly. Written on every keystroke.
   * @example
   * <TextField modelValue={email} onModelValueChange={setEmail} label="Email" />
   */
  modelValue?: string;
  defaultModelValue?: string;
  onModelValueChange?: (next: string) => void;
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
  slots?: Record<string, () => ReactNode>;
}

export interface TextFieldHandle {
  focus: () => void;
  select: () => void;
  clear: () => void;
}

declare const TextField: React.ForwardRefExoticComponent<TextFieldProps & React.RefAttributes<TextFieldHandle>>;
export default TextField;
