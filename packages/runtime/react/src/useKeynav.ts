/**
 * `useKeynav` — the React controller for the `r-keynav` primitive (SPEC.md,
 * Phase 71). REFERENCE implementation (Plan 71-04) — the pattern the other
 * five per-target controllers (Vue/Svelte/Solid/Angular/Lit, plans 71-05..
 * 71-09) replicate.
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine` (Plan 71-03) with React-idiomatic wiring, split
 * into two effects per SPEC §8 ("generic behavior -> per-target runtime
 * controller"):
 *
 *   1. **Mount-once** — instantiates the state machine and attaches a single
 *      root `keydown`/`pointerdown` delegation (no per-item listeners, SPEC
 *      §8). Uses the SAME latest-ref pattern as `useOutsideClick` (stash every
 *      callback/config in a ref, updated every render) so this effect NEVER
 *      re-attaches when `opts`'s callbacks/config change identity across
 *      renders — `rootRef` is the only real dependency, and it's stable for
 *      the component's lifetime.
 *
 *   2. **Reactive to `active`** — the imperative-only concerns that a
 *      declarative JSX binding genuinely cannot express: DOM `.focus()` for
 *      the tabindex model, the SPEC §9 active-class toggle, and
 *      scroll-into-view / windower `scrollToIndex` follow. Runs ONLY when the
 *      active index changes (SPEC §9: "evaluated once ... toggles the token
 *      set on active-change" — not a live per-render `:class` merge), reading
 *      every other option through the SAME latest-ref so an `activeClass`/
 *      `config` identity change alone never re-triggers it.
 *
 * **What this hook does NOT do**: it never writes `data-rozie-keynav-active`
 * or `tabindex` itself — those are DECLARATIVE JSX bindings the compiler
 * emitter stamps onto each item (comparing the loop index to the live active
 * value the author's own `r-keynav:<focus-model>="…"` binding owns), so they
 * update on the SAME render pass as the rest of the component with zero
 * imperative DOM writes (SPEC §8's "idiomatic wiring -> compiler emission"
 * half of the split). This hook owns only what JSX cannot: focus, scroll, and
 * the imperative `r-keynav-active-class` toggle.
 *
 * @public — runtime API consumed by emitted .tsx files with an `r-keynav` root.
 */
import { useEffect, useRef, type RefObject } from 'react';
import {
  createKeynavStateMachine,
  normalizeClassTokens,
  type ClassValue,
  type KeynavConfig,
  type KeynavHost,
  type KeynavWindower,
} from '@rozie/runtime-keynav-core';

export interface UseKeynavOpts {
  /** Resolved `r-keynav:<focus-model>[.<modifier>…]` configuration (SPEC §3). */
  config: KeynavConfig;
  /** The `:source` array — explicit, or synthesized from a co-located `r-for` (SPEC §5). */
  getSource: () => unknown[];
  /** The live active-index value — reads the author's `r-keynav:<focus-model>="…"` binding. */
  getActive: () => number;
  /** Writes the active index — the SAME binding's setter (two-way, mirrors `r-model`). */
  setActive: (i: number) => void;
  /** `@keynav-commit` — Enter / click-on-active (SPEC §6: active only, never selection). */
  onCommit: (i: number) => void;
  /**
   * `r-keynav-active-class="…"` (SPEC §9) — additive class tokens toggled on
   * the active item via `classList.add`/`.remove`, on top of the always-
   * present `data-rozie-keynav-active` marker. Any shape `normalizeClassTokens`
   * accepts (string / array / `{ token: cond }` object / nested).
   */
  activeClass?: ClassValue;
  /** Optional full-dataset addressing for virtualized lists (SPEC §10). */
  windower?: KeynavWindower;
}

export function useKeynav(
  rootRef: RefObject<HTMLElement | null>,
  opts: UseKeynavOpts,
): void {
  // Latest-ref stash — mirrors `useOutsideClick`'s stale-closure defense
  // (D-61) so BOTH effects below always read the freshest `opts` without
  // needing to re-run on every identity change.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Read the CURRENT active value during render — a pure read through the
  // author's own getter, used ONLY as the dependency for the second effect
  // below so imperative side effects (focus/scroll/class) fire exactly once
  // per active-change, never once per unrelated render.
  const active = opts.getActive();

  // ---- Effect 1 (mount-once): state machine + root keydown/pointer delegation ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // `exactOptionalPropertyTypes` — build `windower` via conditional
    // property assignment rather than an object-literal `windower:
    // possiblyUndefined` (mirrors 71-03's `itemMetaAt` fix for the same
    // class of error): `KeynavHost['windower']` is optional-but-absent, not
    // optional-but-explicit-`undefined`.
    const host: KeynavHost = {
      getSource: () => optsRef.current.getSource(),
      getActive: () => optsRef.current.getActive(),
      setActive: (i) => optsRef.current.setActive(i),
      commit: (i) => optsRef.current.onCommit(i),
    };
    // Snapshot at mount — no v1 fixture swaps a windower's identity
    // mid-lifecycle (SPEC §10 wiring lands with a future virtualized-list
    // plan); revisit if that changes.
    if (optsRef.current.windower !== undefined) {
      host.windower = optsRef.current.windower;
    }
    const machine = createKeynavStateMachine(host, optsRef.current.config);

    // T-71-04-01 (threat register) — `data-rozie-keynav-item` is an
    // UNTRUSTED DOM marker. Parse with `Number()` and bounds-check against
    // the current item count BEFORE it ever reaches the reducer; the reducer
    // also clamps as a second line of defense (71-03's `onPointerActivate`),
    // but a malformed/out-of-range index is REJECTED here first, never
    // silently coerced.
    const resolveItemIndex = (target: EventTarget | null): number | null => {
      if (!(target instanceof Element)) return null;
      const el = target.closest('[data-rozie-keynav-item]');
      if (!el) return null;
      const raw = el.getAttribute('data-rozie-keynav-item');
      if (raw === null) return null;
      const idx = Number(raw);
      if (!Number.isInteger(idx) || idx < 0) return null;
      const total = optsRef.current.windower
        ? optsRef.current.windower.count()
        : optsRef.current.getSource().length;
      if (idx >= total) return null;
      return idx;
    };

    const onKeyDown = (e: KeyboardEvent): void => machine.onKeydown(e);
    const onPointerDown = (e: PointerEvent): void => {
      const idx = resolveItemIndex(e.target);
      if (idx !== null) machine.onPointerActivate(idx);
    };

    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerdown', onPointerDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('pointerdown', onPointerDown);
      machine.dispose();
    };
    // `rootRef` is a ref object (stable identity) — eslint-plugin-react-hooks
    // exempts it from exhaustive-deps, same as `useOutsideClick`'s `[]`.
  }, [rootRef]);

  // ---- Effect 2 (reactive to `active`): focus / scroll / active-class ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !Number.isFinite(active)) return;
    const current = optsRef.current;
    const activeEl = root.querySelector<HTMLElement>(
      `[data-rozie-keynav-item="${active}"]`,
    );

    // SPEC §9 — additive active-class toggle. `data-rozie-keynav-active` is
    // ALWAYS present (emitter-owned, declarative, SPEC §9 first paragraph);
    // this is the OPTIONAL extra author-class toggle, necessarily imperative
    // because there is no reactive-render slot for "the currently active
    // list item" the way `:class` merges the rest of an element's classes.
    if (current.activeClass !== undefined) {
      const tokens = normalizeClassTokens(current.activeClass);
      if (tokens.length > 0) {
        for (const el of root.querySelectorAll<HTMLElement>('[data-rozie-keynav-item]')) {
          el.classList.remove(...tokens);
        }
        if (activeEl) activeEl.classList.add(...tokens);
      }
    }

    // Tabindex model (SPEC §3) — DOM focus follows the active item. The
    // `tabIndex` VALUE itself is a declarative JSX binding (emitter-owned);
    // only the imperative `.focus()` call belongs here.
    if (current.config.focusModel === 'tabindex' && activeEl) {
      activeEl.focus();
    }

    // SPEC §10 — windower present: drive its `scrollToIndex`. No windower:
    // fall back to `scrollIntoView` on the rendered node.
    if (current.windower) {
      current.windower.scrollToIndex(active, { align: 'nearest' });
    } else if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
    // Deliberately keyed on `active` ALONE (+ the stable `rootRef`) — see the
    // module doc comment: this is an active-CHANGE effect, not a live
    // per-render binding. Every other option is read via `optsRef.current`.
  }, [active, rootRef]);
}
