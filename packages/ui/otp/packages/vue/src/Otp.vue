<template>

<div :class="['rozie-otp', { 'rozie-otp--disabled': props.disabled }]" ref="rootRef" role="group" :aria-label="props.ariaLabel" v-bind="$attrs">
  <input v-for="cell in cells()" :key="cell.i" class="rozie-otp-cell" :type="cellType()" :inputmode="cellInputMode()" maxlength="1" autocapitalize="off" autocorrect="off" spellcheck="false" :autocomplete="cellAutocomplete(cell.i)" :value="cell.ch" :placeholder="props.placeholder" :disabled="!!props.disabled" :aria-label="cellAriaLabel(cell.i)" :data-filled="cell.ch ? 'true' : undefined" @input="onInput(cell.i, $event)" @keydown="onKeydown(cell.i, $event)" @paste="onPaste(cell.i, $event)" @focus="onFocus($event)" @pointerup="onPointerUp($event)" />
</div>

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Number of input cells to render.
     */
    length?: number;
    /**
     * Allowed-character class plus the mobile keyboard hint: `'numeric'` permits digits only and sets `inputmode="numeric"`; `'alphanumeric'` permits `[A-Za-z0-9]` with `inputmode="text"`; `'text'` permits any non-space character with `inputmode="text"`. Characters that fail the test are rejected on type and filtered on paste.
     */
    type?: string;
    /**
     * Render the cells as masked dots (`type="password"`) for sensitive codes, while keeping the same keyboard and ARIA behavior.
     */
    mask?: boolean;
    /**
     * Focus the first empty cell on mount.
     */
    autoFocus?: boolean;
    /**
     * Disable every cell. Also sets the Angular `ControlValueAccessor` disabled state.
     */
    disabled?: boolean;
    /**
     * Per-cell placeholder character shown in empty cells (e.g. `'•'` or `'0'`).
     */
    placeholder?: string;
    /**
     * Accessible name for the whole group (`role="group"`, applied as `aria-label`). Each cell additionally gets an ordinal `aria-label` (`"Digit 1 of 6"`).
     */
    ariaLabel?: string | null;
  }>(),
  { length: 6, type: 'numeric', mask: false, autoFocus: false, disabled: false, placeholder: '', ariaLabel: null }
);

/**
 * The assembled one-time code (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so an Otp **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Always a contiguous string of `0..length` characters; Otp writes the new code back on every edit (type, paste, backspace).
 * @example
 * <Otp r-model:value="code" :length="6" type="numeric" ariaLabel="Verification code" />
 */
const value = defineModel<string>('value', { default: '' });

const emit = defineEmits<{
  change: [...args: any[]];
  complete: [...args: any[]];
}>();

const rootRef = ref<HTMLElement>();

import { firstEmptyIndex as firstEmpty, isAllowedChar, planEmits, planWrite } from './internal/otpWrite';
// ---- derived view (plain functions, uniform ×6) ------------------------
// The current code, normalized to a string.
const code = () => typeof value.value === 'string' ? value.value : '';
// The cells to render: one { i, ch } per position, ch derived from `value`.
// A plain function (called in the r-for and from handlers) — never $computed.
const cells = () => {
  const v = code();
  const out = [];
  for (let i = 0; i < props.length; i++) out.push({
    i,
    ch: v[i] || ''
  });
  return out;
};
// Allowed-character test for the configured `type`. Thin wrapper over the
// pure write model in ./internal/otpWrite (vendored into every leaf).
const allowChar = (ch: any) => isAllowedChar(props.type, ch);
// The cell that should receive focus for new input: the first empty position
// (clamped to the last cell when full).
const firstEmptyIndex = () => firstEmpty(code(), props.length);
// ---- focus choreography (container ref, post-mount only) ----------------
// Read $refs.root only here / in $onMount / in $expose verbs (all post-mount →
// ROZ123-safe). querySelectorAll reaches the cells inside Lit's shadow root too.
const focusIndex = (idx: any) => {
  let i = idx;
  if (i < 0) i = 0;
  if (i >= props.length) i = props.length - 1;
  const root = rootRef.value;
  if (!root) return;
  const inputs = root.querySelectorAll('input');
  const el = inputs[i];
  if (el) {
    el.focus();
    if (el.select) el.select();
  }
};
// ---- write funnel (single $emit site) ----------------------------------
// Capture `prev` BEFORE the model write (code() reads $props.value, which has
// not yet round-tripped) — this is what makes the transition detection
// stateless and keeps the documented "CONTROLLED, NO LOCAL STATE" invariant
// (do NOT add a `wasFull` flag to <data>). The model write stays
// unconditional (idempotent, keeps the controlled contract); only the emits
// are gated: `change` on an actual value transition, `complete` only on the
// not-full -> full transition (never on an in-place edit of an already-full
// code, never at length: 0 — see ./internal/otpWrite.planEmits).
const commitValue = (raw: any) => {
  const prev = code();
  const next = String(raw).slice(0, props.length);
  const emits = planEmits(prev, next, props.length);
  value.value = next;
  if (emits.change) emit('change', {
    value: next
  });
  if (emits.complete) emit('complete', {
    value: next
  });
};
// ---- input handler -----------------------------------------------------
// One path for every input shape (single char, autofill, swipe, IME commit —
// see ./internal/otpWrite.planWrite): sanitize + distribute from the write
// position, clamped to the current fill point so a click past the fill point
// never leaves a hole. An invalid / empty-after-sanitize write is rejected by
// restoring the cell's DOM value directly (a no-op model write may not
// re-render on React, so reset the element instead).
const onInput = (i: any, e: any) => {
  const raw = e && e.target ? e.target.value : '';
  if (raw === '') {
    const cur = code();
    commitValue(cur.slice(0, i) + cur.slice(i + 1));
    return;
  }
  const plan = planWrite(code(), props.length, props.type, i, raw);
  if (!plan) {
    if (e && e.target) e.target.value = code()[i] || '';
    return;
  }
  commitValue(plan.next);
  // Restore the originating cell's DOM value from the derived model. Required
  // for the multi-char/autofill case: the element currently holds the WHOLE
  // pasted/autofilled string, and when the committed value happens to equal the
  // previous value the framework re-render is a no-op (the same reason the
  // invalid-char branch above resets the element directly). Without this the
  // first cell keeps rendering the whole autofilled string.
  if (e && e.target) e.target.value = plan.next[i] || '';
  focusIndex(plan.focus);
};
// ---- keyboard ----------------------------------------------------------
// Backspace deletes the current char (or the previous one when the cell is
// already empty) and moves focus accordingly; arrows / Home / End navigate.
const onKeydown = (i: any, e: any) => {
  const key = e ? e.key : '';
  const cur = code();
  if (key === 'Backspace') {
    if (e) e.preventDefault();
    if (cur[i]) {
      commitValue(cur.slice(0, i) + cur.slice(i + 1));
    } else if (i > 0) {
      commitValue(cur.slice(0, i - 1) + cur.slice(i));
      focusIndex(i - 1);
    }
  } else if (key === 'ArrowLeft') {
    if (e) e.preventDefault();
    focusIndex(i - 1);
  } else if (key === 'ArrowRight') {
    if (e) e.preventDefault();
    focusIndex(i + 1);
  } else if (key === 'Home') {
    if (e) e.preventDefault();
    focusIndex(0);
  } else if (key === 'End') {
    if (e) e.preventDefault();
    focusIndex(props.length - 1);
  }
};
// ---- paste (collapses onto the same distribution routine as onInput) ---
const onPaste = (i: any, e: any) => {
  if (e) e.preventDefault();
  const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
  const plan = planWrite(code(), props.length, props.type, i, text);
  if (!plan) return;
  commitValue(plan.next);
  focusIndex(plan.focus);
};
// Select the cell's content on focus so a keystroke overwrites it. Correct
// for Tab and programmatic focus.
const onFocus = (e: any) => {
  if (e && e.target && e.target.select) e.target.select();
};
// A mouse/touch focus places the caret on mouseup, collapsing onFocus's
// select(); with maxlength="1" a filled cell then REJECTS the next keystroke.
// Re-select on pointerup (after caret placement) so click-then-type overwrites,
// matching the Tab-focus behavior.
const onPointerUp = (e: any) => {
  if (e && e.target && e.target.select) e.target.select();
};
// ---- per-cell attribute helpers ----------------------------------------
const cellType = () => props.mask ? 'password' : 'text';
// NOTE: named `cellInputMode`, NOT `inputMode` — a bare `inputMode` member
// collides with the inherited `HTMLElement.inputMode: string` on the Lit custom
// element (a hard TS2416/TS1238, unlike the warn-only `focus` override). The
// `cell`-prefix keeps it collision-safe across all six strict-typecheck leaves.
const cellInputMode = () => props.type === 'numeric' ? 'numeric' : 'text';
const cellAriaLabel = (i: any) => 'Digit ' + (i + 1) + ' of ' + props.length;
const cellAutocomplete = (i: any) => i === 0 ? 'one-time-code' : 'off';

// ---- lifecycle + imperative handle -------------------------------------
// focus() — focus the first empty cell. DELIBERATELY overrides HTMLElement.focus
// on Lit (ROZ137 warn, accepted). clear() — reset the code and focus the first
// cell. Both read $refs in a post-mount handle call (ROZ123-safe).
const focus = () => focusIndex(firstEmptyIndex());
const clear = () => {
  commitValue('');
  focusIndex(0);
};

onMounted(() => {
  if (props.autoFocus) focusIndex(firstEmptyIndex());
});

defineExpose({ focus, clear });
</script>

<style scoped>
.rozie-otp {
  display: inline-flex;
  gap: var(--rozie-otp-gap, 0.5rem);
  font: var(--rozie-otp-font, inherit);
}
.rozie-otp-cell {
  box-sizing: border-box;
  width: var(--rozie-otp-cell-size, 2.75rem);
  height: var(--rozie-otp-cell-size, 2.75rem);
  padding: 0;
  text-align: center;
  font-size: var(--rozie-otp-font-size, 1.25rem);
  font-weight: var(--rozie-otp-font-weight, 600);
  color: var(--rozie-otp-color, inherit);
  background: var(--rozie-otp-bg, #fff);
  border: var(--rozie-otp-border-width, 1px) solid var(--rozie-otp-border-color, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-otp-radius, 0.5rem);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  caret-color: var(--rozie-otp-accent, #0066cc);
}
.rozie-otp-cell::placeholder {
  color: var(--rozie-otp-placeholder-color, rgba(0, 0, 0, 0.3));
}
.rozie-otp-cell[data-filled='true'] {
  border-color: var(--rozie-otp-filled-border-color, var(--rozie-otp-accent, #0066cc));
}
.rozie-otp-cell:focus {
  border-color: var(--rozie-otp-accent, #0066cc);
  box-shadow: 0 0 0 var(--rozie-otp-focus-ring-width, 3px) var(--rozie-otp-focus-ring-color, rgba(0, 102, 204, 0.25));
}
.rozie-otp--disabled .rozie-otp-cell {
  cursor: not-allowed;
  opacity: var(--rozie-otp-disabled-opacity, 0.55);
  background: var(--rozie-otp-disabled-bg, rgba(0, 0, 0, 0.04));
}
</style>
