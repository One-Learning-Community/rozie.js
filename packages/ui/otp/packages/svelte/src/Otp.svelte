<script lang="ts">
import { applyListeners, rozieAttr } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  value?: string;
  length?: number;
  type?: string;
  mask?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: (string) | null;
  onchange?: (...args: unknown[]) => void;
  oncomplete?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let {
  value = $bindable(''),
  length = 6,
  type = 'numeric',
  mask = false,
  autoFocus = false,
  disabled = false,
  placeholder = '',
  ariaLabel = null,
  onchange,
  oncomplete,
  ...__rozieAttrs
}: Props = $props();

let root = $state<HTMLElement | undefined>(undefined);

// ---- derived view (plain functions, uniform ×6) ------------------------
// The current code, normalized to a string.
const code = () => typeof value === 'string' ? value : '';

// The cells to render: one { i, ch } per position, ch derived from `value`.
// A plain function (called in the r-for and from handlers) — never $computed.
// The cells to render: one { i, ch } per position, ch derived from `value`.
// A plain function (called in the r-for and from handlers) — never $computed.
const cells = () => {
  const v = code();
  const out = [];
  for (let i = 0; i < length; i++) out.push({
    i,
    ch: v[i] || ''
  });
  return out;
};

// Allowed-character test for the configured `type`.
// Allowed-character test for the configured `type`.
const allowChar = (ch: any) => {
  if (!ch) return false;
  if (type === 'numeric') return /[0-9]/.test(ch);
  if (type === 'alphanumeric') return /[a-zA-Z0-9]/.test(ch);
  return /\S/.test(ch);
};

// The cell that should receive focus for new input: the first empty position
// (clamped to the last cell when full).
// The cell that should receive focus for new input: the first empty position
// (clamped to the last cell when full).
const firstEmptyIndex = () => {
  const len = code().length;
  return len >= length ? length - 1 : len;
};

// ---- focus choreography (container ref, post-mount only) ----------------
// Read $refs.root only here / in $onMount / in $expose verbs (all post-mount →
// ROZ123-safe). querySelectorAll reaches the cells inside Lit's shadow root too.
// ---- focus choreography (container ref, post-mount only) ----------------
// Read $refs.root only here / in $onMount / in $expose verbs (all post-mount →
// ROZ123-safe). querySelectorAll reaches the cells inside Lit's shadow root too.
const focusIndex = (idx: any) => {
  let i = idx;
  if (i < 0) i = 0;
  if (i >= length) i = length - 1;
  const root$local = root;
  if (!root$local) return;
  const inputs = root$local.querySelectorAll('input');
  const el = inputs[i];
  if (el) {
    el.focus();
    if (el.select) el.select();
  }
};

// ---- write funnel (single $emit site) ----------------------------------
// Clamp to length, write the model, emit change, and emit complete when every
// cell is filled (a contiguous full string has length === $props.length).
// ---- write funnel (single $emit site) ----------------------------------
// Clamp to length, write the model, emit change, and emit complete when every
// cell is filled (a contiguous full string has length === $props.length).
const commitValue = (raw: any) => {
  const next = String(raw).slice(0, length);
  value = next;
  onchange?.({
    value: next
  });
  if (next.length === length) oncomplete?.({
    value: next
  });
};

// ---- input handler -----------------------------------------------------
// Take the LAST char typed (handles overwriting a filled cell), sanitize, splice
// it into the contiguous string at this position, advance focus. An invalid char
// is rejected by restoring the cell's DOM value directly (a no-op model write may
// not re-render on React, so reset the element instead).
// ---- input handler -----------------------------------------------------
// Take the LAST char typed (handles overwriting a filled cell), sanitize, splice
// it into the contiguous string at this position, advance focus. An invalid char
// is rejected by restoring the cell's DOM value directly (a no-op model write may
// not re-render on React, so reset the element instead).
const onInput = (i: any, e: any) => {
  const raw = e && e.target ? e.target.value : '';
  if (raw === '') {
    const cur = code();
    commitValue(cur.slice(0, i) + cur.slice(i + 1));
    return;
  }
  const ch = raw.slice(-1);
  if (!allowChar(ch)) {
    if (e && e.target) e.target.value = code()[i] || '';
    return;
  }
  const cur = code();
  commitValue(cur.slice(0, i) + ch + cur.slice(i + 1));
  focusIndex(i + 1);
};

// ---- keyboard ----------------------------------------------------------
// Backspace deletes the current char (or the previous one when the cell is
// already empty) and moves focus accordingly; arrows / Home / End navigate.
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
    focusIndex(length - 1);
  }
};

// ---- paste (distribute across cells from this position) ----------------
// ---- paste (distribute across cells from this position) ----------------
const onPaste = (i: any, e: any) => {
  if (e) e.preventDefault();
  const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
  const chars = text.split('').filter(allowChar);
  if (!chars.length) return;
  const arr = code().split('');
  for (let k = 0; k < chars.length && i + k < length; k++) arr[i + k] = chars[k];
  commitValue(arr.join(''));
  const landed = i + chars.length;
  focusIndex(landed >= length ? length - 1 : landed);
};

// Select the cell's content on focus so a keystroke overwrites it.
// Select the cell's content on focus so a keystroke overwrites it.
const onFocus = (e: any) => {
  if (e && e.target && e.target.select) e.target.select();
};

// ---- per-cell attribute helpers ----------------------------------------
// ---- per-cell attribute helpers ----------------------------------------
const cellType = () => mask ? 'password' : 'text';
// NOTE: named `cellInputMode`, NOT `inputMode` — a bare `inputMode` member
// collides with the inherited `HTMLElement.inputMode: string` on the Lit custom
// element (a hard TS2416/TS1238, unlike the warn-only `focus` override). The
// `cell`-prefix keeps it collision-safe across all six strict-typecheck leaves.
// NOTE: named `cellInputMode`, NOT `inputMode` — a bare `inputMode` member
// collides with the inherited `HTMLElement.inputMode: string` on the Lit custom
// element (a hard TS2416/TS1238, unlike the warn-only `focus` override). The
// `cell`-prefix keeps it collision-safe across all six strict-typecheck leaves.
const cellInputMode = () => type === 'numeric' ? 'numeric' : 'text';
const cellAriaLabel = (i: any) => 'Digit ' + (i + 1) + ' of ' + length;
const cellAutocomplete = (i: any) => i === 0 ? 'one-time-code' : 'off';

// ---- lifecycle + imperative handle -------------------------------------
// focus() — focus the first empty cell. DELIBERATELY overrides HTMLElement.focus
// on Lit (ROZ137 warn, accepted). clear() — reset the code and focus the first
// cell. Both read $refs in a post-mount handle call (ROZ123-safe).
export const focus = () => focusIndex(firstEmptyIndex());
export const clear = () => {
  commitValue('');
  focusIndex(0);
};

onMount(() => {
  if (autoFocus) focusIndex(firstEmptyIndex());
});
</script>

<div bind:this={root} role="group" aria-label={ariaLabel} {...__rozieAttrs} class={["rozie-otp", { 'rozie-otp--disabled': disabled }, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-8267d52a>{#each cells() as cell (cell.i)}<input class="rozie-otp-cell" type={rozieAttr(cellType())} inputmode={rozieAttr(cellInputMode())} maxlength="1" autocapitalize="off" autocomplete={rozieAttr(cellAutocomplete(cell.i))} value={rozieAttr(cell.ch)} placeholder={placeholder} disabled={!!disabled} aria-label={rozieAttr(cellAriaLabel(cell.i))} data-filled={rozieAttr(cell.ch ? 'true' : null)} oninput={($event) => { onInput(cell.i, $event); }} onkeydown={($event) => { onKeydown(cell.i, $event); }} onpaste={($event) => { onPaste(cell.i, $event); }} onfocus={($event) => { onFocus($event); }} data-rozie-s-8267d52a />{/each}</div>

<style>
:global {
  .rozie-otp[data-rozie-s-8267d52a] {
    display: inline-flex;
    gap: var(--rozie-otp-gap, 0.5rem);
    font: var(--rozie-otp-font, inherit);
  }
  .rozie-otp-cell[data-rozie-s-8267d52a] {
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
  .rozie-otp-cell[data-rozie-s-8267d52a]::placeholder {
    color: var(--rozie-otp-placeholder-color, rgba(0, 0, 0, 0.3));
  }
  .rozie-otp-cell[data-filled='true'][data-rozie-s-8267d52a] {
    border-color: var(--rozie-otp-filled-border-color, var(--rozie-otp-accent, #0066cc));
  }
  .rozie-otp-cell[data-rozie-s-8267d52a]:focus {
    border-color: var(--rozie-otp-accent, #0066cc);
    box-shadow: 0 0 0 var(--rozie-otp-focus-ring-width, 3px) var(--rozie-otp-focus-ring-color, rgba(0, 102, 204, 0.25));
  }
  .rozie-otp--disabled[data-rozie-s-8267d52a] .rozie-otp-cell[data-rozie-s-8267d52a] {
    cursor: not-allowed;
    opacity: var(--rozie-otp-disabled-opacity, 0.55);
    background: var(--rozie-otp-disabled-bg, rgba(0, 0, 0, 0.04));
  }
}
</style>
