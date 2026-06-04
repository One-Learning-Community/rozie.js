/**
 * Phase 26 Plan 26-01 Task 2 — rozieDisplay algorithm units (SPEC-2 acceptance).
 *
 * All four non-Vue runtime packages share an identical body, so this single
 * react-package spec satisfies the SPEC-2 algorithm acceptance — it is NOT
 * duplicated into solid/svelte/lit.
 */
import { describe, it, expect } from 'vitest';
import { rozieDisplay } from '../rozieDisplay.js';

describe('rozieDisplay (SPEC-2 algorithm)', () => {
  it('passes strings through unquoted', () => {
    expect(rozieDisplay('x')).toBe('x');
    expect(rozieDisplay('hello world')).toBe('hello world');
    expect(rozieDisplay('')).toBe('');
  });

  it('String-coerces numbers and booleans', () => {
    expect(rozieDisplay(5)).toBe('5');
    expect(rozieDisplay(0)).toBe('0');
    expect(rozieDisplay(true)).toBe('true');
    expect(rozieDisplay(false)).toBe('false');
  });

  it('renders nullish as empty string', () => {
    expect(rozieDisplay(null)).toBe('');
    expect(rozieDisplay(undefined)).toBe('');
  });

  it('renders arrays as 2-space JSON', () => {
    expect(rozieDisplay([1, 2, 3])).toBe(JSON.stringify([1, 2, 3], null, 2));
  });

  it('renders plain objects as 2-space JSON (byte-equal to JSON.stringify(v, null, 2))', () => {
    const value = { a: 1, b: [2, 3] };
    expect(rozieDisplay(value)).toBe(JSON.stringify(value, null, 2));
  });

  // --- Documented exotic-type divergence from Vue (SPEC-2: accepted) ---
  // Vue's native toDisplayString renders a Date via its native String form;
  // rozieDisplay follows JSON.stringify semantics instead. This divergence is
  // intentional and accepted — asserted here so it is not "fixed" by mistake.
  it('renders a Date via JSON.stringify semantics (accepted divergence from Vue)', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(rozieDisplay(d)).toBe(JSON.stringify(d, null, 2));
    // Concretely the JSON-quoted ISO string, NOT Vue's native `d.toString()` form.
    expect(rozieDisplay(d)).toBe('"2026-01-01T00:00:00.000Z"');
  });

  // A Map has no own enumerable properties, so JSON.stringify yields '{}' —
  // another accepted divergence from Vue's native handling.
  it('renders a Map as JSON.stringify does — "{}" (accepted divergence from Vue)', () => {
    expect(rozieDisplay(new Map([['a', 1]]))).toBe('{}');
  });
});
