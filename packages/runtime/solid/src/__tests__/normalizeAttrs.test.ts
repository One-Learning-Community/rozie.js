/**
 * Plan 14-03 Task 1 — normalizeAttrs unit tests (Solid runtime).
 *
 * Covers the D-03 hybrid's RUNTIME path for Solid. Unlike React, Solid keeps
 * `class` as `class` (Solid JSX supports `class` natively) — only `for`→`htmlFor`
 * and the other shared React-DOM property names are remapped.
 *
 * SECURITY (T-14-05) — prototype-pollution: `__proto__` / `constructor` /
 * `prototype` keys in the input must be SKIPPED, never copied to the output.
 */
import { describe, it, expect } from 'vitest';
import { normalizeAttrs } from '../normalizeAttrs.js';

describe('normalizeAttrs (Solid runtime) — Plan 14-03 Task 1', () => {
  it('keeps class as class, remaps for to htmlFor; passes other keys through', () => {
    expect(normalizeAttrs({ for: 'x', id: 'y', class: 'btn' })).toEqual({
      htmlFor: 'x',
      id: 'y',
      class: 'btn',
    });
  });

  it('remaps the standard shared React-DOM name set (but keeps class)', () => {
    expect(
      normalizeAttrs({
        tabindex: '-1',
        readonly: true,
        maxlength: 5,
        colspan: 2,
        rowspan: 3,
        crossorigin: 'anonymous',
        class: 'kept',
      }),
    ).toEqual({
      tabIndex: '-1',
      readOnly: true,
      maxLength: 5,
      colSpan: 2,
      rowSpan: 3,
      crossOrigin: 'anonymous',
      class: 'kept',
    });
  });

  it('aria-* and data-* keys pass through verbatim', () => {
    expect(normalizeAttrs({ 'aria-label': 'L', 'data-id': '5' })).toEqual({
      'aria-label': 'L',
      'data-id': '5',
    });
  });

  it('empty object input returns empty object', () => {
    expect(normalizeAttrs({})).toEqual({});
  });

  it('keys not in the remap table pass through verbatim', () => {
    expect(normalizeAttrs({ title: 't', role: 'button' })).toEqual({
      title: 't',
      role: 'button',
    });
  });

  it('SECURITY: __proto__ key is SKIPPED, no prototype pollution', () => {
    const malicious = JSON.parse('{ "__proto__": { "polluted": true }, "id": "ok" }');
    const out = normalizeAttrs(malicious);
    expect(out).toEqual({ id: 'ok' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('SECURITY: constructor and prototype keys are SKIPPED', () => {
    const out = normalizeAttrs({
      constructor: 'evil',
      prototype: 'evil',
      for: 'kept',
    } as Record<string, unknown>);
    expect(out).toEqual({ htmlFor: 'kept' });
    expect(Object.prototype.hasOwnProperty.call(out, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'prototype')).toBe(false);
  });
});
