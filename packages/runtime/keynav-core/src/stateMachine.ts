/**
 * `createKeynavStateMachine` — the pure keydown reducer that implements the
 * full `r-keynav` keyboard map (SPEC §4) while honoring the active-only
 * boundary (SPEC §6: the machine owns *active* — index/focus intent/commit
 * signal — and NEVER reads or writes selection state).
 *
 * Framework-free: every side effect is delegated to the `KeynavHost` adapter
 * a per-target controller implements. This file must never import a
 * framework or the DOM lib (verified by `grep` in the plan's acceptance
 * criteria — see 71-03-SUMMARY.md).
 *
 * @public — runtime API consumed by all six per-target keynav controllers.
 */
import type { KeynavConfig, KeynavHost, KeynavItemMeta, KeynavKeyboardEvent, KeynavOrientation } from './types.js';

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

  function onKeydown(e: KeynavKeyboardEvent): void {
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
    host.commit(idx);
  }

  function moveTo(i: number): void {
    const total = count();
    if (total === 0) return;
    host.setActive(clamp(i, total));
  }

  function dispose(): void {
    typeaheadBuffer = '';
    typeaheadTimestamp = 0;
  }

  return { onKeydown, onPointerActivate, moveTo, dispose };
}
