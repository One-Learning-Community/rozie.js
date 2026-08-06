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
 *   1. **Root-identity-tracked setup** — instantiates the state machine and
 *      attaches a single root `keydown`/`pointerdown` delegation (no
 *      per-item listeners, SPEC §8). Uses the SAME latest-ref pattern as
 *      `useOutsideClick` (stash every callback/config in a ref, updated
 *      every render) so this effect never TEARS DOWN AND REBUILDS merely
 *      because `opts`'s callbacks/config change identity across renders.
 *
 *      77-07 — this effect has NO dependency array (it runs after every
 *      commit) and internally diffs `rootRef.current` against the last DOM
 *      node it actually attached to, doing real work ONLY when that identity
 *      changes. This matters because `rootRef` itself is a stable object for
 *      the component's whole lifetime — React never re-invokes a
 *      `[rootRef]`-keyed effect merely because `.current` was mutated — so a
 *      root behind conditional rendering (`r-if`), which is torn down and
 *      recreated as a NEW DOM node each time the surrounding condition
 *      flips, would otherwise only ever get ONE setup attempt for the
 *      component's entire lifetime: the very first commit, when a
 *      conditionally-hidden root is still `null`. The date-picker drill
 *      retrofit (77-07) is the first consumer to place an `r-keynav` root
 *      behind `r-if`, which is what surfaced this gap. A persistently-
 *      mounted root (the pre-77-07 common case) still pays setup cost
 *      exactly once — `root === lastRoot` is true from the second render
 *      onward, so the body returns immediately.
 *
 *      Phase 77 — `onPage` (grid boundary/paging, forwarded as `host.page`)
 *      and `gridColumns` (the `.grid(<expr>)` column-count getter) are both
 *      OPTIONAL and their PRESENCE is snapshotted at EACH (re)attachment,
 *      mirroring the pre-existing `windower` convention ("no v1 fixture
 *      swaps a windower's identity mid-lifecycle") — an author does not flip
 *      a component between grid/non-grid or paged/non-paged mid-lifecycle.
 *      `gridColumns` itself is NOT read directly into the machine's config —
 *      `buildConfigCode` (the per-target compiler emitter) never embeds a
 *      reactive expression inside the (fully-statically-known) `config`
 *      object, because `config` is captured once per (re)attachment by this
 *      same effect. Instead the machine's `config.grid.columns` getter
 *      permanently delegates through `optsRef.current.gridColumns!()` — the
 *      SAME latest-ref indirection every other callback here uses — so a
 *      dynamic `$data.cols` read stays live across re-renders without
 *      re-instantiating the machine (SPEC §10).
 *
 *   2. **Reactive to `active` OR root identity** — the imperative-only
 *      concerns that a declarative JSX binding genuinely cannot express: DOM
 *      `.focus()` for the tabindex model, the SPEC §9 active-class toggle,
 *      and scroll-into-view / windower `scrollToIndex` follow. Runs when
 *      EITHER the active index changes value OR the root DOM node identity
 *      changes (SPEC §9: "evaluated once ... toggles the token set on
 *      active-change" — not a live per-render `:class` merge; a root
 *      identity change is not "per unrelated render," it's the panel
 *      (re)appearing and therefore always warrants a fresh apply even when
 *      the numeric active value happens to be unchanged from the last time
 *      this effect ran against the PREVIOUS incarnation of the root — see
 *      the 77-07 module note below), reading every other option through the
 *      SAME latest-ref so an `activeClass`/`config` identity change alone
 *      never re-triggers it.
 *
 *      77-07 — like effect 1, this has NO dependency array and diffs
 *      `{ root, active }` against what it last actually applied, so a
 *      re-render where NEITHER changed remains a cheap no-op (preserving the
 *      "evaluated once per active-change" guarantee for the common,
 *      persistently-mounted case) while a conditionally-mounted root that
 *      RE-ENTERS with the SAME resolved active index (e.g. re-drilling into
 *      a months panel whose selected month hasn't changed) still gets its
 *      focus/scroll/class pass re-applied — without this, the SECOND (and
 *      every subsequent) entry into an `r-if`-gated panel would silently
 *      drop keyboard focus continuity, since React's plain active-value
 *      dependency has nothing to observe when the value repeats.
 *
 *      Phase 77 — an author may set the active index in the SAME tick a
 *      dataset swaps (grid paging), so the item element for the new index may
 *      not exist in the DOM yet when this effect runs. The effect applies its
 *      normal focus/scroll/class-toggle pass once synchronously; if no
 *      element is found for the current active index, it schedules exactly
 *      ONE `requestAnimationFrame`-deferred re-query (cancelled on cleanup,
 *      and guarded so it only re-applies if `active` is STILL the value it
 *      was scheduled for AND the root is STILL the one the pass was
 *      scheduled against — a stale pass must never steal focus from a newer
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
 * Plan 260806-lz7 — the tabindex model's first/redundant focus+scroll pass
 * (mount, or a conditionally-mounted root re-appearing) is gated by
 * `@rozie/runtime-keynav-core`'s `focusIsWithinScope` strict-containment
 * predicate: it only runs when DOM focus is already inside the owning
 * component (via the optional `getFocusScope` opt, or the compiler-emitted
 * root itself). A genuine navigation pass (the active INDEX changing) is
 * never gated. See `focusGuard.ts`'s module doc comment for the full rule.
 *
 * @public — runtime API consumed by emitted .tsx files with an `r-keynav` root.
 */
import { useEffect, useRef, type RefObject } from 'react';
import {
  createKeynavStateMachine,
  focusIsWithinScope,
  normalizeClassTokens,
  type ClassValue,
  type KeynavConfig,
  type KeynavHost,
  type KeynavPageDetail,
  type KeynavStateMachine,
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
  /**
   * Plan 260806-lz7 — the strict-containment focus scope. Lazily resolved
   * component-scope element refs (never captured at attach time, so a ref
   * that resolves late is still picked up on a later pass). Optional and
   * additive: an older leaf that omits this field takes the
   * `documentHasRealFocus` compatibility fallback rather than strict
   * containment — see `useKeynav.ts`'s module doc comment.
   */
  getFocusScope?: () => Element | readonly (Element | null)[] | null;
}

// Plan 260806-lz7 — builds the anchor list `focusIsWithinScope` checks
// containment against. When `getFocusScope` is ABSENT (an older leaf calling
// this runtime without having been regenerated), NO anchor list is built at
// all — `focusIsWithinScope` then takes its pinned `documentHasRealFocus`
// fallback, preserving the pre-fix document-scoped behavior for that leaf.
// When `getFocusScope` IS present, its resolved value is combined with the
// keynav root itself — appending the root is a no-op in the normal case
// (the root is inside the component) and is what keeps a
// `<slot portal />`-relocated keynav root working, since focus inside a
// portalled root is still "within the component" for this primitive.
function resolveFocusScope(
  opts: UseKeynavOpts,
  root: HTMLElement,
): Element | readonly (Element | null)[] | null | undefined {
  if (opts.getFocusScope === undefined) return undefined;
  const extra = opts.getFocusScope();
  const list = extra == null ? [] : Array.isArray(extra) ? [...extra] : [extra];
  list.push(root);
  return list;
}

export function useKeynav(
  rootRef: RefObject<HTMLElement | null>,
  opts: UseKeynavOpts,
): void {
  // Latest-ref stash — mirrors `useOutsideClick`'s stale-closure defense
  // (D-61) so both effects below always read the freshest `opts` without
  // needing to re-run on every identity change.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Read the CURRENT active value during render — a pure read through the
  // author's own getter. 77-07: no longer used as a dependency-array entry
  // (see the module doc comment on why a plain value dependency can't detect
  // a conditionally-mounted root re-appearing) — read here once per render
  // and diffed manually inside effect 2 below.
  const active = opts.getActive();

  // 77-07 — per-instance attachment state, persisted across renders in a
  // ref (not React state, since updating it must never itself trigger a
  // re-render). `attach.root` is the DOM node the state machine/listeners
  // are CURRENTLY built against; `apply.root`/`apply.active` are the
  // (root, active) pair the focus/scroll/class pass was LAST applied for.
  // Both effects below run unconditionally (no dependency array) and use
  // these to cheaply no-op when nothing relevant changed.
  const attachRef = useRef<{
    root: HTMLElement | null;
    machine: KeynavStateMachine | null;
    onKeyDown: ((e: KeyboardEvent) => void) | null;
    onPointerDown: ((e: PointerEvent) => void) | null;
    onFocusIn: ((e: FocusEvent) => void) | null;
  }>({ root: null, machine: null, onKeyDown: null, onPointerDown: null, onFocusIn: null });

  // ---- Effect 1 (root-identity-tracked): state machine + root keydown/pointer delegation ----
  useEffect(() => {
    const root = rootRef.current;
    const attach = attachRef.current;
    if (root === attach.root) return; // unchanged root — no work to do.

    // Tear down whatever was attached to the PREVIOUS root (a different
    // element, or none) before (re)attaching to the current one.
    if (attach.root && attach.onKeyDown && attach.onPointerDown && attach.onFocusIn) {
      attach.root.removeEventListener('keydown', attach.onKeyDown);
      attach.root.removeEventListener('pointerdown', attach.onPointerDown);
      attach.root.removeEventListener('focusin', attach.onFocusIn);
    }
    attach.machine?.dispose();
    attach.root = null;
    attach.machine = null;
    attach.onKeyDown = null;
    attach.onPointerDown = null;
    attach.onFocusIn = null;

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
    // Snapshot at (re)attachment — no v1 fixture swaps a windower's identity
    // mid-lifecycle (SPEC §10 wiring lands with a future virtualized-list
    // plan); revisit if that changes.
    if (optsRef.current.windower !== undefined) {
      host.windower = optsRef.current.windower;
    }
    // Phase 77 — `onPage` presence snapshotted at (re)attachment (same
    // convention as `windower` above); the forwarded function itself always
    // delegates through the latest ref, so a re-rendered handler identity
    // never requires re-attaching the root listeners.
    if (optsRef.current.onPage !== undefined) {
      host.page = (detail) => optsRef.current.onPage?.(detail);
    }

    // Phase 77 — grid config. `gridColumns` presence is ALSO snapshotted at
    // (re)attachment; when present, the machine's config gains a `grid`
    // entry whose `columns()` getter permanently delegates through the
    // latest ref (never captures a single render's closure directly — see
    // the module doc comment) so a dynamic/reactive column count stays live
    // across re-renders without re-instantiating the machine. Absent:
    // `config` is handed to the machine completely unmodified — no `grid`
    // key, byte-identical to pre-Phase-77 1D behavior.
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
    // DOM focus can land on an item WITHOUT a keydown or pointerdown ever
    // firing on the root — a programmatic `.focus()` call (assistive tech,
    // test automation) is the common case, but it's really any focus arrival
    // this delegation model can't otherwise observe. `focusin` bubbles (unlike
    // `focus`), so a single root listener catches it the same way keydown/
    // pointerdown already do. `moveTo` only sets `active`, never commits —
    // syncing the roving-tabindex model's notion of "current item" to
    // wherever DOM focus ACTUALLY is, so a subsequent arrow key moves
    // relative to the real focus target instead of a stale prior `active`
    // (T-77-08-05 — found via 77-08's real-DOM Docker VR run: date-picker's
    // 260802-hla spec `.focus()`s a day cell directly, then presses
    // ArrowRight, which used to move relative to whatever `active` happened
    // to be BEFORE that focus call).
    const onFocusIn = (e: FocusEvent): void => {
      const idx = resolveItemIndex(e.target);
      if (idx !== null) machine.moveTo(idx);
    };

    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('focusin', onFocusIn);

    attach.root = root;
    attach.machine = machine;
    attach.onKeyDown = onKeyDown;
    attach.onPointerDown = onPointerDown;
    attach.onFocusIn = onFocusIn;
    // No dependency array — see the module doc comment (77-07): this must run
    // after EVERY commit so a conditionally-mounted root is correctly
    // (re)initialized every time it reappears, while the internal
    // `root === attach.root` check keeps a persistently-mounted root's cost
    // at exactly one real setup, matching the pre-77-07 `[rootRef]` behavior.
  });

  // T-77-09-01 (found via this plan's whole-repo VR union — a KeynavGrid·
  // react mount-focus regression) — the pending deferred-focus retry's rAF
  // handle, hoisted OUT of effect 2's per-invocation closure into a ref that
  // OUTLIVES a single commit. See the note inside effect 2 below for why.
  const focusRafIdRef = useRef<number | null>(null);

  // Final unmount cleanup — a separate mount-once effect (stable `[]` deps)
  // so the teardown above (which now runs on every root CHANGE, not on
  // every unmount) doesn't need to double as the component-unmount path.
  useEffect(() => {
    return () => {
      const attach = attachRef.current;
      if (attach.root && attach.onKeyDown && attach.onPointerDown && attach.onFocusIn) {
        attach.root.removeEventListener('keydown', attach.onKeyDown);
        attach.root.removeEventListener('pointerdown', attach.onPointerDown);
        attach.root.removeEventListener('focusin', attach.onFocusIn);
      }
      attach.machine?.dispose();
      attach.root = null;
      attach.machine = null;
      if (focusRafIdRef.current !== null) {
        cancelAnimationFrame(focusRafIdRef.current);
        focusRafIdRef.current = null;
      }
    };
  }, []);

  // ---- Effect 2 (reactive to `active` OR root identity): focus / scroll / active-class ----
  const appliedRef = useRef<{
    root: HTMLElement | null;
    active: number | null;
    // Plan 260806-lz7 — the last active index a focus/scroll pass actually
    // resolved for THIS attachment (root identity). Distinguishes a
    // first/redundant pass (guarded by `focusIsWithinScope`) from a genuine
    // navigation pass (unconditional). Seeded null; reset to null whenever
    // the root identity changes (a fresh attachment).
    focusedActive: number | null;
  }>({
    root: null,
    active: null,
    focusedActive: null,
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !Number.isFinite(active)) return;

    const applied = appliedRef.current;
    // 77-07: re-apply when EITHER the active value changed OR the root
    // identity changed (a conditionally-mounted panel re-appearing) — see
    // the module doc comment for why a plain active-value diff alone misses
    // a re-entry that happens to resolve to the SAME index as last time.
    if (applied.root === root && applied.active === active) return;
    if (applied.root !== root) {
      // Plan 260806-lz7 — a fresh attachment (new DOM node, e.g. an r-if
      // root re-appearing) starts with no navigation history of its own.
      applied.focusedActive = null;
    }
    applied.root = root;
    applied.active = active;

    // Plan 260806-lz7 — computed ONCE per effect invocation (not per
    // `applyActiveEffects` call) so the deferred rAF retry below reuses the
    // SAME may-apply decision the synchronous pass made, rather than
    // re-evaluating against a `focusedActive` this same invocation already
    // advanced to `active` (which would make the retry look like a
    // "redundant" pass instead of the navigation/guarded pass it actually
    // is a continuation of).
    const isNavigationPass = applied.focusedActive !== null && applied.focusedActive !== active;
    const mayApply =
      isNavigationPass || focusIsWithinScope(resolveFocusScope(optsRef.current, root), root.ownerDocument);
    applied.focusedActive = active;

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
      // only the imperative `.focus()` call belongs here. Plan 260806-lz7:
      // gated behind `mayApply` — a first/redundant pass only focuses when
      // the composed active element is already inside the owning component;
      // a genuine navigation pass (`mayApply` true via `isNavigationPass`)
      // always focuses.
      if (mayApply && current.config.focusModel === 'tabindex' && activeEl) {
        activeEl.focus();
      }

      // SPEC §10 — windower present: drive its `scrollToIndex`. No windower:
      // fall back to `scrollIntoView` on the rendered node. Plan 260806-lz7:
      // same `mayApply` gate as the focus call above.
      if (mayApply) {
        if (current.windower) {
          current.windower.scrollToIndex(active, { align: 'nearest' });
        } else if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest' });
        }
      }

      return activeEl !== null;
    };

    const found = applyActiveEffects();

    // Phase 77 (T-77-03-03) — an author may set the active index in the SAME
    // tick a dataset swaps (grid paging), so the item element for the new
    // active index may not exist yet at effect time. Retry EXACTLY ONCE
    // after the browser has painted — no polling loop, no bespoke scheduler.
    // Guarded so it only re-applies if `active` is STILL the value it was
    // scheduled for AND the root is STILL the one the pass was scheduled
    // against; a stale pass must never steal focus from a newer navigation.
    //
    // T-77-09-01 — the pending rAF handle lives in `focusRafIdRef` (a ref
    // that OUTLIVES a single effect invocation), NOT a per-invocation local
    // returned as this effect's cleanup. This effect has no dependency
    // array, so with a per-invocation cleanup, ANY subsequent commit —
    // including one wholly unrelated to `active`/`root` — would run that
    // cleanup and cancel a still-pending, still-relevant retry before it
    // ever got to fire, permanently dropping mount focus. (KeynavGridDemo
    // exposed this: `$data.cells` starts `[]` and is populated by a
    // SEPARATE `$onMount` write on a LATER commit than the mount commit
    // that scheduled this retry — `active` doesn't change between the two
    // commits, but the intervening commit's cleanup was cancelling the
    // pending retry regardless.) Cancelling the PREVIOUS pending retry here,
    // before scheduling a new one, still supersedes a genuinely stale pass
    // the instant a NEWER navigation resolves synchronously; the guard
    // inside the callback below is the second, redundant line of defense
    // for the case a stale pass fires before this line ever runs again.
    if (focusRafIdRef.current !== null) {
      cancelAnimationFrame(focusRafIdRef.current);
      focusRafIdRef.current = null;
    }
    if (!found) {
      focusRafIdRef.current = requestAnimationFrame(() => {
        focusRafIdRef.current = null;
        if (optsRef.current.getActive() !== active) return;
        if (rootRef.current !== root) return;
        applyActiveEffects();
      });
    }
    // No dependency array — see the module doc comment (77-07): this must
    // run after every commit so a conditionally-mounted root's re-entry is
    // detected even when the resolved active index repeats; the internal
    // `{ root, active }` diff keeps a persistently-mounted, unrelated
    // re-render a cheap no-op (preserving the "evaluated once per
    // active-change" guarantee SPEC §9 requires).
  });
}
