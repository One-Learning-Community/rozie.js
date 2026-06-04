/**
 * Differential parity test for the 2026-06-04 postcss → style-to-js swap.
 *
 * Proves the shipped `parseInlineStyle` (now backed by `style-to-js`) produces
 * byte-identical output to the prior postcss implementation across an
 * edge-case corpus — quoted semicolons, `url(data:…;base64,…)` data URIs,
 * inline comments, `!important`, vendor prefixes, custom properties. The swap
 * removed postcss (~24 KB gzip) from the consumer bundle; postcss is retained
 * in devDependencies purely as the live oracle below.
 *
 * If this ever diverges, do NOT rebless it away — either `style-to-js` changed
 * behavior or the swap is unsafe for that input. Investigate first.
 */
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { parseInlineStyle, toStyleObjectKey } from '../parseInlineStyle.js';

/** The pre-swap postcss implementation, verbatim, kept as the differential oracle. */
function legacyParseInlineStyle(text: string): Record<string, string> {
  if (text.length === 0 || /^\s*$/.test(text)) return {};
  const obj: Record<string, string> = {};
  try {
    const root = postcss.parse(text);
    root.walkDecls((decl) => {
      const key = toStyleObjectKey(decl.prop);
      obj[key] = decl.important ? `${decl.value} !important` : decl.value;
    });
  } catch {
    // Tolerant: the old runtime path swallowed parse failures too.
  }
  return obj;
}

const CORPUS = [
  'background-color: #BADA55',
  'color: red; font-size: 14px',
  '--my-var: 10px',
  '-webkit-mask: url(x); -moz-box-sizing: border-box',
  "content: 'a;b'",
  'content: "a;b"',
  'background: url(data:image/png;base64,iVBORw0KGgo=)',
  'background: url("data:image/svg+xml;utf8,<svg/>")',
  'color: red; /* note */ font-size: 12px',
  'color: red !important',
  'opacity: 0.5; ',
  'transform: translate(1px, 2px) rotate(5deg)',
  'margin: 0; padding: 0;;',
  '',
  '   ',
];

describe('parseInlineStyle parity: style-to-js === legacy postcss', () => {
  it.each(CORPUS)('matches the postcss oracle for %j', (input) => {
    expect(parseInlineStyle(input)).toEqual(legacyParseInlineStyle(input));
  });
});
