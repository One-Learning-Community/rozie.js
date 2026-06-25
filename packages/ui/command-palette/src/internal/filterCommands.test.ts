import { describe, it, expect } from 'vitest';
import { commandMatches, filterCommands, type CommandItem } from './filterCommands';

const items: CommandItem[] = [
  { id: 'new', label: 'New File', keywords: ['create', 'add'] },
  { id: 'open', label: 'Open File', group: 'File' },
  { id: 'save', label: 'Save', keywords: ['write', 'persist'], disabled: true },
  { id: 'settings', label: 'Preferences', group: 'App' },
];

describe('filterCommands', () => {
  it('returns a shallow copy of all items for an empty query', () => {
    const out = filterCommands(items, '');
    expect(out.map((i) => i.id)).toEqual(['new', 'open', 'save', 'settings']);
    expect(out).not.toBe(items);
  });

  it('treats a whitespace-only query as empty', () => {
    expect(filterCommands(items, '   ').length).toBe(4);
  });

  it('matches case-insensitively against the label', () => {
    expect(filterCommands(items, 'file').map((i) => i.id)).toEqual(['new', 'open']);
    expect(filterCommands(items, 'PREF').map((i) => i.id)).toEqual(['settings']);
  });

  it('matches against keywords as well as label', () => {
    expect(filterCommands(items, 'create').map((i) => i.id)).toEqual(['new']);
    expect(filterCommands(items, 'persist').map((i) => i.id)).toEqual(['save']);
  });

  it('keeps disabled items in the result (they are filtered only by query)', () => {
    expect(filterCommands(items, 'save').map((i) => i.id)).toEqual(['save']);
  });

  it('returns [] for a no-match query', () => {
    expect(filterCommands(items, 'zzz')).toEqual([]);
  });

  it('preserves source order', () => {
    // 'e' matches "New File", "Open File", "Save", "Preferences" — in source order.
    expect(filterCommands(items, 'e').map((i) => i.id)).toEqual(['new', 'open', 'save', 'settings']);
  });

  it('tolerates non-array input', () => {
    expect(filterCommands(undefined as unknown as CommandItem[], 'x')).toEqual([]);
  });

  it('commandMatches: empty lowered query matches everything', () => {
    expect(commandMatches(items[0], '')).toBe(true);
  });

  it('commandMatches: tolerates a missing keywords array', () => {
    expect(commandMatches({ id: 'x', label: 'Xyz' }, 'xy')).toBe(true);
    expect(commandMatches({ id: 'x', label: 'Xyz' }, 'qq')).toBe(false);
  });
});
