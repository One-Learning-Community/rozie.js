import type { JSX } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { rozieAttr } from '../rozieAttr.js';

describe('rozieAttr', () => {
  it('drops nullish values and stringifies the rest', () => {
    expect(rozieAttr(null)).toBeUndefined();
    expect(rozieAttr(undefined)).toBeUndefined();
    expect(rozieAttr(false)).toBe('false');
    expect(rozieAttr(true)).toBe('true');
    expect(rozieAttr(3)).toBe('3');
  });

  it('types a boolean as "true" | "false", which Solid aria attributes accept', () => {
    const flag = Math.random() > 2;
    // TS2322 when a boolean widened to `string`.
    const hidden: JSX.HTMLAttributes<HTMLElement>['aria-hidden'] = rozieAttr(flag);
    const maybe: JSX.HTMLAttributes<HTMLElement>['aria-expanded'] = rozieAttr(flag ? true : null);
    expect([hidden, maybe]).toEqual(['false', undefined]);
  });
});
