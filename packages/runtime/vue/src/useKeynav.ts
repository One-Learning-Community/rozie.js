/**
 * `useKeynav` — the Vue composable for the `r-keynav` primitive (SPEC.md,
 * Phase 71 + Phase 77 grid/multi-group extension). Modeled on the React
 * REFERENCE implementation (Plan 71-04, extended Plan 77-03,
 * `packages/runtime/react/src/useKeynav.ts`) — same split, same
 * `@rozie/runtime-keynav-core` wiring, Vue-idiomatic shell.
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine` (Plan 71-03, grid branch Plan 77-01) with a
 * `onMounted` root `keydown`/`pointerdown` delegation (no per-item
 * listeners, SPEC §8) plus a `watch(...)` keyed on the live active index for
 * the imperative-only concerns a declarative template binding genuinely
 * cannot express: DOM `.focus()` for the tabindex model, the SPEC §9
 * active-class toggle, and scroll-into-view / windower `scrollToIndex`
 * follow.
 *
 * VUE-SPECIFIC SIMPLIFICATION vs React: Vue's `setup()` runs EXACTLY ONCE
 * per component instance (the "setup-runs-once" reactivity model, see
 * PROJECT.md) — there is no per-render re-invocation the way React's
 * function-component body re-runs on every render. `opts` is therefore
 * captured ONCE, directly, with no `optsRef`/latest-ref indirection: every
 * closure below (`host.getSource`, `host.getActive`, …) already reads
 * through the SAME long-lived `opts` object for the composable's whole
 * lifetime — React's `useKeynav` needs a latest-ref stash specifically to
 * defend against re-render-driven stale closures, a class of bug that does
 * not exist here.
 *
 * Phase 77 — `onPage` (grid boundary/paging, forwarded as `host.page`) and
 * `gridColumns` (the `.grid(<expr>)` column-count getter) are both OPTIONAL,
 * mirroring the pre-existing `windower` convention. Because `opts` is
 * captured once (no per-render identity churn to defend against), there is
 * no separate "presence snapshot" step the way React needs one — `opts`
 * itself IS the stable, whole-lifetime snapshot. `gridColumns` is NOT read
 * directly into `config` — the machine's `config.grid.columns` getter
 * delegates through `opts.gridColumns!()` on every call (the SAME reason the
 * React reference gives: a reactive `$data.cols` read must stay live without
 * re-instantiating the machine — here it's simply because `opts.gridColumns`
 * is itself the emitted `() => cols.value` closure, already reactive).
 *
 * 77-07 — BOTH the mount-time setup (state machine + listeners) and the
 * reactive-to-`active` `watch(...)` are driven by an OUTER
 * `watch(() => rootRef.value, ..., { immediate: true })` rather than a
 * one-shot `onMounted` callback. `rootRef` is a genuine Vue `Ref` — its
 * `.value` IS reactively tracked, so watching it directly (instead of
 * reading it once inside `onMounted`) means the ENTIRE inner setup
 * (re-)runs every time the DOM node behind `rootRef` changes identity, not
 * just once for the component's whole lifetime. This matters because the
 * date-picker drill retrofit (77-07) is the first `r-keynav` consumer to
 * place a root behind conditional rendering (`v-if`/`r-if`): the root
 * element is torn down and recreated each time the panel toggles, so a
 * ONE-SHOT `onMounted` that reads `rootRef.value` a single time would only
 * ever see a non-null root if the panel happened to be visible on the
 * component's very first mount — for an initially-hidden panel it would
 * permanently no-op, never attaching listeners OR ever applying the
 * mount-time focus/active-class pass, on ANY subsequent (re)appearance. The
 * outer watch's teardown-then-rebuild on each `rootRef.value` change (via
 * the returned cleanup from the `watch` callback, mirroring `watchEffect`'s
 * own automatic-previous-cleanup semantics) fixes this while keeping a
 * persistently-mounted root's setup cost at exactly one real (re)attachment
 * — Vue's watch fires again on a genuine `.value` identity CHANGE only,
 * never for a same-value re-render.
 *
 * The FIRST (immediate) fire of the outer watch sees whatever `rootRef.value`
 * is at watcher-creation time — `null` for an initially-hidden `r-if`'d
 * panel, in which case the inner setup is simply skipped until the panel
 * first appears and the watch fires again with the real element.
 *
 * Phase 77 — an author may set the active index in the SAME tick a dataset
 * swaps (grid paging), so the item element for the new active index may not
 * exist in the DOM yet when the watch callback runs. The callback applies
 * its normal focus/scroll/class-toggle pass once synchronously; if no
 * element is found for the current active index, it schedules exactly ONE
 * `requestAnimationFrame`-deferred re-query. A new active-change cancels any
 * still-pending deferred pass from the PREVIOUS change before running its
 * own (mirrors the React reference's effect-cleanup-cancels-prior-rAF
 * behavior); the deferred callback is additionally guarded so it only
 * re-applies if `active` is STILL the value it was scheduled for — a stale
 * pass must never steal focus from a newer navigation (T-77-03-03). No
 * polling loop, no bespoke scheduler.
 *
 * **What this composable does NOT do**: it never writes
 * `data-rozie-keynav-active` or `tabindex` itself — those are DECLARATIVE
 * template bindings the compiler emitter stamps onto each item (comparing
 * the loop index to the live active value the author's own
 * `r-keynav:<focus-model>="…"` binding owns), so they update on the SAME
 * render pass as the rest of the component with zero imperative DOM writes
 * (SPEC §8's "idiomatic wiring -> compiler emission" half of the split).
 * This composable owns only what the template cannot: focus, scroll, and
 * the imperative `r-keynav-active-class` toggle. It also never computes grid
 * stride/boundary arithmetic itself — that is entirely the reducer's job
 * (`@rozie/runtime-keynav-core`'s grid branch); this composable's only new
 * Phase-77 responsibility is plumbing `onPage`/`gridColumns` through to the
 * machine.
 *
 * Plan 260806-lz7 — the tabindex model's first/redundant focus+scroll pass
 * (mount, or a conditionally-mounted root re-appearing) is gated by
 * `@rozie/runtime-keynav-core`'s `focusIsWithinScope` strict-containment
 * predicate: it only runs when DOM focus is already inside the owning
 * component (via the optional `getFocusScope` opt, or the compiler-emitted
 * root itself). A genuine navigation pass (the active INDEX changing) is
 * never gated. See `focusGuard.ts`'s module doc comment for the full rule.
 *
 * @public — runtime API consumed by emitted Vue SFCs with an `r-keynav` root.
 */
import { onMounted, watch, type Ref } from 'vue';
import {
  createKeynavStateMachine,
  focusIsWithinScope,
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
   * accepts (string / array / `{ token: cond }` object / nested) — the SAME
   * normalizer Vue's own `rozieClass` uses for the native `:class` render
   * path, factored out per SPEC §9 so the two paths cannot drift.
   */
  activeClass?: ClassValue;
  /** Optional full-dataset addressing for virtualized lists (SPEC §10). */
  windower?: KeynavWindower;
  /**
   * `@keynav-page` (SPEC §3, §4.1, Phase 77) — forwarded as the state
   * machine's `host.page` hook. The grid branch of the reducer never moves
   * `active` on a boundary/page key; it reports the attempted move and the
   * author (who owns the dataset) advances the page and sets the landing
   * index.
   */
  onPage?: (detail: KeynavPageDetail) => void;
  /**
   * `.grid(<expr>)` (SPEC §3, §7.1, Phase 77) — the column-count getter that
   * selects the 2D grid branch of the reducer. Absent means 1D mode —
   * `config` is handed to the machine completely unmodified (no `grid` key),
   * which is what keeps every existing 1D behavior and emitted call
   * byte-identical.
   */
  gridColumns?: () => number;
  /**
   * Plan 260806-lz7 — the strict-containment focus scope. Lazily resolved
   * component-scope element refs (read fresh every pass, never captured
   * once). Optional and additive: an older leaf that omits this field takes
   * the `documentHasRealFocus` compatibility fallback rather than strict
   * containment — see `useKeynav.ts`'s module doc comment.
   */
  getFocusScope?: () => Element | readonly (Element | null)[] | null;
}

// Plan 260806-lz7 — builds the anchor list `focusIsWithinScope` checks
// containment against. When `getFocusScope` is ABSENT (an older leaf calling
// this composable without having been regenerated), NO anchor list is built
// at all — `focusIsWithinScope` then takes its pinned `documentHasRealFocus`
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
  rootRef: Ref<HTMLElement | null>,
  opts: UseKeynavOpts,
): void {
  onMounted(() => {
    // 77-07 — outer watch on `rootRef.value` itself (a genuine reactive
    // `Ref`, unlike a one-shot `onMounted` read): re-runs the ENTIRE setup
    // whenever the DOM node identity changes, including null -> element
    // (first appearance) and element -> element (a conditionally-rendered
    // root torn down and recreated). The watch callback's OWN return value
    // is Vue's `onCleanup`-equivalent for a getter-form watch — returning a
    // teardown function here has it invoked automatically right before the
    // NEXT fire (a new root) or on scope disposal (component unmount), so
    // this single watch owns the full attach/detach symmetry that used to
    // be split across the one-shot `onMounted` body + a separate
    // `onBeforeUnmount`. See the module doc comment for why this fixes a
    // conditionally-mounted (`r-if`) root.
    watch(
      () => rootRef.value,
      (root, _oldRoot, onCleanup) => {
        if (!root) return;

        // `exactOptionalPropertyTypes` — build `windower` via conditional
        // property assignment rather than an object-literal `windower:
        // possiblyUndefined` (mirrors 71-03's `itemMetaAt` / the React
        // reference's identical fix): `KeynavHost['windower']` is optional-
        // but-absent, not optional-but-explicit-`undefined`.
        const host: KeynavHost = {
          getSource: () => opts.getSource(),
          getActive: () => opts.getActive(),
          setActive: (i) => opts.setActive(i),
          commit: (i) => opts.onCommit(i),
        };
        if (opts.windower !== undefined) {
          host.windower = opts.windower;
        }
        // Phase 77 — `onPage` forwards to `host.page` when the author wired
        // `@keynav-page`; absent entirely otherwise (no grid/page usage
        // stays byte-identical to pre-Phase-77).
        if (opts.onPage !== undefined) {
          host.page = (detail) => opts.onPage?.(detail);
        }

        // Phase 77 — grid config. When `gridColumns` is supplied, the
        // machine's config gains a `grid` entry whose `columns()` getter
        // delegates through `opts.gridColumns` on every call — see the
        // module doc comment for why no extra latest-ref indirection is
        // needed here (Vue's setup-runs-once model means `opts` itself
        // never goes stale). Absent: `config` is handed to the machine
        // completely unmodified — no `grid` key, byte-identical to
        // pre-Phase-77 1D behavior.
        const config: KeynavConfig =
          opts.gridColumns !== undefined
            ? { ...opts.config, grid: { columns: () => opts.gridColumns!() } }
            : opts.config;
        const machine = createKeynavStateMachine(host, config);

        // T-71-05-01 (threat register) — `data-rozie-keynav-item` is an
        // UNTRUSTED DOM marker. Parse with `Number()` and bounds-check
        // against the current item count BEFORE it ever reaches the
        // reducer; the reducer also clamps as a second line of defense
        // (71-03's `onPointerActivate`), but a malformed/out-of-range index
        // is REJECTED here first, never silently coerced.
        const resolveItemIndex = (target: EventTarget | null): number | null => {
          if (!(target instanceof Element)) return null;
          const el = target.closest('[data-rozie-keynav-item]');
          if (!el) return null;
          const raw = el.getAttribute('data-rozie-keynav-item');
          if (raw === null) return null;
          const idx = Number(raw);
          if (!Number.isInteger(idx) || idx < 0) return null;
          const total = opts.windower ? opts.windower.count() : opts.getSource().length;
          if (idx >= total) return null;
          return idx;
        };

        const onKeyDown = (e: KeyboardEvent): void => machine.onKeydown(e);
        const onPointerDown = (e: PointerEvent): void => {
          const idx = resolveItemIndex(e.target);
          if (idx !== null) machine.onPointerActivate(idx);
        };
        // DOM focus can land on an item WITHOUT a keydown or pointerdown ever
        // firing on the root — a programmatic `.focus()` call (assistive
        // tech, test automation) is the common case, but it's really any
        // focus arrival this delegation model can't otherwise observe.
        // `focusin` bubbles (unlike `focus`), so a single root listener
        // catches it the same way keydown/pointerdown already do. `moveTo`
        // only sets `active`, never commits — syncing the roving-tabindex
        // model's notion of "current item" to wherever DOM focus ACTUALLY
        // is, so a subsequent arrow key moves relative to the real focus
        // target instead of a stale prior `active` (T-77-08-05 — found via
        // 77-08's real-DOM Docker VR run: date-picker's 260802-hla spec
        // `.focus()`s a day cell directly, then presses ArrowRight, which
        // used to move relative to whatever `active` happened to be BEFORE
        // that focus call).
        const onFocusIn = (e: FocusEvent): void => {
          const idx = resolveItemIndex(e.target);
          if (idx !== null) machine.moveTo(idx);
        };

        root.addEventListener('keydown', onKeyDown);
        root.addEventListener('pointerdown', onPointerDown);
        root.addEventListener('focusin', onFocusIn);

        // Phase 77 (T-77-03-03) — tracks the currently-pending deferred rAF
        // pass (if any) so a NEW active-change can cancel it before
        // scheduling its own, and so teardown can cancel a still-pending
        // pass.
        let activeRafId: number | null = null;

        // Plan 260806-lz7 — the last active index a focus/scroll pass
        // actually resolved for THIS attachment. Distinguishes a
        // first/redundant pass (guarded by `focusIsWithinScope`) from a
        // genuine navigation pass (unconditional). Seeded null for every
        // fresh (re)attachment — this local lives inside the outer watch
        // callback, so a new root naturally starts a new one.
        let lastFocusedActive: number | null = null;

        // ---- Reactive to `active`: focus / scroll / active-class ----
        // A getter-form `watch` source: Vue tracks whatever reactive state
        // `opts.getActive()` reads INSIDE this call (the author's own
        // `ref`/`defineModel` binding), so the callback below fires exactly
        // once per active-change — never once per unrelated parent render.
        // `{ immediate: true }` applies the (re)attachment-time active
        // state — load-bearing for the 77-07 fix: a conditionally-mounted
        // root's re-entry always gets a fresh apply here even when the
        // resolved active index happens to repeat the value from its
        // PREVIOUS incarnation, because this inner watch itself is torn
        // down and freshly created (with a NEW immediate fire) every time
        // the OUTER watch above sees a new root.
        const stopActiveWatch = watch(
          () => opts.getActive(),
          (active) => {
            if (!Number.isFinite(active)) return;

            // A new active-change supersedes any still-pending deferred
            // pass from the PREVIOUS change — mirrors the React reference's
            // effect-cleanup-cancels-prior-rAF behavior.
            if (activeRafId !== null) {
              cancelAnimationFrame(activeRafId);
              activeRafId = null;
            }

            // Plan 260806-lz7 — computed ONCE per watch-callback invocation
            // (not per `applyActiveEffects` call) so the deferred rAF retry
            // below reuses the SAME may-apply decision the synchronous pass
            // made, rather than re-evaluating against a `lastFocusedActive`
            // this same invocation already advanced to `active`.
            const isNavigationPass = lastFocusedActive !== null && lastFocusedActive !== active;
            const mayApply =
              isNavigationPass ||
              focusIsWithinScope(resolveFocusScope(opts, root), root.ownerDocument);
            lastFocusedActive = active;

            // Extracted so it can run a SECOND time from the deferred rAF
            // pass below (Phase 77) without duplicating the
            // focus/scroll/class-toggle logic. Returns whether an element
            // for `active` was found in the DOM.
            const applyActiveEffects = (): boolean => {
              const activeEl = root.querySelector<HTMLElement>(
                `[data-rozie-keynav-item="${active}"]`,
              );

              // SPEC §9 — additive active-class toggle.
              // `data-rozie-keynav-active` is ALWAYS present (emitter-owned,
              // declarative, SPEC §9 first paragraph); this is the OPTIONAL
              // extra author-class toggle, necessarily imperative because
              // there is no reactive-render slot for "the currently active
              // list item" the way `:class` merges the rest of an element's
              // classes.
              if (opts.activeClass !== undefined) {
                const tokens = normalizeClassTokens(opts.activeClass);
                if (tokens.length > 0) {
                  for (const el of root.querySelectorAll<HTMLElement>(
                    '[data-rozie-keynav-item]',
                  )) {
                    el.classList.remove(...tokens);
                  }
                  if (activeEl) activeEl.classList.add(...tokens);
                }
              }

              // Tabindex model (SPEC §3) — DOM focus follows the active
              // item. The `tabindex` VALUE itself is a declarative template
              // binding (emitter-owned); only the imperative `.focus()`
              // call belongs here. Plan 260806-lz7: gated behind `mayApply`
              // — a first/redundant pass only focuses when the composed
              // active element is already inside the owning component; a
              // genuine navigation pass always focuses.
              if (mayApply && opts.config.focusModel === 'tabindex' && activeEl) {
                activeEl.focus();
              }

              // SPEC §10 — windower present: drive its `scrollToIndex`. No
              // windower: fall back to `scrollIntoView` on the rendered
              // node. Plan 260806-lz7: same `mayApply` gate as the focus
              // call above.
              if (mayApply) {
                if (opts.windower) {
                  opts.windower.scrollToIndex(active, { align: 'nearest' });
                } else if (activeEl) {
                  activeEl.scrollIntoView({ block: 'nearest' });
                }
              }

              return activeEl !== null;
            };

            const found = applyActiveEffects();

            // Phase 77 (T-77-03-03) — an author may set the active index in
            // the SAME tick a dataset swaps (grid paging), so the item
            // element for the new active index may not exist yet at
            // watch-callback time. Retry EXACTLY ONCE after the browser has
            // painted — no polling loop, no bespoke scheduler. Guarded so
            // it only re-applies if `active` is STILL the value it was
            // scheduled for; a stale pass must never steal focus from a
            // newer navigation.
            if (!found) {
              activeRafId = requestAnimationFrame(() => {
                activeRafId = null;
                if (opts.getActive() !== active) return;
                applyActiveEffects();
              });
            }
          },
          { immediate: true },
        );

        // The outer watch's teardown for THIS root, registered via the
        // getter-form watch callback's own `onCleanup` (Vue's `WatchCallback`
        // signature — NOT a return value, unlike `watchEffect`): stop the
        // inner active-watch, cancel any pending rAF, remove listeners,
        // dispose the machine. Runs automatically right before the outer
        // watch's NEXT fire (a different root) or on component unmount.
        onCleanup(() => {
          stopActiveWatch();
          if (activeRafId !== null) {
            cancelAnimationFrame(activeRafId);
            activeRafId = null;
          }
          root.removeEventListener('keydown', onKeyDown);
          root.removeEventListener('pointerdown', onPointerDown);
          root.removeEventListener('focusin', onFocusIn);
          machine.dispose();
        });
      },
      { immediate: true },
    );
  });
}
