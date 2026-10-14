import type { AriaAttributes } from 'react';
import { describe, expect, it } from 'vitest';
import { rozieAttr } from '../rozieAttr.js';

describe('rozieAttr boolean typing', () => {
  it('types a boolean as "true" | "false", which React aria attributes accept', () => {
    const flag = Math.random() > 2;
    // TS2322 when a boolean widened to `string`.
    const hidden: AriaAttributes['aria-hidden'] = rozieAttr(flag);
    expect(hidden).toBe('false');
  });
});
