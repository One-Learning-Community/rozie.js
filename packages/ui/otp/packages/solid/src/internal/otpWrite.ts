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
 * `planWrite` is the ONE distribution routine that serves single-char typing,
 * SMS autofill, swipe, IME commit, and paste — it clamps the write position to
 * the current fill point (D3) and distributes every sanitized character from
 * there (D2), so a click past the fill point never leaves a hole and a
 * multi-char write (autofill) is never truncated to its last character.
 *
 * `planEmits` gates `change` on an actual value transition and `complete` on
 * the not-full -> full transition only (D4) — editing an already-full code in
 * place, or clearing at `length: 0`, never re-fires `complete`.
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
 * Plan a write of `text` into `code` starting near `index`, clamped to the
 * fill point (D3) and distributing every sanitized character (D2 — one path
 * serves single char, autofill, swipe, IME commit, and paste). Returns `null`
 * when the sanitized input is empty; the caller then restores the
 * originating cell's DOM value from the (unchanged) model.
 */
export function planWrite(code: string, length: number, type: OtpType, index: number, text: string): OtpWrite | null {
  const chars = sanitize(type, text);
  if (chars.length === 0) return null;
  // IN-04 (Quick 260803-ibt) — the degenerate `length: 0` boundary.
  // `firstEmptyIndex('', 0)` is `-1`, so an unclamped `Math.min(index, -1)`
  // would compute `landed = -1` and the fill loop below would write
  // `arr[-1]` (a non-index property; harmless to `.join('')`, but `landed:
  // -1` violates `OtpWrite.landed`'s documented contract — no char lands
  // anywhere at `length: 0`). Early-return `null`; the caller already
  // restores the originating cell's DOM value from the unchanged model on
  // a `null` result.
  if (length <= 0) return null;
  const landed = Math.min(index, firstEmptyIndex(code, length));
  const arr = code.split('');
  for (let k = 0; k < chars.length && landed + k < length; k++) {
    arr[landed + k] = chars[k];
  }
  const next = arr.join('').slice(0, length);
  const focus = Math.max(0, Math.min(landed + chars.length, length - 1));
  return { next, landed, focus };
}

export interface OtpEmits {
  change: boolean;
  complete: boolean;
}

/**
 * Plan the emit hygiene for a write (D4): `change` fires only on an actual
 * value transition; `complete` fires only on the not-full -> full transition
 * (never on an in-place edit of an already-full code, and never at
 * `length: 0`, which is the `clear()`-on-empty-Otp edge).
 */
export function planEmits(prev: string, next: string, length: number): OtpEmits {
  const changed = next !== prev;
  const wasFull = length > 0 && prev.length === length;
  const isFull = length > 0 && next.length === length;
  return { change: changed, complete: isFull && !wasFull };
}
