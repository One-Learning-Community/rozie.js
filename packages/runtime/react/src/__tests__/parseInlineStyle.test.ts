/**
 * Quick-task 260520-8iu Task 1 — parseInlineStyle unit tests (React runtime).
 *
 * Covers the Spike 004 string-form `:style` runtime-helper behavior:
 * style-to-js-driven declaration parse, kebab→camel key conversion,
 * `!important` preservation, custom-property / vendor-prefix handling,
 * quoted-semicolon resilience, empty/whitespace + malformed guards.
 * (See parseInlineStyle.parity.test.ts for the postcss differential.)
 */
import { describe, it, expect } from 'vitest';
import { parseInlineStyle, toStyleObjectKey } from '../parseInlineStyle.js';

describe('parseInlineStyle (Plan 260520-8iu Task 1)', () => {
  it('single declaration → single object key', () => {
    expect(parseInlineStyle('background: red')).toEqual({ background: 'red' });
  });

  it('kebab-case property names convert to camelCase keys', () => {
    expect(parseInlineStyle('background-color: blue; font-size: 12px')).toEqual({
      backgroundColor: 'blue',
      fontSize: '12px',
    });
  });

  it('CSS custom properties pass through verbatim', () => {
    expect(parseInlineStyle('--custom-prop: 4px')).toEqual({ '--custom-prop': '4px' });
  });

  it('vendor-prefixed property → leading-capital camelCase key', () => {
    expect(parseInlineStyle('-webkit-mask: url(a.png)')).toEqual({ WebkitMask: 'url(a.png)' });
  });

  it('!important is preserved by appending it to the value', () => {
    expect(parseInlineStyle('color: red !important')).toEqual({ color: 'red !important' });
  });

  it('empty input → empty object', () => {
    expect(parseInlineStyle('')).toEqual({});
  });

  it('whitespace-only input → empty object', () => {
    expect(parseInlineStyle('   ')).toEqual({});
  });

  it('quoted semicolons inside values survive (style-to-js, not naive split)', () => {
    expect(parseInlineStyle('content: "a;b"')).toEqual({ content: '"a;b"' });
  });

  it('malformed style string does NOT throw — returns {} or partial object', () => {
    // The runtime path has no diagnostic stream; a parse failure must not
    // escape as an exception. style-to-js is wrapped to degrade to {}, so
    // the contract is "no throw", not "necessarily empty".
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
