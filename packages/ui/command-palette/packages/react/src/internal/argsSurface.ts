/**
 * argsSurface — the pure reducer/validation core behind CommandPalette's
 * panel-internal inline command arguments (ARGS-MODEL / ARGS-SURFACE /
 * ARGS-SUBMIT feature #12).
 *
 * Kept OUT of the `.rozie` <script> (mirrors the scoreCommands.ts /
 * actionMenu.ts pattern — pure functions, DOM-free, named to avoid shadowing
 * a builtin or reading as a bare prop) so it can be unit-tested in isolation
 * and vendored verbatim into every leaf via codegen's `copyInternal` (lands
 * at `src/internal/argsSurface.ts` in each of the six leaves, excluding
 * `*.test.ts`).
 *
 * This module has NO "values" concept in `internal/actionMenu.ts` — the
 * `ActionSurface` union there widens to `'args'` (zero rework of its
 * transition helpers), but the args-SPECIFIC pure logic (entry-init with
 * `default`, required-gating after trim, submit-payload trimming,
 * backspace-empty) lives here as a sibling one-module-per-domain, matching
 * scoreCommands / levelStack / asyncSource / commandGroups / formatKeyToken.
 */

/** A single declared argument field on a command item (text-only v1). */
export interface ArgSpec {
  id: string;
  placeholder?: string;
  required?: boolean;
  default?: string;
}

/**
 * The minimal shape this module reads off a list item — intentionally loose
 * (mirrors actionMenu.ts's `ActionableItem`).
 */
export interface ArgueableItem {
  disabled?: boolean;
  args?: ArgSpec[];
  [key: string]: unknown;
}

/** The args-value bag keyed by declared arg id. */
export type ArgValues = Record<string, string>;

/**
 * Normalize an item's `args` field to an array — [] when absent or not an
 * array; skips entries with no `id`. Never throws on a malformed/legacy item
 * shape. Mirrors `actionsOf`.
 */
export function argsOf(item: ArgueableItem | null | undefined): ArgSpec[] {
  if (!item || !Array.isArray(item.args)) return [];
  const out: ArgSpec[] = [];
  for (const entry of item.args) {
    if (entry && typeof entry === 'object' && typeof (entry as ArgSpec).id === 'string') {
      out.push(entry as ArgSpec);
    }
  }
  return out;
}

/**
 * True iff `item` is non-null, NOT disabled, and carries a NON-EMPTY
 * normalized `args` array — the auto-entry gate. Mirrors `canOpenActions`.
 */
export function hasArgs(item: ArgueableItem | null | undefined): boolean {
  if (!item) return false;
  if (item.disabled) return false;
  return argsOf(item).length > 0;
}

/**
 * The entry seed for the args form — `{ [id]: String(default ?? '') }` for
 * each declared arg (prefill from `default`, else `''`). Returns a FRESH
 * object on every call; author order preserved.
 */
export function initArgValues(argList: ArgSpec[] | null | undefined): ArgValues {
  const list = Array.isArray(argList) ? argList : [];
  const values: ArgValues = {};
  for (const a of list) {
    values[a.id] = String(a.default ?? '');
  }
  return values;
}

/**
 * The index of the first `required` arg whose TRIMMED value is empty, or -1
 * when every required arg is satisfied (the submit gate + the "focus the
 * first unfilled" target). A non-required empty field never blocks.
 */
export function firstUnfilledRequiredIndex(
  argList: ArgSpec[] | null | undefined,
  values: ArgValues | null | undefined,
): number {
  const list = Array.isArray(argList) ? argList : [];
  const v = values || {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.required && String(v[a.id] ?? '').trim() === '') return i;
  }
  return -1;
}

/** True iff `firstUnfilledRequiredIndex === -1` (Enter fires only then). */
export function canSubmitArgs(
  argList: ArgSpec[] | null | undefined,
  values: ArgValues | null | undefined,
): boolean {
  return firstUnfilledRequiredIndex(argList, values) === -1;
}

/**
 * The additive `@select` `args` payload — `{ [id]: value.trim() }` over
 * EVERY declared arg (required and optional; optional-empty included as
 * `''`). Author-declared ids only (ignores stray value keys).
 */
export function buildArgsPayload(
  argList: ArgSpec[] | null | undefined,
  values: ArgValues | null | undefined,
): ArgValues {
  const list = Array.isArray(argList) ? argList : [];
  const v = values || {};
  const payload: ArgValues = {};
  for (const a of list) {
    payload[a.id] = String(v[a.id] ?? '').trim();
  }
  return payload;
}

/**
 * True iff the FIRST arg's RAW value is `''` (the Backspace-on-empty-
 * first-field pop predicate — raw, NOT trimmed, so a space-only field does
 * not pop). An arg-less list is treated as "empty" (nothing to hold text).
 */
export function isFirstFieldEmpty(
  argList: ArgSpec[] | null | undefined,
  values: ArgValues | null | undefined,
): boolean {
  const list = Array.isArray(argList) ? argList : [];
  if (list.length === 0) return true;
  const v = values || {};
  return String(v[list[0].id] ?? '') === '';
}
