/**
 * toKebabCase / emitTagName — kebab-case conversion + `rozie-<kebab>` tag derivation.
 *
 * Regression coverage for Phase 15 Bug C1: the original regex
 * `/([a-z0-9])([A-Z])/g` only split lowercase/digit → uppercase boundaries.
 * Adjacent-uppercase runs (e.g. `RO` in `ROnProbe`) silently collapsed, so
 * `ROnProbe` mis-emitted as `rozie-ron-probe` instead of `rozie-r-on-probe`,
 * which broke the VR harness `customElements.whenDefined('rozie-r-on-probe')`
 * wait in `tests/visual-regression/host/entry.lit.ts`.
 *
 * The fix adds a second alternative — `[A-Z](?=[A-Z][a-z])` — to the first
 * capture group: an uppercase that immediately precedes an uppercase-then-
 * lowercase pair, i.e. a word boundary in the middle of an acronym.
 */
import { describe, it, expect } from 'vitest';
import { toKebabCase, emitTagName } from '../emitDecorator.js';

describe('toKebabCase', () => {
  describe('existing-passing cases (regression coverage)', () => {
    it('single-word PascalCase → all lowercase', () => {
      expect(toKebabCase('Counter')).toBe('counter');
    });

    it('two-word PascalCase → hyphenated', () => {
      expect(toKebabCase('TodoList')).toBe('todo-list');
    });

    it('SearchInput → search-input', () => {
      expect(toKebabCase('SearchInput')).toBe('search-input');
    });

    it('FullCalendar → full-calendar', () => {
      expect(toKebabCase('FullCalendar')).toBe('full-calendar');
    });

    it('digit-then-uppercase splits', () => {
      // The `[a-z0-9]` branch covers digit→uppercase transitions.
      expect(toKebabCase('Item1Detail')).toBe('item1-detail');
    });
  });

  describe('adjacent-uppercase boundary (Phase 15 Bug C1)', () => {
    it('ROnProbe → r-on-probe (the bug that surfaced this)', () => {
      // RO|nProbe: R is uppercase, followed by O which itself is uppercase-then-lowercase.
      // Word boundary is between R and On.
      expect(toKebabCase('ROnProbe')).toBe('r-on-probe');
    });

    it('URLPath → url-path (3-letter acronym head)', () => {
      // URL|Path: boundary between the L of URL and the P of Path.
      expect(toKebabCase('URLPath')).toBe('url-path');
    });

    it('XMLParser → xml-parser', () => {
      expect(toKebabCase('XMLParser')).toBe('xml-parser');
    });

    it('pure-acronym component stays single word', () => {
      // No internal uppercase-then-lowercase ⇒ no split inside the acronym.
      expect(toKebabCase('URL')).toBe('url');
    });

    it('mixed acronym + multiword: APIClientFactory', () => {
      expect(toKebabCase('APIClientFactory')).toBe('api-client-factory');
    });
  });
});

describe('emitTagName', () => {
  it('prefixes with `rozie-` and kebab-cases', () => {
    expect(emitTagName('Counter')).toBe('rozie-counter');
    expect(emitTagName('SearchInput')).toBe('rozie-search-input');
  });

  it('derives the Phase 15 harness-expected tag for ROnProbe', () => {
    // Matches the LIT_TAGS.ROnProbe = 'rozie-r-on-probe' entry in
    // tests/visual-regression/host/main.ts and the
    // customElements.whenDefined('rozie-r-on-probe') wait in
    // tests/visual-regression/host/entry.lit.ts.
    expect(emitTagName('ROnProbe')).toBe('rozie-r-on-probe');
  });
});
