/**
 * otpWrite.test.ts — pure write-model specs for the Otp family, asserting the
 * DESIRED (fixed) semantics against `otpWrite.ts`.
 *
 * Task 1 (260802-sc5): `otpWrite.ts` currently ships a FAITHFUL, verbatim
 * extraction of the CURRENT (buggy) `Otp.rozie` behavior, so these assertions
 * are RED for the right reason — each failure points at exactly one of the
 * post-release audit defects (D2 autofill/multi-char, D3 fill-point clamp, D4
 * emit hygiene). Task 3 makes `planWrite` / `planEmits` real and this suite
 * goes GREEN.
 *
 * Excluded from the leaf vendor by codegen's `copyInternal` (`*.test.ts`
 * filter) — this file runs ONLY here, never shipped to a consumer.
 */
import { describe, it, expect } from 'vitest';
import { firstEmptyIndex, isAllowedChar, planEmits, planWrite } from './otpWrite';

describe('planWrite — D2 multi-char / autofill', () => {
  it('distributes a full 6-char autofill from an empty code', () => {
    expect(planWrite('', 6, 'numeric', 0, '123456')).toEqual({ next: '123456', landed: 0, focus: 5 });
  });

  it('filters disallowed characters out of a multi-char write', () => {
    expect(planWrite('', 6, 'numeric', 0, '12a3')).toEqual({ next: '123', landed: 0, focus: 3 });
  });

  it('returns null when every character is disallowed', () => {
    expect(planWrite('', 6, 'numeric', 0, 'abc')).toBeNull();
  });

  it('truncates a write that would overflow length', () => {
    const result = planWrite('12', 4, 'numeric', 0, '987654');
    expect(result).not.toBeNull();
    expect(result?.next.length).toBe(4);
  });
});

describe('firstEmptyIndex / planWrite — D3 clamp to the fill point', () => {
  it('firstEmptyIndex reports the first empty cell', () => {
    expect(firstEmptyIndex('123', 6)).toBe(3);
  });

  it('firstEmptyIndex clamps to length - 1 when full', () => {
    expect(firstEmptyIndex('123456', 6)).toBe(5);
  });

  it('a write past the fill point lands AT the fill point, not the click target', () => {
    // Only 3 of 6 cells filled; clicking cell 5 and typing must not leave a hole.
    expect(planWrite('123', 6, 'numeric', 5, '9')).toEqual({ next: '1239', landed: 3, focus: 4 });
  });

  it('a full code is editable in place at any cell (clamp is a no-op when full)', () => {
    // Pins the existing VR expectation: '123456' -> click cell 0 -> '7' -> '723456'.
    expect(planWrite('123456', 6, 'numeric', 0, '7')).toEqual({ next: '723456', landed: 0, focus: 1 });
  });

  it('a multi-char write past the fill point still lands at the fill point', () => {
    const result = planWrite('123', 6, 'numeric', 4, '45');
    expect(result).not.toBeNull();
    expect(result?.landed).toBe(3);
    expect(result?.next).toBe('12345');
  });

  it('focus never exceeds length - 1', () => {
    expect(planWrite('12345', 6, 'numeric', 5, '6')?.focus).toBe(5);
  });

  // IN-04 (Quick 260803-ibt) — the degenerate `length: 0` boundary.
  // `firstEmptyIndex('', 0)` is `-1` (`len(0) >= length(0)` -> `length - 1`
  // = `-1`), so pre-fix `planWrite` computed `landed = Math.min(index, -1)`
  // = `-1`, the fill loop wrote `arr[-1]` (a non-index property, harmlessly
  // ignored by `.join('')`), and the function returned `{ next: '', landed:
  // -1, focus: 0 }` — violating `OtpWrite.landed`'s documented contract
  // ("the index the FIRST char actually wrote to"): no char landed anywhere
  // at `length: 0`, so `-1` is not a real answer. Early-return `null` — the
  // caller already handles `null` by restoring the originating cell's DOM
  // value from the (unchanged) model.
  it('length: 0 boundary — planWrite returns null, never { landed: -1 }', () => {
    // '5' passes the numeric sanitize filter (chars.length > 0), so this
    // exercises the length:0 landed-clamp path specifically, not the
    // pre-existing "every character disallowed" early return above.
    expect(planWrite('', 0, 'numeric', 0, '5')).toBeNull();
  });
});

describe('planEmits — D4 emit hygiene', () => {
  it('a no-op write emits neither change nor complete', () => {
    expect(planEmits('123', '123', 6)).toEqual({ change: false, complete: false });
  });

  it('the not-full -> full transition emits both change and complete', () => {
    expect(planEmits('12345', '123456', 6)).toEqual({ change: true, complete: true });
  });

  it('re-writing an already-full code with the same value emits neither', () => {
    expect(planEmits('123456', '123456', 6)).toEqual({ change: false, complete: false });
  });

  it('editing an already-full code in place emits change but NOT complete again', () => {
    expect(planEmits('123456', '12345X', 6)).toEqual({ change: true, complete: false });
  });

  it('clear() emits change but never complete', () => {
    expect(planEmits('123456', '', 6)).toEqual({ change: true, complete: false });
  });

  it('the length: 0 edge never emits complete with an empty value', () => {
    expect(planEmits('', '', 0)).toEqual({ change: false, complete: false });
  });
});

describe('isAllowedChar — type classes', () => {
  it('numeric rejects letters', () => {
    expect(isAllowedChar('numeric', 'a')).toBe(false);
  });

  it('alphanumeric accepts letters', () => {
    expect(isAllowedChar('alphanumeric', 'a')).toBe(true);
  });

  it('text accepts non-ASCII non-space characters', () => {
    expect(isAllowedChar('text', 'é')).toBe(true);
  });

  it('text rejects whitespace', () => {
    expect(isAllowedChar('text', ' ')).toBe(false);
  });

  it('every type rejects the empty string', () => {
    expect(isAllowedChar('numeric', '')).toBe(false);
    expect(isAllowedChar('alphanumeric', '')).toBe(false);
    expect(isAllowedChar('text', '')).toBe(false);
  });
});
