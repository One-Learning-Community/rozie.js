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
 * `'list' | 'actions' | 'args'`, feature #12 (inline command arguments)
 * having added `'args'` with ZERO rework of these primitives. Keep it that
 * way: no helper here should read "menu" into its logic beyond the literal
 * string value passed in by the caller.
 */
import { parseKeyToken } from './parseKeyToken';

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
 * combobox owns arrows/Enter). `'actions'` is the action menu. `'args'`
 * (inline command arguments, this phase) is the panel-internal args form —
 * none of the transition helpers below branch on the literal surface value
 * beyond echoing it through, so `'args'` needed zero rework of them.
 */
export type ActionSurface = 'list' | 'actions' | 'args';

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
  shiftKey?: boolean;
  altKey?: boolean;
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
 * Portable `$mod+<letter>`-style token matcher — now a MULTI-modifier
 * matcher (quick 260716-npt Finding 2). Default `'$mod+k'` matches
 * `(metaKey || ctrlKey) && key.toLowerCase() === 'k'`; ANY combination of
 * `$mod`/`$shift`/`$alt`/`$ctrl` (e.g. `'$mod+$shift+p'`) generalizes the
 * same way — every modifier the token names must be held. A bare
 * single-letter token (e.g. `'k'`) matches the key alone, no modifier
 * required (unchanged). Parses through the SHARED `parseKeyToken` so this
 * always agrees with formatKeyToken's badge rendering — see
 * internal/parseKeyToken.ts. DOM-free — takes a plain
 * `{ metaKey, ctrlKey, shiftKey, altKey, key }`-shaped object so it is
 * unit-testable without a real KeyboardEvent.
 */
export function matchesActionKey(ev: KeyLike | null | undefined, token?: string): boolean {
  if (!ev) return false;
  const parsed = parseKeyToken(token || '$mod+k');
  if (!parsed || !parsed.key) return false;
  const key = String(ev.key || '').toLowerCase();
  if (key !== parsed.key.toLowerCase()) return false;
  const { modifiers } = parsed;
  if (modifiers.mod && !(ev.metaKey || ev.ctrlKey)) return false;
  if (modifiers.shift && !ev.shiftKey) return false;
  if (modifiers.alt && !ev.altKey) return false;
  if (modifiers.ctrl && !ev.ctrlKey) return false;
  return true;
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
