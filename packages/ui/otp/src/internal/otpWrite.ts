/**
 * otpWrite.ts — the pure write model for the Otp family, extracted to
 * `src/internal/` so it can be unit-tested in isolation (codegen vendors
 * `src/internal/` into every leaf via copyInternal, excluding `*.test.ts`) and
 * imported once from `Otp.rozie`'s `<script>` as a set of PLAIN functions —
 * never a `$computed` (the date-picker precedent: a `$computed` is a value on
 * React but an accessor on Solid, so aliasing/calling it in script logic
 * diverges across targets).
 *
 * No framework imports, no DOM — pure data in, pure data out.
 *
 * NOTE (260802-sc5, Task 1 — RED): this file is a FAITHFUL, verbatim
 * extraction of the CURRENT (buggy) `Otp.rozie` semantics, ported so the red
 * suite in `otpWrite.test.ts` fails BEHAVIORALLY rather than with a
 * module-resolution error. `planWrite` and `planEmits` are fixed for real in
 * Task 3 (GREEN); `isAllowedChar` / `firstEmptyIndex` / `sanitize` are already
 * correct and unchanged by that fix.
 */

export type OtpType = 'numeric' | 'alphanumeric' | 'text' | (string & {});

/** Allowed-character test for the configured `type` (Otp.rozie `allowChar`). */
export function isAllowedChar(type: OtpType, ch: string): boolean {
  if (!ch) return false;
  if (type === 'numeric') return /[0-9]/.test(ch);
  if (type === 'alphanumeric') return /[a-zA-Z0-9]/.test(ch);
  return /\S/.test(ch);
}

/**
 * The cell that should receive focus for new input: the first empty position,
 * clamped to the last cell when the code is already full (Otp.rozie
 * `firstEmptyIndex`). Unchanged by the Task 3 fix — full-code clamp was
 * already correct.
 */
export function firstEmptyIndex(code: string, length: number): number {
  const len = code.length;
  return len >= length ? length - 1 : len;
}

/** Filter `text` down to the characters `type` allows (Otp.rozie onPaste). */
export function sanitize(type: OtpType, text: string): string[] {
  return text.split('').filter((ch) => isAllowedChar(type, ch));
}

export interface OtpWrite {
  /** The full resulting code string, clamped to `length`. */
  next: string;
  /** The index the FIRST char actually wrote to. */
  landed: number;
  /** The index that should receive focus after the write. */
  focus: number;
}

/**
 * BUGGY (verbatim port of Otp.rozie:206,212 `onInput`): takes only the LAST
 * char of `text` and splices it in at the raw `index` — no clamp to the fill
 * point (D3), no multi-char distribution (D2). Fixed for real in Task 3.
 */
export function planWrite(code: string, length: number, type: OtpType, index: number, text: string): OtpWrite | null {
  const ch = text.slice(-1);
  if (!isAllowedChar(type, ch)) return null;
  const next = (code.slice(0, index) + ch + code.slice(index + 1)).slice(0, length);
  return { next, landed: index, focus: index + 1 };
}

export interface OtpEmits {
  change: boolean;
  complete: boolean;
}

/**
 * BUGGY (verbatim port of Otp.rozie:190-191 `commitValue`): `change` fires
 * unconditionally; `complete` fires whenever `next.length === length` — which
 * includes the `length: 0` edge (`clear()` on a zero-length Otp emits
 * `complete` with `''`) and re-fires on every in-place edit of an
 * already-full code (D4). Fixed for real in Task 3.
 */
export function planEmits(prev: string, next: string, length: number): OtpEmits {
  return { change: true, complete: next.length === length };
}
