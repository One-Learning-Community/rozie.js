// PARSE-01 / D-11 — byte-offset → line/column converter unit tests.
// Implementation: packages/core/src/diagnostics/offsetToLineCol.ts (Plan 02 Task 1).
import { describe, expect, it } from 'vitest';
import { offsetToLineCol } from '../src/diagnostics/offsetToLineCol.js';

describe('offsetToLineCol (D-11 helper, used by every diagnostic renderer)', () => {
  it('returns line:1 column:0 at offset 0 of a single-line source', () => {
    expect(offsetToLineCol('abc', 0)).toEqual({ line: 1, column: 0 });
  });

  it('counts columns within the first line correctly', () => {
    expect(offsetToLineCol('abc', 2)).toEqual({ line: 1, column: 2 });
  });

  it('resets column to 0 after a newline', () => {
    // 'ab\ncd' — offset 3 is 'c', the first byte of line 2.
    expect(offsetToLineCol('ab\ncd', 3)).toEqual({ line: 2, column: 0 });
  });

  it('handles multiple newlines (line counter advances per LF)', () => {
    // 'a\nb\nc' — offset 4 is 'c', the first byte of line 3.
    expect(offsetToLineCol('a\nb\nc', 4)).toEqual({ line: 3, column: 0 });
  });

  it('handles offset === source.length (one past the end is valid for end-locations)', () => {
    expect(offsetToLineCol('abc', 3)).toEqual({ line: 1, column: 3 });
  });

  it('treats CRLF newline as still bumping line on \\n (LF)', () => {
    // 'a\r\nb' — index 3 is 'b'. The \r at index 1 doesn't bump line; the \n at 2 does.
    // column for 'b' = offset(3) - lastNewline(2) - 1 = 0
    expect(offsetToLineCol('a\r\nb', 3)).toEqual({ line: 2, column: 0 });
  });
});
