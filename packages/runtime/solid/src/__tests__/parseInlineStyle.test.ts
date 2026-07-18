/**
 * parseInlineStyle unit tests (Solid runtime).
 *
 * LB6 SEAM 3 — a CSS STRING is now passed through VERBATIM (Solid's `style()`
 * helper applies it via `node.style.cssText`, where the browser's CSS parser
 * handles every kebab-case declaration correctly). The prior style-to-js
 * camelCase parse was REMOVED: Solid applies object-form styles through
 * `CSSStyleDeclaration.setProperty(key, …)`, which silently drops a camelCased
 * multi-word key (`paddingLeft`) — the data-table expander depth-indent bug.
 * Object inputs (e.g. a `$computed` custom-property map) still pass through.
 */
import { describe, it, expect } from 'vitest';
import { parseInlineStyle, toStyleObjectKey } from '../parseInlineStyle.js';

describe('parseInlineStyle (LB6 SEAM 3 — string passthrough)', () => {
  it('a CSS string is passed through verbatim (Solid applies it via cssText)', () => {
    expect(parseInlineStyle('background: red')).toBe('background: red');
  });

  it('a multi-word kebab declaration is NOT camelCased (would break Solid setProperty)', () => {
    expect(parseInlineStyle('padding-left:1.75rem')).toBe('padding-left:1.75rem');
    expect(parseInlineStyle('background-color: blue; font-size: 12px')).toBe(
      'background-color: blue; font-size: 12px',
    );
  });

  it('CSS custom-property string passes through verbatim', () => {
    expect(parseInlineStyle('--custom-prop: 4px')).toBe('--custom-prop: 4px');
  });

  it('an already-built style OBJECT (custom-property map) passes through unchanged', () => {
    expect(parseInlineStyle({ '--custom-prop': '4px' })).toEqual({ '--custom-prop': '4px' });
  });

  it('!important survives untouched in the string', () => {
    expect(parseInlineStyle('color: red !important')).toBe('color: red !important');
  });

  it('empty input → empty object', () => {
    expect(parseInlineStyle('')).toEqual({});
  });

  it('whitespace-only input → empty object', () => {
    expect(parseInlineStyle('   ')).toEqual({});
  });

  it('null / undefined → empty object', () => {
    expect(parseInlineStyle(null)).toEqual({});
    expect(parseInlineStyle(undefined)).toEqual({});
  });

  it('quoted semicolons inside values survive (string is handed to the browser parser intact)', () => {
    expect(parseInlineStyle('content: "a;b"')).toBe('content: "a;b"');
  });

  it('malformed style string does NOT throw (passed through for the browser to tolerate)', () => {
    expect(() => parseInlineStyle('color: ;;; }{[[')).not.toThrow();
  });
});

describe('parseInlineStyle — array-form merge (quick 260717-uvk)', () => {
  // Solid's object-form path hands the object DIRECTLY to Solid's `style()`
  // runtime, which applies it via `setProperty(key, value)` — this REQUIRES
  // kebab-case keys (a camelCase multi-word key like `fontSize` is a silent
  // no-op, the exact LB6 SEAM 3 bug). So array-merge normalizes everything to
  // ONE CSS-declaration STRING (each element's own casing preserved verbatim —
  // object elements are expected to already carry Solid-compatible keys, same
  // contract as the existing single-object passthrough), left-to-right. The
  // browser's own cssText application gives later-wins semantics for a
  // duplicate property, matching Vue's normalizeStyle override behavior.
  it('merges two object elements left-to-right (later decl wins via cssText cascade)', () => {
    expect(parseInlineStyle([{ color: 'red' }, { color: 'blue' }])).toBe(
      'color: red; color: blue',
    );
  });

  it('merges a string element and an object element', () => {
    expect(
      parseInlineStyle(['background-color: blue', { 'font-size': '12px' }]),
    ).toBe('background-color: blue; font-size: 12px');
  });

  it('merges non-overlapping properties from multiple elements', () => {
    expect(
      parseInlineStyle([{ color: 'red' }, { 'font-size': '12px' }]),
    ).toBe('color: red; font-size: 12px');
  });

  it('skips nullish elements', () => {
    expect(parseInlineStyle([{ color: 'red' }, null, undefined])).toBe(
      'color: red',
    );
  });

  it('an empty array → empty object', () => {
    expect(parseInlineStyle([])).toEqual({});
  });

  it('a string element with a trailing semicolon does not produce a double semicolon', () => {
    expect(parseInlineStyle(['color: red;', { 'font-size': '12px' }])).toBe(
      'color: red; font-size: 12px',
    );
  });

  it('a malformed string element does not throw', () => {
    expect(() => parseInlineStyle(['color: ;;; }{[[', { color: 'red' }])).not.toThrow();
  });
});

describe('toStyleObjectKey (Plan 260520-8iu Task 1)', () => {
  it('standard kebab → camel', () => {
    expect(toStyleObjectKey('background-color')).toBe('backgroundColor');
  });
  it('vendor prefix → leading capital', () => {
    expect(toStyleObjectKey('-webkit-mask')).toBe('WebkitMask');
    expect(toStyleObjectKey('-moz-foo')).toBe('MozFoo');
  });
  it('custom property passes through verbatim', () => {
    expect(toStyleObjectKey('--custom-prop')).toBe('--custom-prop');
  });
  it('single-word property is unchanged', () => {
    expect(toStyleObjectKey('color')).toBe('color');
  });
});
