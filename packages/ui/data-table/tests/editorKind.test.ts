/**
 * editorKind.test.ts — E-03 (source half), quick task 260921-tsu.
 *
 * `editorTypeOf` (columnChrome.rzts) resolves `meta.editor` and falls through to the plain
 * text `<input>` for ANY value it does not recognise. So `editor="date"` — advertised as a
 * fifth built-in on the comparison page and the root README until the 260910 audit corrected
 * them — rendered a text box with no error, no warning, and no hint that `EditorDate` is a
 * DROP-IN reached through `editor="custom"` plus an `#editor` fill. Any typo degraded the
 * same way. The docs half is fixed; this pins the runtime half.
 *
 * `editorKindWarning` is the pure half of that fix (the latch and the `console.warn` live in
 * columnBuilders.rzts, which is a `.rzts` partial and not importable). It returns the message
 * for a rejected value and null for an accepted one, so what the union IS and what a consumer
 * is told about a rejected value are both contracts rather than incidental strings.
 *
 * RED before the fix: the export did not exist.
 */
import { describe, it, expect } from 'vitest';
import { EDITOR_KINDS, editorKindWarning } from '../src/helpers/columnDefUtils';

describe('editorKindWarning', () => {
  it('accepts every documented editor kind', () => {
    // The union is four built-ins plus the `custom` GATE — `custom` is what routes a column to
    // the #editor slot, so it must be accepted here even though it renders no built-in control.
    expect(EDITOR_KINDS).toEqual(['text', 'number', 'select', 'checkbox', 'custom']);
    for (const kind of EDITOR_KINDS) {
      expect(editorKindWarning('price', kind)).toBeNull();
    }
  });

  it('accepts an absent editor (the column simply defaults to text)', () => {
    expect(editorKindWarning('price', null)).toBeNull();
    expect(editorKindWarning('price', undefined)).toBeNull();
  });

  it('rejects `date` — the value the retired docs advertised — and points at the real route', () => {
    const msg = editorKindWarning('due', 'date');
    expect(msg).not.toBeNull();
    // Names the offending column, so a consumer with 30 columns knows which one.
    expect(msg).toContain('"due"');
    expect(msg).toContain('editor="date"');
    // Names the real union and the actual escape hatch, rather than only saying "invalid".
    expect(msg).toContain('text | number | select | checkbox');
    expect(msg).toContain('editor="custom"');
    expect(msg).toContain('EditorDate');
  });

  it('rejects a typo and a non-string alike', () => {
    expect(editorKindWarning('qty', 'numbre')).toContain('editor="numbre"');
    expect(editorKindWarning('qty', 42)).toContain('editor="42"');
    expect(editorKindWarning('qty', {})).not.toBeNull();
  });
});
