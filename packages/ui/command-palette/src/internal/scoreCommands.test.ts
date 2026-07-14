import { describe, it, expect } from 'vitest';
import { defaultScore, fuzzyMatch, labelHighlight, scoreCommands, type CommandItem } from './scoreCommands';

const items: CommandItem[] = [
  { id: 'new', label: 'New File', keywords: ['create', 'add'] },
  { id: 'open', label: 'Open File', group: 'File' },
  { id: 'save', label: 'Save', keywords: ['write', 'persist'], disabled: true },
  { id: 'settings', label: 'Preferences', group: 'App' },
];

describe('fuzzyMatch', () => {
  it('matches a case-insensitive subsequence and returns matched positions', () => {
    const result = fuzzyMatch('Open File', 'of');
    expect(result).not.toBeNull();
    expect(result?.positions).toEqual([0, 5]);
    expect(typeof result?.score).toBe('number');
  });

  it('scores a contiguous run higher than a scattered match at the same start', () => {
    const contiguous = fuzzyMatch('abXXX', 'ab');
    const scattered = fuzzyMatch('aXbXX', 'ab');
    expect(contiguous).not.toBeNull();
    expect(scattered).not.toBeNull();
    expect(contiguous!.score).toBeGreaterThan(scattered!.score);
  });

  it('scores a word-start match higher than a mid-word match', () => {
    const wordStart = fuzzyMatch('Open File', 'f'); // 'F' of "File" — after a space
    const midWord = fuzzyMatch('offer', 'f'); // 'f' inside "offer" — not a boundary
    expect(wordStart).not.toBeNull();
    expect(midWord).not.toBeNull();
    expect(wordStart!.score).toBeGreaterThan(midWord!.score);
  });

  it('scores an earlier match higher than a later match, all else equal', () => {
    const early = fuzzyMatch('abxxx', 'ab');
    const late = fuzzyMatch('xxxab', 'ab');
    expect(early).not.toBeNull();
    expect(late).not.toBeNull();
    expect(early!.score).toBeGreaterThan(late!.score);
  });

  it('returns null when query is not a subsequence of text', () => {
    expect(fuzzyMatch('abc', 'xyz')).toBeNull();
    expect(fuzzyMatch('abc', 'acb')).toBeNull();
  });

  it('returns null for an empty query (no match signal)', () => {
    expect(fuzzyMatch('Open File', '')).toBeNull();
  });
});

describe('defaultScore', () => {
  it('ranks a label hit above a keyword-only hit for the same query', () => {
    const labelHit: CommandItem = { id: 'a', label: 'File Search' };
    const keywordOnlyHit: CommandItem = { id: 'b', label: 'Zzz', keywords: ['file'] };
    const labelScore = defaultScore(labelHit, 'file');
    const keywordScore = defaultScore(keywordOnlyHit, 'file');
    expect(labelScore).not.toBeNull();
    expect(keywordScore).not.toBeNull();
    expect(labelScore!).toBeGreaterThan(keywordScore!);
  });

  it('returns null when neither the label nor any keyword matches', () => {
    expect(defaultScore({ id: 'x', label: 'Preferences' }, 'zzz')).toBeNull();
    expect(defaultScore({ id: 'x', label: 'Preferences', keywords: ['settings'] }, 'zzz')).toBeNull();
  });
});

describe('scoreCommands', () => {
  it('ranks better matches first', () => {
    const list: CommandItem[] = [
      { id: 'weak', label: 'Zzz File Thing' }, // 'file' scattered further from start
      { id: 'strong', label: 'File' }, // exact/early/contiguous 'file'
    ];
    const out = scoreCommands(list, 'file');
    expect(out.map((i) => i.id)).toEqual(['strong', 'weak']);
  });

  it('drops null-scored items', () => {
    const out = scoreCommands(items, 'zzz');
    expect(out).toEqual([]);
  });

  it('is stable — equal scores keep original relative order via explicit index tie-break', () => {
    const tied: CommandItem[] = [
      { id: 'first', label: 'Alpha' },
      { id: 'second', label: 'Alpha' },
    ];
    // Same label => identical defaultScore for both; original order must be preserved.
    const out = scoreCommands(tied, 'alpha');
    expect(out.map((i) => i.id)).toEqual(['first', 'second']);
  });

  it('treats an empty query as source order (shallow copy, not the same array ref)', () => {
    const out = scoreCommands(items, '');
    expect(out.map((i) => i.id)).toEqual(['new', 'open', 'save', 'settings']);
    expect(out).not.toBe(items);
  });

  it('treats a whitespace-only query as source order (shallow copy, not the same array ref)', () => {
    const out = scoreCommands(items, '   ');
    expect(out.map((i) => i.id)).toEqual(['new', 'open', 'save', 'settings']);
    expect(out).not.toBe(items);
  });

  it('keeps disabled items in the ranked result', () => {
    const out = scoreCommands(items, 'save');
    expect(out.map((i) => i.id)).toEqual(['save']);
  });

  it('honors a custom scorer that boosts a later item ahead of an earlier one', () => {
    const list: CommandItem[] = [
      { id: 'first', label: 'Alpha Item' },
      { id: 'second', label: 'Beta Item' },
    ];
    const boostSecond = (item: CommandItem, query: string) => {
      const base = defaultScore(item, query) ?? 0;
      return item.id === 'second' ? base + 10000 : base;
    };
    const out = scoreCommands(list, 'item', boostSecond);
    expect(out.map((i) => i.id)).toEqual(['second', 'first']);
  });

  it('tolerates non-array input', () => {
    expect(scoreCommands(undefined as unknown as CommandItem[], 'x')).toEqual([]);
  });
});

describe('labelHighlight', () => {
  it('collapses adjacent matched positions into one range', () => {
    expect(labelHighlight('New File', 'ne')).toEqual([[0, 2]]);
  });

  it('returns [] when the query does not subsequence-match the label', () => {
    expect(labelHighlight('New File', 'zzz')).toEqual([]);
  });

  it('returns [] for an empty or whitespace-only query', () => {
    expect(labelHighlight('New File', '')).toEqual([]);
    expect(labelHighlight('New File', '   ')).toEqual([]);
  });

  it('returns separate ranges for non-adjacent matched positions', () => {
    // "Open File" / query "of" — 'O' at 0, 'f' at 5 — not adjacent.
    expect(labelHighlight('Open File', 'of')).toEqual([
      [0, 1],
      [5, 6],
    ]);
  });
});
