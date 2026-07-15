import { describe, it, expect } from 'vitest';
import { deriveCommandGroups } from './commandGroups';

describe('deriveCommandGroups', () => {
  it('non-array input returns empty groups + empty ordered', () => {
    expect(deriveCommandGroups(null as unknown as unknown[])).toEqual({ groups: [], ordered: [] });
    expect(deriveCommandGroups(undefined as unknown as unknown[])).toEqual({ groups: [], ordered: [] });
    expect(deriveCommandGroups('nope' as unknown as unknown[])).toEqual({ groups: [], ordered: [] });
  });

  it('no item carries a group: groups is empty AND ordered is the SAME array reference', () => {
    const input = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const result = deriveCommandGroups(input);
    expect(result.groups).toEqual([]);
    expect(result.ordered).toBe(input);
  });

  it('single group: one heading, ordered unchanged (no leading ungrouped block)', () => {
    const input = [
      { id: 'a', label: 'A', group: 'File' },
      { id: 'b', label: 'B', group: 'File' },
      { id: 'c', label: 'C', group: 'File' },
    ];
    const result = deriveCommandGroups(input);
    expect(result.groups).toEqual([{ id: 'File', label: 'File' }]);
    expect(result.ordered.map((it) => it.id)).toEqual(['a', 'b', 'c']);
  });

  it('multiple groups: groups in first-appearance order, ordered = ungrouped-leading then groups-in-first-appearance, stable-within', () => {
    const input = [
      { id: 'new', label: 'New File', group: 'File' },
      { id: 'open', label: 'Open File', group: 'File' },
      { id: 'save', label: 'Save', group: 'File' },
      { id: 'cut', label: 'Cut', group: 'Edit' },
      { id: 'copy', label: 'Copy', group: 'Edit' },
      { id: 'paste', label: 'Paste', group: 'Edit' },
      { id: 'goto', label: 'Go to page…' },
      { id: 'search-users', label: 'Search users…' },
    ];
    const result = deriveCommandGroups(input);
    expect(result.groups).toEqual([
      { id: 'File', label: 'File' },
      { id: 'Edit', label: 'Edit' },
    ]);
    expect(result.ordered.map((it) => it.id)).toEqual([
      'goto',
      'search-users',
      'new',
      'open',
      'save',
      'cut',
      'copy',
      'paste',
    ]);
  });

  it('empty-string group is treated as ungrouped', () => {
    const input = [
      { id: 'a', label: 'A', group: '' },
      { id: 'b', label: 'B', group: 'File' },
    ];
    const result = deriveCommandGroups(input);
    expect(result.groups).toEqual([{ id: 'File', label: 'File' }]);
    expect(result.ordered.map((it) => it.id)).toEqual(['a', 'b']);
  });
});
