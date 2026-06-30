import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { clsx, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './Otp.css';

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
    const { value, length, type, mask, autoFocus, disabled, placeholder, ariaLabel, defaultValue, onValueChange, ...rest } = _props as OtpProps & Record<string, unknown>;
    void value; void length; void type; void mask; void autoFocus; void disabled; void placeholder; void ariaLabel; void defaultValue; void onValueChange;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });
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
    if (!ch) return false;
    if (props.type === 'numeric') return /[0-9]/.test(ch);
    if (props.type === 'alphanumeric') return /[a-zA-Z0-9]/.test(ch);
    return /\S/.test(ch);
  }
  const firstEmptyIndex = useCallback(() => {
    const len = code().length;
    return len >= props.length ? props.length - 1 : len;
  }, [code, props.length]);
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
    const next = String(raw).slice(0, props.length);
    setValue(next);
    props.onChange && props.onChange({
      value: next
    });
    if (next.length === props.length) props.onComplete && props.onComplete({
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
    const ch = raw.slice(-1);
    if (!allowChar(ch)) {
      if (e && e.target) e.target.value = code()[i] || '';
      return;
    }
    const cur = code();
    commitValue(cur.slice(0, i) + ch + cur.slice(i + 1));
    focusIndex(i + 1);
  }, [allowChar, code, commitValue, focusIndex]);
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
    const chars = text.split('').filter(allowChar);
    if (!chars.length) return;
    const arr = code().split('');
    for (let k = 0; k < chars.length && i + k < props.length; k++) arr[i + k] = chars[k];
    commitValue(arr.join(''));
    const landed = i + chars.length;
    focusIndex(landed >= props.length ? props.length - 1 : landed);
  }, [allowChar, code, commitValue, focusIndex, props.length]);
  const onFocus = useCallback((e: any) => {
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

  useEffect(() => {
    if (props.autoFocus) focusIndex(firstEmptyIndex());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ focus, clear });
  _rozieExposeRef.current = { focus, clear };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div ref={root} role="group" aria-label={rozieAttr(props.ariaLabel)} {...attrs} className={clsx(clsx("rozie-otp", { "rozie-otp--disabled": props.disabled }), (attrs.className as string | undefined))} data-rozie-s-8267d52a="">
      {cells().map((cell) => <input key={cell.i} className={"rozie-otp-cell"} type={rozieAttr(cellType())} inputMode={rozieAttr(cellInputMode())} maxLength={1} autoCapitalize="off" autoComplete={rozieAttr(cellAutocomplete(cell.i))} value={cell.ch} placeholder={props.placeholder} disabled={!!props.disabled} aria-label={rozieAttr(cellAriaLabel(cell.i))} data-filled={rozieAttr(cell.ch ? 'true' : undefined)} onInput={($event) => { onInput(cell.i, $event); }} onKeyDown={($event) => { onKeydown(cell.i, $event); }} onPaste={($event) => { onPaste(cell.i, $event); }} onFocus={($event) => { onFocus($event); }} data-rozie-s-8267d52a="" />)}
    </div>
    </>
  );
});
export default Otp;
