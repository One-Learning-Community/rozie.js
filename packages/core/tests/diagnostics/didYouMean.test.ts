// Phase 06.2 P1 Task 4 — didYouMean Levenshtein helper tests.
// Implementation: packages/core/src/diagnostics/didYouMean.ts.
import { describe, expect, it } from 'vitest';
import { didYouMean, distance } from '../../src/diagnostics/didYouMean.js';

describe('didYouMean (Phase 06.2 P1 Task 4)', () => {
  it('returns the closest candidate within distance ≤ 2', () => {
    // 'Modul' → 'Modal' is distance 1 (single substitution).
    expect(didYouMean('Modul', ['Modal', 'Toolbar', 'Card'])).toBe('Modal');
  });

  it('returns null when no candidate is within distance ≤ 2', () => {
    // 'Foobaz' is distance > 2 from 'Modal' and 'Card' both.
    expect(didYouMean('Foobaz', ['Modal', 'Card'])).toBeNull();
  });

  it('alphabetical tiebreak: closest pair at distance 1 → alphabetical-first wins', () => {
    // Both 'Modul' and 'Madal' are distance 1 from 'Modal'. 'Madal' < 'Modul'
    // alphabetically.
    expect(didYouMean('Modal', ['Modul', 'Madal'])).toBe('Madal');
  });

  it('returns null when candidates list is empty', () => {
    expect(didYouMean('Modal', [])).toBeNull();
  });

  it('returns the exact match (distance 0) when present', () => {
    expect(didYouMean('Modal', ['Modal', 'Card'])).toBe('Modal');
  });
});

describe('distance — Levenshtein implementation', () => {
  it('returns 0 for identical strings', () => {
    expect(distance('Modal', 'Modal')).toBe(0);
    expect(distance('', '')).toBe(0);
  });

  it('returns the length of the other string when one is empty', () => {
    expect(distance('', 'Modal')).toBe(5);
    expect(distance('Modal', '')).toBe(5);
  });

  it('returns 1 for a single substitution', () => {
    expect(distance('Modul', 'Modal')).toBe(1);
  });

  it('returns 1 for a single insertion or deletion', () => {
    expect(distance('Modal', 'Modals')).toBe(1);
    expect(distance('Modals', 'Modal')).toBe(1);
  });

  it('returns 2 for two-edit transformations', () => {
    expect(distance('Modal', 'Madel')).toBe(2);
  });

  it('orders args by short-first internally for memory minimization (no behavioral diff)', () => {
    // Distance is symmetric — verify both orderings produce identical results.
    expect(distance('CardHeader', 'CardHeadr')).toBe(distance('CardHeadr', 'CardHeader'));
  });
});
