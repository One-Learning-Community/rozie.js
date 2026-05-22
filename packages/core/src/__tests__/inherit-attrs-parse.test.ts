// Phase 14 Plan 14-01 (Wave 0 scaffold) — `<rozie inherit-attrs>` parse (R5).
//
// `inherit-attrs` is the boolean attribute on the `<rozie>` envelope tag that
// controls cross-framework attribute fallthrough. `splitBlocks` extracts it
// onto `BlockMap.rozie.inheritAttrs`:
//   - `inherit-attrs="false"`           → inheritAttrs === false
//   - attribute absent                  → inheritAttrs key omitted (undefined)
//   - `inherit-attrs` / `="true"` / any non-"false" value → inheritAttrs true
//
// These cases PASS as of Task 2 — the splitBlocks parse plumbing landed in
// Plan 14-01. They are the executable R5 assertions for the Nyquist gate.
import { describe, it, expect } from 'vitest';
import { splitBlocks } from '../splitter/splitBlocks.js';

/** Build a minimal `.rozie` source with the given `<rozie>` opening tag. */
function withRozieTag(openTag: string): string {
  return `${openTag}
<template><div></div></template>
</rozie>
`;
}

describe('<rozie inherit-attrs> parse (Phase 14 R5)', () => {
  it('R5: inherit-attrs="false" → BlockMap.rozie.inheritAttrs === false', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-attrs="false">'),
    );
    expect(result.rozie, 'rozie envelope should be present').toBeDefined();
    expect(result.rozie!.inheritAttrs).toBe(false);
  });

  it('R5: no inherit-attrs attribute → inheritAttrs key is omitted (undefined)', () => {
    const result = splitBlocks(withRozieTag('<rozie name="X">'));
    expect(result.rozie, 'rozie envelope should be present').toBeDefined();
    expect(result.rozie!.inheritAttrs).toBeUndefined();
  });

  it('R5: inherit-attrs="true" → inheritAttrs === true', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-attrs="true">'),
    );
    expect(result.rozie!.inheritAttrs).toBe(true);
  });

  it('R5: present-without-value inherit-attrs → inheritAttrs === true', () => {
    const result = splitBlocks(withRozieTag('<rozie name="X" inherit-attrs>'));
    expect(result.rozie!.inheritAttrs).toBe(true);
  });

  it('R5: a garbage inherit-attrs value falls back to the safe default true (T-14-01)', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" inherit-attrs="yes please">'),
    );
    expect(result.rozie!.inheritAttrs).toBe(true);
  });
});
