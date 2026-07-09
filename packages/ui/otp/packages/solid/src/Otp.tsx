import type { JSX } from 'solid-js';
import { mergeProps, onMount, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass } from '@rozie/runtime-solid';

__rozieInjectStyle('Otp-8267d52a', `.rozie-otp[data-rozie-s-8267d52a] {
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
}`);

interface OtpProps {
  /**
   * The assembled one-time code (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so an Otp **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Always a contiguous string of `0..length` characters; Otp writes the new code back on every edit (type, paste, backspace).
   * @example
   * <Otp r-model:value="code" :length="6" type="numeric" ariaLabel="Verification code" />
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
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
  ariaLabel?: (string) | null;
  onChange?: (...args: unknown[]) => void;
  onComplete?: (...args: unknown[]) => void;
  ref?: (h: OtpHandle) => void;
}

export interface OtpHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

export default function Otp(_props: OtpProps): JSX.Element {
  const _merged = mergeProps({ length: 6, type: 'numeric', mask: false, autoFocus: false, disabled: false, placeholder: '', ariaLabel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'length', 'type', 'mask', 'autoFocus', 'disabled', 'placeholder', 'ariaLabel', 'ref']);
  onMount(() => { local.ref?.({ focus, clear }); });

  const [value, setValue] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'value', '');
  onMount(() => {
    if (local.autoFocus) focusIndex(firstEmptyIndex());
  });
  let rootRef: HTMLElement | null = null;

  // ---- derived view (plain functions, uniform ×6) ------------------------
  // The current code, normalized to a string.
  function code() {
    return typeof value() === 'string' ? value() : '';
  }

  // The cells to render: one { i, ch } per position, ch derived from `value`.
  // A plain function (called in the r-for and from handlers) — never $computed.
  function cells() {
    const v = code();
    const out = [];
    for (let i = 0; i < local.length; i++) out.push({
      i,
      ch: v[i] || ''
    });
    return out;
  }

  // Allowed-character test for the configured `type`.
  function allowChar(ch: any) {
    if (!ch) return false;
    if (local.type === 'numeric') return /[0-9]/.test(ch);
    if (local.type === 'alphanumeric') return /[a-zA-Z0-9]/.test(ch);
    return /\S/.test(ch);
  }

  // The cell that should receive focus for new input: the first empty position
  // (clamped to the last cell when full).
  function firstEmptyIndex() {
    const len = code().length;
    return len >= local.length ? local.length - 1 : len;
  }

  // ---- focus choreography (container ref, post-mount only) ----------------
  // Read $refs.root only here / in $onMount / in $expose verbs (all post-mount →
  // ROZ123-safe). querySelectorAll reaches the cells inside Lit's shadow root too.
  function focusIndex(idx: any) {
    let i = idx;
    if (i < 0) i = 0;
    if (i >= local.length) i = local.length - 1;
    const root = rootRef;
    if (!root) return;
    const inputs = root.querySelectorAll('input');
    const el = inputs[i];
    if (el) {
      el.focus();
      if (el.select) el.select();
    }
  }

  // ---- write funnel (single $emit site) ----------------------------------
  // Clamp to length, write the model, emit change, and emit complete when every
  // cell is filled (a contiguous full string has length === $props.length).
  function commitValue(raw: any) {
    const next = String(raw).slice(0, local.length);
    setValue(next);
    _props.onChange?.({
      value: next
    });
    if (next.length === local.length) _props.onComplete?.({
      value: next
    });
  }

  // ---- input handler -----------------------------------------------------
  // Take the LAST char typed (handles overwriting a filled cell), sanitize, splice
  // it into the contiguous string at this position, advance focus. An invalid char
  // is rejected by restoring the cell's DOM value directly (a no-op model write may
  // not re-render on React, so reset the element instead).
  function onInput(i: any, e: any) {
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
  }

  // ---- keyboard ----------------------------------------------------------
  // Backspace deletes the current char (or the previous one when the cell is
  // already empty) and moves focus accordingly; arrows / Home / End navigate.
  function onKeydown(i: any, e: any) {
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
      focusIndex(local.length - 1);
    }
  }

  // ---- paste (distribute across cells from this position) ----------------
  function onPaste(i: any, e: any) {
    if (e) e.preventDefault();
    const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
    const chars = text.split('').filter(allowChar);
    if (!chars.length) return;
    const arr = code().split('');
    for (let k = 0; k < chars.length && i + k < local.length; k++) arr[i + k] = chars[k];
    commitValue(arr.join(''));
    const landed = i + chars.length;
    focusIndex(landed >= local.length ? local.length - 1 : landed);
  }

  // Select the cell's content on focus so a keystroke overwrites it.
  function onFocus(e: any) {
    if (e && e.target && e.target.select) e.target.select();
  }

  // ---- per-cell attribute helpers ----------------------------------------
  function cellType() {
    return local.mask ? 'password' : 'text';
  }
  // NOTE: named `cellInputMode`, NOT `inputMode` — a bare `inputMode` member
  // collides with the inherited `HTMLElement.inputMode: string` on the Lit custom
  // element (a hard TS2416/TS1238, unlike the warn-only `focus` override). The
  // `cell`-prefix keeps it collision-safe across all six strict-typecheck leaves.
  function cellInputMode() {
    return local.type === 'numeric' ? 'numeric' : 'text';
  }
  function cellAriaLabel(i: any) {
    return 'Digit ' + (i + 1) + ' of ' + local.length;
  }
  function cellAutocomplete(i: any) {
    return i === 0 ? 'one-time-code' : 'off';
  }

  // ---- lifecycle + imperative handle -------------------------------------

  // focus() — focus the first empty cell. DELIBERATELY overrides HTMLElement.focus
  // on Lit (ROZ137 warn, accepted). clear() — reset the code and focus the first
  // cell. Both read $refs in a post-mount handle call (ROZ123-safe).
  function focus() {
    return focusIndex(firstEmptyIndex());
  }
  function clear() {
    commitValue('');
    focusIndex(0);
  }

  return (
    <>
    <div ref={(el) => { rootRef = el as HTMLElement; }} role="group" aria-label={rozieAttr(local.ariaLabel)} {...attrs} class={"rozie-otp" + " " + rozieClass({ 'rozie-otp--disabled': local.disabled }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-8267d52a="">
      <Key each={cells() as readonly any[]} by={(cell) => cell.i}>{(cell) => <input autocapitalize="off" aria-label={rozieAttr(cellAriaLabel(cell().i))} data-filled={rozieAttr(cell().ch ? 'true' : null)} class={"rozie-otp-cell"} type={rozieAttr(cellType())} inputMode={rozieAttr(cellInputMode())} maxLength={1} autocomplete={rozieAttr(cellAutocomplete(cell().i))} value={cell().ch} placeholder={local.placeholder} disabled={!!local.disabled} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onInput(cell().i, $event); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onKeydown(cell().i, $event); }} onPaste={($event: ClipboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onPaste(cell().i, $event); }} onFocus={($event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }) => { onFocus($event); }} data-rozie-s-8267d52a="" />}</Key>
    </div>
    </>
  );
}
