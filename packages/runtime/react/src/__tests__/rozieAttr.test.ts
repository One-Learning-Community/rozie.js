/**
 * quick-task 260608-sya — rozieAttr algorithm units (attr-binding-nullish-drop).
 *
 * The react/solid/svelte bodies are identical (`v == null ? undefined :
 * rozieDisplay(v)`); lit returns `nothing` on nullish. This single react-package
 * spec covers the shared JSX-target body + the single-eval contract (it is NOT
 * duplicated into solid/svelte). The lit `nothing` branch is exercised by the
 * dist-parity Lit fixture + the behavioral absence spec.
 */
import { describe, it, expect } from 'vitest';
import { rozieAttr } from '../rozieAttr.js';

describe('rozieAttr (attr-binding-nullish-drop)', () => {
  it('returns undefined on null/undefined (DROP the attribute)', () => {
    expect(rozieAttr(null)).toBeUndefined();
    expect(rozieAttr(undefined)).toBeUndefined();
  });

  it('does NOT drop false — stringifies to "false" (aria-/data- a11y)', () => {
    expect(rozieAttr(false)).toBe('false');
  });

  it('stringifies non-nullish primitives via rozieDisplay', () => {
    expect(rozieAttr('v')).toBe('v');
    expect(rozieAttr('')).toBe('');
    expect(rozieAttr(0)).toBe('0');
    expect(rozieAttr(true)).toBe('true');
    expect(rozieAttr(42)).toBe('42');
  });

  it('renders non-primitives as 2-space JSON (rozieDisplay delegation)', () => {
    const value = { a: 1, b: [2, 3] };
    expect(rozieAttr(value)).toBe(JSON.stringify(value, null, 2));
  });

  it('evaluates the argument exactly once (no double-eval of impure exprs)', () => {
    let calls = 0;
    const keyFor = () => {
      calls += 1;
      return 'id-1';
    };
    expect(rozieAttr(keyFor())).toBe('id-1');
    // keyFor() is evaluated by the CALLER once; rozieAttr takes the resolved
    // value as a single argument and never re-invokes it. The emit-site swap
    // (rozieAttr(keyFor(item, idx))) therefore calls keyFor once — the whole
    // reason a helper is used instead of an inline `v == null ? … : …` ternary.
    expect(calls).toBe(1);
  });
});
