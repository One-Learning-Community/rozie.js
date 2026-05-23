// Phase 15 Plan 15-01 (Wave 0 scaffold) — `<rozie inherit-listeners>` parse (R5).
//
// `inherit-listeners` is the boolean attribute on the `<rozie>` envelope tag
// that controls cross-framework LISTENER fallthrough. `splitBlocks` extracts
// it onto `BlockMap.rozie.inheritListeners`, INDEPENDENT of `inherit-attrs`:
//   - `inherit-listeners="false"`           → inheritListeners === false
//   - attribute absent                       → inheritListeners key omitted (undefined)
//   - `inherit-listeners` / `="true"` / any non-"false" value → inheritListeners true
//
// These cases PASS as of Task 2 — the splitBlocks parse plumbing landed in
// Plan 15-01. They are the executable R5 assertions for the Nyquist gate.
//
// The four-flag-combination independence cases drive every (inherit-attrs ∈
// {auto, false}) × (inherit-listeners ∈ {auto, false}) combination and assert
// that toggling one flag does NOT affect the other field on BlockMap.rozie.
import { describe, it, expect } from 'vitest';
import { splitBlocks } from '../splitter/splitBlocks.js';

/** Build a minimal `.rozie` source with the given `<rozie>` opening tag. */
function withRozieTag(openTag: string): string {
  return `${openTag}
<template><div></div></template>
</rozie>
`;
}

describe('<rozie inherit-listeners> parse (Phase 15 R5)', () => {
  it('R5: inherit-listeners="false" → BlockMap.rozie.inheritListeners === false', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-listeners="false">'),
    );
    expect(result.rozie, 'rozie envelope should be present').toBeDefined();
    expect(result.rozie!.inheritListeners).toBe(false);
  });

  it('R5: no inherit-listeners attribute → inheritListeners key is omitted (undefined)', () => {
    const result = splitBlocks(withRozieTag('<rozie name="X">'));
    expect(result.rozie, 'rozie envelope should be present').toBeDefined();
    expect(result.rozie!.inheritListeners).toBeUndefined();
  });

  it('R5: inherit-listeners="true" → inheritListeners === true', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-listeners="true">'),
    );
    expect(result.rozie!.inheritListeners).toBe(true);
  });

  it('R5: present-without-value inherit-listeners → inheritListeners === true', () => {
    const result = splitBlocks(withRozieTag('<rozie name="X" inherit-listeners>'));
    expect(result.rozie!.inheritListeners).toBe(true);
  });

  it('R5: a garbage inherit-listeners value falls back to the safe default true (T-15-V5-01)', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-listeners="yes please">'),
    );
    expect(result.rozie!.inheritListeners).toBe(true);
  });

  it('R5 (WR-05): inherit-listeners="False" → inheritListeners === false (case-insensitive)', () => {
    // Mirror of Phase 14 WR-05: HTML treats boolean-keyword attribute values
    // as case-insensitive; honour that convention.
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-listeners="False">'),
    );
    expect(result.rozie!.inheritListeners).toBe(false);
  });

  it('R5 (WR-05): inherit-listeners="FALSE" → inheritListeners === false (uppercase)', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-listeners="FALSE">'),
    );
    expect(result.rozie!.inheritListeners).toBe(false);
  });

  // Independence cases — Phase 15 R5 lock: the inherit-attrs and
  // inherit-listeners flags are fully independent. Toggling one does NOT
  // affect the other field on BlockMap.rozie. The four-corner matrix exhausts
  // (auto/auto, auto/false, false/auto, false/false).

  it('R5 independence (auto/auto): neither flag set → both fields undefined', () => {
    const result = splitBlocks(withRozieTag('<rozie name="X">'));
    expect(result.rozie!.inheritAttrs).toBeUndefined();
    expect(result.rozie!.inheritListeners).toBeUndefined();
  });

  it('R5 independence (false/auto): inherit-attrs="false" alone → inheritAttrs=false, inheritListeners=undefined', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-attrs="false">'),
    );
    expect(result.rozie!.inheritAttrs).toBe(false);
    expect(result.rozie!.inheritListeners).toBeUndefined();
  });

  it('R5 independence (auto/false): inherit-listeners="false" alone → inheritListeners=false, inheritAttrs=undefined', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-listeners="false">'),
    );
    expect(result.rozie!.inheritListeners).toBe(false);
    expect(result.rozie!.inheritAttrs).toBeUndefined();
  });

  it('R5 independence (false/false): both flags false → both fields false (independently)', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-attrs="false" inherit-listeners="false">'),
    );
    expect(result.rozie!.inheritAttrs).toBe(false);
    expect(result.rozie!.inheritListeners).toBe(false);
  });
});
