/**
 * actionMenu — the surface-agnostic keyboard-ownership reducer behind
 * CommandPalette's interactive sub-actions (ACT-SEAM / ACT-ARBITRATION /
 * ACT-TRIGGER).
 *
 * Kept OUT of the `.rozie` <script> (mirrors the scoreCommands.ts /
 * levelStack.ts pattern — pure functions, named to avoid shadowing a builtin
 * or reading as a bare prop, no `.rozie` sigils) so it can be unit-tested in
 * isolation and vendored verbatim into every leaf via codegen's `copyInternal`
 * (lands at `src/internal/actionMenu.ts` in each of the six leaves, excluding
 * `*.test.ts`).
 *
 * The load-bearing design constraint: every helper here models a GENERIC
 * keyboard-owning sub-surface, never a menu-only shape — `ActiveSurface` is
 * `'list' | 'actions'` today, and feature #12 (inline command arguments)
 * extends it to add `'args'` with ZERO rework of these primitives. Keep it
 * that way: no helper here should read "menu" into its logic beyond the
 * literal string value passed in by the caller.
 */

/** A single row-level action item (the consumer-supplied `item.actions[]` entries). */
export interface ActionItem {
  id: string;
  label: string;
  icon?: unknown;
  shortcut?: string;
  disabled?: boolean;
}

/**
 * The minimal shape this module reads off a list item — intentionally loose
 * (mirrors levelStack.ts's `NavigableItem`) since the richer `CommandItem`
 * shape lives in scoreCommands.ts.
 */
export interface ActionableItem {
  disabled?: boolean;
  actions?: ActionItem[];
  [key: string]: unknown;
}

/**
 * The keyboard-owning sub-surface. `'list'` is the default (the vendored
 * combobox owns arrows/Enter). `'actions'` is the action menu.
 * extends to 'args' (#12) — feature #12 (inline command arguments) widens
 * this union with zero rework of the transition helpers below; none of them
 * branch on the literal surface value beyond echoing it through.
 */
export type ActionSurface = 'list' | 'actions';

/** The reducer's full state — surface-agnostic (works for any sub-surface). */
export interface ActionMenuState {
  activeSurface: ActionSurface;
  actionIndex: number;
  anchorIndex: number;
}

/** The Escape/← routing decision — the single precedence oracle. */
export type EscapeRoute = 'close-surface' | 'pop-level' | 'close-palette';

/** A plain, DOM-free shape for a keyboard event — unit-testable without jsdom. */
export interface KeyLike {
  metaKey?: boolean;
  ctrlKey?: boolean;
  key?: string;
}

/**
 * Normalize an item's `actions` field to an array — [] when absent or not an
 * array. Never throws on a malformed/legacy item shape.
 */
export function actionsOf(item: ActionableItem | null | undefined): ActionItem[] {
  return item && Array.isArray(item.actions) ? item.actions : [];
}

/**
 * True iff `item` is non-null, NOT disabled, and carries a NON-EMPTY `actions`
 * array. Gates all three triggers (actionKey / caret-Right / the `#actions`
 * click affordance) — an action-less (or disabled) row is always a no-op.
 */
export function canOpenActions(item: ActionableItem | null | undefined): boolean {
  if (!item) return false;
  if (item.disabled) return false;
  return actionsOf(item).length > 0;
}

/**
 * The index of the first non-`disabled` action, or -1 when none are enabled
 * (or the list is empty/absent).
 */
export function firstEnabledActionIndex(actions: ActionItem[] | null | undefined): number {
  const list = Array.isArray(actions) ? actions : [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] && !list[i].disabled) return i;
  }
  return -1;
}

/**
 * The next selectable index in `dir` (+1/-1) skipping `disabled` entries,
 * CLAMPED to the ends (never wraps) — mirrors the combobox/list `nextEnabled`
 * roving convention exactly. Returns `from` unchanged (a no-op) when nothing
 * else in that direction is enabled.
 */
export function rovingActionIndex(
  actions: ActionItem[] | null | undefined,
  from: number,
  dir: 1 | -1,
): number {
  const list = Array.isArray(actions) ? actions : [];
  let i = from;
  for (let step = 0; step < list.length; step++) {
    i = i + dir;
    if (i < 0) i = 0;
    if (i >= list.length) i = list.length - 1;
    if (list[i] && !list[i].disabled) return i;
    if ((dir < 0 && i === 0) || (dir > 0 && i === list.length - 1)) break;
  }
  return from;
}

/**
 * The SINGLE Escape/← routing oracle, encoding the full precedence table:
 * a sub-surface being open (`activeSurface !== 'list'`) ALWAYS wins over
 * popping a level, which ALWAYS wins over closing the palette at the root.
 * The param is `string`, not `ActionSurface`: the caller passes a reactive
 * state holder whose per-target lowering infers plain `string` (Vue `ref`,
 * Angular local capture) — and any non-'list' surface routes identically,
 * which is the surface-agnostic contract anyway ('args' works unchanged).
 */
export function resolveEscape(activeSurface: string, depth: number): EscapeRoute {
  if (activeSurface !== 'list') return 'close-surface';
  if (depth > 0) return 'pop-level';
  return 'close-palette';
}

/**
 * Portable `$mod+<letter>`-style token matcher. Default `'$mod+k'` matches
 * `(metaKey || ctrlKey) && key.toLowerCase() === 'k'`; any `'$mod+<letter>'`
 * token generalizes the same way. A bare single-letter token (e.g. `'k'`)
 * matches the key alone, no modifier required. DOM-free — takes a plain
 * `{ metaKey, ctrlKey, key }`-shaped object so it is unit-testable without a
 * real KeyboardEvent.
 */
export function matchesActionKey(ev: KeyLike | null | undefined, token?: string): boolean {
  if (!ev) return false;
  const t = token || '$mod+k';
  const key = String(ev.key || '').toLowerCase();
  if (t.indexOf('$mod+') === 0) {
    const letter = t.slice('$mod+'.length).toLowerCase();
    return !!(ev.metaKey || ev.ctrlKey) && key === letter;
  }
  // Bare single-letter token — no modifier required.
  if (t.length === 1) {
    return key === t.toLowerCase();
  }
  return false;
}

/**
 * True iff the input caret is collapsed at the very end of the value — the
 * Right-arrow trigger gate, so → only opens the menu when it can't possibly
 * mean "move the caret right within the text".
 */
export function caretAtEnd(
  selStart: number | null | undefined,
  selEnd: number | null | undefined,
  len: number,
): boolean {
  return selStart === selEnd && selEnd === len;
}

/**
 * Open a sub-surface over the list — the ONE transition primitive #12 reuses
 * verbatim for `'args'`. Lands `actionIndex` on the anchored item's FIRST
 * ENABLED action (skipping a leading disabled one); the caller resolves and
 * passes `actions` (via `actionsOf`) rather than this helper re-deriving it,
 * keeping the function surface-agnostic (a future `'args'` surface has no
 * "actions" concept at all).
 */
export function openSurface(
  _state: ActionMenuState,
  surface: ActionSurface,
  anchorIndex: number,
  actions: ActionItem[],
): ActionMenuState {
  return {
    activeSurface: surface,
    actionIndex: firstEnabledActionIndex(actions),
    anchorIndex,
  };
}

/**
 * Close whatever sub-surface is open, returning to the clean list state — the
 * focus-restore invariant: `activeSurface: 'list'`, `actionIndex: -1`,
 * `anchorIndex: -1`. `closeSurface(openSurface(...))` always round-trips to
 * this exact shape.
 */
export function closeSurface(_state: ActionMenuState): ActionMenuState {
  return { activeSurface: 'list', actionIndex: -1, anchorIndex: -1 };
}
