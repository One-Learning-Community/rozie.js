/**
 * Plan 14-03 Task 1 — normalizeAttrs unit tests (React runtime).
 *
 * Covers the D-03 hybrid's RUNTIME path: a dynamic `r-bind` object whose keys
 * are not known at compile time is key-remapped at runtime so HTML-shape names
 * (`class`, `for`, …) become React-DOM-shape names (`className`, `htmlFor`, …).
 *
 * SECURITY (T-14-05) — prototype-pollution: `__proto__` / `constructor` /
 * `prototype` keys in the input must be SKIPPED, never copied to the output.
 */
import { describe, it, expect } from 'vitest';
import { normalizeAttrs } from '../normalizeAttrs.js';

describe('normalizeAttrs (React runtime) — Plan 14-03 Task 1', () => {
  it('remaps class→className and for→htmlFor; passes other keys through', () => {
    expect(normalizeAttrs({ class: 'btn', for: 'x', id: 'y' })).toEqual({
      className: 'btn',
      htmlFor: 'x',
      id: 'y',
    });
  });

  it('remaps the standard React-DOM name set', () => {
    expect(
      normalizeAttrs({
        tabindex: '-1',
        readonly: true,
        maxlength: 5,
        colspan: 2,
        rowspan: 3,
        contenteditable: true,
        crossorigin: 'anonymous',
      }),
    ).toEqual({
      tabIndex: '-1',
      readOnly: true,
      maxLength: 5,
      colSpan: 2,
      rowSpan: 3,
      contentEditable: true,
      crossOrigin: 'anonymous',
    });
  });

  it('aria-* and data-* keys pass through verbatim', () => {
    expect(normalizeAttrs({ 'aria-label': 'L', 'data-id': '5' })).toEqual({
      'aria-label': 'L',
      'data-id': '5',
    });
  });

  it('empty object input → empty object', () => {
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
      class: 'kept',
    } as Record<string, unknown>);
    expect(out).toEqual({ className: 'kept' });
    expect(Object.prototype.hasOwnProperty.call(out, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'prototype')).toBe(false);
  });
});
