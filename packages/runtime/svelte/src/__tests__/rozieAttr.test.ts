/**
 * Quick task 260621-wfi — rozieAttr runtime tests for @rozie/runtime-svelte.
 *
 * rozieAttr is the WHOLE-VALUE one-way attribute-binding helper: nullish DROPS
 * (returns undefined so the attribute is omitted), everything else stringifies
 * via rozieDisplay (single evaluation). The signature is generic and
 * input-type-preserving (so numeric attrs like tabindex typecheck under
 * svelte-check), but the RUNTIME behavior asserted here is unchanged: every
 * non-nullish value is returned in its stringified form.
 */
import { describe, it, expect } from 'vitest';
import { rozieAttr } from '../rozieAttr.js';

describe('rozieAttr', () => {
  it('stringifies a numeric value (0 is NOT dropped)', () => {
    expect(rozieAttr(0)).toBe('0');
    expect(rozieAttr(42)).toBe('42');
    expect(rozieAttr(-7)).toBe('-7');
  });

  it('preserves a numeric value selected from a `number | null` union at runtime', () => {
    const keyboardEnabled = true;
    expect(rozieAttr(keyboardEnabled ? 0 : null)).toBe('0');
    const keyboardDisabled = false;
    expect(rozieAttr(keyboardDisabled ? 0 : null)).toBe(undefined);
  });

  it('passes a plain string through unchanged', () => {
    expect(rozieAttr('x')).toBe('x');
    expect(rozieAttr('horizontal')).toBe('horizontal');
    expect(rozieAttr('')).toBe('');
  });

  it('drops null and undefined (attribute omitted)', () => {
    expect(rozieAttr(null)).toBe(undefined);
    expect(rozieAttr(undefined)).toBe(undefined);
  });

  it('preserves false as "false" (NOT dropped — a11y/presence-selector values survive)', () => {
    expect(rozieAttr(false)).toBe('false');
    expect(rozieAttr(true)).toBe('true');
  });

  it('delegates object stringification to rozieDisplay (2-space JSON)', () => {
    expect(rozieAttr({ a: 1, b: 'x' })).toBe('{\n  "a": 1,\n  "b": "x"\n}');
    expect(rozieAttr([1, 2])).toBe('[\n  1,\n  2\n]');
  });

  it('evaluates the input exactly once (single evaluation of impure exprs)', () => {
    let calls = 0;
    const impure = () => {
      calls += 1;
      return 5;
    };
    expect(rozieAttr(impure())).toBe('5');
    expect(calls).toBe(1);
  });
});
