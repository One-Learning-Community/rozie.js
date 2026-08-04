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
import { normalizeAttrs, normalizeComponentAttrs } from '../normalizeAttrs.js';

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

/**
 * Quick 260804-f15 — `normalizeComponentAttrs`, the COMPONENT-tag runtime twin.
 *
 * A dynamic `r-bind` on a `<Component>` tag lowered to
 * `{...normalizeAttrs(obj)}` regardless of tag kind, so an object carrying
 * `readonly` / `tabindex` / `for` was key-renamed against a child that declared
 * those RAW names — a silent prop loss. This is the fourth and final member of
 * the component-tag rename class (260711-i5m react `:attr` → 260803-swj solid
 * `:attr` → 260804-4cy react+solid `r-bind` LITERAL → 260804-f15 DYNAMIC).
 *
 * The helper is a SIBLING export rather than an options flag on `normalizeAttrs`
 * (D-01) so a leaf that only spreads onto component tags tree-shakes the
 * 27-entry `REACT_ATTR_KEY_MAP` out of its bundle entirely.
 *
 * NOTE the React/Solid asymmetry: React KEEPS `class`→`className` on a component
 * tag (D-02 / quick 260804-4cy `ccc2225a`) because a Rozie React child reads its
 * class through `attrs.className`; the Solid twin keeps `class` verbatim.
 */
describe('normalizeComponentAttrs (React runtime) — Quick 260804-f15', () => {
  it('RED-1 — every HTML-shape key survives VERBATIM on a component tag', () => {
    // The whole point: a child declaring `readonly`/`tabindex`/`for` in its
    // props interface must receive those exact names.
    expect(
      normalizeComponentAttrs({ readonly: true, tabindex: 0, for: 'x', id: 'k' }),
    ).toEqual({ readonly: true, tabindex: 0, for: 'x', id: 'k' });
  });

  it('RED-2 (D-02) — `class` is the ONE rename React keeps on a component tag', () => {
    // Asserted explicitly so nobody "simplifies" the rename away: a Rozie React
    // child reads `attrs.className` (`packages/ui/switch/.../Switch.tsx:47,97`)
    // and a raw `class` on a DOM node makes React warn `Invalid DOM property`.
    expect(normalizeComponentAttrs({ class: 'c' })).toEqual({ className: 'c' });
    // Case-insensitive, mirroring the compile-time `rbindKeyToJsxName:537`.
    expect(normalizeComponentAttrs({ CLASS: 'c' })).toEqual({ className: 'c' });
  });

  it('RED-3 (SECURITY T-14-05) — pollution-vector keys are SKIPPED', () => {
    // `JSON.parse` makes `__proto__` an OWN enumerable key — the same technique
    // the `normalizeAttrs` security test above uses.
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
    // Published leaves pin `@rozie/runtime-react` EXACTLY (`workspace:*` is
    // rewritten to an exact version at publish), so the old function must stay
    // byte-compatible. Green BEFORE and AFTER this task.
    expect(normalizeAttrs({ class: 'btn', readonly: true, tabindex: 0 })).toEqual({
      className: 'btn',
      readOnly: true,
      tabIndex: 0,
    });
  });
});
