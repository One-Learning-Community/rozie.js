/**
 * `useKeynav` — the React controller for the `r-keynav` primitive (SPEC.md,
 * Phase 71 + Phase 77 grid/multi-group extension). REFERENCE implementation
 * (Plan 71-04, extended Plan 77-03) — the pattern the other five per-target
 * controllers (Vue/Svelte/Solid/Angular/Lit) replicate.
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine` (Plan 71-03, grid branch Plan 77-01) with
 * React-idiomatic wiring, split into two effects per SPEC §8 ("generic
 * behavior -> per-target runtime controller"):
 *
 *   1. **Mount-once** — instantiates the state machine and attaches a single
 *      root `keydown`/`pointerdown` delegation (no per-item listeners, SPEC
 *      §8). Uses the SAME latest-ref pattern as `useOutsideClick` (stash every
 *      callback/config in a ref, updated every render) so this effect NEVER
 *      re-attaches when `opts`'s callbacks/config change identity across
 *      renders — `rootRef` is the only real dependency, and it's stable for
 *      the component's lifetime.
 *
 *      Phase 77 — `onPage` (grid boundary/paging, forwarded as `host.page`)
 *      and `gridColumns` (the `.grid(<expr>)` column-count getter) are both
 *      OPTIONAL and their PRESENCE is snapshotted once at mount, mirroring
 *      the pre-existing `windower` convention ("no v1 fixture swaps a
 *      windower's identity mid-lifecycle") — an author does not flip a
 *      component between grid/non-grid or paged/non-paged mid-lifecycle.
 *      `gridColumns` itself is NOT read directly into the machine's config —
 *      `buildConfigCode` (the per-target compiler emitter) never embeds a
 *      reactive expression inside the (fully-statically-known) `config`
 *      object, because `config` is captured ONCE by this same mount effect.
 *      Instead the machine's `config.grid.columns` getter permanently
 *      delegates through `optsRef.current.gridColumns!()` — the SAME
 *      latest-ref indirection every other callback here uses — so a dynamic
 *      `$data.cols` read stays live across re-renders without re-
 *      instantiating the machine (SPEC §10).
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
 *      Phase 77 — an author may set the active index in the SAME tick a
 *      dataset swaps (grid paging), so the item element for the new index may
 *      not exist in the DOM yet when this effect runs. The effect applies its
 *      normal focus/scroll/class-toggle pass once synchronously; if no
 *      element is found for the current active index, it schedules exactly
 *      ONE `requestAnimationFrame`-deferred re-query (cancelled on cleanup,
 *      and guarded so it only re-applies if `active` is STILL the value it
 *      was scheduled for — a stale pass must never steal focus from a newer
 *      navigation, T-77-03-03). No polling loop, no bespoke scheduler.
 *
 * **What this hook does NOT do**: it never writes `data-rozie-keynav-active`
 * or `tabindex` itself — those are DECLARATIVE JSX bindings the compiler
 * emitter stamps onto each item (comparing the loop index to the live active
 * value the author's own `r-keynav:<focus-model>="…"` binding owns), so they
 * update on the SAME render pass as the rest of the component with zero
 * imperative DOM writes (SPEC §8's "idiomatic wiring -> compiler emission"
 * half of the split). This hook owns only what JSX cannot: focus, scroll, and
 * the imperative `r-keynav-active-class` toggle. It also never computes grid
 * stride/boundary arithmetic itself — that is entirely the reducer's job
 * (`@rozie/runtime-keynav-core`'s grid branch); this hook's only new Phase-77
 * responsibility is plumbing `onPage`/`gridColumns` through to the machine.
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
  type KeynavPageDetail,
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
  /**
   * `@keynav-page` (SPEC §3, §4.1, Phase 77) — forwarded as the state
   * machine's `host.page` hook. The grid branch of the reducer never moves
   * `active` on a boundary/page key; it reports the attempted move and the
   * author (who owns the dataset) advances the page and sets the landing
   * index. Read through the latest ref, same as `onCommit`.
   */
  onPage?: (detail: KeynavPageDetail) => void;
  /**
   * `.grid(<expr>)` (SPEC §3, §7.1, Phase 77) — the column-count getter that
   * selects the 2D grid branch of the reducer. Presence is snapshotted once
   * at mount (same convention as `windower`); the VALUE it returns is
   * re-read fresh on every keydown via a stable latest-ref-delegating
   * closure, so a dynamic/reactive column count (`$data.cols`) never goes
   * stale across re-renders without needing to re-instantiate the machine.
   * Absent means 1D mode — `config` is handed to the machine completely
   * unmodified (no `grid` key), which is what keeps every existing 1D
   * behavior and emitted call byte-identical.
   */
  gridColumns?: () => number;
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
    // Phase 77 — `onPage` presence snapshotted once at mount (same
    // convention as `windower` above); the forwarded function itself always
    // delegates through the latest ref, so a re-rendered handler identity
    // never requires re-attaching the root listeners.
    if (optsRef.current.onPage !== undefined) {
      host.page = (detail) => optsRef.current.onPage?.(detail);
    }

    // Phase 77 — grid config. `gridColumns` presence is ALSO snapshotted
    // once at mount; when present, the machine's config gains a `grid` entry
    // whose `columns()` getter permanently delegates through the latest ref
    // (never captures a single render's closure directly — see the module
    // doc comment) so a dynamic/reactive column count stays live across
    // re-renders without re-instantiating the machine. Absent: `config` is
    // handed to the machine completely unmodified — no `grid` key, byte-
    // identical to pre-Phase-77 1D behavior.
    const config: KeynavConfig =
      optsRef.current.gridColumns !== undefined
        ? {
            ...optsRef.current.config,
            grid: { columns: () => optsRef.current.gridColumns!() },
          }
        : optsRef.current.config;
    const machine = createKeynavStateMachine(host, config);

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

    // Extracted so it can run a SECOND time from the deferred rAF pass below
    // (Phase 77) without duplicating the focus/scroll/class-toggle logic.
    // Returns whether an element for `active` was found in the DOM.
    const applyActiveEffects = (): boolean => {
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

      return activeEl !== null;
    };

    const found = applyActiveEffects();

    // Phase 77 (T-77-03-03) — an author may set the active index in the SAME
    // tick a dataset swaps (grid paging), so the item element for the new
    // active index may not exist yet at effect time. Retry EXACTLY ONCE
    // after the browser has painted — no polling loop, no bespoke scheduler.
    // The retry is cancelled on cleanup and guarded so it only re-applies if
    // `active` is STILL the value it was scheduled for; a stale pass must
    // never steal focus from a newer navigation.
    let rafId: number | null = null;
    if (!found) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (optsRef.current.getActive() !== active) return;
        applyActiveEffects();
      });
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
    // Deliberately keyed on `active` ALONE (+ the stable `rootRef`) — see the
    // module doc comment: this is an active-CHANGE effect, not a live
    // per-render binding. Every other option is read via `optsRef.current`.
  }, [active, rootRef]);
}
