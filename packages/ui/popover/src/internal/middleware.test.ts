/**
 * middleware.test.ts — unit tests for the branchy Floating UI middleware builder.
 *
 * Asserts the ordering contract (offset → flip → shift → arrow) and each opt-out /
 * opt-in branch in isolation, using tagged stand-in factories (no real engine).
 * Excluded from the vendored leaf copy (codegen's copyInternal drops `*.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { buildMiddleware, type MiddlewareFactories, type MiddlewareConfig } from './middleware';

const factories: MiddlewareFactories = {
  offset: (value) => ({ name: 'offset', value }),
  flip: () => ({ name: 'flip' }),
  shift: () => ({ name: 'shift' }),
  arrow: (opts) => ({ name: 'arrow', element: opts.element }),
};

const names = (mw: unknown[]) => mw.map((m) => (m as { name: string }).name);

const base: MiddlewareConfig = {
  offset: 8,
  disableFlip: false,
  disableShift: false,
  arrow: false,
  arrowEl: null,
};

const fakeEl = {} as Element;

describe('buildMiddleware', () => {
  it('defaults to offset → flip → shift (no arrow)', () => {
    const mw = buildMiddleware(factories, base);
    expect(names(mw)).toEqual(['offset', 'flip', 'shift']);
  });

  it('threads the offset value into the offset middleware', () => {
    const mw = buildMiddleware(factories, { ...base, offset: 24 });
    expect(mw[0]).toEqual({ name: 'offset', value: 24 });
  });

  it('drops flip when disableFlip is set', () => {
    const mw = buildMiddleware(factories, { ...base, disableFlip: true });
    expect(names(mw)).toEqual(['offset', 'shift']);
  });

  it('drops shift when disableShift is set', () => {
    const mw = buildMiddleware(factories, { ...base, disableShift: true });
    expect(names(mw)).toEqual(['offset', 'flip']);
  });

  it('drops both flip and shift, keeping only offset', () => {
    const mw = buildMiddleware(factories, { ...base, disableFlip: true, disableShift: true });
    expect(names(mw)).toEqual(['offset']);
  });

  it('appends arrow LAST when arrow is on AND an element is present', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: true, arrowEl: fakeEl });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift', 'arrow']);
    expect((mw[mw.length - 1] as { element: Element }).element).toBe(fakeEl);
  });

  it('omits arrow when arrow is on but no element has mounted yet', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: true, arrowEl: null });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift']);
  });

  it('omits arrow when an element exists but arrow is off', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: false, arrowEl: fakeEl });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift']);
  });
});
