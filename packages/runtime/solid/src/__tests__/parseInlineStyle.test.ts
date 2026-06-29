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
