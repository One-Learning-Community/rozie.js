import { describe, it, expect } from 'vitest';
import {
  resolveChildSource,
  isAsyncLevel,
  nextRequestToken,
  isLatestRequest,
  shouldDebounceCall,
  DEFAULT_SEARCH_DEBOUNCE,
} from './asyncSource';

describe('resolveChildSource', () => {
  it('classifies a non-empty children array as sync', () => {
    const children = [{ id: 'a1', label: 'A1' }];
    const r = resolveChildSource({ id: 'a', label: 'A', children }, '');
    expect(r).toEqual({ kind: 'sync', items: children });
  });

  it('classifies a source(query) returning an array as sync', () => {
    const items = [{ id: 'r1', label: 'R1' }];
    const r = resolveChildSource({ id: 'a', label: 'A', source: (_q: string) => items }, 'q');
    expect(r).toEqual({ kind: 'sync', items });
  });

  it('normalizes a non-array sync source return to []', () => {
    const r = resolveChildSource({ id: 'a', label: 'A', source: (_q: string) => null }, 'q');
    expect(r).toEqual({ kind: 'sync', items: [] });
  });

  it('classifies a source(query) returning a Promise as async', () => {
    const promise = Promise.resolve([{ id: 'r1', label: 'R1' }]);
    const r = resolveChildSource({ id: 'a', label: 'A', source: (_q: string) => promise }, 'q');
    expect(r.kind).toBe('async');
    expect((r as { kind: 'async'; promise: Promise<unknown> }).promise).toBe(promise);
  });

  it('classifies a source(query) returning a thenable (non-Promise) as async', () => {
    const thenable = { then: (resolve: (v: unknown[]) => void) => resolve([]) };
    const r = resolveChildSource({ id: 'a', label: 'A', source: (_q: string) => thenable }, 'q');
    expect(r.kind).toBe('async');
  });

  it('classifies a non-navigating item as none', () => {
    expect(resolveChildSource({ id: 'a', label: 'A' }, 'q')).toEqual({ kind: 'none' });
    expect(resolveChildSource(null, 'q')).toEqual({ kind: 'none' });
  });

  it('calls the consumer source fn exactly once', () => {
    let calls = 0;
    const item = {
      id: 'a',
      label: 'A',
      source: (_q: string) => {
        calls += 1;
        return [];
      },
    };
    resolveChildSource(item, 'q');
    expect(calls).toBe(1);
  });

  it('prefers children over source when an item somehow carries both', () => {
    const children = [{ id: 'c1', label: 'C1' }];
    let sourceCalled = false;
    const item = {
      id: 'a',
      label: 'A',
      children,
      source: (_q: string) => {
        sourceCalled = true;
        return [];
      },
    };
    const r = resolveChildSource(item, 'q');
    expect(r).toEqual({ kind: 'sync', items: children });
    expect(sourceCalled).toBe(false);
  });
});

describe('isAsyncLevel', () => {
  it('is true iff item.source is a function (regardless of children)', () => {
    expect(isAsyncLevel({ id: 'a', label: 'A', source: (_q: string) => [] })).toBe(true);
    expect(isAsyncLevel({ id: 'a', label: 'A', children: [{ id: 'c1', label: 'C1' }] })).toBe(false);
    expect(isAsyncLevel({ id: 'a', label: 'A' })).toBe(false);
    expect(isAsyncLevel(null)).toBe(false);
  });
});

describe('shouldDebounceCall', () => {
  it('is true for an async (source) level, false for a children level or leaf', () => {
    expect(shouldDebounceCall({ id: 'a', label: 'A', source: (_q: string) => [] })).toBe(true);
    expect(shouldDebounceCall({ id: 'a', label: 'A', children: [{ id: 'c1', label: 'C1' }] })).toBe(false);
    expect(shouldDebounceCall({ id: 'a', label: 'A' })).toBe(false);
  });
});

describe('DEFAULT_SEARCH_DEBOUNCE', () => {
  it('is ~150', () => {
    expect(DEFAULT_SEARCH_DEBOUNCE).toBe(150);
  });
});

describe('nextRequestToken / isLatestRequest — the race-drop primitive', () => {
  it('bumps a monotonic integer', () => {
    expect(nextRequestToken(0)).toBe(1);
    expect(nextRequestToken(1)).toBe(2);
    expect(nextRequestToken(41)).toBe(42);
  });

  it('isLatestRequest is an equality guard', () => {
    expect(isLatestRequest(3, 3)).toBe(true);
    expect(isLatestRequest(2, 3)).toBe(false);
  });

  it('proves the race-drop: two overlapping async resolutions, the FIRST-bumped resolves LAST — only the second applies', async () => {
    let current = 0;

    // Bump #1 (the first request) — token 1.
    current = nextRequestToken(current);
    const firstToken = current;

    // Bump #2 (a second, overlapping request fired before #1 settles) — token 2.
    current = nextRequestToken(current);
    const secondToken = current;

    // Resolve the FIRST-bumped request LAST (simulating an out-of-order network
    // response) — its token must be dropped as stale.
    const secondResolvesAt = () => isLatestRequest(secondToken, current);
    const firstResolvesAt = () => isLatestRequest(firstToken, current);

    // second resolves first (in wall-clock terms) — it IS the latest.
    expect(secondResolvesAt()).toBe(true);
    // first resolves last — by now it is stale, dropped.
    expect(firstResolvesAt()).toBe(false);
  });
});
