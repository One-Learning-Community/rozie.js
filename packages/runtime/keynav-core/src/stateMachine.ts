/**
 * `createKeynavStateMachine` — the pure keydown reducer that implements the
 * full `r-keynav` keyboard map (SPEC §4) while honoring the active-only
 * boundary (SPEC §6: the machine owns *active* — index/focus intent/commit
 * signal — and NEVER reads or writes selection state).
 *
 * Also implements the 2D grid branch (Phase 77 SPEC §4/§4.1/§4.2/§4.3/§5):
 * row/column stride arrows, PageUp/PageDown, row-wise Home/End with
 * Ctrl+Home/End grid corners, boundary→`host.page` events (the machine NEVER
 * lands active on a boundary or page key — SPEC §4.1), and focusable-but-
 * inert disabled cells by default (`.skipdisabled` opts back into the 1D
 * skip-walk). `config.grid` is the SOLE switch between the two branches; the
 * 1D branch below is untouched and reachable exactly as before when it is
 * absent.
 *
 * Framework-free: every side effect is delegated to the `KeynavHost` adapter
 * a per-target controller implements. This file must never import a
 * framework or the DOM lib (verified by `grep` in the plan's acceptance
 * criteria — see 71-03-SUMMARY.md).
 *
 * @public — runtime API consumed by all six per-target keynav controllers.
 */
import type {
  KeynavConfig,
  KeynavHost,
  KeynavItemMeta,
  KeynavKeyboardEvent,
  KeynavOrientation,
  KeynavPageDetail,
} from './types.js';

const TYPEAHEAD_RESET_MS = 500;

export interface KeynavStateMachine {
  onKeydown(e: KeynavKeyboardEvent): void;
  onPointerActivate(i: number): void;
  moveTo(i: number): void;
  dispose(): void;
}

function directionForKey(key: string, orientation: KeynavOrientation): -1 | 1 | null {
  const vertical = orientation === 'vertical' || orientation === 'both';
  const horizontal = orientation === 'horizontal' || orientation === 'both';
  if (vertical) {
    if (key === 'ArrowDown') return 1;
    if (key === 'ArrowUp') return -1;
  }
  if (horizontal) {
    if (key === 'ArrowRight') return 1;
    if (key === 'ArrowLeft') return -1;
  }
  return null;
}

function isPrintable(e: KeynavKeyboardEvent): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}

/**
 * Coerces a `config.grid.columns()` read to a positive integer stride with a
 * floor of 1 (SPEC §10 dynamic columns; threat T-77-01-01) — a zero,
 * negative, `NaN`, or fractional column count can never produce a
 * non-integer active index or a division hazard.
 */
function coerceGridColumns(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

interface GridArrowMove {
  /** Signed step added to the active index: ±1 (row) or ±columns (column). */
  signedStride: number;
  direction: 1 | -1;
  axis: 'row' | 'column';
}

/**
 * Maps the four arrow keys to a signed stride in grid mode (SPEC §4).
 * Horizontal keys always stride by 1 through the flat list (row-end
 * continuity); vertical keys stride by the resolved column count.
 * Orientation config is intentionally ignored here — grid mode owns both
 * axes (SPEC §3.1); the compiler rejects `.grid()` + orientation upstream.
 */
function gridArrowMove(key: string, columns: number): GridArrowMove | null {
  switch (key) {
    case 'ArrowRight':
      return { signedStride: 1, direction: 1, axis: 'row' };
    case 'ArrowLeft':
      return { signedStride: -1, direction: -1, axis: 'row' };
    case 'ArrowDown':
      return { signedStride: columns, direction: 1, axis: 'column' };
    case 'ArrowUp':
      return { signedStride: -columns, direction: -1, axis: 'column' };
    default:
      return null;
  }
}

export function createKeynavStateMachine(host: KeynavHost, config: KeynavConfig): KeynavStateMachine {
  let typeaheadBuffer = '';
  let typeaheadTimestamp = 0;

  const count = (): number => {
    if (host.windower) return host.windower.count();
    return host.getSource().length;
  };

  /**
   * Item meta resolves from `host.windower.itemMeta(i)` when a windower is
   * present (SPEC §10 — full-dataset addressing), else from the `:source`
   * array element's `{ label, disabled }`. If a rendered source item omits
   * `label`, typeahead falls back to the item element's `textContent` —
   * that fallback is the per-target CONTROLLER's job (it must populate
   * `label` on the object it hands back via `getSource()`/windower before
   * calling into this pure reducer); this file never touches the DOM.
   */
  const itemMetaAt = (i: number): KeynavItemMeta => {
    if (host.windower) return host.windower.itemMeta(i);
    const item = host.getSource()[i];
    if (item !== null && typeof item === 'object') {
      const it = item as Record<string, unknown>;
      const meta: KeynavItemMeta = {};
      if (typeof it.label === 'string') meta.label = it.label;
      if (typeof it.disabled === 'boolean') meta.disabled = it.disabled;
      return meta;
    }
    return {};
  };

  const isDisabled = (i: number): boolean => !!itemMetaAt(i).disabled;

  const clamp = (i: number, total: number): number => Math.min(Math.max(i, 0), total - 1);

  function move(delta: -1 | 1): void {
    const total = count();
    if (total === 0) return;
    const active = host.getActive();

    if (!config.skipDisabled) {
      let next = active + delta;
      next = config.loop ? ((next % total) + total) % total : clamp(next, total);
      host.setActive(next);
      return;
    }

    // skipDisabled: walk in `delta` direction until an enabled item is
    // found; a full circle (loop) or a boundary hit (no loop) with nothing
    // enabled is a safe no-op (SPEC §4 behavior: "all-disabled source ->
    // no move, no crash").
    let next = active;
    for (let step = 0; step < total; step++) {
      next += delta;
      if (config.loop) {
        next = ((next % total) + total) % total;
        if (next === active) return; // full circle, nothing enabled
      } else if (next < 0 || next >= total) {
        return; // hit the boundary, nothing enabled beyond it
      }
      if (!isDisabled(next)) {
        host.setActive(next);
        return;
      }
    }
  }

  /**
   * Home/End always resolve to the first/last non-disabled item (SPEC §4:
   * "Home / End | move to first / last enabled"), independent of the
   * `skipDisabled` config flag — that flag governs arrow-move landing
   * behavior only, not Home/End's own semantics.
   */
  function firstEnabledIndex(): number {
    const total = count();
    for (let i = 0; i < total; i++) {
      if (!isDisabled(i)) return i;
    }
    return -1;
  }

  function lastEnabledIndex(): number {
    const total = count();
    for (let i = total - 1; i >= 0; i--) {
      if (!isDisabled(i)) return i;
    }
    return -1;
  }

  function handleTypeahead(char: string): void {
    const total = count();
    if (total === 0) return;
    const now = Date.now();
    if (now - typeaheadTimestamp > TYPEAHEAD_RESET_MS) {
      typeaheadBuffer = '';
    }
    typeaheadBuffer += char.toLowerCase();
    typeaheadTimestamp = now;

    const active = host.getActive();
    // Circular scan starting at the active item itself (offset 0) through a
    // full lap, so a buffer that matches only the currently-active item is
    // still found (and repeated same-letter presses naturally cycle once
    // the buffer resets on the next keypress after 500ms).
    for (let offset = 0; offset < total; offset++) {
      const idx = (active + offset) % total;
      const meta = itemMetaAt(idx);
      if (config.skipDisabled && meta.disabled) continue;
      const label = (meta.label ?? '').toLowerCase();
      if (label.startsWith(typeaheadBuffer)) {
        host.setActive(idx);
        return;
      }
    }
  }

  /**
   * The 2D grid branch of `onKeydown` (SPEC §4/§4.1/§4.2/§4.3/§5). Reads
   * `config.grid.columns()` fresh on every call so a dynamic/reactive
   * column count takes effect without re-instantiating the machine
   * (SPEC §10). Structured as a standalone function rather than
   * conditionals sprinkled through the 1D helpers above, so the 1D code
   * paths in `onKeydown` stay literally unchanged and reachable when
   * `config.grid` is absent.
   */
  function onKeydownGrid(e: KeynavKeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const active = host.getActive();
      // Grid mode is inert-by-default (SPEC §5): a disabled active cell
      // takes focus like any cell, but Enter never commits it.
      if (!isDisabled(active)) {
        host.commit(active);
      }
      return;
    }

    if (e.key === 'PageUp' || e.key === 'PageDown') {
      // The machine NEVER lands active on a page key (SPEC §4.1) — it only
      // reports the attempted page so the author (who owns the dataset)
      // can advance it and set the landing index.
      e.preventDefault();
      const direction: 1 | -1 = e.key === 'PageDown' ? 1 : -1;
      const detail: KeynavPageDetail = {
        direction,
        reason: e.key === 'PageDown' ? 'pagedown' : 'pageup',
        axis: 'column',
      };
      host.page?.(detail);
      return;
    }

    // `config.grid` is guaranteed present — `onKeydown` only forks into
    // this function when it is.
    const columns = coerceGridColumns(config.grid!.columns());

    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const total = count();
      if (total === 0) return;
      if (e.ctrlKey || e.metaKey) {
        // Ctrl(/Meta)+Home / +End resolve to the whole-grid corners
        // (SPEC §4).
        host.setActive(e.key === 'Home' ? 0 : total - 1);
        return;
      }
      // Home/End resolve within the ACTIVE ROW (SPEC §4), ignoring the 1D
      // enabled-only rule `firstEnabledIndex`/`lastEnabledIndex` apply —
      // grid mode is inert-by-default, so a disabled row bound is a legal
      // landing (SPEC §5). End clamps to `count - 1` so a ragged trailing
      // row resolves to its last EXISTING cell (SPEC §4.3), never past it.
      const active = host.getActive();
      const rowStart = Math.floor(active / columns) * columns;
      const landing = e.key === 'Home' ? rowStart : Math.min(rowStart + columns - 1, total - 1);
      host.setActive(landing);
      return;
    }

    const arrowMove = gridArrowMove(e.key, columns);
    if (arrowMove !== null) {
      // Always preventDefault an arrow key in grid mode, regardless of
      // whether it lands or pages (SPEC §4).
      e.preventDefault();
      const total = count();
      if (total === 0) return;
      const active = host.getActive();

      if (!config.skipDisabled) {
        // Inert default (SPEC §5): a move whose landing index falls
        // outside [0, count) does NOT move active — it pages instead
        // (SPEC §4.1). Otherwise it lands even on a disabled cell.
        const landing = active + arrowMove.signedStride;
        if (landing < 0 || landing >= total) {
          host.page?.({ direction: arrowMove.direction, reason: 'boundary', axis: arrowMove.axis });
          return;
        }
        host.setActive(landing);
        return;
      }

      // `.skipdisabled` opts back into a skip-walk along the movement axis
      // (SPEC §4.2). Grid mode never loops (`.grid()` + `.loop` is a
      // compile-time error), so this walk is strictly monotonic — bounded
      // by `total` steps, an all-disabled grid terminates at the boundary
      // rather than spinning (threat T-77-01-02), and the terminal
      // boundary fires the same `host.page` call as the non-skip path.
      let next = active;
      for (;;) {
        next += arrowMove.signedStride;
        if (next < 0 || next >= total) {
          host.page?.({ direction: arrowMove.direction, reason: 'boundary', axis: arrowMove.axis });
          return;
        }
        if (!isDisabled(next)) {
          host.setActive(next);
          return;
        }
      }
    }

    if (config.typeahead && isPrintable(e)) {
      handleTypeahead(e.key);
    }
  }

  function onKeydown(e: KeynavKeyboardEvent): void {
    if (config.grid) {
      onKeydownGrid(e);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      host.commit(host.getActive());
      return;
    }
    if (e.key === 'Home') {
      const idx = firstEnabledIndex();
      if (idx !== -1) {
        e.preventDefault();
        host.setActive(idx);
      }
      return;
    }
    if (e.key === 'End') {
      const idx = lastEnabledIndex();
      if (idx !== -1) {
        e.preventDefault();
        host.setActive(idx);
      }
      return;
    }
    const direction = directionForKey(e.key, config.orientation);
    if (direction !== null) {
      e.preventDefault();
      move(direction);
      return;
    }
    if (config.typeahead && isPrintable(e)) {
      handleTypeahead(e.key);
    }
  }

  function onPointerActivate(i: number): void {
    const total = count();
    if (total === 0) return;
    const idx = clamp(i, total);
    host.setActive(idx);
    // Grid mode: pointer activation on a disabled cell sets active
    // (consistent with keyboard landing) but does not commit (SPEC §5).
    // The 1D path keeps its unconditional commit.
    if (config.grid && isDisabled(idx)) return;
    host.commit(idx);
  }

  function moveTo(i: number): void {
    const total = count();
    if (total === 0) return;
    const idx = clamp(i, total);
    // No-op when already active (T-77-08-06 — found via 77-08's real-DOM
    // testing): `moveTo` is the target of a root-level `focusin` listener
    // (SPEC's focus-sync fix, T-77-08-05) — DOM focus landing on an item is
    // JUST AS LIKELY to be the PRIMITIVE'S OWN `.focus()` call (applying an
    // active-change) as it is an external focus arrival (programmatic
    // `.focus()`, assistive tech). Calling `host.setActive(idx)` again with
    // the SAME value it already holds is a redundant re-entrant write —
    // on a synchronous-commit target it can re-trigger the active-change
    // effect from WITHIN that effect's own `.focus()` call, and in at least
    // one observed case that reentrancy left NOTHING focused. Skipping the
    // write when the index doesn't actually change avoids the reentrancy
    // entirely without weakening the sync fix for a genuine external arrival
    // (which by definition targets a DIFFERENT index than the one currently
    // active).
    if (idx === host.getActive()) return;
    host.setActive(idx);
  }

  function dispose(): void {
    typeaheadBuffer = '';
    typeaheadTimestamp = 0;
  }

  return { onKeydown, onPointerActivate, moveTo, dispose };
}
