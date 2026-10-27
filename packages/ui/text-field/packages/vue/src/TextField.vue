<template>

<div :class="['rozie-text-field', { 'rozie-text-field--invalid': isInvalid(), 'rozie-text-field--disabled': props.disabled, 'rozie-text-field--multiline': props.multiline, 'rozie-text-field--autosize': props.multiline && props.autosize }]" v-bind="$attrs">
  <label v-if="props.label" class="rozie-text-field-label" :for="inputId()">{{ props.label }}<span v-if="props.required" class="rozie-text-field-required" aria-hidden="true">*</span></label><div class="rozie-text-field-control">
    <span v-if="$slots.prefix" class="rozie-text-field-prefix"><slot name="prefix"></slot></span><textarea v-if="props.multiline" ref="textareaElRef" class="rozie-text-field-input" :id="inputId()" :value="currentText()" :rows="(props.rows) ?? undefined" :name="optionalAttr(props.name)" :placeholder="optionalAttr(props.placeholder)" :autocomplete="optionalAttr(props.autocomplete)" :maxlength="(props.maxLength) ?? undefined" :required="!!props.required" :disabled="!!props.disabled" :readonly="!!props.readonly" :aria-label="(props.ariaLabel) ?? undefined" :aria-invalid="(isInvalid() ? 'true' : undefined) ?? undefined" :aria-describedby="(describedBy()) ?? undefined" @input="onInput($event)" @change.stop="onChange($event)"></textarea><input v-if="!props.multiline" ref="inputElRef" class="rozie-text-field-input" :id="inputId()" :type="inputType()" :value="currentText()" :name="optionalAttr(props.name)" :placeholder="optionalAttr(props.placeholder)" :autocomplete="optionalAttr(props.autocomplete)" :maxlength="(props.maxLength) ?? undefined" :required="!!props.required" :disabled="!!props.disabled" :readonly="!!props.readonly" :aria-label="(props.ariaLabel) ?? undefined" :aria-invalid="(isInvalid() ? 'true' : undefined) ?? undefined" :aria-describedby="(describedBy()) ?? undefined" @input="onInput($event)" @change.stop="onChange($event)" @keydown="onKeydown($event)" /><span v-if="$slots.suffix" class="rozie-text-field-suffix"><slot name="suffix"></slot></span></div>

  <p v-if="props.description" class="rozie-text-field-description" :id="descriptionId()">{{ props.description }}</p><p v-if="hasError()" class="rozie-text-field-error" :id="errorId()">{{ props.error }}</p><p v-if="props.showCount" class="rozie-text-field-count" :id="countId()">{{ countText() }}</p></div>

</template>

<script lang="ts">
/** The `change` and `enter` event payload: the field's current text. */
export interface TextFieldValuePayload {
  value: string;
}

export interface TextFieldHandle {
  focus: () => void;
  select: () => void;
  clear: () => void;
}
</script>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { applyAutosize } from './internal/autosize';

const props = withDefaults(
  defineProps<{
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
     * <TextField v-model:modelValue="email" label="Email" :error="emailError" />
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
    maxLength?: number | null;
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
     * <TextField v-model:modelValue="notes" label="Notes" multiline autosize :maxRows="8" />
     */
    autosize?: boolean;
    /**
     * The tallest an `autosize` field grows, in rows; past it the textarea scrolls. `null` (the default) means no cap.
     */
    maxRows?: number | null;
    /**
     * Accessible name for the control (`aria-label`) when there is no visible `label`.
     */
    ariaLabel?: string | null;
    /**
     * Id base for the control and its text: the control is `idBase + '-input'`, and the description, error and counter are `-description`, `-error` and `-count`. Leave it empty (the default) and each instance generates a unique base after mount (`rozie-text-field-<n>`); set it when you need stable ids, for example to point an external element at the control. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
     */
    idBase?: string;
  }>(),
  { label: '', description: '', error: '', invalid: false, type: 'text', placeholder: '', name: '', autocomplete: '', required: false, disabled: false, readonly: false, maxLength: null, showCount: false, multiline: false, rows: 3, autosize: false, maxRows: null, ariaLabel: null, idBase: '' }
);

const __rozieVm = getCurrentInstance()!;
/** Whether the consumer binds a value (not `undefined`) to the two-way prop `name`. */
const __rozieBound = (name: string): boolean => {
  const raw = __rozieVm.vnode.props;
  if (!raw) return false;
  const kebab = name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
  return (name in raw ? raw[name] : raw[kebab]) !== undefined;
};
/**
 * The text in the field (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so `[(ngModel)]` and `[formControl]` bind directly. Written on every keystroke.
 * @example
 * <TextField v-model:modelValue="email" label="Email" />
 */
const __rozieModel_modelValue = defineModel<string>('modelValue', { default: '' });
const modelValue = computed<string>({
  get: () => __rozieModel_modelValue.value,
  set: (v) => { if (__rozieBound('modelValue')) __rozieVm.emit('update:modelValue', v); else __rozieModel_modelValue.value = v; },
});

const emit = defineEmits<{
  change: [payload: TextFieldValuePayload];
  enter: [payload: TextFieldValuePayload];
}>();

defineSlots<{
  prefix(props: {  }): any;
  suffix(props: {  }): any;
}>();

const autoId = ref('');

const textareaElRef = ref<HTMLTextAreaElement>();
const inputElRef = ref<HTMLInputElement>();

// Top-level so React hoists it to a ref and the Solid onMount/onCleanup split
// sees it in teardown.
let widthObserver: any = null;
let observedEl: any = null;
let lastWidth = -1;
// Whether fit() has written an inline height, so turning `autosize` off can
// remove it (and never touches a height the user set with the resize grip).
let autosized = false;
// The page-wide id counter (the same four lines as Combobox / Listbox / Popover).
const nextAutoId = () => {
  const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
  Reflect.set(globalThis, '__rozieAutoId', n);
  return n;
};
// ---- ids -------------------------------------------------------------------
const idRoot = () => props.idBase || autoId.value || 'rozie-text-field';
const inputId = () => idRoot() + '-input';
const descriptionId = () => idRoot() + '-description';
const errorId = () => idRoot() + '-error';
const countId = () => idRoot() + '-count';
// ---- derived state ---------------------------------------------------------
const hasError = () => typeof props.error === 'string' && props.error.length > 0;
const isInvalid = () => !!props.invalid || hasError();
const currentText = () => modelValue.value == null ? '' : String(modelValue.value);
// Read once into a local: Angular does not narrow across two signal calls.
const hasLimit = () => {
  const limit = props.maxLength;
  return typeof limit === 'number' && limit >= 0;
};
const countText = () => {
  const n = currentText().length;
  return hasLimit() ? n + ' / ' + props.maxLength : String(n);
};
// The ids of the rendered helper text, space-joined, or null when there is none.
const describedBy = () => {
  const ids: string[] = [];
  if (props.description) ids.push(descriptionId());
  if (hasError()) ids.push(errorId());
  if (props.showCount) ids.push(countId());
  return ids.length > 0 ? ids.join(' ') : null;
};
const inputType = () => props.type ? props.type : 'text';
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
    fit();
  });
  widthObserver.observe(el);
};
const fit = () => {
  const el = props.multiline ? textareaElRef.value : null;
  if (!el || !props.autosize) {
    observeWidth(null);
    if (el && autosized) {
      el.style.height = '';
      el.style.overflowY = '';
    }
    autosized = false;
    return;
  }
  observeWidth(el);
  applyAutosize(el, props.rows, props.maxRows);
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
  modelValue.value = text;
};
const onInput = (e: any) => {
  commitText(e && e.target ? e.target.value : '');
  fit();
};
// `change` = the DOM `change` event: the user committed an edit (blurred after
// changing the text, or pressed Enter where the browser commits on it). A
// programmatic write never fires it. The template stops the native event so it
// can't bubble out alongside this component's own `change` (Angular has no
// shadow boundary to contain it).
const onChange = (e: any) => {
  emit('change', {
    value: e && e.target ? e.target.value : currentText()
  });
};
const onKeydown = (e: any) => {
  if (!e || e.key !== 'Enter' || e.isComposing) return;
  emit('enter', {
    value: e.target ? e.target.value : currentText()
  });
};

// ---- lifecycle -------------------------------------------------------------
// ---- imperative handle -----------------------------------------------------
const control = () => props.multiline ? textareaElRef.value : inputElRef.value;
// focus() deliberately overrides HTMLElement.focus on Lit (ROZ137, accepted).
const focus = () => {
  const el = control();
  if (el && el.focus) el.focus();
};
// select() — focus the control and select all of its text.
const select = () => {
  const el: any = control();
  if (!el) return;
  if (el.focus) el.focus();
  if (el.select) el.select();
};
// clear() — empty the field (writes modelValue = '').
const clear = () => {
  commitText('');
  fit();
};

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  if (!props.idBase) autoId.value = 'rozie-text-field-' + nextAutoId();
  fit();
  _cleanup_0 = () => {
    observeWidth(null);
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => modelValue.value, () => fitLater(), { flush: 'post' });
watch(() => props.multiline, () => fitLater(), { flush: 'post' });
watch(() => props.autosize, () => fitLater(), { flush: 'post' });
watch(() => props.rows, () => fitLater(), { flush: 'post' });
watch(() => props.maxRows, () => fitLater(), { flush: 'post' });

defineExpose({ focus, select, clear } as TextFieldHandle);
</script>

<style scoped>
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
  /* A margin, not a leading space in the markup: targets collapse that space differently. */
  margin-left: 0.25em;
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
</style>
