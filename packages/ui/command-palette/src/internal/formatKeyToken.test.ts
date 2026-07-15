import { describe, it, expect } from 'vitest';
import { formatKeyToken } from './formatKeyToken';

describe('formatKeyToken', () => {
  it('returns "" for a non-string token', () => {
    expect(formatKeyToken(undefined, true)).toBe('');
    expect(formatKeyToken(undefined, false)).toBe('');
    expect(formatKeyToken(null, true)).toBe('');
    expect(formatKeyToken(123, true)).toBe('');
  });

  it('returns "" for an empty token', () => {
    expect(formatKeyToken('', true)).toBe('');
    expect(formatKeyToken('', false)).toBe('');
  });

  it('formats a single modifier + single-char final segment', () => {
    expect(formatKeyToken('$mod+p', true)).toBe('⌘P');
    expect(formatKeyToken('$mod+p', false)).toBe('Ctrl+P');
  });

  it('byte-identity anchor: $mod+k matches today\'s actionKeyHint output', () => {
    expect(formatKeyToken('$mod+k', true)).toBe('⌘K');
    expect(formatKeyToken('$mod+k', false)).toBe('Ctrl+K');
  });

  it('formats two modifiers + single-char final segment, preserving author order', () => {
    expect(formatKeyToken('$mod+$shift+p', true)).toBe('⌘⇧P');
    expect(formatKeyToken('$mod+$shift+p', false)).toBe('Ctrl+Shift+P');
  });

  it('formats $alt+$ctrl combo, preserving author order', () => {
    expect(formatKeyToken('$alt+$ctrl+f', true)).toBe('⌥⌃F');
    expect(formatKeyToken('$alt+$ctrl+f', false)).toBe('Alt+Ctrl+F');
  });

  it('first-letter-capitalizes a multi-char final non-modifier segment on BOTH platforms', () => {
    expect(formatKeyToken('$shift+enter', true)).toBe('⇧Enter');
    expect(formatKeyToken('$shift+enter', false)).toBe('Shift+Enter');
  });

  it('leaves a multi-char final token like F5 verbatim (already the desired case)', () => {
    expect(formatKeyToken('$mod+F5', true)).toBe('⌘F5');
    expect(formatKeyToken('$mod+F5', false)).toBe('Ctrl+F5');
  });

  it('uppercases a bare single-char token with no modifiers', () => {
    expect(formatKeyToken('k', true)).toBe('K');
    expect(formatKeyToken('k', false)).toBe('K');
  });

  it('leaves a bare multi-char non-modifier token verbatim', () => {
    expect(formatKeyToken('Tab', true)).toBe('Tab');
    expect(formatKeyToken('Tab', false)).toBe('Tab');
  });

  it('matches modifiers case-insensitively', () => {
    expect(formatKeyToken('$MOD+p', true)).toBe('⌘P');
    expect(formatKeyToken('$MOD+p', false)).toBe('Ctrl+P');
  });
});
