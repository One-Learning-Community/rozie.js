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
import { normalizeAttrs, normalizeComponentAttrs } from '../normalizeAttrs.js';

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

/**
 * Quick 260804-f15 — `normalizeComponentAttrs`, the COMPONENT-tag runtime twin.
 *
 * A dynamic `r-bind` on a `<Component>` tag lowered to
 * `{...normalizeAttrs(obj)}` regardless of tag kind, so an object carrying
 * `readonly` / `tabindex` / `for` was key-renamed against a child whose
 * `splitProps` key list is built from its RAW `ir.props` — a silent prop loss.
 * Fourth and final member of the component-tag rename class (260711-i5m react
 * `:attr` → 260803-swj solid `:attr` → 260804-4cy react+solid `r-bind` LITERAL
 * → 260804-f15 DYNAMIC).
 *
 * The helper is a SIBLING export rather than an options flag on `normalizeAttrs`
 * (D-01) so a leaf that only spreads onto component tags tree-shakes the
 * 24-entry `SOLID_ATTR_KEY_MAP` out of its bundle entirely.
 *
 * NOTE the React/Solid asymmetry: the React twin keeps `class`→`className` on a
 * component tag (D-02); Solid keeps `class` VERBATIM, because `class` is
 * deliberately absent from `SOLID_ATTR_KEY_MAP` and Solid JSX takes `class`
 * natively on components and DOM nodes alike.
 */
describe('normalizeComponentAttrs (Solid runtime) — Quick 260804-f15', () => {
  it('RED-1 — every HTML-shape key survives VERBATIM on a component tag', () => {
    expect(
      normalizeComponentAttrs({ readonly: true, tabindex: 0, for: 'x', id: 'k' }),
    ).toEqual({ readonly: true, tabindex: 0, for: 'x', id: 'k' });
  });

  it('RED-2 (Solid difference) — `class` is kept VERBATIM, never renamed', () => {
    // The inverse of the React twin's RED-2. Solid has no `className`.
    expect(normalizeComponentAttrs({ class: 'c' })).toEqual({ class: 'c' });
  });

  it('RED-3 (SECURITY T-14-05) — pollution-vector keys are SKIPPED', () => {
    const malicious = JSON.parse(
      '{ "__proto__": { "polluted": true }, "constructor": "evil", "prototype": "evil", "id": "k" }',
    );
    const out = normalizeComponentAttrs(malicious);
    expect(Object.keys(out)).toEqual(['id']);
    expect(out).toEqual({ id: 'k' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('RED-4 — the output is built on a null-prototype object', () => {
    expect(Object.getPrototypeOf(normalizeComponentAttrs({ id: 'k' }))).toBe(null);
  });

  it('RED-5 — empty object input → empty object', () => {
    expect(normalizeComponentAttrs({})).toEqual({});
  });

  it('GREEN GUARD (D-03) — the existing `normalizeAttrs` surface is UNTOUCHED', () => {
    // Published leaves pin `@rozie/runtime-solid` EXACTLY (`workspace:*` is
    // rewritten to an exact version at publish — `@rozie-ui/combobox-solid@0.4.2`
    // ships `'@rozie/runtime-solid': '0.2.2'`), so the old function must stay
    // byte-compatible. Green BEFORE and AFTER this task.
    expect(normalizeAttrs({ for: 'x', readonly: true })).toEqual({
      htmlFor: 'x',
      readOnly: true,
    });
  });
});
