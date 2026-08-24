import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { clsx, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './Otp.css';
import { firstEmptyIndex as firstEmpty, isAllowedChar, planEmits, planWrite } from './internal/otpWrite';

// ---- derived view (plain functions, uniform ×6) ------------------------
// The current code, normalized to a string.

interface OtpProps {
  /**
   * The assembled one-time code (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so an Otp **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Always a contiguous string of `0..length` characters; Otp writes the new code back on every edit (type, paste, backspace).
   * @example
   * <Otp value={code} onValueChange={setCode} length={6} type="numeric" ariaLabel="Verification code" />
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
  onChange?: (...args: any[]) => void;
  onComplete?: (...args: any[]) => void;
}

export interface OtpHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

const Otp = forwardRef<OtpHandle, OtpProps>(function Otp(_props: OtpProps, ref): JSX.Element {
  const props: Omit<OtpProps, 'length' | 'type' | 'mask' | 'autoFocus' | 'disabled' | 'placeholder' | 'ariaLabel'> & { length: number; type: string; mask: boolean; autoFocus: boolean; disabled: boolean; placeholder: string; ariaLabel: (string) | null } = {
    ..._props,
    length: _props.length ?? 6,
    type: _props.type ?? 'numeric',
    mask: _props.mask ?? false,
    autoFocus: _props.autoFocus ?? false,
    disabled: _props.disabled ?? false,
    placeholder: _props.placeholder ?? '',
    ariaLabel: _props.ariaLabel ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { value, length, type, mask, autoFocus, disabled, placeholder, ariaLabel, defaultValue, onValueChange, onChange, onComplete, ...rest } = _props as OtpProps & Record<string, unknown>;
    void value; void length; void type; void mask; void autoFocus; void disabled; void placeholder; void ariaLabel; void defaultValue; void onValueChange; void onChange; void onComplete;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });
  const _autoFocusRef = useRef(props.autoFocus);
  _autoFocusRef.current = props.autoFocus;
  const root = useRef<HTMLDivElement | null>(null);

  function code() {
    return typeof value === 'string' ? value : '';
  }
  function cells() {
    const v = code();
    const out = [];
    for (let i = 0; i < props.length; i++) out.push({
      i,
      ch: v[i] || ''
    });
    return out;
  }
  function allowChar(ch: any) {
    return isAllowedChar(props.type, ch);
  }
  const firstEmptyIndex = useCallback(() => firstEmpty(code(), props.length), [code, props.length]);
  const focusIndex = useCallback((idx: any) => {
    let i = idx;
    if (i < 0) i = 0;
    if (i >= props.length) i = props.length - 1;
    const root$local = root.current;
    if (!root$local) return;
    const inputs = root$local.querySelectorAll('input');
    const el = inputs[i];
    if (el) {
      el.focus();
      if (el.select) el.select();
    }
  }, [props.length]);
  function commitValue(raw: any) {
    const prev = code();
    const next = String(raw).slice(0, props.length);
    const emits = planEmits(prev, next, props.length);
    setValue(next);
    if (emits.change) props.onChange && props.onChange({
      value: next
    });
    if (emits.complete) props.onComplete && props.onComplete({
      value: next
    });
  }
  const onInput = useCallback((i: any, e: any) => {
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
  }, [code, commitValue, focusIndex, props.length, props.type]);
  const onKeydown = useCallback((i: any, e: any) => {
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
  }, [code, commitValue, focusIndex, props.length]);
  const onPaste = useCallback((i: any, e: any) => {
    if (e) e.preventDefault();
    const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
    const plan = planWrite(code(), props.length, props.type, i, text);
    if (!plan) return;
    commitValue(plan.next);
    focusIndex(plan.focus);
  }, [code, commitValue, focusIndex, props.length, props.type]);
  const onFocus = useCallback((e: any) => {
    if (e && e.target && e.target.select) e.target.select();
  }, []);
  const onPointerUp = useCallback((e: any) => {
    if (e && e.target && e.target.select) e.target.select();
  }, []);
  function cellType() {
    return props.mask ? 'password' : 'text';
  }
  function cellInputMode() {
    return props.type === 'numeric' ? 'numeric' : 'text';
  }
  function cellAriaLabel(i: any) {
    return 'Digit ' + (i + 1) + ' of ' + props.length;
  }
  function cellAutocomplete(i: any) {
    return i === 0 ? 'one-time-code' : 'off';
  }
  function focus() {
    return focusIndex(firstEmptyIndex());
  }
  function clear() {
    commitValue('');
    focusIndex(0);
  }

  const _firstEmptyIndexRef = useRef(firstEmptyIndex);
  _firstEmptyIndexRef.current = firstEmptyIndex;
  const _focusIndexRef = useRef(focusIndex);
  _focusIndexRef.current = focusIndex;
  useEffect(() => {
    if (_autoFocusRef.current) _focusIndexRef.current(_firstEmptyIndexRef.current());
  }, []);

  const _rozieExposeRef = useRef({ focus, clear });
  _rozieExposeRef.current = { focus, clear };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div ref={root} role="group" aria-label={rozieAttr(props.ariaLabel)} {...attrs} className={clsx(clsx("rozie-otp", { "rozie-otp--disabled": props.disabled }), (attrs.className as string | undefined))} data-rozie-s-8267d52a="">
      {cells().map((cell) => <input key={cell.i} className={"rozie-otp-cell"} type={rozieAttr(cellType())} inputMode={rozieAttr(cellInputMode())} maxLength={1} autoCapitalize="off" autoCorrect="off" spellCheck="false" autoComplete={rozieAttr(cellAutocomplete(cell.i))} value={cell.ch} placeholder={props.placeholder} disabled={!!props.disabled} aria-label={rozieAttr(cellAriaLabel(cell.i))} data-filled={rozieAttr(cell.ch ? 'true' : undefined)} onInput={($event) => { onInput(cell.i, $event); }} onKeyDown={($event) => { onKeydown(cell.i, $event); }} onPaste={($event) => { onPaste(cell.i, $event); }} onFocus={($event) => { onFocus($event); }} onPointerUp={($event) => { onPointerUp($event); }} data-rozie-s-8267d52a="" />)}
    </div>
    </>
  );
});
export default Otp;
