import { describe, it, expect } from 'vitest';
import { extractRForAliases } from '../../src/semantic/extractRForAliases.js';

describe('extractRForAliases', () => {
  describe('simple form (item only)', () => {
    it('parses `item in items`', () => {
      expect(extractRForAliases('item in items')).toEqual({ item: 'item', index: null });
    });

    it('parses `item of items`', () => {
      expect(extractRForAliases('item of items')).toEqual({ item: 'item', index: null });
    });

    it('parses dollar-prefixed alias `$item in items`', () => {
      expect(extractRForAliases('$item in items')).toEqual({ item: '$item', index: null });
    });

    it('parses underscore-prefixed alias `_item in items`', () => {
      expect(extractRForAliases('_item in items')).toEqual({ item: '_item', index: null });
    });
  });

  describe('paren form (item, index in parens)', () => {
    it('parses `(item, idx) in items`', () => {
      expect(extractRForAliases('(item, idx) in items')).toEqual({ item: 'item', index: 'idx' });
    });

    it('parses `(item, idx) of items`', () => {
      expect(extractRForAliases('(item, idx) of items')).toEqual({ item: 'item', index: 'idx' });
    });

    it('parses `(value, key) in object`', () => {
      expect(extractRForAliases('(value, key) in obj')).toEqual({ item: 'value', index: 'key' });
    });

    it('tolerates extra whitespace inside parens', () => {
      expect(extractRForAliases('(  item ,  idx  ) in items')).toEqual({
        item: 'item',
        index: 'idx',
      });
    });
  });

  describe('bare-comma form (Vue-flavored shorthand)', () => {
    it('parses `item, idx in items`', () => {
      expect(extractRForAliases('item, idx in items')).toEqual({ item: 'item', index: 'idx' });
    });

    it('parses `item, idx of items`', () => {
      expect(extractRForAliases('item, idx of items')).toEqual({ item: 'item', index: 'idx' });
    });

    it('parses `row, rowIndex in rows` (the Table.rozie pattern)', () => {
      expect(extractRForAliases('row, rowIndex in $props.rows')).toEqual({
        item: 'row',
        index: 'rowIndex',
      });
    });

    it('tolerates flexible whitespace around the comma', () => {
      expect(extractRForAliases('item ,  idx in items')).toEqual({ item: 'item', index: 'idx' });
      expect(extractRForAliases('item,idx in items')).toEqual({ item: 'item', index: 'idx' });
    });
  });

  describe('parse failures', () => {
    it('returns null for empty input', () => {
      expect(extractRForAliases('')).toBeNull();
    });

    it('returns null when neither `in` nor `of` appears', () => {
      expect(extractRForAliases('item items')).toBeNull();
    });

    it('returns null for malformed bare-comma form with three identifiers', () => {
      // The third identifier means this doesn't match BARE_COMMA_FORM; the
      // SIMPLE_FORM also fails (a comma precedes the `in`). null is correct.
      expect(extractRForAliases('item, idx, extra in items')).toBeNull();
    });

    it('returns null for malformed paren form', () => {
      expect(extractRForAliases('(item idx) in items')).toBeNull();
      expect(extractRForAliases('(item,) in items')).toBeNull();
    });
  });
});
