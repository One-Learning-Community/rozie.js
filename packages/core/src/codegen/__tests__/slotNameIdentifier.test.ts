// Phase 79 Plan 03 (R12/D-04) — `isSlotNameIdentifier` is the single shared
// predicate every R12 routing plan (79-04, 79-05, 79-09/Lit) and Vue's
// `refineSlotTypes.ts` dispatch on. Direct coverage here locks the shape so a
// future consumer can trust the contract without re-deriving the regex.
import { describe, it, expect } from 'vitest';
import { isSlotNameIdentifier } from '../slotNameIdentifier.js';

describe('isSlotNameIdentifier', () => {
  it('returns true for a plain lowercase identifier', () => {
    expect(isSlotNameIdentifier('header')).toBe(true);
  });

  it('returns true for camelCase, leading underscore, and leading dollar', () => {
    expect(isSlotNameIdentifier('cellStatus')).toBe(true);
    expect(isSlotNameIdentifier('_private')).toBe(true);
    expect(isSlotNameIdentifier('$special')).toBe(true);
  });

  it('returns true for the literal string "default"', () => {
    expect(isSlotNameIdentifier('default')).toBe(true);
  });

  it('returns false for a hyphenated name', () => {
    expect(isSlotNameIdentifier('cell-status')).toBe(false);
  });

  it('returns false for a name with a leading digit', () => {
    expect(isSlotNameIdentifier('2col')).toBe(false);
  });

  it('returns false for the empty string (the default-slot sentinel, pre-fold)', () => {
    expect(isSlotNameIdentifier('')).toBe(false);
  });

  it('returns false for a name containing a space or quote', () => {
    expect(isSlotNameIdentifier('cell status')).toBe(false);
    expect(isSlotNameIdentifier("cell'status")).toBe(false);
  });
});
