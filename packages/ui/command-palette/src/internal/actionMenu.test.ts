import { describe, it, expect } from 'vitest';
import {
  canOpenActions,
  actionsOf,
  firstEnabledActionIndex,
  rovingActionIndex,
  resolveEscape,
  matchesActionKey,
  caretAtEnd,
  openSurface,
  closeSurface,
  type ActionItem,
  type ActionMenuState,
  type ActionSurface,
} from './actionMenu';

const A = (id: string, disabled = false): ActionItem => ({ id, label: id.toUpperCase(), disabled });

describe('canOpenActions', () => {
  it('is true for an item with a non-empty, non-disabled actions array', () => {
    expect(canOpenActions({ actions: [A('a')] })).toBe(true);
  });

  it('is false for null/undefined', () => {
    expect(canOpenActions(null)).toBe(false);
    expect(canOpenActions(undefined)).toBe(false);
  });

  it('is false for a disabled item even with actions', () => {
    expect(canOpenActions({ disabled: true, actions: [A('a')] })).toBe(false);
  });

  it('is false when actions is missing or empty', () => {
    expect(canOpenActions({})).toBe(false);
    expect(canOpenActions({ actions: [] })).toBe(false);
  });
});

describe('actionsOf', () => {
  it('returns the actions array verbatim when present', () => {
    const actions = [A('a'), A('b')];
    expect(actionsOf({ actions })).toBe(actions);
  });

  it('normalizes absent/non-array actions to []', () => {
    expect(actionsOf({})).toEqual([]);
    expect(actionsOf(null)).toEqual([]);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    expect(actionsOf({ actions: 'nope' } as any)).toEqual([]);
  });
});

describe('firstEnabledActionIndex', () => {
  it('returns the index of the first non-disabled action', () => {
    expect(firstEnabledActionIndex([A('a'), A('b')])).toBe(0);
  });

  it('skips a leading disabled action', () => {
    expect(firstEnabledActionIndex([A('a', true), A('b')])).toBe(1);
  });

  it('returns -1 when none enabled', () => {
    expect(firstEnabledActionIndex([A('a', true), A('b', true)])).toBe(-1);
  });

  it('returns -1 for an empty/absent list', () => {
    expect(firstEnabledActionIndex([])).toBe(-1);
    expect(firstEnabledActionIndex(undefined)).toBe(-1);
  });
});

describe('rovingActionIndex', () => {
  const actions = [A('a'), A('b', true), A('c'), A('d', true)];

  it('moves forward to the next enabled action, skipping disabled', () => {
    // from 0 (a) forward -> skip disabled b -> lands on c (index 2)
    expect(rovingActionIndex(actions, 0, 1)).toBe(2);
  });

  it('moves backward to the previous enabled action, skipping disabled', () => {
    // from 2 (c) backward -> skip disabled b -> lands on a (index 0)
    expect(rovingActionIndex(actions, 2, -1)).toBe(0);
  });

  it('clamps at the end (does not wrap) when moving forward from the last enabled item', () => {
    // from 2 (c), forward -> only d (disabled) remains -> clamps, nothing enabled -> no-op
    expect(rovingActionIndex(actions, 2, 1)).toBe(2);
  });

  it('clamps at the start (does not wrap) when moving backward from the first enabled item', () => {
    expect(rovingActionIndex(actions, 0, -1)).toBe(0);
  });

  it('is a no-op (returns `from`) when nothing else is enabled', () => {
    const onlyOneEnabled = [A('x'), A('y', true), A('z', true)];
    expect(rovingActionIndex(onlyOneEnabled, 0, 1)).toBe(0);
  });

  it('is a no-op on an empty actions list', () => {
    expect(rovingActionIndex([], 0, 1)).toBe(0);
  });
});

describe('resolveEscape — the FULL precedence table (surface-open > level-pop > root-close)', () => {
  it('closes the sub-surface when a surface other than list is open, regardless of depth', () => {
    expect(resolveEscape('actions', 0)).toBe('close-surface');
    expect(resolveEscape('actions', 3)).toBe('close-surface');
  });

  it('pops a level when at the list surface with depth > 0', () => {
    expect(resolveEscape('list', 1)).toBe('pop-level');
    expect(resolveEscape('list', 4)).toBe('pop-level');
  });

  it('closes the palette when at the list surface at the root (depth 0)', () => {
    expect(resolveEscape('list', 0)).toBe('close-palette');
  });

  it('closes the sub-surface when the args surface is open (#12), regardless of depth — proves the surface-agnostic routing the args surface relies on', () => {
    expect(resolveEscape('args', 0)).toBe('close-surface');
    expect(resolveEscape('args', 3)).toBe('close-surface');
  });
});

describe('matchesActionKey', () => {
  it('matches the default $mod+k token via metaKey', () => {
    expect(matchesActionKey({ metaKey: true, key: 'k' })).toBe(true);
  });

  it('matches the default $mod+k token via ctrlKey', () => {
    expect(matchesActionKey({ ctrlKey: true, key: 'K' })).toBe(true);
  });

  it('does not match $mod+k without a modifier', () => {
    expect(matchesActionKey({ key: 'k' })).toBe(false);
  });

  it('does not match $mod+k on a different letter', () => {
    expect(matchesActionKey({ metaKey: true, key: 'j' })).toBe(false);
  });

  it('supports a bare single-letter token (no modifier required)', () => {
    expect(matchesActionKey({ key: 'k' }, 'k')).toBe(true);
    expect(matchesActionKey({ key: 'j' }, 'k')).toBe(false);
  });

  it('is false for a null/undefined event', () => {
    expect(matchesActionKey(null)).toBe(false);
    expect(matchesActionKey(undefined)).toBe(false);
  });
});

describe('caretAtEnd', () => {
  it('is true when selectionStart === selectionEnd === length', () => {
    expect(caretAtEnd(5, 5, 5)).toBe(true);
  });

  it('is false when the caret is mid-string', () => {
    expect(caretAtEnd(2, 2, 5)).toBe(false);
  });

  it('is false when there is a selection range (start !== end)', () => {
    expect(caretAtEnd(2, 5, 5)).toBe(false);
  });
});

describe('openSurface / closeSurface — the surface-agnostic transitions', () => {
  const listState: ActionMenuState = { activeSurface: 'list', actionIndex: -1, anchorIndex: -1 };

  it('openSurface lands on the FIRST ENABLED action, skipping a leading disabled one', () => {
    const actions = [A('a', true), A('b'), A('c')];
    const next = openSurface(listState, 'actions', 3, actions);
    expect(next).toEqual({ activeSurface: 'actions', actionIndex: 1, anchorIndex: 3 });
  });

  it('openSurface is surface-agnostic — echoes whichever surface value it is given verbatim (no menu-only branching), the property #12 relies on to add "args" with zero rework', () => {
    const actions = [A('a')];
    const surface: ActionSurface = 'actions';
    const next = openSurface(listState, surface, 0, actions);
    expect(next.activeSurface).toBe(surface);
  });

  it('closeSurface resets to the clean list state', () => {
    const opened = openSurface(listState, 'actions', 2, [A('a')]);
    expect(closeSurface(opened)).toEqual({ activeSurface: 'list', actionIndex: -1, anchorIndex: -1 });
  });

  it('the focus-restore invariant: closeSurface(openSurface(...)) round-trips to the clean list state', () => {
    const actions = [A('a'), A('b')];
    const opened = openSurface(listState, 'actions', 5, actions);
    const closed = closeSurface(opened);
    expect(closed).toEqual(listState);
  });
});
