import { describe, it, expect } from 'vitest';
import {
  isNavigating,
  pushFrame,
  popFrame,
  currentFrame,
  depth,
  settleFrame,
  failFrame,
  breadcrumb,
  levelTitle,
  levelPlaceholder,
  levelDefaultItems,
  type LevelFrame,
} from './levelStack';

describe('isNavigating', () => {
  it('is true for an item carrying a non-empty children array', () => {
    expect(isNavigating({ id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1' }] })).toBe(true);
  });

  it('is true for an item carrying a source function', () => {
    expect(isNavigating({ id: 'a', label: 'A', source: (_q: string) => [] })).toBe(true);
  });

  it('is false for a plain leaf item', () => {
    expect(isNavigating({ id: 'a', label: 'A' })).toBe(false);
  });

  it('is false for an item with an empty children array', () => {
    expect(isNavigating({ id: 'a', label: 'A', children: [] })).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(isNavigating(null)).toBe(false);
    expect(isNavigating(undefined)).toBe(false);
  });

  it('is false for a disabled item with neither children nor source', () => {
    expect(isNavigating({ id: 'a', label: 'A', disabled: true })).toBe(false);
  });
});

describe('levelTitle / levelPlaceholder', () => {
  it('levelTitle prefers item.title over item.label, falls back to null', () => {
    expect(levelTitle({ id: 'a', title: 'Custom Title', label: 'A' })).toBe('Custom Title');
    expect(levelTitle({ id: 'a', label: 'A' })).toBe('A');
    expect(levelTitle({ id: 'a' })).toBeNull();
  });

  it('levelPlaceholder prefers item.placeholder, falls back to the passed fallback', () => {
    expect(levelPlaceholder({ id: 'a', placeholder: 'Search A…' }, 'Type a command…')).toBe('Search A…');
    expect(levelPlaceholder({ id: 'a' }, 'Type a command…')).toBe('Type a command…');
    expect(levelPlaceholder({ id: 'a' }, null)).toBeNull();
  });
});

describe('levelDefaultItems / defaultItems frame field', () => {
  it('returns item.defaultItems when it is a non-empty array', () => {
    const defaultItems = [{ id: 'r1', label: 'Recent 1' }];
    expect(levelDefaultItems({ id: 'a', label: 'A', defaultItems })).toBe(defaultItems);
  });

  it('returns [] for an item without a defaultItems field', () => {
    expect(levelDefaultItems({ id: 'a', label: 'A' })).toEqual([]);
  });

  it('returns [] for null/undefined/non-array defaultItems', () => {
    expect(levelDefaultItems(null)).toEqual([]);
    expect(levelDefaultItems(undefined)).toEqual([]);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input for the guard
    expect(levelDefaultItems({ id: 'a', label: 'A', defaultItems: 'not-an-array' } as any)).toEqual([]);
  });

  it('pushFrame copies defaultItems onto the new frame', () => {
    const defaultItems = [{ id: 'r1', label: 'Recent 1' }, { id: 'r2', label: 'Recent 2' }];
    const item = { id: 'a', label: 'A', source: (_q: string) => [], defaultItems };
    const stack = pushFrame([], item, '');
    expect(stack[0].defaultItems).toEqual(defaultItems);
  });

  it('a SOURCE item carrying a non-empty defaultItems seeds status ready (no loading flash)', () => {
    const defaultItems = [{ id: 'r1', label: 'Recent 1' }];
    const item = { id: 'a', label: 'A', source: (_q: string) => [], defaultItems };
    const stack = pushFrame([], item, '');
    expect(stack[0].status).toBe('ready');
    expect(stack[0].resolvedItems).toEqual([]);
  });

  it('a source item with an EMPTY defaultItems still seeds status loading (regression guard)', () => {
    const item = { id: 'a', label: 'A', source: (_q: string) => [], defaultItems: [] };
    const stack = pushFrame([], item, '');
    expect(stack[0].status).toBe('loading');
  });

  it('a source item with no defaultItems field still seeds status loading (regression guard)', () => {
    const item = { id: 'a', label: 'A', source: (_q: string) => [] };
    const stack = pushFrame([], item, '');
    expect(stack[0].status).toBe('loading');
    expect(stack[0].defaultItems).toEqual([]);
  });
});

describe('pushFrame / query lifecycle', () => {
  it('appends a new frame carrying item/title/placeholder/parentQuery', () => {
    const item = { id: 'a', label: 'A', title: 'Level A', placeholder: 'Search A…', children: [{ id: 'a1', label: 'A1' }] };
    const stack = pushFrame([], item, 'root-query');
    expect(stack).toHaveLength(1);
    expect(stack[0].item).toBe(item);
    expect(stack[0].title).toBe('Level A');
    expect(stack[0].placeholder).toBe('Search A…');
    expect(stack[0].parentQuery).toBe('root-query');
  });

  it('snapshots the CURRENT query into parentQuery (restore-on-pop primitive)', () => {
    const item = { id: 'a', label: 'A', children: [] };
    const stack = pushFrame([], item, 'typed before push');
    expect(stack[0].parentQuery).toBe('typed before push');
  });

  it('a children item seeds resolvedItems=children and status ready', () => {
    const children = [{ id: 'a1', label: 'A1' }, { id: 'a2', label: 'A2' }];
    const item = { id: 'a', label: 'A', children };
    const stack = pushFrame([], item, '');
    expect(stack[0].resolvedItems).toEqual(children);
    expect(stack[0].status).toBe('ready');
  });

  it('a source item seeds resolvedItems=[] and status loading', () => {
    const item = { id: 'a', label: 'A', source: (_q: string) => [] };
    const stack = pushFrame([], item, '');
    expect(stack[0].resolvedItems).toEqual([]);
    expect(stack[0].status).toBe('loading');
  });

  it('returns a NEW array (immutable) and does not mutate the input stack', () => {
    const original: LevelFrame[] = [];
    const item = { id: 'a', label: 'A', children: [] };
    const stack = pushFrame(original, item, '');
    expect(stack).not.toBe(original);
    expect(original).toHaveLength(0);
    expect(stack).toHaveLength(1);
  });

  it('pushing a second level appends on top, preserving the first frame', () => {
    const item1 = { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', children: [{ id: 'a1a', label: 'A1A' }] }] };
    const stack1 = pushFrame([], item1, 'root-q');
    const item2 = stack1[0].resolvedItems[0] as { id: string; label: string; children: unknown[] };
    const stack2 = pushFrame(stack1, item2, 'level-a-q');
    expect(stack2).toHaveLength(2);
    expect(stack2[0]).toBe(stack1[0]);
    expect(stack2[1].parentQuery).toBe('level-a-q');
  });
});

describe('popFrame', () => {
  it('returns the stack without the top frame + the popped frame parentQuery as restoreQuery', () => {
    const item = { id: 'a', label: 'A', children: [] };
    const stack = pushFrame([], item, 'the-parent-query');
    const { stack: popped, restoreQuery } = popFrame(stack);
    expect(popped).toHaveLength(0);
    expect(restoreQuery).toBe('the-parent-query');
  });

  it('pops only the TOP frame, leaving lower frames intact', () => {
    const item1 = { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', children: [] }] };
    const stack1 = pushFrame([], item1, 'root-q');
    const item2 = stack1[0].resolvedItems[0] as { id: string; label: string; children: unknown[] };
    const stack2 = pushFrame(stack1, item2, 'level-a-q');
    const { stack: popped, restoreQuery } = popFrame(stack2);
    expect(popped).toHaveLength(1);
    expect(popped[0]).toBe(stack1[0]);
    expect(restoreQuery).toBe('level-a-q');
  });

  it('is a no-op on an empty stack, returning [] and restoreQuery=null', () => {
    const { stack, restoreQuery } = popFrame([]);
    expect(stack).toEqual([]);
    expect(restoreQuery).toBeNull();
  });
});

describe('currentFrame / depth', () => {
  it('currentFrame returns null and depth returns 0 for an empty stack', () => {
    expect(currentFrame([])).toBeNull();
    expect(depth([])).toBe(0);
  });

  it('currentFrame returns the top frame and depth returns the stack length', () => {
    const item = { id: 'a', label: 'A', children: [] };
    const stack = pushFrame([], item, '');
    expect(currentFrame(stack)).toBe(stack[0]);
    expect(depth(stack)).toBe(1);
  });
});

describe('settleFrame / failFrame', () => {
  it('settleFrame immutably replaces the TOP frame resolvedItems + status=ready', () => {
    const item = { id: 'a', label: 'A', source: (_q: string) => [] };
    const stack = pushFrame([], item, '');
    const items = [{ id: 'r1', label: 'R1' }];
    const settled = settleFrame(stack, items);
    expect(settled).not.toBe(stack);
    expect(settled[0]).not.toBe(stack[0]);
    expect(settled[0].resolvedItems).toEqual(items);
    expect(settled[0].status).toBe('ready');
    // original untouched
    expect(stack[0].status).toBe('loading');
  });

  it('failFrame immutably replaces the TOP frame status=error + error', () => {
    const item = { id: 'a', label: 'A', source: (_q: string) => [] };
    const stack = pushFrame([], item, '');
    const err = new Error('boom');
    const failed = failFrame(stack, err);
    expect(failed).not.toBe(stack);
    expect(failed[0].status).toBe('error');
    expect(failed[0].error).toBe(err);
    // original untouched
    expect(stack[0].status).toBe('loading');
  });

  it('settleFrame/failFrame are no-ops on an empty stack', () => {
    expect(settleFrame([], [])).toEqual([]);
    expect(failFrame([], new Error('x'))).toEqual([]);
  });

  it('settleFrame/failFrame only touch the TOP frame, lower frames stay untouched', () => {
    const item1 = { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', source: (_q: string) => [] }] };
    const stack1 = pushFrame([], item1, 'root-q');
    const item2 = stack1[0].resolvedItems[0] as { id: string; label: string; source: (q: string) => unknown[] };
    const stack2 = pushFrame(stack1, item2, 'level-a-q');
    const settled = settleFrame(stack2, [{ id: 'r1', label: 'R1' }]);
    expect(settled[0]).toBe(stack2[0]);
    expect(settled[1]).not.toBe(stack2[1]);
  });
});

describe('breadcrumb', () => {
  it('returns just the root entry for an empty stack', () => {
    expect(breadcrumb([], 'Commands')).toEqual([{ id: null, title: 'Commands' }]);
  });

  it('returns an ordered root..current list, each pushed frame contributing item.id + title', () => {
    const item1 = {
      id: 'goto',
      label: 'Go to page…',
      title: 'Go to page',
      children: [{ id: 'settings', label: 'Settings', title: 'Settings page', children: [] }],
    };
    const stack1 = pushFrame([], item1, '');
    const item2 = stack1[0].resolvedItems[0] as { id: string; label: string; title: string; children: unknown[] };
    const stack2 = pushFrame(stack1, item2, '');
    expect(breadcrumb(stack2, 'Commands')).toEqual([
      { id: null, title: 'Commands' },
      { id: 'goto', title: 'Go to page' },
      { id: 'settings', title: 'Settings page' },
    ]);
  });

  it('falls back to item.label when a pushed frame has no explicit title', () => {
    const item = { id: 'a', label: 'A', children: [] };
    const stack = pushFrame([], item, '');
    expect(breadcrumb(stack, 'Commands')).toEqual([
      { id: null, title: 'Commands' },
      { id: 'a', title: 'A' },
    ]);
  });
});
